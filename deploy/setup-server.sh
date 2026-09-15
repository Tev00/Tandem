#!/usr/bin/env bash
# Provision a fresh Ubuntu 24.04 Hetzner box for En lice. Run as root.
# Usage: ./setup-server.sh enlice.eu [PB_VERSION] [ARCH]
#   ARCH: linux_arm64 (CAX servers, default) or linux_amd64 (CX/CPX servers)
set -euo pipefail
DOMAIN="${1:?usage: setup-server.sh <domain> [pb_version] [arch]}"
PB_VERSION="${2:-0.39.2}"   # check github.com/pocketbase/pocketbase/releases for latest
ARCH="${3:-linux_arm64}"

apt-get update && apt-get -y upgrade
apt-get install -y unzip ufw wget libcap2-bin

ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

id -u pocketbase >/dev/null 2>&1 || useradd --system --create-home \
  --home-dir /opt/pocketbase --shell /usr/sbin/nologin pocketbase
mkdir -p /opt/pocketbase/pb_hooks /opt/pocketbase/pb_migrations \
         /opt/pocketbase/pb_public /opt/pocketbase/pb_data

cd /tmp
wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${ARCH}.zip"
unzip -o "pocketbase_${PB_VERSION}_${ARCH}.zip" pocketbase -d /opt/pocketbase
chmod +x /opt/pocketbase/pocketbase
setcap 'cap_net_bind_service=+ep' /opt/pocketbase/pocketbase   # bind 80/443 as non-root
chown -R pocketbase:pocketbase /opt/pocketbase

cat >/etc/systemd/system/pocketbase.service <<UNIT
[Unit]
Description=En lice (PocketBase)
After=network.target

[Service]
Type=simple
User=pocketbase
Group=pocketbase
WorkingDirectory=/opt/pocketbase
ExecStart=/opt/pocketbase/pocketbase serve ${DOMAIN}
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now pocketbase
echo "Done. Point an A record for ${DOMAIN} at this server, then open https://${DOMAIN}/_/ to create the first superuser."
