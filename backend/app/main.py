"""Aplicación FastAPI principal del backend Suricata."""

import asyncio
import json
import logging
from uuid import UUID
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import Set

from .config import settings
from .redis_consumer import RedisEventConsumer
from .filters import EventFilter, DefaultFilters, EventType
from .enricher import enrich_event
from .enriched_writer import ensure_enriched_template, persist_enriched_event
from . import notifier
from .db import AsyncSessionLocal
from .db.seed import bootstrap_suricata_management
from .routes import analytics, auth, events, lists, suricata
from .security import decode_access_token
from .services.auth_service import bootstrap_auth
from .services.auth_service import get_user_by_id
from .suricata_apply_events import register_apply_websocket, unregister_apply_websocket

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


def websocket_origin_allowed(websocket: WebSocket) -> bool:
    origin = websocket.headers.get("origin")
    if not origin:
        return False
    return origin in settings.cors_origins


async def authenticate_websocket(websocket: WebSocket) -> bool:
    """Valida la cookie de sesion antes de aceptar el WebSocket."""
    if not websocket_origin_allowed(websocket):
        await websocket.close(code=1008)
        return False

    session_token = websocket.cookies.get(settings.session_cookie_name)
    if not session_token:
        await websocket.close(code=1008)
        return False

    try:
        payload = decode_access_token(session_token)
        user_id = UUID(str(payload.get("sub")))
        token_version = int(payload.get("token_version"))
    except (TypeError, ValueError):
        await websocket.close(code=1008)
        return False

    async with AsyncSessionLocal() as session:
        user = await get_user_by_id(session, user_id)
        if user is None or not user.is_active:
            await websocket.close(code=1008)
            return False

        if user.token_version != token_version:
            await websocket.close(code=1008)
            return False

        user_roles = {role.name for role in user.roles}
        if not user_roles.intersection({"admin", "analyst", "viewer"}):
            await websocket.close(code=1008)
            return False

    return True


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
    asyncio.create_task(persist_enriched_event(event))
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


async def initialize_auth_data() -> None:
    """Crea roles base y usuario admin inicial si la DB ya fue migrada."""
    async with AsyncSessionLocal() as session:
        await bootstrap_auth(session)
        await bootstrap_suricata_management(session)


def warn_insecure_defaults() -> None:
    if settings.jwt_secret == "change-me":
        logger.warning("BACKEND_JWT_SECRET usa el valor por defecto; cambialo fuera de laboratorio")
    if settings.initial_admin_password == "admin123":
        logger.warning("BACKEND_INITIAL_ADMIN_PASSWORD usa el valor por defecto; cambialo antes del primer arranque real")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestiona el ciclo de vida de la aplicación."""
    # Startup
    logger.info(f"🚀 Iniciando {settings.api_title} v{settings.api_version}")
    warn_insecure_defaults()
    await initialize_auth_data()
    await ensure_enriched_template()
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

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir routers
app.include_router(analytics.router)
app.include_router(auth.router)
app.include_router(events.router)
app.include_router(lists.router)
app.include_router(suricata.router)


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
    if not await authenticate_websocket(websocket):
        return

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


@app.websocket("/ws/suricata/apply")
async def suricata_apply_websocket(websocket: WebSocket):
    """WebSocket para progreso de jobs de apply Suricata."""
    if not await authenticate_websocket(websocket):
        return

    await register_apply_websocket(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        unregister_apply_websocket(websocket)
        logger.info("Cliente de progreso Suricata desconectado")
    except Exception as exc:
        logger.error("Error en WebSocket de progreso Suricata: %s", exc)
        unregister_apply_websocket(websocket)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=settings.api_host,
        port=settings.api_port,
        log_level="info",
    )
