# Levantamiento en Produccion

Este documento describe como levantar el stack en un entorno de produccion basico usando un override dedicado.

## Importante

El repositorio esta orientado a laboratorio y tiene `xpack.security` deshabilitado. La estrategia aqui es minimizar exposicion de puertos usando `docker-compose.prod.yml` y dejar controles de red estrictos en el host.

Si necesitas produccion empresarial (TLS, autenticacion, gestion de secretos y HA), debes planificar una fase adicional de hardening.

## 1) Prerequisitos de host

- Linux actualizado.
- Docker Engine y Docker Compose.
- Firewall activo.
- Ajuste de kernel para Elasticsearch:

```bash
sudo sysctl -w vm.max_map_count=262144
```

Persistencia recomendada:

```bash
echo 'vm.max_map_count=262144' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## 2) Revisar variables de entorno

Archivo `.env`:

- `STACK_VERSION` de Elastic.
- `SURICATA_INTERFACE` valida en el host de produccion (una o varias interfaces separadas por coma).

Ejemplo:

```env
SURICATA_INTERFACE=ens33,virbr0
```

## 3) Arranque con compose de produccion

El archivo `docker-compose.prod.yml` es una definicion completa para produccion basica y publica Elasticsearch/Kibana solo en localhost del servidor (`127.0.0.1`).

Validar compose de produccion:

```bash
docker compose -f docker-compose.prod.yml config
```

Construir y levantar:

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Setup inicial de Filebeat (una vez):

```bash
docker compose -f docker-compose.prod.yml run --rm filebeat filebeat setup -e --strict.perms=false
```

## 4) Verificaciones operativas

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f elasticsearch
docker compose -f docker-compose.prod.yml logs -f suricata
docker compose -f docker-compose.prod.yml logs -f filebeat
```

Health de Elasticsearch en host local:

```bash
curl http://127.0.0.1:9200
```

Kibana en host local:

- `http://127.0.0.1:5601`

## 5) Recomendaciones minimas de endurecimiento

1. No exponer 9200/5601 directamente a internet.
2. Usar firewall para permitir solo red administrativa.
3. Poner reverse proxy con autenticacion delante de Kibana.
4. Habilitar seguridad de Elastic en una fase siguiente.
5. Definir backup y retencion de volumenes (`esdata`, `suricata-logs`).

## 6) Apagado en produccion

```bash
docker compose -f docker-compose.prod.yml down
```
