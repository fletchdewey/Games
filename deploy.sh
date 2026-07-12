#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "=== Building ==="
./build.sh

echo "=== Deploying ==="
npx wrangler deploy --config wrangler.jsonc

echo "✓ Live at fletcherdewey.com/falo3d.html"
