# Levantamiento en Desarrollo

Este documento es la ruta corta para levantar el proyecto en entorno de desarrollo/laboratorio.

## 1) Prerequisitos

- Docker Engine y Docker Compose instalados.
- Daemon de Docker activo.
- Interfaz de red valida para Suricata en `.env`.

Ver interfaces disponibles:

```bash
ip -o link show | awk -F': ' '{print $2}'
```

## 2) Variables de entorno

Revisar `.env`:

```env
STACK_VERSION=8.19.14
SURICATA_INTERFACE=wlp0s20f3
```

Tambien se soportan multiples interfaces separadas por coma:

```env
SURICATA_INTERFACE=wlp0s20f3
```

En este entorno ya migrado a Docker Engine nativo, Suricata puede ver interfaces reales del host. Sin embargo, durante validacion AF_PACKET reporto error de fanout en `zttqhrw6r3` y `virbr0`, por lo que la interfaz recomendada y estable es `wlp0s20f3`.

Si la interfaz cambia en tu equipo, ajusta `SURICATA_INTERFACE` con una o varias interfaces validas.

## 3) Arranque paso a paso

Desde la raiz del proyecto:

```bash
docker compose config
docker compose build
docker compose up -d
```

Inicializar assets de Filebeat/Kibana una sola vez:

```bash
docker compose run --rm filebeat filebeat setup -e --strict.perms=false
```

Si Kibana acaba de iniciar, espera a que su estado sea `available` y luego ejecuta el setup:

```bash
curl -s http://localhost:5601/api/status
```

## 4) Verificacion rapida

```bash
docker compose ps
docker compose logs -f suricata
docker compose logs -f filebeat
curl http://localhost:9200/_cat/indices?v
```

Kibana:

- Abrir `http://localhost:5601`.
- Ir a Discover.
- Filtrar por `event.module: suricata`.

## 5) Prueba funcional minima

Generar trafico:

```bash
curl http://neverssl.com
ping -c 4 8.8.8.8
```

Validar que aparecen nuevos eventos en Kibana.

## 6) Parar entorno de desarrollo

```bash
docker compose down
```

Limpiar volumenes (destructivo):

```bash
docker compose down -v
```
