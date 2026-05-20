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
