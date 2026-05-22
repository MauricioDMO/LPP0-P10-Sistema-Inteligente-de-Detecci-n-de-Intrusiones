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

## Primer uso en la VM

Instalar dependencias del sistema:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin dnsmasq iptables iproute2 curl ethtool
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
WAN_IF="enp1s0"
LAN_IF="enp2s0"
LAN_IP="192.168.50.1"
LAN_CIDR="192.168.50.1/24"
LAN_NET="192.168.50.0/24"
NFQUEUE_NUM="0"
```

Levantar todo:

```bash
sudo /usr/local/sbin/suricata-gateway-start
```

## Verificacion

En la VM:

```bash
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
- Despues del primer arranque instala dependencias gateway con `sudo apt install -y docker.io docker-compose-plugin dnsmasq iptables iproute2 curl ethtool`.
- `gateway/vm/baseDeb-usb-nic-realtek.xml` sirve para adjuntar por USB passthrough un NIC Realtek `0x0bda:0x8153`.
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
