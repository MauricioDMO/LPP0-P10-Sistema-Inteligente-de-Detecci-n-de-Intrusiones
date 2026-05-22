# Levantamiento en Produccion Basica

Guia para levantar el stack con `docker-compose.prod.yml`. Esta configuracion reduce exposicion de puertos, pero no reemplaza un hardening completo.

## 1. Alcance

Produccion basica significa:

- Elasticsearch, Redis, Backend y Frontend publicados solo en `127.0.0.1`.
- Politicas de reinicio `always`.
- Misma arquitectura funcional que desarrollo.
- Seguridad de Elastic y Redis aun deshabilitada.

No incluye TLS, usuarios, secretos, alta disponibilidad ni backups automatizados.

## 2. Prerequisitos

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

## 3. Preparar variables

Desde la raiz del proyecto:

```bash
cp .env.example .env
```

Revisar `.env`:

```env
STACK_VERSION=8.19.14
SURICATA_MODE=ips
SURICATA_INTERFACE=wlp0s20f3
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

Notas:

- `SURICATA_MODE=ips` es el modo principal documentado.
- Si usas `SURICATA_MODE=ids`, configura `SURICATA_INTERFACE` con una interfaz real del host.
- Puedes usar varias interfaces en IDS separadas por coma.

## 4. Validar compose

```bash
docker compose -f docker-compose.prod.yml config
```

## 5. Levantar

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## 6. Verificar arranque

```bash
docker compose -f docker-compose.prod.yml ps
curl http://127.0.0.1:9200
curl http://127.0.0.1:8000/api/events/health
curl http://127.0.0.1:3000
docker exec redis redis-cli PING
```

## 7. Apagar

```bash
docker compose -f docker-compose.prod.yml down
```

Limpieza destructiva de volumenes:

```bash
docker compose -f docker-compose.prod.yml down -v
```

## 8. Hardening minimo recomendado

- Mantener `9200`, `8000`, `3000` y `6379` restringidos a localhost o red administrativa.
- Usar firewall del host.
- Habilitar seguridad de Elastic antes de exponer datos reales.
- Agregar autenticacion a Redis si queda accesible fuera del host.
- Definir backups para `esdata`.
- Monitorear uso de CPU, RAM, disco y crecimiento de indices.
