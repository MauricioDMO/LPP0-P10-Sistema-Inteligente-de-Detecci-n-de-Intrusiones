# Kibana

Kibana permite explorar y visualizar los eventos almacenados en Elasticsearch.

## Rol en el proyecto

- Verificar que los eventos llegan a Elasticsearch.
- Buscar por tiempo, IP, dominio, protocolo o tipo de evento.
- Crear visualizaciones para analisis historico.

## Configuracion real

Archivo: `kibana/kibana.yml`

```yaml
server.host: 0.0.0.0
server.name: kibana
elasticsearch.hosts: ["http://elasticsearch:9200"]
```

Puertos:

- Desarrollo: `http://localhost:5601`
- Produccion basica: `http://127.0.0.1:5601`

Kibana depende de que Elasticsearch este sano.

## Primer uso

1. Abrir `http://localhost:5601`.
2. Ir a `Stack Management`.
3. Entrar en `Data Views`.
4. Crear un Data View con patron `suricata-*`.
5. Usar `@timestamp` como campo de tiempo.
6. Ir a `Discover` y seleccionar el Data View.

## Filtros utiles

```text
event.module: suricata
suricata.eve.event_type: alert
source.ip: <ip>
destination.ip: <ip>
```

## Riesgos

- UI sin autenticacion.
- No debe exponerse directamente a internet.
- Si no hay indices `suricata-*`, primero revisar Suricata, Filebeat y Logstash.
