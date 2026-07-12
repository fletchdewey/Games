// shared/materials.js
// Centralized palette and materials for all alien types.
// 
// WHY THIS FILE EXISTS (Fletcher):
// Every alien and boss uses the same family of colors — skin tones, bone,
// glow colors, eye colors. If we scattered these across 9 files, changing
// "the green glow should be more blue" means editing 9 files and hoping
// you didn't miss one. By defining them once here, every alien pulls from
// the same source of truth. One change, everywhere at once.
//
// This is called the DRY principle: Don't Repeat Yourself.
// Think of it like a paint palette sitting next to your canvas —
// every painter in the room dips from the same palette.

import * as THREE from 'three';

export const PALETTE = {
  skin1: 0x2a3a2a,    // crawler
  skin2: 0x3b2040,    // floater
  skin3: 0x1a2a3a,    // brute
  skin4: 0x3a2a1a,    // spire
  skinBoss: 0x2a2a32,
  bone: 0xc8b8a0,
  teeth: 0xe8dcc8,
  armor: 0x1e1e2a,
  armorLight: 0x2e2e3e,

  glowGreen: 0x44ff88,
  glowPurple: 0xff44cc,
  glowCyan: 0x44ccff,
  glowOrange: 0xffaa22,
  glowRed: 0xff2244,

  eyeRed: 0xff1122,
  eyeYellow: 0xffcc00,
  eyePink: 0xff66aa,

  mech: 0x4a5058,
  mechDark: 0x2a2e32,
  rust: 0x6a4a32,
  flesh: 0x3a2232,
  crate: 0x5a5040,
  crateDark: 0x3a3428,
};

// Pre-built materials cache.
// We cache these so 10 Crawlers share the SAME material object
// instead of creating 10 identical copies. Fewer materials = fewer
// GPU state switches = better performance.
const cache = {};

export function getMaterial(color, opts = {}) {
  const key = `${color}-${opts.type || 'lambert'}-${opts.opacity || 1}`;
  if (cache[key]) return cache[key];

  let mat;
  if (opts.type === 'basic') {
    mat = new THREE.MeshBasicMaterial({ color, ...opts });
  } else {
    mat = new THREE.MeshLambertMaterial({ color, ...opts });
  }

  cache[key] = mat;
  return mat;
}
