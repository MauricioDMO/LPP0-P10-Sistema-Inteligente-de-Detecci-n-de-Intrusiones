# Inicio Y Verificacion

Checklist para confirmar que el stack funciona de extremo a extremo despues de levantar [desarrollo](Levantamiento-Desarrollo.md) o [produccion basica](Levantamiento-Produccion.md).

Comandos completos: [Comandos de referencia](../05-Referencia/Comandos.md).

## 1. Servicios Docker

```bash
docker compose ps
```

En produccion:

```bash
docker compose -f docker-compose.prod.yml ps
```

Esperado: todos los servicios principales aparecen `Up` o `running`.

## 2. Elasticsearch

```bash
curl http://localhost:9200/_cluster/health
curl http://localhost:9200/_cat/indices?v
```

Esperado: cluster `green` o `yellow`; indices `suricata-*` despues de generar trafico.

## 3. Redis

```bash
docker exec redis redis-cli PING
docker exec redis redis-cli PUBSUB NUMSUB suricata
```

Esperado: `PONG`; suscriptores cuando hay clientes conectados.

## 4. Logstash Y Filebeat

```bash
docker logs logstash | grep "Pipelines running"
docker compose logs --tail=100 filebeat
```

Esperado: pipeline activa y Filebeat publicando a Logstash sin errores persistentes.

## 5. Suricata

```bash
docker compose logs --tail=100 suricata
docker exec suricata iptables -L OUTPUT -n
```

Genera trafico con [comandos de prueba](../05-Referencia/Comandos.md#redis-realtime).

Esperado: Suricata sigue corriendo, genera `eve.json` y en IPS muestra reglas NFQUEUE.

## 6. Backend Y Auth

```bash
curl http://localhost:8000/api/events/health
curl -c cookies.txt -b cookies.txt -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
curl -b cookies.txt http://localhost:8000/api/auth/me
```

Esperado: health `ok`, login crea cookies y `/api/auth/me` devuelve usuario autenticado.

API completa: [API del backend](../02-Componentes/backend/API.md).

## 7. Frontend

Abrir `http://localhost:3000`.

Esperado:

- Redirecciona a `/login` si no hay sesion.
- Tras login, carga `/live`.
- WebSocket queda conectado.
- Al generar trafico aparecen eventos si el pipeline esta activo.
- `/historical`, `/blocked`, `/geo` y `/rankings` cargan datos si Elasticsearch tiene eventos.

## Checklist Final

- [ ] Docker muestra servicios arriba.
- [ ] Elasticsearch responde en `9200`.
- [ ] Redis responde `PONG`.
- [ ] Logstash tiene pipeline activa.
- [ ] Suricata sigue corriendo despues de generar trafico.
- [ ] Filebeat envia eventos a Logstash.
- [ ] Existen indices `suricata-*`.
- [ ] Redis publica eventos si hay suscriptor.
- [ ] Backend responde en `8000`.
- [ ] Login funciona.
- [ ] Endpoints protegidos responden con cookie de sesion.
- [ ] Frontend carga en `3000` y permite entrar a `/live`.
