# Backend Suricata - FastAPI

Backend REST + WebSocket para procesar eventos de Suricata en tiempo real y consultar histórico en Elasticsearch.

## Características

- **Conexión a Redis Pub/Sub**: Escucha eventos en vivo del canal `suricata`.
- **Filtrado dinámico**: Aplica filtros por tipo de evento, severidad, IP, palabras clave.
- **WebSocket streaming**: Retransmite eventos filtrados en tiempo real.
- **API REST**: Endpoints para consultar histórico en Elasticsearch.
- **Analytics histórico**: KPIs, tendencia temporal, rankings, bloqueos y mapa geográfico desde Elasticsearch.
- **Enriquecimiento**: DNS PTR, GeoIP y reputación IP con AbuseIPDB.
- **Notificaciones Telegram**: Alertas para bloqueos y destinos maliciosos cuando las credenciales están configuradas.
- **Configuración flexible**: Variables de entorno `.env`.

## Instalación

```bash
# Ir a la carpeta del backend
cd backend

# Crear entorno virtual (opcional pero recomendado)
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# o
venv\Scripts\activate  # Windows

# Instalar dependencias
pip install -r requirements.txt
```

## Configuración

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar .env según tu entorno
# Por defecto usa localhost:6379 para Redis y localhost:9200 para Elasticsearch
```

## Ejecución

```bash
# Opción 1: Directamente con Python
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Opción 2: Con gunicorn (producción)
gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:8000

# Opción 3: Con Docker
docker build -t suricata-backend .
docker run -p 8000:8000 --network suricata_default suricata-backend
```

## API Endpoints

### REST

- `GET /` - Info de la aplicación
- `GET /api/events/health` - Health check
- `GET /api/events/latest` - Últimos eventos (desde Elasticsearch)
- `GET /api/events/stats` - Estadísticas agregadas
- `GET /api/events/search?query=...` - Búsqueda full-text

### Analytics

- `GET /api/analytics/overview?hours=24` - KPIs históricos generales.
- `GET /api/analytics/timeline?hours=24&interval=5m` - Serie temporal de eventos.
- `GET /api/analytics/top-ips?hours=24&direction=source&size=10` - Ranking de IPs origen o destino.
- `GET /api/analytics/top-signatures?hours=24&size=10` - Firmas Suricata más frecuentes.
- `GET /api/analytics/blocked?hours=24&size=10` - Resumen de reglas de bloqueo.
- `GET /api/analytics/geo?hours=24&sample_size=200` - Agregación geográfica sobre muestra enriquecida.

Parámetros comunes:

- `hours`: rango histórico entre 1 y 168 horas.
- `size`: cantidad de resultados para rankings.
- `sample_size`: cantidad de eventos recientes a enriquecer para geografía.

### WebSocket

- `WS /ws` - Stream en tiempo real

#### Query params en WebSocket:

- `event_types`: Tipos de eventos (comma-separated: `alert,http,dns`)
- `min_severity`: Severidad mínima (1=critical, 4=low)

#### Ejemplo de conexión:

```javascript
const ws = new WebSocket(
  "ws://localhost:8000/ws?event_types=ALERT&min_severity=2"
);

ws.onmessage = (event) => {
  const suricataEvent = JSON.parse(event.data);
  console.log("Evento en tiempo real:", suricataEvent);
};

// Enviar comandos al servidor
ws.send(JSON.stringify({
  type: "filter",
  event_types: ["ALERT", "SSH"],
  min_severity: 3,
  keywords: ["ssh", "brute"]
}));
```

## Filtrado de eventos

El sistema soporta filtrado por:

- **Tipo de evento**: `alert`, `http`, `dns`, `tls`, `ssh`, `ftp`, `smtp`, `flow`, `stats`
- **Severidad**: 1=critical, 2=high, 3=medium, 4=low
- **IP origen**: Lista de IPs a filtrar
- **IP destino**: Lista de IPs a filtrar
- **Palabras clave**: Incluir/excluir eventos con ciertos términos

### Filtros predefinidos

```python
from app.filters import DefaultFilters

# Alertas de alta prioridad
DefaultFilters.high_priority_alerts()

# Sospechas de SSH
DefaultFilters.suspicious_ssh()

# Consultas DNS anómalas
DefaultFilters.suspicious_dns()

# Conexiones bloqueadas
DefaultFilters.blocked_connections()

# Sin eventos de stats
DefaultFilters.no_stats()
```

## Estructura del proyecto

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # Aplicación FastAPI principal
│   ├── config.py               # Configuración (Settings)
│   ├── filters.py              # Sistema de filtrado de eventos WebSocket
│   ├── redis_consumer.py       # Consumidor de Redis Pub/Sub
│   ├── es_client.py            # Cliente Elasticsearch async
│   ├── es_queries.py           # Consultas REST de eventos
│   ├── enricher.py             # Orquestador DNS + GeoIP + Threat Intel
│   ├── resolver.py             # DNS PTR con caché
│   ├── geoip.py                # GeoLite2 o fallback ip-api.com
│   ├── threat_intel.py         # AbuseIPDB con caché
│   ├── notifier.py             # Alertas Telegram
│   ├── analytics/              # Servicios y queries históricas
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── analytics.py        # Endpoints /api/analytics
│   │   └── events.py           # Endpoints /api/events
├── .env.example                # Variables de entorno
├── requirements.txt            # Dependencias Python
├── Dockerfile                  # Para containerizar
├── test_websocket.py           # Cliente de prueba
└── README.md                   # Este archivo
```

## Desarrollo

### Ver eventos en tiempo real

```bash
python test_websocket.py
```

### Ver documentación interactiva

Abre http://localhost:8000/docs en tu navegador (Swagger UI).

### Frontend

El dashboard se mantiene como aplicacion Next.js independiente en `../frontend` y consume la API REST/WebSocket del backend.

### Logs

El backend imprime logs detallados de:

- Conexión a Redis
- Eventos filtrados
- Conexiones WebSocket activas
- Errores y excepciones

## Enriquecimiento y notificaciones

Cada evento que llega por Redis o se lee desde Elasticsearch puede enriquecerse con:

- `_resolved`: hostname por DNS reverso para IP origen y destino.
- `_geo`: país, ciudad, coordenadas e ISP desde GeoLite2 o `ip-api.com`.
- `_threat`: reputación de la IP origen consultada en AbuseIPDB cuando `BACKEND_ABUSEIPDB_KEY` está configurada.

El módulo `notifier.py` envía mensajes Telegram si:

- La firma contiene `BLOQUEO`.
- `_threat.is_malicious` es `true`.

Variables relacionadas:

```env
BACKEND_TELEGRAM_BOT_TOKEN=
BACKEND_TELEGRAM_CHAT_ID=
BACKEND_ABUSEIPDB_KEY=
BACKEND_GEOIP_DB_PATH=/data/GeoLite2-City.mmdb
```

## Pendientes posibles

- Autenticación y autorización.
- Tests automatizados.
- Métricas y monitoring (Prometheus/Grafana).
- Hardening de Elasticsearch, Redis y API para redes no confiables.

## Troubleshooting

### No se conecta a Redis

```bash
# Verificar que Redis esté corriendo
docker compose ps

# O revisar que localhost:6379 sea accesible
redis-cli ping
```

### El WebSocket no recibe eventos

1. Verificar que el contenedor de Suricata esté generando tráfico
2. Verificar que Logstash esté publicando en Redis
3. Ejecutar `redis-cli SUBSCRIBE suricata` desde otra terminal

```bash
docker exec redis redis-cli SUBSCRIBE suricata
# En otra terminal generar tráfico
ping -c 4 8.8.8.8
```

### Error de conexión a Elasticsearch

El backend consulta Elasticsearch directamente. Si falla:

1. Verificar `http://localhost:9200/_cluster/health`
2. Confirmar que existan índices `suricata-*` con `curl http://localhost:9200/_cat/indices?v`
3. Revisar `BACKEND_ELASTICSEARCH_HOST`, `BACKEND_ELASTICSEARCH_PORT` y `BACKEND_ELASTICSEARCH_INDEX`

## Licencia

Proyecto académico - Universidad Libre
