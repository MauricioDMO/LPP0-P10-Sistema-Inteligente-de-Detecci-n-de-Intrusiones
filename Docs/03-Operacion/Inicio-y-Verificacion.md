# Inicio y Verificacion

Checklist para confirmar que el stack funciona de extremo a extremo. Usa esta guia despues de levantar desarrollo o produccion.

## Rutas de arranque

- Desarrollo: [Levantamiento-Desarrollo.md](Levantamiento-Desarrollo.md)
- Produccion basica: [Levantamiento-Produccion.md](Levantamiento-Produccion.md)

## 1. Servicios Docker

Desarrollo:

```bash
docker compose ps
```

Produccion:

```bash
docker compose -f docker-compose.prod.yml ps
```

Todos los servicios deben estar en estado `Up` o `running`.

## 2. Elasticsearch

```bash
curl http://localhost:9200
curl http://localhost:9200/_cluster/health
curl http://localhost:9200/_cat/indices?v
```

En produccion basica usa `http://127.0.0.1:9200`.

Resultado esperado:

- Elasticsearch responde HTTP.
- El cluster esta `green` o `yellow`.
- Aparecen indices `suricata-*` despues de generar trafico.

## 3. Redis

```bash
docker exec redis redis-cli PING
docker exec redis redis-cli PUBSUB NUMSUB suricata
```

Resultado esperado:

- `PING` responde `PONG`.
- `NUMSUB` muestra suscriptores cuando hay clientes conectados.

Prueba realtime:

```bash
docker exec redis redis-cli SUBSCRIBE suricata
```

Deja ese comando abierto y genera trafico desde otra terminal.

## 4. Logstash

```bash
docker logs logstash | grep "Pipelines running"
docker logs logstash | grep -i "error\|exception"
```

Resultado esperado:

- La pipeline `main` aparece corriendo.
- No hay errores persistentes de conexion a Elasticsearch o Redis.

## 5. Suricata

```bash
docker compose logs --tail=100 suricata
```

Generar trafico:

```bash
ping -c 4 8.8.8.8
curl http://neverssl.com
curl http://example.com
```

Resultado esperado:

- Suricata se mantiene corriendo.
- Se generan eventos en `eve.json`.
- En modo IPS, reglas `reject` pueden bloquear trafico segun `suricata.rules`.

## 6. Filebeat

```bash
docker compose logs --tail=100 filebeat
docker logs filebeat | grep -i logstash
```

Resultado esperado:

- Filebeat lee `/var/log/suricata/eve.json`.
- Filebeat logra publicar eventos en Logstash.

## 7. Kibana

Abrir:

```text
http://localhost:5601
```

En produccion basica:

```text
http://127.0.0.1:5601
```

Validar:

- Existe Data View `suricata-*`.
- `Discover` muestra eventos recientes.
- La ventana temporal incluye el momento de las pruebas.

Filtros utiles:

```text
event.module: suricata
suricata.eve.event_type: alert
```

## Checklist final

- [ ] Docker muestra servicios arriba.
- [ ] Elasticsearch responde en `9200`.
- [ ] Redis responde `PONG`.
- [ ] Logstash tiene pipeline activa.
- [ ] Suricata sigue corriendo despues de generar trafico.
- [ ] Filebeat envia eventos a Logstash.
- [ ] Existen indices `suricata-*`.
- [ ] Kibana muestra eventos en Discover.
- [ ] Redis publica eventos en el canal `suricata` si hay suscriptor.
