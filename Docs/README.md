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
4. [Elasticsearch](02-Componentes/Elasticsearch.md)
5. [Kibana](02-Componentes/Kibana.md)
6. [Levantamiento en Desarrollo](03-Operacion/Levantamiento-Desarrollo.md)
7. [Levantamiento en Produccion](03-Operacion/Levantamiento-Produccion.md)
8. [Inicio y Verificacion](03-Operacion/Inicio-y-Verificacion.md)
9. [Troubleshooting](03-Operacion/Troubleshooting.md)

## Si quieres levantar rapido

- Desarrollo: ver [Levantamiento en Desarrollo](03-Operacion/Levantamiento-Desarrollo.md).
- Produccion: ver [Levantamiento en Produccion](03-Operacion/Levantamiento-Produccion.md).

Ambos documentos incluyen comandos completos y checklist.

## Alcance actual

- Stack dockerizado para laboratorio funcional.
- Configuracion sin autenticacion en Elasticsearch/Kibana para simplicidad.
- Enfoque principal en observabilidad del trafico y validacion del pipeline.

## Nota de seguridad

Este stack esta optimizado para laboratorio. Antes de exponer en red real, revisar endurecimiento en [Troubleshooting](03-Operacion/Troubleshooting.md) y recomendaciones de seguridad en cada documento tecnico.

## Mapa rapido de documentos

- [01-Arquitectura/Arquitectura.md](01-Arquitectura/Arquitectura.md): flujo completo, decisiones tecnicas y trade-offs.
- [02-Componentes/Suricata.md](02-Componentes/Suricata.md): captura de red, reglas y salida EVE JSON.
- [02-Componentes/Filebeat.md](02-Componentes/Filebeat.md): ingestion de logs y envio a Elasticsearch.
- [02-Componentes/Elasticsearch.md](02-Componentes/Elasticsearch.md): indexacion, persistencia y salud del nodo.
- [02-Componentes/Kibana.md](02-Componentes/Kibana.md): visualizacion y exploracion de eventos.
- [03-Operacion/Levantamiento-Desarrollo.md](03-Operacion/Levantamiento-Desarrollo.md): arranque rapido para entorno de trabajo.
- [03-Operacion/Levantamiento-Produccion.md](03-Operacion/Levantamiento-Produccion.md): arranque con override de produccion y controles minimos.
- [03-Operacion/Inicio-y-Verificacion.md](03-Operacion/Inicio-y-Verificacion.md): verificaciones de extremo a extremo.
- [03-Operacion/Troubleshooting.md](03-Operacion/Troubleshooting.md): errores comunes y diagnostico.
- [04-Entregables/Primer-Doc.md](04-Entregables/Primer-Doc.md): documento consolidado de la primera entrega.

