# Manual Del Panel `/suricata`

Manual operativo para administrar perfiles, fuentes externas, overrides por SID, reglas personalizadas y notificaciones desde el frontend.

Ruta principal: `http://localhost:3000/suricata`

API relacionada: [API del backend](../02-Componentes/backend/API.md#gestion-suricata)

## Rutas

| Ruta | Uso |
| --- | --- |
| `/suricata` | Resumen, estado y guia rapida. |
| `/suricata/sources` | Fuentes externas de reglas. |
| `/suricata/profiles` | Perfiles IDS/IPS. |
| `/suricata/overrides` | Overrides por `GID:SID`. |
| `/suricata/custom-rules` | Reglas locales personalizadas. |
| `/suricata/notifications` | Configuracion Telegram. |

## Proposito

El panel permite preparar y aplicar politicas de Suricata sin editar archivos manualmente dentro del contenedor.

Desde la interfaz se puede:

- Crear y activar perfiles.
- Activar o desactivar fuentes externas compatibles con `suricata-update`.
- Crear overrides por `GID:SID`.
- Crear, activar, desactivar o eliminar reglas personalizadas.
- Marcar reglas u overrides para notificacion por Telegram.
- Configurar destinatarios, buffer y zona horaria de notificaciones.
- Aplicar configuracion sobre el contenedor `suricata`.

## Modelo Operativo

| Estado | Donde vive | Que significa |
| --- | --- | --- |
| Estado deseado | PostgreSQL | Cambios guardados desde el panel. |
| Configuracion aplicada | Contenedor `suricata` | Archivos generados, validados y recargados. |

Crear una regla, activar una fuente o agregar un override solo cambia PostgreSQL. Suricata no cambia hasta presionar **Aplicar configuracion**.

El panel no es un editor general de `suricata.yaml`; administra archivos y politicas generadas por el backend.

## Acceso Y Permisos

Requisitos:

- Stack levantado.
- Frontend disponible en `http://localhost:3000`.
- Backend disponible en `http://localhost:8000`.
- Sesion iniciada.

Roles en la UI:

| Rol | Acceso al panel `/suricata` |
| --- | --- |
| `admin` | Si |
| `analyst` | Si |
| `viewer` | No |

Detalle de permisos por endpoint: [Gestion Suricata en API](../02-Componentes/backend/API.md#gestion-suricata).

## Conceptos

### Perfil

Agrupa una politica de trabajo: nombre, descripcion, modo declarado, sensibilidad, overrides y reglas personalizadas. Solo un perfil puede estar activo.

`mode` y `sensitivity` son metadatos del perfil; no cambian automaticamente el modo real del contenedor.

### Fuente De Reglas

Ruleset externo manejado por `suricata-update`. El seed inicial carga fuentes como ET Open, URLhaus, FeodoTracker, SSLBL y OISF Traffic ID.

Activar o desactivar una fuente guarda el estado deseado. Durante **Aplicar configuracion**, el backend ejecuta `suricata-update enable-source` o `disable-source`.

### SID Y GID

Suricata identifica reglas con `GID:SID`. En reglas comunes `GID` suele ser `1`; `SID` identifica la regla.

### Override Por SID

Cambia como se carga una regla existente sin modificar el archivo original.

| Accion UI | Valor interno | Archivo generado | Efecto actual |
| --- | --- | --- | --- |
| Activar regla | `enable` | `enable.conf` | Fuerza carga del SID. |
| Desactivar regla | `disable` | `disable.conf` | Evita carga del SID. |
| Bloquear sin respuesta | `drop` | `drop.conf` | Convierte a bloqueo via `suricata-update`. |
| Bloquear con rechazo | `reject` | `drop.conf` | Actualmente se trata igual que `drop`. |
| Solo alertar | `alert` | Ninguno | Se guarda en BD; no genera archivo. |

`notify_enabled` no cambia Suricata; solo indica al backend que debe notificar eventos `alert` coincidentes.

### Regla Personalizada

Regla Suricata completa escrita desde el panel. Al aplicar, las reglas validas y habilitadas se escriben en:

```text
/etc/suricata/local-rules/custom.rules
```

Validacion basica al guardar:

- Accion inicial `alert`, `drop`, `reject` o `pass`.
- Direccion `->` o `<>`.
- Opciones entre parentesis.
- `msg:`, `sid:` y `rev:`.

La validacion completa ocurre durante **Aplicar configuracion** con `suricata -T`.

### Job De Aplicacion

Cada ejecucion de **Aplicar configuracion** crea un job en PostgreSQL con estado `running`, `success` o `failed`. El job guarda archivos generados, salida de comandos y errores.

### Notificaciones Telegram

Se configuran en `/suricata/notifications` y dependen de `BACKEND_TELEGRAM_BOT_TOKEN`.

Una alerta se envia si:

1. Telegram esta habilitado globalmente.
2. Hay al menos un destinatario.
3. El evento es `event_type=alert`.
4. El `GID:SID` coincide con una regla custom u override marcado con `notify_enabled` en el perfil activo.

Variables relacionadas: [Variables de entorno](../05-Referencia/Variables-Entorno.md#enriquecimiento-y-notificaciones).

## Proceso Interno De Aplicacion

```text
Frontend /suricata
  -> POST /api/suricata/apply
  -> Backend carga perfil seleccionado o activo
  -> Lee fuentes, overrides y reglas custom desde PostgreSQL
  -> Renderiza enable.conf, disable.conf, drop.conf, modify.conf y custom.rules
  -> Copia archivos al contenedor suricata
  -> Ejecuta suricata-update
  -> Ejecuta suricata -T
  -> Recarga Suricata con USR2 si la validacion pasa
  -> Guarda job success o failed
```

Archivos generados:

| Archivo en contenedor | Origen de datos |
| --- | --- |
| `/etc/suricata/enable.conf` | Overrides `enable`. |
| `/etc/suricata/disable.conf` | Overrides `disable`. |
| `/etc/suricata/drop.conf` | Overrides `drop` y `reject`. |
| `/etc/suricata/modify.conf` | Actualmente vacio. |
| `/etc/suricata/local-rules/custom.rules` | Reglas custom validas y habilitadas. |
| `/var/lib/suricata/rules/suricata.rules` | Salida generada por `suricata-update`. |

## Uso Recomendado

1. Entrar a `/login` con usuario autorizado.
2. Abrir `/suricata` y confirmar estado en linea.
3. Crear o seleccionar perfil.
4. Crear reglas inicialmente con accion `alert`.
5. Activar Telegram si corresponde.
6. Presionar **Aplicar configuracion**.
7. Confirmar job `success`.
8. Generar trafico controlado.
9. Validar en `/live`.
10. Si se requiere bloqueo, pasar a `drop` o `reject` y aplicar otra vez.

## Casos De Uso

### Crear Una Regla De Deteccion Rapida

```suricata
alert icmp any any -> any any (msg:"PING detectado"; sid:1000001; rev:1;)
```

Despues de aplicar, generar `ping` y buscar `PING detectado` en `/live`.

### Desactivar Un Falso Positivo

1. Identificar el SID en el evento.
2. Ir a `/suricata/overrides`.
3. Usar `GID=1`, el SID detectado y accion **Desactivar regla**.
4. Escribir motivo.
5. Agregar y aplicar configuracion.

### Convertir Una Regla Existente En Bloqueo IPS

1. Identificar un SID que alerta correctamente.
2. Crear override con accion **Bloquear sin respuesta**.
3. Aplicar configuracion.
4. Generar trafico de prueba.
5. Validar `/live` y conectividad.

### Activar ET Open

1. Ir a `/suricata/sources`.
2. Marcar `ET Open`.
3. Presionar **Aplicar configuracion**.
4. Esperar job `success`.
5. Validar nuevos eventos en `/live` o historico.

## Validacion Y Fallas Comunes

- Validacion end-to-end: [Inicio y verificacion](Inicio-y-Verificacion.md).
- Comandos de IPS y reglas: [Comandos](../05-Referencia/Comandos.md#ips-y-reglas).
- Fallas generales: [Troubleshooting](Troubleshooting.md).

Puntos frecuentes:

- Si no puedes entrar a `/suricata`, revisa sesion, rol y backend.
- Si el panel dice `Fuera de linea`, revisa contenedor `suricata`.
- Si una regla sale `INVALID`, revisa accion, direccion, parentesis, `msg`, `sid` y `rev`.
- Si apply falla, revisa logs de backend y Suricata.
- Si la regla no aparece en `/live`, confirma job `success`, perfil aplicado, trafico coincidente y pipeline Filebeat/Logstash/Redis.

## Advertencias Operativas

- En modo IPS real, reglas `drop` pueden cortar trafico del host.
- El override `reject` se escribe en `drop.conf`, igual que `drop`.
- `notify_enabled` solo controla Telegram; no modifica reglas Suricata.
- No reutilizar `sid` entre reglas custom.
- No activar fuentes grandes sin considerar ruido y falsos positivos.
- **Estado Suricata: En linea** no reemplaza validacion end-to-end en `/live`.

Mas recomendaciones: [Seguridad](../05-Referencia/Seguridad.md#reglas-ips).
