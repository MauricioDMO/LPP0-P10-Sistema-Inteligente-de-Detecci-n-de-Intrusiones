# Manual Del Panel `/suricata`

Este manual explica como usar el panel **Gestion Suricata** para administrar perfiles, fuentes externas, overrides por SID, reglas personalizadas y notificaciones desde el frontend.

Ruta principal del panel:

```text
http://localhost:3000/suricata
```

Rutas de trabajo actuales:

| Ruta | Uso |
| ---- | --- |
| `/suricata` | Resumen, estado y guia rapida. |
| `/suricata/sources` | Fuentes externas de reglas. |
| `/suricata/profiles` | Perfiles IDS/IPS. |
| `/suricata/overrides` | Overrides por `GID:SID`. |
| `/suricata/custom-rules` | Reglas locales personalizadas. |
| `/suricata/notifications` | Configuracion Telegram. |

## Contenido

- [Manual Del Panel `/suricata`](#manual-del-panel-suricata)
  - [Contenido](#contenido)
  - [Proposito Del Panel](#proposito-del-panel)
  - [Acceso Y Permisos](#acceso-y-permisos)
  - [Modelo Operativo](#modelo-operativo)
    - [Perfil](#perfil)
    - [Fuente De Reglas](#fuente-de-reglas)
    - [SID Y GID](#sid-y-gid)
    - [Override Por SID](#override-por-sid)
    - [Regla Personalizada](#regla-personalizada)
    - [Job De Aplicacion](#job-de-aplicacion)
    - [Notificaciones Telegram](#notificaciones-telegram)
  - [Proceso Interno De Aplicacion](#proceso-interno-de-aplicacion)
  - [Recorrido Del Panel](#recorrido-del-panel)
    - [Barra Superior Y Navegacion](#barra-superior-y-navegacion)
    - [Tarjetas De Estado](#tarjetas-de-estado)
    - [Perfiles](#perfiles)
    - [Fuentes De Reglas](#fuentes-de-reglas)
    - [Overrides Por SID](#overrides-por-sid)
    - [Reglas Personalizadas](#reglas-personalizadas)
  - [Flujo Recomendado De Uso](#flujo-recomendado-de-uso)
  - [Casos De Uso](#casos-de-uso)
    - [Crear Una Regla De Deteccion Rapida](#crear-una-regla-de-deteccion-rapida)
    - [Desactivar Un Falso Positivo Por SID](#desactivar-un-falso-positivo-por-sid)
    - [Convertir Una Regla Existente En Bloqueo IPS](#convertir-una-regla-existente-en-bloqueo-ips)
    - [Activar ET Open](#activar-et-open)
  - [Validacion Y Troubleshooting](#validacion-y-troubleshooting)
    - [Validar En `/live`](#validar-en-live)
    - [No Puedo Entrar A `/suricata`](#no-puedo-entrar-a-suricata)
    - [El Panel Dice `Fuera De Linea`](#el-panel-dice-fuera-de-linea)
    - [La Regla Custom Sale `INVALID`](#la-regla-custom-sale-invalid)
    - [`Aplicar configuracion` Falla](#aplicar-configuracion-falla)
    - [La Regla Se Aplico Pero No Aparece En `/live`](#la-regla-se-aplico-pero-no-aparece-en-live)
    - [Una Regla Bloquea Demasiado Trafico](#una-regla-bloquea-demasiado-trafico)
  - [Endpoints Relacionados](#endpoints-relacionados)
  - [Advertencias Operativas](#advertencias-operativas)


## Proposito Del Panel

El panel permite preparar y aplicar politicas controladas de Suricata sin editar archivos manualmente dentro del contenedor.

Desde la interfaz se puede:

- Crear y activar perfiles de trabajo.
- Activar o desactivar fuentes externas compatibles con `suricata-update`.
- Agregar o eliminar overrides por `GID:SID`.
- Crear o eliminar reglas personalizadas locales.
- Marcar overrides y reglas personalizadas para notificacion por Telegram.
- Configurar destinatarios, buffer y zona horaria de notificaciones.
- Aplicar la configuracion generada sobre el contenedor `suricata`.

El punto mas importante es separar dos estados:

| Estado                 | Donde vive            | Que significa                                                                   |
| ---------------------- | --------------------- | ------------------------------------------------------------------------------- |
| Estado deseado         | PostgreSQL            | Cambios guardados desde el panel: perfiles, fuentes, overrides y reglas custom. |
| Configuracion aplicada | Contenedor `suricata` | Archivos ya copiados, validados y recargados en Suricata.                       |

Crear una regla, activar una fuente o agregar un override solo cambia PostgreSQL. Suricata no cambia hasta presionar **Aplicar configuracion**.

El panel no es un editor general de `suricata.yaml`. Solo administra los archivos y politicas generadas por el backend.

## Acceso Y Permisos

Requisitos previos:

- Stack levantado con Docker Compose.
- Frontend disponible en `http://localhost:3000`.
- Backend disponible en `http://localhost:8000`.
- Contenedor `suricata` creado y en ejecucion.
- Sesion iniciada en el dashboard.

Credenciales de laboratorio usadas normalmente:

```text
usuario: admin
password: admin123
```

Permisos reales en la UI actual:

| Rol | Acceso al panel `/suricata` |
| --- | --------------------------- |
| `admin` | Si |
| `analyst` | Si |
| `viewer` | No |

Nota tecnica: el backend conserva endpoints de lectura permitidos para `viewer`, pero el frontend protege toda la seccion `/suricata` con roles `admin` y `analyst`.

Permisos expuestos por los endpoints del backend:

| Accion                               | admin | analyst | viewer |
| ------------------------------------ | ----: | ------: | -----: |
| Ver estado Suricata                  |    Si |      Si |     Si |
| Ver perfiles                         |    Si |      Si |     Si |
| Crear perfiles                       |    Si |      Si |     No |
| Activar perfiles                     |    Si |      Si |     No |
| Ver fuentes                          |    Si |      Si |     Si |
| Activar/desactivar fuentes           |    Si |      Si |     No |
| Ver overrides                        |    Si |      Si |     Si |
| Crear/eliminar overrides             |    Si |      Si |     No |
| Ver reglas personalizadas            |    Si |      Si |     Si |
| Crear/eliminar reglas personalizadas |    Si |      Si |     No |
| Aplicar configuracion                |    Si |      Si |     No |
| Ver configuracion de notificaciones  |    Si |      Si |     Si |
| Editar notificaciones                |    Si |      Si |     No |

Comandos utiles para revisar servicios:

```bash
sg docker -c "docker-compose ps"
sg docker -c "docker logs suricata --tail=50"
curl http://localhost:8000/api/events/health
```

## Modelo Operativo

### Perfil

Un perfil agrupa una politica de trabajo. En la base de datos guarda:

- Nombre y descripcion.
- Modo declarado: `IDS` o `IPS`.
- Sensibilidad declarada: `low`, `medium` o `high`.
- Overrides por SID asociados al perfil.
- Reglas personalizadas asociadas al perfil.

Solo un perfil puede estar marcado como activo. Ademas, el panel permite seleccionar cualquier perfil para editarlo y aplicar su configuracion.

Nota tecnica: en la implementacion actual, `mode` y `sensitivity` son metadatos operativos del perfil. El backend no cambia automaticamente el modo real del contenedor ni genera reglas distintas segun la sensibilidad.

### Fuente De Reglas

Una fuente es un ruleset externo manejado por `suricata-update`.

Fuentes cargadas por el seed inicial:

| Nombre tecnico              | Nombre visible             |
| --------------------------- | -------------------------- |
| `et/open`                   | ET Open                    |
| `abuse.ch/urlhaus`          | abuse.ch URLhaus           |
| `abuse.ch/feodotracker`     | abuse.ch FeodoTracker      |
| `abuse.ch/sslbl-blacklist`  | abuse.ch SSLBL Blacklist   |
| `oisf/trafficid`            | OISF Traffic ID            |

Activar o desactivar una fuente guarda el estado deseado. Durante **Aplicar configuracion**, el backend ejecuta `suricata-update enable-source` o `suricata-update disable-source` para cada fuente.

### SID Y GID

Suricata identifica reglas con el par `GID:SID`.

| Campo | Significado                                                   |
| ----- | ------------------------------------------------------------- |
| `GID` | Identificador del generador. En reglas comunes suele ser `1`. |
| `SID` | Identificador unico de la regla.                              |

Ejemplo:

```text
1:2019401
```

### Override Por SID

Un override cambia como se debe cargar una regla existente sin modificar el archivo original de la fuente.

Tambien puede marcarse con `notify_enabled`. Ese flag no cambia la configuracion de Suricata; solo indica al backend que debe enviar notificacion Telegram cuando llegue un evento `alert` con el mismo `GID:SID`, siempre que Telegram este habilitado globalmente.

Acciones disponibles:

| Accion UI              | Valor interno | Archivo generado | Efecto actual                                                  |
| ---------------------- | ------------- | ---------------- | -------------------------------------------------------------- |
| Activar regla          | `enable`      | `enable.conf`    | Fuerza la carga del SID.                                       |
| Desactivar regla       | `disable`     | `disable.conf`   | Evita que el SID se cargue.                                    |
| Bloquear sin respuesta | `drop`        | `drop.conf`      | Convierte el SID a bloqueo via `suricata-update --drop-conf`.  |
| Bloquear con rechazo   | `reject`      | `drop.conf`      | En la implementacion actual se trata igual que `drop`.         |
| Solo alertar           | `alert`       | Ninguno          | Se guarda en BD, pero actualmente no genera linea en archivos. |

Nota tecnica: `modify.conf` se genera vacio. No se usa para convertir acciones a `alert` o `reject` en la version actual.

### Regla Personalizada

Una regla personalizada es una regla Suricata completa escrita desde el panel. Al aplicar, las reglas validas y habilitadas del perfil se escriben en:

```text
/etc/suricata/local-rules/custom.rules
```

La validacion al guardar es basica. Revisa que el texto tenga:

- Accion inicial permitida: `alert`, `drop`, `reject` o `pass`.
- Direccion `->` o `<>`.
- Opciones entre parentesis.
- `msg:`.
- `sid:`.
- `rev:`.
- Final valido con `)` o `;)`.

La validacion completa ocurre durante **Aplicar configuracion** con:

```bash
suricata -T -c /etc/suricata/suricata.yaml
```

La UI permite crear, eliminar y activar/desactivar reglas personalizadas. Al desactivar una regla queda guardada en PostgreSQL, pero no se escribe en `custom.rules` durante **Aplicar configuracion**.

Cada regla personalizada tambien tiene `notify_enabled`. Cuando esta activo, el backend extrae el `sid` y `gid` desde `rule_text` y envia notificacion si llega un evento `alert` que coincida con esa regla y Telegram esta habilitado globalmente.

El seed inicial en `backend/app/db/seed/suricata.py` crea un perfil base si no existe ninguno y carga como reglas personalizadas las reglas de YouTube y sitios adultos que antes estaban en archivos estaticos.

### Job De Aplicacion

Cada ejecucion de **Aplicar configuracion** crea un job en PostgreSQL.

Estados posibles:

| Estado    | Significado                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------- |
| `running` | Aplicacion en progreso.                                                                         |
| `success` | Archivos generados, Suricata validado y proceso recargado.                                      |
| `failed`  | Fallo un comando, la validacion o el reload.                                                    |
| `pending` | Estado permitido por el modelo, aunque el flujo actual crea el job directamente como `running`. |

El job guarda los archivos generados, salida de comandos y mensaje de error si falla.

### Notificaciones Telegram

Las notificaciones se configuran desde:

```text
http://localhost:3000/suricata/notifications
```

La configuracion vive en PostgreSQL en `suricata_notification_settings`.

Campos disponibles:

| Campo | Descripcion |
| ----- | ----------- |
| `telegram_enabled` | Habilita o deshabilita el envio global. |
| `telegram_chat_recipients` | Lista de destinatarios con `name` y `chat_id`. |
| `buffer_enabled` | Agrupa alertas antes de enviarlas. |
| `buffer_minutes` | Minutos de espera antes de enviar el resumen agrupado. |
| `timezone` | Zona horaria para mostrar timestamps, por ejemplo `UTC` o `UTC-5`. |

Requisitos para que una alerta se envie:

1. El token `BACKEND_TELEGRAM_BOT_TOKEN` debe estar configurado en el backend.
2. `telegram_enabled` debe estar activo.
3. Debe existir al menos un `chat_id` configurado.
4. El evento recibido debe ser `event_type = alert`.
5. El `GID:SID` del evento debe coincidir con un override o regla personalizada marcada como `notify_enabled` en el perfil activo.

Si `buffer_enabled` esta apagado, el backend envia cada alerta individual con deduplicacion corta. Si esta encendido, acumula alertas durante `buffer_minutes` y envia un resumen.

## Proceso Interno De Aplicacion

Flujo completo cuando se presiona **Aplicar configuracion**:

```text
Frontend /suricata
  -> POST /api/suricata/apply
  -> Backend carga perfil seleccionado o perfil activo
  -> Backend lee fuentes, overrides y reglas custom desde PostgreSQL
  -> Renderiza enable.conf, disable.conf, drop.conf, modify.conf y custom.rules
  -> Copia archivos al contenedor suricata con docker cp
  -> Ejecuta suricata-update enable-source/disable-source por fuente
  -> Ejecuta suricata-update con enable.conf, disable.conf, drop.conf y reglas locales
  -> Ejecuta suricata -T -c /etc/suricata/suricata.yaml
  -> Si la validacion pasa, envia SIGUSR2 al proceso Suricata
  -> Guarda job success o failed en PostgreSQL
```

Archivos generados y copiados:

| Archivo en contenedor                    | Origen de datos                      |
| ---------------------------------------- | ------------------------------------ |
| `/etc/suricata/enable.conf`              | Overrides `enable`.                  |
| `/etc/suricata/disable.conf`             | Overrides `disable`.                 |
| `/etc/suricata/drop.conf`                | Overrides `drop` y `reject`.         |
| `/etc/suricata/modify.conf`              | Actualmente vacio.                   |
| `/etc/suricata/local-rules/custom.rules` | Reglas custom validas y habilitadas. |
| `/var/lib/suricata/rules/suricata.rules` | Salida generada por `suricata-update` en el volumen `suricata-rules`. |

Comando principal usado por el backend:

```bash
docker exec suricata suricata-update \
  --suricata-conf /etc/suricata/suricata.yaml \
  --enable-conf /etc/suricata/enable.conf \
  --disable-conf /etc/suricata/disable.conf \
  --drop-conf /etc/suricata/drop.conf \
  --local /etc/suricata/local-rules
```

Despues valida:

```bash
docker exec suricata suricata -T -c /etc/suricata/suricata.yaml
```

Si la validacion pasa, recarga el proceso:

```bash
docker exec suricata sh -c "pidof suricata | tr ' ' '\n' | xargs -r kill -USR2"
```

Si algun comando falla, el job queda `failed` y el panel muestra el error resumido en la tarjeta **Ultima aplicacion**.

## Recorrido Del Panel

### Barra Superior Y Navegacion

Botones principales:

| Boton                     | Funcion                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| **Actualizar**            | Recarga estado, perfiles, fuentes, overrides y reglas desde el backend. |
| **Aplicar configuracion** | Ejecuta el proceso real de generacion, validacion y reload de Suricata. |

La navegacion superior separa el trabajo en paginas: **Resumen**, **Fuentes**, **Perfiles**, **Overrides**, **Reglas** y **Notificaciones**.

### Tarjetas De Estado

El panel muestra tres tarjetas:

| Tarjeta               | Que indica                                                 |
| --------------------- | ---------------------------------------------------------- |
| **Estado Suricata**   | Si Docker reporta el contenedor `suricata` como corriendo. |
| **Perfil activo**     | Perfil marcado como activo en PostgreSQL.                  |
| **Ultima aplicacion** | Estado y hora del ultimo job de apply.                     |

Importante: **Estado Suricata: En linea** solo confirma que el contenedor esta corriendo. No confirma que una regla especifica haya disparado ni que el pipeline completo hasta `/live` este funcionando.

### Perfiles

La pagina `/suricata/profiles` permite crear perfiles, seleccionarlos visualmente y marcar uno como activo.

Campos para crear perfil:

| Campo        | Obligatorio | Descripcion                                         |
| ------------ | ----------: | --------------------------------------------------- |
| Nombre       |          Si | Nombre humano del perfil.                           |
| Descripcion  |          No | Contexto operativo.                                 |
| Modo         |          Si | `IDS` o `IPS`, como metadato del perfil.            |
| Sensibilidad |          Si | `Baja`, `Media` o `Alta`, como metadato del perfil. |

Uso recomendado:

1. Crear o seleccionar un perfil.
2. Confirmar que la fila quede resaltada.
3. Editar fuentes, overrides o reglas asociadas a ese perfil.
4. Presionar **Aplicar configuracion** cuando se quiera llevar esa politica a Suricata.

Activar un perfil solo actualiza cual queda marcado como activo. No recarga Suricata por si solo.

### Fuentes De Reglas

La pagina `/suricata/sources` lista rulesets externos.

Columnas:

| Columna        | Descripcion                         |
| -------------- | ----------------------------------- |
| Estado         | Checkbox `Activa` o `Inactiva`.     |
| Fuente         | Nombre visible.                     |
| Nombre tecnico | Nombre usado por `suricata-update`. |
| Descripcion    | Resumen del ruleset.                |

Para activar o desactivar una fuente:

1. Marcar o desmarcar el checkbox.
2. Confirmar que el estado visual cambie.
3. Presionar **Aplicar configuracion**.

### Overrides Por SID

La pagina `/suricata/overrides` se usa cuando ya se conoce el `SID` de una regla existente.

Campos:

| Campo | Valor recomendado | Descripcion |
| ----- | ----------------- | ----------- |
| GID | `1` | Generador de la regla. |
| SID | SID conocido | Identificador de la regla. |
| Accion | Segun el caso | `enable`, `disable`, `drop`, `reject` o `alert`. |
| Motivo | Texto corto | Razon del cambio para auditoria. |
| Telegram | Opcional | Activa o desactiva notificacion para ese `GID:SID`. |

Para agregar un override:

1. Seleccionar el perfil correcto.
2. Escribir `GID`, normalmente `1`.
3. Escribir el `SID`.
4. Elegir la accion.
5. Escribir el motivo.
6. Presionar **Agregar**.
7. Presionar **Aplicar configuracion**.

Para eliminar un override:

1. Ubicarlo en la tabla.
2. Presionar el boton de papelera.
3. Confirmar que desaparezca.
4. Presionar **Aplicar configuracion**.

Ejemplo de override de bloqueo:

```text
GID: 1
SID: 2019401
Accion: Bloquear sin respuesta
Motivo: Prueba IPS laboratorio
```

Resultado generado en `drop.conf`:

```text
1:2019401
```

### Reglas Personalizadas

La pagina `/suricata/custom-rules` permite crear reglas locales completas y activar/desactivar cada una sin eliminarla.

Campos:

| Campo | Obligatorio | Descripcion |
| ----- | ----------: | ----------- |
| Nombre | Si | Nombre humano para reconocer la regla. |
| Descripcion | No | Contexto de uso o prueba. |
| Texto de la regla | Si | Regla Suricata completa. |
| Estado | No | Si esta inactiva, no se aplica. |
| Telegram | No | Si esta activo, el backend notifica eventos que coincidan con el `sid` de la regla. |

Para crear una regla:

1. Seleccionar el perfil correcto.
2. Escribir nombre y descripcion opcional.
3. Escribir la regla completa.
4. Presionar **Agregar regla**.
5. Confirmar que la tabla muestre `VALID`.
6. Presionar **Aplicar configuracion**.
7. Generar trafico que coincida con la regla.
8. Revisar el evento en `/live`.

Para desactivar una regla sin perderla:

1. Desmarcar el checkbox de la regla en la tabla.
2. Presionar **Aplicar configuracion**.
3. Confirmar que el job termine en `success`.

Ejemplo ICMP simple:

```suricata
alert icmp any any -> any any (msg:"PING detectado"; sid:1000001; rev:1;)
```

Ejemplo HTTP local para validar el panel:

```suricata
alert http any any -> any any (msg:"CUSTOM UI TEST LOCALHOST HTTP"; http.host; content:"localhost"; sid:1009024; rev:1;)
```

Recomendaciones:

- Usar `sid` unico en un rango local, por ejemplo `1000000` en adelante.
- Incrementar `rev` cuando cambie la logica de la regla.
- Usar mensajes `msg` claros, porque ese texto aparece en `/live`.
- Probar primero con `alert`.
- Pasar a `drop` o `reject` solo despues de validar que no rompe trafico legitimo.
- Evitar reglas demasiado amplias en IPS.

## Flujo Recomendado De Uso

Para cambios seguros:

1. Entrar a `http://localhost:3000/login` e iniciar sesion con usuario autorizado.
2. Abrir `http://localhost:3000/suricata`.
3. Confirmar **Estado Suricata: En linea**.
4. Ir a `/suricata/profiles` y crear o activar un perfil de laboratorio.
5. Ir a `/suricata/custom-rules` y crear reglas inicialmente con accion `alert`.
6. Si corresponde, marcar Telegram en reglas u overrides y configurar `/suricata/notifications`.
7. Presionar **Aplicar configuracion** desde la barra superior.
8. Confirmar que **Ultima aplicacion** quede en `success`.
9. Generar trafico controlado.
10. Revisar `/live` y buscar el texto definido en `msg`.
11. Si se requiere bloqueo, cambiar la regla o override a `drop`.
12. Aplicar nuevamente.
13. Validar que el bloqueo no interrumpa servicios necesarios.
14. Documentar SID, mensaje y motivo.

## Casos De Uso

### Crear Una Regla De Deteccion Rapida

Usar cuando se quiere confirmar que Suricata ve cierto protocolo o destino.

```suricata
alert http any any -> any any (msg:"LAB HTTP LOCALHOST"; http.host; content:"localhost"; sid:1009100; rev:1;)
```

Despues de aplicar, navegar por el panel y buscar `LAB HTTP LOCALHOST` en `/live`.

### Desactivar Un Falso Positivo Por SID

1. Identificar el SID en el evento o fuente de reglas.
2. En **Overrides por SID**, usar `GID=1` y el `SID` detectado.
3. Elegir **Desactivar regla**.
4. Escribir un motivo, por ejemplo `Falso positivo en laboratorio`.
5. Agregar y aplicar configuracion.

### Convertir Una Regla Existente En Bloqueo IPS

1. Identificar el SID de una regla que ya alerta correctamente.
2. En **Overrides por SID**, usar accion **Bloquear sin respuesta**.
3. Aplicar configuracion.
4. Generar trafico de prueba.
5. Revisar `/live` y la conectividad esperada.

### Activar ET Open

1. Ir a **Fuentes de reglas**.
2. Marcar `ET Open`.
3. Presionar **Aplicar configuracion**.
4. Esperar job `success`.
5. Generar trafico y validar nuevos eventos en `/live` o historico.

## Validacion Y Troubleshooting

### Validar En `/live`

Despues de aplicar una regla personalizada:

1. Ir a `http://localhost:3000/live`.
2. Generar trafico que coincida con la regla.
3. Buscar el texto definido en `msg`.
4. Confirmar que el evento aparece como `ALERT`, `DNS`, `HTTP`, `TLS` u otro tipo segun el trafico.

Prueba con ICMP:

```bash
ping -c 4 8.8.8.8
```

Luego buscar `PING detectado` en `/live`.

Prueba con HTTP externo:

```bash
curl http://neverssl.com
```

Luego buscar el `msg` configurado en la regla HTTP correspondiente.

### No Puedo Entrar A `/suricata`

Revisar:

- Sesion iniciada en `/login`.
- Credenciales correctas.
- Rol del usuario.
- Backend disponible en `localhost:8000`.

Comandos:

```bash
curl http://localhost:8000/api/events/health
sg docker -c "docker-compose ps"
```

### El Panel Dice `Fuera De Linea`

El backend no puede confirmar que el contenedor `suricata` este corriendo.

Revisar:

```bash
sg docker -c "docker ps --filter name=suricata"
sg docker -c "docker inspect -f '{{.State.Running}}' suricata"
sg docker -c "docker logs suricata --tail=80"
```

### La Regla Custom Sale `INVALID`

Revisar que la regla tenga accion valida, direccion, parentesis de opciones, `msg:`, `sid:` y `rev:`.

Ejemplo minimo valido:

```suricata
alert icmp any any -> any any (msg:"PING detectado"; sid:1000001; rev:1;)
```

### `Aplicar configuracion` Falla

Posibles causas:

- Regla sintacticamente invalida para Suricata aunque paso la validacion basica.
- Fuente externa no disponible o nombre incorrecto.
- Contenedor `suricata` apagado.
- Backend sin permisos para ejecutar Docker.
- `suricata-update` fallo.
- `suricata -T` fallo.

Revisar:

```bash
sg docker -c "docker logs backend --tail=120"
sg docker -c "docker logs suricata --tail=120"
sg docker -c "docker exec suricata suricata -T -c /etc/suricata/suricata.yaml"
```

### La Regla Se Aplico Pero No Aparece En `/live`

Revisar:

- Que el job haya quedado en `success`.
- Que el trafico realmente coincida con la regla.
- Que el `sid` no este duplicado con otra regla.
- Que la regla este en el perfil aplicado.
- Que se haya presionado **Aplicar configuracion** despues de crearla.
- Que Filebeat, Logstash, Redis y backend esten procesando eventos.

Comandos utiles:

```bash
sg docker -c "docker exec suricata grep -n 'CUSTOM UI TEST' /etc/suricata/local-rules/custom.rules"
sg docker -c "docker logs filebeat --tail=80"
sg docker -c "docker logs logstash --tail=80"
sg docker -c "docker logs backend --tail=80"
```

### Una Regla Bloquea Demasiado Trafico

Acciones seguras:

1. Eliminar la regla custom o cambiarla a una regla `alert` menos agresiva.
2. Aplicar configuracion.
3. Si el panel no responde, revisar NFQUEUE y logs de Suricata.

Comando para revisar NFQUEUE:

```bash
sg docker -c "docker exec suricata iptables -L OUTPUT -n"
```

## Endpoints Relacionados

Endpoints usados por la UI actual:

```http
GET    /api/suricata/status
GET    /api/suricata/profiles
POST   /api/suricata/profiles
POST   /api/suricata/profiles/{profile_id}/activate
DELETE /api/suricata/profiles/{profile_id}
GET    /api/suricata/sources
PATCH  /api/suricata/sources/{source_id}
GET    /api/suricata/profiles/{profile_id}/rule-overrides
POST   /api/suricata/profiles/{profile_id}/rule-overrides
PATCH  /api/suricata/rule-overrides/{override_id}
DELETE /api/suricata/rule-overrides/{override_id}
GET    /api/suricata/profiles/{profile_id}/custom-rules
POST   /api/suricata/profiles/{profile_id}/custom-rules
PATCH  /api/suricata/custom-rules/{rule_id}
DELETE /api/suricata/custom-rules/{rule_id}
POST   /api/suricata/apply
GET    /api/suricata/notification-settings
PATCH  /api/suricata/notification-settings
```

Endpoints disponibles en backend pero no expuestos directamente por la UI actual:

```http
PATCH  /api/suricata/profiles/{profile_id}
POST   /api/suricata/custom-rules/validate
GET    /api/suricata/apply-jobs/{job_id}
```

Las mutaciones requieren sesion valida, rol `admin` o `analyst`, y token CSRF manejado por el frontend.

## Advertencias Operativas

- En modo IPS real, reglas `drop` pueden cortar trafico del host.
- En la implementacion actual, el override `reject` se escribe en `drop.conf`, igual que `drop`.
- `notify_enabled` no modifica reglas ni archivos Suricata; solo controla envio Telegram desde el backend.
- El contenedor Suricata usa privilegios elevados y modifica `iptables`/`ip6tables` cuando corre en IPS.
- No aplicar reglas de bloqueo amplias sin probarlas antes como `alert`.
- No reutilizar `sid` entre reglas custom.
- No activar fuentes grandes sin considerar ruido, falsos positivos y tiempo de actualizacion.
- **Estado Suricata: En linea** no reemplaza una validacion end-to-end en `/live`.
