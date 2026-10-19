// src/audio/mixer.js
// THE SOUNDBOARD
//
// FLETCHER'S GUIDE:
// M opens it, M closes it. Every sound in the game is in here with its own
// sliders, and a PLAY button so you can hear what you just changed without
// having to go and find an alien.
//
// Nothing is baked in. Move a slider and the change is live on the very next
// shot, and it is written to this browser so it survives a reload. RESET puts
// a sound back the way I built it. COPY hands you the whole lot as JSON — send
// me that and I will make your numbers the ones everybody gets.
//
// The panel builds itself from SOUNDS, so a sound added to sound.js appears
// here on its own. There is no second list to keep in step, which is the
// mistake the first game's mixer made.

import { SOUNDS, soundValue, setSoundValue, saveSound, resetSound,
         soundJSON, playSound, startLoop, stopLoop, loopRunning,
         masterVolume } from './sound.js?v=6a024c4cb3';

let panel = null;
let open = false;

export function soundboardOpen() { return open; }

export function toggleSoundboard() {
  if (!panel) build();
  open = !open;
  panel.style.display = open ? 'flex' : 'none';
  // A loop left sounding after you close the board would never stop.
  if (!open) for (const id of Object.keys(SOUNDS)) {
    if (SOUNDS[id].loop) stopLoop(id);
  }
  return open;
}

export function closeSoundboard() {
  if (open) toggleSoundboard();
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

  const val = document.createElement('span');
  val.className = 'sb-val';
  val.textContent = fmt(slider.value);

  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    setSoundValue(id, key, v);
    val.textContent = fmt(v);
    saveSound();
  });
  // The slider swallows its own clicks so they don't reach the game.
  slider.addEventListener('click', (e) => e.stopPropagation());

  wrap.append(label, slider, val);
  return wrap;
}

function fmt(v) {
  const n = parseFloat(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(n < 1 ? 2 : 1);
}

function build() {
  panel = document.createElement('div');
  panel.id = 'soundboard';
  panel.style.display = 'none';
  panel.addEventListener('click', (e) => e.stopPropagation());

  const head = document.createElement('div');
  head.className = 'sb-head';
  head.innerHTML = '<span class="sb-title">SOUNDBOARD</span>'
    + '<span class="sb-hint">M to close</span>';
  panel.appendChild(head);

  // Master first, on its own, because it is the one that fixes "too loud".
  const masterCard = document.createElement('div');
  masterCard.className = 'sb-card sb-master';
  masterCard.innerHTML = '<div class="sb-name">EVERYTHING</div>';
  masterCard.appendChild(row('master', 'vol',
    { label: 'Volume', min: 0, max: 1, step: 0.05 }));
  panel.appendChild(masterCard);

  const body = document.createElement('div');
  body.className = 'sb-body';

  // One column per group, in the order the sounds are declared.
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
    const title = document.createElement('div');
    title.className = 'sb-group';
    title.textContent = col.name;
    column.appendChild(title);

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
        if (!def.loop) { playSound(id); return; }
        // A looping sound toggles, so you can sit and listen while you tune.
        if (loopRunning(id)) { stopLoop(id); play.textContent = '▶ HOLD'; }
        else { startLoop(id); play.textContent = '■ STOP'; }
      });
      card.appendChild(play);
      column.appendChild(card);
    }
    body.appendChild(column);
  }
  panel.appendChild(body);

  // The footer: put it back, or take it away with you.
  const foot = document.createElement('div');
  foot.className = 'sb-foot';

  const reset = document.createElement('button');
  reset.type = 'button'; reset.className = 'sb-btn';
  reset.textContent = 'RESET ALL';
  reset.addEventListener('click', (e) => {
    e.stopPropagation();
    resetSound();
    panel.remove(); panel = null; open = false;
    toggleSoundboard();            // rebuilt, so every slider shows the default
  });

  const copy = document.createElement('button');
  copy.type = 'button'; copy.className = 'sb-btn';
  copy.textContent = 'COPY SETTINGS';
  copy.addEventListener('click', async (e) => {
    e.stopPropagation();
    const text = soundJSON();
    out.value = text;
    out.style.display = 'block';
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = 'COPIED';
    } catch (err) {
      // Clipboard refused — the text is on screen to copy by hand instead.
      copy.textContent = 'SELECT BELOW';
      out.select();
    }
    setTimeout(() => { copy.textContent = 'COPY SETTINGS'; }, 1800);
  });

  const out = document.createElement('textarea');
  out.className = 'sb-json';
  out.readOnly = true;
  out.spellcheck = false;
  out.style.display = 'none';
  out.addEventListener('click', (e) => e.stopPropagation());

  foot.append(reset, copy);
  panel.append(foot, out);
  document.body.appendChild(panel);
}
