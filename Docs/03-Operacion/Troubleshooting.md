# Troubleshooting

Guia corta para diagnosticar fallas comunes del stack. Revisa el flujo en orden: Docker, Suricata, Filebeat, Logstash, Elasticsearch, Redis, Backend y Frontend.

## Diagnostico rapido

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

Para produccion basica, agrega `-f docker-compose.prod.yml` a los comandos `docker compose` y usa `http://127.0.0.1:9200`.

## 1. Docker no responde

Sintoma:

```text
failed to connect to the docker API
```

Causa probable:

- Docker Engine no esta iniciado.
- El usuario no tiene permisos para usar Docker.

Solucion:

```bash
docker info
```

Si falla, inicia Docker o revisa permisos del usuario.

## 2. Suricata no arranca

Sintomas:

- El contenedor se reinicia.
- No se generan eventos.
- Logs mencionan interfaz invalida o error de `NFQUEUE`.

Validaciones:

```bash
docker compose logs --tail=100 suricata
```

Si usas modo IDS, confirma interfaces reales:

```bash
ip -o link show | awk -F': ' '{print $2}'
```

Revisa `.env`:

```env
SURICATA_MODE=ids
SURICATA_INTERFACE=wlp0s20f3
```

Si usas modo IPS, confirma que el host permite modificar `iptables` y `ip6tables` desde el contenedor privilegiado.

Recrear Suricata:

```bash
docker compose up -d --force-recreate suricata
```

## 3. Elasticsearch no inicia

Sintomas:

- Elasticsearch se reinicia.
- Logstash no logra conectar.
- Backend no responde.

Causa comun en Linux:

- `vm.max_map_count` bajo.

Solucion:

```bash
sudo sysctl -w vm.max_map_count=262144
docker compose restart elasticsearch
```

Validar salud:

```bash
curl http://localhost:9200/_cluster/health
```

## 4. Logstash no procesa eventos

Sintomas:

- No aparecen indices `suricata-*`.
- Redis no recibe eventos.
- Filebeat muestra errores de conexion.

Validaciones:

```bash
docker logs logstash | grep "Pipelines running"
docker logs logstash | grep -i "error\|exception"
```

Revisar dependencias:

```bash
curl http://localhost:9200/_cluster/health
docker exec redis redis-cli PING
```

Reiniciar:

```bash
docker compose restart logstash
```

Si persiste, revisar `logstash/logstash.conf`.

## 5. Filebeat no envia eventos

Sintomas:

- Suricata corre, pero no hay datos en Elasticsearch.
- Logstash no recibe eventos.

Validaciones:

```bash
docker compose logs --tail=100 filebeat
docker logs filebeat | grep -i logstash
```

Causas comunes:

- `eve.json` no existe o no crece.
- Logstash no esta corriendo.
- El volumen `suricata-logs` no esta disponible.

Acciones:

```bash
docker compose restart filebeat
```

## 6. No llegan eventos a Redis

Sintomas:

- `redis-cli PING` responde, pero `SUBSCRIBE suricata` no muestra mensajes.

Validaciones:

```bash
docker exec redis redis-cli PING
docker exec redis redis-cli PUBSUB NUMSUB suricata
docker logs logstash | grep -i redis
```

Prueba manual:

```bash
docker exec redis redis-cli SUBSCRIBE suricata
```

En otra terminal:

```bash
ping -c 4 8.8.8.8
curl http://neverssl.com
```

Notas:

- Pub/Sub solo entrega mensajes a suscriptores activos.
- Si no hay suscriptor al momento de publicar, Redis no guarda el evento.

## 7. No aparecen eventos en Elasticsearch

Validaciones:

```bash
curl http://localhost:9200/_cat/indices?v
docker compose logs --tail=100 suricata
docker compose logs --tail=100 filebeat
docker compose logs --tail=100 logstash
```

Causas comunes:

- No se ha generado trafico reciente.
- No existen indices `suricata-*`.
- Logstash no esta publicando a Elasticsearch.

## 8. Login o endpoints protegidos fallan

Sintomas:

- `/api/events/latest` devuelve `401`.
- El frontend redirige a `/login`.
- Login no acepta `admin/admin123`.

Validaciones:

```bash
docker compose logs --tail=100 backend
curl http://localhost:8000/api/events/health
curl -c cookies.txt -b cookies.txt -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
curl -b cookies.txt http://localhost:8000/api/auth/me
```

Causas comunes:

- El admin inicial solo se crea si no hay usuarios en PostgreSQL.
- Cambiaste `BACKEND_INITIAL_ADMIN_PASSWORD` despues del primer arranque; no modifica usuarios existentes.
- La sesion fue revocada por logout, cambio de password o desactivacion.
- Para mutaciones falta el header `X-CSRF-Token`.
- Demasiados intentos fallidos de login activaron temporalmente el limite `429`.

Para probar una mutacion con CSRF:

```bash
CSRF=$(awk '/suricata_csrf/ {print $7}' cookies.txt)
curl -b cookies.txt -X POST http://localhost:8000/api/auth/logout \
  -H "X-CSRF-Token: $CSRF"
```

## 9. Puertos expuestos sin autenticacion

Riesgo:

- Elasticsearch y Redis no tienen autenticacion en la configuracion actual.
- Backend y Frontend tienen login, pero deben usar secretos fuertes.

Mitigacion minima:

- En desarrollo, no exponer el host a redes no confiables.
- En produccion basica, usar `docker-compose.prod.yml`.
- Restringir con firewall.
- Habilitar seguridad de Elastic antes de manejar datos reales.
- Agregar autenticacion a Redis si queda accesible fuera del host.

## 10. Frontend no carga o no recibe eventos

Sintomas:

- `http://localhost:3000` no abre.
- El dashboard abre, pero queda desconectado.
- No aparecen eventos aunque Redis y backend reciben datos.

Validaciones:

```bash
docker compose logs --tail=100 frontend
curl http://localhost:3000
curl http://localhost:8000/api/events/health
```

Causas comunes:

- El servicio `frontend` no esta levantado.
- `NEXT_PUBLIC_API_URL` o `NEXT_PUBLIC_WS_URL` apuntan a una URL incorrecta.
- El backend no esta disponible en `8000`.
- No hay sesion valida; entra por `/login`.
- El origen del navegador no esta incluido en `BACKEND_CORS_ALLOWED_ORIGINS`; el WebSocket se cierra por politica `1008`.
- El navegador no puede abrir el WebSocket configurado.

Acciones:

```bash
docker compose up -d --build frontend
docker compose restart frontend
```

## 11. Limpieza completa

Si necesitas reiniciar desde cero y perder datos locales:

```bash
docker compose down -v
docker compose up -d --build
```

Esto elimina indices, offsets de Filebeat y logs almacenados en volumenes Docker.
