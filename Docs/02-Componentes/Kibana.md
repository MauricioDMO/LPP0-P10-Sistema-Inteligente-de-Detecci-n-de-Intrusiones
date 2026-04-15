# Kibana

## Que es

Kibana es la capa de visualizacion y exploracion para datos almacenados en Elasticsearch.

## Por que se usa en este proyecto

- Permite validar rapidamente que los eventos llegan.
- Facilita filtros por tiempo, IP, dominio, protocolo y tipo de evento.
- Acelera analisis sin escribir consultas complejas desde cero.

## Como esta configurado aqui

Archivo: `kibana/kibana.yml`

Configuracion activa:

- `server.host: 0.0.0.0`
- `server.name: kibana`
- `elasticsearch.hosts: ["http://elasticsearch:9200"]`

Compose:

- Puerto publicado `5601:5601`.
- Dependencia de Elasticsearch healthy.

## Que revisar una vez levantado

1. Ingresar a `http://localhost:5601`.
2. Confirmar disponibilidad de Data Views de Filebeat.
3. En Discover, validar eventos con campos Suricata:
   - `event.module: suricata`
   - `suricata.eve.event_type`
   - `source.ip` / `destination.ip`

## Buenas practicas

- Definir ventanas temporales claras durante pruebas.
- Guardar busquedas y visualizaciones base para el equipo.
- Documentar filtros de investigacion recurrentes.

## Riesgos y limitaciones

- Sin autenticacion en UI.
- Exposicion en `0.0.0.0` requiere control por red/firewall.
- Dashboard depende de que Filebeat setup haya corrido correctamente.
