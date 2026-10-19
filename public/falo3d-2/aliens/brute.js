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
import { buildBrute as buildBruteModel } from './workshop_models.js?v=61a6b83f51';
import { createBehaviorSpec } from '../shared/behavior.js?v=61a6b83f51';
import { BRUTE_ATTACK } from '../shared/brute_attack.js?v=61a6b83f51';


// ─── 1. GEOMETRY ────────────────────────────────────────────────
//
// The armour, the horn, the bracered fists and the legs all come from the
// Alien Workshop now, via workshop_models.js — the same Brute standing in the
// last pod in the specimen room. A second, older one used to be built here,
// so the one in the tank and the one charging at you were different models.
//
// The animation and the brain below are untouched. The workshop model hands
// over legs and arms shaped exactly as this file expects, and now the glow
// nodes and head as well.

export function buildBrute() {
  const g = buildBruteModel();
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
      // Clears the bull-windup flare on any path back to idle (including
      // getting shot mid-windup, which exits through HURT → CHASE).
      arm.shoulderPivot.rotation.z = 0;
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
  WINDUP:  'windup',
  CHARGE:  'charge',
  SLAM:    'slam',
  RECOVER: 'recover',
  HURT:    'hurt',
  DEAD:    'dead',
};

// The charge-and-slam numbers live in shared/brute_attack.js, because the
// Puppet Master drives a brute body and fights with the same cycle. Taking
// them from there rather than keeping a second copy is what stops the two
// drifting apart. The rationale for each value is written up over there.
const WINDUP_FRAMES = BRUTE_ATTACK.WINDUP_FRAMES;
const CHARGE_STEER = BRUTE_ATTACK.CHARGE_STEER;

// The slam connects in a CONE in front of the Brute, not a circle around it.
// A circle cannot distinguish a dodge from a direct hit: the charge always
// ends when it closes to 2.5 units, so the distance at impact is ~2.2
// whichever way you went. Only the angle tells you whether it actually hit.
//
// Measured against a 5 u/s sidestep, with CHARGE_STEER at 0.004:
//     stand still        →  0° off-axis   hit
//     step ~1.0u         → 21° off-axis   hit  (a half-step isn't enough)
//     step ~1.5u         → 36° off-axis   MISS
//     step during windup →  0° off-axis   hit  (it re-aims as it launches)
const SLAM_RANGE = BRUTE_ATTACK.SLAM_RANGE;
const SLAM_ARC = BRUTE_ATTACK.SLAM_ARC;   // 30° either side of its nose

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

    // Close enough to charge? Wind up first — the charge itself is launched
    // at the END of the windup, so the windup is the aiming phase.
    if (dist < 10 && dist > 3 && ai.attackCooldown <= 0) {
      ai.state = STATE.WINDUP;
      ai.stateTimer = 0;
    }

    if (dist > 18) {
      ai.state = STATE.PATROL;
      ai.stateTimer = 0;
    }
  }

  // --- WINDUP ---
  // The cartoon bull: rears back, throws both arms back and out wide, drops
  // its head and paws the ground before it comes at you.
  //
  // It keeps turning to face you for the whole windup, then locks its heading
  // the instant it launches. So the windup is your warning AND your opening —
  // the later you move, the more wrong its aim ends up.
  else if (ai.state === STATE.WINDUP) {
    const t = Math.min(ai.stateTimer / WINDUP_FRAMES, 1);

    // Still tracking you — it's lining the shot up, not committed yet.
    toPlayer.y = 0;
    model.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

    // Rear back, then settle into a low crouch as it's about to go.
    const rear = Math.sin(Math.min(t / 0.4, 1) * Math.PI * 0.5);   // 0→1 over the first 40%
    model.rotation.x = rear * 0.22 - Math.max(0, (t - 0.7) / 0.3) * 0.38;

    // Arms sweep BACK and OUT — the bull-horn pose. rotation.z flares them
    // away from the body, which nothing else in this file touches, so every
    // exit from this state has to put it back to 0.
    if (d.arms) {
      d.arms.forEach((arm) => {
        arm.shoulderPivot.rotation.x = -rear * 1.15;
        arm.shoulderPivot.rotation.z = arm.side * rear * 0.65;
        arm.elbowPivot.rotation.x = -0.3 - rear * 0.35;
      });
    }

    // Paw the ground with the front-left leg once the arms are up.
    if (d.legs && d.legs.length && t > 0.35) {
      const paw = d.legs[0];
      const scrape = Math.sin(ai.stateTimer * 0.45);
      paw.upper.rotation.x = paw.baseUpperTilt + scrape * 0.5;
      paw.lower.rotation.x = paw.baseLowerTilt - Math.abs(scrape) * 0.25;
    }

    // Snorting shudder, building as it's about to launch.
    model.rotation.z = Math.sin(ai.stateTimer * 0.8) * 0.03 * t;

    if (ai.stateTimer >= WINDUP_FRAMES) {
      // Put the pawing leg back where the walk cycle expects it, or it stays
      // frozen mid-scrape for the whole charge.
      if (d.legs) {
        d.legs.forEach((leg) => {
          leg.upper.rotation.x = leg.baseUpperTilt;
          leg.lower.rotation.x = leg.baseLowerTilt;
        });
      }
      ai.state = STATE.CHARGE;
      ai.stateTimer = 0;
      ai.chargeSpeed = 0;
      // Heading locks HERE, at the end of the windup — not when it first
      // spotted you.
      ai.chargeDir = toPlayer.clone();
      ai.chargeDir.y = 0;
      ai.chargeDir.normalize();
    }
  }

  // --- CHARGE ---
  // COMMITTED rush. Accelerates to high speed but can barely turn.
  // Arms pull back during windup, then pump during sprint.
  // Lasts about 1.5 seconds, then auto-slams.
  else if (ai.state === STATE.CHARGE) {
    // Accelerate over the first 20 frames
    ai.chargeSpeed = Math.min(0.12, ai.chargeSpeed + 0.004 * dt * 60);

    // Barely any steering — this is what makes a dodge mean something.
    // At the old 0.02 it corrected ~84% of the way to you over a charge, so
    // sidestepping 1.5u still left you 14° off its nose. At 0.004 the same
    // sidestep puts you 36° off, outside the slam cone below.
    const steer = new THREE.Vector3().subVectors(playerPos, pos);
    steer.y = 0;
    steer.normalize();
    ai.chargeDir.lerp(steer, CHARGE_STEER);
    ai.chargeDir.normalize();

    pos.add(ai.chargeDir.clone().multiplyScalar(ai.chargeSpeed * dt * 60));
    model.rotation.y = Math.atan2(ai.chargeDir.x, ai.chargeDir.z);

    // Visual: lean forward, arms back
    model.rotation.x = -0.2;
    if (d.arms) {
      // Arms fold back in from the wide bull pose as it picks up speed.
      const tuck = Math.max(0, 1 - ai.stateTimer / 12);
      d.arms.forEach((arm) => {
        arm.shoulderPivot.rotation.x = -0.8 + Math.sin(ai.stateTimer * 0.3) * 0.3;
        arm.shoulderPivot.rotation.z = arm.side * 0.65 * tuck;
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

    // Damage at the impact frame (~60% through). Must be close AND in front —
    // step out of the cone and it pounds empty floor, then stumbles through
    // RECOVER below, which is your window on it.
    if (ai.stateTimer === 12) {
      const facing = new THREE.Vector3(Math.sin(model.rotation.y), 0, Math.cos(model.rotation.y));
      const flat = toPlayer.clone();
      flat.y = 0;
      const offAxis = flat.lengthSq() > 0 ? facing.angleTo(flat.normalize()) : 0;

      if (dist < SLAM_RANGE && offAxis < SLAM_ARC) {
        ai.state = STATE.RECOVER;
        ai.stateTimer = 0;
        ai.attackCooldown = 120;
        // No damage number here on purpose — game.js owns it (ALIEN_TYPES
        // .attackDmg), so the two can't drift apart. This used to say 4 while
        // the registration said 15.
        return { type: 'ground_slam', origin: pos.clone() };
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
        arm.shoulderPivot.rotation.z = 0;   // undo any leftover bull flare
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
