# Troubleshooting

## 1) Docker daemon apagado

### Sintoma

Errores como:

```text
failed to connect to the docker API ... docker.sock ... no such file or directory
```

### Causa

Docker no esta iniciado o el socket configurado no existe.

### Solucion

1. Iniciar Docker Desktop o Docker Engine.
2. Verificar con:

```bash
docker info
```

## 2) Suricata no arranca por interfaz invalida

### Sintoma

Suricata falla al iniciar o no captura trafico.

### Causa

`SURICATA_INTERFACE` no coincide con interfaces reales del host, o el formato de lista por comas es invalido.

### Solucion

1. Listar interfaces:

```bash
ip -o link show | awk -F': ' '{print $2}'
```

2. Ajustar `.env` con una o varias interfaces validas (separadas por coma):

```env
SURICATA_INTERFACE=wlp0s20f3
# o
SURICATA_INTERFACE=wlp0s20f3,zttqhrw6r3
```

En este host, las interfaces disponibles son `wlp0s20f3`, `zttqhrw6r3`, `zttqh2xyhk` y `virbr0`, asi que `eth0` no debe usarse salvo que exista en otro equipo.

3. Evitar comas extra al inicio/final y nombres inexistentes.
4. Reiniciar stack:

```bash
docker compose up -d --force-recreate suricata
```

## 3) Elasticsearch falla por parametros del kernel

### Sintoma

Elasticsearch no sube o se reinicia constantemente.

### Causa

`vm.max_map_count` bajo en Linux.

### Solucion

```bash
sudo sysctl -w vm.max_map_count=262144
```

Para persistir, agregar en `/etc/sysctl.conf` y aplicar `sudo sysctl -p`.

## 4) Logstash no inicia o pipeline no está activa

### Sintoma

Logstash se reinicia continuamente o no acepta eventos de Filebeat.

### Causa

- Elasticsearch no está sano cuando Logstash intenta conectar.
- Configuración de `logstash.conf` inválida.
- Puerto 5044 ya está en uso.

### Verificaciones

```bash
docker logs logstash
docker compose ps
```

Buscar en logs:

```bash
docker logs logstash | grep -i "error\|exception"
```

Verificar pipeline:

```bash
docker logs logstash | grep "Pipelines running"
```

Debería mostrar: `{:count=>2, :running_pipelines=>[:".monitoring-logstash", :main], :non_running_pipelines=>[]}`

### Solucion

1. Verificar que Elasticsearch está sano:

```bash
curl http://localhost:9200/_cluster/health
```

Debe responder `"status":"green"` o al menos `"status":"yellow"`.

2. Reiniciar Logstash:

```bash
docker compose restart logstash
```

3. Si persiste, revisar `/home/mauriciodmo/core/university/7-ciclo/IMPLEMENTACION-DE-LENGUAJES-DE-PROGRAMACION-PARA-NEGOCIOS/proyecto-suricata/logstash/logstash.conf` para sintaxis válida.

## 5) No llegan eventos a Redis

### Sintoma

Redis está corriendo, pero no aparecen eventos en el canal `suricata`.

### Causa

- Logstash no está publicando a Redis.
- No hay suscriptores, pero los eventos se pierden (característica de Pub/Sub).
- Redis está caído o no es accesible.

### Verificaciones

```bash
docker exec redis redis-cli PING
```

Debe responder `PONG`.

```bash
docker exec redis redis-cli PUBSUB CHANNELS
```

Debe mostrar si hay canales activos.

```bash
docker exec redis redis-cli PUBSUB NUMSUB suricata
```

Muestra número de suscriptores en el canal `suricata`.

Suscribirse para probar:

```bash
docker exec redis redis-cli SUBSCRIBE suricata
```

Luego generar tráfico (en otra terminal):

```bash
ping -c 4 8.8.8.8
```

Debería ver eventos JSON en la terminal del SUBSCRIBE.

### Solucion

1. Verificar que Logstash tiene el output Redis configurado:

```bash
docker logs logstash | grep -i redis
```

2. Verificar conectividad Redis-Logstash:

```bash
docker exec logstash curl -s localhost:9600 | grep redis
```

3. Si no hay eventos, revisar logs de Logstash:

```bash
docker logs logstash | tail -50
```

## 6) No aparecen eventos en Kibana

### Posibles causas

- Suricata no genera `eve.json`.
- Filebeat no puede leer el archivo.
- Filebeat setup no ejecutado.
- Logstash no está forwarding a Elasticsearch.
- No hubo trafico durante la ventana de tiempo seleccionada.

### Verificaciones

```bash
docker compose logs -f suricata
docker compose logs -f filebeat
docker compose logs -f logstash
curl http://localhost:9200/_cat/indices?v
```

Buscar índices `suricata-*`:

```bash
curl http://localhost:9200/_cat/indices?v | grep suricata
```

En Kibana, ampliar ventana temporal y filtrar por `event.module: suricata`.

### Solucion

1. Verificar que trafico se está generando:

```bash
ping -c 4 8.8.8.8
curl http://neverssl.com
```

2. Ejecutar setup de Filebeat:

```bash
docker compose run --rm filebeat filebeat setup -e --strict.perms=false
```

3. Revisar el flujo:

```
Suricata (genera eve.json) → Filebeat (lee) → Logstash (procesador) → Elasticsearch (índices)
```

4. Si Logstash falla, Elasticsearch no recibe nada. Verificar logs de Logstash primero.

## 7) Error de permisos en captura o logs

### Causa

Restricciones del host (AppArmor/SELinux/politicas locales) o cambios de permisos de volumen.

### Solucion

- Confirmar que Suricata corre con privilegios definidos en compose.
- Revisar auditorias del sistema si hay bloqueo por politicas.
- Verificar que `suricata-logs` esté montado en ambos servicios (Suricata y Filebeat).

## 8) Puertos 9200/5601 expuestos sin seguridad

### Riesgo

Acceso no autenticado a datos y UI.

### Mitigacion minima

- Restringir por firewall.
- Evitar exposicion publica.
- En produccion, activar autenticacion/TLS de Elastic.
- Redis: no exponer puerto 6379 públicamente (mismo en .prod.yml, solo localhost).

## 9) Comandos de diagnostico rapido

```bash
docker compose ps
docker compose logs --tail=100 suricata
docker compose logs --tail=100 filebeat
docker compose logs --tail=100 logstash
docker compose logs --tail=100 elasticsearch
docker compose logs --tail=100 kibana
docker exec redis redis-cli PING
curl -s http://localhost:9200 | cat
```

## 10) Cuando escalar a hardening

Si el entorno deja de ser solo laboratorio, priorizar:

1. Seguridad de Elastic habilitada.
2. Autenticacion en Redis (requirepass).
3. Segmentacion de red y control de acceso.
4. Politicas de backup de volumenes.
5. Monitoreo de recursos y alertas de salud.
6. Enriquecimiento en Logstash (GeoIP, conversión de campos).
