# Dashboard De Salud Del Stack

## Objetivo

Crear vista de salud operacional del sistema.

Conviene implementarlo despues de PostgreSQL y gestion Suricata para evitar rehacer la pantalla cuando existan perfiles, jobs, versiones aplicadas y fuentes gestionadas.

## Metricas

Backend:

- estado Redis.
- estado Elasticsearch.
- estado WebSocket.
- cantidad de clientes conectados.
- ultimo evento recibido.
- eventos por minuto.

Elasticsearch:

- health.
- indices `suricata-*`.
- indices `suricata-enriched-*`.
- tamano total.
- documentos totales.
- shards yellow/green.
- ultimo evento enriquecido persistido.
- porcentaje de eventos enriquecidos con GeoIP.
- porcentaje de eventos enriquecidos con Threat Intel.
- errores recientes de escritura al indice enriquecido.
- estado del template `suricata-enriched-template`.
- estado de GeoLite2 o fallback `ip-api.com`.

Suricata:

- contenedor arriba.
- logs recientes.
- modo IPS/IDS.
- reglas NFQUEUE presentes.
- perfil activo.
- ultimo job de aplicacion.
- ultima version de configuracion aplicada.
- resultado reciente de `suricata-update` y `suricata -T`.
- fuentes de reglas habilitadas.

Filebeat/Logstash:

- estado contenedor.
- ultimos logs.
- eventos procesados si esta disponible.

## Backend endpoints

- `GET /api/system/health`
- `GET /api/system/elasticsearch`
- `GET /api/system/pipeline`
- `GET /api/system/containers`
- `GET /api/system/suricata-config`

## Frontend

Agregar ruta:

- `/system`

Componentes:

- tarjetas por servicio.
- estado verde/amarillo/rojo.
- ultimos eventos.
- tamano de indices.
- tiempo desde ultimo evento.
- cobertura de enriquecimiento: `_geo`, `_resolved`, `_threat`.
- alerta si `/geo` no puede usar `suricata-enriched-*`.
- alerta si el ultimo job de aplicacion de Suricata fallo.
- alerta si el perfil activo no coincide con el modo real IDS/IPS.

## Seguridad

Puede ser solo lectura, pero idealmente requiere JWT.
