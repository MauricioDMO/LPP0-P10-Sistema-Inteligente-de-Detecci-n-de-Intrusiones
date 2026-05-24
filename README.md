# Proyecto Suricata + Elastic Stack

Sistema de deteccion y monitoreo de intrusiones orientado a laboratorio academico.

El flujo del proyecto es:

1. Suricata captura trafico de red y genera eventos EVE JSON.
2. Filebeat ingiere esos eventos.
3. Logstash distribuye los eventos hacia Elasticsearch y Redis Pub/Sub.
4. Elasticsearch indexa los documentos historicos.
5. El backend FastAPI consulta historico y retransmite eventos realtime por WebSocket.
6. El backend autentica usuarios con JWT en cookie HttpOnly, roles persistidos en PostgreSQL y revocacion por `token_version`.
7. El backend enriquece eventos con DNS reverso, GeoIP y AbuseIPDB, y puede notificar por Telegram.
8. El frontend Next.js muestra dashboards en vivo e historicos con graficas, mapa, filtros, rankings y exportacion CSV.

## Integrantes

Ver listado completo en [Integrantes.md](Integrantes.md).

## Estructura del proyecto

- `suricata/`: contenedor, configuracion y reglas de Suricata.
- `filebeat/`: configuracion de ingestion de logs.
- `logstash/`: distribucion de eventos hacia Elasticsearch y Redis.
- `elasticsearch/`: configuracion del nodo Elasticsearch.
- `backend/`: API FastAPI, WebSocket, enriquecimiento y notificaciones.
- `frontend/`: dashboard Next.js que consume la API REST/WebSocket del backend.
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
SURICATA_MODE=ips
SURICATA_INTERFACE=wlp0s20f3
BACKEND_TELEGRAM_BOT_TOKEN=
BACKEND_ABUSEIPDB_KEY=
BACKEND_GEOIP_DB_PATH=/data/GeoLite2-City.mmdb
POSTGRES_DB=suricata
POSTGRES_USER=suricata
POSTGRES_PASSWORD=suricata
BACKEND_DATABASE_URL=postgresql+asyncpg://suricata:suricata@postgres:5432/suricata
BACKEND_JWT_SECRET=change-me
BACKEND_JWT_EXPIRES_MINUTES=480
BACKEND_INITIAL_ADMIN_USERNAME=admin
BACKEND_INITIAL_ADMIN_PASSWORD=admin123
BACKEND_INITIAL_ADMIN_EMAIL=admin@example.com
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

## Levantamiento en desarrollo

```bash
docker compose config
docker compose build
docker compose up -d
```

Ver estado y logs:

```bash
docker compose ps
docker compose logs -f suricata
docker compose logs -f filebeat
curl http://localhost:9200/_cat/indices?v
curl http://localhost:8000/api/events/health
```

El servicio `elasticsearch-setup` aplica de forma idempotente la politica ILM `suricata-1-year` y los templates `suricata-template` / `suricata-enriched-template` cuando Elasticsearch esta saludable. Para reaplicarlos manualmente:

```bash
docker compose run --rm elasticsearch-setup
```

Validar retencion y templates:

```bash
curl http://localhost:9200/_ilm/policy/suricata-1-year
curl http://localhost:9200/_index_template/suricata-template
curl http://localhost:9200/_index_template/suricata-enriched-template
```

Frontend:

- http://localhost:3000
- Rutas principales: `/live`, `/historical`, `/blocked`, `/geo`, `/rankings`

Endpoints utiles:

```bash
curl -c cookies.txt -b cookies.txt -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
curl -b cookies.txt http://localhost:8000/api/auth/me
curl -b cookies.txt http://localhost:8000/api/events/latest?limit=3
curl -b cookies.txt http://localhost:8000/api/events/stats?hours=24
curl -b cookies.txt http://localhost:8000/api/analytics/overview?hours=24
curl -b cookies.txt "http://localhost:8000/api/analytics/top-ips?hours=24&direction=source&size=5"
```

El frontend inicia sesion en `http://localhost:3000/login`. El admin inicial se toma de `BACKEND_INITIAL_ADMIN_USERNAME` y `BACKEND_INITIAL_ADMIN_PASSWORD` solo si la base no tiene usuarios.

## Levantamiento en produccion (basico)

```bash
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

## Documentacion

Indice general: [Docs/README.md](Docs/README.md)

Documentos agrupados:

- Arquitectura: [Docs/01-Arquitectura/Arquitectura.md](Docs/01-Arquitectura/Arquitectura.md)
- Flujo y backend: [Docs/01-Arquitectura/Flujo-y-Backend.md](Docs/01-Arquitectura/Flujo-y-Backend.md)
- Componentes:
  - [Docs/02-Componentes/Suricata.md](Docs/02-Componentes/Suricata.md)
  - [Docs/02-Componentes/Filebeat.md](Docs/02-Componentes/Filebeat.md)
  - [Docs/02-Componentes/Elasticsearch.md](Docs/02-Componentes/Elasticsearch.md)
  - [Docs/02-Componentes/Redis.md](Docs/02-Componentes/Redis.md)
  - [Docs/02-Componentes/Logstash.md](Docs/02-Componentes/Logstash.md)
  - [Docs/02-Componentes/PostgreSQL-Auth.md](Docs/02-Componentes/PostgreSQL-Auth.md)
- Operacion:
  - [Docs/03-Operacion/Levantamiento-Desarrollo.md](Docs/03-Operacion/Levantamiento-Desarrollo.md)
  - [Docs/03-Operacion/Levantamiento-Produccion.md](Docs/03-Operacion/Levantamiento-Produccion.md)
  - [Docs/03-Operacion/Inicio-y-Verificacion.md](Docs/03-Operacion/Inicio-y-Verificacion.md)
  - [Docs/03-Operacion/Troubleshooting.md](Docs/03-Operacion/Troubleshooting.md)
- Entregables:
  - [Docs/04-Entregables/Primer-Doc.md](Docs/04-Entregables/Primer-Doc.md)

## Nota de seguridad

La configuracion actual prioriza facilidad de uso en laboratorio. Antes de exponer el stack en una red real, cambia `BACKEND_JWT_SECRET`, credenciales iniciales, passwords de PostgreSQL, aplica TLS, firewall, backups y control de accesos para Elastic/Redis.
