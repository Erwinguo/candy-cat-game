#!/bin/sh
set -eu

: "${TANGDOU_API_BASE:=http://localhost:8787}"

cat > /usr/share/nginx/html/config.js <<EOF
window.TANGDOU_API_BASE = "${TANGDOU_API_BASE}";
EOF
