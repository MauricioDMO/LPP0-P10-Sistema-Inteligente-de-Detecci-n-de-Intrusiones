"""Cliente de prueba para conectarse al WebSocket del backend."""

import asyncio
import json
import websockets
from datetime import datetime


async def test_websocket():
    """Conecta al WebSocket y recibe eventos en tiempo real."""

    # Conectarse con filtro para alertas de alta prioridad
    uri = "ws://localhost:8000/ws?event_types=ALERT&min_severity=2"

    try:
        async with websockets.connect(uri) as websocket:
            print(f"✓ Conectado a {uri}")
            print("Escuchando eventos en tiempo real...\n")

            # Enviar un ping inicial
            await websocket.send(json.dumps({"type": "ping"}))

            # Recibir eventos
            while True:
                try:
                    message = await asyncio.wait_for(websocket.recv(), timeout=30.0)
                    event = json.loads(message)

                    # Imprimir evento
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Evento recibido:")
                    print(json.dumps(event, indent=2))
                    print("-" * 60 + "\n")

                except asyncio.TimeoutError:
                    print("⏱️  Esperando eventos...")
                    await websocket.send(json.dumps({"type": "ping"}))

    except KeyboardInterrupt:
        print("\n✓ Desconectado por el usuario")
    except Exception as e:
        print(f"✗ Error: {e}")


if __name__ == "__main__":
    asyncio.run(test_websocket())
