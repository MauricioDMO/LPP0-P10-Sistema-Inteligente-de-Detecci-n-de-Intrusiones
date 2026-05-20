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
- tamano total.
- documentos totales.
- shards yellow/green.

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

## Seguridad

Puede ser solo lectura, pero idealmente requiere JWT.
