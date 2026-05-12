"""Consumidor de eventos desde Redis Pub/Sub."""

import asyncio
import json
import logging
from typing import Any, Callable, Dict, Optional
from .config import settings
import redis.asyncio as redis

logger = logging.getLogger(__name__)


class RedisEventConsumer:
    """Consumidor asincrónico de eventos desde Redis Pub/Sub."""

    def __init__(
        self,
        host: str = settings.redis_host,
        port: int = settings.redis_port,
        db: int = settings.redis_db,
        channel: str = settings.redis_channel,
    ):
        """
        Inicializa el consumidor de Redis.

        Args:
            host: Host de Redis.
            port: Puerto de Redis.
            db: Base de datos de Redis.
            channel: Canal Pub/Sub a suscribirse.
        """
        self.host = host
        self.port = port
        self.db = db
        self.channel = channel
        self.redis_client: Optional[redis.Redis] = None
        self.pubsub = None
        self.is_connected = False
        self.callbacks: list[Callable] = []

    async def connect(self) -> bool:
        """
        Conecta a Redis.

        Returns:
            True si la conexión fue exitosa, False en caso contrario.
        """
        try:
            self.redis_client = await redis.from_url(
                f"redis://{self.host}:{self.port}/{self.db}",
                encoding="utf-8",
                decode_responses=True,
            )
            # Test de conexion
            await self.redis_client.ping()
            self.is_connected = True
            logger.info(
                f"✓ Conectado a Redis en {self.host}:{self.port}, canal: {self.channel}"
            )
            return True
        except Exception as e:
            logger.error(f"✗ Error conectando a Redis: {e}")
            self.is_connected = False
            return False

    async def subscribe(self) -> bool:
        """
        Se suscribe al canal Pub/Sub.

        Returns:
            True si la suscripción fue exitosa.
        """
        if not self.is_connected:
            logger.error("No conectado a Redis")
            return False

        try:
            self.pubsub = self.redis_client.pubsub()
            await self.pubsub.subscribe(self.channel)
            logger.info(f"✓ Suscrito al canal: {self.channel}")
            return True
        except Exception as e:
            logger.error(f"✗ Error suscribiendose: {e}")
            return False

    def on_event(self, callback: Callable) -> None:
        """
        Registra un callback que se ejecutará cuando llegue un evento.

        Args:
            callback: Función async que recibe el evento (Dict).
        """
        self.callbacks.append(callback)

    async def listen(self) -> None:
        """
        Escucha eventos del canal de forma continua.
        Ejecuta los callbacks registrados para cada evento.
        """
        if not self.pubsub:
            logger.error("No suscrito al canal")
            return

        logger.info("Escuchando eventos...")
        try:
            async for message in self.pubsub.listen():
                if message["type"] == "message":
                    try:
                        event = json.loads(message["data"])
                        # Ejecutar todos los callbacks registrados
                        for callback in self.callbacks:
                            await callback(event)
                    except json.JSONDecodeError:
                        logger.warning(
                            f"Evento no es JSON válido: {message['data'][:100]}"
                        )
                    except Exception as e:
                        logger.error(f"Error procesando evento: {e}")
        except asyncio.CancelledError:
            logger.info("Escucha cancelada")
        except Exception as e:
            logger.error(f"Error en listen: {e}")

    async def disconnect(self) -> None:
        """Desconecta de Redis."""
        if self.pubsub:
            await self.pubsub.unsubscribe(self.channel)
            await self.pubsub.close()
        if self.redis_client:
            await self.redis_client.close()
        self.is_connected = False
        logger.info("Desconectado de Redis")

    async def get_test_message(self) -> Optional[Dict[str, Any]]:
        """
        Obtiene un único mensaje de prueba sin escuchar continuamente.
        Útil para validar la conexión.

        Returns:
            El primer evento disponible o None si timeout.
        """
        if not await self.subscribe():
            return None

        try:
            # Esperar con timeout de 5 segundos
            message = await asyncio.wait_for(
                self.pubsub.get_message(ignore_subscribe_messages=True), timeout=5.0
            )
            if message:
                return json.loads(message["data"])
        except asyncio.TimeoutError:
            logger.warning("Timeout esperando mensaje de prueba")
        except Exception as e:
            logger.error(f"Error obteniendo mensaje de prueba: {e}")

        return None
