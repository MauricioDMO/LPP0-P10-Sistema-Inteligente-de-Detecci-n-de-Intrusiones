# Contrato de analytics historico

El backend expone endpoints historicos bajo `/api/analytics`. El frontend separa dos fuentes de datos:

- `WS /ws`: eventos en vivo, tabla live, ultimos eventos y actividad inmediata.
- `GET /api/analytics/*`: resumen historico desde Elasticsearch para KPIs, tendencias, top N y mapa historico.

## Configuracion base implementada

La URL REST y la URL WebSocket estan definidas en `frontend/lib/config.ts`:

```ts
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws";
```

El cliente REST de analytics esta en `frontend/lib/analytics-api.ts`:

```ts
import { API_URL } from "@/lib/config";

export async function fetchAnalytics<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Analytics request failed: ${response.status}`);
  return response.json() as Promise<T>;
}
```

## Endpoints disponibles

### `GET /api/analytics/overview?hours=24`

Uso: cards historicos principales.

Respuesta esperada:

```json
{
  "hours": 24,
  "total_events": 1234,
  "alerts": 80,
  "blocked": 12,
  "unique_source_ips": 42,
  "unique_destination_ips": 60,
  "by_type": [{ "type": "alert", "count": 80 }],
  "by_severity": { "critical": 2, "high": 8, "medium": 30, "low": 40 }
}
```

Uso en frontend:

- Vista `/historical` mediante `HistoricalOverviewSection`.
- Selector de rango: `1h`, `6h`, `24h`, `7d`.

### `GET /api/analytics/timeline?hours=24&interval=5m`

Uso: grafico historico de eventos por tiempo.

Respuesta esperada:

```json
{
  "hours": 24,
  "interval": "5m",
  "points": [
    {
      "timestamp": "2026-05-19T10:00:00.000Z",
      "total": 50,
      "alerts": 4,
      "blocked": 1,
      "critical": 2
    }
  ]
}
```

Uso en frontend:

- Vista `/historical` mediante `HistoricalTimeline`.
- Series: `total`, `alerts`, `blocked`, `critical`.
- Complementa los graficos live de `/live`; no los reemplaza.

### `GET /api/analytics/top-ips?hours=24&direction=source&size=10`

Uso: tabla de IPs origen o destino mas activas.

Parametros:

- `direction=source`: IPs origen.
- `direction=destination`: IPs destino.
- `size`: cantidad de resultados.

Respuesta esperada:

```json
{
  "hours": 24,
  "direction": "source",
  "ips": [
    {
      "ip": "192.168.1.10",
      "count": 120,
      "max_severity": 1,
      "last_seen": "2026-05-19T10:12:00.000Z",
      "event_types": [{ "type": "alert", "count": 10 }],
      "top_signatures": [{ "signature": "[BLOQUEO] ...", "count": 4 }]
    }
  ]
}
```

Uso en frontend:

- Vista `/rankings` mediante `TopIpsPanel`.
- Incluye toggle `Origen / Destino`.
- Muestra IP, conteo, severidad maxima, ultimo visto y firmas principales.

### `GET /api/analytics/top-signatures?hours=24&size=10`

Uso: ranking de firmas Suricata.

Respuesta esperada:

```json
{
  "hours": 24,
  "signatures": [
    {
      "signature": "[BLOQUEO] Adult Site TLS SNI",
      "count": 20,
      "severity": { "high": 20 },
      "categories": [{ "category": "Policy", "count": 20 }],
      "last_seen": "2026-05-19T10:12:00.000Z"
    }
  ]
}
```

Uso en frontend:

- Vista `/rankings` mediante `TopSignatures`.
- Resalta firmas que contienen `BLOQUEO`.

### `GET /api/analytics/blocked?hours=24&size=10`

Uso: analisis especifico de bloqueos.

Respuesta esperada:

```json
{
  "hours": 24,
  "total_blocked": 12,
  "top_signatures": [{ "signature": "[BLOQUEO] ...", "count": 6 }],
  "top_source_ips": [{ "ip": "192.168.1.10", "count": 6 }],
  "top_destination_ips": [{ "ip": "1.2.3.4", "count": 6 }],
  "by_type": [{ "type": "alert", "count": 12 }]
}
```

Uso en frontend:

- Vista `/blocked` mediante `BlockedPanel`.
- Muestra total, reglas mas bloqueadas e IPs involucradas.
- Sirve como evidencia directa de funcionamiento IPS.

### `GET /api/analytics/geo?hours=24&sample_size=200`

Uso: mapa historico y rankings geograficos.

Importante: este endpoint toma una muestra de eventos recientes y los enriquece en el backend, porque `_geo` se calcula al leer y puede no estar persistido en Elasticsearch.

Respuesta esperada:

```json
{
  "hours": 24,
  "sample_size": 200,
  "countries": [{ "country": "United States", "count": 30 }],
  "cities": [{ "city": "Lima", "count": 10 }],
  "isps": [{ "isp": "Example ISP", "count": 8 }],
  "points": [
    {
      "lat": -12.04,
      "lon": -77.03,
      "country": "Peru",
      "city": "Lima",
      "isp": "Example ISP",
      "count": 4
    }
  ]
}
```

Uso en frontend:

- Vista `/geo` mediante `HistoricalGeoPanel`.
- Usa puntos historicos agregados y rankings de paises, ciudades e ISPs.

## Patron de consumo

Los componentes historicos consumen `fetchAnalytics` desde efectos de React y manejan estado de carga/error con `AnalyticsState`.

Ejemplo simplificado:

```ts
import { useEffect, useState } from "react";
import { fetchAnalytics } from "@/lib/analytics-api";

export function useAnalytics<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAnalytics<T>(path)
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error cargando analytics");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return { data, loading, error };
}
```

## Vistas implementadas

- `/live`: WebSocket y actividad inmediata.
- `/historical`: overview y timeline.
- `/blocked`: bloqueos IPS.
- `/geo`: mapa historico y rankings geograficos.
- `/rankings`: IPs y firmas principales.

## Consideracion de UX

Evitar mezclar sin etiqueta los datos live con los historicos. Usar titulos claros:

- `Actividad en vivo`: basado en WebSocket.
- `Historico Elasticsearch`: basado en `/api/analytics`.
