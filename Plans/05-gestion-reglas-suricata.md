# Gestion Suricata Por Perfiles Y Politicas

> Estado: plan MVP historico. La implementacion actual ya supero partes de este documento. Para operacion vigente usar `Docs/03-Operacion/Manual-Panel-Suricata.md` y `Docs/02-Componentes/Suricata.md`.

Notas de divergencia conocidas:

- La UI actual usa rutas separadas bajo `/suricata`: resumen, fuentes, perfiles, overrides, reglas custom y notificaciones.
- El frontend limita `/suricata` a roles `admin` y `analyst`; los permisos `viewer` de lectura existen en backend, pero no en la UI actual.
- Las fuentes iniciales reales son `et/open`, `abuse.ch/urlhaus`, `abuse.ch/feodotracker`, `abuse.ch/sslbl-blacklist` y `oisf/trafficid`.
- Los modelos actuales agregan `notify_enabled` en overrides/reglas custom y la tabla `suricata_notification_settings` para Telegram.
- El apply job se crea directamente como `running`; `pending` existe en el modelo, pero no es usado por el flujo actual.
- `reject` en overrides se renderiza igual que `drop` en `drop.conf`; `modify.conf` sigue vacio.

## Objetivo

Permitir administrar configuracion operativa de Suricata desde frontend/backend sin exponer un editor libre de archivos.

El frontend no debe modificar archivos directamente. Next.js solo cambia datos en PostgreSQL. FastAPI lee ese estado deseado, genera archivos controlados, ejecuta `suricata-update`, valida con `suricata -T` y recarga Suricata solo si la configuracion es valida.

## Principio de diseno

La base de datos no representa el YAML completo de Suricata. La base de datos representa politicas de seguridad.

Flujo objetivo:

```txt
Next.js
  -> HTTP
FastAPI
  -> PostgreSQL: perfiles, fuentes, overrides, reglas custom, jobs
  -> generador de configuracion
  -> enable.conf / disable.conf / drop.conf / modify.conf / local.rules
  -> suricata-update
  -> suricata -T
  -> reload Suricata
```

## Dependencias

Requiere antes:

- PostgreSQL + ORM.
- JWT y roles.
- Usuario inicial `admin`.

Roles permitidos:

- `admin`: todo.
- `analyst`: gestionar perfiles, overrides, reglas custom y aplicar configuracion.
- `viewer`: solo lectura.

## Alcance MVP

- Crear y activar perfiles de configuracion.
- Habilitar/deshabilitar fuentes de reglas compatibles con `suricata-update`.
- Activar, desactivar o convertir reglas por SID a `drop`/`reject`.
- Agregar reglas personalizadas.
- Validar reglas personalizadas antes de guardar o aplicar.
- Ejecutar aplicacion de configuracion como job auditable.
- Guardar archivos generados y salida de comandos.
- Recargar Suricata solo si `suricata-update` y `suricata -T` pasan.

Fuera del MVP:

- Editor libre de `suricata.yaml`.
- `modify.conf` avanzado.
- Rollback automatico completo.
- Comparacion visual entre versiones.
- Recomendaciones automaticas de falsos positivos.

## Modelo mental de la UI

El usuario ve opciones de alto nivel:

```txt
Modo:
- IDS
- IPS moderado
- IPS estricto

Fuentes:
- ET Open
- abuse.ch ThreatFox
- abuse.ch FeodoTracker

Acciones:
- Activar regla
- Desactivar regla
- Convertir regla a drop
- Convertir regla a reject
- Agregar regla personalizada
```

Internamente se traduce a:

```txt
enable.conf
disable.conf
drop.conf
modify.conf
local-rules/custom.rules
```

## Tablas PostgreSQL

### `suricata_profiles`

Representa un perfil completo como `IDS basico`, `IPS moderado`, `IPS estricto`, `Laboratorio` o `Produccion`.

```sql
CREATE TABLE suricata_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    mode TEXT NOT NULL CHECK (mode IN ('IDS', 'IPS')),
    sensitivity TEXT NOT NULL CHECK (sensitivity IN ('low', 'medium', 'high')),
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `suricata_sources`

Representa fuentes que `suricata-update` puede usar.

```sql
CREATE TABLE suricata_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Ejemplos:

```txt
et/open
abuse.ch/threatfox
abuse.ch/feodotracker
abuse.ch/sslbl-c2
oisf/trafficid
```

### `suricata_rule_overrides`

Representa acciones por SID dentro de un perfil.

```sql
CREATE TABLE suricata_rule_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES suricata_profiles(id) ON DELETE CASCADE,
    gid INTEGER DEFAULT 1,
    sid INTEGER NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('enable', 'disable', 'drop', 'alert', 'reject')),
    reason TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(profile_id, gid, sid, action)
);
```

Ejemplos:

```txt
SID 2019401 -> drop
SID 2027758 -> disable
SID 2034647 -> enable
```

### `suricata_custom_rules`

Representa reglas locales gestionadas por el sistema.

```sql
CREATE TABLE suricata_custom_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES suricata_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    rule_text TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    validation_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (validation_status IN ('pending', 'valid', 'invalid')),
    validation_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Ejemplo:

```txt
alert icmp any any -> any any (msg:"PING detectado"; sid:1000001; rev:1;)
```

### `suricata_apply_jobs`

Registra cada intento de aplicar configuracion.

```sql
CREATE TABLE suricata_apply_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES suricata_profiles(id),
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed')),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    generated_files JSONB,
    command_output TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `suricata_config_versions`

Guarda snapshot de los archivos generados para auditoria y rollback futuro.

```sql
CREATE TABLE suricata_config_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES suricata_profiles(id),
    apply_job_id UUID REFERENCES suricata_apply_jobs(id),
    status TEXT NOT NULL CHECK (status IN ('applied', 'failed', 'rolled_back')),
    enable_conf TEXT,
    disable_conf TEXT,
    drop_conf TEXT,
    modify_conf TEXT,
    local_rules TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Endpoints Backend

### Estado general

```http
GET /api/suricata/status
```

Debe responder estado de Suricata, perfil activo y ultimo job.

### Perfiles

```http
GET /api/suricata/profiles
POST /api/suricata/profiles
PATCH /api/suricata/profiles/{profile_id}
POST /api/suricata/profiles/{profile_id}/activate
```

### Fuentes

```http
GET /api/suricata/sources
PATCH /api/suricata/sources/{source_id}
```

Cambiar fuentes solo modifica estado deseado en DB. No ejecuta `suricata-update` hasta llamar `/apply`.

### Overrides por SID

```http
GET /api/suricata/profiles/{profile_id}/rule-overrides
POST /api/suricata/profiles/{profile_id}/rule-overrides
DELETE /api/suricata/rule-overrides/{override_id}
```

### Reglas personalizadas

```http
GET /api/suricata/profiles/{profile_id}/custom-rules
POST /api/suricata/profiles/{profile_id}/custom-rules
PATCH /api/suricata/custom-rules/{rule_id}
DELETE /api/suricata/custom-rules/{rule_id}
POST /api/suricata/custom-rules/validate
```

### Aplicar configuracion

```http
POST /api/suricata/apply
GET /api/suricata/apply-jobs/{job_id}
```

Para una demo puede ejecutarse sincrono si tarda poco. Para una version mas seria, `/apply` debe crear el job y ejecutarlo con worker.

## Proceso interno de `/apply`

1. Crear job `pending`.
2. Marcar job `running`.
3. Cargar perfil desde DB.
4. Cargar fuentes habilitadas.
5. Cargar overrides habilitados.
6. Cargar reglas custom habilitadas y validas.
7. Generar archivos temporales.
8. Ejecutar `suricata-update` con argumentos fijos.
9. Ejecutar `suricata -T -c /etc/suricata/suricata.yaml`.
10. Si valida, promover archivos a ubicacion activa.
11. Guardar `suricata_config_versions`.
12. Recargar Suricata con `USR2`.
13. Marcar job `success`.
14. Si falla, guardar stdout/stderr/error, marcar `failed` y no recargar.

## Generacion de archivos

Ejemplo desde DB:

```txt
SID 2019401 -> drop
SID 2027758 -> disable
SID 2034647 -> enable
```

Genera:

```txt
# drop.conf
1:2019401

# disable.conf
1:2027758

# enable.conf
1:2034647
```

Reglas personalizadas:

```txt
# local-rules/custom.rules
alert icmp any any -> any any (msg:"PING detectado"; sid:1000001; rev:1;)
```

## Comandos permitidos

No interpolar input de usuario en shell.

Usar `subprocess.run([...], check=True, capture_output=True, text=True)` con argumentos fijos.

Ejemplo:

```python
subprocess.run(
    [
        "suricata-update",
        "--suricata-conf", "/etc/suricata/suricata.yaml",
        "--enable-conf", "/etc/suricata/enable.conf",
        "--disable-conf", "/etc/suricata/disable.conf",
        "--drop-conf", "/etc/suricata/drop.conf",
        "--local", "/etc/suricata/local-rules",
    ],
    check=True,
    capture_output=True,
    text=True,
)
```

Validacion:

```bash
suricata -T -c /etc/suricata/suricata.yaml
```

Reload:

```bash
kill -USR2 $(pidof suricata)
```

Si el reload se hace desde fuera del contenedor:

```bash
docker kill -s USR2 suricata
```

## Integracion Docker

Opcion rapida para laboratorio:

- Backend monta directorios controlados de Suricata.
- Backend puede enviar reload via Docker.
- Documentar que montar `/var/run/docker.sock` da alto privilegio.

Opcion recomendada:

- Crear servicio interno `suricata-manager`.
- `suricata-manager` es el unico que puede escribir configs, ejecutar `suricata-update`, validar y recargar.
- FastAPI principal solo invoca al manager por red interna.

## Estructura Backend Recomendada

```txt
backend/app/
  routes/
    suricata.py
  models/
    suricata.py
  schemas/
    suricata.py
  services/
    suricata_config_renderer.py
    suricata_update_runner.py
    suricata_validator.py
    suricata_reloader.py
    suricata_apply_service.py
```

Para MVP se puede usar un router unico `routes/suricata.py`, manteniendo la logica de comandos y renderizado fuera del endpoint.

## Frontend MVP

Ruta inicial:

```txt
/suricata
```

Secciones:

- Estado actual.
- Perfil activo.
- Fuentes de reglas.
- Overrides por SID.
- Reglas personalizadas.
- Ultimos jobs de aplicacion.

Rutas futuras:

```txt
/suricata/profiles
/suricata/sources
/suricata/rules
/suricata/custom-rules
/suricata/apply-jobs
```

## Validacion

- Crear perfil `IPS moderado`.
- Activar una fuente como `et/open`.
- Crear override `SID -> drop`.
- Crear regla custom valida.
- Ejecutar `/api/suricata/apply`.
- Confirmar job `success`.
- Confirmar archivos generados.
- Confirmar que `suricata-update` termino correctamente.
- Confirmar que `suricata -T` valida.
- Confirmar reload `USR2`.
- Generar trafico que dispare una regla.
- Confirmar evento en Elasticsearch.
- Probar regla invalida y confirmar que no se recarga Suricata.
