#!/bin/sh
# Deploy kovra to 109.123.238.170 (/srv/kovra, systemd unit `kovra`, port 8787).
set -e
npm run build
rsync -az --delete --exclude node_modules --exclude .git \
  server dist public package.json bun.lock .env root@109.123.238.170:/srv/kovra/
ssh root@109.123.238.170 'cd /srv/kovra && /root/.bun/bin/bun install && systemctl restart kovra && sleep 2 && systemctl is-active kovra'
