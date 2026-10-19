// src/audio/sound.js
// EVERYTHING THE STATION SOUNDS LIKE
//
// FLETCHER'S GUIDE:
// There is not a single sound file in this game. Every noise is built out of
// oscillators and filtered noise at the moment it plays, the same way the
// first Falo 3D did it. That means no downloads, nothing to wait for, and —
// the part that matters for you — every sound is a handful of NUMBERS rather
// than a recording. Change a number and the sound changes. That is what the
// soundboard on the M key is editing.
//
// Three ideas make up nearly all of them:
//
//   NOISE    static, shaped by a filter and faded out fast. This is the crack
//            of a gun, the grit under a boot, the roar of a breach.
//   TONE     a single pitch, usually sliding. Sliding down is weight and
//            death; sliding up is charging and winning.
//   THUMP    a very low tone that drops to nothing in a tenth of a second.
//            This is what makes a thing feel heavy rather than loud.
//
// A gunshot is noise plus thump. An explosion is noise plus thump plus more
// noise. The Watcher's charge is one long tone sliding up. There is no fourth
// trick, and you can hear all three if you listen for them.

// ─── THE AUDIO ENGINE ───────────────────────────────────────
// Browsers refuse to make noise until the person has clicked something, so
// none of this exists until the first click on Click to Play.
let ctx = null;
let master = null;
const loops = new Map();        // id -> the voice that is still sounding

export function audioStarted() { return !!ctx; }

export function startAudio() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;                       // no audio here; the game still runs
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = CFG.master.vol;
  master.connect(ctx.destination);
}

/** The one knob above all the others. */
export function setMasterVolume(v) {
  CFG.master.vol = v;
  if (master) master.gain.value = v;
}

export function masterVolume() { return CFG.master.vol; }

// ─── THE PARTS ──────────────────────────────────────────────

/**
 * Static, fading out.
 *
 * `decay` shapes HOW it fades: 1 is a straight line, higher numbers snap
 * shut faster, which is the difference between a rifle and a shotgun.
 */
function noise(dur, decay = 1.2) {
  const n = Math.max(1, Math.round(dur * ctx.sampleRate));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

/** A filter to point the noise somewhere. High = thin and sharp, low = dull. */
function filter(type, freq, q = 1) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

/**
 * A volume shape: silent, up fast, then down to nothing.
 *
 * Everything goes through one of these. A sound that starts and stops at full
 * volume clicks, and a hundred clicks a minute is what makes cheap audio
 * sound cheap.
 */
function env(peak, t, dur, attack = 0.004) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(Math.max(0.0001, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + 0.01));
  return g;
}

/** A pitch, optionally sliding from one note to another. */
function tone(type, from, to, t, dur) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(1, from), t);
  if (to !== from) {
    o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
  }
  o.start(t);
  o.stop(t + dur + 0.02);
  return o;
}

/** Noise, pointed and faded. The body of most sounds in the game. */
function hiss(out, t, { dur, type = 'bandpass', freq, q = 1, vol, decay = 1.2 }) {
  const n = noise(dur, decay);
  const f = filter(type, freq, q);
  const g = env(vol, t, dur);
  n.connect(f); f.connect(g); g.connect(out);
  n.start(t);
  n.stop(t + dur + 0.02);
}

/** The low drop that makes something feel heavy. */
function thump(out, t, { freq, dur, vol, to = 18 }) {
  const o = tone('sine', freq, to, t, dur);
  const g = env(vol, t, dur, 0.006);
  o.connect(g); g.connect(out);
}

/** A clean pitch, for chimes and alarms rather than impacts. */
function beep(out, t, { from, to = from, dur, vol, type = 'sine' }) {
  const o = tone(type, from, to, t, dur);
  const g = env(vol, t, dur, Math.min(0.03, dur * 0.3));
  o.connect(g); g.connect(out);
}

// ─── EVERY SOUND IN THE GAME ────────────────────────────────
// Each one lists the knobs the soundboard gives you, with the value it
// starts at and the range the slider covers. `make` is the sound itself.
//
// `p` is that sound's current numbers, `t` is when to start, `out` is where
// it goes. Nothing here reaches for the speakers directly — that way the
// master volume and the distance fade both still apply.

const P = (def, min, max, step, label) => ({ def, min, max, step, label });

export const SOUNDS = {
  // ─── WEAPONS ──────────────────────────────────────────────
  'gun-assault': {
    label: 'ASSAULT RIFLE', group: 'Weapons',
    params: {
      vol:   P(0.34, 0, 1, 0.02, 'Volume'),
      crack: P(1900, 300, 6000, 50, 'Crack'),
      body:  P(0.3, 0, 0.8, 0.02, 'Body'),
      dur:   P(0.15, 0.03, 0.4, 0.01, 'Length'),
    },
    make(p, t, out) {
      hiss(out, t, { dur: p.dur, freq: p.crack, q: 0.8, vol: p.vol, decay: 1.3 });
      thump(out, t, { freq: 130, dur: p.dur * 0.9, vol: p.body });
    },
  },
  'gun-sniper': {
    label: 'SNIPER RIFLE', group: 'Weapons',
    params: {
      vol:   P(0.5, 0, 1, 0.02, 'Volume'),
      crack: P(1100, 300, 5000, 50, 'Crack'),
      body:  P(0.6, 0, 1, 0.02, 'Body'),
      tail:  P(0.42, 0, 1.2, 0.02, 'Tail'),
      dur:   P(0.26, 0.05, 0.6, 0.01, 'Length'),
    },
    make(p, t, out) {
      hiss(out, t, { dur: p.dur, freq: p.crack, q: 0.6, vol: p.vol, decay: 1.1 });
      thump(out, t, { freq: 85, dur: p.dur * 1.3, vol: p.body, to: 12 });
      // The crack coming back off the far wall, a beat later.
      hiss(out, t + 0.07, { dur: p.tail, type: 'lowpass', freq: 700,
                            vol: p.vol * 0.3, decay: 2.2 });
    },
  },
  'gun-smg': {
    label: 'SMG', group: 'Weapons',
    params: {
      vol:   P(0.22, 0, 1, 0.02, 'Volume'),
      crack: P(2600, 500, 7000, 50, 'Crack'),
      body:  P(0.16, 0, 0.6, 0.02, 'Body'),
      dur:   P(0.08, 0.02, 0.25, 0.005, 'Length'),
    },
    make(p, t, out) {
      hiss(out, t, { dur: p.dur, freq: p.crack, q: 1.1, vol: p.vol, decay: 1.6 });
      thump(out, t, { freq: 150, dur: p.dur, vol: p.body });
    },
  },
  'gun-pistol': {
    label: 'PISTOL', group: 'Weapons',
    params: {
      vol:   P(0.3, 0, 1, 0.02, 'Volume'),
      crack: P(2100, 400, 6000, 50, 'Crack'),
      body:  P(0.22, 0, 0.7, 0.02, 'Body'),
      dur:   P(0.11, 0.02, 0.3, 0.005, 'Length'),
    },
    make(p, t, out) {
      hiss(out, t, { dur: p.dur, freq: p.crack, q: 1.4, vol: p.vol, decay: 1.7 });
      thump(out, t, { freq: 120, dur: p.dur * 0.8, vol: p.body });
    },
  },
  'gun-minigun': {
    // Fires twenty-seven times a second, so it has to be SHORT and quiet.
    // Anything with a tail on it turns into mud at that rate.
    label: 'MINIGUN ROUND', group: 'Weapons',
    params: {
      vol:   P(0.13, 0, 0.6, 0.01, 'Volume'),
      crack: P(3100, 500, 7000, 50, 'Crack'),
      body:  P(0.1, 0, 0.5, 0.01, 'Body'),
      dur:   P(0.045, 0.015, 0.12, 0.005, 'Length'),
    },
    make(p, t, out) {
      hiss(out, t, { dur: p.dur, freq: p.crack, q: 1.3, vol: p.vol, decay: 2 });
      thump(out, t, { freq: 160, dur: p.dur, vol: p.body });
    },
  },
  'minigun-spin': {
    label: 'MINIGUN BARRELS', group: 'Weapons', loop: true,
    params: {
      vol:  P(0.1, 0, 0.5, 0.01, 'Volume'),
      freq: P(90, 30, 400, 5, 'Whine'),
      bite: P(0.5, 0, 1, 0.05, 'Bite'),
    },
    make(p, t, out) {
      // Held open rather than faded, and closed by stopLoop().
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(p.freq * 0.4, t);
      o.frequency.exponentialRampToValueAtTime(p.freq, t + 0.35);
      const f = filter('lowpass', 400 + p.bite * 2600, 3);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(p.vol, t + 0.2);
      o.connect(f); f.connect(g); g.connect(out);
      o.start(t);
      return { stop: (at) => {
        g.gain.cancelScheduledValues(at);
        g.gain.setValueAtTime(g.gain.value, at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
        o.frequency.exponentialRampToValueAtTime(p.freq * 0.3, at + 0.4);
        o.stop(at + 0.45);
      } };
    },
  },
  'rpg-launch': {
    label: 'RPG LAUNCH', group: 'Weapons',
    params: {
      vol:   P(0.5, 0, 1, 0.02, 'Volume'),
      whoosh: P(0.45, 0.1, 1.2, 0.05, 'Whoosh'),
      kick:  P(0.5, 0, 1, 0.02, 'Kick'),
    },
    make(p, t, out) {
      thump(out, t, { freq: 90, dur: 0.22, vol: p.kick, to: 25 });
      // The motor: noise opening up as it goes away from you.
      const n = noise(p.whoosh, 0.6);
      const f = filter('bandpass', 400, 1.2);
      f.frequency.setValueAtTime(300, t);
      f.frequency.exponentialRampToValueAtTime(2400, t + p.whoosh);
      const g = env(p.vol, t, p.whoosh, 0.02);
      n.connect(f); f.connect(g); g.connect(out);
      n.start(t); n.stop(t + p.whoosh + 0.02);
    },
  },
  'explosion': {
    label: 'EXPLOSION', group: 'Weapons',
    params: {
      vol:    P(0.7, 0, 1.2, 0.02, 'Volume'),
      sub:    P(0.8, 0, 1.2, 0.02, 'Sub'),
      subHz:  P(70, 25, 160, 5, 'Sub Hz'),
      debris: P(0.35, 0, 1, 0.02, 'Debris'),
      dur:    P(0.55, 0.15, 1.4, 0.05, 'Length'),
    },
    make(p, t, out) {
      // The body of it: bright for an instant, then all low end.
      const n = noise(p.dur, 1.1);
      const f = filter('lowpass', 3000, 0.8);
      f.frequency.setValueAtTime(3200, t);
      f.frequency.exponentialRampToValueAtTime(110, t + p.dur);
      const g = env(p.vol, t, p.dur, 0.008);
      n.connect(f); f.connect(g); g.connect(out);
      n.start(t); n.stop(t + p.dur + 0.02);
      thump(out, t, { freq: p.subHz, dur: p.dur * 0.8, vol: p.sub, to: 14 });
      // Bits of the station coming back down.
      for (let i = 0; i < 5; i++) {
        hiss(out, t + 0.06 + Math.random() * p.dur * 0.7,
             { dur: 0.05, freq: 1800 + Math.random() * 2500, q: 2,
               vol: p.debris * (0.4 + Math.random() * 0.6), decay: 2.5 });
      }
    },
  },

  // ─── THE ALIENS ───────────────────────────────────────────
  'crawler-step': {
    label: 'CRAWLER LEGS', group: 'Aliens',
    params: {
      vol:  P(0.12, 0, 0.6, 0.01, 'Volume'),
      freq: P(3400, 800, 8000, 100, 'Pitch'),
      dur:  P(0.035, 0.01, 0.12, 0.005, 'Length'),
    },
    make(p, t, out) {
      // Chitin on deck plate: tiny, high and dry. Pitch wobbles per step so
      // eight of them in a room do not sound like a metronome.
      hiss(out, t, { dur: p.dur, freq: p.freq * (0.82 + Math.random() * 0.36),
                     q: 3, vol: p.vol, decay: 2.5 });
    },
  },
  'floater-hover': {
    label: 'FLOATER HOVER', group: 'Aliens', loop: true,
    params: {
      vol:   P(0.1, 0, 0.5, 0.01, 'Volume'),
      freq:  P(78, 30, 220, 2, 'Drone'),
      beat:  P(5.5, 0.5, 14, 0.5, 'Wobble'),
    },
    make(p, t, out) {
      // Two pitches a hair apart beat against each other, which is what makes
      // a drone sound alive rather than like a held note.
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(p.vol, t + 0.5);
      g.connect(out);
      const a = tone('sine', p.freq, p.freq, t, 3600);
      const b = tone('sine', p.freq * 1.012, p.freq * 1.012, t, 3600);
      // And a slow swell on top of the beating.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = p.beat;
      const lg = ctx.createGain();
      lg.gain.value = p.vol * 0.4;
      lfo.connect(lg); lg.connect(g.gain);
      lfo.start(t);
      a.connect(g); b.connect(g);
      return { stop: (at) => {
        g.gain.cancelScheduledValues(at);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
        a.stop(at + 0.35); b.stop(at + 0.35); lfo.stop(at + 0.35);
      } };
    },
  },
  'floater-blast': {
    label: 'FLOATER BLAST', group: 'Aliens',
    params: {
      vol:  P(0.3, 0, 1, 0.02, 'Volume'),
      from: P(900, 200, 3000, 25, 'From'),
      to:   P(140, 40, 800, 10, 'To'),
      dur:  P(0.32, 0.08, 0.8, 0.02, 'Length'),
    },
    make(p, t, out) {
      beep(out, t, { from: p.from, to: p.to, dur: p.dur, vol: p.vol, type: 'sawtooth' });
      beep(out, t, { from: p.from * 1.5, to: p.to * 1.4, dur: p.dur * 0.7,
                     vol: p.vol * 0.4, type: 'square' });
    },
  },
  'watcher-charge': {
    // The most important sound in the game: it is the only warning you get
    // before the Watcher fires, and its beam lands the instant it does.
    label: 'WATCHER CHARGING', group: 'Aliens',
    params: {
      vol:  P(0.26, 0, 0.8, 0.02, 'Volume'),
      from: P(150, 40, 600, 10, 'From'),
      to:   P(1500, 300, 4000, 50, 'To'),
      dur:  P(0.9, 0.2, 2.5, 0.05, 'Length'),
    },
    make(p, t, out) {
      const o = tone('sawtooth', p.from, p.to, t, p.dur);
      const f = filter('lowpass', 1200, 6);
      f.frequency.setValueAtTime(600, t);
      f.frequency.exponentialRampToValueAtTime(p.to * 2, t + p.dur);
      // Starts already audible and swells, rather than creeping up from
      // silence. An exponential ramp out of nothing spends almost all of its
      // length too quiet to hear, which for the one warning the game gives
      // you means it arrives a fifth of a second before the beam does.
      const g = ctx.createGain();
      g.gain.setValueAtTime(Math.max(0.0001, p.vol * 0.22), t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, p.vol), t + p.dur);
      g.gain.exponentialRampToValueAtTime(0.0001, t + p.dur + 0.06);
      o.connect(f); f.connect(g); g.connect(out);
    },
  },
  'watcher-beam': {
    label: 'WATCHER BEAM', group: 'Aliens',
    params: {
      vol: P(0.42, 0, 1, 0.02, 'Volume'),
      pitch: P(1700, 300, 5000, 50, 'Pitch'),
      dur: P(0.26, 0.05, 0.7, 0.01, 'Length'),
    },
    make(p, t, out) {
      beep(out, t, { from: p.pitch, to: p.pitch * 0.12, dur: p.dur,
                     vol: p.vol, type: 'square' });
      hiss(out, t, { dur: p.dur * 0.8, type: 'highpass', freq: 1800,
                     vol: p.vol * 0.5, decay: 1.6 });
    },
  },
  'brute-step': {
    label: 'BRUTE FOOTFALL', group: 'Aliens',
    params: {
      vol:  P(0.3, 0, 0.9, 0.02, 'Volume'),
      freq: P(58, 25, 140, 2, 'Weight'),
      grit: P(0.12, 0, 0.5, 0.01, 'Grit'),
    },
    make(p, t, out) {
      thump(out, t, { freq: p.freq, dur: 0.17, vol: p.vol, to: 20 });
      hiss(out, t, { dur: 0.06, freq: 900, q: 1, vol: p.grit, decay: 2 });
    },
  },
  'brute-slam': {
    label: 'BRUTE SLAM', group: 'Aliens',
    params: {
      vol:    P(0.6, 0, 1.2, 0.02, 'Volume'),
      freq:   P(70, 25, 160, 5, 'Weight'),
      debris: P(0.3, 0, 1, 0.02, 'Debris'),
    },
    make(p, t, out) {
      thump(out, t, { freq: p.freq, dur: 0.34, vol: p.vol, to: 15 });
      hiss(out, t, { dur: 0.22, type: 'lowpass', freq: 1400,
                     vol: p.debris, decay: 1.4 });
    },
  },
  'alien-hit': {
    label: 'HITTING AN ALIEN', group: 'Aliens',
    params: {
      vol:  P(0.2, 0, 0.7, 0.01, 'Volume'),
      freq: P(420, 100, 1500, 10, 'Pitch'),
      dur:  P(0.09, 0.02, 0.25, 0.005, 'Length'),
    },
    make(p, t, out) {
      // Wet rather than metallic: lowpassed noise, no ring to it.
      hiss(out, t, { dur: p.dur, type: 'lowpass', freq: p.freq * 3,
                     vol: p.vol, decay: 2 });
      thump(out, t, { freq: p.freq, dur: p.dur, vol: p.vol * 0.5, to: 60 });
    },
  },
  'alien-death': {
    label: 'ALIEN DYING', group: 'Aliens',
    params: {
      vol:  P(0.3, 0, 0.9, 0.02, 'Volume'),
      from: P(520, 100, 1600, 10, 'From'),
      dur:  P(0.5, 0.1, 1.2, 0.05, 'Length'),
    },
    make(p, t, out) {
      beep(out, t, { from: p.from, to: p.from * 0.18, dur: p.dur,
                     vol: p.vol, type: 'sawtooth' });
      hiss(out, t + p.dur * 0.3, { dur: p.dur * 0.6, type: 'lowpass',
                                   freq: 800, vol: p.vol * 0.5, decay: 1.5 });
    },
  },

  // ─── THE STATION ──────────────────────────────────────────
  'footstep': {
    label: 'YOUR FOOTSTEPS', group: 'Station',
    params: {
      vol:  P(0.1, 0, 0.5, 0.01, 'Volume'),
      freq: P(85, 35, 200, 5, 'Weight'),
      grit: P(0.07, 0, 0.3, 0.01, 'Grit'),
    },
    make(p, t, out) {
      thump(out, t, { freq: p.freq, dur: 0.1, vol: p.vol, to: 30 });
      hiss(out, t, { dur: 0.04, freq: 1600, q: 1, vol: p.grit, decay: 2.5 });
    },
  },
  'breach': {
    label: 'HULL BREACH', group: 'Station', loop: true,
    params: {
      vol:  P(0.18, 0, 0.6, 0.01, 'Volume'),
      tone: P(500, 100, 2500, 50, 'Tone'),
    },
    make(p, t, out) {
      // Air leaving, forever. One long noise buffer on repeat.
      const n = noise(2, 0);
      n.loop = true;
      const f = filter('highpass', p.tone, 0.7);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(p.vol, t + 0.4);
      n.connect(f); f.connect(g); g.connect(out);
      n.start(t);
      return { stop: (at) => {
        g.gain.cancelScheduledValues(at);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.4);
        n.stop(at + 0.45);
      } };
    },
  },
  'door-grind': {
    label: 'THE LOCKED DOOR', group: 'Station',
    params: {
      vol:  P(0.4, 0, 1, 0.02, 'Volume'),
      freq: P(55, 20, 160, 5, 'Grind'),
      dur:  P(2.2, 0.5, 5, 0.1, 'Length'),
    },
    make(p, t, out) {
      // Something very heavy that has not moved in a long time.
      const o = tone('sawtooth', p.freq, p.freq * 0.7, t, p.dur);
      const f = filter('lowpass', 320, 4);
      const g = env(p.vol, t, p.dur, 0.3);
      o.connect(f); f.connect(g); g.connect(out);
      for (let i = 0; i < 9; i++) {
        hiss(out, t + 0.15 + (i / 9) * p.dur * 0.85,
             { dur: 0.11, type: 'bandpass', freq: 420 + Math.random() * 900,
               q: 2, vol: p.vol * 0.3, decay: 1.5 });
      }
    },
  },
  'space-door': {
    label: 'SPACE DOOR', group: 'Station',
    params: {
      vol: P(0.35, 0, 1, 0.02, 'Volume'),
      dur: P(1.3, 0.3, 3, 0.1, 'Length'),
    },
    make(p, t, out) {
      hiss(out, t, { dur: p.dur, type: 'bandpass', freq: 1500, q: 0.8,
                     vol: p.vol, decay: 0.8 });
      thump(out, t + p.dur * 0.8, { freq: 110, dur: 0.2, vol: p.vol * 0.9 });
    },
  },
  'pod-launch': {
    label: 'ESCAPE POD', group: 'Station',
    params: {
      vol: P(0.6, 0, 1.2, 0.02, 'Volume'),
      dur: P(2.4, 0.6, 5, 0.1, 'Length'),
    },
    make(p, t, out) {
      thump(out, t, { freq: 120, dur: 0.4, vol: p.vol, to: 30 });
      const n = noise(p.dur, 0.5);
      const f = filter('lowpass', 600, 1);
      f.frequency.setValueAtTime(400, t);
      f.frequency.exponentialRampToValueAtTime(3000, t + p.dur * 0.6);
      f.frequency.exponentialRampToValueAtTime(300, t + p.dur);
      const g = env(p.vol, t, p.dur, 0.25);
      n.connect(f); f.connect(g); g.connect(out);
      n.start(t); n.stop(t + p.dur + 0.02);
    },
  },

  // ─── THE BOSSES ───────────────────────────────────────────
  'boss-roar': {
    label: 'BOSS ARRIVES', group: 'Bosses',
    params: {
      vol:  P(0.55, 0, 1.2, 0.02, 'Volume'),
      freq: P(110, 30, 400, 5, 'Pitch'),
      dur:  P(1.5, 0.3, 3.5, 0.1, 'Length'),
    },
    make(p, t, out) {
      // Three detuned saws. One is a note; three is a throat.
      for (const d of [1, 1.011, 0.992]) {
        beep(out, t, { from: p.freq * d, to: p.freq * d * 0.55, dur: p.dur,
                       vol: p.vol * 0.4, type: 'sawtooth' });
      }
      hiss(out, t, { dur: p.dur * 0.8, type: 'lowpass', freq: 700,
                     vol: p.vol * 0.35, decay: 1.1 });
    },
  },
  'boss-hit': {
    label: 'HITTING A BOSS', group: 'Bosses',
    params: {
      vol:  P(0.26, 0, 0.8, 0.02, 'Volume'),
      freq: P(1300, 300, 4000, 50, 'Ring'),
      dur:  P(0.16, 0.03, 0.5, 0.01, 'Length'),
    },
    make(p, t, out) {
      // Armour, so this one DOES ring where an alien hit does not.
      hiss(out, t, { dur: p.dur, freq: p.freq, q: 6, vol: p.vol, decay: 2 });
      beep(out, t, { from: p.freq * 0.5, to: p.freq * 0.44, dur: p.dur * 1.4,
                     vol: p.vol * 0.3, type: 'triangle' });
    },
  },
  'boss-death': {
    label: 'BOSS DYING', group: 'Bosses',
    params: {
      vol: P(0.75, 0, 1.3, 0.02, 'Volume'),
      dur: P(2.6, 0.8, 5, 0.1, 'Length'),
    },
    make(p, t, out) {
      for (const d of [1, 0.985, 1.02]) {
        beep(out, t, { from: 150 * d, to: 26 * d, dur: p.dur,
                       vol: p.vol * 0.35, type: 'sawtooth' });
      }
      const n = noise(p.dur, 0.8);
      const f = filter('lowpass', 1800, 0.7);
      f.frequency.setValueAtTime(1800, t);
      f.frequency.exponentialRampToValueAtTime(90, t + p.dur);
      const g = env(p.vol * 0.6, t, p.dur, 0.05);
      n.connect(f); f.connect(g); g.connect(out);
      n.start(t); n.stop(t + p.dur + 0.02);
    },
  },

  // ─── MOMENTS ──────────────────────────────────────────────
  'player-hurt': {
    label: 'TAKING A HIT', group: 'Moments',
    params: {
      vol:  P(0.34, 0, 1, 0.02, 'Volume'),
      freq: P(160, 50, 500, 5, 'Pitch'),
    },
    make(p, t, out) {
      thump(out, t, { freq: p.freq, dur: 0.26, vol: p.vol, to: 40 });
      hiss(out, t, { dur: 0.1, type: 'lowpass', freq: 500,
                     vol: p.vol * 0.5, decay: 2 });
    },
  },
  'death': {
    label: 'DYING', group: 'Moments',
    params: {
      vol: P(0.42, 0, 1, 0.02, 'Volume'),
      dur: P(1.9, 0.5, 4, 0.1, 'Length'),
    },
    make(p, t, out) {
      // Two notes falling a long way, slowly. Nothing else.
      beep(out, t, { from: 330, to: 72, dur: p.dur, vol: p.vol, type: 'sine' });
      beep(out, t + 0.12, { from: 247, to: 54, dur: p.dur,
                            vol: p.vol * 0.7, type: 'sine' });
    },
  },
  'escape': {
    label: 'GETTING OUT', group: 'Moments',
    params: {
      vol: P(0.4, 0, 1, 0.02, 'Volume'),
      pace: P(0.17, 0.05, 0.5, 0.01, 'Pace'),
    },
    make(p, t, out) {
      // Four notes going up. The only unambiguously happy sound in the game.
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => {
        beep(out, t + i * p.pace, { from: f, dur: i === 3 ? 0.8 : 0.26,
                                    vol: p.vol, type: 'sine' });
        beep(out, t + i * p.pace, { from: f * 2, dur: 0.2,
                                    vol: p.vol * 0.2, type: 'sine' });
      });
    },
  },
  'pickup': {
    label: 'TAKING THE STASH', group: 'Moments',
    params: { vol: P(0.3, 0, 1, 0.02, 'Volume') },
    make(p, t, out) {
      beep(out, t, { from: 660, dur: 0.1, vol: p.vol, type: 'sine' });
      beep(out, t + 0.09, { from: 990, dur: 0.18, vol: p.vol, type: 'sine' });
    },
  },
  'soldier-freed': {
    label: 'FREEING THE SOLDIER', group: 'Moments',
    params: { vol: P(0.3, 0, 1, 0.02, 'Volume') },
    make(p, t, out) {
      hiss(out, t, { dur: 0.16, freq: 2200, q: 2, vol: p.vol * 0.5, decay: 1.8 });
      beep(out, t + 0.1, { from: 392, to: 587, dur: 0.3, vol: p.vol, type: 'triangle' });
    },
  },
  'unlock': {
    label: 'UNLOCKING SOMETHING', group: 'Moments',
    params: { vol: P(0.34, 0, 1, 0.02, 'Volume') },
    make(p, t, out) {
      [523, 698, 880].forEach((f, i) => {
        beep(out, t + i * 0.1, { from: f, dur: i === 2 ? 0.5 : 0.14,
                                 vol: p.vol, type: 'triangle' });
      });
    },
  },
  'outpost-clear': {
    label: 'OUTPOST CLEARED', group: 'Moments',
    params: { vol: P(0.3, 0, 1, 0.02, 'Volume') },
    make(p, t, out) {
      beep(out, t, { from: 440, dur: 0.13, vol: p.vol, type: 'square' });
      beep(out, t + 0.14, { from: 587, dur: 0.3, vol: p.vol, type: 'square' });
    },
  },
};

// ─── THE NUMBERS, AND KEEPING THEM ──────────────────────────
// CFG holds what every knob is set to right now. It starts at the defaults
// above, then anything you changed on the soundboard is laid over the top.
const SAVE_KEY = 'falo3d2.sound';

function defaults() {
  const out = { master: { vol: 0.75 } };
  for (const id of Object.keys(SOUNDS)) {
    out[id] = {};
    for (const [k, spec] of Object.entries(SOUNDS[id].params)) out[id][k] = spec.def;
  }
  return out;
}

const CFG = defaults();

export function loadSavedSound() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    // Laid over one key at a time rather than wholesale: a sound added after
    // you last saved should arrive at ITS default, not as undefined.
    for (const id of Object.keys(CFG)) {
      if (!saved[id]) continue;
      for (const k of Object.keys(CFG[id])) {
        if (typeof saved[id][k] === 'number') CFG[id][k] = saved[id][k];
      }
    }
  } catch (e) { /* no save, no matter */ }
}

export function saveSound() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(CFG)); } catch (e) { /* ditto */ }
}

export function resetSound() {
  const d = defaults();
  for (const id of Object.keys(CFG)) Object.assign(CFG[id], d[id]);
  if (master) master.gain.value = CFG.master.vol;
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ditto */ }
}

export function soundValue(id, key) { return CFG[id][key]; }

export function setSoundValue(id, key, value) {
  CFG[id][key] = value;
  if (id === 'master') setMasterVolume(value);
}

/** What the soundboard's COPY button hands you, ready to paste back to me. */
export function soundJSON() { return JSON.stringify(CFG, null, 2); }

// ─── PLAYING THEM ───────────────────────────────────────────

/**
 * How loud a thing is from over there.
 *
 * Without this every Crawler in the station is as loud as the one biting you,
 * and with eight to an outpost that is just noise. Beyond `far` it is not
 * worth the oscillators, so it is not played at all.
 */
const FAR = 34;
function distanceGain(dist) {
  if (dist == null) return 1;
  if (dist >= FAR) return 0;
  const d = Math.max(1, dist);
  return Math.min(1, 1 / (1 + (d / 7) * (d / 7)));
}

/**
 * Play one sound.
 *
 * `dist` is how far away whatever made it is; `gain` scales it on top of
 * that; `rate` is unused for now and reserved for pitch variation.
 */
export function playSound(id, opts = {}) {
  if (!ctx || !SOUNDS[id]) return;
  const far = distanceGain(opts.dist);
  if (far <= 0.015) return;
  const level = far * (opts.gain != null ? opts.gain : 1);
  if (level <= 0.015) return;

  const out = ctx.createGain();
  out.gain.value = level;
  out.connect(master);
  try {
    SOUNDS[id].make(CFG[id], ctx.currentTime + 0.001, out);
  } catch (e) {
    // A bad number out of the soundboard should cost you one sound, not the
    // frame it was played on.
    if (!playSound.warned) { playSound.warned = true; console.warn('sound', id, e); }
  }
}

/** Start a sound that keeps going. Starting one already running does nothing. */
export function startLoop(id, opts = {}) {
  if (!ctx || !SOUNDS[id] || loops.has(id)) return;
  const out = ctx.createGain();
  out.gain.value = opts.gain != null ? opts.gain : 1;
  out.connect(master);
  try {
    const voice = SOUNDS[id].make(CFG[id], ctx.currentTime + 0.001, out);
    if (voice && voice.stop) loops.set(id, { voice, out });
  } catch (e) { console.warn('loop', id, e); }
}

export function stopLoop(id) {
  const held = loops.get(id);
  if (!held) return;
  loops.delete(id);
  try { held.voice.stop(ctx.currentTime); } catch (e) { /* already gone */ }
}

export function loopRunning(id) { return loops.has(id); }

/** Everything quiet — used when a run ends and when the world freezes. */
export function stopAllLoops() {
  for (const id of [...loops.keys()]) stopLoop(id);
}

/** Set a running loop's volume, for a drone that should fade with distance. */
export function setLoopGain(id, gain) {
  const held = loops.get(id);
  if (held) held.out.gain.value = gain;
}
