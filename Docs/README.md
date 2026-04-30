# Documentacion del Proyecto Suricata + Elastic Stack

Este directorio centraliza la documentacion tecnica del stack IDS que usa Suricata, Filebeat, Elasticsearch y Kibana sobre Docker Compose.

## Objetivo de esta documentacion

- Explicar que hace cada tecnologia.
- Justificar por que se usa en este proyecto.
- Describir la configuracion real del repositorio.
- Guiar el arranque, validacion y diagnostico.

## Ruta de lectura recomendada

1. [Arquitectura](01-Arquitectura/Arquitectura.md)
2. [Suricata](02-Componentes/Suricata.md)
3. [Filebeat](02-Componentes/Filebeat.md)
4. [Logstash](02-Componentes/Logstash.md)
5. [Redis](02-Componentes/Redis.md)
6. [Elasticsearch](02-Componentes/Elasticsearch.md)
7. [Kibana](02-Componentes/Kibana.md)
8. [Levantamiento en Desarrollo](03-Operacion/Levantamiento-Desarrollo.md)
9. [Levantamiento en Produccion](03-Operacion/Levantamiento-Produccion.md)
10. [Inicio y Verificacion](03-Operacion/Inicio-y-Verificacion.md)
11. [Troubleshooting](03-Operacion/Troubleshooting.md)

## Si quieres levantar rapido

- Desarrollo: ver [Levantamiento en Desarrollo](03-Operacion/Levantamiento-Desarrollo.md).
- Produccion: ver [Levantamiento en Produccion](03-Operacion/Levantamiento-Produccion.md).

Ambos documentos incluyen comandos completos y checklist.

## Alcance actual

- Stack dockerizado para laboratorio funcional.
- Configuracion sin autenticacion en Elasticsearch/Kibana para simplicidad.
- Pipeline historico: Suricata → Filebeat → Logstash → Elasticsearch (indices diarios).
- Pipeline realtime: Logstash → Redis Pub/Sub (eventos <1s para backends/dashboards).
- Enfoque principal en observabilidad del trafico y validacion end-to-end.

## Nota de seguridad

Este stack esta optimizado para laboratorio. Antes de exponer en red real, revisar endurecimiento en [Troubleshooting](03-Operacion/Troubleshooting.md) y recomendaciones de seguridad en cada documento tecnico.

## Mapa rapido de documentos

- [01-Arquitectura/Arquitectura.md](01-Arquitectura/Arquitectura.md): flujo completo, decisiones tecnicas, pipeline historico + realtime.
- [02-Componentes/Suricata.md](02-Componentes/Suricata.md): captura de red, reglas y salida EVE JSON.
- [02-Componentes/Filebeat.md](02-Componentes/Filebeat.md): ingestion de logs y envio a Logstash.
- [02-Componentes/Logstash.md](02-Componentes/Logstash.md): multiplexing de eventos a Elasticsearch y Redis.
- [02-Componentes/Redis.md](02-Componentes/Redis.md): Pub/Sub para pipeline realtime.
- [02-Componentes/Elasticsearch.md](02-Componentes/Elasticsearch.md): indexacion, persistencia y salud del nodo.
- [02-Componentes/Kibana.md](02-Componentes/Kibana.md): visualizacion y exploracion de eventos.
- [03-Operacion/Levantamiento-Desarrollo.md](03-Operacion/Levantamiento-Desarrollo.md): arranque rapido para entorno de trabajo.
- [03-Operacion/Levantamiento-Produccion.md](03-Operacion/Levantamiento-Produccion.md): arranque con override de produccion.
- [03-Operacion/Inicio-y-Verificacion.md](03-Operacion/Inicio-y-Verificacion.md): validaciones de Logstash, Redis y end-to-end.
- [03-Operacion/Troubleshooting.md](03-Operacion/Troubleshooting.md): errores comunes, Logstash y Redis.
- [04-Entregables/Primer-Doc.md](04-Entregables/Primer-Doc.md): documento consolidado de la primera entrega.

