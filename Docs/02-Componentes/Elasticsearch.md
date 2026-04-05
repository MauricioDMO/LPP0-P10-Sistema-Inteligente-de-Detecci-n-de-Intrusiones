# Elasticsearch

## Que es

Elasticsearch es un motor distribuido de indexacion y busqueda orientado a analitica sobre documentos JSON.

## Por que se usa en este proyecto

- Recibe eventos de red en formato estructurado.
- Permite consultas rapidas por IP, protocolo, tipo de evento y tiempo.
- Es el backend natural para visualizacion en Kibana.

## Como esta configurado aqui

Archivo: `elasticsearch/elasticsearch.yml`

Parámetros clave:

- `discovery.type: single-node`
- `network.host: 0.0.0.0`
- `http.port: 9200`
- `xpack.security.enabled: false`
- paths persistentes para data y logs

Heap JVM (archivo `elasticsearch/jvm.options.d/heap.options`):

- `-Xms512m`
- `-Xmx512m`

Compose:

- Puerto expuesto `9200:9200`.
- Volumenes `esdata` y `eslogs`.
- Healthcheck HTTP local cada 10 segundos.

## Flujo de datos

1. Recibe documentos desde Filebeat.
2. Crea indices/data streams de Beats.
3. Expone API REST para busqueda y agregaciones.
4. Sirve datos a Kibana.

## Validaciones utiles

```bash
curl http://localhost:9200
curl http://localhost:9200/_cat/indices?v
```

## Buenas practicas

- Reservar memoria suficiente en host.
- Ajustar `vm.max_map_count` en Linux cuando sea necesario.
- Monitorear salud de nodo y crecimiento de indices.
- En entornos reales, activar autenticacion y TLS.

## Riesgos y limitaciones

- Nodo unico sin redundancia.
- Seguridad deshabilitada (apto para laboratorio, no para internet abierta).
- Heap fijo en 512 MB puede ser corto en cargas altas.
