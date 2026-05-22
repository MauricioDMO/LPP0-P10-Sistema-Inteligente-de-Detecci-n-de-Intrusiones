# Retencion Elasticsearch 1 Ano

## Objetivo

Mantener maximo 1 ano de datos en Elasticsearch.

## Problema actual

Los indices `suricata-*` crecen sin politica de retencion automatica.

## Estrategia

Crear politica ILM:

- Retencion: 365 dias.
- Borrado automatico despues de 365 dias.
- Replicas en laboratorio: 0.

## Indices afectados

- `suricata-*`
- `suricata-enriched-*`

## Implementacion

Agregar archivos:

- `elasticsearch/ilm/suricata-ilm.json`
- `elasticsearch/templates/suricata-template.json`
- `elasticsearch/templates/suricata-enriched-template.json`

Configurar templates con:

- `index.lifecycle.name`
- `number_of_replicas: 0`
- mappings para `@timestamp`, IPs, campos geo, threat intel y keywords relevantes.

## Mapping enriquecido requerido

El template `suricata-enriched-template.json` debe definir explicitamente los campos usados por analytics. No depender solo del dynamic mapping.

Campos base:

- `@timestamp`: `date`
- `source.ip`: `ip`
- `destination.ip`: `ip`
- `suricata.eve.event_type`: `keyword`
- `suricata.eve.alert.signature`: `keyword`
- `suricata.eve.alert.category`: `keyword`
- `suricata.eve.alert.severity`: `integer`
- `_resolved.source_hostname`: `keyword`
- `_resolved.dest_hostname`: `keyword`

Campos GeoIP:

- `_geo.source.country`: `keyword`
- `_geo.source.country_code`: `keyword`
- `_geo.source.city`: `keyword`
- `_geo.source.isp`: `keyword`
- `_geo.source.lat`: `float`
- `_geo.source.lon`: `float`
- `_geo.source.location`: `geo_point`
- `_geo.destination.country`: `keyword`
- `_geo.destination.country_code`: `keyword`
- `_geo.destination.city`: `keyword`
- `_geo.destination.isp`: `keyword`
- `_geo.destination.lat`: `float`
- `_geo.destination.lon`: `float`
- `_geo.destination.location`: `geo_point`

Campos Threat Intel:

- `_threat.is_malicious`: `boolean`
- `_threat.confidence`: `integer`
- `_threat.total_reports`: `integer`

El campo `geo_point` es obligatorio para que `/api/analytics/geo` pueda generar mapas y buckets geograficos confiables sobre `suricata-enriched-*` sin leer muestras de eventos crudos.

## Consideraciones de analytics

La politica y templates deben cubrir ambos patrones:

- `suricata-*`: eventos crudos generados por Filebeat/Logstash.
- `suricata-enriched-*`: eventos enriquecidos usados por dashboards historicos.

Los dashboards historicos deben consultar `suricata-enriched-*` cuando requieran `_geo`, `_resolved` o `_threat`. Si el indice enriquecido no existe todavia, el endpoint debe reportar estado incompleto o usar fallback explicito, no ocultar el problema con una muestra.

## Automatizacion

Agregar script o paso de inicializacion:

- `curl -X PUT /_ilm/policy/suricata-1-year`
- `curl -X PUT /_index_template/suricata-template`
- `curl -X PUT /_index_template/suricata-enriched-template`

## Validacion

- `GET /_ilm/policy/suricata-1-year`
- `GET /_index_template/suricata-template`
- `GET /_index_template/suricata-enriched-template`
- `GET suricata-*/_settings`
- `GET suricata-enriched-*/_settings`
- `GET suricata-enriched-*/_mapping` y confirmar `_geo.source.location` como `geo_point`.
- `GET suricata-enriched-*/_mapping` y confirmar `_geo.destination.location` como `geo_point`.
- Indexar un documento de prueba con `_geo.*.location` y confirmar que Elasticsearch no rechaza el mapping.
