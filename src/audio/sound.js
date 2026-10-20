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

/**
 * A number nudged up or down a little, differently every time.
 *
 * Used on the sounds you hear most — a hit is heard on every single round
 * that connects, and the same recording forty times in ten seconds reads as
 * a machine rather than a creature. A few per cent is enough.
 */
function vary(v, amt) { return v * (1 + (Math.random() * 2 - 1) * amt); }

/** Vibrato: a slow wobble laid over a pitch, which is most of what makes a
 *  voice sound like a throat instead of an oscillator. */
function warble(osc, t, dur, rate, depth) {
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = rate;
  const g = ctx.createGain();
  g.gain.value = depth;
  lfo.connect(g); g.connect(osc.frequency);
  lfo.start(t); lfo.stop(t + dur + 0.02);
}

/**
 * A VOICE.
 *
 * FLETCHER: this is the one that makes something say "argh" instead of just
 * making a noise, and it is worth knowing how it works because every grunt,
 * moan and screech in the game is this same function with different numbers.
 *
 * A throat is two things. The cords make a buzz — one flat, ugly pitch, the
 * sawtooth here. The mouth then puts a SHAPE over that buzz: two or three
 * loud spots at particular frequencies, called formants. The buzz decides
 * the note; the formants decide the vowel. Move the formants and the same
 * note turns from "oo" into "ah" without the pitch changing at all.
 *
 * So each vowel below is just a pair of numbers:
 *
 *   oo  300 / 870     as in oof
 *   oh  450 / 800
 *   uh  640 / 1190
 *   ah  730 / 1090    as in argh
 *   ee  270 / 2300    thin and sharp, which is why it suits the aliens
 *
 * `rasp` adds breath, which is the difference between singing and shouting.
 * `shake` is a wobble on the pitch — nothing alive holds a note perfectly
 * still, and a tiny amount of it is most of what sells a voice as a throat
 * rather than an oscillator.
 */
const VOWEL = {
  oo: [[300, 1, 9], [870, 0.45, 8]],
  oh: [[450, 1, 8], [800, 0.5, 8]],
  uh: [[640, 1, 7], [1190, 0.4, 7]],
  ah: [[730, 1, 7], [1090, 0.6, 7], [2440, 0.14, 9]],
  er: [[490, 1, 7], [1350, 0.5, 7]],
  ee: [[270, 1, 9], [2300, 0.6, 8]],
};

function voice(out, t, opts) {
  const { pitch, to, dur, vol, vowel = 'ah', vowel2, rasp = 0, shake = 0,
          rate = 6, type = 'sawtooth' } = opts;
  const end = to != null ? to : pitch;
  const o = tone(type, pitch, end, t, dur);
  if (shake > 0) warble(o, t, dur, rate, pitch * shake);

  const g = env(vol, t, dur, Math.min(0.05, dur * 0.25));
  g.connect(out);

  // The mouth. Each formant is a narrow band tapped off the same cords, so
  // they all move together when the pitch slides — which is what keeps it
  // one voice rather than a chord.
  const shape = VOWEL[vowel] || VOWEL.ah;
  const shape2 = vowel2 ? (VOWEL[vowel2] || null) : null;
  shape.forEach(([f, lvl, q], i) => {
    const bp = filter('bandpass', f, q);
    // A vowel that MOVES — "argh" is an ah sliding into an er — is the
    // difference between a word and a held note.
    if (shape2 && shape2[i]) {
      bp.frequency.setValueAtTime(f, t);
      bp.frequency.linearRampToValueAtTime(shape2[i][0], t + dur * 0.8);
    }
    const fg = ctx.createGain();
    // Makeup. A narrow band throws away nearly everything that is not sitting
    // on its centre, and a sawtooth's upper harmonics are already quiet, so
    // formants come out far weaker than the tone that went in — the first
    // version of the Puppet Master's scream measured at a twentieth of the
    // explosion it was supposed to be competing with.
    fg.gain.value = lvl * 3.2;
    o.connect(bp); bp.connect(fg); fg.connect(g);
  });

  // Breath through the same mouth shape, so a shout is still the same voice.
  if (rasp > 0) {
    const n = noise(dur, 1);
    const bp = filter('bandpass', shape[0][0] * 1.6, 2.5);
    const ng = env(vol * rasp * 0.7, t, dur, 0.02);
    n.connect(bp); bp.connect(ng); ng.connect(out);
    n.start(t); n.stop(t + dur + 0.02);
  }
  return o;
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
    label: 'ALIEN HIT — MOAN', group: 'Aliens',
    params: {
      vol:    P(0.26, 0, 0.9, 0.02, 'Volume'),
      pitch:  P(104, 50, 260, 2, 'Voice'),
      groan:  P(0.55, 0, 1, 0.05, 'Rasp'),
      smack:  P(0.4, 0, 1, 0.05, 'Impact'),
      spread: P(0.16, 0, 0.5, 0.02, 'Variation'),
      dur:    P(0.42, 0.1, 1, 0.02, 'Length'),
    },
    make(p, t, out) {
      const f = vary(p.pitch, p.spread);
      // A low, wet moan that sags as it goes — the pitch drifting DOWN and
      // the vowel opening from "oh" into "uh" is what makes it a thing that
      // has been hurt rather than a thing that is humming.
      voice(out, t, { pitch: f, to: f * 0.72, dur: p.dur, vol: p.vol,
                      vowel: 'oh', vowel2: 'uh',
                      rasp: p.groan, shake: 0.05, rate: 4.5 });
      // The round going in, underneath it.
      thump(out, t, { freq: f * 3.4, dur: 0.1, vol: p.vol * p.smack, to: 60 });
      hiss(out, t, { dur: 0.08, type: 'lowpass', freq: 1300,
                     vol: p.vol * p.smack * 0.7, decay: 2.2 });
    },
  },
  'alien-death': {
    label: 'ALIEN DYING — SCREECH', group: 'Aliens',
    params: {
      vol:    P(0.85, 0, 1.8, 0.02, 'Volume'),
      from:   P(760, 150, 2000, 10, 'From'),
      shake:  P(26, 0, 90, 1, 'Warble'),
      snarl:  P(0.5, 0, 1, 0.05, 'Snarl'),
      spread: P(0.13, 0, 0.5, 0.02, 'Variation'),
      dur:    P(0.78, 0.15, 1.8, 0.05, 'Length'),
    },
    make(p, t, out) {
      // Loud, and nothing like the moan: it goes UP before it goes down, and
      // it is a thin "ee" throat rather than a round one, which is what
      // makes it read as alien instead of as a person being hurt.
      const f = vary(p.from, p.spread);
      voice(out, t, { pitch: f * 0.75, to: f * 0.1, dur: p.dur, vol: p.vol,
                      vowel: 'ee', vowel2: 'ah',
                      rasp: p.snarl, shake: 0.06, rate: p.shake * 0.5 });
      // A second throat a fifth up that gives out first.
      voice(out, t + 0.03, { pitch: f * 1.49, to: f * 0.3, dur: p.dur * 0.72,
                             vol: p.vol * 0.45, vowel: 'ee',
                             rasp: p.snarl * 0.6, shake: 0.07,
                             rate: p.shake * 0.73 });
      // And the last of the air.
      hiss(out, t + p.dur * 0.5, { dur: p.dur * 0.55, type: 'lowpass',
                                   freq: 900, vol: p.vol * 0.4, decay: 1.3 });
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
  // One voice each. They are the same throat with different numbers, and
  // the numbers are chosen so you can tell WHICH of them you are fighting
  // with your eyes shut.
  'boss-hit-burrower': {
    label: 'BURROWER HIT', group: 'Bosses',
    params: {
      vol:    P(0.4, 0, 1.2, 0.02, 'Volume'),
      pitch:  P(78, 30, 220, 2, 'Voice'),
      earth:  P(0.6, 0, 1.2, 0.05, 'Earth'),
      spread: P(0.1, 0, 0.4, 0.02, 'Variation'),
      dur:    P(0.6, 0.15, 1.4, 0.05, 'Length'),
    },
    make(p, t, out) {
      // The deepest of the four, because it comes up through the floor.
      const f = vary(p.pitch, p.spread);
      voice(out, t, { pitch: f, to: f * 0.6, dur: p.dur, vol: p.vol,
                      vowel: 'oh', vowel2: 'uh', rasp: 0.6, shake: 0.04,
                      rate: 5 });
      thump(out, t, { freq: 48, dur: p.dur * 0.8, vol: p.vol * p.earth, to: 16 });
      // Dirt and plating coming loose with it.
      hiss(out, t, { dur: p.dur * 0.5, type: 'lowpass', freq: 600,
                     vol: p.vol * p.earth * 0.45, decay: 1.4 });
    },
  },
  'boss-hit-twins': {
    label: 'TWINS HIT', group: 'Bosses',
    params: {
      vol:    P(0.34, 0, 1.2, 0.02, 'Volume'),
      pitch:  P(300, 120, 900, 5, 'Voice'),
      apart:  P(0.035, 0, 0.15, 0.005, 'Detune'),
      gap:    P(0.05, 0, 0.3, 0.01, 'Gap'),
      dur:    P(0.42, 0.1, 1, 0.02, 'Length'),
    },
    make(p, t, out) {
      // Two of them, and that IS the sound: the same cry twice, a hair apart
      // in pitch and a hair apart in time. Hurt one and you hear both.
      const f = vary(p.pitch, 0.06);
      voice(out, t, { pitch: f, to: f * 0.72, dur: p.dur, vol: p.vol * 0.75,
                      vowel: 'ee', rasp: 0.35, shake: 0.05, rate: 9 });
      voice(out, t + p.gap, { pitch: f * (1 + p.apart), to: f * 0.68,
                              dur: p.dur * 0.9, vol: p.vol * 0.75,
                              vowel: 'ee', rasp: 0.35, shake: 0.05, rate: 11 });
    },
  },
  'boss-hit-puppet_master': {
    label: 'PUPPET MASTER HIT', group: 'Bosses',
    params: {
      vol:    P(0.85, 0, 1.6, 0.02, 'Volume'),
      pitch:  P(620, 200, 1800, 10, 'Voice'),
      shriek: P(0.6, 0, 1, 0.05, 'Shriek'),
      metal:  P(0.3, 0, 1, 0.05, 'Rig'),
      dur:    P(0.36, 0.1, 1, 0.02, 'Length'),
    },
    make(p, t, out) {
      // The highest and nastiest — it goes UP when it is hurt, which is the
      // opposite of everything else in the game and reads as rage.
      const f = vary(p.pitch, 0.08);
      voice(out, t, { pitch: f, to: f * 1.45, dur: p.dur, vol: p.vol,
                      vowel: 'ee', rasp: p.shriek, shake: 0.07, rate: 14 });
      // Its rig taking the hit, a beat behind the voice.
      hiss(out, t + 0.02, { dur: p.dur * 0.7, freq: 2600, q: 7,
                            vol: p.vol * p.metal, decay: 2 });
    },
  },
  'boss-hit-swarm': {
    label: 'SWARM HIT', group: 'Bosses',
    params: {
      vol:    P(0.9, 0, 1.8, 0.02, 'Volume'),
      pitch:  P(520, 150, 1600, 10, 'Voice'),
      many:   P(6, 2, 14, 1, 'How many'),
      chitter: P(0.5, 0, 1, 0.05, 'Chitter'),
      dur:    P(0.34, 0.1, 1, 0.02, 'Length'),
    },
    make(p, t, out) {
      // Not one voice but a crowd of small ones, each slightly off the next.
      // Hurting a swarm should sound like hurting a hundred things at once.
      const n = Math.round(p.many);
      for (let i = 0; i < n; i++) {
        const f = vary(p.pitch, 0.3);
        voice(out, t + Math.random() * p.dur * 0.4,
              { pitch: f, to: f * (0.7 + Math.random() * 0.5),
                dur: p.dur * (0.4 + Math.random() * 0.5),
                vol: (p.vol / Math.sqrt(n)) * (0.6 + Math.random() * 0.6),
                vowel: 'ee', rasp: 0.3, shake: 0.08, rate: 12 + Math.random() * 10 });
      }
      // The dry rattle of all of them moving at once.
      hiss(out, t, { dur: p.dur, type: 'bandpass', freq: 3400, q: 1.4,
                     vol: p.vol * p.chitter * 0.5, decay: 1.4 });
    },
  },
  'boss-explode': {
    label: 'BOSS DIES — EXPLODES', group: 'Bosses',
    params: {
      vol:    P(0.62, 0, 1.4, 0.02, 'Volume'),
      sub:    P(0.6, 0, 1.4, 0.05, 'Sub'),
      subHz:  P(58, 25, 140, 2, 'Sub Hz'),
      debris: P(0.6, 0, 1.2, 0.05, 'Debris'),
      dur:    P(1.5, 0.4, 3.5, 0.1, 'Length'),
    },
    make(p, t, out) {
      // The Burrower and the Twins go up rather than down. Same shape as a
      // grenade but three times the size and much longer in the tail — you
      // should feel this one through the floor.
      const n = noise(p.dur, 0.9);
      const f = filter('lowpass', 3600, 0.8);
      f.frequency.setValueAtTime(4000, t);
      f.frequency.exponentialRampToValueAtTime(90, t + p.dur);
      const g = env(p.vol, t, p.dur, 0.006);
      n.connect(f); f.connect(g); g.connect(out);
      n.start(t); n.stop(t + p.dur + 0.02);
      thump(out, t, { freq: p.subHz, dur: p.dur * 0.75, vol: p.sub, to: 12 });
      thump(out, t + 0.05, { freq: p.subHz * 1.7, dur: 0.4,
                             vol: p.sub * 0.5, to: 20 });
      // Everything it was made of coming down over the next second.
      const bits = Math.round(8 + p.debris * 10);
      for (let i = 0; i < bits; i++) {
        const at = t + 0.08 + Math.random() * p.dur * 0.75;
        hiss(out, at, { dur: 0.07, type: 'bandpass',
                        freq: 900 + Math.random() * 3200, q: 2.5,
                        vol: p.debris * (0.2 + Math.random() * 0.5), decay: 2.5 });
        if (Math.random() < 0.4) {
          thump(out, at, { freq: 55 + Math.random() * 70, dur: 0.25,
                           vol: p.debris * 0.3, to: 18 });
        }
      }
    },
  },
  'boss-scream': {
    label: 'BOSS DIES — SCREAMS', group: 'Bosses',
    params: {
      vol:    P(1.5, 0, 2.4, 0.02, 'Volume'),
      from:   P(700, 150, 2000, 10, 'From'),
      throats: P(3, 1, 6, 1, 'Throats'),
      snarl:  P(0.6, 0, 1, 0.05, 'Snarl'),
      dur:    P(2.6, 0.8, 5, 0.1, 'Length'),
    },
    make(p, t, out) {
      // The Puppet Master and the Swarm do not explode — they scream, and it
      // is the loudest thing in the game. Several throats, each starting a
      // little after the last and each giving out at its own moment, so it
      // comes apart rather than stopping.
      const n = Math.round(p.throats);
      for (let i = 0; i < n; i++) {
        const f = vary(p.from * (1 - i * 0.18), 0.07);
        const d = p.dur * (0.6 + Math.random() * 0.4);
        voice(out, t + i * 0.09, {
          pitch: f, to: f * 0.08, dur: d,
          vol: (p.vol / Math.sqrt(n)) * 0.9,
          vowel: 'ee', vowel2: 'ah', rasp: p.snarl,
          shake: 0.07, rate: 9 + Math.random() * 8,
        });
      }
      // The body going over at the end of it.
      hiss(out, t + p.dur * 0.45, { dur: p.dur * 0.55, type: 'lowpass',
                                    freq: 800, vol: p.vol * 0.4, decay: 1.2 });
      thump(out, t + p.dur * 0.88, { freq: 52, dur: 0.6, vol: p.vol * 0.6, to: 14 });
    },
  },

  // ─── MOMENTS ──────────────────────────────────────────────
  // ─── THE SOLDIER'S OWN VOICE ──────────────────────────────
  // Three of them, and the game picks one at random each time you are hit,
  // so taking fire sounds like a person rather than a doorbell. Each is the
  // same throat — see voice() — saying a different thing.
  'hurt-oof': {
    label: 'HIT — "OOF"', group: 'Moments',
    params: {
      vol:    P(0.42, 0, 1, 0.02, 'Volume'),
      pitch:  P(132, 70, 260, 2, 'Voice'),
      thud:   P(0.4, 0, 1, 0.05, 'Impact'),
      spread: P(0.08, 0, 0.3, 0.01, 'Variation'),
      dur:    P(0.26, 0.1, 0.6, 0.02, 'Length'),
    },
    make(p, t, out) {
      const f = vary(p.pitch, p.spread);
      // "oo", punched out of you and falling.
      voice(out, t, { pitch: f * 1.05, to: f * 0.74, dur: p.dur, vol: p.vol,
                      vowel: 'oo', rasp: 0.35, shake: 0.02 });
      // ...and the "f" on the end, which is what stops it being "oo".
      hiss(out, t + p.dur * 0.72, { dur: 0.1, type: 'highpass', freq: 2600,
                                    vol: p.vol * 0.3, decay: 1.6 });
      thump(out, t, { freq: 150, dur: 0.2, vol: p.vol * p.thud, to: 40 });
    },
  },
  'hurt-argh': {
    label: 'HIT — "ARGH"', group: 'Moments',
    params: {
      vol:    P(0.32, 0, 1, 0.02, 'Volume'),
      pitch:  P(124, 70, 260, 2, 'Voice'),
      growl:  P(0.55, 0, 1, 0.05, 'Growl'),
      thud:   P(0.35, 0, 1, 0.05, 'Impact'),
      spread: P(0.08, 0, 0.3, 0.01, 'Variation'),
      dur:    P(0.46, 0.15, 1, 0.02, 'Length'),
    },
    make(p, t, out) {
      const f = vary(p.pitch, p.spread);
      // The longest of the three, and the only one that is a complaint
      // rather than a reflex: "ah" sliding into "er", with the throat in it.
      voice(out, t, { pitch: f * 1.12, to: f * 0.68, dur: p.dur, vol: p.vol,
                      vowel: 'ah', vowel2: 'er',
                      rasp: p.growl, shake: 0.035, rate: 7 });
      thump(out, t, { freq: 140, dur: 0.2, vol: p.vol * p.thud, to: 40 });
    },
  },
  'hurt-ah': {
    label: 'HIT — "AH"', group: 'Moments',
    params: {
      vol:    P(0.3, 0, 1, 0.02, 'Volume'),
      pitch:  P(146, 70, 280, 2, 'Voice'),
      thud:   P(0.35, 0, 1, 0.05, 'Impact'),
      spread: P(0.09, 0, 0.3, 0.01, 'Variation'),
      dur:    P(0.2, 0.08, 0.5, 0.02, 'Length'),
    },
    make(p, t, out) {
      const f = vary(p.pitch, p.spread);
      // Short and surprised — it goes UP first, which is what makes it a
      // yelp instead of a groan.
      voice(out, t, { pitch: f * 1.22, to: f * 0.9, dur: p.dur, vol: p.vol,
                      vowel: 'ah', rasp: 0.25, shake: 0.02 });
      thump(out, t, { freq: 155, dur: 0.16, vol: p.vol * p.thud, to: 45 });
    },
  },
  'death': {
    label: 'DYING — WAH WAH WAHHH', group: 'Moments',
    params: {
      vol:   P(0.4, 0, 1, 0.02, 'Volume'),
      pitch: P(262, 120, 500, 2, 'Pitch'),
      pace:  P(0.34, 0.12, 0.8, 0.02, 'Pace'),
      wah:   P(0.6, 0, 1, 0.05, 'Wah'),
      last:  P(1.5, 0.4, 3.5, 0.1, 'Last note'),
    },
    make(p, t, out) {
      // Four notes down, the last one held and sliding into the floor.
      //
      // The "wah" is a plunger mute: a lowpass that opens as the note starts
      // and closes again as it ends. That sweep IS the sound — the same four
      // notes without it are just a sad little tune, and with it they are a
      // trombone telling you that you have died.
      const steps = [1, 0.944, 0.891, 0.841];
      steps.forEach((m, i) => {
        const last = i === 3;
        const at = t + i * p.pace;
        const d = last ? p.last : p.pace * 0.92;
        const f = p.pitch * m;
        // A trombone slides between notes rather than jumping; the last one
        // slides a very long way.
        const o = tone('sawtooth', f, last ? f * 0.45 : f * 0.955, at, d);
        const lp = filter('lowpass', 500, 4.5);
        lp.frequency.setValueAtTime(380, at);
        lp.frequency.linearRampToValueAtTime(380 + p.wah * 2400, at + d * 0.3);
        lp.frequency.linearRampToValueAtTime(300, at + d);
        const g = env(p.vol, at, d, 0.035);
        o.connect(lp); lp.connect(g); g.connect(out);
        // A little brass buzz on top, which is what keeps it from sounding
        // like an organ.
        const b = tone('square', f * 2, last ? f * 0.9 : f * 1.91, at, d * 0.8);
        const bg = env(p.vol * 0.12, at, d * 0.8, 0.04);
        b.connect(lp); bg.connect(g);
        b.connect(bg);
      });
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
  // One key per character of the caption on the way down. It fires about
  // twenty-six times a second, so it has to be quiet and it has to not be
  // identical every time — the pitch wanders a little, which is the whole
  // difference between a keyboard and a smoke alarm.
  'type-key': {
    label: 'CAPTION TYPING', group: 'Moments',
    params: {
      vol: P(0.2, 0, 0.6, 0.01, 'Volume'),
      tone: P(2300, 700, 5000, 50, 'Click pitch'),
    },
    make(p, t, out) {
      hiss(out, t, { dur: 0.028, freq: vary(p.tone, 0.18), q: 2.4,
                     vol: p.vol, decay: 3.2 });
      hiss(out, t + 0.004, { dur: 0.05, type: 'lowpass', freq: vary(430, 0.15),
                             vol: p.vol * 0.45, decay: 2.6 });
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

  // ─── HOW YOU GOT HERE ─────────────────────────────────────
  // The two sounds the opening cutscene needs, and the only two in the game
  // that nothing but a cutscene ever plays.
  'rotor': {
    // A helicopter is one noise cut into slices. The air through the blades
    // is the noise; the blades themselves are an LFO chopping its volume
    // five or six times a second. Take the chop away and you have wind.
    label: 'HELICOPTER', group: 'Moments', loop: true,
    params: {
      vol:   P(0.5, 0, 1.2, 0.01, 'Volume'),
      chop:  P(5.6, 2, 14, 0.1, 'Blade chop'),
      whine: P(760, 200, 2400, 10, 'Turbine'),
    },
    make(p, t, out) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(p.vol, t + 0.7);
      g.connect(out);

      const n = noise(2, 0);
      n.loop = true;
      const lp = filter('lowpass', 430, 1.1);
      // The chop. Base below one with a deeper swing, so each beat comes
      // almost all the way down — that gap is the thud you actually hear.
      const chop = ctx.createGain();
      chop.gain.value = 0.62;
      const lfo = ctx.createOscillator();
      lfo.type = 'sawtooth';
      lfo.frequency.value = p.chop;
      const depth = ctx.createGain();
      depth.gain.value = 0.62;
      lfo.connect(depth); depth.connect(chop.gain);
      n.connect(lp); lp.connect(chop); chop.connect(g);

      // The turbine over the top of it, thin and steady.
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = p.whine;
      const bp = filter('bandpass', p.whine, 7);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.linearRampToValueAtTime(p.vol * 0.16, t + 1.0);
      o.connect(bp); bp.connect(og); og.connect(out);

      n.start(t); lfo.start(t); o.start(t);
      return { stop: (at) => {
        g.gain.cancelScheduledValues(at);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
        og.gain.cancelScheduledValues(at);
        og.gain.setValueAtTime(Math.max(0.0001, og.gain.value), at);
        og.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
        o.frequency.exponentialRampToValueAtTime(p.whine * 0.4, at + 0.6);
        lfo.frequency.exponentialRampToValueAtTime(Math.max(0.5, p.chop * 0.3), at + 0.6);
        n.stop(at + 0.62); o.stop(at + 0.62); lfo.stop(at + 0.62);
      } };
    },
  },
  // The handset in the cockpit. Two pieces: the squelch that opens and
  // closes a transmission, and the carrier underneath it while somebody is
  // talking. The browser's speech cannot be put through a filter — it does
  // not come out anywhere this mixer can reach it — so the radio is sold
  // by what is around the voice rather than by what is done to it.
  'radio-squelch': {
    label: 'RADIO SQUELCH', group: 'Moments',
    params: {
      vol:  P(0.3, 0, 1, 0.01, 'Volume'),
      tone: P(1700, 400, 4000, 50, 'Tone'),
    },
    make(p, t, out) {
      hiss(out, t, { dur: 0.09, type: 'bandpass', freq: vary(p.tone, 0.12),
                     q: 1.4, vol: p.vol, decay: 1.6 });
      hiss(out, t + 0.07, { dur: 0.24, type: 'bandpass', freq: p.tone * 0.7,
                            q: 2.2, vol: p.vol * 0.55, decay: 2.6 });
      beep(out, t + 0.02, { from: 920, to: 610, dur: 0.07,
                            vol: p.vol * 0.3, type: 'square' });
    },
  },
  'radio-hiss': {
    label: 'RADIO CARRIER', group: 'Moments', loop: true,
    params: {
      vol:  P(0.09, 0, 0.4, 0.005, 'Volume'),
      tone: P(1500, 300, 4000, 50, 'Tone'),
    },
    make(p, t, out) {
      const n = noise(2, 0);
      n.loop = true;
      const bp = filter('bandpass', p.tone, 0.9);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(p.vol, t + 0.15);
      n.connect(bp); bp.connect(g); g.connect(out);
      n.start(t);
      return { stop: (at) => {
        g.gain.cancelScheduledValues(at);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
        n.stop(at + 0.16);
      } };
    },
  },
  'tractor': {
    // The beam. Three detuned sawtooths climbing together through a filter
    // that opens as they go, with air being dragged up over the top — it
    // has to start under the rotor and end up owning everything.
    label: 'THE BEAM', group: 'Moments', loop: true,
    params: {
      // Three sawtooths add up before anything scales them, so this
      // number is a third of what it looks like. At its first setting the
      // beam measured flat out at the top of the meter — three times a
      // rifle, and clipped.
      vol:   P(0.16, 0, 0.6, 0.01, 'Volume'),
      pitch: P(64, 20, 260, 2, 'Pitch'),
      rise:  P(5.5, 1, 14, 0.5, 'Rise'),
    },
    make(p, t, out) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(p.vol, t + 0.45);
      g.connect(out);

      const lp = filter('lowpass', 400, 4);
      lp.frequency.setValueAtTime(280, t);
      lp.frequency.exponentialRampToValueAtTime(2800, t + p.rise);
      lp.connect(g);

      const oscs = [];
      for (const det of [1, 1.013, 1.496]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(p.pitch * det, t);
        o.frequency.exponentialRampToValueAtTime(p.pitch * det * 3.6, t + p.rise);
        o.connect(lp);
        o.start(t);
        oscs.push(o);
      }
      // Everything loose in the air going up with you.
      const n = noise(2, 0);
      n.loop = true;
      const hp = filter('highpass', 700, 0.8);
      hp.frequency.setValueAtTime(600, t);
      hp.frequency.exponentialRampToValueAtTime(2600, t + p.rise);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t);
      ng.gain.linearRampToValueAtTime(p.vol * 0.8, t + p.rise * 0.8);
      n.connect(hp); hp.connect(ng); ng.connect(out);
      n.start(t);

      return { stop: (at) => {
        g.gain.cancelScheduledValues(at);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
        ng.gain.cancelScheduledValues(at);
        ng.gain.setValueAtTime(Math.max(0.0001, ng.gain.value), at);
        ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
        for (const o of oscs) o.stop(at + 0.4);
        n.stop(at + 0.4);
      } };
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
    // The master is the one number that is not read fresh every time a sound
    // plays — it lives on a gain node that was built when audio started. Load
    // it into CFG alone and the game would agree it had changed while
    // carrying on at the old volume.
    if (master) master.gain.value = CFG.master.vol;
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
