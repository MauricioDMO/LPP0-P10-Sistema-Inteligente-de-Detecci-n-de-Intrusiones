# Dashboard De Salud Del Stack

## Objetivo

Crear vista de salud operacional del sistema.

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

Filebeat/Logstash:

- estado contenedor.
- ultimos logs.
- eventos procesados si esta disponible.

## Backend endpoints

- `GET /api/system/health`
- `GET /api/system/elasticsearch`
- `GET /api/system/pipeline`
- `GET /api/system/containers`

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

## Seguridad

Puede ser solo lectura, pero idealmente requiere JWT.
