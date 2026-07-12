// bosses/puppet_master_ai.js
// HOW THE PUPPET MASTER THINKS
//
// This is the boss's brain. Every frame (about 60 times per second),
// the game asks: "Hey Puppet Master, what do you want to do right now?"
// This file answers that question.
//
// It works like a Lego instruction booklet with 3 chapters:
//   Chapter 1 (CONTROLLED): The pilot is driving. Charge and slam.
//   Chapter 2 (MALFUNCTIONING): The body is breaking. Pilot peeks out.
//   Chapter 3 (EJECTED): Body is dead. Pilot runs for its life.
//
// The boss moves through the chapters in order, like how a Guardian
// in Breath of the Wild changes behavior as you break its legs off.

import * as THREE from 'three';

// ─── SETUP ──────────────────────────────────────
// Call this ONCE when the boss spawns into the room.
// It's like snapping all the Lego pieces together before you start playing.

export function initPuppetMaster(bossGroup) {
  const d = bossGroup.userData;

  // === HEALTH ===
  d.bodyHp = 30;          // how much damage the big body can take
  d.bodyHpMax = 30;
  d.pilotHp = 8;          // how much damage the tiny pilot can take
  d.pilotHpMax = 8;

  // === CURRENT PHASE ===
  // Starts in chapter 1: the pilot is in control
  d.phase = 'controlled';

  // === TIMERS ===
  // These count frames. At 60 frames per second, 60 = 1 second.
  d.attackTimer = 0;       // counts down between attacks
  d.staggerTimer = 0;      // how long the pilot is exposed during a stumble
  d.staggerCooldown = 0;   // time until the body can stumble again

  // === MOVEMENT ===
  d.speed = 0.04;          // how fast the body walks (units per frame)
  d.pilotSpeed = 0.08;     // how fast the pilot runs in chapter 3
  d.facing = new THREE.Vector3(0, 0, 1); // which way the boss is looking

  // === ATTACK ===
  d.attackRange = 3;       // how close the player must be to get slammed
  d.attackDamage = 3;      // how much a body slam hurts
  d.attackCooldown = 60;   // frames between slams (60 = 1 second)
  d.pilotAttackCooldown = 45;

  // === ANIMATION ===
  d.walkTime = 0;          // ticks up every frame to drive the walk cycle
  d.pilotBobTime = 0;      // makes the pilot bounce around

  // === FLAGS ===
  d.isStaggering = false;  // true when the body is stumbling
  d.isDead = false;        // true when the fight is over
  d.pilotExposed = false;  // true when you can shoot the pilot
}

// ─── MAIN UPDATE ────────────────────────────────
// Called every frame. This is the "brain" that picks what to do.
//
// playerPos: a THREE.Vector3 — where the player is standing
// dt: delta time — how many frames worth of time passed (usually 1)
//
// Think of this like the rules card for a board game:
// "On your turn, check which chapter you're in, then follow those rules."

export function updatePuppetMaster(bossGroup, playerPos, dt) {
  const d = bossGroup.userData;

  if (d.isDead) return;

  // Count down the attack timer every frame
  if (d.attackTimer > 0) d.attackTimer -= dt;

  // Tick animation clocks
  d.walkTime += dt;
  d.pilotBobTime += dt;

  // Which chapter are we in?
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
// The pilot is driving the body like a mech suit.
// Charges at the player and slams the ground.
// Like a Hinox running at Link — big, scary, but predictable.

function updateControlled(bossGroup, playerPos, dt) {
  const d = bossGroup.userData;

  // Figure out how far away the player is
  const dist = distanceTo(bossGroup, playerPos);

  // Turn to face the player
  faceTarget(bossGroup, playerPos);

  // Walk toward the player
  if (dist > d.attackRange) {
    moveToward(bossGroup, playerPos, d.speed * dt);
    animateWalk(bossGroup, d.walkTime, 3.5, 0.2);
  }

  // Close enough to attack? SLAM!
  if (dist <= d.attackRange && d.attackTimer <= 0) {
    doBodySlam(bossGroup);
    d.attackTimer = d.attackCooldown;
  }

  // Check if we should move to chapter 2
  // (body has taken more than half its health in damage)
  if (d.bodyHp <= d.bodyHpMax * 0.5) {
    d.phase = 'malfunctioning';
    d.staggerCooldown = 120; // wait 2 seconds before first stumble
  }
}

// ─── CHAPTER 2: MALFUNCTIONING ──────────────────
// The body is falling apart. It still fights, but sometimes
// it stumbles and the pilot gets exposed.
//
// Like when you break a Guardian's legs in Zelda — it still
// shoots at you, but it's weaker and you can see the eye better.

function updateMalfunctioning(bossGroup, playerPos, dt) {
  const d = bossGroup.userData;
  const dist = distanceTo(bossGroup, playerPos);

  // Count down stumble timers
  if (d.staggerCooldown > 0) d.staggerCooldown -= dt;

  // Is the body currently stumbling?
  if (d.isStaggering) {
    d.staggerTimer -= dt;

    // The body wobbles while stumbling
    bossGroup.rotation.z = Math.sin(d.walkTime * 8) * 0.15;

    // Pilot is exposed — player can shoot it!
    d.pilotExposed = true;

    // Done stumbling?
    if (d.staggerTimer <= 0) {
      d.isStaggering = false;
      d.pilotExposed = false;
      d.staggerCooldown = 180; // wait 3 seconds before next stumble
      bossGroup.rotation.z = 0; // stand up straight
    }
  } else {
    // Not stumbling — fight normally but sloppier
    faceTarget(bossGroup, playerPos);

    if (dist > d.attackRange) {
      // Move slower than chapter 1 (the body is damaged)
      moveToward(bossGroup, playerPos, d.speed * 0.7 * dt);
      animateWalk(bossGroup, d.walkTime, 3.5, 0.25);
    }

    if (dist <= d.attackRange && d.attackTimer <= 0) {
      doBodySlam(bossGroup);
      d.attackTimer = d.attackCooldown * 1.3; // slower attacks too
    }

    // Time to stumble?
    if (d.staggerCooldown <= 0) {
      d.isStaggering = true;
      d.staggerTimer = 90; // pilot exposed for 1.5 seconds
    }
  }

  // Body is totally dead? Move to chapter 3
  if (d.bodyHp <= 0) {
    d.phase = 'ejected';
    doBodyCollapse(bossGroup);
  }
}

// ─── CHAPTER 3: EJECTED ─────────────────────────
// The body is down. The pilot jumps out and runs around
// like a panicked Korok. Tiny, fast, hard to hit.
// It throws little projectiles because it's desperate.
//
// This is the funny part — Fletcher's idea.
// The pilot should feel like chasing a chicken in Zelda.

function updateEjected(bossGroup, playerPos, dt) {
  const d = bossGroup.userData;

  d.pilotExposed = true; // always exposed now — no body to hide in

  const pilot = d.pilotGroup;
  const dist = distanceToPilot(pilot, playerPos);

  // RUN AWAY from the player (opposite direction)
  if (dist < 6) {
    moveAway(pilot, playerPos, d.pilotSpeed * dt);
  } else {
    // If far enough away, scurry in random directions
    // (panicked, not strategic)
    scramble(pilot, d.walkTime, d.pilotSpeed * 0.5 * dt);
  }

  // Throw a projectile when the timer is up
  if (d.attackTimer <= 0) {
    doPilotAttack(bossGroup, playerPos);
    d.attackTimer = d.pilotAttackCooldown;
  }

  // Pilot is dead? Fight over!
  if (d.pilotHp <= 0) {
    d.isDead = true;
    doPilotDeath(bossGroup);
  }
}

// ─── DAMAGE ─────────────────────────────────────
// Called when a bullet hits the boss.
// hitGroup tells us WHAT got hit — the body or the pilot.
//
// This is the key mechanic: smart players learn to aim for
// the tiny pilot instead of dumping bullets into the big body.

export function damagePuppetMaster(bossGroup, amount, hitGroup) {
  const d = bossGroup.userData;

  if (hitGroup === 'body') {
    d.bodyHp -= amount;
    flashMeshes(d.bodyHitbox, 3); // flash white for 3 frames
  } else if (hitGroup === 'pilot' && d.pilotExposed) {
    // Can only hurt the pilot when it's exposed!
    d.pilotHp -= amount;
    flashMeshes(d.pilotGroup, 5); // longer flash — satisfying hit
  }
  // If the pilot isn't exposed, the bullet just bounces off.
  // The player has to wait for a stumble or get to chapter 3.
}

// ─── MOVEMENT HELPERS ───────────────────────────
// These are like basic Lego motors — simple movements
// that the chapters above snap together into behavior.

function distanceTo(bossGroup, targetPos) {
  return bossGroup.position.distanceTo(targetPos);
}

function distanceToPilot(pilotGroup, targetPos) {
  // Pilot's world position (might be different from boss position
  // in chapter 3 when the pilot runs independently)
  const pilotWorldPos = new THREE.Vector3();
  pilotGroup.getWorldPosition(pilotWorldPos);
  return pilotWorldPos.distanceTo(targetPos);
}

function faceTarget(bossGroup, targetPos) {
  // Make the boss rotate to look at the player
  // (only rotates on the Y axis — we don't want it tilting up/down)
  const dir = new THREE.Vector3();
  dir.subVectors(targetPos, bossGroup.position);
  dir.y = 0; // ignore height difference
  if (dir.length() > 0.01) {
    const angle = Math.atan2(dir.x, dir.z);
    bossGroup.rotation.y = angle;
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
  // Same as moveToward but BACKWARDS — running away!
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
  // Zigzag randomly — like a panicked chicken
  pilotGroup.position.x += Math.sin(time * 7.3) * amount;
  pilotGroup.position.z += Math.cos(time * 5.1) * amount;
}

// ─── ATTACK ACTIONS ─────────────────────────────
// These are stubs — they set up the WHAT but the actual
// damage-dealing (spawning hitboxes, projectiles) gets
// connected when we build the combat system.
//
// For now they return what happened so the game loop
// knows to play sounds, spawn effects, etc.

function doBodySlam(bossGroup) {
  const d = bossGroup.userData;
  // Quick lunge animation: body dips forward
  // The game loop will read this flag and apply damage to the player
  d.currentAttack = {
    type: 'body_slam',
    damage: d.attackDamage,
    frame: 0,
    duration: 20, // attack lasts 20 frames
  };
}

function doPilotAttack(bossGroup, playerPos) {
  const d = bossGroup.userData;
  // Pilot throws a small projectile
  // The game loop will read this and spawn the actual bullet
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

  // Detach the pilot from the boss group so it can
  // run around independently (like popping a minifigure
  // off a Lego vehicle)
  const worldPos = new THREE.Vector3();
  d.pilotGroup.getWorldPosition(worldPos);

  // Move pilot to scene level so it's no longer a child of the body
  d.pilotGroup.position.copy(worldPos);

  // Mark body for collapse animation
  // (the game loop will tilt it over and fade it out)
  d.bodyCollapsing = true;
  d.bodyCollapseFrame = 0;

  // Hide tendrils — the connection is severed
  for (const strand of d.tendrils) {
    for (const seg of strand) {
      seg.mesh.visible = false;
    }
  }
  d.tendrilLight.intensity = 0;
}

function doPilotDeath(bossGroup) {
  const d = bossGroup.userData;
  // Pilot falls over — fight is won!
  d.pilotDeathFrame = 0;
  // The game loop will read isDead and play the victory sequence
}

// ─── ANIMATION ──────────────────────────────────
// These make the boss look alive. They run every frame
// regardless of what chapter we're in.

function animateWalk(bossGroup, time, speed, amplitude) {
  const d = bossGroup.userData;
  const t = time * speed;

  // Swing each leg back and forth
  // This is the same pattern as regular aliens —
  // since we used buildLegChain, the joints work the same way
  for (let i = 0; i < d.legs.length; i++) {
    const leg = d.legs[i];
    const offset = i * Math.PI; // legs alternate (one forward, one back)
    const swing = Math.sin(t + offset) * amplitude;
    leg.upper.rotation.x = 0.25 + swing;
    leg.lower.rotation.x = -0.4 - Math.abs(swing) * 0.5;
  }

  // Arms swing opposite to legs (like how you walk)
  for (let i = 0; i < d.arms.length; i++) {
    const arm = d.arms[i];
    const offset = i * Math.PI + Math.PI * 0.5;
    const swing = Math.sin(t + offset) * amplitude * 0.6;
    arm.upper.rotation.x = swing;
    arm.elbowPivot.rotation.x = -0.3 - Math.abs(swing) * 0.3;
  }

  // Slight body bob
  bossGroup.position.y = Math.abs(Math.sin(t)) * 0.04;
}

function animateTendrils(bossGroup, dt) {
  const d = bossGroup.userData;
  const t = d.walkTime;

  // Each tendril segment waves gently, like seaweed
  for (const strand of d.tendrils) {
    for (const seg of strand) {
      seg.mesh.position.x = seg.baseX + Math.sin(t * 2 + seg.seg * 0.8) * 0.03;
      seg.mesh.position.z = seg.baseZ + Math.cos(t * 1.5 + seg.seg) * 0.02;
    }
  }

  // In chapter 2, tendrils glow brighter (the connection is straining)
  if (d.phase === 'malfunctioning') {
    d.tendrilLight.intensity = 1.5 + Math.sin(t * 5) * 1.0;
  }
}

function animatePilot(bossGroup, dt) {
  const d = bossGroup.userData;
  const t = d.pilotBobTime;

  if (d.phase === 'controlled') {
    // Happy bounce — the pilot is having a great time driving
    d.pilotGroup.position.y = 2.0 + Math.sin(t * 3) * 0.03;
    d.pilotHead.rotation.z = Math.sin(t * 2) * 0.1;
  } else if (d.phase === 'malfunctioning') {
    // Nervous wobble — things are going wrong
    d.pilotGroup.position.y = 2.0 + Math.sin(t * 6) * 0.05;
    d.pilotHead.rotation.z = Math.sin(t * 8) * 0.2;
    d.pilotHead.rotation.x = Math.sin(t * 5) * 0.1;
  } else if (d.phase === 'ejected') {
    // Full panic — bouncing wildly
    d.pilotGroup.position.y += Math.abs(Math.sin(t * 10)) * 0.01;
    d.pilotHead.rotation.z = Math.sin(t * 12) * 0.3;

    // Tiny arms flailing
    for (let i = 0; i < d.pilotArms.length; i++) {
      const side = i === 0 ? -1 : 1;
      d.pilotArms[i].rotation.z = side * 0.8 + Math.sin(t * 9 + i * 2) * 0.5;
      d.pilotArms[i].rotation.x = -0.5 + Math.sin(t * 7 + i) * 0.4;
    }
  }
}

// ─── VISUAL FEEDBACK ────────────────────────────

function flashMeshes(group, frames) {
  // Mark the group for a white flash effect
  // The game loop's render pass will swap materials temporarily
  group.userData.flashFrames = frames;
}
