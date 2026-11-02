#!/bin/bash
# Installs (or updates) the match server on a fresh Ubuntu 24.04 machine and keeps it running.
# Needs /etc/mm-match.env with SUPABASE_URL and SUPABASE_SERVICE_KEY (the key lives only there, never in the repo).
# Progress and the server's log: http://<server IP>/server.log
set -e
BRANCH=${BRANCH:-ccr-373e923a-qdafh9}
export DEBIAN_FRONTEND=noninteractive
command -v node >/dev/null || { curl -fsSL https://deb.nodesource.com/setup_22.x | bash -; apt-get install -y nodejs; }
apt-get install -y git python3
if [ -d /opt/mm/.git ]; then git -C /opt/mm fetch --depth 1 origin "$BRANCH" && git -C /opt/mm reset --hard FETCH_HEAD
else git clone --depth 1 --branch "$BRANCH" https://github.com/phildbs/mountain-mogul /opt/mm; fi
mkdir -p /opt/mm/match/out
(cd /opt/mm/tests && npm install && npx playwright install --with-deps chromium)
chmod 600 /etc/mm-match.env 2>/dev/null || true
cat > /etc/systemd/system/mm-match.service <<'EOF'
[Unit]
Description=Mountain Mogul match server
After=network-online.target
[Service]
WorkingDirectory=/opt/mm
EnvironmentFile=/etc/mm-match.env
ExecStart=/usr/bin/node match/server.mjs
StandardOutput=append:/opt/mm/match/out/server.log
StandardError=append:/opt/mm/match/out/server.log
Restart=always
RestartSec=30
[Install]
WantedBy=multi-user.target
EOF
cat > /etc/systemd/system/mm-results.service <<'EOF'
[Unit]
Description=Mountain Mogul server log page
After=network-online.target
[Service]
ExecStart=/usr/bin/python3 -m http.server 80 --directory /opt/mm/match/out
Restart=always
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now mm-results
systemctl enable mm-match && systemctl restart mm-match
echo "$(date -u) installed $(git -C /opt/mm rev-parse --short HEAD)" >> /opt/mm/match/out/server.log
