# Elasticsearch

Elasticsearch almacena e indexa los eventos de Suricata para busqueda historica.

## Rol en el proyecto

- Recibe eventos desde Logstash.
- Crea indices diarios `suricata-YYYY.MM.dd`.
- Expone API REST en el puerto `9200`.
- Sirve datos a Kibana.

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

## Riesgos

- Nodo unico sin alta disponibilidad.
- Seguridad deshabilitada.
- Requiere `vm.max_map_count=262144` en algunos hosts Linux.
- Heap de 512 MB es para laboratorio o carga baja.
