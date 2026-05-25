# AGENTS.md

## Scope
- Root project is a Docker Compose lab stack: Suricata (IPS) -> Filebeat -> Logstash -> Elasticsearch + Redis Pub/Sub + FastAPI Backend + PostgreSQL + Next.js Frontend.
- Frontend includes live/historical dashboards, Chart.js, Leaflet maps, threat badges, rankings, blocked traffic views and CSV export.
- `test/` is a separate Bun TypeScript helper that subscribes to Redis; follow `test/CLAUDE.md` there and use Bun commands, not npm/node.

## Documentation Structure
- Current documentation entrypoint: `Docs/README.md`.
- Keep root `README.md` short: overview, quick start and links only.
- Use `Docs/05-Referencia/` as the single source for repeated reference material:
  - `Docs/05-Referencia/Variables-Entorno.md` for `.env` variables.
  - `Docs/05-Referencia/Comandos.md` for common Docker, health, auth, Redis and Suricata commands.
  - `Docs/05-Referencia/Seguridad.md` for risks, hardening and IPS safety notes.
- Do not duplicate long command blocks, env var lists, endpoint tables or security warnings across docs. Link to the reference docs instead.
- `Plans/README.md` indexes planning documents. Treat `Plans/` as roadmap/proposals, not as current operational documentation.
- `Docs/04-Entregables/Primer-Doc.md` is historical and may mention obsolete components such as Kibana.
- `Docs/assets/` stores screenshots/snapshots referenced by demo docs; do not remove these links unless the assets are intentionally moved.

## Architecture
```
Suricata (IPS) -> NFQUEUE -> iptables OUTPUT
  -> eve.json -> Filebeat -> Logstash:5044 -> Elasticsearch:9200
                                            -> Redis Pub/Sub (suricata)
                                               -> Backend (FastAPI)
                                                  -> enricher (DNS + GeoIP + Threat Intel)
                                                  -> notifier (Telegram)
                                                  -> WebSocket -> Frontend (Chart.js + Leaflet)
Backend -> PostgreSQL (users, roles, Suricata profiles/rules/settings)
```

## Key Files
| File | Purpose |
|---|---|
| `README.md` | Short project overview and documentation index |
| `Docs/README.md` | Main documentation index by task/component/reference |
| `Docs/01-Arquitectura/Arquitectura.md` | Current architecture and component responsibilities |
| `Docs/01-Arquitectura/Flujo-y-Backend.md` | Historical vs realtime data flow, backend/frontend split |
| `Docs/05-Referencia/Variables-Entorno.md` | Canonical env var reference |
| `Docs/05-Referencia/Comandos.md` | Canonical command reference |
| `Docs/05-Referencia/Seguridad.md` | Canonical security and IPS safety reference |
| `suricata/Dockerfile` | Adds `iptables-nft` for IPS NFQUEUE |
| `suricata/entrypoint.sh` | IPS: iptables NFQUEUE; IDS: `-i` interface |
| `backend/app/db/seed/suricata.py` | Seeds default sources, base profile, YouTube/adult custom rules |
| `backend/app/geoip.py` | GeoLite2 or ip-api.com fallback, 1h cache |
| `backend/app/threat_intel.py` | AbuseIPDB check, 24h cache |
| `backend/app/enricher.py` | Orchestrates resolver + geoip + threat_intel |
| `backend/app/notifier.py` | Telegram alerts for enabled Suricata notification rules |
| `frontend/` | Next.js dashboard with charts, map, threat badges and Suricata panel |

## Key Modifications
- **Kibana excluded** from both compose files and current docs, except historical deliverables.
- **Suricata** runs in **IPS mode** by default (`SURICATA_MODE=ips`), with NFQUEUE intercepting host OUTPUT traffic.
- **Default local rules** are seeded into PostgreSQL and managed from the UI as custom rules: YouTube + adult-site TLS/HTTP/DNS/QUIC-oriented rules.
- **Backend enrichment pipeline** adds fields to events:
  - `_resolved.source_hostname` / `.dest_hostname` (DNS PTR, 1h cache)
  - `_geo.source` / `.destination` (country, city, lat, lon, ISP; GeoLite2 or ip-api.com)
  - `_threat.is_malicious` / `.confidence` / `.total_reports` (AbuseIPDB, 24h cache)
- **Telegram notifier** sends alerts for `alert` events whose `GID:SID` matches a custom rule or override with `notify_enabled=true` in the active profile, when Telegram is globally enabled and recipients exist.
- **Documentation cleanup** centralizes repeated env vars, commands and security notes under `Docs/05-Referencia/`.

## Backend Endpoints
- Full endpoint reference: `Docs/02-Componentes/backend/API.md`.
- Keep endpoint tables in the API doc. Other docs should link to it instead of duplicating contracts.
- Public basics: `GET /`, `GET /api/events/health`.
- Historical data: `/api/events/*`, `/api/analytics/*`.
- Realtime: `WS /ws` from Redis Pub/Sub channel `suricata`.
- Auth: `/api/auth/*` with JWT cookie + CSRF for mutations.
- Suricata management: `/api/suricata/*` for profiles, sources, overrides, custom rules, apply jobs and notifications.

## Commands
- Prefer command references in `Docs/05-Referencia/Comandos.md` instead of adding new duplicate command sections.
- Full stack: `docker compose up -d --build`.
- Single service rebuild for docker compose v1 stale container bug:
  ```bash
  docker rm -f <service> || true && docker compose up -d --build <service>
  ```
- Backend stale container workaround:
  ```bash
  docker rm -f a123272595fe_backend 2>/dev/null; docker compose up -d backend
  ```
- Check IPS mode: `docker exec suricata iptables -L OUTPUT -n` should show NFQUEUE.
- Focused logs: `docker logs <service> --tail=50`.
- Redis pub/sub check: `docker exec redis redis-cli SUBSCRIBE suricata`.
- Frontend: `http://localhost:3000`.

## Runtime Notes
- `.env` variables are documented in `Docs/05-Referencia/Variables-Entorno.md`.
- Default lab mode is `SURICATA_MODE=ips`; `SURICATA_INTERFACE` matters when switching to IDS.
- Suricata image `jasonish/suricata:latest` is AlmaLinux 9-based (`dnf`/`yum`).
- `iptables-nft` provides both `iptables` and `ip6tables` commands.
- Adult HTTP seed rules must use `reject tcp ... -> ... 80` syntax, not `reject http`; avoid `nocase` on `http.host` because it is already normalized.
- GeoIP falls back to ip-api.com when no `GeoLite2-City.mmdb` exists at `/data/GeoLite2-City.mmdb`.
- Telegram notifier requires valid `BACKEND_TELEGRAM_BOT_TOKEN`; chat recipients are managed from the Suricata notifications panel.

## Documentation Editing Rules
- Keep docs task-oriented: architecture, components, operation, reference, deliverables and plans.
- If a new doc needs common commands, link to `Docs/05-Referencia/Comandos.md`.
- If a new doc needs `.env` values, link to `Docs/05-Referencia/Variables-Entorno.md`.
- If a new doc needs risks/hardening guidance, link to `Docs/05-Referencia/Seguridad.md`.
- If a new doc needs endpoint contracts, link to `Docs/02-Componentes/backend/API.md`.
- Preserve historical context in `Docs/04-Entregables/` rather than rewriting it as current state.
- Use ASCII in new documentation unless an existing document already uses Spanish accents or the content clearly requires them.

## docker compose v1 Bug
`up -d --build` can fail with `KeyError: 'ContainerConfig'` when a stale container exists. Workaround:
```bash
docker rm -f <service> && docker rm -f a123272595fe_<service> 2>/dev/null || true && docker compose up -d --build <service>
```

## Destructive Operations
- `docker compose down -v` deletes all volumes, including Elasticsearch data, Filebeat offsets, Suricata logs and PostgreSQL data.
- Do not run destructive cleanup unless explicitly requested.
