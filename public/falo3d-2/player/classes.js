// src/player/classes.js
// WHO YOU ARE WHEN YOU START
//
// FLETCHER'S GUIDE:
// Four of them. Three you can pick from the first time you play, and one you
// have to earn by finishing the game as each of the other three.
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
//   COMMANDER everything at its best, and you choose the weapon.
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

export const WEAPONS = {
  assault: { label: 'Assault Rifle', build: buildAssault,
             fireEvery: 0.17, damage: 1, spread: 0.006, auto: false },
  sniper:  { label: 'Sniper Rifle',  build: buildSniper,
             fireEvery: 0.95, damage: 3, spread: 0,     auto: false },
  smg:     { label: 'SMG',           build: buildSmg,
             fireEvery: 0.075, damage: 1, spread: 0.032, auto: true },
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
  {
    id: 'commander', name: 'COMMANDER', weapon: 'assault', locked: true,
    blurb: 'Everything at its best, and you pick the gun.',
    stats: 'Double damage · 160 health · fastest',
    hp: 160, speed: 6.0, damageMul: 2,
  },
];

export function classById(id) {
  return CLASSES.find((c) => c.id === id) || CLASSES[0];
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

/** The three you must finish to earn the fourth. */
export const REQUIRED_FOR_COMMANDER = ['assault', 'sniper', 'smg'];

export function commanderUnlocked(wins = winsSoFar()) {
  return REQUIRED_FOR_COMMANDER.every((id) => wins.includes(id));
}

/** For the picker: which of the three are still outstanding. */
export function stillNeeded(wins = winsSoFar()) {
  return REQUIRED_FOR_COMMANDER.filter((id) => !wins.includes(id));
}
