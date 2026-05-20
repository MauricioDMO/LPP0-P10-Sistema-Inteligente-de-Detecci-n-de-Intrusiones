# Backend Suricata - FastAPI

Backend REST + WebSocket para procesar eventos de Suricata en tiempo real y consultar histórico en Elasticsearch.

## Características

- **Conexión a Redis Pub/Sub**: Escucha eventos en vivo del canal `suricata`.
- **Filtrado dinámico**: Aplica filtros por tipo de evento, severidad, IP, palabras clave.
- **WebSocket streaming**: Retransmite eventos filtrados en tiempo real.
- **API REST**: Endpoints para consultar histórico en Elasticsearch.
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

### WebSocket

- `GET /ws` - Stream en tiempo real

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
│   ├── filters.py              # Sistema de filtrado de eventos
│   ├── redis_consumer.py       # Consumidor de Redis Pub/Sub
│   ├── routes/
│   │   ├── __init__.py
│   │   └── events.py           # Endpoints REST
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

## Próximos pasos

- [ ] Integración real con Elasticsearch para histórico
- [ ] Autenticación y autorización
- [ ] Persistencia de eventos en base de datos
- [ ] Alertas y notificaciones
- [ ] Mantener contrato API/WebSocket consumido por el frontend Next.js
- [ ] Tests automatizados
- [ ] Métricas y monitoring (Prometheus)

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

Elasticsearch es opcional por ahora; los endpoints REST retornan datos de prueba. Para integrarlo:

1. Verificar `http://localhost:9200/_cluster/health`
2. Reemplazar placeholders en `app/routes/events.py` con consultas reales

## Licencia

Proyecto académico - Universidad Libre
