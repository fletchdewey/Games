// src/player/name.js
// WHO YOU ARE
//
// FLETCHER'S GUIDE:
// The game asks for a name once, the first time you ever play, and then
// shows it in the corner for the rest of your life. So it has to be a name
// that is fine to put on the screen, and that means the filter has to catch
// people TRYING to sneak something past it, not just people typing it out.
//
// Three tricks get used for that, in this order:
//
//   1. Everything that is not a letter is thrown away, and the digits and
//      symbols people swap in are turned back first — 4 is a, 3 is e, $ is
//      s, 0 is o. So "f.u.c.k", "F U C K" and "f4ck" all end up as the same
//      four letters.
//   2. Letters held down are collapsed. "fuuuuck" becomes "fuck".
//   3. The result is checked twice over: some words are banned anywhere
//      inside a name, because nobody puts them there by accident, and the
//      rest are banned only as the whole name — otherwise Michelle has
//      "hell" in her, Basil has an "asi" in him, and a grape has a rape.
//
// That last line is the whole reason there are two lists instead of one.

const SAVE_KEY = 'falo3d2.name';

/** What people swap in for letters, swapped back before anything else. */
const LEET = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b',
  '9': 'g', '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't', '(': 'c',
  '<': 'c', '£': 'l',
};

/** Banned anywhere inside the name. Nothing lands on these by accident. */
const ANYWHERE = [
  'fuck', 'shit', 'cunt', 'bitch', 'faggot', 'whore', 'slut', 'wanker',
  'bastard', 'pussy', 'asshole', 'arsehole', 'dumbass', 'jackass',
  'dickhead', 'motherf', 'retard', 'rapist', 'pedo', 'paedo', 'nigg',
  'kkk', 'blowjob', 'handjob', 'titties', 'bollock', 'twat', 'wank',
  'jizz', 'nazi', 'hitler', 'bukkake', 'dildo', 'felch', 'smegma',
  'phuck', 'fck', 'fuq', 'shyt',
];

/** Banned only as the entire name, because they live inside real words. */
const WHOLE = [
  'ass', 'arse', 'hell', 'damn', 'crap', 'piss', 'dick', 'cock', 'prick',
  'tit', 'tits', 'boob', 'boobs', 'fag', 'homo', 'queer', 'dyke', 'tranny',
  'spic', 'chink', 'kike', 'gook', 'wop', 'coon', 'rape', 'anal', 'cum',
  'sex', 'porn', 'penis', 'vagina', 'turd', 'shag', 'slag', 'minge',
  'clit', 'semen', 'spunk', 'bugger', 'bloody', 'wtf', 'stfu', 'gtfo',
];

/** Letters only, with the swapped-in symbols turned back first. */
function letters(raw) {
  let out = '';
  for (const ch of String(raw).toLowerCase()) {
    const sub = LEET[ch];
    if (sub) { out += sub; continue; }
    if (ch >= 'a' && ch <= 'z') out += ch;
  }
  return out;
}

const squeeze3 = (s) => s.replace(/(.)\1{2,}/g, '$1');   // fuuuck -> fuck
const dedupe = (s) => s.replace(/(.)\1+/g, '$1');        // ffuucckk -> fuck

// A digit or symbol standing in for a letter is a deliberate swap, so it is
// allowed to stand for ANY letter rather than the one it looks most like.
// Without this, "f4ck" reads as "fack" and walks straight through: 4 looks
// like an a, but nobody typing it means an a.
const ANY = '\u0001';

function masked(raw) {
  let out = '';
  for (const ch of String(raw).toLowerCase()) {
    if (ch >= 'a' && ch <= 'z') out += ch;
    else if (LEET[ch]) out += ANY;
  }
  return out;
}

/** Is `word` in `hay`, counting the wildcard as a match for anything? */
function hasMasked(hay, word) {
  for (let i = 0; i + word.length <= hay.length; i++) {
    let hit = true;
    for (let j = 0; j < word.length; j++) {
      const c = hay[i + j];
      if (c !== ANY && c !== word[j]) { hit = false; break; }
    }
    if (hit) return true;
  }
  return false;
}

function isFoul(raw) {
  const plain = letters(raw);
  if (!plain) return false;
  // The three readings of the same name. The deduped one is checked against
  // a shortened list only: collapsing every double letter turns "nigg" into
  // three letters that sit inside the word "night", and the filter must not
  // start eating ordinary names to catch a spelling nobody used.
  const forms = [plain, squeeze3(plain)];
  const deduped = dedupe(plain);
  for (const form of forms) {
    for (const w of ANYWHERE) if (form.includes(w)) return true;
    for (const w of WHOLE) if (form === w) return true;
  }
  for (const w of ANYWHERE) {
    const d = dedupe(w);
    if (d.length >= 4 && deduped.includes(d)) return true;
  }
  // The wildcard pass, and only for names that actually swapped something
  // in: on a name that is already all letters it would say nothing new and
  // would only widen what counts as a match.
  const mk = masked(raw);
  if (mk.includes(ANY)) {
    for (const form of [mk, dedupe(mk)]) {
      for (const w of ANYWHERE) if (w.length >= 4 && hasMasked(form, w)) return true;
      for (const w of WHOLE) {
        if (w.length >= 3 && form.length === w.length && hasMasked(form, w)) return true;
      }
    }
  }
  return false;
}

/**
 * Take what they typed and either hand back a name or say why not.
 * Returns { ok, name } or { ok: false, why }.
 */
export function cleanName(raw) {
  const name = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
  if (!name) return { ok: false, why: 'TYPE A NAME' };
  if (name.length < 2) return { ok: false, why: 'TOO SHORT' };
  if (name.length > 14) return { ok: false, why: 'TOO LONG — 14 LETTERS MAX' };
  if (!/^[A-Za-z0-9 _.\-]+$/.test(name)) {
    return { ok: false, why: 'LETTERS, NUMBERS, - _ . ONLY' };
  }
  if (!/[A-Za-z]/.test(name)) return { ok: false, why: 'NEEDS A LETTER IN IT' };
  if (isFoul(name)) return { ok: false, why: "THAT NAME CAN'T BE USED" };
  return { ok: true, name };
}

/** The name on this machine, or null if there has never been one. */
export function savedName() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    // Checked again on the way out, so a name saved before a word was added
    // to the list does not keep showing up in the corner forever.
    const r = cleanName(raw);
    if (!r.ok) { localStorage.removeItem(SAVE_KEY); return null; }
    return r.name;
  } catch (e) { return null; }
}

export function saveName(name) {
  try { localStorage.setItem(SAVE_KEY, name); } catch (e) { /* private window */ }
}

export function forgetName() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* private window */ }
}
