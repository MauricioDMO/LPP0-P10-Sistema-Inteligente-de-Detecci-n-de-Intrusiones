# Redis

## Qué es

Redis es un almacén de datos en memoria (in-memory data store) ultrarrápido que soporta múltiples estructuras de datos. En este proyecto, se usa específicamente el mecanismo de **Pub/Sub (Publish/Subscribe)** para distribución de eventos en tiempo real.

## Por qué se usa en este proyecto

El objetivo es habilitar un **pipeline de eventos en tiempo real** donde:

1. Logstash publica eventos de seguridad al instante en un canal Redis
2. Aplicaciones backend (ej: FastAPI) se suscriben al canal y reciben eventos <1 segundo de latencia
3. Los eventos pueden ser retransmitidos a clientes web (WebSockets, Server-Sent Events) para dashboards live

Esto complementa el pipeline histórico (Elasticsearch) proporcionando observabilidad instantánea.

## Pub/Sub vs. Otros mecanismos de Redis

Redis ofrece varias formas de comunicación:

| Mecanismo             | Uso                   | Persistencia | Latencia |
| --------------------- | --------------------- | ------------ | -------- |
| **Channel (Pub/Sub)** | Realtime, broadcast   | ❌ No         | ~1ms     |
| **List (RPUSH/LPOP)** | Queue durable         | ✅ Sí         | ~1ms     |
| **Stream**            | Eventos con historial | ✅ Sí         | ~5ms     |

En este proyecto se usa **Channel** porque necesitamos latencia mínima y no requerimos persistencia (los eventos ya se guardan en Elasticsearch).

## Cómo está configurado aquí

### Configuración en Logstash

Archivo: `logstash/logstash.conf`

```
output {
  redis {
    host => "redis"
    port => 6379
    key => "suricata"
    data_type => "channel"
  }
}
```

**Explicación:**

- `host`: Nombre del contenedor Redis en la red Docker
- `port`: Puerto estándar de Redis
- `key`: Nombre del canal donde se publican eventos
- `data_type => "channel"`: Usa Pub/Sub, no una lista

### Configuración en Docker Compose

Archivo: `docker-compose.yml` (desarrollo)

```yaml
redis:
  image: redis:7
  container_name: redis
  ports:
    - "6379:6379"
  restart: unless-stopped
```

Archivo: `docker-compose.prod.yml` (producción)

```yaml
redis:
  image: redis:7
  container_name: redis
  ports:
    - "127.0.0.1:6379:6379"
  restart: always
```

**Diferencia prod vs. dev:** En producción, Redis se expone solo a `localhost` (127.0.0.1) para no ser accesible desde fuera del host.

## Flujo de datos

```
Logstash (output redis)
    ↓
Redis Channel "suricata"
    ↓
Suscriptores:
    ├→ Backend FastAPI (consume eventos)
    ├→ WebSockets → Dashboards live
    └→ Otros servicios en tiempo real
```

## Consumo desde aplicaciones

### Con Node.js/TypeScript (redis-cli)

```typescript
import { createClient } from "redis";

const client = createClient({ url: "redis://localhost:6379" });

await client.connect();

await client.subscribe("suricata", (message) => {
  const event = JSON.parse(message);
  console.log("Evento en tiempo real:", event);
});
```

### Con Python (redis-py)

```python
import redis
import json

client = redis.Redis(host="localhost", port=6379)
pubsub = client.pubsub()

pubsub.subscribe("suricata")

for message in pubsub.listen():
    if message["type"] == "message":
        event = json.loads(message["data"])
        print("Evento en tiempo real:", event)
```

### Con FastAPI + WebSockets

```python
from fastapi import FastAPI, WebSocket
import redis.asyncio as redis
import json

app = FastAPI()

@app.websocket("/ws/suricata")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    redis_client = await redis.from_url("redis://redis:6379")
    pubsub = redis_client.pubsub()
    
    await pubsub.subscribe("suricata")
    
    async for message in pubsub.listen():
        if message["type"] == "message":
            event = json.loads(message["data"])
            await websocket.send_json(event)
```

## Validaciones útiles

### Verificar que Redis está corriendo

```bash
docker exec redis redis-cli PING
```

Debería responder: `PONG`

### Ver información del servidor

```bash
docker exec redis redis-cli INFO
```

Muestra estadísticas: conexiones, memoria, comandos, etc.

### Suscribirse al canal (test manual)

```bash
docker exec redis redis-cli SUBSCRIBE suricata
```

Se queda esperando. Cada evento de Suricata que llega a través de Logstash aparecerá aquí en tiempo real.

Para salir: `Ctrl+C`

### Verificar actividad en canal

```bash
docker exec redis redis-cli PUBSUB CHANNELS
```

Muestra todos los canales con suscriptores activos.

```bash
docker exec redis redis-cli PUBSUB NUMSUB suricata
```

Muestra cuántos suscriptores hay en el canal "suricata".

### Monitorar comandos en tiempo real

```bash
docker exec redis redis-cli MONITOR
```

Muestra cada comando que se ejecuta en Redis (verboso, útil para debugging).

## Buenas prácticas

1. **Nombrado claro de canales**: Se usa `suricata` como nombre. Si hay otros tipos de eventos, usar nombres como `suricata:alerts`, `suricata:http`, etc.

2. **Manejo de desconexiones**: Aplicaciones cliente deben implementar reconexión automática a Redis si se cae.

3. **Rate limiting**: Si el cliente no puede procesar eventos tan rápido como llegan, implementar buffer local o decoupling con workers.

4. **Logging de eventos críticos**: No todos los eventos necesitan ir a tiempo real. Considerar filtrar solo alertas y anomalías a Redis.

5. **No depender 100% de Redis**: Redis es en memoria. Para garantía de entrega, siempre revisar Elasticsearch como fuente de verdad.

## Riesgos y limitaciones

1. **Sin persistencia**: Si el proceso que se suscribe se desconecta, pierde eventos pendientes. Redis no guarda histórico de Pub/Sub.

2. **Pérdida en reconexión**: Si Redis se reinicia, todos los suscriptores pierden conexión y eventos en tránsito desaparecen.

3. **Límite de memoria**: Redis corre en memoria. Si la instancia se queda sin RAM, puede fallar. Monitorear con `redis-cli INFO memory`.

4. **Sin autenticación por defecto**: La configuración actual no requiere contraseña. En producción abierta, agregar `requirepass` en redis.conf.

5. **Escalabilidad**: Un solo Redis puede llegar a límites con millones de eventos/segundo. Para scale, considerar Redis Cluster o mensajería dedicada (Kafka, RabbitMQ).

## Próximas mejoras

- Agregar persistencia con Redis List como backup de eventos críticos
- Implementar autenticación con contraseña
- Monitoreo de métricas de Redis (throughput, memory usage, connections)
- Retencion de eventos en Redis con `EXPIRE` para período configurable
- Particionamiento de canales por tipo de evento (alertas, DNS, HTTP, etc)
