# Documentacion del Proyecto Suricata

Este directorio contiene la documentacion tecnica y operativa del stack de monitoreo de red basado en Suricata, Filebeat, Logstash, Redis, Elasticsearch y Kibana.

El objetivo es que cualquier integrante pueda entender la arquitectura, levantar el sistema y validar el flujo completo sin revisar todos los archivos del repositorio.

## Lectura recomendada

1. [Arquitectura](01-Arquitectura/Arquitectura.md)
2. [Levantamiento en desarrollo](03-Operacion/Levantamiento-Desarrollo.md)
3. [Levantamiento en produccion basica](03-Operacion/Levantamiento-Produccion.md)
4. [Inicio y verificacion](03-Operacion/Inicio-y-Verificacion.md)
5. [Troubleshooting](03-Operacion/Troubleshooting.md)

## Levantar rapido

Desarrollo o laboratorio:

```bash
cp .env.example .env
docker compose up -d --build
```

Produccion basica:

```bash
cp .env.example .env
sudo sysctl -w vm.max_map_count=262144
docker compose -f docker-compose.prod.yml up -d --build
```

Antes de ejecutar, revisa `.env`. Si cambias a `SURICATA_MODE=ids`, ajusta `SURICATA_INTERFACE` a una interfaz real del host.

## Flujo del sistema

```text
Trafico de red
  -> Suricata
  -> /var/log/suricata/eve.json
  -> Filebeat
  -> Logstash
  -> Elasticsearch -> Kibana
  -> Redis Pub/Sub -> consumidores realtime
```

## Documentos

- [Arquitectura](01-Arquitectura/Arquitectura.md): flujo completo, decisiones tecnicas, persistencia y riesgos.
- [Suricata](02-Componentes/Suricata.md): captura, modo IPS/IDS, reglas y salida EVE JSON.
- [Filebeat](02-Componentes/Filebeat.md): lectura de `eve.json` y envio a Logstash.
- [Logstash](02-Componentes/Logstash.md): distribucion a Elasticsearch y Redis.
- [Redis](02-Componentes/Redis.md): canal Pub/Sub para eventos en tiempo real.
- [Elasticsearch](02-Componentes/Elasticsearch.md): indexacion y consulta historica.
- [Kibana](02-Componentes/Kibana.md): exploracion visual de eventos.
- [Levantamiento en desarrollo](03-Operacion/Levantamiento-Desarrollo.md): arranque local/laboratorio.
- [Levantamiento en produccion](03-Operacion/Levantamiento-Produccion.md): arranque con puertos restringidos a localhost.
- [Inicio y verificacion](03-Operacion/Inicio-y-Verificacion.md): checklist end-to-end.
- [Troubleshooting](03-Operacion/Troubleshooting.md): diagnostico de fallas comunes.
- [Primer documento](04-Entregables/Primer-Doc.md): evidencia historica de la primera entrega.

## Alcance

- Stack dockerizado para laboratorio y produccion basica.
- Suricata en modo IPS por defecto mediante `SURICATA_MODE=ips`.
- Pipeline historico con indices diarios `suricata-YYYY.MM.dd` en Elasticsearch.
- Pipeline realtime con Redis Pub/Sub en el canal `suricata`.
- Seguridad de Elastic y Redis deshabilitada por simplicidad operativa.

## Nota de seguridad

La configuracion actual no debe exponerse directamente a internet. Para un entorno real, habilita autenticacion, TLS, firewall, control de accesos, backups y monitoreo.
