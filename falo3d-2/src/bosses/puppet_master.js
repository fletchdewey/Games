// bosses/puppet_master.js
// BOSS: The Puppet Master
// A tiny gleeful alien piloting a headless brute body via nerve tendrils.
//
// DESIGN CONCEPT (Fletcher):
// Remember in The Office when Michael spreads the rumor about Kevin
// being two small people in a big suit? That's this boss.
// A tiny smart alien hijacked a big dumb body and is RIDING it.
//
// GAMEPLAY MECHANICS:
// - Two hitboxes: the body and the pilot
// - Body takes normal damage but has massive health
// - Pilot is a tiny target but much lower health
// - When body health hits 0: body staggers, pilot exposed briefly
// - When pilot health hits 0: body collapses, fight over
// - Smart players learn to aim for the head (the pilot)
//
// PHASES:
// Phase 1 (100-50% body HP): Standard attacks, pilot safely tucked in
// Phase 2 (50-0% body HP): Body starts malfunctioning, pilot panics,
//   nerve tendrils glow brighter, body staggers periodically exposing pilot
// Phase 3 (body dead): Pilot ejects, runs around frantically,
//   tiny and fast, comically hard to hit
//
// ATTACKS:
// - Body slam (charge + ground pound, like Brute)
// - Tendril whip (mid-range, nerve tendrils lash out)
// - Pilot throws small projectiles in Phase 3
//
// WHY THIS BOSS IS SPECIAL:
// It teaches the player to look for weak points instead of just
// shooting the biggest target. That's a skill they'll use in
// other boss fights.

import * as THREE from 'three';
import { PALETTE, getMaterial } from '../shared/materials.js';
import { buildLegChain, buildArmChain } from '../shared/geometry.js';
import { createBehaviorSpec } from '../shared/behavior.js';

// TODO: Full geometry built in dedicated chat.
// Workshop model reference is in boss_workshop.jsx → buildPuppetMaster()
// Key elements to preserve:
// - Headless brute body (neck stump visible)
// - Tiny pilot in neck cavity with beady eyes + grin
// - 5 nerve tendrils connecting pilot to body (glowing green)
// - Body arms/legs use shared buildLegChain/buildArmChain
// - Pilot has tiny arms reaching forward (holding reins)

export function createPuppetMaster() {
  // Stub — will be built out in dedicated chat
  const g = new THREE.Group();
  g.userData.type = 'puppet_master';
  return g;
}

export const puppetMasterBehavior = createBehaviorSpec({
  type: 'puppet_master',
  isBoss: true,

  health: 30,           // body health
  pilotHealth: 8,       // separate pilot health
  speed: 0.04,
  patrolRange: 12,

  movementType: 'charge',

  attackType: 'melee',
  attackRange: 3,
  attackDamage: 3,
  attackCooldown: 60,

  walkSpeed: 3.5,
  walkAmplitude: 0.2,

  deathType: 'split',   // body drops, pilot ejects

  // Boss-specific config
  phases: [
    { name: 'controlled', bodyHpThreshold: 0.5, pilotExposed: false },
    { name: 'malfunctioning', bodyHpThreshold: 0, pilotExposed: 'periodic' },
    { name: 'ejected', bodyHpThreshold: -1, pilotExposed: true },
  ],
  staggerDuration: 90,  // frames pilot is exposed during staggers
  pilotSpeed: 0.08,     // fast tiny target in phase 3
  pilotAttackCooldown: 45,
});
