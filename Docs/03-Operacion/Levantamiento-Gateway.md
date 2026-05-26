# Levantamiento Gateway

Este modo prepara una VM Debian como gateway L3 para que clientes conectados a un AP pasen por Suricata antes de salir a la red externa.

## Arquitectura

```text
Red externa/universidad
  -> WAN_IF VM Debian
  -> NAT + DHCP + NFQUEUE FORWARD
  -> Suricata Docker network_mode host, -q 0
  -> LAN_IF VM Debian
  -> TP-Link en Access Point mode
  -> Clientes
```

## Diferencia con el modo normal

- `docker-compose.yml`: modo normal/local. Mantiene `ips`, que pone NFQUEUE en `OUTPUT` y `FORWARD` desde el contenedor.
- `docker-compose.prod.yml`: variante basica con puertos principales ligados a `127.0.0.1`; no es gateway.
- `docker-compose.gateway.yml`: compose standalone para gateway. Suricata usa `gateway-ips` y no modifica iptables desde el contenedor.

El modo normal se sigue levantando con el `.env` del proyecto y no usa las variables de MAC del gateway. El modo gateway usa `/etc/suricata-lab/gateway.env` para separar la configuracion de red fisica/VM.

## Archivos relevantes

- `gateway/scripts/gateway.env.example`: variables de interfaces, LAN, DHCP y NFQUEUE.
- `gateway/scripts/render-config.sh`: renderiza templates con variables reales.
- `gateway/scripts/install-symlinks.sh`: instala symlinks y configs renderizadas.
- `gateway/scripts/apply-gateway.sh`: aplica IP LAN, forwarding, NAT y NFQUEUE.
- `gateway/scripts/start-gateway.sh`: instala, aplica gateway y levanta Docker Compose.
- `gateway/scripts/cleanup-gateway.sh`: limpia reglas NAT/NFQUEUE.
- `gateway/scripts/unmount.sh`: baja compose y elimina symlinks/configs renderizadas.
- `gateway/templates/dnsmasq-lab.conf.tpl`: template DHCP.
- `gateway/sysctl-suricata-gateway.conf`: sysctl persistente.
- `gateway/vm/baseDeb-preseed.cfg`: preseed Debian base para la VM gateway.
- `gateway/vm/baseDeb-usb-nic-realtek.xml`: fragmento libvirt para pasar un adaptador USB Realtek RTL8153 a la VM.
- `gateway/vm/baseDeb-usb-nic-asix.xml`: fragmento libvirt para pasar un adaptador USB ASIX AX88179 a la VM.

## Primer uso en la VM

Instalar dependencias del sistema. En Debian 12 suele existir `docker-compose-plugin`; en Debian 13/Trixie puede llamarse `docker-compose`:

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-plugin dnsmasq iptables iproute2 curl ethtool
sudo systemctl enable --now docker
```

Si `docker-compose-plugin` no existe:

```bash
sudo apt install -y git docker.io docker-compose dnsmasq iptables iproute2 curl ethtool
sudo systemctl enable --now docker
```

Instalar symlinks iniciales:

```bash
./gateway/scripts/install-symlinks.sh
```

Editar variables reales:

```bash
sudo nano /etc/suricata-lab/gateway.env
```

Valores minimos:

```env
INTERNAL_MAC="9c:69:d3:66:86:cc"
EXTERNAL_MAC="00:e0:4c:68:18:a3"
WAN_IF=""
LAN_IF=""
LAN_IP="192.168.50.1"
LAN_CIDR="192.168.50.1/24"
LAN_NET="192.168.50.0/24"
DHCP_START="192.168.50.50"
DHCP_END="192.168.50.200"
DHCP_LEASE="12h"
DNS_1="1.1.1.1"
DNS_2="8.8.8.8"
NFQUEUE_NUM="0"
PROJECT_LINK_DIR="/opt/suricata-lab"
RENDER_DIR="/etc/suricata-lab/rendered"
```

`INTERNAL_MAC` identifica el lado LAN/router/AP. `EXTERNAL_MAC` identifica el lado ISP/red externa. Los scripts resuelven automaticamente `LAN_IF` y `WAN_IF` desde esas MACs, por lo que los nombres variables de adaptadores USB no rompen el arranque.

Si quieres forzar nombres de interfaz manualmente, define tambien:

```env
LAN_IF="enp1s0"
WAN_IF="enp2s0"
```

Si `LAN_IF`/`WAN_IF` estan vacios, se resuelven por MAC. Si tienen valor, se usan como override manual.

En la VM de laboratorio actual, las USB NIC quedaron asi:

```text
LAN/router principal: enx9c69d36686cc  MAC 9c:69:d3:66:86:cc
WAN/ISP:              enx00e04c6818a3  MAC 00:e0:4c:68:18:a3
Gestion libvirt NAT:  enp1s0           IP 192.168.122.68
```

Si la rama instalada no tiene resolucion por MAC, fuerza los nombres reales en `/etc/suricata-lab/gateway.env`:

```env
LAN_IF="enx9c69d36686cc"
WAN_IF="enx00e04c6818a3"
```

## KVM con bridge

Con KVM bridge la VM ve interfaces virtuales. En ese caso, las MACs que debe usar `gateway.env` son las MACs visibles dentro de la VM, no necesariamente las MACs fisicas de los adaptadores USB del host.

Recomendacion para que sea estable:

- Crea dos NICs en la VM, cada una conectada al bridge correspondiente.
- Fija una MAC estatica por NIC en virt-manager/libvirt.
- Dentro de la VM verifica con `ip link` que esas MACs aparecen en las interfaces.
- Coloca esas MACs en `INTERNAL_MAC` y `EXTERNAL_MAC`.

Si usas USB passthrough directo en vez de bridge, la VM normalmente vera las MACs fisicas de los adaptadores USB y puedes usar esas MACs directamente.

Levantar todo:

```bash
sudo /usr/local/sbin/suricata-gateway-start
```

El script hace tres cosas: instala/actualiza symlinks, aplica red (`LAN_IP`, forwarding, NAT, NFQUEUE y `dnsmasq`) y levanta `docker-compose.gateway.yml` con `SURICATA_NFQUEUE_NUM`, `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_WS_URL` calculados desde `LAN_IP`.

## Reinicio y cambios

Las variables persistentes del gateway van en:

```text
/etc/suricata-lab/gateway.env
```

Despues de cambiar interfaces, LAN, DHCP, DNS o `NFQUEUE_NUM`, vuelve a renderizar/aplicar y reinicia el stack:

```bash
cd ~/proyecto-suricata
sudo /usr/local/sbin/suricata-gateway-start
```

Para reiniciar solo Docker Compose, sin tocar reglas de red:

```bash
cd ~/proyecto-suricata
source /etc/suricata-lab/gateway.env
export GATEWAY_LAN_IP="${LAN_IP:-192.168.50.1}"
export SURICATA_NFQUEUE_NUM="${NFQUEUE_NUM:-0}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://${GATEWAY_LAN_IP}:8000}"
export NEXT_PUBLIC_WS_URL="${NEXT_PUBLIC_WS_URL:-ws://${GATEWAY_LAN_IP}:8000/ws}"
docker compose -f docker-compose.gateway.yml restart
```

Para bajar y levantar de nuevo los contenedores:

```bash
cd ~/proyecto-suricata
docker compose -f docker-compose.gateway.yml down
sudo /usr/local/sbin/suricata-gateway-start
```

## Actualizacion

Actualizar codigo desde la rama `gateway`:

```bash
cd ~/proyecto-suricata
git fetch origin gateway
git checkout gateway
git pull --ff-only origin gateway
sudo /usr/local/sbin/suricata-gateway-start
```

Si solo quieres reconstruir contenedores despues de actualizar, sin reaplicar red:

```bash
cd ~/proyecto-suricata
source /etc/suricata-lab/gateway.env
export GATEWAY_LAN_IP="${LAN_IP:-192.168.50.1}"
export SURICATA_NFQUEUE_NUM="${NFQUEUE_NUM:-0}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://${GATEWAY_LAN_IP}:8000}"
export NEXT_PUBLIC_WS_URL="${NEXT_PUBLIC_WS_URL:-ws://${GATEWAY_LAN_IP}:8000/ws}"
docker compose -f docker-compose.gateway.yml up -d --build
```

## Nota CPU/KVM

Si `virt-install` mostro `KVM acceleration not available`, la VM corre por emulacion QEMU. En ese modo algunos contenedores modernos pueden fallar durante build con:

```text
Fatal glibc error: CPU does not support x86-64-v2
```

Solucion recomendada: activar Intel VT-x/AMD-V en BIOS/UEFI, verificar que exista `/dev/kvm` en el host, apagar/encender la VM y reconstruir. Verificacion en el host:

```bash
ls -l /dev/kvm
virsh --connect qemu:///system dominfo baseDeb
```

Mientras no haya KVM, el gateway puede tener las interfaces configuradas, pero el stack Docker puede fallar al construir imagenes que requieren CPU `x86-64-v2`.

## Verificacion

En la VM:

```bash
ip link
ip route
iptables -vnL FORWARD
iptables -t nat -vnL POSTROUTING
systemctl status dnsmasq
docker compose -f docker-compose.gateway.yml ps
docker compose -f docker-compose.gateway.yml logs -f suricata
```

Desde un cliente conectado al AP:

```bash
ping 192.168.50.1
curl http://neverssl.com
```

Servicios disponibles en la LAN del gateway:

```text
Frontend: http://192.168.50.1:3000
Backend:  http://192.168.50.1:8000
```

## Configuracion de VM

- `gateway/vm/baseDeb-preseed.cfg` instala una Debian base con usuario `debian`, SSH, sudo y `qemu-guest-agent`.
- Si la VM ya tiene dos NICs durante la instalacion, `netcfg/choose_interface auto` puede elegir cualquiera. Para una instalacion reproducible, instala con una sola NIC WAN y adjunta la USB Realtek despues, o fija la interfaz en el preseed.
- Despues del primer arranque instala dependencias gateway con `sudo apt install -y git docker.io docker-compose-plugin dnsmasq iptables iproute2 curl ethtool` o, en Debian 13, `sudo apt install -y git docker.io docker-compose dnsmasq iptables iproute2 curl ethtool`.
- `gateway/vm/baseDeb-usb-nic-realtek.xml` sirve para adjuntar por USB passthrough un NIC Realtek `0x0bda:0x8153`.
- `gateway/vm/baseDeb-usb-nic-asix.xml` sirve para adjuntar por USB passthrough un NIC ASIX `0x0b95:0x1790`.
- Si hay mas de un adaptador USB con el mismo vendor/product, fija tambien bus/device desde libvirt para evitar adjuntar el incorrecto.

## Limpieza

Limpiar solo reglas NAT/NFQUEUE:

```bash
sudo /usr/local/sbin/suricata-gateway-cleanup
```

Desmontar todo lo instalado por los scripts:

```bash
sudo /usr/local/sbin/suricata-gateway-unmount
```

`unmount.sh` elimina symlinks, archivos renderizados y reglas del gateway. No borra archivos versionados del repositorio.
