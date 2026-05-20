# Frontend Next.js

Dashboard SOC para el proyecto Suricata. Consume el backend FastAPI por WebSocket para actividad en vivo y por REST para analytics historico desde Elasticsearch.

## Vistas

- `/live`: actividad en vivo por WebSocket, graficas, mapa, filtros, tabla y exportacion CSV.
- `/historical`: KPIs y tendencia historica desde `/api/analytics/overview` y `/api/analytics/timeline`.
- `/blocked`: resumen de bloqueos IPS desde `/api/analytics/blocked`.
- `/geo`: mapa y rankings geograficos desde `/api/analytics/geo`.
- `/rankings`: top IPs y firmas desde `/api/analytics/top-ips` y `/api/analytics/top-signatures`.

La ruta `/` redirige a `/live`.

## Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

`NEXT_PUBLIC_API_URL` se usa para llamadas REST y `NEXT_PUBLIC_WS_URL` para streaming realtime.

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
