# Levantamiento En Desarrollo

Guia para levantar el stack local/laboratorio con `docker-compose.yml`.

## Prerequisitos

- Docker Engine activo.
- Docker Compose disponible.
- Permisos para ejecutar Docker.
- Linux recomendado para captura/IPS con Suricata.

Variables completas: [Variables de entorno](../05-Referencia/Variables-Entorno.md).

## Preparar `.env`

```bash
cp .env.example .env
```

Revisa especialmente:

- `SURICATA_MODE`
- `SURICATA_INTERFACE` si usas IDS.
- `BACKEND_JWT_SECRET`
- `BACKEND_INITIAL_ADMIN_PASSWORD`
- URLs `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_WS_URL`.

Para laboratorio puedes usar credenciales por defecto. En redes compartidas, cambia secretos antes del primer arranque.

## Levantar

Opcion recomendada:

```bash
./scripts/dev-up.sh
```

El script levanta servicios, puede crear un admin nuevo, desactiva el bootstrap `admin` si corresponde, aplica el perfil activo y valida los puntos principales.

Opcion manual:

```bash
docker compose up -d --build
```

Comandos comunes: [Comandos de referencia](../05-Referencia/Comandos.md).

## Servicios

- `elasticsearch`
- `suricata`
- `redis`
- `postgres`
- `elasticsearch-setup`
- `logstash`
- `filebeat`
- `backend`
- `frontend`

## Verificar

Verificacion rapida:

```bash
docker compose ps
curl http://localhost:8000/api/events/health
curl http://localhost:3000
```

Checklist completo: [Inicio y verificacion](Inicio-y-Verificacion.md).

Frontend: `http://localhost:3000`

Credenciales bootstrap de laboratorio: `admin` / `admin123`.

## Aplicar Reglas Suricata

En un arranque limpio, aplica el perfil activo desde el panel `/suricata` o por consola usando [Aplicar perfil Suricata](../05-Referencia/Comandos.md#aplicar-perfil-suricata).

Valida IPS y reglas con [IPS y reglas](../05-Referencia/Comandos.md#ips-y-reglas).

## Generar Trafico De Prueba

Usa los comandos de [Redis realtime](../05-Referencia/Comandos.md#redis-realtime) y revisa `/live`.

Para ejecutar las verificaciones principales:

```bash
./scripts/dev-check.sh
```

## Apagar

```bash
docker compose down
```

Limpieza destructiva:

```bash
docker compose down -v
```

## Si Algo Falla

1. [Inicio y verificacion](Inicio-y-Verificacion.md)
2. [Troubleshooting](Troubleshooting.md)
