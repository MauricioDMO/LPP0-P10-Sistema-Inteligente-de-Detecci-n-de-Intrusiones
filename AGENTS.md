# AGENTS.md

## Scope
- Root project is a Docker Compose lab stack: Suricata (IPS) -> Filebeat -> Logstash -> Elasticsearch + Redis Pub/Sub + FastAPI Backend.
- Frontend with Chart.js, Leaflet maps, threat badges, and CSV export.
- `test/` is a separate Bun TypeScript helper that subscribes to Redis; follow `test/CLAUDE.md` there and use Bun commands, not npm/node.

## Architecture
```
Suricata (IPS) -> NFQUEUE -> iptables OUTPUT
  -> eve.json -> Filebeat -> Logstash:5044 -> Elasticsearch:9200
                                            -> Redis Pub/Sub (suricata)
                                               -> Backend (FastAPI)
                                                  -> enricher (DNS + GeoIP + Threat Intel)
                                                  -> notifier (Telegram)
                                                  -> WebSocket -> Frontend (Chart.js + Leaflet)
```

## Key Files
| File | Purpose |
|---|---|
| `suricata/Dockerfile` | Adds `iptables-nft` for IPS NFQUEUE |
| `suricata/entrypoint.sh` | IPS: iptables NFQUEUE; IDS: -i interface |
| `backend/app/db/seed/suricata.py` | Seeds default sources, base profile, YouTube/adult custom rules |
| `backend/app/geoip.py` | GeoLite2 or ip-api.com fallback, 1h cache |
| `backend/app/threat_intel.py` | AbuseIPDB check, 24h cache |
| `backend/app/enricher.py` | Orchestrates resolver + geoip + threat_intel |
| `backend/app/notifier.py` | Telegram alerts for adult blocks & malicious IPs |
| `frontend/` | Next.js live dashboard with charts, map, threat badges |

## Key Modifications
- **Kibana excluded** from both compose files.
- **Suricata** now in **IPS mode** (`SURICATA_MODE=ips`), iptables NFQUEUE intercepts all host OUTPUT traffic.
- **Default local rules** are seeded into PostgreSQL and managed from the UI as custom rules: YouTube + adult-site TLS/HTTP/DNS rules.
- **Backend enrichment pipeline** adds 3 fields to every event:
  - `_resolved.source_hostname` / `.dest_hostname` (DNS PTR, 1h cache)
  - `_geo.source` / `.destination` (country, city, lat, lon, ISP; GeoLite2 or ip-api.com)
  - `_threat.is_malicious` / `.confidence` / `.total_reports` (AbuseIPDB, 24h cache)
- **Telegram notifier** sends alerts when `[BLOQUEO]` rules trigger or `_threat.is_malicious == true`.

## Backend Endpoints
| Endpoint | Description |
|---|---|
| `GET /api/events/health` | Health check |
| `GET /api/events/latest` | Recent events (`event_type`, `severity` filters) |
| `GET /api/events/stats` | Aggregations by type, severity, top IPs |
| `GET /api/events/search` | Full-text search on `event.original` |
| `WS /ws` | Real-time streaming from Redis |
| `GET /` | API root with status info |

## Commands
- Full stack: `sg docker -c "docker-compose up -d --build"`.
- Single service rebuild (bypass v1 bug):
  ```
  sg docker -c "docker rm -f <service> || true && docker-compose up -d --build <service>"
  ```
  For backend after stale container error:
  ```
  sg docker -c "docker rm -f a123272595fe_backend 2>/dev/null; docker-compose up -d backend"
  ```
- Check IPS mode: `sg docker -c "docker exec suricata iptables -L OUTPUT -n"` (should show NFQUEUE).
- Reload Suricata rules: `sg docker -c "docker kill -s USR2 suricata"`.
- Focused logs: `sg docker -c "docker logs <service> --tail=50"`.
- Backend tests:
  ```bash
  curl http://localhost:8000/api/events/health
  curl -c cookies.txt -b cookies.txt -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}'
  curl -b cookies.txt http://localhost:8000/api/events/latest?limit=3
  curl -b cookies.txt http://localhost:8000/api/events/stats?hours=24
  curl -b cookies.txt "http://localhost:8000/api/events/search?query=BLOQUEO"
  ```
- Redis pub/sub check: `sg docker -c "docker exec redis redis-cli SUBSCRIBE suricata"`.
- Frontend: `http://localhost:3000`.

## Runtime Notes
- `.env` must have `SURICATA_MODE=ips` and `SURICATA_INTERFACE=enp0s3`.
- Suricata image `jasonish/suricata:latest` is AlmaLinux 9-based (dnf/yum).
- `iptables-nft` provides both `iptables` and `ip6tables` commands.
- Adult HTTP seed rules must use `reject tcp ... -> ... 80` syntax (not `reject http`), without `nocase` on `http.host` (already normalized).
- GeoIP fallback to ip-api.com when no `GeoLite2-City.mmdb` at `/data/GeoLite2-City.mmdb`.
- Telegram notifier requires valid `BACKEND_TELEGRAM_BOT_TOKEN`; chat recipients are managed from the Suricata notifications panel.
- Use `sg docker -c "..."` instead of bare `docker` when the user is not in the `docker` group.

## docker-compose v1 Bug
`up -d --build` fails with `KeyError: 'ContainerConfig'` when a stale container exists. Workaround:
```
sg docker -c "docker rm -f <service> && docker rm -f a123272595fe_<service> 2>/dev/null || true && docker-compose up -d --build <service>"
```

## Env Vars for Backend
Set in `docker-compose.yml` and `docker-compose.prod.yml` under `backend.environment`:
- `BACKEND_TELEGRAM_BOT_TOKEN` — Telegram bot token
- `BACKEND_ABUSEIPDB_KEY` — AbuseIPDB API key
- `BACKEND_GEOIP_DB_PATH` — Path to GeoLite2-City.mmdb (default `/data/GeoLite2-City.mmdb`)

## Destructive Operations
- `sg docker -c "docker-compose down -v"` deletes all volumes (ES data, Filebeat offsets, Suricata logs).
