// src/aliens/crawler.js
// The Crawler — a low-profile spider-crab that scurries and pounces.
//
// FLETCHER'S GUIDE:
// This file does THREE things:
//   1. buildCrawler()  — assembles the 3D model (the Lego build)
//   2. animateCrawler() — makes it move each frame (the puppet strings)
//   3. crawlerBehavior  — the AI brain (patrol, chase, pounce, etc.)
//
// Think of a Bokoblin in Breath of the Wild:
//   - It wanders around its camp (PATROL)
//   - It spots you and runs at you (CHASE)
//   - It winds up and swings (POUNCE)
//   - It stumbles after missing (RECOVER)
//   - Then it goes back to chasing
//
// The Crawler works the same way, just with a jump instead of a swing.

import * as THREE from 'three';
import { PALETTE, getMaterial } from '../shared/materials.js?v=09b9b82554';
import { buildLegChain } from '../shared/geometry.js?v=09b9b82554';
import { createBehaviorSpec } from '../shared/behavior.js?v=09b9b82554';


// ─── 1. GEOMETRY ────────────────────────────────────────────────
//
// This builds the Crawler's body out of simple shapes — spheres,
// cones, cylinders. No 3D model files needed.
// It returns a THREE.Group (a container) with everything inside.

export function buildCrawler() {
  const g = new THREE.Group();

  // Grab shared materials from the palette instead of making new ones.
  // This way all Crawlers in the scene share the same material objects.
  const skinMat  = getMaterial(PALETTE.skin1);
  const boneMat  = getMaterial(PALETTE.bone);
  const eyeMat   = getMaterial(PALETTE.eyeRed, { type: 'basic' });
  // These two get recolored during the HURT flash, so each Crawler needs
  // its own copy — otherwise hurting one flashes every Crawler (and every
  // Brute, which shares the armor material).
  const glowMat  = getMaterial(PALETTE.glowGreen, { type: 'basic' }).clone();
  const armorMat = getMaterial(PALETTE.armor).clone();

  // --- Body ---
  // A squished sphere — wide and flat like a crab shell.
  const bodyGeo = new THREE.SphereGeometry(0.6, 7, 5);
  bodyGeo.scale(1.2, 0.5, 1.4);
  const body = new THREE.Mesh(bodyGeo, skinMat);
  body.position.y = 0.4;
  body.castShadow = true;
  g.add(body);

  // --- Armor plates ---
  // Three overlapping plates on top, like a trilobite's shell.
  // Each one is slightly smaller, stacked front-to-back.
  const plates = [];
  for (let i = 0; i < 3; i++) {
    const plateGeo = new THREE.SphereGeometry(0.35 - i * 0.08, 5, 4);
    plateGeo.scale(1.1, 0.3, 0.8);
    const plate = new THREE.Mesh(plateGeo, armorMat);
    plate.position.set(0, 0.55 + i * 0.05, -0.3 + i * 0.3);
    g.add(plate);
    plates.push(plate);
  }

  // --- Legs (6 total: 3 per side) ---
  // We use buildLegChain from shared/geometry.js — the same Lego
  // leg piece every alien uses. The Crawler's legs are thin and
  // spread wide, angled outward like a spider.
  const legAngles = [-0.8, 0, 0.8];  // front, middle, back
  const legs = [];

  for (const side of [-1, 1]) {         // -1 = left, 1 = right
    for (let li = 0; li < legAngles.length; li++) {
      const angle = legAngles[li];

      const leg = buildLegChain({
        upperLen: 0.55,
        lowerLen: 0.5,
        upperR: 0.04,
        lowerR: 0.02,
        footSize: 0.025,       // small talon claws
        skinMat,
        boneMat,
        upperTilt: 0.3,        // legs splay outward
        lowerTilt: -0.9,       // knees bend back in
      });

      // Position each leg on the body and angle it outward
      leg.hip.position.set(side * 0.5, 0.35, angle * 0.45);
      leg.hip.rotation.z = side * 1.0;   // splay left/right
      leg.hip.rotation.y = angle * 0.3;  // fan front/back
      g.add(leg.hip);

      legs.push({
        ...leg,
        side,
        index: li,
        baseUpperTilt: 0.3,
        baseLowerTilt: -0.9,
      });
    }
  }

  // --- Pincers ---
  // Two small forward-facing cones, like crab claws.
  for (const side of [-1, 1]) {
    const pincerGeo = new THREE.ConeGeometry(0.04, 0.5, 4);
    const pincer = new THREE.Mesh(pincerGeo, boneMat);
    pincer.position.set(side * 0.35, 0.2, 0.8);
    pincer.rotation.x = -0.6;
    pincer.rotation.z = side * -0.4;
    g.add(pincer);
  }

  // --- Eyes (5 total) ---
  // A cluster of red eyes on the front — creepy spider look.
  const eyePositions = [
    { x: -0.12, y: 0.55, z: 0.65 },
    { x:  0.12, y: 0.55, z: 0.65 },
    { x:  0,    y: 0.6,  z: 0.7  },
    { x: -0.08, y: 0.65, z: 0.6  },
    { x:  0.08, y: 0.65, z: 0.6  },
  ];

  for (const ep of eyePositions) {
    const eGeo = new THREE.SphereGeometry(0.04, 4, 4);
    const eye = new THREE.Mesh(eGeo, eyeMat);
    eye.position.set(ep.x, ep.y, ep.z);
    g.add(eye);
  }

  // --- Glow nodes ---
  // Three green dots on the back — like bioluminescent markings.
  const glowPositions = [
    { x: -0.2, z: 0 },
    { x:  0.2, z: 0 },
    { x:  0,   z: -0.4 },
  ];

  const glowMeshes = [];
  for (const p of glowPositions) {
    const gGeo = new THREE.SphereGeometry(0.05, 4, 4);
    const gMesh = new THREE.Mesh(gGeo, glowMat);
    gMesh.position.set(p.x, 0.58, p.z);
    g.add(gMesh);
    glowMeshes.push(gMesh);
  }

  // --- Store references for animation ---
  // userData is Three.js's "stash stuff here" bag.
  // The animation function reads these to know what to wiggle.
  g.userData.legs = legs;
  g.userData.plates = plates;
  g.userData.glowMeshes = glowMeshes;
  g.userData.type = 'crawler';

  return g;
}


// ─── 2. ANIMATION ───────────────────────────────────────────────
//
// Called every frame. Makes the legs cycle and the body bob.
//
// The walk cycle works like this:
//   - Each leg gets a different "phase" so they don't all move together
//   - sin(time) gives a smooth back-and-forth wave
//   - The body bobs up and down with a slight roll
//
// It's the same idea as a clock's pendulum — smooth, repeating motion.

export function animateCrawler(model, time) {
  const d = model.userData;
  if (!d.legs) return;

  const speed = 12;    // fast scurrying — lots of leg cycles per second
  const amp = 0.15;    // how far each leg swings (radians)

  d.legs.forEach((leg, i) => {
    // "phase" offsets each leg so they alternate, like a real spider.
    // Without this, all 6 legs would swing together — looks like marching.
    const phase = (i / d.legs.length) * Math.PI * 2;
    const cycle = Math.sin(time * speed + phase);

    leg.upper.rotation.x = leg.baseUpperTilt + cycle * amp;
    leg.lower.rotation.x = leg.baseLowerTilt - Math.abs(cycle) * amp * 0.6;
  });

  // Body bob — slight up/down bounce synced to the leg cycle
  const bob = Math.abs(Math.sin(time * speed * 2)) * 0.025;
  model.position.y = (model.userData.baseY || 0) + bob;

  // Tiny body roll so it doesn't look robotic
  model.rotation.z = Math.sin(time * speed) * 0.015;
}


// ─── 3. AI STATE MACHINE ────────────────────────────────────────
//
// This is the Crawler's "brain." It decides what the Crawler does
// each frame based on its current STATE.
//
// States work like a flow chart:
//
//   PATROL ──(sees player)──► CHASE ──(close enough)──► POUNCE
//     ▲                                                   │
//     │                                                   ▼
//     └──────────(player far away)──────── RECOVER ◄──(landed)
//
// Each state is just a function that runs every frame. When the
// Crawler should switch states, we change `ai.state` and the next
// frame runs the new state's code instead.
//
// This is exactly how Bokoblins work in BOTW:
//   patrol camp → spot Link → run at Link → swing club → stumble

// --- State names (constants prevent typos) ---
const STATE = {
  PATROL:  'patrol',
  CHASE:   'chase',
  POUNCE:  'pounce',
  RECOVER: 'recover',
  HURT:    'hurt',
  DEAD:    'dead',
};

/**
 * Creates the AI data for one Crawler instance.
 * Each spawned Crawler gets its own copy of this.
 */
export function createCrawlerAI() {
  return {
    state: STATE.PATROL,
    stateTimer: 0,           // frames spent in current state
    patrolDir: 1,            // 1 = forward, -1 = backward
    patrolDist: 0,           // how far it's walked from spawn
    attackCooldown: 0,       // frames until it can pounce again
    pounceVelocity: null,    // direction of the jump (set on launch)
  };
}

/**
 * Runs one frame of Crawler AI logic.
 *
 * @param {THREE.Group} model     — the Crawler's 3D model
 * @param {object}      ai        — this Crawler's AI data (from createCrawlerAI)
 * @param {THREE.Vector3} playerPos — where the player is right now
 * @param {number}      dt        — time since last frame (seconds)
 * @returns {string|null}         — 'attack' if it launched a pounce this frame
 */
export function updateCrawlerAI(model, ai, playerPos, dt) {
  const pos = model.position;
  const d = model.userData;
  const toPlayer = new THREE.Vector3().subVectors(playerPos, pos);
  const dist = toPlayer.length();

  ai.stateTimer++;
  if (ai.attackCooldown > 0) ai.attackCooldown--;

  // --- State logic ---

  if (ai.state === STATE.PATROL) {
    // Wander back and forth. Like a Bokoblin walking around camp.
    pos.x += ai.patrolDir * 0.015 * dt * 60;
    ai.patrolDist += Math.abs(0.015 * dt * 60);

    // Turn around after walking 5 units
    if (ai.patrolDist > 5) {
      ai.patrolDir *= -1;
      ai.patrolDist = 0;
    }

    // Spotted the player? Switch to chase.
    if (dist < 12) {
      ai.state = STATE.CHASE;
      ai.stateTimer = 0;
    }
  }

  else if (ai.state === STATE.CHASE) {
    // Run straight at the player. Fast and direct.
    toPlayer.y = 0;   // stay on the ground plane
    toPlayer.normalize();

    const chaseSpeed = 0.05 * dt * 60;
    pos.add(toPlayer.multiplyScalar(chaseSpeed));

    // Face the player
    model.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

    // Close enough to pounce?
    if (dist < 3 && ai.attackCooldown <= 0) {
      ai.state = STATE.POUNCE;
      ai.stateTimer = 0;

      // Calculate pounce arc — aim where the player IS, not where they were
      ai.pounceVelocity = new THREE.Vector3()
        .subVectors(playerPos, pos)
        .normalize()
        .multiplyScalar(0.12);
      ai.pounceVelocity.y = 0.08;  // upward arc
    }

    // Player ran away? Go back to patrol.
    if (dist > 15) {
      ai.state = STATE.PATROL;
      ai.stateTimer = 0;
    }
  }

  else if (ai.state === STATE.POUNCE) {
    // LUNGE ATTACK — body pitches forward, legs trail behind.
    // Physics handles position (velocity + gravity).
    // This code handles the VISUAL — how it looks mid-air.
    if (ai.pounceVelocity) {
      pos.add(ai.pounceVelocity.clone().multiplyScalar(dt * 60));
      ai.pounceVelocity.y -= 0.004 * dt * 60;  // gravity
    }

    // Lunge visual: body pitched forward, legs swept back
    const baseY = model.userData.baseY || 0;
    const airborne = pos.y > baseY + 0.05;
    if (airborne) {
      model.rotation.x = -0.5;  // nose down, aggressive
      if (d.legs) {
        d.legs.forEach((leg) => {
          leg.upper.rotation.x = leg.baseUpperTilt - 0.5;
          leg.lower.rotation.x = leg.baseLowerTilt + 0.3;
        });
      }
    }

    // Landed?
    if (ai.stateTimer > 5 && pos.y <= baseY) {
      pos.y = baseY;
      model.rotation.x = 0;  // level out
      ai.state = STATE.RECOVER;
      ai.stateTimer = 0;
      ai.attackCooldown = 90;
      return 'attack';
    }
  }

  else if (ai.state === STATE.RECOVER) {
    // Stunned after landing — vulnerable window.
    // Like when a Bokoblin whiffs a big swing and stumbles.
    if (ai.stateTimer > 45) {  // ~0.75 seconds
      ai.state = STATE.CHASE;
      ai.stateTimer = 0;
    }
  }

  else if (ai.state === STATE.HURT) {
    // FLASH HIT — armor plates flash white, glow nodes flare,
    // small body jolt. Recovers after ~20 frames.
    const t = Math.min(ai.stateTimer / 20, 1);
    const flash = t < 0.3 ? t / 0.3 : Math.max(0, 1 - (t - 0.3) / 0.4);

    // Small body jolt
    model.position.z += Math.sin(t * Math.PI * 3) * 0.004 * (1 - t);

    // Flash plates toward white
    if (d.plates) {
      const ar = 0x1e / 255, ag = 0x1e / 255, ab = 0x2a / 255;
      d.plates.forEach((plate) => {
        plate.material.color.setRGB(
          ar + (1 - ar) * flash,
          ag + (1 - ag) * flash,
          ab + (1 - ab) * flash,
        );
      });
    }

    // Glow nodes flare
    if (d.glowMeshes) {
      d.glowMeshes.forEach((gm) => {
        gm.scale.setScalar(1 + flash * 2);
        gm.material.color.setHSL(0.38, 1 - flash * 0.5, 0.5 + flash * 0.4);
      });
    }

    if (ai.stateTimer > 20) {
      // Reset materials to normal
      if (d.plates) {
        d.plates.forEach((plate) => plate.material.color.set(PALETTE.armor));
      }
      if (d.glowMeshes) {
        d.glowMeshes.forEach((gm) => {
          gm.scale.setScalar(1);
          gm.material.color.set(PALETTE.glowGreen);
        });
      }
      ai.state = STATE.CHASE;
      ai.stateTimer = 0;
    }
  }

  // DEAD state: play flip animation, then mark for removal after 5 seconds.
  else if (ai.state === STATE.DEAD) {
    const elapsed = ai.stateTimer / 60; // approximate seconds
    if (elapsed < 2) {
      // Play flip death over 2 seconds
      deathFlip(model, elapsed / 2);
    }
    // After 5 seconds total, tell the game loop to remove us
    if (elapsed > 5) {
      return 'remove';
    }
  }

  return null;
}

/**
 * Flip death animation.
 *
 * Three phases — like a beetle you've flicked:
 *   1. Flip over (0–30%)
 *   2. Legs twitch, fading out (30–80%)
 *   3. Legs go still (80–100%)
 *
 * @param {THREE.Group} model — the Crawler
 * @param {number} t — progress from 0 to 1
 */
function deathFlip(model, t) {
  const d = model.userData;
  // Body geometry sits at y≈0.4 inside the group. When flipped
  // upside down that becomes -0.4, so we raise the origin to 0.6.
  const restY = 0.6;

  if (t < 0.3) {
    // Phase 1: flip over with a little arc
    const flip = t / 0.3;
    model.rotation.x = flip * Math.PI;
    model.position.y = restY + Math.sin(flip * Math.PI) * 0.5;
  } else if (t < 0.8) {
    // Phase 2: upside down, legs twitching (fading out)
    model.rotation.x = Math.PI;
    model.position.y = restY;
    if (d.legs) {
      const intensity = 1 - (t - 0.3) / 0.5;
      d.legs.forEach((leg, i) => {
        const spasm = Math.sin(t * 80 + i * 2) * intensity * 0.4;
        leg.upper.rotation.x = leg.baseUpperTilt + spasm;
        leg.lower.rotation.x = leg.baseLowerTilt + spasm * 0.5;
      });
    }
  } else {
    // Phase 3: still. Just lying there dead.
    model.rotation.x = Math.PI;
    model.position.y = restY;
    if (d.legs) {
      d.legs.forEach((leg) => {
        leg.upper.rotation.x = leg.baseUpperTilt + 0.5;
        leg.lower.rotation.x = leg.baseLowerTilt - 0.3;
      });
    }
  }
}

/**
 * Call this when the Crawler takes a hit.
 */
export function hitCrawler(ai) {
  if (ai.state === STATE.DEAD) return;
  ai.state = STATE.HURT;
  ai.stateTimer = 0;
}

/**
 * Call this when health reaches 0.
 */
export function killCrawler(ai) {
  ai.state = STATE.DEAD;
  ai.stateTimer = 0;
}


// ─── 4. BEHAVIOR SPEC ──────────────────────────────────────────
//
// This fills out the "alien form" from behavior.js.
// The game loop reads this to know the Crawler's stats.

export const crawlerBehavior = createBehaviorSpec({
  type: 'crawler',
  health: 3,
  speed: 0.05,
  patrolRange: 5,
  movementType: 'patrol',
  attackType: 'pounce',
  attackRange: 3,
  attackDamage: 1,
  attackCooldown: 90,
  walkSpeed: 12,
  walkAmplitude: 0.15,
  deathType: 'flip',

  onSpawn(model) {
    model.position.y = 0.25;
    model.userData.baseY = 0.25;
    model.userData.ai = createCrawlerAI();
  },

  onUpdate(model, dt, playerPos) {
    const ai = model.userData.ai;
    if (!ai) return null;

    // Run AI brain
    const event = updateCrawlerAI(model, ai, playerPos, dt);

    // Animate legs when alive (so it looks alive even when idle)
    if (ai.state !== STATE.DEAD) {
      animateCrawler(model, performance.now() / 1000);
    }

    return event;
  },

  onHit(model) {
    const ai = model.userData.ai;
    if (ai) hitCrawler(ai);
  },

  onDeath(model) {
    const ai = model.userData.ai;
    if (ai) killCrawler(ai);
  },
});
