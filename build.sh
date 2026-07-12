#!/bin/bash
set -e
cd "$(dirname "$0")"

SRC=src/falo3d
OUT=public/falo3d.html

cat $SRC/head.html              > "$OUT"
printf '<script>\n'             >> "$OUT"
cat $SRC/setup.js               >> "$OUT"
cat $SRC/audio.js               >> "$OUT"
cat $SRC/materials.js           >> "$OUT"
cat $SRC/level.js               >> "$OUT"
cat $SRC/props.js               >> "$OUT"
cat $SRC/environment.js         >> "$OUT"
cat $SRC/aliens.js              >> "$OUT"
cat $SRC/marines.js             >> "$OUT"
cat $SRC/easter.js              >> "$OUT"
cat $SRC/player.js              >> "$OUT"
cat $SRC/bullets.js             >> "$OUT"
cat $SRC/particles.js           >> "$OUT"
cat $SRC/hud.js                 >> "$OUT"
cat $SRC/gameloop.js            >> "$OUT"
cat $SRC/tail.html              >> "$OUT"

echo "✓ Built $OUT ($(wc -l < "$OUT") lines)"

# === Build Falo 3D-2 (native ES modules — sync source into public) ===
# v2 lives at the top level of src/ (game.js + aliens/map/player/shared).
# It loads THREE from a CDN via an import map, so there is no bundling step —
# we just mirror the source into public/ so it ships as static assets.
V2_SRC=src
V2_OUT=public/falo3d-2

rm -rf "$V2_OUT"
mkdir -p "$V2_OUT"
cp "$V2_SRC/game.js" "$V2_OUT/game.js"
cp -R "$V2_SRC/aliens" "$V2_SRC/bosses" "$V2_SRC/map" "$V2_SRC/player" "$V2_SRC/shared" "$V2_OUT/"
cp "$V2_SRC/falo3d-2.html" public/falo3d-2.html
find "$V2_OUT" -name '.DS_Store' -delete

# --- Cache-busting -----------------------------------------------------
# Browsers cache ES modules aggressively, so a redeploy can keep serving
# stale code even after a normal reload. We derive a version hash from the
# v2 source and stamp it onto every module URL (?v=HASH). The hash only
# changes when the source changes, so this doesn't churn the build output
# on unrelated commits, but any real change gets brand-new URLs that a
# browser cannot have cached. (The server ignores the query for static
# files, so the same game.js is still served.)
V2_VER=$(cat "$V2_OUT"/game.js $(find "$V2_OUT" -name '*.js' ! -name game.js | sort) | shasum | cut -c1-10)
find "$V2_OUT" -name '*.js' | while read -r f; do
  sed -E "s#(from '\.[^']*\.js)'#\1?v=$V2_VER'#g" "$f" > "$f.tmp" && mv "$f.tmp" "$f"
done
sed -E "s#(src=\"falo3d-2/game.js)\"#\1?v=$V2_VER\"#" public/falo3d-2.html > public/falo3d-2.html.tmp \
  && mv public/falo3d-2.html.tmp public/falo3d-2.html

echo "✓ Built falo3d-2 ($(find "$V2_OUT" -name '*.js' | wc -l | tr -d ' ') modules, v=$V2_VER)"

# === Build index.html from template ===
GAMES=$(ls public/*.html 2>/dev/null | grep -cv 'index\.html' || echo 0)
LINES=0
for f in src/falo3d/* src/game.js src/aliens/* src/bosses/* src/map/* src/player/* src/shared/* public/falo.html; do
  [ -f "$f" ] && LINES=$((LINES + $(wc -l < "$f")))
done

LINE_DISPLAY=$(echo "$LINES" | rev | sed 's/.\{3\}/&,/g' | rev | sed 's/^,//')+

sed "s/__GAME_COUNT__/$GAMES/g; s/__LINE_COUNT__/$LINE_DISPLAY/g" src/index.html > public/index.html

echo "✓ Built index.html — $GAMES games, $LINE_DISPLAY lines of code"
