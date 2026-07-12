// src/bosses/puppet_master_ai.js
// HOW THE PUPPET MASTER THINKS
//
// This is the boss's brain. Every frame the game asks: "Puppet Master,
// what do you want to do right now?" This file answers.
//
// It works like a Lego instruction booklet with 3 chapters:
//   Chapter 1 (CONTROLLED):     The pilot is driving. Charge and slam.
//   Chapter 2 (MALFUNCTIONING): The body is breaking. Pilot peeks out.
//   Chapter 3 (EJECTED):        Body is dead. Pilot runs for its life.
//
// DT NOTE: this brain counts in FRAMES (60 = one second). The game loop
// runs in seconds, so game.js passes it `dt * 60`. The animation clocks
// (walkTime / pilotBobTime) are therefore in frames and get divided by 60
// back to seconds wherever a smooth sine wave is needed.

import * as THREE from 'three';

// ─── SETUP ──────────────────────────────────────
// Call this ONCE when the boss spawns into the room.

export function initPuppetMaster(bossGroup) {
  const d = bossGroup.userData;

  // === HEALTH ===
  d.bodyHp = 30;
  d.bodyHpMax = 30;
  d.pilotHp = 8;
  d.pilotHpMax = 8;

  // === CURRENT PHASE ===
  d.phase = 'controlled';

  // === TIMERS (frames) ===
  d.attackTimer = 0;
  d.staggerTimer = 0;
  d.staggerCooldown = 0;

  // === MOVEMENT (units per frame) ===
  d.speed = 0.04;
  d.pilotSpeed = 0.08;
  d.facing = new THREE.Vector3(0, 0, 1);

  // === ATTACK ===
  d.attackRange = 3;
  d.attackDamage = 3;
  d.attackCooldown = 60;
  d.pilotAttackCooldown = 45;

  // === ANIMATION CLOCKS (frames) ===
  d.walkTime = 0;
  d.pilotBobTime = 0;

  // === FLAGS ===
  d.isStaggering = false;
  d.isDead = false;
  d.pilotExposed = false;
}

// ─── MAIN UPDATE ────────────────────────────────

export function updatePuppetMaster(bossGroup, playerPos, dt) {
  const d = bossGroup.userData;

  if (d.isDead) return;

  if (d.attackTimer > 0) d.attackTimer -= dt;

  d.walkTime += dt;
  d.pilotBobTime += dt;

  if (d.phase === 'controlled') {
    updateControlled(bossGroup, playerPos, dt);
  } else if (d.phase === 'malfunctioning') {
    updateMalfunctioning(bossGroup, playerPos, dt);
  } else if (d.phase === 'ejected') {
    updateEjected(bossGroup, playerPos, dt);
  }

  // These happen in ALL phases
  animateTendrils(bossGroup, dt);
  animatePilot(bossGroup, dt);
}

// ─── CHAPTER 1: CONTROLLED ──────────────────────
// The pilot drives the body like a mech suit. Charges and slams.

function updateControlled(bossGroup, playerPos, dt) {
  const d = bossGroup.userData;
  const dist = distanceTo(bossGroup, playerPos);

  faceTarget(bossGroup, playerPos);

  if (dist > d.attackRange) {
    moveToward(bossGroup, playerPos, d.speed * dt);
    animateWalk(bossGroup, d.walkTime, 3.5, 0.2);
  }

  if (dist <= d.attackRange && d.attackTimer <= 0) {
    doBodySlam(bossGroup);
    d.attackTimer = d.attackCooldown;
  }

  // Half health gone → chapter 2
  if (d.bodyHp <= d.bodyHpMax * 0.5) {
    d.phase = 'malfunctioning';
    d.staggerCooldown = 120;
  }
}

// ─── CHAPTER 2: MALFUNCTIONING ──────────────────
// The body is falling apart. It still fights, but periodically it
// stumbles and the pilot is exposed — the window to shoot the pilot.

function updateMalfunctioning(bossGroup, playerPos, dt) {
  const d = bossGroup.userData;
  const dist = distanceTo(bossGroup, playerPos);

  if (d.staggerCooldown > 0) d.staggerCooldown -= dt;

  if (d.isStaggering) {
    d.staggerTimer -= dt;

    // Wobble while stumbling
    bossGroup.rotation.z = Math.sin((d.walkTime / 60) * 8) * 0.15;

    // Pilot exposed — player can shoot it!
    d.pilotExposed = true;

    if (d.staggerTimer <= 0) {
      d.isStaggering = false;
      d.pilotExposed = false;
      d.staggerCooldown = 180;
      bossGroup.rotation.z = 0;
    }
  } else {
    faceTarget(bossGroup, playerPos);

    if (dist > d.attackRange) {
      moveToward(bossGroup, playerPos, d.speed * 0.7 * dt);
      animateWalk(bossGroup, d.walkTime, 3.5, 0.25);
    }

    if (dist <= d.attackRange && d.attackTimer <= 0) {
      doBodySlam(bossGroup);
      d.attackTimer = d.attackCooldown * 1.3;
    }

    if (d.staggerCooldown <= 0) {
      d.isStaggering = true;
      d.staggerTimer = 90; // pilot exposed ~1.5s
    }
  }

  if (d.bodyHp <= 0) {
    d.phase = 'ejected';
    doBodyCollapse(bossGroup);
  }
}

// ─── CHAPTER 3: EJECTED ─────────────────────────
// Body is down. The pilot jumps out and scurries like a panicked chicken,
// throwing little projectiles. Tiny, fast, always vulnerable.

function updateEjected(bossGroup, playerPos, dt) {
  const d = bossGroup.userData;

  d.pilotExposed = true;

  const pilot = d.pilotGroup;
  const dist = distanceToPilot(pilot, playerPos);

  if (dist < 6) {
    moveAway(pilot, playerPos, d.pilotSpeed * dt);
  } else {
    scramble(pilot, d.walkTime, d.pilotSpeed * 0.5 * dt);
  }

  if (d.attackTimer <= 0) {
    doPilotAttack(bossGroup, playerPos);
    d.attackTimer = d.pilotAttackCooldown;
  }

  if (d.pilotHp <= 0) {
    d.isDead = true;
    doPilotDeath(bossGroup);
  }
}

// ─── DAMAGE ─────────────────────────────────────
// hitGroup is 'body' or 'pilot'. The pilot can only be hurt while exposed —
// that's the whole "aim for the weak point" mechanic.

export function damagePuppetMaster(bossGroup, amount, hitGroup) {
  const d = bossGroup.userData;

  if (hitGroup === 'body') {
    if (d.bodyHp <= 0) return;
    d.bodyHp -= amount;
    flashMeshes(d.bodyHitbox, 3);
  } else if (hitGroup === 'pilot' && d.pilotExposed) {
    d.pilotHp -= amount;
    flashMeshes(d.pilotGroup, 5);
  }
}

// ─── MOVEMENT HELPERS ───────────────────────────

function distanceTo(bossGroup, targetPos) {
  return bossGroup.position.distanceTo(targetPos);
}

function distanceToPilot(pilotGroup, targetPos) {
  const pilotWorldPos = new THREE.Vector3();
  pilotGroup.getWorldPosition(pilotWorldPos);
  return pilotWorldPos.distanceTo(targetPos);
}

function faceTarget(bossGroup, targetPos) {
  const dir = new THREE.Vector3();
  dir.subVectors(targetPos, bossGroup.position);
  dir.y = 0;
  if (dir.length() > 0.01) {
    bossGroup.rotation.y = Math.atan2(dir.x, dir.z);
  }
}

function moveToward(bossGroup, targetPos, amount) {
  const dir = new THREE.Vector3();
  dir.subVectors(targetPos, bossGroup.position);
  dir.y = 0;
  if (dir.length() > 0.1) {
    dir.normalize();
    bossGroup.position.x += dir.x * amount;
    bossGroup.position.z += dir.z * amount;
  }
}

function moveAway(pilotGroup, targetPos, amount) {
  const worldPos = new THREE.Vector3();
  pilotGroup.getWorldPosition(worldPos);
  const dir = new THREE.Vector3();
  dir.subVectors(worldPos, targetPos);
  dir.y = 0;
  if (dir.length() > 0.1) {
    dir.normalize();
    pilotGroup.position.x += dir.x * amount;
    pilotGroup.position.z += dir.z * amount;
  }
}

function scramble(pilotGroup, time, amount) {
  pilotGroup.position.x += Math.sin(time * 7.3) * amount;
  pilotGroup.position.z += Math.cos(time * 5.1) * amount;
}

// ─── ATTACK ACTIONS ─────────────────────────────
// These set `currentAttack` — a note the game loop reads to actually
// deal damage / spawn projectiles, then clears.

function doBodySlam(bossGroup) {
  const d = bossGroup.userData;
  d.currentAttack = {
    type: 'body_slam',
    damage: d.attackDamage,
    frame: 0,
    duration: 20,
  };
}

function doPilotAttack(bossGroup, playerPos) {
  const d = bossGroup.userData;
  const pilotWorldPos = new THREE.Vector3();
  d.pilotGroup.getWorldPosition(pilotWorldPos);

  d.currentAttack = {
    type: 'pilot_throw',
    damage: 1,
    origin: pilotWorldPos.clone(),
    target: playerPos.clone(),
    frame: 0,
    duration: 15,
  };
}

// ─── DEATH SEQUENCES ────────────────────────────

function doBodyCollapse(bossGroup) {
  const d = bossGroup.userData;

  // Flag the body to topple (game loop animates the fall + pilot ejection).
  d.bodyCollapsing = true;
  d.bodyCollapseFrame = 0;

  // Sever the puppet strings.
  for (const strand of d.tendrils) {
    for (const seg of strand) {
      seg.mesh.visible = false;
    }
  }
  d.tendrilLight.intensity = 0;
}

function doPilotDeath(bossGroup) {
  const d = bossGroup.userData;
  d.pilotDeathFrame = 0;
}

// ─── ANIMATION ──────────────────────────────────
// time / clocks arrive in FRAMES; divide by 60 for a smooth per-second wave.

function animateWalk(bossGroup, time, speed, amplitude) {
  const d = bossGroup.userData;
  const t = (time / 60) * speed;

  for (let i = 0; i < d.legs.length; i++) {
    const leg = d.legs[i];
    const offset = i * Math.PI;
    const swing = Math.sin(t + offset) * amplitude;
    leg.upper.rotation.x = 0.25 + swing;
    leg.lower.rotation.x = -0.4 - Math.abs(swing) * 0.5;
  }

  for (let i = 0; i < d.arms.length; i++) {
    const arm = d.arms[i];
    const offset = i * Math.PI + Math.PI * 0.5;
    const swing = Math.sin(t + offset) * amplitude * 0.6;
    arm.upper.rotation.x = swing;
    arm.elbowPivot.rotation.x = -0.3 - Math.abs(swing) * 0.3;
  }

  bossGroup.position.y = Math.abs(Math.sin(t)) * 0.04;
}

function animateTendrils(bossGroup, dt) {
  const d = bossGroup.userData;
  const t = d.walkTime / 60;

  for (const strand of d.tendrils) {
    for (const seg of strand) {
      seg.mesh.position.x = seg.baseX + Math.sin(t * 2 + seg.seg * 0.8) * 0.03;
      seg.mesh.position.z = seg.baseZ + Math.cos(t * 1.5 + seg.seg) * 0.02;
    }
  }

  if (d.phase === 'malfunctioning') {
    d.tendrilLight.intensity = 1.5 + Math.sin(t * 5) * 1.0;
  }
}

function animatePilot(bossGroup, dt) {
  const d = bossGroup.userData;
  const t = d.pilotBobTime / 60;

  if (d.phase === 'controlled') {
    d.pilotGroup.position.y = 2.0 + Math.sin(t * 3) * 0.03;
    d.pilotHead.rotation.z = Math.sin(t * 2) * 0.1;
  } else if (d.phase === 'malfunctioning') {
    d.pilotGroup.position.y = 2.0 + Math.sin(t * 6) * 0.05;
    d.pilotHead.rotation.z = Math.sin(t * 8) * 0.2;
    d.pilotHead.rotation.x = Math.sin(t * 5) * 0.1;
  } else if (d.phase === 'ejected') {
    d.pilotGroup.position.y += Math.abs(Math.sin(t * 10)) * 0.01;
    d.pilotHead.rotation.z = Math.sin(t * 12) * 0.3;

    for (let i = 0; i < d.pilotArms.length; i++) {
      const side = i === 0 ? -1 : 1;
      d.pilotArms[i].rotation.z = side * 0.8 + Math.sin(t * 9 + i * 2) * 0.5;
      d.pilotArms[i].rotation.x = -0.5 + Math.sin(t * 7 + i) * 0.4;
    }
  }
}

// ─── VISUAL FEEDBACK ────────────────────────────

function flashMeshes(group, frames) {
  group.userData.flashFrames = frames;
}
