#!/bin/sh
# Serve the production standalone build exactly as the container does.
set -eu
cd "$(dirname "$0")/.."
rm -rf .next/standalone/public .next/standalone/.next/static
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
exec env PORT="${PORT:-3217}" HOSTNAME="${HOSTNAME_BIND:-127.0.0.1}" node .next/standalone/server.js
