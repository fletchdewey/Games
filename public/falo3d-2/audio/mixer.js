// src/audio/mixer.js
// THE SOUNDBOARD
//
// FLETCHER'S GUIDE:
// Two ways in, and they are the same board.
//
//   M, in the game        slides over the station and freezes it while it is
//                         up, so nothing eats you while you are tuning.
//   soundboard.html       its own tab, so you can leave it open on one screen
//                         and play on the other.
//
// They share this file and they share your settings. Move a slider in the
// tab and the game picks it up on its next shot WITHOUT a reload, because
// every change is written to the browser's storage and the game is listening
// for it. That is the whole trick: two tabs, one set of numbers.
//
// Nothing is baked in. RESET ALL puts a sound back the way I built it. COPY
// SETTINGS hands you the lot as JSON — send me that and I will make your
// numbers the ones everybody gets.
//
// The board builds itself from SOUNDS, so a sound added to sound.js appears
// here on its own. There is no second list to keep in step, which is the
// mistake the first game's mixer made.

import { SOUNDS, soundValue, setSoundValue, saveSound, resetSound,
         soundJSON, playSound, startLoop, stopLoop, loopRunning,
         startAudio, loadSavedSound } from './sound.js?v=cbc9eb3c8b';

// ─── LOOK ───────────────────────────────────────────────────
// Carried here rather than in the game's HTML, so the standalone page and
// the in-game panel cannot drift apart.
const CSS = `
#soundboard {
  position: fixed; inset: 20px; z-index: 40;
  display: none; flex-direction: column;
  background: rgba(8,8,12,0.95);
  border: 1px solid rgba(255,170,34,0.35); border-radius: 10px;
  font-family: 'Courier New', monospace; color: #c8c8d8;
  padding: 12px 14px;
}
#soundboard.sb-standalone {
  position: static; inset: auto; display: flex; border: 0; border-radius: 0;
  min-height: 100vh; background: #07070b;
}
.sb-head { display: flex; justify-content: space-between; align-items: baseline;
           padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); }
.sb-title { font-size: 14px; letter-spacing: 4px; color: #ffaa22; }
.sb-hint { font-size: 10px; color: #667; letter-spacing: 2px; }
.sb-hint a { color: #ffaa22; text-decoration: none; }
.sb-hint a:hover { text-decoration: underline; }
.sb-find { font-family: inherit; font-size: 11px; letter-spacing: 1px;
           padding: 5px 10px; border-radius: 6px; width: 190px;
           color: #e8e8f0; background: rgba(255,255,255,0.06);
           border: 1px solid rgba(255,255,255,0.18); }
.sb-find::placeholder { color: #667; letter-spacing: 1px; }
.sb-find:focus { outline: none; border-color: #ffaa22; }
.sb-none { font-size: 11px; color: #778; padding: 14px 2px; }
.sb-body { display: flex; gap: 12px; overflow: auto; flex: 1; padding: 10px 0;
           align-items: flex-start; flex-wrap: wrap; }
.sb-col { display: flex; flex-direction: column; gap: 8px;
          min-width: 196px; flex: 1 1 196px; max-width: 280px; }
.sb-group { font-size: 10px; letter-spacing: 3px; color: #ffaa22;
            padding: 2px 0 4px; }
.sb-card { background: rgba(255,255,255,0.035); border-radius: 7px;
           border: 1px solid rgba(255,255,255,0.09); padding: 7px 9px; }
.sb-master { margin: 10px 0 0; max-width: 420px; border-color: rgba(255,170,34,0.4); }
.sb-name { font-size: 10px; letter-spacing: 2px; color: #e8e8f0; margin-bottom: 5px; }
.sb-row { display: flex; align-items: center; gap: 6px; margin: 2px 0; }
.sb-label { font-size: 9px; color: #889; width: 52px; flex: none; }
.sb-row input[type=range] { flex: 1; min-width: 0; height: 14px; accent-color: #ffaa22; }
.sb-val { font-size: 9px; color: #ffaa22; width: 38px; text-align: right; flex: none; }
.sb-play { margin-top: 6px; width: 100%; font-family: inherit; font-size: 9px;
           letter-spacing: 2px; padding: 4px; border-radius: 5px; cursor: pointer;
           color: #c8c8d8; background: rgba(255,255,255,0.06);
           border: 1px solid rgba(255,255,255,0.16); }
.sb-play:hover { background: rgba(255,170,34,0.16); color: #ffaa22; }
.sb-foot { display: flex; gap: 8px; padding-top: 8px; flex-wrap: wrap;
           border-top: 1px solid rgba(255,255,255,0.1); }
.sb-btn { font-family: inherit; font-size: 10px; letter-spacing: 2px;
          padding: 6px 14px; border-radius: 6px; cursor: pointer;
          color: #c8c8d8; background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.16); }
.sb-btn:hover { border-color: #ffaa22; color: #ffaa22; }
.sb-json { width: 100%; height: 108px; margin-top: 8px; resize: vertical;
           font-family: inherit; font-size: 10px; color: #99a;
           background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.14);
           border-radius: 6px; padding: 7px; }
`;

function ensureStyles() {
  if (document.getElementById('sb-style')) return;
  const el = document.createElement('style');
  el.id = 'sb-style';
  el.textContent = CSS;
  document.head.appendChild(el);
}

let panel = null;
let open = false;
let standalone = false;

export function soundboardOpen() { return open; }

// ─── THE PANEL ──────────────────────────────────────────────

function fmt(v) {
  const n = parseFloat(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(n < 1 ? 2 : 1);
}

function row(id, key, spec) {
  const wrap = document.createElement('div');
  wrap.className = 'sb-row';

  const label = document.createElement('span');
  label.className = 'sb-label';
  label.textContent = spec.label;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = spec.min; slider.max = spec.max; slider.step = spec.step;
  slider.value = soundValue(id, key);
  slider.dataset.sid = id;
  slider.dataset.key = key;

  const val = document.createElement('span');
  val.className = 'sb-val';
  val.textContent = fmt(slider.value);

  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    setSoundValue(id, key, v);
    val.textContent = fmt(v);
    // Written on every nudge, because this is also how it reaches the game
    // in the other tab.
    saveSound();
  });
  slider.addEventListener('click', (e) => e.stopPropagation());

  wrap.append(label, slider, val);
  return wrap;
}

/** Pull every slider back in line with the numbers, after a change elsewhere. */
function refresh() {
  if (!panel) return;
  for (const slider of panel.querySelectorAll('input[type=range]')) {
    const v = soundValue(slider.dataset.sid, slider.dataset.key);
    if (parseFloat(slider.value) === v) continue;
    slider.value = v;
    const val = slider.parentElement.querySelector('.sb-val');
    if (val) val.textContent = fmt(v);
  }
}

function build() {
  ensureStyles();
  panel = document.createElement('div');
  panel.id = 'soundboard';
  panel.addEventListener('click', (e) => e.stopPropagation());

  const head = document.createElement('div');
  head.className = 'sb-head';
  const title = document.createElement('span');
  title.className = 'sb-title';
  title.textContent = 'SOUNDBOARD';
  const hint = document.createElement('span');
  hint.className = 'sb-hint';
  hint.innerHTML = standalone
    ? 'changes reach the game as you make them'
    : 'M to close';
  head.append(title, hint);
  panel.appendChild(head);

  // With thirty-odd sounds on one board, the one you want is usually below
  // the fold in whichever column happens to be the tallest. Typing a few
  // letters is faster than hunting for it.
  const find = document.createElement('input');
  find.type = 'search';
  find.className = 'sb-find';
  find.placeholder = 'find a sound...';
  find.addEventListener('click', (e) => e.stopPropagation());
  find.addEventListener('keydown', (e) => {
    e.stopPropagation();                 // M in the box is a letter, not a key
    if (e.key === 'Escape') { find.value = ''; applyFilter(''); }
  });
  find.addEventListener('input', () => applyFilter(find.value));
  head.appendChild(find);

  const masterCard = document.createElement('div');
  masterCard.className = 'sb-card sb-master';
  masterCard.innerHTML = '<div class="sb-name">EVERYTHING</div>';
  masterCard.appendChild(row('master', 'vol',
    { label: 'Volume', min: 0, max: 1, step: 0.05 }));
  panel.appendChild(masterCard);

  const body = document.createElement('div');
  body.className = 'sb-body';

  const groups = [];
  for (const id of Object.keys(SOUNDS)) {
    const g = SOUNDS[id].group;
    let col = groups.find((c) => c.name === g);
    if (!col) { col = { name: g, ids: [] }; groups.push(col); }
    col.ids.push(id);
  }

  for (const col of groups) {
    const column = document.createElement('div');
    column.className = 'sb-col';
    const gt = document.createElement('div');
    gt.className = 'sb-group';
    gt.textContent = col.name;
    column.appendChild(gt);

    for (const id of col.ids) {
      const def = SOUNDS[id];
      const card = document.createElement('div');
      card.className = 'sb-card';

      const name = document.createElement('div');
      name.className = 'sb-name';
      name.textContent = def.label;
      card.appendChild(name);

      for (const [key, spec] of Object.entries(def.params)) {
        card.appendChild(row(id, key, spec));
      }

      const play = document.createElement('button');
      play.className = 'sb-play';
      play.type = 'button';
      play.textContent = def.loop ? '▶ HOLD' : '▶ PLAY';
      play.addEventListener('click', (e) => {
        e.stopPropagation();
        // A browser will not make a noise until it has been clicked. On the
        // standalone page this IS that click.
        startAudio();
        if (!def.loop) { playSound(id); return; }
        if (loopRunning(id)) { stopLoop(id); play.textContent = '▶ HOLD'; }
        else { startLoop(id); play.textContent = '■ STOP'; }
      });
      card.appendChild(play);
      column.appendChild(card);
    }
    body.appendChild(column);
  }
  panel.appendChild(body);

  const foot = document.createElement('div');
  foot.className = 'sb-foot';

  const reset = document.createElement('button');
  reset.type = 'button'; reset.className = 'sb-btn';
  reset.textContent = 'RESET ALL';
  reset.addEventListener('click', (e) => {
    e.stopPropagation();
    resetSound();
    refresh();
  });

  const copy = document.createElement('button');
  copy.type = 'button'; copy.className = 'sb-btn';
  copy.textContent = 'COPY SETTINGS';

  const out = document.createElement('textarea');
  out.className = 'sb-json';
  out.readOnly = true;
  out.spellcheck = false;
  out.style.display = 'none';
  out.addEventListener('click', (e) => e.stopPropagation());

  copy.addEventListener('click', async (e) => {
    e.stopPropagation();
    const text = soundJSON();
    out.value = text;
    out.style.display = 'block';
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = 'COPIED';
    } catch (err) {
      copy.textContent = 'SELECT BELOW';
      out.select();
    }
    setTimeout(() => { copy.textContent = 'COPY SETTINGS'; }, 1800);
  });

  foot.append(reset, copy);

  // Only the in-game panel offers the tab; the tab does not need a link
  // to itself.
  if (!standalone) {
    const tab = document.createElement('button');
    tab.type = 'button'; tab.className = 'sb-btn';
    tab.textContent = 'OPEN IN ITS OWN TAB';
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      window.open('soundboard.html', 'falo3d2-soundboard');
    });
    foot.append(tab);
  }

  const none = document.createElement('div');
  none.className = 'sb-none';
  none.textContent = 'Nothing by that name.';
  none.hidden = true;
  body.appendChild(none);

  panel.append(foot, out);
  return panel;
}

/**
 * Show only the sounds whose name matches.
 *
 * Matched against the label and the group both, so "boss" finds the three
 * boss sounds and "dying" finds every death in the game at once — which is
 * the comparison you actually want to make while tuning them.
 */
function applyFilter(text) {
  if (!panel) return;
  const q = text.trim().toLowerCase();
  let shown = 0;
  for (const col of panel.querySelectorAll('.sb-col')) {
    const group = col.querySelector('.sb-group').textContent.toLowerCase();
    let any = false;
    for (const card of col.querySelectorAll('.sb-card')) {
      const name = card.querySelector('.sb-name').textContent.toLowerCase();
      const hit = !q || name.includes(q) || group.includes(q);
      card.hidden = !hit;
      if (hit) { any = true; shown++; }
    }
    col.hidden = !any;
  }
  const none = panel.querySelector('.sb-none');
  if (none) none.hidden = shown > 0;
}

// ─── THE TWO WAYS IN ────────────────────────────────────────

export function toggleSoundboard() {
  if (!panel) { document.body.appendChild(build()); }
  open = !open;
  panel.style.display = open ? 'flex' : 'none';
  if (open) refresh();                 // the tab may have moved things
  else for (const id of Object.keys(SOUNDS)) {
    if (SOUNDS[id].loop) stopLoop(id);  // a drone left sounding never stops
  }
  return open;
}

export function closeSoundboard() {
  if (open) toggleSoundboard();
}

/** The standalone page: no toggle, no overlay, just the board. */
export function mountSoundboard(host = document.body) {
  standalone = true;
  loadSavedSound();
  const el = build();
  el.classList.add('sb-standalone');
  el.style.display = 'flex';
  open = true;
  host.appendChild(el);
}

// ─── THE OTHER TAB ──────────────────────────────────────────
// Storage events only fire in the tabs that did NOT make the change, which
// is exactly what is wanted: whichever board you are touching updates
// itself, and the other one — and the game — follows.
window.addEventListener('storage', (e) => {
  if (e.key !== 'falo3d2.sound') return;
  loadSavedSound();
  refresh();
});
