# Comandos De Referencia

Comandos comunes para levantar, verificar y operar el stack. Las guias de operacion enlazan aqui para evitar duplicar bloques largos.

## Desarrollo

```bash
./scripts/dev-up.sh
```

Opcion manual:

```bash
docker compose up -d --build
```

Ver estado:

```bash
docker compose ps
```

Apagar sin borrar datos:

```bash
docker compose down
```

Apagar borrando volumenes, destructivo:

```bash
docker compose down -v
```

## Produccion Basica

```bash
sudo sysctl -w vm.max_map_count=262144
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

Apagar:

```bash
docker compose -f docker-compose.prod.yml down
```

## Salud Del Stack

```bash
curl http://localhost:9200/_cluster/health
curl http://localhost:8000/api/events/health
curl http://localhost:3000
docker exec redis redis-cli PING
```

Indices Elasticsearch:

```bash
curl http://localhost:9200/_cat/indices?v
```

## Logs

```bash
docker compose logs --tail=100 suricata
docker compose logs --tail=100 filebeat
docker compose logs --tail=100 logstash
docker compose logs --tail=100 elasticsearch
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
```

## Auth Por Consola

```bash
curl -c cookies.txt -b cookies.txt -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
curl -b cookies.txt http://localhost:8000/api/auth/me
```

Extraer CSRF para mutaciones:

```bash
CSRF=$(awk '/suricata_csrf/ {print $7}' cookies.txt)
```

## Eventos Y Analytics

```bash
curl -b cookies.txt http://localhost:8000/api/events/latest?limit=3
curl -b cookies.txt http://localhost:8000/api/events/stats?hours=24
curl -b cookies.txt http://localhost:8000/api/analytics/overview?hours=24
curl -b cookies.txt "http://localhost:8000/api/analytics/top-ips?hours=24&direction=source&size=5"
```

## Aplicar Perfil Suricata

```bash
PROFILE_ID=$(curl -fsS -b cookies.txt http://localhost:8000/api/suricata/profiles \
  | python3 -c 'import json,sys; print(next(p["id"] for p in json.load(sys.stdin) if p.get("is_active")))')

curl -fsS -b cookies.txt -X POST http://localhost:8000/api/suricata/apply \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -d "{\"profile_id\":\"$PROFILE_ID\"}"
```

## IPS Y Reglas

```bash
docker exec suricata iptables -L OUTPUT -n
docker exec suricata ip6tables -L OUTPUT -n
docker exec suricata wc -l /var/lib/suricata/rules/suricata.rules
docker logs suricata --tail=40
```

## Redis Realtime

```bash
docker exec redis redis-cli SUBSCRIBE suricata
docker exec redis redis-cli PUBSUB NUMSUB suricata
```

Generar trafico de prueba desde otra terminal:

```bash
ping -c 4 8.8.8.8
curl http://neverssl.com
curl http://example.com
```

## Verificacion Automatizada

```bash
./scripts/dev-check.sh
```

## Docker Con `sg`

Si el usuario no pertenece al grupo `docker`, usa:

```bash
sg docker -c "docker compose ps"
sg docker -c "docker logs suricata --tail=50"
```
