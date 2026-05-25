# Troubleshooting

Guia corta para diagnosticar fallas comunes. Primero ejecuta el diagnostico rapido y luego revisa el componente afectado.

Comandos reutilizables: [Comandos](../05-Referencia/Comandos.md).

## Diagnostico Rapido

```bash
docker compose ps
docker compose logs --tail=100 suricata
docker compose logs --tail=100 filebeat
docker compose logs --tail=100 logstash
docker compose logs --tail=100 elasticsearch
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
docker exec redis redis-cli PING
curl http://localhost:9200/_cluster/health
curl http://localhost:8000/api/events/health
curl http://localhost:3000
curl http://localhost:9200/_cat/indices?v
```

En produccion basica agrega `-f docker-compose.prod.yml` a `docker compose` y usa `127.0.0.1`.

## Docker No Responde

Sintoma: `failed to connect to the docker API`.

Causas probables:

- Docker Engine no esta iniciado.
- El usuario no tiene permisos para usar Docker.

Validar:

```bash
docker info
```

## Suricata No Arranca

Sintomas: contenedor reiniciando, sin eventos, errores de interfaz o NFQUEUE.

Validar:

```bash
docker compose logs --tail=100 suricata
```

Si usas IDS, confirma `SURICATA_INTERFACE` en [Variables de entorno](../05-Referencia/Variables-Entorno.md). Si usas IPS, confirma permisos para `iptables`/`ip6tables`.

Recrear:

```bash
docker compose up -d --force-recreate suricata
```

## Elasticsearch No Inicia

Causa comun: `vm.max_map_count` bajo.

```bash
sudo sysctl -w vm.max_map_count=262144
docker compose restart elasticsearch
curl http://localhost:9200/_cluster/health
```

## No Hay Eventos En Elasticsearch

Validar:

```bash
curl http://localhost:9200/_cat/indices?v
docker compose logs --tail=100 suricata
docker compose logs --tail=100 filebeat
docker compose logs --tail=100 logstash
```

Causas comunes:

- No se genero trafico reciente.
- Suricata no escribe `eve.json`.
- Filebeat no logra publicar a Logstash.
- Logstash no logra publicar a Elasticsearch.

## Logstash No Procesa

Validar:

```bash
docker logs logstash | grep "Pipelines running"
docker logs logstash | grep -i "error\|exception"
curl http://localhost:9200/_cluster/health
docker exec redis redis-cli PING
```

Si persiste, revisar `logstash/logstash.conf`.

## Filebeat No Envia

Validar:

```bash
docker compose logs --tail=100 filebeat
docker logs filebeat | grep -i logstash
```

Causas comunes:

- `eve.json` no existe o no crece.
- Logstash no esta corriendo.
- El volumen `suricata-logs` no esta disponible.

## No Llegan Eventos A Redis

Validar:

```bash
docker exec redis redis-cli PING
docker exec redis redis-cli PUBSUB NUMSUB suricata
docker logs logstash | grep -i redis
```

Pub/Sub solo entrega mensajes a suscriptores activos. Para prueba manual, ver [Redis realtime](../05-Referencia/Comandos.md#redis-realtime).

## Login O Endpoints Protegidos Fallan

Sintomas: `401`, redireccion a `/login`, login no acepta credenciales esperadas.

Validar con [Auth por consola](../05-Referencia/Comandos.md#auth-por-consola).

Causas comunes:

- El admin inicial solo se crea si no hay usuarios en PostgreSQL.
- Cambiar `BACKEND_INITIAL_ADMIN_PASSWORD` despues del primer arranque no modifica usuarios existentes.
- La sesion fue revocada por logout, cambio de password o desactivacion.
- Falta `X-CSRF-Token` en mutaciones.
- Demasiados intentos fallidos activaron temporalmente `429`.

## Frontend No Carga O No Recibe Eventos

Validar:

```bash
docker compose logs --tail=100 frontend
curl http://localhost:3000
curl http://localhost:8000/api/events/health
```

Causas comunes:

- `frontend` no esta levantado.
- `NEXT_PUBLIC_API_URL` o `NEXT_PUBLIC_WS_URL` apuntan mal.
- Backend no disponible en `8000`.
- No hay sesion valida.
- `BACKEND_CORS_ALLOWED_ORIGINS` no permite el origen del navegador.

## Puertos Expuestos Sin Autenticacion

Riesgos y mitigacion estan centralizados en [Seguridad](../05-Referencia/Seguridad.md).

## Limpieza Completa

Destructivo:

```bash
docker compose down -v
docker compose up -d --build
```

Esto elimina indices, offsets de Filebeat y logs almacenados en volumenes Docker.
