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
```

Notas:

- `SURICATA_MODE=ips` es el modo por defecto del proyecto.
- `SURICATA_INTERFACE` solo se usa en modo `ids`.
- Si cambias a `SURICATA_MODE=ids`, usa una interfaz real del host.

## 3. Levantar el stack

```bash
docker compose up -d --build
```

Servicios levantados:

- `elasticsearch`
- `kibana`
- `suricata`
- `redis`
- `logstash`
- `filebeat`

## 4. Verificar arranque

```bash
docker compose ps
curl http://localhost:9200
docker exec redis redis-cli PING
```

Kibana queda disponible en:

```text
http://localhost:5601
```

## 5. Configurar Kibana

En el primer uso:

1. Abrir `http://localhost:5601`.
2. Ir a `Stack Management` > `Data Views`.
3. Crear un Data View con patron `suricata-*`.
4. Seleccionar `@timestamp` como campo de tiempo.
5. Ir a `Discover` y elegir el Data View creado.

Si necesitas cargar assets de Filebeat:

```bash
docker compose run --rm filebeat filebeat setup -e --strict.perms=false
```

## 6. Generar trafico de prueba

```bash
ping -c 4 8.8.8.8
curl http://neverssl.com
curl http://example.com
```

Luego revisa:

```bash
curl http://localhost:9200/_cat/indices?v
```

Para validar realtime:

```bash
docker exec redis redis-cli SUBSCRIBE suricata
```

Genera trafico desde otra terminal y deberias ver eventos publicados.

## 7. Apagar

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
