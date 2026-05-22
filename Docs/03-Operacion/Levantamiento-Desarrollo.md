# Levantamiento en Desarrollo

Guia para levantar el stack en entorno local o laboratorio usando `docker-compose.yml`.

## 1. Prerequisitos

- Docker Engine activo.
- Docker Compose disponible.
- Permisos para ejecutar Docker.
- Linux recomendado para captura/IPS con Suricata.

Ver interfaces disponibles, util si usaras modo IDS:

```bash
ip -o link show | awk -F': ' '{print $2}'
```

## 2. Preparar variables

Desde la raiz del proyecto:

```bash
cp .env.example .env
```

Revisar `.env`:

```env
STACK_VERSION=8.19.14
SURICATA_MODE=ips
SURICATA_INTERFACE=wlp0s20f3
BACKEND_JWT_SECRET=change-me
BACKEND_INITIAL_ADMIN_USERNAME=admin
BACKEND_INITIAL_ADMIN_PASSWORD=admin123
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

Notas:

- `SURICATA_MODE=ips` es el modo por defecto del proyecto.
- `SURICATA_INTERFACE` solo se usa en modo `ids`.
- Si cambias a `SURICATA_MODE=ids`, usa una interfaz real del host.
- Para laboratorio puedes usar las credenciales por defecto; para cualquier red compartida cambia `BACKEND_JWT_SECRET` y `BACKEND_INITIAL_ADMIN_PASSWORD` antes del primer arranque.

## 3. Levantar el stack

```bash
docker compose up -d --build
```

Servicios levantados:

- `elasticsearch`
- `suricata`
- `redis`
- `postgres`
- `elasticsearch-setup`
- `logstash`
- `filebeat`
- `backend`
- `frontend`

## 4. Verificar arranque

```bash
docker compose ps
curl http://localhost:9200
curl http://localhost:8000/api/events/health
docker exec redis redis-cli PING
```

Frontend disponible en:

```text
http://localhost:3000
```

Credenciales iniciales de laboratorio:

```text
usuario: admin
password: admin123
```

Tambien puedes validar auth por consola:

```bash
curl -c cookies.txt -b cookies.txt -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
curl -b cookies.txt http://localhost:8000/api/auth/me
```

## 5. Generar trafico de prueba

```bash
ping -c 4 8.8.8.8
curl http://neverssl.com
curl http://example.com
```

Luego revisa:

```bash
curl http://localhost:9200/_cat/indices?v
curl -b cookies.txt http://localhost:8000/api/events/latest?limit=3
```

Para validar realtime:

```bash
docker exec redis redis-cli SUBSCRIBE suricata
```

Genera trafico desde otra terminal y deberias ver eventos publicados.

El dashboard Next.js tambien debe actualizarse en `http://localhost:3000` si el backend esta conectado por WebSocket.

## 6. Apagar

Apagado normal:

```bash
docker compose down
```

Apagado con limpieza de volumenes, destructivo:

```bash
docker compose down -v
```

## Siguiente paso

Si algo no aparece, usa [Inicio y Verificacion](Inicio-y-Verificacion.md) y luego [Troubleshooting](Troubleshooting.md).
