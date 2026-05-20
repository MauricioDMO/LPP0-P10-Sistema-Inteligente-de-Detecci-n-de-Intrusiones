# Enriquecimiento Persistente

## Estado actual

El backend enriquece eventos con:

- DNS reverso.
- GeoIP.
- AbuseIPDB.

Pero el enriquecimiento ocurre al consultar o retransmitir eventos. No queda persistido en Elasticsearch.

## Objetivo

Persistir eventos enriquecidos para que analytics historicos puedan usar:

- `_resolved.source_hostname`
- `_resolved.dest_hostname`
- `_geo.source`
- `_geo.destination`
- `_threat`

## Estrategia recomendada

Crear un indice nuevo para eventos enriquecidos:

- `suricata-enriched-YYYY.MM.dd`

No modificar directamente `suricata-*` para evitar conflictos con Filebeat/Logstash.

## Cambios backend

Agregar configuracion:

- `BACKEND_ELASTICSEARCH_ENRICHED_INDEX_PREFIX=suricata-enriched`

Crear modulo:

- `backend/app/enriched_writer.py`

Responsabilidades:

- Recibir evento crudo.
- Enriquecerlo.
- Generar indice por fecha.
- Indexarlo en Elasticsearch.
- Evitar fallo fatal si Elasticsearch no responde.

Modificar `event_callback` en `backend/app/main.py`:

1. Recibe evento desde Redis.
2. Ejecuta `enrich_event`.
3. Persiste evento enriquecido.
4. Procesa notificaciones.
5. Retransmite por WebSocket.

## Cambios analytics

Actualizar endpoints historicos para poder consultar:

- `suricata-enriched-*` preferentemente.
- fallback opcional a `suricata-*`.

## Validacion

- Generar trafico.
- Confirmar indice `suricata-enriched-YYYY.MM.dd`.
- Consultar documento y verificar `_geo`, `_resolved`, `_threat`.
- Confirmar que frontend sigue recibiendo eventos realtime.
