# Proyecto Suricata + Elastic Stack

Sistema academico de deteccion, bloqueo y monitoreo de intrusiones en laboratorio.

```text
Suricata -> Filebeat -> Logstash -> Elasticsearch
                                  -> Redis Pub/Sub -> Backend FastAPI -> Frontend Next.js
```

El backend agrega autenticacion con PostgreSQL/JWT, enriquecimiento DNS/GeoIP/AbuseIPDB, notificaciones Telegram y WebSocket para eventos en vivo. El frontend muestra dashboards live e historicos, mapa, rankings, bloqueos y gestion de reglas Suricata.

## Integrantes

Ver [Integrantes.md](Integrantes.md).

## Inicio Rapido

```bash
cp .env.example .env
./scripts/dev-up.sh
```

Opcion manual:

```bash
docker compose up -d --build
```

Frontend: `http://localhost:3000`

API: `http://localhost:8000`

Credenciales bootstrap de laboratorio: `admin` / `admin123`. Para redes compartidas o produccion basica, cambia secretos antes del primer arranque.

## Documentacion

- Indice general: [Docs/README.md](Docs/README.md)
- Arquitectura: [Docs/01-Arquitectura/Arquitectura.md](Docs/01-Arquitectura/Arquitectura.md)
- Flujo backend/frontend: [Docs/01-Arquitectura/Flujo-y-Backend.md](Docs/01-Arquitectura/Flujo-y-Backend.md)
- Levantamiento desarrollo: [Docs/03-Operacion/Levantamiento-Desarrollo.md](Docs/03-Operacion/Levantamiento-Desarrollo.md)
- Verificacion end-to-end: [Docs/03-Operacion/Inicio-y-Verificacion.md](Docs/03-Operacion/Inicio-y-Verificacion.md)
- Demo: [Docs/03-Operacion/Demo-Evaluacion.md](Docs/03-Operacion/Demo-Evaluacion.md)
- API backend: [Docs/02-Componentes/backend/API.md](Docs/02-Componentes/backend/API.md)
- Panel Suricata: [Docs/03-Operacion/Manual-Panel-Suricata.md](Docs/03-Operacion/Manual-Panel-Suricata.md)
- Troubleshooting: [Docs/03-Operacion/Troubleshooting.md](Docs/03-Operacion/Troubleshooting.md)
- Variables: [Docs/05-Referencia/Variables-Entorno.md](Docs/05-Referencia/Variables-Entorno.md)
- Comandos: [Docs/05-Referencia/Comandos.md](Docs/05-Referencia/Comandos.md)
- Seguridad: [Docs/05-Referencia/Seguridad.md](Docs/05-Referencia/Seguridad.md)

## Estructura

- `suricata/`: contenedor, configuracion y arranque IDS/IPS.
- `filebeat/`: lectura de `eve.json`.
- `logstash/`: distribucion hacia Elasticsearch y Redis.
- `elasticsearch/`: nodo, templates e ILM.
- `backend/`: FastAPI, auth, analytics, enriquecimiento y gestion Suricata.
- `frontend/`: dashboard Next.js.
- `Docs/`: documentacion vigente.
- `Plans/`: planes tecnicos historicos o futuros.

## Seguridad

La configuracion prioriza facilidad de laboratorio. Antes de usar datos reales, revisa [Seguridad](Docs/05-Referencia/Seguridad.md).
