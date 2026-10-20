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
import { buildCrawler as buildCrawlerModel } from './workshop_models.js?v=ffde837483';
import { rememberColors, restoreColor, baseColorRGB } from './model_colors.js?v=ffde837483';
import { createBehaviorSpec } from '../shared/behavior.js?v=ffde837483';


// ─── 1. GEOMETRY ────────────────────────────────────────────────
//
// The body is NOT built here any more. It comes from the Alien Workshop, via
// workshop_models.js — the same model you see posed in the workshop and
// floating in the pods room, so the Crawler you fight and the Crawler you
// designed are one object. There used to be a second, older crawler built
// right here, which is why the one in the tank never matched the one that
// jumped on you.
//
// Everything below this — the walk cycle and the brain — is unchanged, and
// works because the workshop model stashes the same things in userData that
// this file has always read: legs, plates and glowMeshes.

export function buildCrawler() {
  const g = buildCrawlerModel();

  // The hurt flash drives these materials to white and then has to put them
  // back. It used to put them back to a colour written into THIS file, which
  // silently became a lie the moment the workshop's palette moved — so note
  // down what each one actually started as and restore from that instead.
  rememberColors(g.userData.plates);
  rememberColors(g.userData.glowMeshes);

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
      d.plates.forEach((plate) => {
        // Flash from the plate's OWN colour toward white, rather than from a
        // hard-coded grey that only matched the model this file used to build.
        const c = baseColorRGB(plate.material);
        plate.material.color.setRGB(
          c.r + (1 - c.r) * flash,
          c.g + (1 - c.g) * flash,
          c.b + (1 - c.b) * flash,
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
        d.plates.forEach((plate) => restoreColor(plate.material));
      }
      if (d.glowMeshes) {
        d.glowMeshes.forEach((gm) => {
          gm.scale.setScalar(1);
          restoreColor(gm.material);
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
