// src/aliens/floater.js
// The Floater — a psychic jellyfish-brain that hovers and fires mind blasts.
//
// FLETCHER'S GUIDE:
// This file does THREE things:
//   1. buildFloater()   — assembles the 3D model (the Lego build)
//   2. animateFloater() — makes it pulse and sway each frame (the puppet strings)
//   3. floaterBehavior  — the AI brain (hover, charge, fire, cooldown)
//
// Think of a Wizzrobe in Breath of the Wild:
//   - It floats around a spot, bobbing gently (HOVER)
//   - It spots you and drifts closer (CHASE)
//   - It raises its staff and glows (CHARGE)
//   - It throws a magic blast (FIRE)
//   - It pauses to catch its breath (COOLDOWN)
//   - Then it starts charging again
//
// The Floater works the same way, but with a pulsing brain
// instead of a staff, and a mind blast instead of a fireball.

import * as THREE from 'three';
import { PALETTE, getMaterial } from '../shared/materials.js';
import { createBehaviorSpec } from '../shared/behavior.js';


// ─── 1. GEOMETRY ────────────────────────────────────────────────
//
// This builds the Floater out of simple shapes — a translucent
// dome (the "bell"), a glowing core (the brain), tentacles,
// and a ring of eyes around the skirt.
//
// No legs needed — this thing floats. Think of it like building
// a Lego jellyfish: dome on top, dangly bits underneath.

export function buildFloater() {
  const g = new THREE.Group();

  // Grab shared materials. skin2 is the Floater's purple tone.
  const skinMat  = getMaterial(PALETTE.skin2, { transparent: true, opacity: 0.7 });
  const coreMat  = getMaterial(PALETTE.glowPurple, { type: 'basic' });
  const tentMat  = getMaterial(PALETTE.skin2);
  const foldMat  = getMaterial(0x4a2850);
  const eyeMat   = getMaterial(PALETTE.eyePink, { type: 'basic' });

  // --- Dome (the bell) ---
  // A half-sphere, like a jellyfish cap. Slightly squished vertically.
  // We only draw the top 60% of a sphere (the last two args clip it).
  const domeGeo = new THREE.SphereGeometry(0.6, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6);
  domeGeo.scale(1, 0.9, 1);
  const dome = new THREE.Mesh(domeGeo, skinMat);
  dome.position.y = 1.0;
  g.add(dome);

  // --- Brain folds ---
  // Four half-torus ridges on top of the dome, like wrinkles on
  // a brain. Each one sits at a slightly different angle so they
  // criss-cross. This is what makes it look "psychic" — it has
  // a visible brain under the translucent dome.
  const folds = [];
  for (let i = 0; i < 4; i++) {
    const ridgeGeo = new THREE.TorusGeometry(0.35 - i * 0.06, 0.035, 4, 8, Math.PI);
    const ridge = new THREE.Mesh(ridgeGeo, foldMat);
    ridge.position.set(0, 1.15 + i * 0.08, 0);
    ridge.rotation.y = i * 0.7;
    ridge.rotation.x = -Math.PI * 0.5;
    g.add(ridge);
    folds.push(ridge);
  }

  // --- Core (inner glow) ---
  // A small glowing sphere in the center — the "brain stem."
  // This pulses and flickers during animation. When the Floater
  // charges a mind blast, this flares bright.
  const coreGeo = new THREE.SphereGeometry(0.2, 6, 6);
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.y = 1.0;
  g.add(core);

  // Point light so the glow actually lights up nearby surfaces.
  const coreLight = new THREE.PointLight(0xff44cc, 1.5, 5);
  coreLight.position.set(0, 1.0, 0);
  g.add(coreLight);

  // --- Skirt ring ---
  // A torus (donut shape) at the bottom of the dome where
  // the tentacles attach. Like the rim of a jellyfish bell.
  const skirtGeo = new THREE.TorusGeometry(0.55, 0.06, 5, 10);
  const skirt = new THREE.Mesh(skirtGeo, tentMat);
  skirt.position.y = 0.65;
  skirt.rotation.x = Math.PI * 0.5;
  g.add(skirt);

  // --- Eyes (4, evenly spaced around the skirt) ---
  // Pink glowing dots, like sensor nodes. They sit just below
  // the dome, looking outward in four directions.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const eGeo = new THREE.SphereGeometry(0.06, 5, 5);
    const eye = new THREE.Mesh(eGeo, eyeMat);
    eye.position.set(Math.cos(a) * 0.5, 0.75, Math.sin(a) * 0.5);
    g.add(eye);
  }

  // --- Tentacles (6 strands, 5 segments each + glowing tip) ---
  // Each tentacle is a chain of small spheres that get smaller
  // toward the tip. The tip glows purple (same as the core).
  //
  // We store baseX/baseZ so the animation knows where each segment
  // "wants" to be. Then it adds sway on top of that base position.
  // It's like each tentacle is a string hanging from a point —
  // the base is where the string is tied, and sway is the wind.
  const tentacles = [];
  for (let t = 0; t < 6; t++) {
    const a = (t / 6) * Math.PI * 2;
    const baseX = Math.cos(a) * 0.4;
    const baseZ = Math.sin(a) * 0.4;
    const segs = [];

    for (let seg = 0; seg < 5; seg++) {
      const r = 0.04 - seg * 0.006;
      const segGeo = new THREE.SphereGeometry(Math.max(0.01, r), 4, 4);
      const segMesh = new THREE.Mesh(segGeo, tentMat);
      segMesh.position.set(baseX, 0.5 - seg * 0.2, baseZ);
      g.add(segMesh);
      segs.push({ mesh: segMesh, baseX, baseZ, seg });
    }

    // Glowing tip
    const tipGeo = new THREE.SphereGeometry(0.025, 4, 4);
    const tip = new THREE.Mesh(tipGeo, coreMat);
    tip.position.set(baseX, 0.5 - 5 * 0.2, baseZ);
    g.add(tip);
    segs.push({ mesh: tip, baseX, baseZ, seg: 5 });

    tentacles.push(segs);
  }

  // --- Store references for animation ---
  g.userData.dome = dome;
  g.userData.core = core;
  g.userData.coreLight = coreLight;
  g.userData.folds = folds;
  g.userData.tentacles = tentacles;
  g.userData.type = 'floater';

  return g;
}


// ─── 2. ANIMATION ───────────────────────────────────────────────
//
// Called every frame. Makes the Floater bob, pulse, and sway.
//
// Four things happen at once:
//   1. The dome breathes in and out (slow scale pulse)
//   2. The core flickers (fast color/scale cycle)
//   3. The brain folds ripple (each slightly offset)
//   4. The tentacles drift like seaweed in a current
//
// Unlike the Crawler's walk cycle, there are no legs to sync.
// Instead, the whole body gently bobs up and down — like a
// jellyfish riding an ocean current.

export function animateFloater(model, time) {
  const d = model.userData;

  // --- Dome pulse ---
  // Slow breathing — expands and contracts like a jellyfish swimming.
  const pulse = 1 + Math.sin(time * 4) * 0.08;
  if (d.dome) d.dome.scale.set(pulse, 0.9 * pulse, pulse);

  // --- Core flicker ---
  // Faster cycle than the dome — gives it a "thinking" look.
  // The color shifts slightly around pink/magenta.
  if (d.core) {
    const fastPulse = 1 + Math.sin(time * 7) * 0.04;
    d.core.scale.setScalar(fastPulse * 1.1);
    // HSL: hue 0.88 is magenta. Lightness wobbles 0.35–0.65.
    d.core.material.color.setHSL(0.88, 1, 0.5 + Math.sin(time * 6) * 0.15);
  }

  // --- Core light intensity ---
  if (d.coreLight) {
    d.coreLight.intensity = 1.5 + Math.sin(time * 6) * 0.8;
  }

  // --- Brain fold ripple ---
  // Each fold scales slightly out of phase, so the brain
  // looks like it's "thinking" — ridges ripple outward.
  if (d.folds) {
    d.folds.forEach((fold, i) => {
      const p = 1 + Math.sin(time * 4 + i * 0.8) * 0.06;
      fold.scale.set(p, p, 1);
    });
  }

  // --- Tentacle sway ---
  // Each segment sways based on its depth (seg index).
  // Deeper segments swing more — like the end of a rope
  // moves more than the part you're holding.
  if (d.tentacles) {
    d.tentacles.forEach((segs, ti) => {
      segs.forEach((s) => {
        const sway = Math.sin(time * 2.5 + s.seg * 0.9 + ti * 1.1) * 0.1 * (s.seg + 1);
        s.mesh.position.x = s.baseX + sway;
        s.mesh.position.z = s.baseZ + Math.cos(time * 2 + ti) * 0.04 * s.seg;
      });
    });
  }

  // --- Body bob ---
  // Gentle up-and-down hover. Slower than the Crawler's scurry.
  const baseY = model.userData.baseY || 0;
  model.position.y = baseY + Math.sin(time * 1.5) * 0.1;
}


// ─── 3. AI STATE MACHINE ────────────────────────────────────────
//
// This is the Floater's "brain." It picks what to do each frame.
//
// States work like a flow chart:
//
//   HOVER ──(sees player)──► CHASE ──(in range)──► CHARGE
//     ▲                                              │
//     │                                              ▼
//     └──(player far away)──── COOLDOWN ◄────────── FIRE
//
// Each state is a chapter in the instruction booklet.
// The Floater reads the current chapter each frame.
//
// Compared to the Crawler:
//   - Crawler: patrol → chase → pounce (melee jump)
//   - Floater: hover → chase → charge → fire (ranged blast)
//
// The Floater is like a Wizzrobe — it keeps its distance and
// throws magic at you. The Crawler is like a Bokoblin — it runs
// up and swings.

const STATE = {
  HOVER:    'hover',
  CHASE:    'chase',
  CHARGE:   'charge',
  FIRE:     'fire',
  COOLDOWN: 'cooldown',
  HURT:     'hurt',
  DEAD:     'dead',
};

/**
 * Creates the AI data for one Floater instance.
 * Each spawned Floater gets its own copy.
 */
export function createFloaterAI() {
  return {
    state: STATE.HOVER,
    stateTimer: 0,
    hoverCenter: null,        // set on spawn — the point it drifts around
    hoverAngle: 0,            // current angle in the drift circle
    attackCooldown: 0,
    chargeProgress: 0,        // 0→1 as the mind blast charges up
  };
}

/**
 * Runs one frame of Floater AI logic.
 *
 * @param {THREE.Group}   model     — the Floater's 3D model
 * @param {object}        ai        — this Floater's AI data
 * @param {THREE.Vector3} playerPos — where the player is right now
 * @param {number}        dt        — time since last frame (seconds)
 * @returns {object|null}           — { type: 'mind_blast', origin, target } on fire
 */
export function updateFloaterAI(model, ai, playerPos, dt) {
  const pos = model.position;
  const d = model.userData;
  const toPlayer = new THREE.Vector3().subVectors(playerPos, pos);
  const dist = toPlayer.length();

  ai.stateTimer++;
  if (ai.attackCooldown > 0) ai.attackCooldown--;

  // Remember where we spawned so we can drift around that point
  if (!ai.hoverCenter) {
    ai.hoverCenter = pos.clone();
  }

  // --- HOVER ---
  // Drift in a lazy circle around spawn point. Like a jellyfish
  // floating in a tide pool — not going anywhere, just vibing.
  if (ai.state === STATE.HOVER) {
    ai.hoverAngle += 0.005 * dt * 60;
    pos.x = ai.hoverCenter.x + Math.cos(ai.hoverAngle) * 2;
    pos.z = ai.hoverCenter.z + Math.sin(ai.hoverAngle) * 2;

    // Spotted the player?
    if (dist < 15) {
      ai.state = STATE.CHASE;
      ai.stateTimer = 0;
    }
  }

  // --- CHASE ---
  // Drift toward the player, but stop at attack range.
  // The Floater doesn't run up and punch you — it keeps distance.
  // Like a Wizzrobe floating closer to get a clear shot.
  else if (ai.state === STATE.CHASE) {
    // Face the player
    toPlayer.y = 0;
    const facing = Math.atan2(toPlayer.x, toPlayer.z);
    model.rotation.y = facing;

    // Drift closer (slower than the Crawler's chase)
    if (dist > 8) {
      const dir = toPlayer.clone().normalize();
      pos.add(dir.multiplyScalar(0.03 * dt * 60));
    }

    // In range to start charging?
    if (dist <= 12 && dist >= 4 && ai.attackCooldown <= 0) {
      ai.state = STATE.CHARGE;
      ai.stateTimer = 0;
      ai.chargeProgress = 0;
    }

    // Player ran away? Go back to hovering.
    if (dist > 20) {
      ai.state = STATE.HOVER;
      ai.stateTimer = 0;
    }
  }

  // --- CHARGE ---
  // Powering up the mind blast. The core flares brighter,
  // tentacles pull inward, dome contracts.
  // Like when a Wizzrobe raises its staff and the element
  // glows before it throws — you know the attack is coming.
  else if (ai.state === STATE.CHARGE) {
    // Face the player while charging
    toPlayer.y = 0;
    model.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

    // Build charge over 60 frames (~1 second)
    ai.chargeProgress = Math.min(1, ai.stateTimer / 60);

    // Visual: core flares during charge
    if (d.core) {
      const intensity = 1 + ai.chargeProgress * 1.5;
      d.core.scale.setScalar(intensity);
      d.core.material.color.setHSL(0.88, 1, 0.5 + ai.chargeProgress * 0.4);
    }
    if (d.coreLight) {
      d.coreLight.intensity = 1.5 + ai.chargeProgress * 4;
    }

    // Visual: tentacles curl inward (pulling energy in)
    if (d.tentacles) {
      d.tentacles.forEach((segs) => {
        segs.forEach((s) => {
          const curl = ai.chargeProgress * 0.5;
          s.mesh.position.x = s.baseX * (1 - curl);
          s.mesh.position.z = s.baseZ * (1 - curl);
        });
      });
    }

    // Fully charged? FIRE!
    if (ai.chargeProgress >= 1) {
      ai.state = STATE.FIRE;
      ai.stateTimer = 0;
    }
  }

  // --- FIRE ---
  // Release the mind blast. Quick flash, then projectile spawns.
  // Only lasts a few frames — the actual projectile is handled
  // by the game loop (just like the Crawler's pounce returns 'attack').
  else if (ai.state === STATE.FIRE) {
    // Big flash on frame 0
    if (ai.stateTimer === 1) {
      if (d.core) {
        d.core.scale.setScalar(2.5);
        d.core.material.color.setHSL(0.88, 1, 0.95);
      }
      if (d.coreLight) {
        d.coreLight.intensity = 8;
      }
    }

    // Return to normal after 10 frames
    if (ai.stateTimer > 10) {
      ai.state = STATE.COOLDOWN;
      ai.stateTimer = 0;
      ai.attackCooldown = 120; // 2 seconds between blasts

      // Tell the game loop to spawn a projectile
      return {
        type: 'mind_blast',
        origin: pos.clone(),
        target: playerPos.clone(),
        damage: 2,
      };
    }
  }

  // --- COOLDOWN ---
  // Resting after firing. Vulnerable window — like when a
  // Wizzrobe pauses after throwing its spell.
  // Tentacles droop, core dims.
  else if (ai.state === STATE.COOLDOWN) {
    // Slowly drift backward (retreating)
    toPlayer.y = 0;
    if (dist < 8) {
      const away = toPlayer.clone().normalize().multiplyScalar(-0.02 * dt * 60);
      pos.add(away);
    }

    // Visual: core dims during recovery
    if (d.core) {
      d.core.scale.setScalar(0.8);
    }
    if (d.coreLight) {
      d.coreLight.intensity = 0.5;
    }

    // Done resting after 90 frames (~1.5 seconds)
    if (ai.stateTimer > 90) {
      ai.state = STATE.CHASE;
      ai.stateTimer = 0;
    }
  }

  // --- HURT ---
  // Flash hit — dome flickers, core flares, body jolts backward.
  // Shorter than the Crawler's hurt because the Floater is fragile.
  else if (ai.state === STATE.HURT) {
    const t = Math.min(ai.stateTimer / 15, 1);
    const flash = t < 0.3 ? t / 0.3 : Math.max(0, 1 - (t - 0.3) / 0.4);

    // Jolt backward
    model.position.z -= Math.sin(t * Math.PI * 3) * 0.006 * (1 - t);

    // Dome flashes toward white
    if (d.dome) {
      const sr = 0x3b / 255, sg = 0x20 / 255, sb = 0x40 / 255;
      d.dome.material.color.setRGB(
        sr + (1 - sr) * flash,
        sg + (1 - sg) * flash,
        sb + (1 - sb) * flash,
      );
    }

    // Core flares
    if (d.core) {
      d.core.scale.setScalar(1 + flash * 2);
    }
    if (d.coreLight) {
      d.coreLight.intensity = 1.5 + flash * 5;
    }

    if (ai.stateTimer > 15) {
      // Reset visuals
      if (d.dome) d.dome.material.color.set(PALETTE.skin2);
      if (d.core) d.core.scale.setScalar(1);
      if (d.coreLight) d.coreLight.intensity = 1.5;
      ai.state = STATE.CHASE;
      ai.stateTimer = 0;
    }
  }

  // --- DEAD ---
  // The Floater pops like a balloon, then tentacles drift to the floor.
  else if (ai.state === STATE.DEAD) {
    const elapsed = ai.stateTimer / 60;
    if (elapsed < 2) {
      deathPop(model, elapsed / 2);
    }
    if (elapsed > 5) {
      return { type: 'remove' };
    }
  }

  return null;
}


// ─── DEATH ANIMATION ────────────────────────────────────────────
//
// Three phases — like popping a water balloon:
//   1. Dome expands rapidly and goes transparent (0–30%)
//   2. Core bursts bright then fades, tentacles fall (30–80%)
//   3. Everything settles on the floor, fading out (80–100%)

function deathPop(model, t) {
  const d = model.userData;

  if (t < 0.3) {
    // Phase 1: dome expands and fades (the "pop")
    const expand = 1 + (t / 0.3) * 0.8;
    if (d.dome) {
      d.dome.scale.setScalar(expand);
      d.dome.material.opacity = 0.7 * (1 - t / 0.3);
    }
    if (d.core) {
      d.core.scale.setScalar(1 + (t / 0.3) * 3);
      d.core.material.color.setHSL(0.88, 1, 0.5 + (t / 0.3) * 0.5);
    }
    if (d.coreLight) {
      d.coreLight.intensity = 1.5 + (t / 0.3) * 8;
    }
  } else if (t < 0.8) {
    // Phase 2: core fades, tentacles drop
    const fade = (t - 0.3) / 0.5;
    if (d.dome) {
      d.dome.visible = false;
    }
    if (d.core) {
      d.core.scale.setScalar(Math.max(0.1, 1 - fade));
      d.core.material.color.setHSL(0.88, 1 - fade * 0.5, 0.9 - fade * 0.6);
    }
    if (d.coreLight) {
      d.coreLight.intensity = Math.max(0, 6 * (1 - fade));
    }

    // Tentacles fall to ground
    if (d.tentacles) {
      d.tentacles.forEach((segs) => {
        segs.forEach((s) => {
          const groundY = -0.5;
          const dropTarget = groundY + s.seg * 0.02;
          s.mesh.position.y += (dropTarget - s.mesh.position.y) * 0.1;
          // Spread outward as they fall
          s.mesh.position.x = s.baseX * (1 + fade * 0.5);
          s.mesh.position.z = s.baseZ * (1 + fade * 0.5);
        });
      });
    }

    // Folds disappear
    if (d.folds) {
      d.folds.forEach((fold) => { fold.visible = false; });
    }
  } else {
    // Phase 3: everything still, fading
    if (d.core) d.core.visible = false;
    if (d.coreLight) d.coreLight.intensity = 0;
  }
}


// ─── HIT / KILL HELPERS ─────────────────────────────────────────

export function hitFloater(ai) {
  if (ai.state === STATE.DEAD) return;
  ai.state = STATE.HURT;
  ai.stateTimer = 0;
}

export function killFloater(ai) {
  ai.state = STATE.DEAD;
  ai.stateTimer = 0;
}


// ─── 4. BEHAVIOR SPEC ──────────────────────────────────────────
//
// This fills out the "alien form" from behavior.js.
// The game loop reads this to know the Floater's stats.

export const floaterBehavior = createBehaviorSpec({
  type: 'floater',
  health: 2,                 // fragile — fewer hits than a Crawler
  speed: 0.03,
  patrolRange: 8,
  movementType: 'hover',
  attackType: 'ranged',
  attackRange: 12,           // long range — keeps its distance
  attackDamage: 2,           // mind blasts hurt more than a pinch
  attackCooldown: 120,       // 2 seconds between blasts
  projectileSpeed: 0.08,    // how fast the mind blast travels
  walkSpeed: 0,             // no legs!
  walkAmplitude: 0,
  deathType: 'explode',     // pops like a balloon

  onSpawn(model) {
    // Floater hovers 1.5 units off the ground
    model.position.y = 1.5;
    model.userData.baseY = 1.5;
    model.userData.ai = createFloaterAI();
  },

  onUpdate(model, dt, playerPos) {
    const ai = model.userData.ai;
    if (!ai) return null;

    // Run AI brain
    const event = updateFloaterAI(model, ai, playerPos, dt);

    // Animate visuals when alive
    if (ai.state !== STATE.DEAD) {
      animateFloater(model, performance.now() / 1000);
    }

    return event;
  },

  onHit(model) {
    const ai = model.userData.ai;
    if (ai) hitFloater(ai);
  },

  onDeath(model) {
    const ai = model.userData.ai;
    if (ai) killFloater(ai);
  },
});
