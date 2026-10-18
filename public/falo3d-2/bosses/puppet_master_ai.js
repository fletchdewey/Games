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
// The body is a brute's body, so it fights like one. Same cycle, same numbers.
import { createBruteAttack, stepBruteAttack, bruteAttackReady,
         beginBruteAttack, bruteAttackBusy } from '../shared/brute_attack.js?v=b88ad87179';

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

  // === THE BODY'S ATTACK ===
  // Its own little state machine: windup, charge, slam, recover.
  d.bodyAttack = createBruteAttack();

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

// The body's whole fighting behaviour: stalk, then run the brute's own
// charge-and-slam. Shared by chapters 1 and 2 so the thing you learn to dodge
// in the first half is the same thing in the second.
//
// `pace` scales its walk — the shell is failing in chapter 2 and moves worse,
// but the attack itself is identical either way. A boss that fights to
// different rules once it's damaged just reads as inconsistent.

function fightAsBrute(bossGroup, playerPos, dt, pace) {
  const d = bossGroup.userData;
  const atk = d.bodyAttack;

  if (bruteAttackBusy(atk)) {
    // Committed. The cycle owns its rotation and position until it's done.
    const hit = stepBruteAttack(atk, bossGroup, d.arms, d.legs, playerPos, dt);
    if (hit) {
      d.currentAttack = {
        type: 'body_slam', damage: d.attackDamage,
        origin: hit.origin, frame: 0, duration: 20,
      };
    }
    return;
  }

  // Idle: still ticking the cooldown down, and still closing on you.
  stepBruteAttack(atk, bossGroup, d.arms, d.legs, playerPos, dt);

  const dist = distanceTo(bossGroup, playerPos);
  faceTarget(bossGroup, playerPos);

  if (bruteAttackReady(atk, dist)) {
    beginBruteAttack(atk);
    return;
  }

  // Too close to get a run-up, or too far to bother: walk it in.
  if (dist > d.attackRange) {
    moveToward(bossGroup, playerPos, d.speed * pace * dt);
    animateWalk(bossGroup, d.walkTime, 3.5, 0.2);
  }
}

function updateControlled(bossGroup, playerPos, dt) {
  const d = bossGroup.userData;

  fightAsBrute(bossGroup, playerPos, dt, 1);

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
    fightAsBrute(bossGroup, playerPos, dt, 0.7);

    // Don't stumble mid-charge — it would cancel the attack halfway and the
    // tell you just read would come to nothing. It stumbles between them.
    if (d.staggerCooldown <= 0 && !bruteAttackBusy(d.bodyAttack)) {
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
  leashPilot(bossGroup);

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

export function damagePuppetMaster(bossGroup, amount, hitGroup, atWorldPos) {
  const d = bossGroup.userData;

  // Where the blood comes out. The caller knows the exact impact point if it
  // raycast for it; without one, fall back to the middle of whatever was hit,
  // which is still better than nothing coming out at all.
  const bleed = (group, lift) => {
    const p = new THREE.Vector3();
    if (atWorldPos) p.copy(atWorldPos);
    else { group.getWorldPosition(p); p.y += lift; }
    (d.pendingBlood = d.pendingBlood || []).push({ x: p.x, y: p.y, z: p.z });
  };

  if (hitGroup === 'body') {
    if (d.bodyHp <= 0) return;
    d.bodyHp -= amount;
    flashMeshes(d.bodyHitbox, FX.flashBodyFrames);
    bleed(d.bodyHitbox, 1.2);          // bodyHitbox's origin is at its feet
  } else if (hitGroup === 'pilot' && d.pilotExposed) {
    d.pilotHp -= amount;
    flashMeshes(d.pilotGroup, FX.flashPilotFrames);
    bleed(d.pilotGroup, 0.2);
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

// ─── WHAT THE PILOT THROWS ──────────────────────
// Out of the body and with nothing but its hands, it picks up whatever is
// lying around the station and lobs it at you. Same junk the rooms are
// dressed with, so it reads as grabbed off the floor rather than conjured.
//
// Each one is a small Group the game attaches to a projectile and tumbles.

const JUNK_METAL = 0x5a6069;
const JUNK_DARK = 0x33383e;
const JUNK_CRATE = 0x4b5236;
const JUNK_BRASS = 0xa8853a;

function shipJunk() {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const kind = Math.floor(Math.random() * 6);

  if (kind === 0) {                       // ammo tin
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.17), mat(JUNK_CRATE)));
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.18), mat(JUNK_DARK));
    lid.position.y = 0.085;
    g.add(lid);
  } else if (kind === 1) {                // helmet
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.6),
      new THREE.MeshLambertMaterial({ color: 0x2f3a2c, side: THREE.DoubleSide }));
    g.add(dome);
  } else if (kind === 2) {                // length of pipe
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.46, 7), mat(JUNK_METAL));
    pipe.rotation.z = Math.PI / 2;
    g.add(pipe);
  } else if (kind === 3) {                // gas canister
    const can = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.28, 8), mat(0x8a9099));
    g.add(can);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.07, 6), mat(0xb4761c));
    cap.position.y = 0.17;
    g.add(cap);
  } else if (kind === 4) {                // a magazine
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.05), mat(JUNK_DARK)));
  } else {                                // wrench
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.035, 0.025), mat(JUNK_BRASS));
    g.add(shaft);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.03), mat(JUNK_BRASS));
    jaw.position.x = 0.16;
    g.add(jaw);
  }

  g.traverse((o) => { if (o.isMesh) o.userData.hitPart = 'junk'; });
  return g;
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
    // What it grabbed. The game builds the projectile around this instead of
    // its usual glowing bolt — a thrown spanner shouldn't light the room up.
    model: shipJunk(),
    spin: new THREE.Vector3(
      (Math.random() - 0.5) * 18,
      (Math.random() - 0.5) * 18,
      (Math.random() - 0.5) * 18),
    frame: 0,
    duration: 15,
  };
}

// ─── GETTING HURT AND DYING ─────────────────────
// Every number the hit flash and the two death sequences run on. Exported so
// the Puppet Master workshop drives the same values the game does, rather
// than a second copy of them that drifts out of step.
//
// Frames, like the rest of this file: 60 = one second.

export const FX = {
  flashBodyFrames: 3,       // white tint when the shell takes a hit
  flashPilotFrames: 5,      // longer on the pilot — it's the weak point

  collapseFrames: 60,       // the body going down
  collapsePitch: 1.3,       // radians it pitches through
  collapseSink: 0.3,        // how far it settles into the floor
  collapseBuckle: 0.9,      // knees giving way as it falls

  ejectFrames: 26,          // pilot thrown clear of the carcass
  ejectArc: 0.9,            // height of the arc it's flung through
  ejectSpin: 2.4,           // how far it tumbles on the way

  pilotDeathFrames: 50,     // pilot curling up once it's finished

  pilotLeash: 7,            // how far the loose pilot may get from the arena

  pilotGroundY: 0.8,        // how high the loose pilot rides above the floor
  pilotBob: 0.07,           // bounce of its run
  pilotBobRate: 9,          // and how fast it scurries
  pilotArmsUp: 0.3,         // arms thrown up: lean out from straight overhead
  pilotArmSway: 0.1,        // how much they swing. Keep small — see below.

  bloodCount: 9,            // specks thrown per hit
  bloodSpeed: 0.075,        // how hard they come out (units per frame)
  bloodGravity: 0.0065,     // and how fast they fall back down
  bloodLife: 36,            // frames before a speck disappears
  bloodSize: 0.05,
};

// ─── BLOOD ──────────────────────────────────────
// One Points object holding every speck, so a whole fight's worth of hits
// costs a single draw call. The specks are a fixed ring buffer: a long fight
// reuses the oldest rather than allocating, so nothing grows without bound.
//
// Spent specks are parked far below the floor instead of being deleted —
// cheaper than rebuilding the attribute, and invisible either way. That is
// also why frustum culling is off: the parked ones blow the bounding sphere
// up, and recomputing it every frame to keep it honest would cost more than
// the culling saves on one small Points object.

const BLOOD_MAX = 96;
const BLOOD_PARKED = -999;

function ensureBlood(d, scene) {
  if (d.blood) return d.blood;
  const pos = new Float32Array(BLOOD_MAX * 3);
  for (let i = 0; i < BLOOD_MAX; i++) pos[i * 3 + 1] = BLOOD_PARKED;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0x7a1016, size: FX.bloodSize, sizeAttenuation: true,
    transparent: true, opacity: 0.95, depthWrite: false,
  }));
  points.frustumCulled = false;
  scene.add(points);
  d.blood = {
    points, pos,
    vel: new Float32Array(BLOOD_MAX * 3),
    life: new Float32Array(BLOOD_MAX),
    next: 0,
  };
  return d.blood;
}

function stepBlood(bossGroup, dtF, scene) {
  const d = bossGroup.userData;
  if (!scene || (!d.pendingBlood && !d.blood)) return;
  const b = ensureBlood(d, scene);

  // damagePuppetMaster only leaves a note of where it was hit — it has no
  // scene to spawn into, and getting shot shouldn't be what builds the pool.
  if (d.pendingBlood) {
    for (const hit of d.pendingBlood) {
      for (let n = 0; n < FX.bloodCount; n++) {
        const i = b.next;
        b.next = (b.next + 1) % BLOOD_MAX;
        const a = Math.random() * Math.PI * 2;
        const sp = FX.bloodSpeed * (0.45 + Math.random() * 0.9);
        b.pos[i * 3] = hit.x;
        b.pos[i * 3 + 1] = hit.y;
        b.pos[i * 3 + 2] = hit.z;
        b.vel[i * 3] = Math.cos(a) * sp;
        b.vel[i * 3 + 1] = sp * (0.9 + Math.random() * 1.6);
        b.vel[i * 3 + 2] = Math.sin(a) * sp;
        b.life[i] = FX.bloodLife;
      }
    }
    d.pendingBlood = null;
  }

  for (let i = 0; i < BLOOD_MAX; i++) {
    if (b.life[i] <= 0) continue;
    b.life[i] -= dtF;
    b.vel[i * 3 + 1] -= FX.bloodGravity * dtF;
    b.pos[i * 3] += b.vel[i * 3] * dtF;
    b.pos[i * 3 + 1] += b.vel[i * 3 + 1] * dtF;
    b.pos[i * 3 + 2] += b.vel[i * 3 + 2] * dtF;
    // Lands and stays landed, rather than dropping through the floor.
    if (b.pos[i * 3 + 1] < 0.02) {
      b.pos[i * 3 + 1] = 0.02;
      b.vel[i * 3] = 0; b.vel[i * 3 + 1] = 0; b.vel[i * 3 + 2] = 0;
    }
    if (b.life[i] <= 0) b.pos[i * 3 + 1] = BLOOD_PARKED;
  }
  b.points.geometry.attributes.position.needsUpdate = true;
  b.points.material.size = FX.bloodSize;
}

// Where the loose pilot is allowed to run. Without this it flees the player
// in a straight line for as long as the fight lasts and simply leaves the
// map. Call it with the room it is cornered in; left unset, the leash falls
// back to wherever the body came down.

export function setPuppetArena(bossGroup, centreX, centreZ, radius) {
  bossGroup.userData.arena = { x: centreX, z: centreZ, r: radius };
}

// Pull the pilot back onto the edge of the arena when it tries to leave.
// Projecting it back onto the circle cancels only the outward part of the
// step and leaves the sideways part intact, so a pilot pressed against the
// boundary runs around it instead of grinding to a halt against it.

function leashPilot(bossGroup) {
  const d = bossGroup.userData;
  const a = d.arena;
  if (!a) return;
  const p = d.pilotGroup.position;
  const dx = p.x - a.x, dz = p.z - a.z;
  const r = Math.hypot(dx, dz);
  if (r <= a.r || r < 1e-4) return;
  p.x = a.x + (dx / r) * a.r;
  p.z = a.z + (dz / r) * a.r;
}

function doBodyCollapse(bossGroup) {
  const d = bossGroup.userData;

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

// The visible half of getting hurt and dying: blood, the pilot bailing out,
// the body going down, and the pilot's own end. updatePuppetMaster stops the
// moment the boss is dead, so none of this can live in there — it has to be
// stepped every frame regardless. It used to be written inline in game.js,
// which meant the death everybody actually sees could only be changed by
// editing the game loop, and could not be driven from a workshop at all.
//
// `scene` is where the blood and the ejected pilot go: both have to be out of
// the body, which topples and rotates underneath them.

export function stepPuppetMasterFx(bossGroup, dtF, scene) {
  const d = bossGroup.userData;

  stepBlood(bossGroup, dtF, scene);

  if (d.phase === 'ejected' && !d.pilotDetached && scene) {
    scene.add(d.pilotGroup);
    d.pilotGroup.position.set(bossGroup.position.x, 1.3,
                              bossGroup.position.z + 0.4);
    d.pilotGroup.rotation.set(0, 0, 0);
    d.pilotDetached = true;
    d.ejectFrame = 0;
    // Fall back to the wreck if nobody set a room. Better than no bound at
    // all, which is what sent it over the horizon.
    if (!d.arena) {
      d.arena = { x: bossGroup.position.x, z: bossGroup.position.z,
                  r: FX.pilotLeash };
    }
  }

  // Flung out and down, tumbling, landing on the floor beside the wreck.
  if (d.ejectFrame != null) {
    d.ejectFrame += dtF;
    const t = Math.min(1, d.ejectFrame / FX.ejectFrames);
    d.pilotGroup.position.y = 1.3 + Math.sin(t * Math.PI) * FX.ejectArc - t * 0.5;
    d.pilotGroup.rotation.z = Math.sin(t * Math.PI) * FX.ejectSpin;
    if (t >= 1) {
      d.ejectFrame = null;
      d.pilotGroup.rotation.z = 0;
      d.pilotGroup.position.y = FX.pilotGroundY;
    }
  }

  // The body goes down: knees buckle, arms drop, the whole thing pitches
  // forward. Smoothstepped, so it falls rather than snapping over.
  if (d.bodyCollapsing) {
    d.bodyCollapseFrame = (d.bodyCollapseFrame || 0) + dtF;
    const t = Math.min(1, d.bodyCollapseFrame / FX.collapseFrames);
    const e = t * t * (3 - 2 * t);
    bossGroup.rotation.x = e * FX.collapsePitch;
    bossGroup.position.y = -e * FX.collapseSink;
    for (const leg of d.legs) {
      leg.upper.rotation.x = leg.baseUpper + e * FX.collapseBuckle;
      leg.lower.rotation.x = leg.baseLower - e * FX.collapseBuckle * 1.4;
    }
    for (const arm of d.arms) arm.upper.rotation.x = e * 0.8;
    if (t >= 1) d.bodyCollapsing = false;
  }

  // The pilot's own end. It was doing nothing at all before this — the AI set
  // a frame counter that nothing ever read.
  if (d.pilotDeathFrame != null) {
    d.pilotDeathFrame += dtF;
    const t = Math.min(1, d.pilotDeathFrame / FX.pilotDeathFrames);
    const e = t * t;
    d.pilotGroup.rotation.x = e * 1.5;
    d.pilotGroup.position.y = FX.pilotGroundY - e * (FX.pilotGroundY - 0.25);
    d.pilotHead.rotation.z = e * 0.9;
    for (let i = 0; i < d.pilotArms.length; i++) {
      d.pilotArms[i].rotation.z = (i === 0 ? -1 : 1) * (0.8 - e * 0.7);
      d.pilotArms[i].rotation.x = -0.5 + e * 0.5;
    }
    if (t >= 1) d.pilotDeathFrame = null;
  }
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
    // Running for its life with both arms over its head.
    //
    // Two things were wrong here. The height was written with `+=` and a
    // value that is never negative, so every frame added a little and the
    // pilot climbed away into the sky — the leash only ever bounded it on the
    // floor plane, so it flew straight out through the top of it. Height is
    // set absolutely from the floor now, and can only ever be ground + bob.
    //
    // And the arms and head were driven at 7-12Hz with big amplitudes, which
    // is fast enough to read as a glitch rather than as panic. The run itself
    // carries the motion; the arms only need to sway with it.
    const step = t * FX.pilotBobRate;
    d.pilotGroup.position.y = FX.pilotGroundY + Math.abs(Math.sin(step)) * FX.pilotBob;
    d.pilotGroup.rotation.z = Math.sin(step) * 0.06;
    d.pilotHead.rotation.z = Math.sin(step * 0.5) * 0.1;
    d.pilotHead.rotation.x = 0;

    for (let i = 0; i < d.pilotArms.length; i++) {
      const side = i === 0 ? -1 : 1;
      const arm = d.pilotArms[i];
      // Built reaching forward for the reins. Thrown up over the head now.
      // The head is a 0.14 sphere centred at y 0.22, so it tops out around
      // 0.35 and is 0.14 wide — an arm any lower or any closer in just
      // disappears inside it.
      arm.position.set(side * 0.17, 0.36, 0.02);
      arm.rotation.x = 0;
      arm.rotation.z = -side * (FX.pilotArmsUp + Math.sin(step + i) * FX.pilotArmSway);
    }
  }
}

// ─── VISUAL FEEDBACK ────────────────────────────

function flashMeshes(group, frames) {
  group.userData.flashFrames = frames;
}
