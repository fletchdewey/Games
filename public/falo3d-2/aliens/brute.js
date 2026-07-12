// src/aliens/brute.js
// The Brute — a gorilla-tank that charges and pounds the ground.
//
// FLETCHER'S GUIDE:
// This file does THREE things:
//   1. buildBrute()   — assembles the 3D model (the Lego build)
//   2. animateBrute() — makes it walk and swing each frame (the puppet strings)
//   3. bruteBehavior  — the AI brain (patrol, chase, charge, slam, recover)
//
// Think of a Hinox in Breath of the Wild:
//   - It lumbers around slowly (PATROL)
//   - It spots you and starts walking faster (CHASE)
//   - It winds up and CHARGES straight at you (CHARGE)
//   - It slams the ground where you were standing (SLAM)
//   - It stumbles after the slam — you can shoot it (RECOVER)
//
// The Brute is the opposite of the Spire:
//   - Spire is thin, fragile, keeps distance, snipes
//   - Brute is wide, tanky, closes distance, smashes
// They work together in a room — the Spire pins you down
// while the Brute charges in. That's the strategy.

import * as THREE from 'three';
import { PALETTE, getMaterial } from '../shared/materials.js?v=72fce17f30';
import { buildLegChain } from '../shared/geometry.js?v=72fce17f30';
import { createBehaviorSpec } from '../shared/behavior.js?v=72fce17f30';


// ─── 1. GEOMETRY ────────────────────────────────────────────────
//
// Big body, tiny head, massive arms, thick legs.
// Hunched over with spine plates running down the back.
// Like a gorilla crossed with a rhino.

export function buildBrute() {
  const g = new THREE.Group();

  const skinMat  = getMaterial(PALETTE.skin3);
  const boneMat  = getMaterial(PALETTE.bone);
  const armorMat = getMaterial(PALETTE.armor);
  const glowMat  = getMaterial(PALETTE.glowCyan, { type: 'basic' });
  const eyeMat   = getMaterial(PALETTE.eyeRed, { type: 'basic' });

  // --- Torso ---
  // Huge and hunched forward. The hunch is done with rotation.
  const torsoGeo = new THREE.SphereGeometry(0.7, 7, 6);
  torsoGeo.scale(1.1, 1.0, 0.9);
  const torso = new THREE.Mesh(torsoGeo, skinMat);
  torso.position.y = 0.8;
  torso.rotation.x = 0.4; // hunched forward
  torso.castShadow = true;
  g.add(torso);

  // --- Spine plates ---
  // Five armored plates following the curve of the hunch.
  // Each one sits at a tangent to the arc — like a stegosaurus.
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const angle = -0.4 + t * 1.2;
    const radius = 0.75;
    const curveY = 0.8 + Math.sin(angle) * radius * 0.6;
    const curveZ = -0.1 - Math.cos(angle) * radius * 0.55;
    const plateGeo = new THREE.BoxGeometry(0.45 - i * 0.06, 0.1, 0.3 - i * 0.03);
    const plate = new THREE.Mesh(plateGeo, armorMat);
    plate.position.set(0, curveY, curveZ);
    plate.rotation.x = angle - 0.2;
    g.add(plate);
  }

  // --- Head ---
  // Tiny compared to the body — like a gorilla's proportions.
  const headGeo = new THREE.SphereGeometry(0.25, 6, 5);
  headGeo.scale(0.9, 0.8, 1.1);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, 1.45, 0.35);
  g.add(head);

  // Brow ridge
  const browGeo = new THREE.BoxGeometry(0.45, 0.08, 0.2);
  const brow = new THREE.Mesh(browGeo, armorMat);
  brow.position.set(0, 1.52, 0.48);
  g.add(brow);

  // Eyes (in deep sockets)
  for (const ex of [-0.1, 0.1]) {
    const sockGeo = new THREE.SphereGeometry(0.06, 4, 4);
    const sock = new THREE.Mesh(sockGeo, getMaterial(0x0a0a15));
    sock.position.set(ex, 1.45, 0.52);
    g.add(sock);
    const eGeo = new THREE.SphereGeometry(0.035, 4, 4);
    const eye = new THREE.Mesh(eGeo, eyeMat);
    eye.position.set(ex, 1.45, 0.56);
    g.add(eye);
  }

  // Jaw
  const jawGeo = new THREE.SphereGeometry(0.18, 5, 4);
  jawGeo.scale(1.2, 0.6, 1);
  const jaw = new THREE.Mesh(jawGeo, skinMat);
  jaw.position.set(0, 1.32, 0.45);
  g.add(jaw);

  // Tusks
  for (const tx of [-0.12, 0.12]) {
    const tuskGeo = new THREE.ConeGeometry(0.03, 0.2, 4);
    const tusk = new THREE.Mesh(tuskGeo, boneMat);
    tusk.position.set(tx, 1.38, 0.55);
    tusk.rotation.x = -0.3;
    g.add(tusk);
  }

  // --- Arms ---
  // Massive — longer than the legs. Built as a hierarchy
  // (shoulder → upper → elbow → forearm → fist) so they
  // swing properly during the walk cycle and slam attack.
  const arms = [];
  for (const side of [-1, 1]) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 0.65, 1.1, 0.1);
    g.add(shoulderPivot);

    const shoulderGeo = new THREE.SphereGeometry(0.25, 6, 5);
    const shoulder = new THREE.Mesh(shoulderGeo, skinMat);
    shoulderPivot.add(shoulder);

    const upperGeo = new THREE.CylinderGeometry(0.16, 0.13, 0.8, 6);
    upperGeo.translate(0, -0.4, 0);
    const upper = new THREE.Mesh(upperGeo, skinMat);
    upper.rotation.z = side * 0.2;
    shoulderPivot.add(upper);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.8, 0);
    upper.add(elbowPivot);

    const elbowGeo = new THREE.SphereGeometry(0.13, 5, 5);
    const elbow = new THREE.Mesh(elbowGeo, skinMat);
    elbowPivot.add(elbow);

    const foreGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.9, 6);
    foreGeo.translate(0, -0.45, 0);
    const fore = new THREE.Mesh(foreGeo, skinMat);
    fore.rotation.x = -0.3;
    elbowPivot.add(fore);

    // Big fist at the end — child of forearm so it follows rotation
    const fistGeo = new THREE.SphereGeometry(0.18, 5, 5);
    const fist = new THREE.Mesh(fistGeo, skinMat);
    fist.position.set(0, -0.9, 0);
    fore.add(fist);

    // Knuckle spikes — also children of forearm
    for (let k = -1; k <= 1; k++) {
      const spikeGeo = new THREE.ConeGeometry(0.025, 0.12, 3);
      const spike = new THREE.Mesh(spikeGeo, boneMat);
      spike.position.set(k * 0.06, -0.95, 0.15);
      spike.rotation.x = -0.5;
      fore.add(spike);
    }

    arms.push({ shoulderPivot, elbowPivot, upper, fore, side });
  }

  // --- Legs (2, using shared buildLegChain) ---
  // Short and thick — stubby compared to the massive torso.
  const legs = [];
  for (const lx of [-0.3, 0.3]) {
    const side = lx > 0 ? 1 : -1;
    const leg = buildLegChain({
      upperLen: 0.4,
      lowerLen: 0.35,
      upperR: 0.14,
      lowerR: 0.12,
      footSize: null,
      skinMat,
      boneMat,
      upperTilt: 0.2,
      lowerTilt: -0.4,
    });
    leg.hip.position.set(lx, 0.3, 0);
    g.add(leg.hip);

    // Flat armored feet (not claws)
    const footGeo = new THREE.BoxGeometry(0.2, 0.08, 0.25);
    const foot = new THREE.Mesh(footGeo, armorMat);
    leg.footGroup.add(foot);

    legs.push({ ...leg, side, baseUpperTilt: 0.2, baseLowerTilt: -0.4 });
  }

  // --- Glow nodes ---
  // Cyan dots on the shoulders and chest
  for (const side of [-1, 1]) {
    const gGeo = new THREE.SphereGeometry(0.06, 4, 4);
    const gMesh = new THREE.Mesh(gGeo, glowMat);
    gMesh.position.set(side * 0.7, 1.3, 0.1);
    g.add(gMesh);
  }
  const chestGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 4, 4), glowMat
  );
  chestGlow.position.set(0, 0.9, 0.6);
  g.add(chestGlow);

  const glowMeshes = [chestGlow];

  // --- Store references ---
  g.userData.legs = legs;
  g.userData.arms = arms;
  g.userData.glowMeshes = glowMeshes;
  g.userData.head = head;
  g.userData.type = 'brute';

  return g;
}


// ─── 2. ANIMATION ───────────────────────────────────────────────
//
// Slow, heavy walk. Arms swing opposite to legs (like how
// you walk — left leg forward, right arm forward).
// Body bobs more than the Crawler because it's heavier.

export function animateBrute(model, time) {
  const d = model.userData;
  const speed = 3;
  const amp = 0.2;

  // Leg walk cycle
  if (d.legs) {
    d.legs.forEach((leg, i) => {
      const phase = (i / d.legs.length) * Math.PI * 2;
      const cycle = Math.sin(time * speed + phase);
      leg.upper.rotation.x = leg.baseUpperTilt + cycle * amp;
      leg.lower.rotation.x = leg.baseLowerTilt - Math.abs(cycle) * amp * 0.6;
    });
  }

  // Arm swing — opposite phase to legs
  if (d.arms) {
    d.arms.forEach((arm) => {
      const swing = Math.sin(time * speed + (arm.side > 0 ? Math.PI : 0));
      arm.shoulderPivot.rotation.x = swing * 0.2;
      arm.elbowPivot.rotation.x = -0.3 + Math.abs(swing) * 0.15;
    });
  }

  // Heavy body bob
  const baseY = model.userData.baseY || 0;
  const bob = Math.abs(Math.sin(time * speed * 2)) * 0.04;
  model.position.y = baseY + bob;
  model.rotation.z = Math.sin(time * speed) * 0.02;
}


// ─── 3. AI STATE MACHINE ────────────────────────────────────────
//
//   PATROL ──(sees player)──► CHASE ──(close enough)──► CHARGE
//     ▲                                                   │
//     │                                                   ▼
//     └──(player far)──── RECOVER ◄──────────────────── SLAM
//
// The charge is the key mechanic. Once the Brute starts
// charging, it COMMITS — it can barely turn. If you sidestep
// it, it slams empty ground and stumbles. That's the window.
//
// Like a Hinox belly-flop: dodge it and you get free hits.
// Stand still and you eat massive damage.

const STATE = {
  PATROL:  'patrol',
  CHASE:   'chase',
  CHARGE:  'charge',
  SLAM:    'slam',
  RECOVER: 'recover',
  HURT:    'hurt',
  DEAD:    'dead',
};

export function createBruteAI() {
  return {
    state: STATE.PATROL,
    stateTimer: 0,
    patrolDir: 1,
    patrolDist: 0,
    attackCooldown: 0,
    chargeDir: null,       // locked direction during charge
    chargeSpeed: 0,
  };
}

export function updateBruteAI(model, ai, playerPos, dt) {
  const pos = model.position;
  const d = model.userData;
  const toPlayer = new THREE.Vector3().subVectors(playerPos, pos);
  const dist = toPlayer.length();

  ai.stateTimer++;
  if (ai.attackCooldown > 0) ai.attackCooldown--;

  // --- PATROL ---
  if (ai.state === STATE.PATROL) {
    pos.x += ai.patrolDir * 0.01 * dt * 60;
    ai.patrolDist += Math.abs(0.01 * dt * 60);
    if (ai.patrolDist > 5) { ai.patrolDir *= -1; ai.patrolDist = 0; }

    if (dist < 14) {
      ai.state = STATE.CHASE;
      ai.stateTimer = 0;
    }
  }

  // --- CHASE ---
  // Walk toward player at normal speed. Face them.
  // When close enough and cooldown is up, start charging.
  else if (ai.state === STATE.CHASE) {
    toPlayer.y = 0;
    model.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

    if (dist > 3) {
      const dir = toPlayer.clone().normalize();
      pos.add(dir.multiplyScalar(0.035 * dt * 60));
    }

    // Close enough to charge?
    if (dist < 10 && dist > 3 && ai.attackCooldown <= 0) {
      ai.state = STATE.CHARGE;
      ai.stateTimer = 0;
      ai.chargeSpeed = 0;
      // Lock the charge direction — can only steer slightly
      ai.chargeDir = toPlayer.clone();
      ai.chargeDir.y = 0;
      ai.chargeDir.normalize();
    }

    if (dist > 18) {
      ai.state = STATE.PATROL;
      ai.stateTimer = 0;
    }
  }

  // --- CHARGE ---
  // COMMITTED rush. Accelerates to high speed but can barely turn.
  // Arms pull back during windup, then pump during sprint.
  // Lasts about 1.5 seconds, then auto-slams.
  else if (ai.state === STATE.CHARGE) {
    // Accelerate over the first 20 frames
    ai.chargeSpeed = Math.min(0.12, ai.chargeSpeed + 0.004 * dt * 60);

    // Slight steering toward player (not much — it's committed)
    const steer = new THREE.Vector3().subVectors(playerPos, pos);
    steer.y = 0;
    steer.normalize();
    ai.chargeDir.lerp(steer, 0.02); // very slow correction
    ai.chargeDir.normalize();

    pos.add(ai.chargeDir.clone().multiplyScalar(ai.chargeSpeed * dt * 60));
    model.rotation.y = Math.atan2(ai.chargeDir.x, ai.chargeDir.z);

    // Visual: lean forward, arms back
    model.rotation.x = -0.2;
    if (d.arms) {
      d.arms.forEach((arm) => {
        arm.shoulderPivot.rotation.x = -0.8 + Math.sin(ai.stateTimer * 0.3) * 0.3;
      });
    }

    // Slam after 90 frames or if close enough
    const chargeTime = ai.stateTimer > 90;
    const reachedPlayer = dist < 2.5;
    if (chargeTime || reachedPlayer) {
      ai.state = STATE.SLAM;
      ai.stateTimer = 0;
    }
  }

  // --- SLAM ---
  // Ground pound! Arms smash down, shockwave.
  // Quick animation, then damage check.
  else if (ai.state === STATE.SLAM) {
    // Slam animation over 20 frames
    const progress = Math.min(1, ai.stateTimer / 20);

    model.rotation.x = -0.2 + progress * 0.4; // lurch forward
    if (d.arms) {
      d.arms.forEach((arm) => {
        // Arms swing from behind to slamming down
        arm.shoulderPivot.rotation.x = -0.8 + progress * 1.6;
        arm.elbowPivot.rotation.x = -0.3 - progress * 0.5;
      });
    }

    // Damage at the impact frame (~60% through)
    if (ai.stateTimer === 12) {
      if (dist < 3.5) {
        ai.state = STATE.RECOVER;
        ai.stateTimer = 0;
        ai.attackCooldown = 120;
        return {
          type: 'ground_slam',
          origin: pos.clone(),
          damage: 4,
          range: 3.5,
        };
      }
    }

    if (ai.stateTimer > 20) {
      ai.state = STATE.RECOVER;
      ai.stateTimer = 0;
      ai.attackCooldown = 120; // 2 seconds
    }
  }

  // --- RECOVER ---
  // Stumbling after the slam. Vulnerable — like a Hinox
  // after it belly-flops and flails on the ground.
  else if (ai.state === STATE.RECOVER) {
    // Reset posture gradually
    const t = Math.min(ai.stateTimer / 60, 1);
    model.rotation.x = 0.2 * (1 - t);

    if (d.arms) {
      d.arms.forEach((arm) => {
        arm.shoulderPivot.rotation.x = 0.8 * (1 - t);
        arm.elbowPivot.rotation.x = -0.3;
      });
    }

    // Wobble while recovering
    model.rotation.z = Math.sin(ai.stateTimer * 0.2) * 0.08 * (1 - t);

    if (ai.stateTimer > 75) {
      model.rotation.x = 0;
      model.rotation.z = 0;
      ai.state = STATE.CHASE;
      ai.stateTimer = 0;
    }
  }

  // --- HURT ---
  // The Brute barely flinches — it's a tank.
  // Just a small stagger and glow flare. Short duration.
  else if (ai.state === STATE.HURT) {
    const t = Math.min(ai.stateTimer / 12, 1);
    const flash = t < 0.3 ? t / 0.3 : Math.max(0, 1 - (t - 0.3) / 0.4);

    // Tiny stagger (it's tough)
    model.position.z += Math.sin(t * Math.PI * 2) * 0.003 * (1 - t);

    // Glow flare
    if (d.glowMeshes) {
      d.glowMeshes.forEach((gm) => {
        gm.scale.setScalar(1 + flash * 1.5);
      });
    }

    if (ai.stateTimer > 12) {
      if (d.glowMeshes) {
        d.glowMeshes.forEach((gm) => gm.scale.setScalar(1));
      }
      ai.state = STATE.CHASE;
      ai.stateTimer = 0;
    }
  }

  // --- DEAD ---
  // Falls forward like a felled tree. Heavy thud.
  else if (ai.state === STATE.DEAD) {
    const elapsed = ai.stateTimer / 60;
    if (elapsed < 2) {
      deathFall(model, elapsed / 2);
    }
    if (elapsed > 5) {
      return { type: 'remove' };
    }
  }

  return null;
}


// ─── DEATH ANIMATION ────────────────────────────────────────────
//
// Three phases — like a building collapsing:
//   1. Legs give out, body sinks (0–30%)
//   2. Topples forward onto its face (30–70%)
//   3. Arms splay out, still (70–100%)

function deathFall(model, t) {
  const d = model.userData;
  const baseY = model.userData.baseY || 0;

  if (t < 0.3) {
    // Legs buckle
    const buckle = t / 0.3;
    if (d.legs) {
      d.legs.forEach((leg) => {
        leg.upper.rotation.x = leg.baseUpperTilt + buckle * 0.6;
        leg.lower.rotation.x = leg.baseLowerTilt - buckle * 0.4;
      });
    }
    model.position.y = baseY - buckle * 0.3;
  } else if (t < 0.7) {
    // Topple forward
    const fall = (t - 0.3) / 0.4;
    model.rotation.x = fall * (Math.PI * 0.35);
    model.position.y = baseY - 0.3 - fall * 0.4;

    // Arms go limp, splay outward
    if (d.arms) {
      d.arms.forEach((arm) => {
        arm.shoulderPivot.rotation.x = fall * 0.6;
        arm.shoulderPivot.rotation.z = arm.side * fall * 0.5;
        arm.elbowPivot.rotation.x = -0.3 - fall * 0.3;
      });
    }

    // Glow fades
    if (d.glowMeshes) {
      d.glowMeshes.forEach((gm) => {
        gm.scale.setScalar(1 - fall * 0.5);
      });
    }
  } else {
    // Still, face down
    model.rotation.x = Math.PI * 0.35;
    model.position.y = baseY - 0.7;
    if (d.glowMeshes) {
      d.glowMeshes.forEach((gm) => gm.visible = false);
    }
  }
}


// ─── HIT / KILL HELPERS ─────────────────────────────────────────

export function hitBrute(ai) {
  if (ai.state === STATE.DEAD) return;
  // Only flinch if not mid-charge or slam (tank doesn't stagger easily)
  if (ai.state !== STATE.CHARGE && ai.state !== STATE.SLAM) {
    ai.state = STATE.HURT;
    ai.stateTimer = 0;
  }
}

export function killBrute(ai) {
  ai.state = STATE.DEAD;
  ai.stateTimer = 0;
}


// ─── 4. BEHAVIOR SPEC ──────────────────────────────────────────

export const bruteBehavior = createBehaviorSpec({
  type: 'brute',
  health: 6,              // tankiest regular alien
  speed: 0.035,
  patrolRange: 5,
  movementType: 'patrol',
  canStrafe: false,

  attackType: 'melee',
  attackRange: 3.5,
  attackDamage: 4,        // hits HARD
  attackCooldown: 120,    // but slow to recover
  projectileSpeed: 0,

  walkSpeed: 3,
  walkAmplitude: 0.2,

  deathType: 'collapse',

  onSpawn(model) {
    model.position.y = 0.3;
    model.userData.baseY = 0.3;
    model.userData.ai = createBruteAI();
  },

  onUpdate(model, dt, playerPos) {
    const ai = model.userData.ai;
    if (!ai) return null;

    const event = updateBruteAI(model, ai, playerPos, dt);

    if (ai.state !== STATE.DEAD && ai.state !== STATE.CHARGE && ai.state !== STATE.SLAM) {
      animateBrute(model, performance.now() / 1000);
    }

    return event;
  },

  onHit(model) {
    const ai = model.userData.ai;
    if (ai) hitBrute(ai);
  },

  onDeath(model) {
    const ai = model.userData.ai;
    if (ai) killBrute(ai);
  },
});
