// src/player/classes.js
// WHO YOU ARE WHEN YOU START
//
// FLETCHER'S GUIDE:
// Eight of them. Three you can pick the first time you play; the other five
// are all behind something you have to have done first.
//
// The differences are not cosmetic. A class changes what you are holding,
// how fast it fires, how hard it hits, how straight it shoots, how much
// health you have and how quickly you move — so the same station is a
// different problem depending on who walked into it.
//
//   ASSAULT   the middle of everything. One shot per click, one point of
//             damage, no spread worth worrying about.
//   SNIPER    three times the damage and dead straight, but slow, and you
//             are made of glass. The Watcher dies to one shot. So do you.
//   SMG       holds down the trigger. A third of the damage per round and
//             it sprays, but it puts out four times as many of them, and
//             you have the health to stand there doing it.
//   COMMANDER everything at its best, and you choose the weapon. Earned by
//             finishing the game as each of the first three.
//
// And the five earned ones:
//
//   SCOUT     a pistol, 80 health, and the Commander's legs. Escape on
//             NORMAL and it is yours.
//   MEDIC     a plain rifle and two health a second back, for as long as you
//             are alive to collect it. Escape on HARD.
//   MINIGUN   the SMG's round at twice the rate — eight times the assault
//             rifle — and the weight to go with it. Escape on IMPOSSIBLE.
//   RPG       rockets, and a blast that takes everything standing near what
//             you hit. Found, not won: it is behind the board in the armory.
//
// Damage is in the same units the rest of the game uses: a Crawler has 3, a
// Brute 6, a Watcher 1. The bosses have their own per-bullet number, which
// a class scales rather than replaces.

import * as THREE from 'three';

const GUN_BODY = 0x333340;
const GUN_DARK = 0x222230;
const GUN_WOOD = 0x4a3a2a;

/** The shared bits every one of them has. */
function gunBase(scale = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: GUN_BODY });
  const dark = new THREE.MeshLambertMaterial({ color: GUN_DARK });
  return { g, mat, dark, scale };
}

function buildAssault() {
  const { g, mat, dark } = gunBase();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.34), mat));
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), mat);
  grip.position.set(0, -0.08, 0.08); grip.rotation.x = 0.2; g.add(grip);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.14, 0.05), dark);
  mag.position.set(0, -0.09, -0.02); mag.rotation.x = -0.12; g.add(mag);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.12), dark);
  hand.position.set(0, -0.02, -0.12); g.add(hand);
  const mz = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.1, 6), dark);
  mz.rotation.x = Math.PI / 2; mz.position.set(0, 0.01, -0.22); g.add(mz);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.05), dark);
  sight.position.set(0, 0.055, -0.04); g.add(sight);
  return g;
}

function buildSniper() {
  const { g, mat, dark } = gunBase();
  // Long, and most of the length is barrel.
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.42), mat));
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.18),
    new THREE.MeshLambertMaterial({ color: GUN_WOOD }));
  stock.position.set(0, -0.03, 0.26); g.add(stock);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.11, 0.055), mat);
  grip.position.set(0, -0.08, 0.12); grip.rotation.x = 0.25; g.add(grip);
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, 0.34, 6), dark);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.005, -0.36); g.add(barrel);
  // The scope, which is the whole point of it.
  const scope = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, 0.2, 8), dark);
  scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.08, -0.04); g.add(scope);
  for (const sz of [-0.07, 0.05]) {
    const ring = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.02), mat);
    ring.position.set(0, 0.05, sz); g.add(ring);
  }
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.024, 8),
    new THREE.MeshBasicMaterial({ color: 0x2a4a6a }));
  lens.position.set(0, 0.08, -0.141); g.add(lens);
  const bipod = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.02), dark);
  bipod.position.set(0, -0.05, -0.26); g.add(bipod);
  return g;
}

function buildSmg() {
  const { g, mat, dark } = gunBase();
  // Stubby, with the magazine out in front of the grip.
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.085, 0.2), mat));
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.06), mat);
  grip.position.set(0, -0.08, 0.05); grip.rotation.x = 0.18; g.add(grip);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.05), dark);
  mag.position.set(0, -0.12, -0.05); mag.rotation.x = -0.1; g.add(mag);
  const shroud = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 0.14, 7), dark);
  shroud.rotation.x = Math.PI / 2; shroud.position.set(0, 0.01, -0.17); g.add(shroud);
  for (let i = 0; i < 3; i++) {                 // cooling slots
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.01, 0.018), mat);
    slot.position.set(0, 0.03, -0.13 - i * 0.04); g.add(slot);
  }
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.14), dark);
  stock.position.set(0, -0.01, 0.16); g.add(stock);
  return g;
}

function buildPistol() {
  const { g, mat, dark } = gunBase();
  // Small, and held further forward than the rest because there is no stock.
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.17), mat));
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.11, 0.055), dark);
  grip.position.set(0, -0.08, 0.04); grip.rotation.x = 0.3; g.add(grip);
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.025, 0.18), dark);
  slide.position.set(0, 0.045, -0.005); g.add(slide);
  const mz = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.05, 6), dark);
  mz.rotation.x = Math.PI / 2; mz.position.set(0, 0, -0.1); g.add(mz);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.016, 0.02), mat);
  sight.position.set(0, 0.066, -0.06); g.add(sight);
  return g;
}

function buildRifle() {
  const { g, mat, dark } = gunBase();
  // The Medic's. Longer in the barrel than the assault and plainer with it —
  // iron sights, a full stock, nothing bolted on.
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.08, 0.3), mat));
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.095, 0.16),
    new THREE.MeshLambertMaterial({ color: GUN_WOOD }));
  stock.position.set(0, -0.02, 0.21); g.add(stock);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.1, 0.055), mat);
  grip.position.set(0, -0.075, 0.08); grip.rotation.x = 0.22; g.add(grip);
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.013, 0.26, 6), dark);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.008, -0.28); g.add(barrel);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.11, 0.045), dark);
  mag.position.set(0, -0.08, -0.01); g.add(mag);
  // A white cross on the receiver, so you can see whose rifle it is.
  const cross = new THREE.MeshBasicMaterial({ color: 0xdde8ee });
  const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.012, 0.04), cross);
  bar1.position.set(0, 0.015, 0.06); g.add(bar1);
  const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.04, 0.012), cross);
  bar2.position.set(0, 0.015, 0.06); g.add(bar2);
  for (const sz of [-0.12, 0.02]) {
    const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.026, 0.016), dark);
    s2.position.set(0, 0.055, sz); g.add(s2);
  }
  return g;
}

function buildMinigun() {
  const { g, mat, dark } = gunBase();
  // Six barrels on a drum, a box of ammunition hanging off it, and enough
  // bulk that it reads as heavy from the one angle you ever see it at.
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, 0.22), mat));
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.1, 10), dark);
  drum.rotation.x = Math.PI / 2; drum.position.set(0, 0.005, -0.16); g.add(drum);
  // The barrels themselves, on a group so the game can spin it while firing.
  const barrels = new THREE.Group();
  barrels.position.set(0, 0.005, -0.16);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const b = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.013, 0.3, 6), dark);
    b.rotation.x = Math.PI / 2;
    b.position.set(Math.cos(a) * 0.032, Math.sin(a) * 0.032, -0.16);
    barrels.add(b);
  }
  barrels.name = 'barrels';
  g.add(barrels);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.14), dark);
  box.position.set(0.02, -0.11, 0.08); g.add(box);
  const feed = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.1), mat);
  feed.position.set(0.02, -0.04, 0.02); g.add(feed);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.06), mat);
  grip.position.set(0, -0.09, 0.09); grip.rotation.x = 0.18; g.add(grip);
  return g;
}

function buildRpg() {
  const { g, mat, dark } = gunBase();
  // A tube, and a warhead sticking out of the end of it.
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.62, 10), mat);
  tube.rotation.x = Math.PI / 2; tube.position.set(0, 0, -0.08); g.add(tube);
  const flare = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.045, 0.12, 10), dark);
  flare.rotation.x = Math.PI / 2; flare.position.set(0, 0, 0.26); g.add(flare);
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.055, 0.16, 8),
    new THREE.MeshLambertMaterial({ color: 0x6a5a3a }));
  head.rotation.x = -Math.PI / 2; head.position.set(0, 0, -0.46); g.add(head);
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8),
    new THREE.MeshLambertMaterial({ color: 0x6a5a3a }));
  collar.rotation.x = Math.PI / 2; collar.position.set(0, 0, -0.36); g.add(collar);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.11, 0.055), dark);
  grip.position.set(0, -0.09, 0.02); grip.rotation.x = 0.2; g.add(grip);
  const fore = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.05), dark);
  fore.position.set(0, -0.07, -0.22); g.add(fore);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.05, 0.016), dark);
  sight.position.set(0, 0.07, -0.18); g.add(sight);
  return g;
}

export const WEAPONS = {
  assault: { label: 'Assault Rifle', build: buildAssault,
             fireEvery: 0.17, damage: 1, spread: 0.006, auto: false },
  sniper:  { label: 'Sniper Rifle',  build: buildSniper,
             fireEvery: 0.95, damage: 3, spread: 0,     auto: false },
  smg:     { label: 'SMG',           build: buildSmg,
             fireEvery: 0.075, damage: 1, spread: 0.032, auto: true },
  pistol:  { label: 'Pistol',        build: buildPistol,
             fireEvery: 0.26, damage: 1, spread: 0.009, auto: false },
  rifle:   { label: 'Rifle',         build: buildRifle,
             fireEvery: 0.2,  damage: 1, spread: 0.005, auto: false },
  // Exactly the SMG's round, exactly twice as often.
  minigun: { label: 'Minigun',       build: buildMinigun,
             fireEvery: 0.075 / 2, damage: 1, spread: 0.045, auto: true,
             spins: true },
  // The only one that doesn't shoot a line. `blast` is what the rocket does
  // where it lands; `damage` is the hit the thing it actually struck takes
  // on top of that. See fireRocket() and explode() in game.js.
  rpg:     { label: 'RPG',           build: buildRpg,
             fireEvery: 1.4, damage: 4, spread: 0, auto: false,
             rocket: true, blast: { radius: 4.5, damage: 5 } },
};

export const CLASSES = [
  {
    id: 'assault', name: 'ASSAULT', weapon: 'assault',
    blurb: 'Assault rifle. The middle of everything.',
    stats: 'Damage 1 · 100 health · normal speed',
    hp: 100, speed: 5.0, damageMul: 1,
  },
  {
    id: 'sniper', name: 'SNIPER', weapon: 'sniper',
    blurb: 'Hits three times as hard and never misses. Slow, and thin.',
    stats: 'Damage 3 · 70 health · quick on your feet',
    hp: 70, speed: 5.6, damageMul: 1,
  },
  {
    id: 'smg', name: 'SMG', weapon: 'smg',
    blurb: 'Hold the trigger down. It sprays. You can take a hit.',
    stats: 'Fires 4x as fast · 130 health · heavier',
    hp: 130, speed: 4.6, damageMul: 1,
  },
  // ─── EARNED ───────────────────────────────────────────────
  // Each of these is behind something you have to have done. `unlock` says
  // what; see classLocked() for how it is read.
  {
    id: 'scout', name: 'SCOUT', weapon: 'pistol',
    unlock: { difficulty: 'normal' },
    blurb: 'A pistol and nothing to slow you down. Moves like the Commander.',
    stats: 'Damage 1 · 80 health · fastest',
    hp: 80, speed: 6.0, damageMul: 1,
  },
  {
    id: 'medic', name: 'MEDIC', weapon: 'rifle',
    unlock: { difficulty: 'hard' },
    blurb: 'A plain rifle, and wounds that close on their own if you live.',
    stats: 'Damage 1 · 110 health · heals 2/sec',
    hp: 110, speed: 5.0, damageMul: 1, regen: 2,
  },
  {
    id: 'minigun', name: 'MINIGUN', weapon: 'minigun',
    unlock: { difficulty: 'impossible' },
    blurb: 'The SMG round, twice as often. Heavy enough that you feel it.',
    stats: 'Fires 8x as fast · 140 health · slowest',
    hp: 140, speed: 4.2, damageMul: 1,
  },
  {
    id: 'rpg', name: 'RPG', weapon: 'rpg',
    unlock: { secret: true },
    blurb: 'Rockets. Everything standing near what you hit goes with it.',
    stats: 'Blast damage · 100 health · normal speed',
    hp: 100, speed: 4.8, damageMul: 1,
  },
  {
    id: 'commander', name: 'COMMANDER', weapon: 'assault',
    unlock: { wins: true },
    blurb: 'Everything at its best, and you pick the gun.',
    stats: 'Double damage · 160 health · fastest',
    hp: 160, speed: 6.0, damageMul: 2,
  },
];

export function classById(id) {
  return CLASSES.find((c) => c.id === id) || CLASSES[0];
}

// ─── HOW HARD ───────────────────────────────────────────────
// Five knobs, few enough that you can predict what picking one will do:
//
//   incoming  what everything hits YOU for
//   health    your class's health, scaled
//   enemyHp   what everything else is made of
//   speed     how fast they close the distance
//   swarm     how many of them an outpost holds
//
// Nothing here touches how the aliens think. A harder game is one where the
// same creature behaving the same way is more dangerous — not one where it
// suddenly gets cleverer, which would make the difficulty a different game
// rather than the same game turned up. `speed` scales the clock the AI is
// driven on rather than any one creature's pace, so a Crawler still scurries
// like a Crawler; it just eats the gap between you faster. The Watcher is the
// one that reads oddly at a glance: it cannot move, so a faster clock comes
// out as a shorter wait between beams, which is the same thing — the turret
// getting at you quicker.
export const DIFFICULTIES = [
  { id: 'easy', name: 'EASY',
    note: 'They hit softer and die quicker. You have more to give.',
    incoming: 0.5, health: 1.3, enemyHp: 0.75, speed: 1, swarm: 1 },
  { id: 'normal', name: 'NORMAL',
    note: 'The game as it is meant to be played.',
    incoming: 1, health: 1, enemyHp: 1, speed: 1, swarm: 1 },
  { id: 'hard', name: 'HARD',
    note: 'Everything hits most of twice as hard and takes more killing.',
    incoming: 1.7, health: 0.85, enemyHp: 1.3, speed: 1.15, swarm: 1 },
  { id: 'impossible', name: 'IMPOSSIBLE',
    note: 'Twice as many, faster, and nearly everything kills you in two.',
    incoming: 3.5, health: 0.55, enemyHp: 2.5, speed: 1.6, swarm: 2 },
];

export function difficultyById(id) {
  return DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[1];
}

const DIFF_KEY = 'falo3d2.difficulty';

export function savedDifficulty() {
  try {
    return difficultyById(localStorage.getItem(DIFF_KEY) || 'normal');
  } catch (e) {
    return difficultyById('normal');
  }
}

export function saveDifficulty(id) {
  try { localStorage.setItem(DIFF_KEY, id); } catch (e) { /* no save, no matter */ }
}

// ─── WHAT YOU HAVE FINISHED ─────────────────────────────────
// Kept in the browser, because it has to outlive the page: beating the game
// as all three is the only way to the Commander, and nobody is doing that in
// one sitting.
const SAVE_KEY = 'falo3d2.wins';

export function winsSoFar() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    // Private windows and blocked site data both throw here. Losing the
    // record is a shame; crashing the game over it would be worse.
    return [];
  }
}

export function recordWin(id) {
  try {
    const list = winsSoFar();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(SAVE_KEY, JSON.stringify(list));
    }
    return list;
  } catch (e) {
    return winsSoFar();
  }
}

/** The three you must finish to earn the Commander. */
export const REQUIRED_FOR_COMMANDER = ['assault', 'sniper', 'smg'];

export function commanderUnlocked(wins = winsSoFar()) {
  return REQUIRED_FOR_COMMANDER.every((id) => wins.includes(id));
}

/** For the picker: which of the three are still outstanding. */
export function stillNeeded(wins = winsSoFar()) {
  return REQUIRED_FOR_COMMANDER.filter((id) => !wins.includes(id));
}

// ─── WHICH DIFFICULTIES YOU HAVE FINISHED ───────────────────
// Separate from the class wins, because they answer a different question:
// the wins ask who you were, this asks what you were up against.
const BEAT_KEY = 'falo3d2.beaten';

export function beatenSoFar() {
  try {
    const raw = localStorage.getItem(BEAT_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

export function recordBeaten(id) {
  try {
    const list = beatenSoFar();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(BEAT_KEY, JSON.stringify(list));
    }
    return list;
  } catch (e) {
    return beatenSoFar();
  }
}

/**
 * How far up the four a win counts for.
 *
 * Finishing on HARD is finishing on NORMAL and then some, so it unlocks the
 * Scout as well as the Medic. The alternative — making you go back and grind
 * out a difficulty you have already proved you are past — is busywork, and
 * the only thing it would protect is the order the rewards arrive in.
 */
const RANK = ['easy', 'normal', 'hard', 'impossible'];

export function beatenToRank(id, beaten = beatenSoFar()) {
  const want = RANK.indexOf(id);
  return beaten.some((done) => RANK.indexOf(done) >= want);
}

// ─── THE ROOM BEHIND THE BOARD ──────────────────────────────
// One bit, and finding it once is enough — it stays found.
const SECRET_KEY = 'falo3d2.secret';

export function secretFound() {
  try { return localStorage.getItem(SECRET_KEY) === '1'; } catch (e) { return false; }
}

export function recordSecret() {
  try { localStorage.setItem(SECRET_KEY, '1'); } catch (e) { /* no save, no matter */ }
}

// ─── IS IT YOURS YET ────────────────────────────────────────
// Everything the picker needs to know, read once rather than per card —
// each of these goes to localStorage, and there are eight cards.
export function unlockState() {
  return { wins: winsSoFar(), beaten: beatenSoFar(), secret: secretFound() };
}

export function classLocked(c, st = unlockState()) {
  const u = c.unlock;
  if (!u) return false;
  if (u.wins) return !commanderUnlocked(st.wins);
  if (u.secret) return !st.secret;
  if (u.difficulty) return !beatenToRank(u.difficulty, st.beaten);
  return false;
}

/** What the card says instead of its blurb while it is still locked. */
export function lockReason(c, st = unlockState()) {
  const u = c.unlock || {};
  if (u.wins) {
    return 'Locked. Finish the game as '
      + stillNeeded(st.wins).map((id) => classById(id).name).join(', ') + '.';
  }
  if (u.secret) return 'Locked. There is a room on this station you have not found.';
  if (u.difficulty) {
    return 'Locked. Escape the station on '
      + difficultyById(u.difficulty).name + '.';
  }
  return 'Locked.';
}
