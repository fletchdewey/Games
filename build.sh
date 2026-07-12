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

# === Build index.html from template ===
GAMES=$(ls public/*.html 2>/dev/null | grep -cv 'index\.html')
LINES=0
for f in src/falo3d/*; do LINES=$((LINES + $(wc -l < "$f"))); done
for f in public/falo.html; do [ -f "$f" ] && LINES=$((LINES + $(wc -l < "$f"))); done

LINE_DISPLAY=$(echo "$LINES" | rev | sed 's/.\{3\}/&,/g' | rev | sed 's/^,//')+

sed "s/__GAME_COUNT__/$GAMES/g; s/__LINE_COUNT__/$LINE_DISPLAY/g" src/index.html > public/index.html

echo "✓ Built index.html — $GAMES games, $LINE_DISPLAY lines of code"
