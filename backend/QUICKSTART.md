# QUICKSTART - Backend Suricata

Guía rápida para levantar el backend y conectarlo con el stack Suricata + Redis + Elasticsearch.

## Prerequisitos

- Python 3.9+
- Pip
- Stack Docker de Suricata levantado: `docker compose up -d`

## Instalación rápida (desarrollo)

```bash
# 1. Ir a la carpeta del backend
cd backend

# 2. Crear entorno virtual (recomendado)
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# 3. Instalar dependencias
pip install -r requirements.txt

# 4. Copiar configuración
cp .env.example .env
# Editar .env si es necesario (cambiar host/puerto de Redis o Elasticsearch)

# 5. Ejecutar el backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

El backend estará disponible en:

- API REST: http://localhost:8000
- Documentación Swagger: http://localhost:8000/docs
- WebSocket: ws://localhost:8000/ws
- Frontend Next.js: http://localhost:3000

## Verificar que todo funciona

### 1. Health check

```bash
curl http://localhost:8000/
```

Debería retornar:

```json
{
  "name": "Suricata Backend API",
  "status": "online",
  "redis": {
    "connected": true
  }
}
```

### 2. Ver eventos en tiempo real

Opción A: Usar cliente Python de prueba:

```bash
# Desde otra terminal, en carpeta /backend
python test_websocket.py
```

Opción B: Usar el frontend Next.js independiente en `../frontend`.

### 3. Verificar que Redis está activo

```bash
# Desde la carpeta raíz del proyecto
docker exec redis redis-cli PING
# Debería retornar "PONG"

# Ver mensajes en tiempo real
docker exec redis redis-cli SUBSCRIBE suricata
```

### 4. Generar tráfico para ver eventos

```bash
# Desde una terminal (pueden ser múltiples)
ping -c 4 8.8.8.8
curl http://neverssl.com
curl http://example.com -I
```

Si todo funciona, deberías ver eventos apareciendo en:

1. Terminal de `test_websocket.py`
2. Navegador con el frontend Next.js en http://localhost:3000
3. `docker exec redis redis-cli SUBSCRIBE suricata`

## Producción con Docker

```bash
# 1. Build la imagen
docker build -t suricata-backend .

# 2. Ejecutar el contenedor en la red de Docker Compose
docker run -d \
  --name suricata-backend \
  --network suricata_default \
  -p 8000:8000 \
  -e BACKEND_REDIS_HOST=redis \
  -e BACKEND_REDIS_PORT=6379 \
  suricata-backend

# 3. Ver logs
docker logs -f suricata-backend

# 4. Acceder a la API
curl http://localhost:8000/
```

## Estructura de filtros

El backend soporta filtros por:

- **event_types**: `ALERT`, `HTTP`, `DNS`, `SSH`, `TLS`, etc.
- **min_severity**: 1 (critical) a 4 (low)
- **keywords**: Palabras clave en el evento
- **source_ips**: IPs origen a filtrar
- **dest_ips**: IPs destino a filtrar

Ejemplo con WebSocket:

```javascript
// Conectar con filtro inicial
const ws = new WebSocket(
  "ws://localhost:8000/ws?event_types=ALERT,SSH&min_severity=2"
);

// Cambiar filtro dinámicamente
ws.send(JSON.stringify({
  type: "filter",
  event_types: ["ALERT"],
  min_severity: 1,
  keywords: ["ssh", "brute", "force"]
}));
```

## Troubleshooting

### "No se conecta a Redis"

```bash
# Verificar que Redis esté en puerto 6379
docker compose ps

# Verificar conectividad
docker exec redis redis-cli ping

# Si falla, revisar .env y que BACKEND_REDIS_HOST sea correcto
```

### "No llegan eventos"

1. Verificar que Suricata esté capturando:
   ```bash
   docker compose logs suricata | grep "started"
   ```

2. Verificar que Logstash esté publicando:
   ```bash
   docker logs logstash | grep -i redis
   ```

3. Verificar que hay suscriptores conectados:
   ```bash
   docker exec redis redis-cli PUBSUB NUMSUB suricata
   ```

### Puerto 8000 ya está en uso

```bash
# Cambiar puerto en comando de ejecución
python -m uvicorn app.main:app --port 8001

# O editar .env
BACKEND_API_PORT=8001
```

## Próximos pasos

1. **Elasticsearch**: Integrar consultas históricas en los endpoints `/api/events/latest` y `/api/events/search`.
2. **Persistencia**: Guardar eventos en base de datos local.
3. **Autenticación**: Agregar JWT o API keys.
4. **Alertas**: Notificaciones por correo o Slack cuando se detectan patrones.
5. **Frontend**: Dashboard React o Vue.js conectado al WebSocket.
6. **Tests**: Pruebas unitarias con pytest.
7. **Métricas**: Prometheus + Grafana para monitoring.

## Documentación completa

Ver [README.md](README.md)
