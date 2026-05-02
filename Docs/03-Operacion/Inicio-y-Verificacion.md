# Inicio y Verificacion del Proyecto

Este documento explica como iniciar el stack y que puedes ir a revisar cuando todo este levantado.

## Ruta rapida segun entorno

- Desarrollo: revisa [Levantamiento-Desarrollo.md](Levantamiento-Desarrollo.md).
- Produccion: revisa [Levantamiento-Produccion.md](Levantamiento-Produccion.md).
- Gateway: revisa [Levantamiento-Gateway.md](Levantamiento-Gateway.md).

Este documento se mantiene como guia general de validacion end-to-end.

## 1) Prerequisitos

- Docker Engine y Docker Compose instalados.
- Daemon de Docker activo.
- Permisos para ejecutar Docker.
- Interfaz de red valida en `.env` para Suricata.

Comando para listar interfaces:

```bash
ip -o link show | awk -F': ' '{print $2}'
```

## 2) Revisar variables de entorno

Archivo: `.env`

Valores esperados:

```env
STACK_VERSION=8.19.14
SURICATA_MODE=local-ips
SURICATA_NFQUEUE_NUM=0
SURICATA_INTERFACE=wlp0s20f3
```

Tambien puedes usar multiples interfaces separadas por coma:

```env
SURICATA_INTERFACE=wlp0s20f3,zttqhrw6r3
```

Si ves `eth0` en ejemplos anteriores, no lo tomes como valor por defecto para este host: aqui las interfaces detectadas son `wlp0s20f3`, `zttqhrw6r3`, `zttqh2xyhk` y `virbr0`.

Si tu interfaz cambia, ajusta `SURICATA_INTERFACE` con una o varias interfaces validas del host.

Para gateway no uses este flujo general. Usa `scripts/gateway/start-gateway.sh`, que aplica NAT/DHCP/NFQUEUE y levanta `docker-compose.gateway.yml`.

## 3) Levantar el stack

Desde la raiz del proyecto:

```bash
docker compose config
docker compose build
docker compose up -d
```

Ejecutar setup inicial de Filebeat (una vez):

```bash
docker compose run --rm filebeat filebeat setup -e --strict.perms=false
```

Nota: si Kibana todavia esta iniciando, espera a que `api/status` responda `available` y vuelve a ejecutar setup.

## 4) Verificar estado de servicios

```bash
docker compose ps
docker compose logs -f elasticsearch
docker compose logs -f logstash
docker compose logs -f kibana
docker compose logs -f suricata
docker compose logs -f filebeat
```

Validacion rapida de Elasticsearch:

```bash
curl http://localhost:9200
curl http://localhost:9200/_cat/indices?v
```

Validacion de Logstash (pipeline activo):

```bash
docker logs logstash | grep "Pipelines running"
```

Validacion de Redis (connectivity):

```bash
docker exec redis redis-cli PING
```

Debería responder `PONG`.

## 5) Generar trafico de prueba

En el host:

```bash
curl http://neverssl.com
ping -c 4 8.8.8.8
```

Opcional (si tienes `dig`):

```bash
dig google.com
```

## 6) Que ver una vez levantado todo

### En Suricata

- Debe existir actividad en `eve.json` dentro de `/var/log/suricata` (volumen compartido).
- La regla ICMP local debe generar alertas ante `ping`.

### En Filebeat

- Logs sin errores de lectura/parsing.
- Eventos enviados hacia Logstash.

### En Logstash

- Pipeline iniciada: `docker logs logstash | grep "Pipelines running"`
- Debe mostrar: `{:count=>2, :running_pipelines=>[:".monitoring-logstash", :main], :non_running_pipelines=>[]}`

### En Redis

- Canal con suscriptores: `docker exec redis redis-cli PUBSUB NUMSUB suricata`
- Debe responder con número >0 si hay suscriptores activos.

### En Elasticsearch

- Indices/data streams de Filebeat visibles en `_cat/indices`.
- Conteo de documentos incrementando con trafico nuevo.
- Indices named `suricata-YYYY.MM.dd`.

### En Kibana

- UI accesible en `http://localhost:5601`.
- En Discover, eventos con `event.module: suricata`.
- Visualizacion de tipos de evento (dns, http, tls, alert, flow, etc.).

## 7) Apagado limpio

```bash
docker compose down: `docker compose ps`.
- [ ] Elasticsearch responde HTTP 200: `curl localhost:9200`.
- [ ] Logstash pipeline activa: `docker logs logstash | grep "Pipelines running"`.
- [ ] Redis responde: `docker exec redis redis-cli PING` → PONG.
- [ ] Kibana abre en navegador: `http://localhost:5601`.
- [ ] Suricata genera eventos en `eve.json`.
- [ ] Filebeat envia eventos sin errores.
- [ ] Se observan documentos de Suricata en Kibana.
- [ ] (Opcional) Eventos realtime en Redis: `docker exec redis redis-cli SUBSCRIBE suricata` (esperando mensajes)
docker compose down -v
```

## 8) Checklist de exito

- [ ] Servicios arriba (`docker compose ps`).
- [ ] Elasticsearch responde HTTP 200.
- [ ] Kibana abre en navegador.
- [ ] Suricata genera eventos en `eve.json`.
- [ ] Filebeat envia eventos sin errores.
- [ ] Se observan documentos de Suricata en Kibana.
