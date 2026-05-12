# AGENTS.md

## Scope
- Root project is a Docker Compose lab stack: Suricata -> Filebeat -> Logstash -> Elasticsearch/Kibana plus Redis Pub/Sub.
- `test/` is a separate Bun TypeScript helper that subscribes to Redis; follow `test/CLAUDE.md` there and use Bun commands, not npm/node.

## Commands
- Development stack: `cp .env.example .env`, review `.env`, then `docker compose up -d --build`.
- Validate development compose before starting: `docker compose config`.
- Production-like stack: run `sudo sysctl -w vm.max_map_count=262144`, then `docker compose -f docker-compose.prod.yml config` and `docker compose -f docker-compose.prod.yml up -d --build`.
- Optional Filebeat assets setup: `docker compose run --rm filebeat filebeat setup -e --strict.perms=false` or add `-f docker-compose.prod.yml` for prod.
- Focused health checks: `docker compose ps`, `curl http://localhost:9200/_cluster/health`, `curl http://localhost:9200/_cat/indices?v`, `docker exec redis redis-cli PING`.
- Focused logs: `docker compose logs --tail=100 suricata`, `filebeat`, `logstash`, `elasticsearch`, or `kibana`.
- Redis realtime check: `docker exec redis redis-cli SUBSCRIBE suricata`; Pub/Sub drops messages when no subscriber is connected.
- Bun helper: from `test/`, run `bun install` and `bun run index.ts`; it connects to `redis://localhost:6379` and listens on channel `suricata`.

## Runtime Notes
- `.env.example` defines `STACK_VERSION=8.19.14`, `SURICATA_MODE=ips`, and `SURICATA_INTERFACE=wlp0s20f3`; `.env` is ignored and may contain local interface choices.
- In `ips` mode, `suricata/entrypoint.sh` uses NFQUEUE and inserts host `iptables`/`ip6tables` OUTPUT rules while the privileged host-network container runs.
- In `ids` mode, `SURICATA_INTERFACE` is required and may be comma-separated; list host interfaces with `ip -o link show | awk -F': ' '{print $2}'`.
- Filebeat reads `/var/log/suricata/eve.json` from the shared `suricata-logs` volume and sends only to Logstash at `logstash:5044`.
- Logstash fans out to Elasticsearch index `suricata-%{+YYYY.MM.dd}` and Redis channel `suricata`; do not point Filebeat directly at Elasticsearch unless replacing that fanout.
- Create the Kibana Data View manually as `suricata-*` with `@timestamp` after first start.
- `docker-compose.yml` publishes Elasticsearch/Kibana/Redis on host ports; `docker-compose.prod.yml` binds them to `127.0.0.1` but still has Elastic and Redis auth disabled.

## Destructive Operations
- `docker compose down -v` deletes Elasticsearch data, Filebeat offsets, and Suricata logs stored in Docker volumes; do not use it for routine restarts.
