# Frontend Next.js

Dashboard en tiempo real para el proyecto Suricata. Consume el backend FastAPI mediante WebSocket y muestra eventos, graficas, mapa, filtros, tabla y exportacion CSV.

## Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

## Desarrollo local

```bash
pnpm install
pnpm dev
```

Abrir `http://localhost:3000`.

## Produccion con Docker Compose

Desde la raiz del proyecto:

```bash
docker compose up -d --build frontend
```

El servicio queda publicado en `http://localhost:3000`.
