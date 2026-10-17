// src/bosses/twins_ai.js
// HOW THE TWINS THINK
//
// FLETCHER'S GUIDE:
// They share a life. Drop one and the other stops caring about you entirely,
// walks to where its twin fell, kneels over it, and brings it back.
//
// That one rule is the whole fight, and everything else exists to serve it:
//
//   WHICH one you drop matters, because the survivor has to CROSS THE ROOM.
//   Drop the one standing next to its twin and the revive starts almost at
//   once; drop the far one and you've bought yourself the walk.
//
//   WHERE it falls matters for the same reason. A twin dropped on the far
//   side of the arena is a long errand for the other one.
//
//   You get a choice of answers. Kill the survivor while it's walking or
//   kneeling — it ignores you completely in that state, so it's the easiest
//   it will ever be to hit. Or keep it away from the body until the downed
//   one bleeds out and can't be brought back at all.
//
// Time is in FRAMES here, 60 to the second, like the other boss files.

import * as THREE from 'three';

export const FX = {
  // SPEEDS ARE IN UNITS PER FRAME. The player walks at 5 units per SECOND
  // (WALK_SPEED in game.js), which is 0.0833 per frame — the number every
  // one of these is set against.
  //
  // ── The blue one: small, fast, shoots ──
  // Slightly quicker than you when it's closing, so you can't simply walk
  // out of its firing line. But it retreats at 0.8x, which is 4.2 u/s —
  // slower than you — so closing on it is always possible, just slow.
  blueHp: 18,
  blueSpeed: 0.088,         // 5.3 u/s
  blueRange: 9,             // it holds this far off and fires
  blueFireEvery: 70,        // frames between shots
  // DAMAGE IS IN PLAYER HEALTH POINTS, and the player has 100 (playerHp in
  // game.js), so these read directly as percentages.
  blueDamage: 5,            // 5% a bolt — chip damage you can absorb

  // ── The brown one: big, heavy, closes ──
  // 4.3 u/s against your 5. You outrun it by 0.7 u/s — enough to get away
  // if you commit to running, and nowhere near enough to stand still.
  // Every second you stop to deal with the blue one, this closes 4.3 units,
  // and its reach is 2.4. That is the whole pressure of the fight: the blue
  // one is the problem you want to solve and the brown one is the reason you
  // don't get time to solve it.
  brownHp: 30,
  brownSpeed: 0.072,        // 4.3 u/s
  brownRange: 2.4,          // has to reach you
  brownSwingEvery: 95,
  brownDamage: 15,          // 15% a smash — three times the blue one's bolt

  // ── The smash ──
  // Both hands up over its head, then down. Built like the Brute's slam, for
  // the same reason: it has to be a thing you can SEE coming and step out of,
  // not damage that happens because you were standing somewhere.
  //
  // It plants its feet and commits — it can't track you once the arms are up.
  // raise+impact is 32 frames, just over half a second, in which you can
  // cover 2.7 units at walking pace. Reach is 3.0 and it closes to 2.4, so
  // backing off beats it, but only if you start when the arms go up.
  smashRaise: 26,           // arms going up — this is the tell
  smashDown: 14,            // and coming down
  smashImpact: 6,           // frames into the down swing that it lands
  smashRecover: 34,         // open, afterwards
  smashRange: 3.0,
  smashArc: Math.PI / 3,    // 60 degrees either side of its nose

  // ── Going down and coming back ──
  // This is the fight. reviveRange is how close the survivor must get;
  // reviveFrames is how long it kneels there, which is the window you have
  // to kill it in; bleedOut is how long the body lasts before it's gone for
  // good, which is the other way to win.
  downFrames: 30,           // collapsing onto the floor

  // These three decide whether the fight is about POSITION or about damage,
  // and the first version got it backwards.
  //
  // Measured at the old values: dropping the brown one gave the blue a 1.1s
  // walk and then a 2.7s kneel, so the distance was a quarter of the window.
  // Dropping the blue one was worse — the brown was already inside its
  // revive range and walked ZERO. Where you dropped a twin barely mattered;
  // the fight was a damage check on a kneeling animation.
  //
  // So: the survivor now walks SLOWER than it fights, the kneel is a beat
  // rather than the event, and it has to get close enough to touch. The walk
  // is now most of the window, which is the whole point of the mechanic.
  reviveRange: 1.2,         // centre to centre — they're nearly touching
  reviveFrames: 60,         // a second over the body, not three
  // Of its combat speed. Lowered from 0.7 when the chase speeds went up:
  // the revive window is a function of fetch speed, so raising how fast they
  // CHASE would otherwise have quietly shortened the walk we just tuned.
  // At 0.45 the fetch is ~2.3 u/s, which is what it was before.
  fetchSpeed: 0.45,
  reviveHpShare: 0.5,       // how much health it gets back, as a fraction
  bleedOutFrames: 780,      // ~13s before a body can't be revived
};

export function initTwins(group) {
  const d = group.userData;
  const cfg = {
    blue: { hp: FX.blueHp, speed: FX.blueSpeed },
    brown: { hp: FX.brownHp, speed: FX.brownSpeed },
  };
  for (const t of d.twins) {
    const c = cfg[t.kind];
    t.hp = c.hp;
    t.hpMax = c.hp;
    t.state = 'up';          // 'up' | 'down' | 'dead'
    t.stateT = 0;
    t.facing = 0;
    t.attackT = Math.random() * 60;
    t.walkT = 0;
    t.gait = 0;
    t.reviveT = 0;
    t.speedOf = c.speed;
    t.smash = { state: 'none', t: 0, hit: false };
  }
  // Start them apart, so the first kill already has a walk attached to it.
  d.blue.group.position.set(-2.2, 0, 0);
  d.brown.group.position.set(2.2, 0, 0);
  d.defeated = false;
  d.attacks = [];            // notes the game turns into damage/projectiles
}

const _v = new THREE.Vector3();

function faceToward(t, x, z, dtF) {
  const want = Math.atan2(x - t.group.position.x, z - t.group.position.z);
  let turn = want - t.facing;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  t.facing += turn * Math.min(1, 0.12 * dtF);
  t.group.rotation.y = t.facing;
}

function walkTo(t, x, z, speed, dtF) {
  _v.set(x - t.group.position.x, 0, z - t.group.position.z);
  const dist = _v.length();
  if (dist > 0.001) {
    _v.normalize();
    t.group.position.addScaledVector(_v, speed * dtF);
  }
  return dist;
}

// ─── THE WALK ───────────────────────────────────
// The stride is driven by DISTANCE ACTUALLY COVERED, not by the speed it was
// asked to move at, and it fades in and out instead of switching on and off.
//
// It used to do neither, and the blue one's legs shook because of it. Blue
// holds a firing range, so every frame it picks one of three things: close
// in, back off, or stand still and shoot. Driving the cycle from the speed
// argument meant backing off ran the legs BACKWARDS — and standing still
// snapped them straight from wherever mid-stride they were. Sitting at the
// edge of its range, it flickered between all three every few frames.
//
// Phase from real movement can't run backwards or jump; a gait that eases
// can't snap. Neither failure is reachable now.

const STRIDE = {
  // Radians of leg swing per unit travelled. The brown one is a quarter
  // bigger, so it covers more ground per step and needs fewer.
  blue: 7.0,
  brown: 3.6,
};
const SWING = { blue: 0.26, brown: 0.18 };

function stepGait(t, movedThisFrame, dtF) {
  t.walkT += movedThisFrame;
  const want = movedThisFrame / Math.max(dtF, 0.0001) > 0.004 ? 1 : 0;
  t.gait += (want - t.gait) * Math.min(1, 0.18 * dtF);

  const w = t.walkT * STRIDE[t.kind];
  const amp = SWING[t.kind] * t.gait;
  t.legs.forEach((leg, i) => {
    const swing = Math.sin(w + i * Math.PI) * amp;
    leg.upper.rotation.x = leg.baseUpper + swing;
    leg.lower.rotation.x = leg.baseLower - Math.abs(swing) * 0.5;
  });
  t.arms.forEach((arm, i) => {
    arm.upper.rotation.x = Math.sin(w + i * Math.PI + Math.PI) * amp * 0.6;
  });
}

function restPose(t) {
  t.gait = 0;
  t.legs.forEach((leg) => {
    leg.upper.rotation.x = leg.baseUpper;
    leg.lower.rotation.x = leg.baseLower;
  });
  // Shoulder and elbow too: the smash drives those, and leaving them set
  // would strand the arms overhead the moment it switched to anything else.
  t.arms.forEach((arm) => {
    arm.upper.rotation.x = 0;
    arm.shoulderPivot.rotation.x = 0;
    arm.elbowPivot.rotation.x = 0;
  });
}

export function updateTwins(group, playerPos, dtF) {
  const d = group.userData;
  if (d.defeated) return;

  const [a, b] = d.twins;
  stepTwin(d, a, b, playerPos, dtF);
  stepTwin(d, b, a, playerPos, dtF);

  // Both down or gone, and nobody left standing to help: that's the fight.
  const standing = d.twins.filter((t) => t.state === 'up');
  if (!standing.length) {
    const anyRevivable = d.twins.some(
      (t) => t.state === 'down' && t.stateT < FX.bleedOutFrames);
    if (!anyRevivable) d.defeated = true;
  }
}

function stepTwin(d, t, other, playerPos, dtF) {
  t.stateT += dtF;

  // ── DOWN ──────────────────────────────────────────────────
  // Collapses, then lies there. It is not dead — not until it bleeds out, or
  // until its twin can't come for it.
  if (t.state === 'down') {
    const p = Math.min(1, t.stateT / FX.downFrames);
    t.group.rotation.x = p * 1.45;              // face down on the floor
    t.group.position.y = -p * 0.25;
    restPose(t);
    if (t.stateT >= FX.bleedOutFrames) {
      t.state = 'dead';
      t.stateT = 0;
    }
    return;
  }

  if (t.state === 'dead') { restPose(t); return; }

  // ── FETCHING ITS TWIN ─────────────────────────────────────
  // Nothing else matters. It doesn't shoot, doesn't dodge, doesn't look at
  // you — which is exactly why this is your window on it.
  if (other.state === 'down') {
    if (t.smash && t.smash.state !== 'none') {
      t.smash.state = 'none';
      t.group.rotation.x = 0;
      restPose(t);
    }
    const target = other.group.position;
    const wasX = t.group.position.x, wasZ = t.group.position.z;
    const dist = walkTo(t, target.x, target.z,
                        t.speedOf * FX.fetchSpeed, dtF);
    faceToward(t, target.x, target.z, dtF);
    const moved = Math.hypot(t.group.position.x - wasX,
                             t.group.position.z - wasZ);

    // One range for both. The brown one used to get 1.25x for being bigger,
    // which is why it could revive from over two units away without moving.
    if (dist <= FX.reviveRange) {
      t.reviveT += dtF;
      // Kneels: drops down and reaches for its twin.
      const p = Math.min(1, t.reviveT / FX.reviveFrames);
      t.group.position.y = -0.2 * Math.min(1, p * 3);
      t.arms.forEach((arm) => { arm.upper.rotation.x = -0.9; });
      t.legs.forEach((leg) => {
        leg.upper.rotation.x = leg.baseUpper + 0.7;
        leg.lower.rotation.x = leg.baseLower - 1.1;
      });
      if (t.reviveT >= FX.reviveFrames) {
        reviveTwin(other);
        t.reviveT = 0;
        t.group.position.y = 0;
        restPose(t);
      }
    } else {
      t.reviveT = 0;
      t.group.position.y = 0;
      stepGait(t, moved, dtF);
    }
    return;
  }

  // ── FIGHTING YOU ──────────────────────────────────────────
  t.reviveT = 0;
  const px = playerPos.x, pz = playerPos.z;
  _v.set(px - t.group.position.x, 0, pz - t.group.position.z);
  const dist = _v.length();
  faceToward(t, px, pz, dtF);
  t.attackT -= dtF;

  const wasX = t.group.position.x, wasZ = t.group.position.z;

  if (t.kind === 'blue') {
    // Holds its range and shoots. Backs off if you close on it.
    if (dist > FX.blueRange) {
      walkTo(t, px, pz, t.speedOf, dtF);
    } else if (dist < FX.blueRange - 2.5) {
      walkTo(t, px, pz, -t.speedOf * 0.8, dtF);
    }
    stepGait(t, Math.hypot(t.group.position.x - wasX,
                           t.group.position.z - wasZ), dtF);
    if (t.attackT <= 0 && dist <= FX.blueRange + 1) {
      t.attackT = FX.blueFireEvery;
      const from = new THREE.Vector3();
      if (t.muzzle) t.muzzle.getWorldPosition(from);
      else from.copy(t.group.position).setY(1.4);
      d.attacks.push({ type: 'twin_bolt', from, to: playerPos.clone(),
                       damage: FX.blueDamage });
    }
    return;
  }

  // Brown: closes, then smashes with both hands.
  if (t.smash.state !== 'none') {
    stepSmash(d, t, playerPos, dtF);   // committed: it doesn't walk or turn
    return;
  }

  if (dist > FX.brownRange) {
    walkTo(t, px, pz, t.speedOf, dtF);
  }
  stepGait(t, Math.hypot(t.group.position.x - wasX,
                         t.group.position.z - wasZ), dtF);

  if (dist <= FX.brownRange && t.attackT <= 0) {
    t.smash.state = 'raise';
    t.smash.t = 0;
    t.smash.hit = false;
  }
}

// Both arms driven together from the shoulder. The walk cycle uses
// upper.rotation.x, so that gets cleared — otherwise a stride left half-set
// when it stopped stays mixed into the swing.
function setArms(t, shoulderX, elbowX) {
  t.arms.forEach((arm) => {
    arm.shoulderPivot.rotation.x = shoulderX;
    arm.elbowPivot.rotation.x = elbowX;
    arm.upper.rotation.x = 0;
  });
}

// Arms overhead, then down. Rotating a down-hanging arm about X by about
// -2.5 points it up and forward; about -0.5 points it down and forward. So
// the swing is one number travelling between those two.
function stepSmash(d, t, playerPos, dtF) {
  const sm = t.smash;
  sm.t += dtF;
  t.gait = 0;
  t.legs.forEach((leg) => {
    leg.upper.rotation.x = leg.baseUpper;
    leg.lower.rotation.x = leg.baseLower;
  });

  if (sm.state === 'raise') {
    const p = Math.min(1, sm.t / FX.smashRaise);
    const e = p * p;                       // winds up, slow then quick
    setArms(t, -0.1 - 2.4 * e, -0.3 - 0.5 * e);
    t.group.rotation.x = -0.18 * e;        // rocks back onto its heels
    if (sm.t >= FX.smashRaise) { sm.state = 'down'; sm.t = 0; sm.hit = false; }
    return;
  }

  if (sm.state === 'down') {
    const p = Math.min(1, sm.t / FX.smashDown);
    setArms(t, -2.5 + 2.0 * p, -0.8 + 0.7 * p);
    t.group.rotation.x = -0.18 + 0.45 * p;  // lurches onto it

    // Lands on one frame. In front AND in reach — step out of the cone and
    // it pounds the floor.
    if (!sm.hit && sm.t >= FX.smashImpact) {
      sm.hit = true;
      _v.set(playerPos.x - t.group.position.x, 0, playerPos.z - t.group.position.z);
      const reach = _v.length();
      const facing = new THREE.Vector3(Math.sin(t.facing), 0, Math.cos(t.facing));
      const offAxis = reach > 0 ? facing.angleTo(_v.clone().normalize()) : 0;
      if (reach <= FX.smashRange && offAxis < FX.smashArc) {
        d.attacks.push({ type: 'twin_swing', damage: FX.brownDamage,
                         at: t.group.position.clone(), range: FX.smashRange });
      }
    }
    if (sm.t >= FX.smashDown) { sm.state = 'recover'; sm.t = 0; }
    return;
  }

  const p = Math.min(1, sm.t / FX.smashRecover);
  setArms(t, -0.5 * (1 - p), -0.1 - 0.2 * p);
  t.group.rotation.x = 0.27 * (1 - p);
  if (sm.t >= FX.smashRecover) {
    sm.state = 'none';
    t.group.rotation.x = 0;
    t.attackT = FX.brownSwingEvery;
    restPose(t);
  }
}

function reviveTwin(t) {
  t.state = 'up';
  t.stateT = 0;
  t.hp = Math.max(1, Math.round(t.hpMax * FX.reviveHpShare));
  t.group.rotation.x = 0;
  t.group.position.y = 0;
  t.attackT = 40;
  restPose(t);
}

// Returns what happened, so the caller can report it: 'down', 'dead' or null
// if the hit landed on something already out of the fight.
export function damageTwin(group, which, amount) {
  const d = group.userData;
  const t = d.twins.find((x) => x.kind === which);
  if (!t || t.state !== 'up') return null;

  t.hp -= amount;
  if (t.hp > 0) return 'hit';

  t.hp = 0;
  t.state = 'down';
  t.stateT = 0;
  t.reviveT = 0;

  // If its twin is already down or gone, nobody is coming — both are out and
  // the fight is over the moment this one lands.
  const other = d.twins.find((x) => x !== t);
  if (other.state !== 'up') {
    t.state = 'dead';
    other.state = 'dead';
    d.defeated = true;
    return 'dead';
  }
  return 'down';
}

// Speeds live on the twin so the workshop can change them live.
export function applyTwinSpeeds(group) {
  const d = group.userData;
  d.blue.speedOf = FX.blueSpeed;
  d.brown.speedOf = FX.brownSpeed;
}
