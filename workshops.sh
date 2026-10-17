#!/bin/bash
# Start a local server for each model workshop.
#
#   8001 → Alien Workshop       (falo3d-2/alien_workshop.jsx)
#   8002 → Boss Workshop        (falo3d-2/boss_workshop.jsx)
#   8003 → Spire Replacements   (falo3d-2/spire_candidates.jsx)
#   8004 → Watcher Workshop     (falo3d-2/watcher_workshop.jsx)
#   8005 → Map Editor          (falo3d-2/map_editor.jsx)
#   8006 → Map Walkthrough     (falo3d-2/map_walk.js)
#   8007 → Puppet Master       (falo3d-2/puppet_workshop.jsx)
#
# Edit the .jsx and the page reloads itself — no build step, no node_modules.
# Ctrl-C stops them all.
set -e
cd "$(dirname "$0")"

trap 'kill 0' EXIT

python3 tools/workshop_server.py 8001 alien.html &
python3 tools/workshop_server.py 8002 boss.html &
python3 tools/workshop_server.py 8003 spire.html &
python3 tools/workshop_server.py 8004 watcher.html &
python3 tools/workshop_server.py 8005 map.html &
python3 tools/workshop_server.py 8006 mapwalk.html &
python3 tools/workshop_server.py 8007 puppet.html &

sleep 0.5
echo ""
echo "  Aliens   http://localhost:8001"
echo "  Bosses   http://localhost:8002"
echo "  Spire    http://localhost:8003"
echo "  Watcher  http://localhost:8004"
echo "  Map      http://localhost:8005"
echo "  Walk     http://localhost:8006"
echo "  Puppet   http://localhost:8007"
echo ""
echo "  Ctrl-C to stop."

wait
