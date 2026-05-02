# Troubleshooting

Guia corta para diagnosticar fallas comunes del stack. Revisa el flujo en orden: Docker, Suricata, Filebeat, Logstash, Elasticsearch, Redis y Kibana.

## Diagnostico rapido

```bash
docker compose ps
docker compose logs --tail=100 suricata
docker compose logs --tail=100 filebeat
docker compose logs --tail=100 logstash
docker compose logs --tail=100 elasticsearch
docker compose logs --tail=100 kibana
docker exec redis redis-cli PING
curl http://localhost:9200/_cluster/health
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
- Kibana no abre.

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
docker compose run --rm filebeat filebeat setup -e --strict.perms=false
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

## 7. No aparecen eventos en Kibana

Validaciones:

```bash
curl http://localhost:9200/_cat/indices?v
docker compose logs --tail=100 suricata
docker compose logs --tail=100 filebeat
docker compose logs --tail=100 logstash
```

En Kibana:

- Verifica que exista Data View `suricata-*`.
- Amplia la ventana temporal.
- Prueba filtros como `event.module: suricata`.

Causas comunes:

- No se ha generado trafico reciente.
- No existen indices `suricata-*`.
- Data View mal creado.
- Logstash no esta publicando a Elasticsearch.

## 8. Puertos expuestos sin autenticacion

Riesgo:

- Elasticsearch, Kibana y Redis no tienen autenticacion en la configuracion actual.

Mitigacion minima:

- En desarrollo, no exponer el host a redes no confiables.
- En produccion basica, usar `docker-compose.prod.yml`.
- Restringir con firewall.
- Usar reverse proxy autenticado para Kibana.
- Habilitar seguridad de Elastic antes de manejar datos reales.
- Agregar autenticacion a Redis si queda accesible fuera del host.

## 9. Limpieza completa

Si necesitas reiniciar desde cero y perder datos locales:

```bash
docker compose down -v
docker compose up -d --build
```

Esto elimina indices, offsets de Filebeat y logs almacenados en volumenes Docker.
