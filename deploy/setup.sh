#!/usr/bin/env bash
# Установка на чистый Ubuntu 24.04. Запуск от root из папки с кодом: bash deploy/setup.sh <SITE_URL>
set -euo pipefail
SITE_URL="${1:-http://$(hostname -I | awk '{print $1}')}"
APP=/opt/mfo-site

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q nodejs nginx ufw

id mfo >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin mfo
mkdir -p /var/lib/mfo-site
chown mfo:mfo /var/lib/mfo-site
chmod 700 /var/lib/mfo-site

cd "$APP"
SITE_URL="$SITE_URL" node build.js
chown -R root:root "$APP"

install -m 644 deploy/mfo-site.service /etc/systemd/system/mfo-site.service
systemctl daemon-reload
systemctl enable --now mfo-site
systemctl restart mfo-site

install -m 644 deploy/nginx.conf /etc/nginx/sites-available/mfo-site
ln -sf /etc/nginx/sites-available/mfo-site /etc/nginx/sites-enabled/mfo-site
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "Готово: $SITE_URL"
