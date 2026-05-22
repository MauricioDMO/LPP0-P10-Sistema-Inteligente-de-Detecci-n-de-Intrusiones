# Elasticsearch

Elasticsearch almacena e indexa los eventos de Suricata para busqueda historica.

## Rol en el proyecto

- Recibe eventos desde Logstash.
- Crea indices diarios `suricata-YYYY.MM.dd`.
- Expone API REST en el puerto `9200`.
- Sirve datos historicos al backend FastAPI.

## Configuracion real

Archivo: `elasticsearch/elasticsearch.yml`

```yaml
cluster.name: elasticsearch
node.name: es01
discovery.type: single-node
network.host: 0.0.0.0
http.port: 9200
xpack.security.enabled: false
```

Heap JVM: `elasticsearch/jvm.options.d/heap.options`

```text
-Xms512m
-Xmx512m
```

Volumenes:

- `esdata`: datos indexados.
- `eslogs`: logs internos.

## Validacion rapida

Estado HTTP:

```bash
curl http://localhost:9200
```

Salud del cluster:

```bash
curl http://localhost:9200/_cluster/health
```

Indices:

```bash
curl http://localhost:9200/_cat/indices?v
```

## Retencion y templates

El stack define una politica ILM de 1 ano y templates versionados para indices crudos y enriquecidos:

- `elasticsearch/ilm/suricata-ilm.json`: politica `suricata-1-year`, elimina indices despues de 365 dias.
- `elasticsearch/templates/suricata-template.json`: template para `suricata-*`.
- `elasticsearch/templates/suricata-enriched-template.json`: template para `suricata-enriched-*`, con `_geo.source.location` y `_geo.destination.location` como `geo_point`.

El servicio `elasticsearch-setup` aplica estos recursos cuando Elasticsearch esta saludable. Tambien puede ejecutarse manualmente:

```bash
docker compose run --rm elasticsearch-setup
```

Validacion:

```bash
curl http://localhost:9200/_ilm/policy/suricata-1-year
curl http://localhost:9200/_index_template/suricata-template
curl http://localhost:9200/_index_template/suricata-enriched-template
curl http://localhost:9200/suricata-enriched-*/_mapping
```

## Riesgos

- Nodo unico sin alta disponibilidad.
- Seguridad deshabilitada.
- Requiere `vm.max_map_count=262144` en algunos hosts Linux.
- Heap de 512 MB es para laboratorio o carga baja.
