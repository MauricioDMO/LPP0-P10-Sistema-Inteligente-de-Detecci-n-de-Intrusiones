# Inicio y Verificacion del Proyecto

Este documento explica como iniciar el stack y que puedes ir a revisar cuando todo este levantado.

## Ruta rapida segun entorno

- Desarrollo: revisa [Levantamiento-Desarrollo.md](Levantamiento-Desarrollo.md).
- Produccion: revisa [Levantamiento-Produccion.md](Levantamiento-Produccion.md).

Este documento se mantiene como guia general de validacion end-to-end.

## 1) Prerequisitos

- Docker Engine y Docker Compose instalados.
- Daemon de Docker activo.
- Permisos para ejecutar Docker.
- Interfaz de red valida en `.env` para Suricata.

Comando para listar interfaces:

```bash
ip -o link show | awk -F': ' '{print $2}'
```

## 2) Revisar variables de entorno

Archivo: `.env`

Valores esperados:

```env
STACK_VERSION=8.19.14
SURICATA_INTERFACE=wlp0s20f3
```

Tambien puedes usar multiples interfaces separadas por coma:

```env
SURICATA_INTERFACE=wlp0s20f3,zttqhrw6r3
```

Si ves `eth0` en ejemplos anteriores, no lo tomes como valor por defecto para este host: aqui las interfaces detectadas son `wlp0s20f3`, `zttqhrw6r3`, `zttqh2xyhk` y `virbr0`.

Si tu interfaz cambia, ajusta `SURICATA_INTERFACE` con una o varias interfaces validas del host.

## 3) Levantar el stack

Desde la raiz del proyecto:

```bash
docker compose config
docker compose build
docker compose up -d
```

Ejecutar setup inicial de Filebeat (una vez):

```bash
docker compose run --rm filebeat filebeat setup -e --strict.perms=false
```

Nota: si Kibana todavia esta iniciando, espera a que `api/status` responda `available` y vuelve a ejecutar setup.

## 4) Verificar estado de servicios

```bash
docker compose ps
docker compose logs -f elasticsearch
docker compose logs -f kibana
docker compose logs -f suricata
docker compose logs -f filebeat
```

Validacion rapida de Elasticsearch:

```bash
curl http://localhost:9200
curl http://localhost:9200/_cat/indices?v
```

## 5) Generar trafico de prueba

En el host:

```bash
curl http://neverssl.com
ping -c 4 8.8.8.8
```

Opcional (si tienes `dig`):

```bash
dig google.com
```

## 6) Que ver una vez levantado todo

### En Suricata

- Debe existir actividad en `eve.json` dentro de `/var/log/suricata` (volumen compartido).
- La regla ICMP local debe generar alertas ante `ping`.

### En Filebeat

- Logs sin errores de lectura/parsing.
- Eventos enviados hacia Elasticsearch.

### En Elasticsearch

- Indices/data streams de Filebeat visibles en `_cat/indices`.
- Conteo de documentos incrementando con trafico nuevo.

### En Kibana

- UI accesible en `http://localhost:5601`.
- En Discover, eventos con `event.module: suricata`.
- Visualizacion de tipos de evento (dns, http, tls, alert, flow, etc.).

## 7) Apagado limpio

```bash
docker compose down
```

Si necesitas limpiar volumenes (perderas datos):

```bash
docker compose down -v
```

## 8) Checklist de exito

- [ ] Servicios arriba (`docker compose ps`).
- [ ] Elasticsearch responde HTTP 200.
- [ ] Kibana abre en navegador.
- [ ] Suricata genera eventos en `eve.json`.
- [ ] Filebeat envia eventos sin errores.
- [ ] Se observan documentos de Suricata en Kibana.
