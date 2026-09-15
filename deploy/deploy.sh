#!/usr/bin/env bash
# Build the frontend and push code to the server, then restart. Run locally.
# Usage: ./deploy/deploy.sh user@your.server.ip
# (pb_data is NEVER synced — it lives only on the server.)
set -euo pipefail
TARGET="${1:-enlice}"
REMOTE=/opt/pocketbase

( cd frontend && npm install && npm run build )   # outputs into ../pb_public

rsync -avz --delete pb_migrations/ "${TARGET}:${REMOTE}/pb_migrations/"
rsync -avz --delete pb_hooks/      "${TARGET}:${REMOTE}/pb_hooks/"
rsync -avz --delete pb_public/     "${TARGET}:${REMOTE}/pb_public/"

ssh "${TARGET}" "sudo chown -R pocketbase:pocketbase ${REMOTE} && sudo systemctl restart pocketbase"
echo "Deployed. Migrations apply automatically on restart."
