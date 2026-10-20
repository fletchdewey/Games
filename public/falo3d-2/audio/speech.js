// src/audio/speech.js
// THE ONLY VOICES IN THE GAME
//
// FLETCHER'S GUIDE:
// Everything else that makes a noise in this game is built out of
// oscillators — see audio/sound.js, which explains how. A sentence is
// where that stops working. You can synthesise a scream out of a buzz and
// two filters, but you cannot synthesise "we were lucky this helicopter
// was still working" that way; nobody can, not in a thousand lines.
//
// So this one thing is borrowed. Every browser has a speech synthesiser
// built into it — the thing that reads a page aloud to somebody who can't
// see it — and it will read whatever you hand it, in whichever voice the
// machine has. That is still not an audio file: nothing is downloaded,
// nothing is recorded, and the game ships the WORDS.
//
// The catch is that which voices exist is up to the machine. A Mac has
// about forty, half of them jokes (there is one called Bubbles). Windows
// has two or three with completely different names. So this file does not
// ask for a voice by name and hope — it asks for a list of names in order
// of preference per speaker, skips the joke ones, refuses to give two
// characters the same voice while there is another going spare, and if
// none of that works it falls back to whatever the machine calls default
// and tells them apart by pitch instead.
//
// The subtitles are not from here. They are on screen whatever happens,
// so a machine with no speech at all still gets the scene.

// Voices that are somebody's idea of a woman, and voices that are
// somebody's idea of a man. Which voices a machine has is up to the
// machine, so asking for one by name is a wish rather than a plan: when
// the wish cannot be granted these two lists are what stop the fallback
// handing your own line to a woman. Names only — there is nothing in a
// voice object that says who it is supposed to be.
const FEMALE = /^(samantha|karen|moira|tessa|victoria|allison|ava|susan|vicki|kate|serena|fiona|nicky|zoe|flo|sandy|shelley|princess|kathy|catherine|linda|heather|amelie|anna|ellen|joana|female|google uk english female|microsoft (zira|hazel|susan|linda|heather|eva|catherine|hazel))/i;
const MALE = /^(daniel|alex|rocko|reed|eddy|fred|rishi|aaron|arthur|gordon|oliver|thomas|tom|ralph|lee|james|male|google uk english male|microsoft (david|mark|george|ryan|guy|james|sean))/i;

// Names to avoid outright: every one of these is a novelty voice, and one
// of them reading a man's last line before he is taken would be the
// funniest thing in the game for all the wrong reasons.
const NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|kathy|grandma|grandpa|princess|deranged|hysterical|bells)/i;

// Who sounds like what, best first. Mac names, then Windows, then the
// Google ones that Android and Chrome OS carry.
const WANTED = {
  // You pick first, out of everybody. Your line is the last one in the
  // scene and the one with your own name on it, so it gets the best voice
  // the machine has rather than whatever the three soldiers left behind —
  // and it has to be nothing like theirs, which on a Mac means not one of
  // the three American ones that are all the same family underneath.
  you:   ['Daniel', 'Alex', 'Rocko', 'Oliver', 'Arthur', 'Aaron', 'Fred',
          'Google UK English Male', 'Microsoft David', 'Microsoft Mark'],
  radio: ['Karen', 'Samantha', 'Moira', 'Microsoft Zira', 'Google UK English Female'],
  s1:    ['Rocko', 'Microsoft Mark', 'Google US English', 'Alex'],
  s2:    ['Rishi', 'Reed', 'Tessa', 'Microsoft David', 'Google UK English Male'],
  s3:    ['Reed', 'Rocko', 'Moira', 'Microsoft Mark', 'Google US English'],
};

// And how each of them is pitched. This is what keeps five men apart on a
// machine that only has one voice to give.
const TONE = {
  // Rate is the one that matters. At 1.0 every one of these voices leaves
  // a gap between words that a person in the back of a helicopter does
  // not leave, and five lines of it sounds like a station announcement.
  // Low, and then lower. Every voice on a machine like this one is built
  // to read a web page pleasantly, which puts all of them above a man in
  // the back of a helicopter: 0.95 read young, 0.76 still did. This is
  // most of the way down the range the browser allows, which is as deep
  // as it goes before the words stop being words.
  you:   { pitch: 0.55, rate: 1.08 },
  // Thinner and faster still, because she is shouting into a handset.
  radio: { pitch: 1.14, rate: 1.12, gain: 0.95 },
  s1:    { pitch: 0.96, rate: 1.18 },
  s2:    { pitch: 0.94, rate: 1.14 },
  s3:    { pitch: 1.04, rate: 1.18 },
};

let chosen = null;
let warned = false;

function synth() {
  try { return window.speechSynthesis || null; } catch (e) { return null; }
}

function allVoices() {
  const s = synth();
  if (!s) return [];
  try { return s.getVoices() || []; } catch (e) { return []; }
}

/** Hand out one voice per speaker, as different from each other as the
 *  machine allows. Recomputed whenever the list of voices changes. */
function assign() {
  const all = allVoices();
  if (!all.length) return null;
  const en = all.filter((v) => /^en/i.test(v.lang));
  const pool = (en.length ? en : all).filter((v) => !NOVELTY.test(v.name));
  const list = pool.length ? pool : all;
  const used = new Set();
  const out = {};
  for (const role of Object.keys(WANTED)) {
    let found = null;
    // Asked for by name, on the machine, and not already somebody else's.
    for (const want of WANTED[role]) {
      found = list.find((v) => !used.has(v.name) && v.localService !== false &&
                               v.name.toLowerCase().startsWith(want.toLowerCase()));
      if (found) break;
    }
    // Then anything on the machine itself, then anything at all — except
    // for the player, whose own voice would rather be nobody's than a
    // woman's. A machine with four voices and three of them female is
    // exactly how your line ended up sounding like somebody else.
    const male = role === 'you';
    const free = (v) => !used.has(v.name) && !(male && FEMALE.test(v.name));
    if (!found && male) {
      found = list.find((v) => free(v) && v.localService !== false && MALE.test(v.name));
    }
    if (!found) found = list.find((v) => free(v) && v.localService !== false);
    if (!found) found = list.find((v) => free(v));
    if (!found) found = list.find((v) => !used.has(v.name));
    if (!found) found = list[0];
    if (found) used.add(found.name);
    out[role] = found || null;
  }
  return out;
}

function voices() {
  if (!chosen || !chosen.s1) chosen = assign();
  return chosen || {};
}

// The list arrives late on most browsers — getVoices() is empty on the
// first call and fills in a moment later — so it is rebuilt when it does.
if (synth()) {
  try {
    allVoices();
    synth().addEventListener('voiceschanged', () => { chosen = assign(); });
  } catch (e) { /* older browsers: the lazy path above covers it */ }
}

/** True if this machine can say anything at all. */
export function canSpeak() {
  return !!synth() && allVoices().length > 0;
}

/**
 * Say one line, now.
 *
 * `gain` is the game's master volume — the browser's speech does not go
 * through our mixer, so turning the game down has to be passed on by hand
 * or the dialogue carries on at full volume over a silent cutscene.
 */
export function say(role, text, gain = 1) {
  const s = synth();
  if (!s || !text) return null;
  try {
    // Chrome can leave the synthesiser paused after a tab change, and a
    // paused one accepts utterances and never speaks them.
    if (s.paused) s.resume();
    const u = new SpeechSynthesisUtterance(text);
    const v = voices()[role];
    if (v) { u.voice = v; u.lang = v.lang; }
    const tone = TONE[role] || {};
    u.pitch = tone.pitch != null ? tone.pitch : 1;
    u.rate = tone.rate != null ? tone.rate : 1;
    const level = gain * (tone.gain != null ? tone.gain : 1);
    u.volume = Math.max(0, Math.min(1, level));
    s.speak(u);
    return u;
  } catch (e) {
    if (!warned) { warned = true; console.warn('speech', e); }
    return null;
  }
}

/** Stop talking at once — skipping the cutscene, or leaving it early. */
export function hush() {
  const s = synth();
  if (!s) return;
  try { s.cancel(); } catch (e) { /* nothing to cancel */ }
}

/** Which voice each speaker ended up with, for the console. */
export function castList() {
  const v = voices();
  const out = {};
  for (const k of Object.keys(WANTED)) out[k] = v[k] ? v[k].name : '(default)';
  return out;
}
