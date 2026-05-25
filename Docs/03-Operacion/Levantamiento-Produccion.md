# Levantamiento En Produccion Basica

Guia para levantar el stack con `docker-compose.prod.yml`. Esta configuracion reduce exposicion de puertos, pero no reemplaza un hardening completo.

## Alcance

Produccion basica significa:

- Elasticsearch, Redis, Backend, Frontend y PostgreSQL publicados solo en `127.0.0.1`.
- Politicas de reinicio `always`.
- Misma arquitectura funcional que desarrollo.
- Seguridad propia de Elastic y Redis aun deshabilitada.

No incluye TLS, alta disponibilidad ni backups automatizados. Revisa [Seguridad](../05-Referencia/Seguridad.md) antes de usar datos reales.

## Prerequisitos

- Host Linux actualizado.
- Docker Engine activo.
- Docker Compose disponible.
- Firewall configurado.
- Acceso administrativo al host.

Ajuste requerido por Elasticsearch:

```bash
sudo sysctl -w vm.max_map_count=262144
```

Para hacerlo persistente:

```bash
echo 'vm.max_map_count=262144' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## Preparar `.env`

```bash
cp .env.example .env
```

Cambia antes del primer arranque:

- `POSTGRES_PASSWORD`
- `BACKEND_DATABASE_URL`
- `BACKEND_JWT_SECRET`
- `BACKEND_INITIAL_ADMIN_PASSWORD`

Detalle completo: [Variables de entorno](../05-Referencia/Variables-Entorno.md).

## Levantar

```bash
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml up -d --build
```

## Verificar

```bash
docker compose -f docker-compose.prod.yml ps
curl http://127.0.0.1:8000/api/events/health
curl http://127.0.0.1:3000
docker exec redis redis-cli PING
```

Checklist completo: [Inicio y verificacion](Inicio-y-Verificacion.md).

## Apagar

```bash
docker compose -f docker-compose.prod.yml down
```

Limpieza destructiva:

```bash
docker compose -f docker-compose.prod.yml down -v
```

## Hardening

El hardening minimo esta centralizado en [Seguridad](../05-Referencia/Seguridad.md).
