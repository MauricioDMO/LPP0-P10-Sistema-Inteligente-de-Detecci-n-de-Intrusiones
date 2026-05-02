# Proyecto Suricata + Elastic Stack

Sistema de deteccion y monitoreo de intrusiones orientado a laboratorio academico.

El flujo del proyecto es:

1. Suricata captura trafico de red y genera eventos EVE JSON.
2. Filebeat ingiere esos eventos.
3. Elasticsearch indexa los documentos.
4. Kibana permite exploracion y visualizacion.

## Integrantes

Ver listado completo en [Integrantes.md](Integrantes.md).

## Estructura del proyecto

- `suricata/`: contenedor, configuracion y reglas de Suricata.
- `filebeat/`: configuracion de ingestion de logs.
- `elasticsearch/`: configuracion del nodo Elasticsearch.
- `kibana/`: configuracion de Kibana.
- `Docs/`: documentacion tecnica y operativa agrupada.

## Prerequisitos

- Docker Engine
- Docker Compose
- Interfaz de red valida para Suricata en `.env`

Comando util para listar interfaces:

```bash
ip -o link show | awk -F': ' '{print $2}'
```

## Variables de entorno

Configurar el archivo `.env` (o copiar desde `.env.example`):

```env
STACK_VERSION=8.19.14
SURICATA_MODE=local-ips
SURICATA_NFQUEUE_NUM=0
SURICATA_INTERFACE=wlp0s20f3
```

Modos soportados por Suricata:

- `local-ips`: modo actual; inspecciona trafico generado por el host/VM usando NFQUEUE en `OUTPUT`.
- `ids`: captura pasiva en `SURICATA_INTERFACE`.
- `gateway-ips`: para VM gateway; Suricata escucha NFQUEUE y las reglas de red viven en el host Debian.

## Levantamiento en desarrollo

```bash
docker compose config
docker compose build
docker compose up -d
docker compose run --rm filebeat filebeat setup -e --strict.perms=false
```

Ver estado y logs:

```bash
docker compose ps
docker compose logs -f suricata
docker compose logs -f filebeat
curl http://localhost:9200/_cat/indices?v
```

Kibana:

- http://localhost:5601

## Levantamiento en produccion (basico)

```bash
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml run --rm filebeat filebeat setup -e --strict.perms=false
```

## Levantamiento en modo gateway

El modo gateway usa `docker-compose.gateway.yml` y scripts en `scripts/gateway/`. Esta preparado para una VM Debian con dos interfaces: WAN hacia la red externa y LAN hacia el AP.

Ver guia: [Docs/03-Operacion/Levantamiento-Gateway.md](Docs/03-Operacion/Levantamiento-Gateway.md)

## Documentacion

Indice general: [Docs/README.md](Docs/README.md)

Documentos agrupados:

- Arquitectura: [Docs/01-Arquitectura/Arquitectura.md](Docs/01-Arquitectura/Arquitectura.md)
- Componentes:
  - [Docs/02-Componentes/Suricata.md](Docs/02-Componentes/Suricata.md)
  - [Docs/02-Componentes/Filebeat.md](Docs/02-Componentes/Filebeat.md)
  - [Docs/02-Componentes/Elasticsearch.md](Docs/02-Componentes/Elasticsearch.md)
  - [Docs/02-Componentes/Kibana.md](Docs/02-Componentes/Kibana.md)
- Operacion:
  - [Docs/03-Operacion/Levantamiento-Desarrollo.md](Docs/03-Operacion/Levantamiento-Desarrollo.md)
  - [Docs/03-Operacion/Levantamiento-Produccion.md](Docs/03-Operacion/Levantamiento-Produccion.md)
  - [Docs/03-Operacion/Levantamiento-Gateway.md](Docs/03-Operacion/Levantamiento-Gateway.md)
  - [Docs/03-Operacion/Inicio-y-Verificacion.md](Docs/03-Operacion/Inicio-y-Verificacion.md)
  - [Docs/03-Operacion/Troubleshooting.md](Docs/03-Operacion/Troubleshooting.md)
- Entregables:
  - [Docs/04-Entregables/Primer-Doc.md](Docs/04-Entregables/Primer-Doc.md)

## Nota de seguridad

La configuracion actual prioriza facilidad de uso en laboratorio. Antes de exponer el stack en una red real, aplicar hardening (autenticacion, TLS, firewall y control de accesos).
