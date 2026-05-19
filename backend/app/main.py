"""Aplicación FastAPI principal del backend Suricata."""

import asyncio
import json
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import Set

from .config import settings
from .redis_consumer import RedisEventConsumer
from .filters import EventFilter, DefaultFilters, EventType
from .enricher import enrich_event
from . import notifier
from .routes import events

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Estado global
redis_consumer: RedisEventConsumer = None
listen_task: asyncio.Task = None
active_websockets: Set[WebSocket] = set()
current_filter: EventFilter = DefaultFilters.no_stats()


async def broadcast_event(event: dict) -> None:
    """Retransmite un evento a todos los WebSockets conectados."""
    for ws in active_websockets.copy():
        try:
            await ws.send_json(event)
        except Exception as e:
            logger.warning(f"Error enviando a WebSocket: {e}")
            active_websockets.discard(ws)


async def event_callback(event: dict) -> None:
    """Callback que se ejecuta cuando llega un evento de Redis."""
    event = await enrich_event(event)
    await notifier.process_event(event)
    if current_filter.matches(event):
        await broadcast_event(event)


async def start_consumer():
    """Inicia el consumidor de Redis en background."""
    global redis_consumer, listen_task

    redis_consumer = RedisEventConsumer(
        host=settings.redis_host,
        port=settings.redis_port,
        db=settings.redis_db,
        channel=settings.redis_channel,
    )

    if await redis_consumer.connect():
        if await redis_consumer.subscribe():
            redis_consumer.on_event(event_callback)
            listen_task = asyncio.create_task(redis_consumer.listen())
            logger.info("✓ Consumidor de Redis iniciado")
        else:
            logger.error("✗ No se pudo suscribir al canal")
    else:
        logger.error("✗ No se pudo conectar a Redis")


async def stop_consumer():
    """Detiene el consumidor de Redis."""
    global redis_consumer, listen_task

    if listen_task:
        listen_task.cancel()
        try:
            await listen_task
        except asyncio.CancelledError:
            pass

    if redis_consumer:
        await redis_consumer.disconnect()
        logger.info("✓ Consumidor de Redis detenido")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestiona el ciclo de vida de la aplicación."""
    # Startup
    logger.info(f"🚀 Iniciando {settings.api_title} v{settings.api_version}")
    await start_consumer()
    yield
    # Shutdown
    logger.info("🛑 Deteniendo aplicación")
    await stop_consumer()


# Crear aplicación FastAPI
app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    lifespan=lifespan,
)

# Montar archivos estáticos para servir el frontend desde el mismo host/puerto
static_dir = Path(__file__).resolve().parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.get("/frontend")
async def frontend_index():
    """Sirve la página de frontend corregida desde el propio backend."""
    f = static_dir / "frontend_realtime_fix.html"
    if f.exists():
        return FileResponse(str(f))
    return {"error": "frontend not found"}

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir routers
app.include_router(events.router)


@app.get("/")
async def root():
    """Endpoint raíz con información de la API."""
    return {
        "name": settings.api_title,
        "version": settings.api_version,
        "status": "online",
        "redis": {
            "host": settings.redis_host,
            "port": settings.redis_port,
            "channel": settings.redis_channel,
            "connected": redis_consumer.is_connected if redis_consumer else False,
        },
        "websocket": "/ws",
        "api_docs": "/docs",
    }


@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    event_types: str = Query(None),
    min_severity: int = Query(None),
):
    """
    WebSocket para streaming en tiempo real de eventos.

    Query params:
        - event_types: Tipos de eventos separados por coma (alert,http,dns)
        - min_severity: Severidad mínima (1=critical, 4=low)

    Flujo:
        1. Cliente se conecta al WebSocket
        2. Backend filtra eventos según parámetros
        3. Cada evento que pase el filtro se envía al cliente
        4. Cliente recibe eventos en tiempo real
    """
    await websocket.accept()
    active_websockets.add(websocket)

    # Parsear y aplicar filtro según query params
    event_type_list = None
    if event_types:
        try:
            event_type_list = [
                EventType[et.strip().upper()] for et in event_types.split(",")
            ]
        except KeyError as e:
            await websocket.send_json({"error": f"Tipo de evento inválido: {e}"})

    # Actualizar filtro global con estos parámetros
    global current_filter
    current_filter = EventFilter(
        event_types=event_type_list,
        min_severity=min_severity,
    )

    try:
        # Mantener la conexión abierta
        while True:
            # Esperar mensajes del cliente (heartbeat, comandos, etc.)
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            elif message.get("type") == "filter":
                # Cliente puede enviar nuevas reglas de filtro
                current_filter = EventFilter(
                    event_types=message.get("event_types"),
                    min_severity=message.get("min_severity"),
                    keywords=message.get("keywords"),
                )
                await websocket.send_json({"status": "filter_updated"})

    except WebSocketDisconnect:
        active_websockets.discard(websocket)
        logger.info(f"Cliente desconectado. Conexiones activas: {len(active_websockets)}")
    except Exception as e:
        logger.error(f"Error en WebSocket: {e}")
        active_websockets.discard(websocket)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=settings.api_host,
        port=settings.api_port,
        log_level="info",
    )
