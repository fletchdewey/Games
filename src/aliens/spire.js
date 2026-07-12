// src/aliens/spire.js
// The Spire — a mantis-sniper that stalks from range and spits venom.
//
// FLETCHER'S GUIDE:
// This file does THREE things:
//   1. buildSpire()   — assembles the 3D model (the Lego build)
//   2. animateSpire() — makes it walk and throb each frame (the puppet strings)
//   3. spireBehavior  — the AI brain (patrol, stalk, aim, spit, slash)
//
// Think of a Guardian in Breath of the Wild:
//   - It walks around slowly on stilt legs (PATROL)
//   - It spots you and starts circling, keeping distance (STALK)
//   - Its eye locks on and glows bright (AIM)
//   - It fires a laser beam (SPIT)
//   - It pauses while its eye recharges (COOLDOWN)
//   - If you rush it and get close, it swipes (SLASH)
//
// The Spire works the same way, but with a venom sac instead
// of an eye, and blade arms instead of a laser. It WANTS to
// keep you at range — that's where it's dangerous. Up close
// it panics and slashes, but it's weaker there.

import * as THREE from 'three';
import { PALETTE, getMaterial } from '../shared/materials.js';
import { buildLegChain } from '../shared/geometry.js';
import { createBehaviorSpec } from '../shared/behavior.js';


// ─── 1. GEOMETRY ────────────────────────────────────────────────
//
// The Spire is built tall and narrow — the opposite of the
// Crawler's low-and-wide shape. Stilt legs, a thin torso,
// a long segmented neck, and a triangular head.
//
// Two key features:
//   - VENOM SAC: a glowing translucent bulge under the head.
//     It throbs during idle and swells big during the aim state.
//   - BLADE ARMS: not jointed arms like the Brute — just a
//     thin upper arm with a flat blade hanging from it.
//     Like a praying mantis's folded forelegs.

export function buildSpire() {
  const g = new THREE.Group();

  const skinMat  = getMaterial(PALETTE.skin4);
  const boneMat  = getMaterial(PALETTE.bone);
  const glowMat  = getMaterial(PALETTE.glowOrange, { type: 'basic' });
  const eyeMat   = getMaterial(PALETTE.eyeYellow, { type: 'basic' });
  const bladeMat = getMaterial(0x556655);

  // --- Torso ---
  // Thin cylinder, like a mantis's thorax.
  const torsoGeo = new THREE.CylinderGeometry(0.2, 0.15, 1.2, 6);
  const torso = new THREE.Mesh(torsoGeo, skinMat);
  torso.position.y = 0.8;
  torso.castShadow = true;
  g.add(torso);

  // --- Segmented neck ---
  // Four small cylinders stacked with joint balls between them.
  // This is like a snake's spine — lots of small pieces so the
  // neck can bend during animation. Each segment tilts forward
  // slightly so the head pokes out in front of the body.
  const neckSegs = [];
  for (let s = 0; s < 4; s++) {
    const neckGeo = new THREE.CylinderGeometry(0.08 - s * 0.01, 0.08, 0.18, 5);
    const neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.set(0, 1.5 + s * 0.17, 0.05 + s * 0.06);
    neck.rotation.x = -0.15;
    g.add(neck);
    neckSegs.push(neck);

    // Joint ball between segments (skip the first)
    if (s > 0) {
      const jGeo = new THREE.SphereGeometry(0.065, 4, 4);
      const jMesh = new THREE.Mesh(jGeo, skinMat);
      jMesh.position.set(0, 1.5 + s * 0.17 - 0.09, 0.05 + s * 0.06 - 0.03);
      g.add(jMesh);
    }
  }

  // --- Head ---
  // A triangular cone pointing forward, rotated sideways.
  // Like a praying mantis's head — flat and angular.
  const headGeo = new THREE.ConeGeometry(0.3, 0.25, 3);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, 2.15, 0.3);
  head.rotation.x = Math.PI * 0.5;
  head.rotation.z = Math.PI;
  g.add(head);

  // --- Venom sac ---
  // Translucent orange bulge under the head. This is the
  // Spire's "ammo tank" — it swells up before a spit attack,
  // like how a frog's throat puffs out before it croaks.
  const sacGeo = new THREE.SphereGeometry(0.15, 6, 5);
  sacGeo.scale(0.8, 1.2, 1);
  const sacMat = getMaterial(PALETTE.glowOrange, { transparent: true, opacity: 0.6 });
  const sac = new THREE.Mesh(sacGeo, sacMat);
  sac.position.set(0, 1.9, 0.35);
  g.add(sac);

  // Point light inside the sac so it glows onto the neck
  const sacGlow = new THREE.PointLight(0xffaa22, 1, 3);
  sacGlow.position.set(0, 1.9, 0.35);
  g.add(sacGlow);

  // --- Eyes ---
  // Two big yellow eyes, wide-set on the triangular head.
  // Stretched horizontally — like insect compound eyes.
  for (const side of [-1, 1]) {
    const eGeo = new THREE.SphereGeometry(0.1, 6, 5);
    eGeo.scale(0.7, 1, 1);
    const eye = new THREE.Mesh(eGeo, eyeMat);
    eye.position.set(side * 0.22, 2.15, 0.35);
    g.add(eye);
  }

  // --- Blade arms ---
  // Not jointed like the Brute's arms — simpler.
  // A thin upper arm, then a flat blade hanging down.
  // Like a mantis's folded forelegs. The blade swings
  // forward during the slash attack.
  const bladeGroups = [];
  for (const side of [-1, 1]) {
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.3, 1.2, 0.1);
    g.add(armGroup);

    // Upper arm
    const upperGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.6, 5);
    const upper = new THREE.Mesh(upperGeo, skinMat);
    upper.rotation.z = side * 0.6;
    upper.rotation.x = -0.2;
    armGroup.add(upper);

    // Blade
    const bladeGeo = new THREE.BoxGeometry(0.03, 0.7, 0.12);
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(side * 0.25, -0.55, 0.15);
    blade.rotation.z = side * 0.2;
    blade.rotation.x = -0.4;
    armGroup.add(blade);

    // Blade tip
    const tipGeo = new THREE.ConeGeometry(0.04, 0.2, 3);
    const tip = new THREE.Mesh(tipGeo, bladeMat);
    tip.position.set(side * 0.3, -0.95, 0.25);
    tip.rotation.x = -0.5;
    tip.rotation.z = side * 0.2;
    armGroup.add(tip);

    bladeGroups.push({ group: armGroup, side });
  }

  // --- Stilt legs (2, using shared buildLegChain) ---
  // Thin and long, like a wading bird. Narrow stance.
  const legs = [];
  for (const lx of [-0.15, 0.15]) {
    const side = lx > 0 ? 1 : -1;
    const leg = buildLegChain({
      upperLen: 0.55,
      lowerLen: 0.7,
      upperR: 0.06,
      lowerR: 0.025,
      footSize: 0.04,
      skinMat,
      boneMat,
      upperTilt: 0.35,
      lowerTilt: -0.7,
    });
    leg.hip.position.set(lx, 0.2, -0.05);
    g.add(leg.hip);
    legs.push({ ...leg, side, baseUpperTilt: 0.35, baseLowerTilt: -0.7 });
  }

  // --- Spine quills ---
  // Five small cones running down the back — like a stegosaurus
  // but much smaller. Decorative, not animated.
  for (let i = 0; i < 5; i++) {
    const quillGeo = new THREE.ConeGeometry(0.02, 0.25 - i * 0.03, 3);
    const quill = new THREE.Mesh(quillGeo, boneMat);
    quill.position.set(0, 0.5 + i * 0.22, -0.2);
    quill.rotation.x = -0.6;
    g.add(quill);
  }

  // --- Glow dots ---
  // Three orange dots running up the front of the neck.
  // Subtle bioluminescence, like sensor lights.
  const glowDots = [];
  for (let i = 0; i < 3; i++) {
    const dotGeo = new THREE.SphereGeometry(0.03, 4, 4);
    const dot = new THREE.Mesh(dotGeo, glowMat);
    dot.position.set(0, 1.55 + i * 0.18, 0.15);
    g.add(dot);
    glowDots.push(dot);
  }

  // --- Store references for animation ---
  g.userData.legs = legs;
  g.userData.neckSegs = neckSegs;
  g.userData.head = head;
  g.userData.sac = sac;
  g.userData.sacGlow = sacGlow;
  g.userData.bladeGroups = bladeGroups;
  g.userData.glowDots = glowDots;
  g.userData.type = 'spire';

  return g;
}


// ─── 2. ANIMATION ───────────────────────────────────────────────
//
// Called every frame. Two things happen:
//   1. Walk cycle on the stilt legs (same pattern as Crawler,
//      but slower and with bigger swings — long legs, big steps)
//   2. Venom sac throbs (like a heartbeat)
//
// The walk looks like a heron — slow, deliberate, high steps.
// Very different from the Crawler's frantic scurrying.

export function animateSpire(model, time) {
  const d = model.userData;

  // --- Walk cycle ---
  // Slower than Crawler (speed 4 vs 12), bigger amplitude (0.25 vs 0.15).
  // Two legs alternate like a person walking.
  const speed = 4;
  const amp = 0.25;

  if (d.legs) {
    d.legs.forEach((leg, i) => {
      const phase = (i / d.legs.length) * Math.PI * 2;
      const cycle = Math.sin(time * speed + phase);
      leg.upper.rotation.x = leg.baseUpperTilt + cycle * amp;
      leg.lower.rotation.x = leg.baseLowerTilt - Math.abs(cycle) * amp * 0.6;
    });
  }

  // Body bob — slight up/down
  const baseY = model.userData.baseY || 0;
  const bob = Math.abs(Math.sin(time * speed * 2)) * 0.025;
  model.position.y = baseY + bob;
  model.rotation.z = Math.sin(time * speed) * 0.015;

  // --- Venom sac throb ---
  // Slow pulse, like a heartbeat. The sac swells and shrinks.
  if (d.sac) {
    const throb = 1 + Math.sin(time * 3) * 0.15;
    d.sac.scale.set(0.8 * throb, 1.2 * throb, throb);
  }
  if (d.sacGlow) {
    d.sacGlow.intensity = 1 + Math.sin(time * 3) * 0.5;
  }
}


// ─── 3. AI STATE MACHINE ────────────────────────────────────────
//
// The Spire's brain. It's a sniper — it WANTS distance.
//
// States:
//
//   PATROL ──(sees player)──► STALK ──(good range)──► AIM
//     ▲                         ▲                      │
//     │                         │                      ▼
//     │                         └─── COOLDOWN ◄────── SPIT
//     │
//     └──(player far away)──────────────────────────────┘
//
//   STALK ──(player too close!)──► SLASH ──(recover)──► STALK
//
// The key difference from the Floater:
//   - Floater drifts toward you, fires, then retreats
//   - Spire circles you at range, aims carefully, fires, then
//     repositions. If you rush it, it panics and slashes.
//
// In Zelda terms:
//   - Floater = Wizzrobe (float, blast, float)
//   - Spire = Guardian (lock on, charge, FIRE, recharge)

const STATE = {
  PATROL:   'patrol',
  STALK:    'stalk',
  AIM:      'aim',
  SPIT:     'spit',
  COOLDOWN: 'cooldown',
  SLASH:    'slash',
  HURT:     'hurt',
  DEAD:     'dead',
};

export function createSpireAI() {
  return {
    state: STATE.PATROL,
    stateTimer: 0,
    patrolDir: 1,
    patrolDist: 0,
    attackCooldown: 0,
    aimProgress: 0,       // 0→1 as the sac charges
    strafeDir: 1,         // 1 = circle clockwise, -1 = counter
  };
}

/**
 * Runs one frame of Spire AI logic.
 *
 * @param {THREE.Group}   model     — the Spire's 3D model
 * @param {object}        ai        — this Spire's AI data
 * @param {THREE.Vector3} playerPos — where the player is
 * @param {number}        dt        — time since last frame (seconds)
 * @returns {object|null}           — attack event or 'remove'
 */
export function updateSpireAI(model, ai, playerPos, dt) {
  const pos = model.position;
  const d = model.userData;
  const toPlayer = new THREE.Vector3().subVectors(playerPos, pos);
  const dist = toPlayer.length();

  ai.stateTimer++;
  if (ai.attackCooldown > 0) ai.attackCooldown--;

  // --- PATROL ---
  // Slow deliberate walk. Like a heron stalking through grass.
  if (ai.state === STATE.PATROL) {
    pos.x += ai.patrolDir * 0.012 * dt * 60;
    ai.patrolDist += Math.abs(0.012 * dt * 60);

    if (ai.patrolDist > 6) {
      ai.patrolDir *= -1;
      ai.patrolDist = 0;
    }

    if (dist < 14) {
      ai.state = STATE.STALK;
      ai.stateTimer = 0;
      // Pick a random circle direction
      ai.strafeDir = Math.random() > 0.5 ? 1 : -1;
    }
  }

  // --- STALK ---
  // Circle the player at preferred range (8–12 units).
  // Like a Guardian that walks sideways while watching you.
  // The Spire keeps its head aimed at the player the whole time.
  else if (ai.state === STATE.STALK) {
    // Always face the player
    toPlayer.y = 0;
    model.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

    // Maintain distance: back up if too close, approach if too far
    const idealDist = 10;
    if (dist < 6) {
      // TOO CLOSE — blade slash!
      if (ai.attackCooldown <= 0) {
        ai.state = STATE.SLASH;
        ai.stateTimer = 0;
      } else {
        // Can't slash yet, just back up
        const away = toPlayer.clone().normalize().multiplyScalar(-0.04 * dt * 60);
        pos.add(away);
      }
    } else if (dist < idealDist - 2) {
      // Drift backward
      const away = toPlayer.clone().normalize().multiplyScalar(-0.02 * dt * 60);
      pos.add(away);
    } else if (dist > idealDist + 2) {
      // Approach
      const toward = toPlayer.clone().normalize().multiplyScalar(0.025 * dt * 60);
      pos.add(toward);
    }

    // Strafe sideways (circle the player)
    const right = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).normalize();
    pos.add(right.multiplyScalar(ai.strafeDir * 0.015 * dt * 60));

    // Ready to aim?
    if (dist >= 6 && dist <= 14 && ai.attackCooldown <= 0 && ai.stateTimer > 30) {
      ai.state = STATE.AIM;
      ai.stateTimer = 0;
      ai.aimProgress = 0;
    }

    // Player ran away?
    if (dist > 20) {
      ai.state = STATE.PATROL;
      ai.stateTimer = 0;
    }
  }

  // --- AIM ---
  // Locking on. Venom sac swells, neck extends, glow dots flare.
  // Like when a Guardian's eye starts beeping faster and faster.
  // The player can see this coming and dodge — that's fair.
  else if (ai.state === STATE.AIM) {
    // Stay facing the player (tracking)
    toPlayer.y = 0;
    model.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

    // Stand still while aiming (no strafing)
    ai.aimProgress = Math.min(1, ai.stateTimer / 75); // ~1.25 seconds

    // Visual: sac swells
    if (d.sac) {
      const swell = 1 + ai.aimProgress * 0.8;
      d.sac.scale.set(0.8 * swell, 1.2 * swell, swell);
    }
    if (d.sacGlow) {
      d.sacGlow.intensity = 1 + ai.aimProgress * 4;
    }

    // Visual: glow dots flare
    if (d.glowDots) {
      d.glowDots.forEach((dot) => {
        dot.scale.setScalar(1 + ai.aimProgress * 2);
      });
    }

    // Visual: neck extends forward slightly
    if (d.neckSegs) {
      d.neckSegs.forEach((seg, i) => {
        seg.rotation.x = -0.15 - ai.aimProgress * 0.1 * (i + 1);
      });
    }

    // Player rushed in? Abort aim, slash instead.
    if (dist < 4) {
      resetSpireVisuals(d);
      ai.state = STATE.SLASH;
      ai.stateTimer = 0;
    }

    // Fully aimed? SPIT!
    if (ai.aimProgress >= 1) {
      ai.state = STATE.SPIT;
      ai.stateTimer = 0;
    }
  }

  // --- SPIT ---
  // Fire the venom glob. Quick burst — sac deflates, head lunges.
  else if (ai.state === STATE.SPIT) {
    // Frame 1: big flash
    if (ai.stateTimer === 1) {
      if (d.sac) d.sac.scale.setScalar(2.0);
      if (d.sacGlow) d.sacGlow.intensity = 8;
      // Head lunge forward
      if (d.head) d.head.position.z = 0.45;
    }

    // Sac rapidly deflates over ~15 frames
    if (d.sac) {
      const deflate = Math.max(0.3, 1 - ai.stateTimer / 15);
      d.sac.scale.setScalar(deflate);
    }
    if (d.sacGlow) {
      d.sacGlow.intensity = Math.max(0.3, 8 - ai.stateTimer * 0.5);
    }

    if (ai.stateTimer > 15) {
      resetSpireVisuals(d);
      ai.state = STATE.COOLDOWN;
      ai.stateTimer = 0;
      ai.attackCooldown = 150; // 2.5 seconds

      return {
        type: 'venom_spit',
        origin: pos.clone().add(new THREE.Vector3(0, 2.0, 0)),
        target: playerPos.clone(),
        damage: 2,
      };
    }
  }

  // --- COOLDOWN ---
  // Sac is empty, recharging. Spire repositions.
  // Vulnerable window — like a Guardian after it fires.
  else if (ai.state === STATE.COOLDOWN) {
    // Face the player but strafe to reposition
    toPlayer.y = 0;
    model.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

    // Strafe to a new angle (change direction)
    ai.strafeDir *= -1;
    const right = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).normalize();
    pos.add(right.multiplyScalar(ai.strafeDir * 0.02 * dt * 60));

    // Sac slowly refills
    if (d.sac) {
      const refill = Math.min(1, ai.stateTimer / 90);
      d.sac.scale.set(0.8 * (0.3 + refill * 0.7), 1.2 * (0.3 + refill * 0.7), 0.3 + refill * 0.7);
    }
    if (d.sacGlow) {
      d.sacGlow.intensity = 0.3 + (ai.stateTimer / 90) * 0.7;
    }

    if (ai.stateTimer > 90) {
      resetSpireVisuals(d);
      ai.state = STATE.STALK;
      ai.stateTimer = 0;
    }
  }

  // --- SLASH ---
  // Emergency melee! Player got too close.
  // Blade arms swing forward in an X-pattern.
  // Fast but telegraphed — the arms pull back first (windup).
  else if (ai.state === STATE.SLASH) {
    const progress = Math.min(1, ai.stateTimer / 30); // 0.5 seconds

    if (d.bladeGroups) {
      d.bladeGroups.forEach(({ group, side }) => {
        if (progress < 0.3) {
          // Windup: pull arms back
          group.rotation.x = -(progress / 0.3) * 0.6;
        } else {
          // Swing forward
          const swing = (progress - 0.3) / 0.7;
          group.rotation.x = -0.6 + swing * 1.8;
          group.rotation.z = side * swing * 0.3;
        }
      });
    }

    // Deal damage at the swing point (~60% through)
    if (ai.stateTimer === 18) {
      // Return slash event
      resetSpireVisuals(d);
      ai.attackCooldown = 60;
      return {
        type: 'blade_slash',
        origin: pos.clone(),
        damage: 1,
        range: 3,
      };
    }

    if (ai.stateTimer > 30) {
      // Reset blade positions
      if (d.bladeGroups) {
        d.bladeGroups.forEach(({ group }) => {
          group.rotation.x = 0;
          group.rotation.z = 0;
        });
      }
      ai.state = STATE.STALK;
      ai.stateTimer = 0;
    }
  }

  // --- HURT ---
  // Flash hit — sac flickers, body jolts, neck snaps back.
  else if (ai.state === STATE.HURT) {
    const t = Math.min(ai.stateTimer / 20, 1);
    const flash = t < 0.3 ? t / 0.3 : Math.max(0, 1 - (t - 0.3) / 0.4);

    // Body jolt
    model.position.z += Math.sin(t * Math.PI * 3) * 0.005 * (1 - t);

    // Neck snaps backward
    if (d.neckSegs) {
      d.neckSegs.forEach((seg, i) => {
        seg.rotation.x = -0.15 + flash * 0.2 * (i + 1);
      });
    }

    // Sac flickers
    if (d.sacGlow) {
      d.sacGlow.intensity = 1 + flash * 4;
    }

    // Glow dots flare
    if (d.glowDots) {
      d.glowDots.forEach((dot) => {
        dot.scale.setScalar(1 + flash * 2);
      });
    }

    if (ai.stateTimer > 20) {
      resetSpireVisuals(d);
      ai.state = STATE.STALK;
      ai.stateTimer = 0;
    }
  }

  // --- DEAD ---
  // Stilt legs buckle, body topples sideways like a felled tree.
  else if (ai.state === STATE.DEAD) {
    const elapsed = ai.stateTimer / 60;
    if (elapsed < 2.5) {
      deathTopple(model, elapsed / 2.5);
    }
    if (elapsed > 5) {
      return { type: 'remove' };
    }
  }

  return null;
}


// ─── DEATH ANIMATION ────────────────────────────────────────────
//
// Three phases — like a tree falling:
//   1. Legs buckle inward (0–30%)
//   2. Body tilts and falls sideways (30–70%)
//   3. Lying on the ground, sac fades out (70–100%)

function deathTopple(model, t) {
  const d = model.userData;

  if (t < 0.3) {
    // Phase 1: legs buckle
    const buckle = t / 0.3;
    if (d.legs) {
      d.legs.forEach((leg) => {
        leg.upper.rotation.x = leg.baseUpperTilt + buckle * 0.8;
        leg.lower.rotation.x = leg.baseLowerTilt - buckle * 0.5;
      });
    }
    // Sac starts flickering
    if (d.sacGlow) {
      d.sacGlow.intensity = 1 + Math.sin(t * 60) * 2;
    }
  } else if (t < 0.7) {
    // Phase 2: topple sideways
    const fall = (t - 0.3) / 0.4;
    model.rotation.z = fall * (Math.PI * 0.45);
    model.position.y = (model.userData.baseY || 0) - fall * 0.5;

    // Neck goes limp
    if (d.neckSegs) {
      d.neckSegs.forEach((seg, i) => {
        seg.rotation.x = -0.15 + fall * 0.4 * (i + 1);
      });
    }

    // Sac dims
    if (d.sacGlow) {
      d.sacGlow.intensity = Math.max(0, 1 - fall);
    }
    if (d.sac) {
      d.sac.material.opacity = 0.6 * (1 - fall);
    }
  } else {
    // Phase 3: lying still
    model.rotation.z = Math.PI * 0.45;
    if (d.sacGlow) d.sacGlow.intensity = 0;
    if (d.sac) d.sac.visible = false;
    if (d.glowDots) {
      d.glowDots.forEach((dot) => { dot.visible = false; });
    }
  }
}


// ─── VISUAL RESET HELPER ────────────────────────────────────────

function resetSpireVisuals(d) {
  if (d.sac) d.sac.scale.set(0.8, 1.2, 1);
  if (d.sacGlow) d.sacGlow.intensity = 1;
  if (d.glowDots) {
    d.glowDots.forEach((dot) => dot.scale.setScalar(1));
  }
  if (d.neckSegs) {
    d.neckSegs.forEach((seg) => { seg.rotation.x = -0.15; });
  }
  if (d.head) d.head.position.z = 0.3;
  if (d.bladeGroups) {
    d.bladeGroups.forEach(({ group }) => {
      group.rotation.x = 0;
      group.rotation.z = 0;
    });
  }
}


// ─── HIT / KILL HELPERS ─────────────────────────────────────────

export function hitSpire(ai) {
  if (ai.state === STATE.DEAD) return;
  ai.state = STATE.HURT;
  ai.stateTimer = 0;
}

export function killSpire(ai) {
  ai.state = STATE.DEAD;
  ai.stateTimer = 0;
}


// ─── 4. BEHAVIOR SPEC ──────────────────────────────────────────

export const spireBehavior = createBehaviorSpec({
  type: 'spire',
  health: 3,
  speed: 0.025,               // slow — it's a sniper, not a sprinter
  patrolRange: 6,
  movementType: 'patrol',
  canStrafe: true,             // circles the player

  attackType: 'ranged',
  attackRange: 14,             // longest range of the regular aliens
  attackDamage: 2,
  attackCooldown: 150,         // 2.5 seconds — slow but painful
  projectileSpeed: 0.06,       // venom glob speed

  walkSpeed: 4,
  walkAmplitude: 0.25,

  deathType: 'collapse',       // topples like a tree

  onSpawn(model) {
    model.position.y = 0.3;
    model.userData.baseY = 0.3;
    model.userData.ai = createSpireAI();
  },

  onUpdate(model, dt, playerPos) {
    const ai = model.userData.ai;
    if (!ai) return null;

    const event = updateSpireAI(model, ai, playerPos, dt);

    if (ai.state !== STATE.DEAD) {
      animateSpire(model, performance.now() / 1000);
    }

    return event;
  },

  onHit(model) {
    const ai = model.userData.ai;
    if (ai) hitSpire(ai);
  },

  onDeath(model) {
    const ai = model.userData.ai;
    if (ai) killSpire(ai);
  },
});
