#!/usr/bin/env python3
"""Tiny static dev server for the Falo 3D-2 workshops.

Serves the falo3d-2/ directory, but maps "/" to a specific entry page so each
workshop gets its own bare localhost URL (localhost:8001 = aliens, :8002 =
bosses) instead of a shared directory listing.

Also sends no-cache headers — the workshop loader reloads the page when a .jsx
changes on disk, which only works if the browser actually re-fetches.

    python3 tools/workshop_server.py <port> <entry.html>
"""

import functools
import http.server
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "falo3d-2")

# The map editor's output. A real file in the repo, NOT browser storage: the
# whole point is that editing the editor can't lose the map. It survives a
# reload, a different browser, and a cleared cache, and it's diffable in git.
MAP_FILE = os.path.normpath(os.path.join(ROOT, "map_data.json"))
LAYOUT_FILE = os.path.normpath(os.path.join(HERE, "..", "src", "map", "layout.js"))


def read_rooms():
    """The existing hand-authored rooms, so the editor can show them as a
    reference underlay to trace over or replace."""
    try:
        src = open(LAYOUT_FILE).read()
    except OSError:
        return []
    pat = (r"id:\s*'([^']+)',[^}]*?pos:\s*\[([-\d.]+),\s*([-\d.]+)\]"
           r",\s*size:\s*\[([-\d.]+),\s*([-\d.]+)\]")
    return [{"id": m[0], "x": float(m[1]), "z": float(m[2]),
             "w": float(m[3]), "d": float(m[4])} for m in re.findall(pat, src)]


class Handler(http.server.SimpleHTTPRequestHandler):
    entry = "alien.html"

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _rev(self):
        try:
            return os.stat(MAP_FILE).st_mtime_ns
        except OSError:
            return 0

    def do_GET(self):
        if self.path.split("?")[0] == "/api/map":
            try:
                with open(MAP_FILE) as f:
                    data = json.load(f)
            except (OSError, ValueError):
                data = {"cells": [], "cellSize": 1.0}
            data["rev"] = self._rev()
            return self._json(data)
        if self.path.split("?")[0] == "/api/rooms":
            return self._json(read_rooms())
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] != "/api/map":
            return self._json({"error": "not found"}, 404)
        try:
            n = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(n) or b"{}")
            if not isinstance(data.get("cells"), list):
                raise ValueError("payload needs a cells array")
            # Refuse to clobber a file that changed since the client read it.
            # Two editor tabs (or a tab plus a script) both autosaving the whole
            # document is otherwise last-write-wins, and renames vanish.
            sent_rev = data.pop("rev", None)
            cur_rev = self._rev()
            if sent_rev is not None and cur_rev and sent_rev != cur_rev:
                try:
                    with open(MAP_FILE) as f:
                        fresh = json.load(f)
                except (OSError, ValueError):
                    fresh = {}
                fresh["rev"] = cur_rev
                return self._json({"error": "stale", "current": fresh}, 409)

            # Preserve fields the editor doesn't send (room tags, etc.) rather
            # than letting a plain cell save silently drop them.
            try:
                with open(MAP_FILE) as f:
                    merged = json.load(f)
            except (OSError, ValueError):
                merged = {}
            merged.update(data)
            data = merged
            # Write via a temp file and replace, so a save interrupted halfway
            # can't leave a truncated map behind.
            tmp = MAP_FILE + ".tmp"
            with open(tmp, "w") as f:
                json.dump(data, f, separators=(",", ":"))
            os.replace(tmp, MAP_FILE)
            return self._json({"ok": True, "cells": len(data["cells"]),
                               "rev": self._rev()})
        except Exception as exc:                     # noqa: BLE001 - report to the UI
            return self._json({"error": str(exc)}, 400)

    def translate_path(self, path):
        # Bare "/" lands on this server's workshop page.
        if path in ("/", ""):
            path = "/" + self.entry
        # /src/... reaches the real game source, so the map walkthrough can
        # import the actual player controller instead of a copy that drifts.
        clean = path.split("?")[0].split("#")[0]
        if clean.startswith("/src/"):
            rel = os.path.normpath(clean[len("/src/"):]).lstrip("/")
            full = os.path.normpath(os.path.join(HERE, "..", "src", rel))
            root = os.path.normpath(os.path.join(HERE, "..", "src"))
            if full.startswith(root):          # no escaping the src tree
                return full
        return super().translate_path(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Quiet the per-request noise; keep errors.
        if not str(args[1] if len(args) > 1 else "").startswith(("2", "3")):
            super().log_message(fmt, *args)


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    port, entry = int(sys.argv[1]), sys.argv[2]

    handler = functools.partial(
        type("WorkshopHandler", (Handler,), {"entry": entry}),
        directory=os.path.normpath(ROOT),
    )
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    print(f"→ {entry} on http://localhost:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
