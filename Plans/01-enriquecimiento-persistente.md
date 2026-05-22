# Enriquecimiento Persistente

## Estado actual

El backend enriquece eventos con:

- DNS reverso.
- GeoIP.
- AbuseIPDB.

Pero el enriquecimiento ocurre al consultar o retransmitir eventos. No queda persistido en Elasticsearch.

Esto afecta directamente a analytics historicos. En particular, `/api/analytics/geo` arma el mapa desde una muestra de eventos recientes (`sample_size`) y vuelve a enriquecerlos en tiempo de consulta. Ese resultado no representa necesariamente todo el periodo seleccionado y puede sesgar el heatmap.

## Objetivo

Persistir eventos enriquecidos para que analytics historicos puedan usar:

- `_resolved.source_hostname`
- `_resolved.dest_hostname`
- `_geo.source`
- `_geo.destination`
- `_threat`

El indice enriquecido debe convertirse en la fuente canonica para analytics historicos. Los indices `suricata-*` quedan como fuente cruda del pipeline Filebeat/Logstash; los endpoints analiticos deben consultar preferentemente `suricata-enriched-*`.

## Estrategia recomendada

Crear un indice nuevo para eventos enriquecidos:

- `suricata-enriched-YYYY.MM.dd`

No modificar directamente `suricata-*` para evitar conflictos con Filebeat/Logstash.

## Modelo de documento enriquecido

Ademas de conservar el evento original, agregar campos enriquecidos persistidos:

- `_resolved.source_hostname`
- `_resolved.dest_hostname`
- `_geo.source.country`
- `_geo.source.country_code`
- `_geo.source.city`
- `_geo.source.lat`
- `_geo.source.lon`
- `_geo.source.location`
- `_geo.source.isp`
- `_geo.destination.country`
- `_geo.destination.country_code`
- `_geo.destination.city`
- `_geo.destination.lat`
- `_geo.destination.lon`
- `_geo.destination.location`
- `_geo.destination.isp`
- `_threat.is_malicious`
- `_threat.confidence`
- `_threat.total_reports`

Los campos `_geo.*.location` deben guardarse como objeto `geo_point` compatible con Elasticsearch:

```json
{
  "lat": -12.04,
  "lon": -77.03
}
```

Mantener `lat` y `lon` separados ayuda al frontend, pero `location` es el campo principal para agregaciones geograficas.

## Cambios backend

Agregar configuracion:

- `BACKEND_ELASTICSEARCH_ENRICHED_INDEX_PREFIX=suricata-enriched`
- `BACKEND_ELASTICSEARCH_ENRICHED_INDEX=suricata-enriched-*`
- `BACKEND_ENRICHED_WRITE_ENABLED=true`

Crear modulo:

- `backend/app/enriched_writer.py`

Responsabilidades:

- Recibir evento crudo.
- Enriquecerlo.
- Normalizar campos `_geo.*.location` cuando existan `lat` y `lon`.
- Generar indice por fecha.
- Indexarlo en Elasticsearch.
- Usar `_id` deterministico para evitar duplicados al reprocesar eventos.
- Evitar fallo fatal si Elasticsearch no responde.

El `_id` puede derivarse de campos estables del evento:

- `@timestamp`
- `flow_id` si existe.
- `event_type`
- `source.ip`
- `destination.ip`
- `suricata.eve.alert.signature` si existe.

Si falta alguno, usar solo los disponibles y calcular hash.

Modificar `event_callback` en `backend/app/main.py`:

1. Recibe evento desde Redis.
2. Ejecuta `enrich_event`.
3. Persiste evento enriquecido.
4. Procesa notificaciones.
5. Retransmite por WebSocket.

La escritura a Elasticsearch debe ser no fatal: si falla la persistencia enriquecida, el evento aun debe poder notificarse y transmitirse por WebSocket.

## Cambios analytics

Actualizar endpoints historicos para poder consultar:

- `suricata-enriched-*` preferentemente.
- fallback opcional a `suricata-*` solo para endpoints que puedan funcionar sin enriquecimiento.

`/api/analytics/geo` no debe depender de `sample_size` para construir el mapa. Debe consultar `suricata-enriched-*` con agregaciones sobre todos los documentos del periodo seleccionado.

Parametros recomendados:

- `hours=1|6|24|168`
- `direction=source|destination|both`
- `event_type=all|alert|dns|http|tls`
- `only_blocked=true|false`
- `only_malicious=true|false`
- `min_count=1`

Respuesta recomendada por punto geografico:

```json
{
  "lat": -12.04,
  "lon": -77.03,
  "country": "Peru",
  "country_code": "PE",
  "city": "Lima",
  "isp": "Claro",
  "count": 352,
  "source_count": 40,
  "destination_count": 312,
  "alert_count": 91,
  "blocked_count": 23,
  "malicious_count": 4,
  "max_severity": 1,
  "unique_ips": 18,
  "top_event_types": [
    { "type": "tls", "count": 190 },
    { "type": "alert", "count": 91 }
  ],
  "top_signatures": [
    { "signature": "[BLOQUEO] adult site TLS SNI", "count": 23 }
  ],
  "last_seen": "2026-05-20T00:00:00Z"
}
```

El frontend debe mostrar eventos analizados del periodo, no "muestra". Si se mantiene algun limite para rendimiento, debe ser limite de buckets/puntos agregados, no cantidad de eventos crudos leidos.

## Backfill

Agregar comando o script para reprocesar datos existentes:

1. Leer eventos desde `suricata-*` por rango temporal.
2. Enriquecer cada evento.
3. Escribirlo en `suricata-enriched-YYYY.MM.dd` usando `_id` deterministico.
4. Permitir ejecucion por lotes para no saturar Elasticsearch ni servicios externos de GeoIP/Threat Intel.

El backfill es necesario si se quiere que `/geo` y otros analytics historicos sean correctos para datos anteriores a la implementacion.

## Validacion

- Generar trafico.
- Confirmar indice `suricata-enriched-YYYY.MM.dd`.
- Consultar documento y verificar `_geo`, `_resolved`, `_threat`.
- Confirmar `_geo.source.location` y `_geo.destination.location` cuando existan coordenadas.
- Confirmar que frontend sigue recibiendo eventos realtime.
- Confirmar que `/api/analytics/geo` consulta `suricata-enriched-*` y no usa `sample_size` como base del mapa.
- Confirmar que el total analizado coincide con los documentos enriquecidos del periodo filtrado.
- Confirmar filtros `direction=source|destination|both`.
- Confirmar que el mapa muestra metricas de periodo completo, no una muestra reciente.
