// src/shared/brute_attack.js
// The Brute's charge-and-slam, in one place.
//
// FLETCHER'S GUIDE:
// The Brute doesn't just walk up and hit you. It does four things in order:
//
//   WINDUP   rears back, flares its arms, paws the ground — and keeps turning
//            to face you the whole time. This is your warning.
//   CHARGE   commits. It locks its heading the instant it launches and can
//            barely steer after that, so a sidestep makes it miss.
//   SLAM     pounds the ground. Only connects in a CONE in front of its nose,
//            so dodging the charge means the slam lands on empty floor.
//   RECOVER  stumbles. This is your window to shoot it.
//
// The Puppet Master is driving a brute body, so it should fight exactly like
// one. Rather than write the cycle twice and let the two drift apart, it lives
// here and both call it.
//
// Both models already name their joints the same way — arms with a
// shoulderPivot and an elbowPivot, legs with an upper and a lower — which is
// why this works on either without a translation layer. The one difference is
// the legs' rest angles, so callers pass those in as baseUpper / baseLower.
//
// TIME IS IN FRAMES here, 60 to the second, same as the AI files that call it.

import * as THREE from 'three';

export const BRUTE_ATTACK = {
  // How long the bull windup holds before it launches. Long enough to read
  // and react to, short enough that it doesn't feel like it's waiting.
  WINDUP_FRAMES: 50,

  // How hard the charge may track you once committed. At 0.02 it corrected
  // ~84% of the way to you over a charge, so sidestepping 1.5u still left you
  // 14° off its nose — inside the slam cone, i.e. the dodge did nothing. At
  // 0.004 the same sidestep puts you 36° off, outside it.
  CHARGE_STEER: 0.004,
  CHARGE_ACCEL: 0.004,
  CHARGE_MAX: 0.12,
  CHARGE_FRAMES: 90,      // auto-slams if it never reaches you
  CHARGE_REACH: 2.5,      // or slams early once this close

  SLAM_FRAMES: 20,
  SLAM_IMPACT: 12,        // the frame the blow actually lands on

  // The slam connects in a CONE, not a circle. A circle cannot tell a dodge
  // from a direct hit: the charge always ends around 2.2 units away whichever
  // way you went, so only the ANGLE says whether it got you.
  //
  // Measured against a 5 u/s sidestep at CHARGE_STEER 0.004:
  //     stand still        →  0° off-axis   hit
  //     step ~1.0u         → 21° off-axis   hit  (a half-step isn't enough)
  //     step ~1.5u         → 36° off-axis   MISS
  //     step during windup →  0° off-axis   hit  (it re-aims as it launches)
  SLAM_RANGE: 3.5,
  SLAM_ARC: Math.PI / 6,  // 30° either side of its nose

  RECOVER_FRAMES: 75,
  COOLDOWN: 120,

  // The band it will start a charge from. Too close and there's no run-up.
  START_MIN: 3,
  START_MAX: 10,
};

export function createBruteAttack() {
  return {
    state: 'idle',
    timer: 0,
    cooldown: 0,
    dir: null,        // heading, locked at the end of the windup
    speed: 0,
    landed: false,    // the impact frame only fires once
  };
}

export const bruteAttackBusy = (atk) => atk.state !== 'idle';

/** True when it's in range and off cooldown, i.e. the charge can start. */
export function bruteAttackReady(atk, dist) {
  const A = BRUTE_ATTACK;
  return atk.state === 'idle' && atk.cooldown <= 0
    && dist < A.START_MAX && dist > A.START_MIN;
}

export function beginBruteAttack(atk) {
  atk.state = 'windup';
  atk.timer = 0;
  atk.landed = false;
}

/**
 * Run one frame of the cycle.
 *
 * Returns { type: 'ground_slam', origin } on the single frame the blow lands,
 * and null on every other frame — including a slam that misses, which is the
 * whole point of the cone.
 *
 * `legs` entries need baseUpper / baseLower: the rest angles the walk cycle
 * expects, so a pawing leg can be put back where it found it.
 */
export function stepBruteAttack(atk, model, arms, legs, playerPos, dtF) {
  const A = BRUTE_ATTACK;
  if (atk.cooldown > 0) atk.cooldown -= dtF;
  if (atk.state === 'idle') return null;

  atk.timer += dtF;
  const pos = model.position;
  const toPlayer = new THREE.Vector3().subVectors(playerPos, pos);
  toPlayer.y = 0;
  const dist = toPlayer.length();

  // ── WINDUP ──────────────────────────────────────────────
  // The cartoon bull. Still tracking you — it's lining the shot up, not
  // committed yet, so the later you move the more wrong its aim ends up.
  if (atk.state === 'windup') {
    const t = Math.min(atk.timer / A.WINDUP_FRAMES, 1);
    model.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

    const rear = Math.sin(Math.min(t / 0.4, 1) * Math.PI * 0.5);
    model.rotation.x = rear * 0.22 - Math.max(0, (t - 0.7) / 0.3) * 0.38;

    // Arms sweep BACK and OUT — the bull-horn pose. rotation.z flares them
    // away from the body, and nothing else touches that axis, so every exit
    // from this cycle has to put it back to 0.
    for (const arm of arms) {
      arm.shoulderPivot.rotation.x = -rear * 1.15;
      arm.shoulderPivot.rotation.z = arm.side * rear * 0.65;
      arm.elbowPivot.rotation.x = -0.3 - rear * 0.35;
    }

    if (legs.length && t > 0.35) {
      const paw = legs[0];
      const scrape = Math.sin(atk.timer * 0.45);
      paw.upper.rotation.x = paw.baseUpper + scrape * 0.5;
      paw.lower.rotation.x = paw.baseLower - Math.abs(scrape) * 0.25;
    }

    model.rotation.z = Math.sin(atk.timer * 0.8) * 0.03 * t;

    if (atk.timer >= A.WINDUP_FRAMES) {
      // Put the pawing leg back where the walk cycle expects it, or it stays
      // frozen mid-scrape for the whole charge.
      for (const leg of legs) {
        leg.upper.rotation.x = leg.baseUpper;
        leg.lower.rotation.x = leg.baseLower;
      }
      atk.state = 'charge';
      atk.timer = 0;
      atk.speed = 0;
      // Heading locks HERE, at the end of the windup — not when it first
      // saw you.
      atk.dir = toPlayer.clone().normalize();
    }
    return null;
  }

  // ── CHARGE ──────────────────────────────────────────────
  if (atk.state === 'charge') {
    atk.speed = Math.min(A.CHARGE_MAX, atk.speed + A.CHARGE_ACCEL * dtF);

    const steer = toPlayer.clone().normalize();
    atk.dir.lerp(steer, A.CHARGE_STEER);
    atk.dir.normalize();

    pos.add(atk.dir.clone().multiplyScalar(atk.speed * dtF));
    model.rotation.y = Math.atan2(atk.dir.x, atk.dir.z);
    model.rotation.x = -0.2;

    // Arms fold back in from the wide bull pose as it picks up speed.
    const tuck = Math.max(0, 1 - atk.timer / 12);
    for (const arm of arms) {
      arm.shoulderPivot.rotation.x = -0.8 + Math.sin(atk.timer * 0.3) * 0.3;
      arm.shoulderPivot.rotation.z = arm.side * 0.65 * tuck;
    }

    if (atk.timer > A.CHARGE_FRAMES || dist < A.CHARGE_REACH) {
      atk.state = 'slam';
      atk.timer = 0;
      atk.landed = false;
    }
    return null;
  }

  // ── SLAM ────────────────────────────────────────────────
  if (atk.state === 'slam') {
    const progress = Math.min(1, atk.timer / A.SLAM_FRAMES);
    model.rotation.x = -0.2 + progress * 0.4;
    for (const arm of arms) {
      arm.shoulderPivot.rotation.x = -0.8 + progress * 1.6;
      arm.elbowPivot.rotation.x = -0.3 - progress * 0.5;
    }

    // The blow lands on one frame only. `landed` guards it because dtF is
    // fractional — the original compared the frame counter for equality,
    // which can step straight over the impact frame.
    if (!atk.landed && atk.timer >= A.SLAM_IMPACT) {
      atk.landed = true;
      const facing = new THREE.Vector3(Math.sin(model.rotation.y), 0,
                                       Math.cos(model.rotation.y));
      const offAxis = dist > 0 ? facing.angleTo(toPlayer.clone().normalize()) : 0;
      if (dist < A.SLAM_RANGE && offAxis < A.SLAM_ARC) {
        atk.state = 'recover';
        atk.timer = 0;
        atk.cooldown = A.COOLDOWN;
        return { type: 'ground_slam', origin: pos.clone() };
      }
    }

    if (atk.timer > A.SLAM_FRAMES) {
      atk.state = 'recover';
      atk.timer = 0;
      atk.cooldown = A.COOLDOWN;
    }
    return null;
  }

  // ── RECOVER ─────────────────────────────────────────────
  // Stumbling after the pound. This is the window on it.
  if (atk.state === 'recover') {
    const t = Math.min(atk.timer / 60, 1);
    model.rotation.x = 0.2 * (1 - t);
    for (const arm of arms) {
      arm.shoulderPivot.rotation.x = 0.8 * (1 - t);
      arm.shoulderPivot.rotation.z = 0;   // undo any leftover bull flare
      arm.elbowPivot.rotation.x = -0.3;
    }
    model.rotation.z = Math.sin(atk.timer * 0.2) * 0.08 * (1 - t);

    if (atk.timer > A.RECOVER_FRAMES) {
      model.rotation.x = 0;
      model.rotation.z = 0;
      atk.state = 'idle';
      atk.timer = 0;
    }
  }
  return null;
}
