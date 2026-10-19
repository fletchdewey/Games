// src/bosses/swarm_ai.js
// HOW THE SWARM MOVES AND FIGHTS
//
// FLETCHER'S GUIDE:
// It does not walk. There is no skeleton to walk with — it is a cloud of
// motes holding a shape, so the movement has to come from the motes.
//
// THE FLOAT is three things stacked:
//   1. The MASS drifts toward you and bobs, instead of stepping. It leans
//      into the direction it's going, the way something with no feet would.
//   2. Each MOTE swirls slowly around the spot it belongs in, so the
//      silhouette is never quite still even when the swarm is.
//   3. The LOWER motes LAG. When the mass moves, the head arrives first and
//      the legs trail after it. That one sells it: a body whose bottom half
//      streams behind it is clearly being carried, not walking.
//
// THE ATTACK: two of the little things it's made of peel out of the body and
// fly at you, then come back and take their places again. Never more than two
// at once, so the silhouette never visibly empties out — and so the two that
// ARE out are easy to track.
//
// WHY NOTHING ROTATES: the group holding the motes is never turned. Its
// heading is applied per-mote when each one's home position is worked out
// instead. If the group itself rotated, a mote flying at you would be dragged
// sideways every time the body turned to follow you, which looks like the
// attack is being yanked around on a string. Keeping the container still
// means a detached mote simply flies where it was sent.
//
// Time is in FRAMES here, 60 to the second, same as the other boss files.

import * as THREE from 'three';
import { syncSwarm } from './swarm.js?v=41b9e6b811';

export const FX = {
  // ── The mass ──
  hoverY: 0.35,        // how far off the floor it rides
  bobHeight: 0.18,     // how far it rises and falls
  bobRate: 1.4,        // and how fast
  driftSpeed: 0.035,   // units per frame toward you
  keepAway: 4.0,       // it holds at this range rather than closing right in
  leanInto: 0.35,      // how hard it tips in the direction of travel
  turnRate: 0.06,      // how fast it comes round to face you

  // ── The motes ──
  swirl: 0.07,         // how far each wanders from the spot it belongs in
  swirlRate: 1.1,      // and how fast it wanders
  lag: 0.55,           // how much the bottom of the mass trails the top
  lagSpring: 0.09,     // how fast a trailing mote catches back up

  // ── The attack ──
  attackers: 2,        // how many come out at once
  attackRange: 11,     // it won't throw any from further than this
  attackCooldown: 110, // frames between one pair returning and the next going
  windFrames: 18,      // the pull-back before they go — this is your warning
  windPull: 0.75,      // how far out of the body they draw back
  flySpeed: 0.2,       // units per frame once launched
  flySteer: 0.025,     // how much they correct toward you in flight
  flyFrames: 100,      // give up and come home after this
  hitRadius: 0.65,     // how close counts as landing on you
  returnSpeed: 0.14,   // how fast they fly back to their place
  damage: 4,

  // ── Getting shot ──
  // A hit blows the whole thing apart, and it cannot be hurt again until it
  // has pulled itself back together. That cuts both ways: it can't attack
  // while it's in pieces either. So every hit buys you a breather and costs
  // you the chance to follow up, and the fight becomes a rhythm rather than
  // a damage race.
  //
  // Because of that, HP is a count of HITS, not of bullets — you only ever
  // land one per scatter. Keep it low.
  hp: 14,
  scatterSpeed: 0.34,    // how hard they blow apart
  scatterSpread: 0.9,    // randomness, against flying straight off the hit
  scatterDrag: 0.93,     // how quickly they slow once out
  scatterFrames: 26,     // flying apart
  hangFrames: 12,        // hanging there in pieces
  reformFrames: 50,      // pulling back together

  // ── Dying ──
  // Three stages. The thing holding them together is gone, so first they go
  // berserk, then they run out of whatever was keeping them up, then they
  // stop being there at all.
  frenzyFrames: 110,     // tearing around
  frenzySpeed: 0.3,      // how fast they rip about
  frenzyTurn: 0.22,      // how violently they change direction
  frenzyPull: 0.012,     // weak draw to the centre, so they churn not disperse
  // The frenzy throws motes a long way up, so the fall has to be able to
  // bring them ALL down before the vanish starts — at 80 frames and this
  // gravity, 63 of 162 were still in the air when they began winking out,
  // which is not "they fall to the ground and disappear", it's "they
  // disappear, some of them in mid-air". The cap is now a safety net rather
  // than the thing that ends the stage.
  fallFrames: 170,       // cap on dropping out of the air
  fallGravity: 0.0062,
  vanishFrames: 70,      // winking out, staggered so they don't go as one
};

export function initSwarm(group) {
  const d = group.userData;
  d.hp = FX.hp;
  d.hpMax = FX.hp;
  // 'held' is the only state it can be hurt in, or attack from.
  d.phase = 'held';
  d.phaseT = 0;
  d.time = 0;
  d.facing = 0;
  d.lean = { x: 0, z: 0 };
  d.lastPos = group.position.clone();
  d.travel = new THREE.Vector3();   // smoothed velocity, for the lean and lag
  d.attackTimer = FX.attackCooldown;
  d.isDead = false;
  for (const m of d.motes) {
    m.state = 'home';
    m.t = 0;
    m.vel.set(0, 0, 0);
  }
}

export function updateSwarm(group, playerPos, dtF) {
  const d = group.userData;
  if (d.isDead) {
    if (d.phase !== 'gone') {
      stepDeath(group, dtF);
      syncSwarm(group);
    }
    return;
  }

  d.time += dtF;
  const t = d.time / 60;

  // ── The mass drifts ───────────────────────────────────────
  const to = new THREE.Vector3().subVectors(playerPos, group.position);
  to.y = 0;
  const dist = to.length();
  if (dist > 0.001) to.normalize();

  // It hangs back rather than pressing right up against you — a cloud has no
  // reason to close to melee range, and the attack is the part that reaches.
  if (dist > FX.keepAway) {
    group.position.addScaledVector(to, FX.driftSpeed * dtF);
  } else if (dist < FX.keepAway - 1) {
    group.position.addScaledVector(to, -FX.driftSpeed * 0.6 * dtF);
  }

  // Bob. Set absolutely from the hover height — never accumulated, or it
  // climbs away the way the Puppet Master's pilot used to.
  group.position.y = FX.hoverY + Math.sin(t * FX.bobRate) * FX.bobHeight;

  // Turn to face you, easing rather than snapping. Stored, not applied to
  // the group — see the note at the top of the file.
  const want = Math.atan2(to.x, to.z);
  let turn = want - d.facing;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  d.facing += turn * Math.min(1, FX.turnRate * dtF);

  // ── Lean into the travel ──────────────────────────────────
  // Measured from where it actually moved, not from where it wants to go, so
  // it straightens up as it comes to a stop. Applied as a shear on the motes
  // rather than a rotation: for a cloud the two look the same, and a shear
  // leaves the container untouched.
  const moved = new THREE.Vector3().subVectors(group.position, d.lastPos);
  moved.y = 0;
  d.travel.lerp(moved, Math.min(1, 0.12 * dtF));
  d.lastPos.copy(group.position);
  // Same normalisation as the trail: `leanInto` is how far the top of the
  // body is pushed forward, in units, at full drift speed.
  d.lean.x = -trailXOf(d) * FX.leanInto;
  d.lean.z = -trailZOf(d) * FX.leanInto;

  if (d.phase === 'held') {
    stepAttack(group, playerPos, dtF, dist);
    stepMotes(group, playerPos, dtF);
  } else {
    stepScatter(group, dtF);
  }
  syncSwarm(group);
}

// ─── THE ATTACK ─────────────────────────────────
// Launches go out in pairs and the timer only restarts once BOTH are home,
// so "two at a time" holds no matter how long a chase takes.

function stepAttack(group, playerPos, dtF, dist) {
  const d = group.userData;
  const out = d.motes.filter((m) => m.state !== 'home');

  if (out.length > 0) return;          // wait for the pair to get back
  d.attackTimer -= dtF;
  if (d.attackTimer > 0 || dist > FX.attackRange) return;

  // The ones that come out are the glowing motes, deliberately: they are the
  // only ones bright enough to follow across a room, and an attack you can't
  // see coming isn't an attack, it's just damage.
  const pool = d.motes.filter((m) => m.kind === 'glow' && m.state === 'home');
  for (let i = 0; i < FX.attackers && pool.length; i++) {
    const m = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    m.state = 'wind';
    m.t = 0;
  }
  d.attackTimer = FX.attackCooldown;
}

// Travel direction, scaled 0..1 by how close it is to full drift speed.
function trailXOf(d) {
  const sp = Math.hypot(d.travel.x, d.travel.z);
  return sp > 1e-6 ? -d.travel.x * Math.min(1, sp / FX.driftSpeed) / sp : 0;
}
function trailZOf(d) {
  const sp = Math.hypot(d.travel.x, d.travel.z);
  return sp > 1e-6 ? -d.travel.z * Math.min(1, sp / FX.driftSpeed) / sp : 0;
}

// Where a mote belongs right now, in the group's own space: its home point
// turned to the body's heading, sheared by the lean.
function homeTarget(d, m, out) {
  const c = Math.cos(d.facing), s = Math.sin(d.facing);
  out.x = m.home.x * c + m.home.z * s + d.lean.x * m.home.y;
  out.y = m.home.y;
  out.z = -m.home.x * s + m.home.z * c + d.lean.z * m.home.y;
  return out;
}

const _t = new THREE.Vector3();
const _aim = new THREE.Vector3();

function stepMotes(group, playerPos, dtF) {
  const d = group.userData;
  const t = d.time / 60;

  // The trail, normalised. `lag` reads as "how far behind the feet sit when
  // it's moving flat out", in units — it used to be a bare multiplier on a
  // per-frame delta, which made it both frame-rate dependent and enormous:
  // the silhouette smeared into a diagonal streak instead of trailing.
  const sp = Math.hypot(d.travel.x, d.travel.z);
  const pull = sp > 1e-6 ? Math.min(1, sp / FX.driftSpeed) / sp : 0;
  const trailX = -d.travel.x * pull;
  const trailZ = -d.travel.z * pull;

  // The player, in the group's own space. The group never rotates, so this is
  // just an offset.
  _aim.subVectors(playerPos, group.position);

  for (const m of d.motes) {
    homeTarget(d, m, _t);

    if (m.state === 'home') {
      const ph = m.phase + t * FX.swirlRate * m.spin;
      // Proportional to how low the mote sits and how fast the mass is
      // moving, so a stationary swarm hangs straight.
      const drag = m.low * FX.lag;
      const tx = _t.x + Math.sin(ph) * FX.swirl + trailX * drag;
      const ty = _t.y + Math.sin(ph * 1.37 + 1.1) * FX.swirl;
      const tz = _t.z + Math.cos(ph * 0.83) * FX.swirl + trailZ * drag;
      const k = Math.min(1, FX.lagSpring * dtF);
      m.pos.x += (tx - m.pos.x) * k;
      m.pos.y += (ty - m.pos.y) * k;
      m.pos.z += (tz - m.pos.z) * k;
      m.scaleMul = 1;
      continue;
    }

    if (m.state === 'wind') {
      // Draws back and out of the body, away from you. The tell.
      m.t += dtF;
      const p = Math.min(1, m.t / FX.windFrames);
      const away = _aim.clone().setY(0);
      if (away.lengthSq() > 0.0001) away.normalize();
      const tx = _t.x - away.x * FX.windPull * p;
      const ty = _t.y + 0.25 * p;
      const tz = _t.z - away.z * FX.windPull * p;
      const k = Math.min(1, 0.25 * dtF);
      m.pos.x += (tx - m.pos.x) * k;
      m.pos.y += (ty - m.pos.y) * k;
      m.pos.z += (tz - m.pos.z) * k;
      m.scaleMul = 1 + p * 0.5;          // swells as it winds up
      if (p >= 1) {
        m.state = 'fly';
        m.t = 0;
        m.vel.copy(_aim).sub(m.pos).normalize().multiplyScalar(FX.flySpeed);
      }
      continue;
    }

    if (m.state === 'fly') {
      m.t += dtF;
      // A little correction toward you, like the Brute's charge — enough that
      // standing still is punished, little enough that moving beats it.
      const steer = _aim.clone().sub(m.pos);
      if (steer.lengthSq() > 0.0001) {
        steer.normalize().multiplyScalar(FX.flySpeed);
        m.vel.lerp(steer, Math.min(1, FX.flySteer * dtF));
      }
      m.pos.addScaledVector(m.vel, dtF);
      m.scaleMul = 1.5;

      if (m.pos.distanceTo(_aim) < FX.hitRadius) {
        d.currentAttack = { type: 'swarm_bite', damage: FX.damage };
        m.state = 'back';
        m.t = 0;
      } else if (m.t > FX.flyFrames || m.pos.y < 0.05) {
        m.state = 'back';
        m.t = 0;
      }
      continue;
    }

    // 'back' — fly home and slot in. Eased, so they arrive rather than snap.
    m.t += dtF;
    const k = Math.min(1, FX.returnSpeed * dtF * 0.5);
    m.pos.x += (_t.x - m.pos.x) * k;
    m.pos.y += (_t.y - m.pos.y) * k;
    m.pos.z += (_t.z - m.pos.z) * k;
    m.scaleMul = 1.5 - 0.5 * Math.min(1, m.t / 40);
    if (m.pos.distanceTo(_t) < 0.12 || m.t > 240) {
      m.state = 'home';
      m.scaleMul = 1;
    }
  }
}

// ─── GETTING SHOT ───────────────────────────────
// Returns true if the hit actually landed. A hit while it's already in
// pieces does nothing at all — there's no body there to hit.

export function damageSwarm(group, amount, atWorldPos) {
  const d = group.userData;
  if (d.isDead || d.phase !== 'held') return false;

  d.hp -= amount;
  if (d.hp <= 0) { d.hp = 0; d.isDead = true; }

  // Blow apart from wherever it was hit, so the burst reads as coming FROM
  // the shot rather than just happening. Motes nearest the impact go hardest.
  const hit = new THREE.Vector3();
  if (atWorldPos) hit.subVectors(atWorldPos, group.position);
  else hit.set(0, 1.2, 0);

  for (const m of d.motes) {
    const away = new THREE.Vector3().subVectors(m.pos, hit);
    const near = 1 / (0.6 + away.length());        // close to the hit = harder
    if (away.lengthSq() < 1e-6) away.set(0, 1, 0);
    away.normalize();
    m.vel.set(
      away.x + (Math.random() - 0.5) * FX.scatterSpread,
      away.y * 0.6 + Math.random() * FX.scatterSpread * 0.8,
      away.z + (Math.random() - 0.5) * FX.scatterSpread,
    ).normalize().multiplyScalar(FX.scatterSpeed * (0.5 + near * 1.6));
    m.state = 'scatter';
    m.t = 0;
    m.scaleMul = 1;
  }

  // The killing hit still bursts it apart — that burst IS the start of the
  // frenzy, so the death flows out of the shot rather than restarting.
  d.phase = d.isDead ? 'frenzy' : 'scatter';
  d.phaseT = 0;
  return true;
}

// Flying apart, hanging there, then pulling back together. Nothing else runs
// while this does — the attack is skipped and damage is refused.
function stepScatter(group, dtF) {
  const d = group.userData;
  d.phaseT += dtF;

  if (d.phase === 'scatter') {
    const drag = Math.pow(FX.scatterDrag, dtF);
    for (const m of d.motes) {
      m.pos.addScaledVector(m.vel, dtF);
      m.vel.multiplyScalar(drag);
      if (m.pos.y < 0.05 - group.position.y) {
        m.pos.y = 0.05 - group.position.y;
        m.vel.y = Math.abs(m.vel.y) * 0.3;         // skips off the floor
      }
    }
    // Dim while it's in pieces. This is the tell that it can't be hurt —
    // without it, shots that do nothing just look like the game is broken.
    setGlow(d, 0.25);
    d.aura.intensity = 0.2;
    if (d.phaseT >= FX.scatterFrames + FX.hangFrames) {
      d.phase = 'reform';
      d.phaseT = 0;
    }
    return;
  }

  // Reforming. Eased so they stream back in rather than snapping.
  const p = Math.min(1, d.phaseT / FX.reformFrames);
  const k = Math.min(1, (0.04 + p * 0.16) * dtF);
  for (const m of d.motes) {
    homeTarget(d, m, _t);
    m.pos.x += (_t.x - m.pos.x) * k;
    m.pos.y += (_t.y - m.pos.y) * k;
    m.pos.z += (_t.z - m.pos.z) * k;
  }
  setGlow(d, 0.25 + p * 0.75);
  d.aura.intensity = 0.2 + p * 1.2;

  if (p >= 1) {
    d.phase = 'held';
    d.phaseT = 0;
    setGlow(d, 1);
    d.aura.intensity = 1.4;
    for (const m of d.motes) { m.state = 'home'; m.t = 0; m.vel.set(0, 0, 0); }
    // It gets a moment before it can attack again, or a reform that finishes
    // in your face fires instantly.
    d.attackTimer = Math.max(d.attackTimer, FX.windFrames * 2);
  }
}

// ─── DYING ──────────────────────────────────────
// Whatever was holding them in a shape has stopped. They go berserk, then
// they drop, then they're gone.
//
//   FRENZY  tearing around at random, with a weak pull to the centre so they
//           churn in a cloud instead of simply dispersing and leaving.
//   FALL    gravity wins. They drop, skip off the floor and settle.
//   VANISH  each one winks out at its own moment, not all together.

function stepDeath(group, dtF) {
  const d = group.userData;
  d.phaseT += dtF;
  const floor = 0.04 - group.position.y;

  if (d.phase === 'frenzy') {
    const p = d.phaseT / FX.frenzyFrames;
    for (const m of d.motes) {
      // Random kick every frame, then clamped — an unbounded random walk
      // would let a few motes escape to the horizon while the rest churned.
      m.vel.x += (Math.random() - 0.5) * FX.frenzyTurn * dtF;
      m.vel.y += (Math.random() - 0.5) * FX.frenzyTurn * dtF;
      m.vel.z += (Math.random() - 0.5) * FX.frenzyTurn * dtF;
      m.vel.x -= m.pos.x * FX.frenzyPull * dtF;
      m.vel.y -= (m.pos.y - 1.2) * FX.frenzyPull * dtF;
      m.vel.z -= m.pos.z * FX.frenzyPull * dtF;
      const sp = m.vel.length();
      if (sp > FX.frenzySpeed) m.vel.multiplyScalar(FX.frenzySpeed / sp);
      m.pos.addScaledVector(m.vel, dtF);
      if (m.pos.y < floor) { m.pos.y = floor; m.vel.y = Math.abs(m.vel.y); }
    }
    // Flares as it goes wild, then starts to go out.
    setGlow(d, 1 + Math.sin(d.phaseT * 0.4) * 0.4 * (1 - p));
    d.aura.intensity = 1.4 + Math.sin(d.phaseT * 0.5) * 1.2 * (1 - p);
    if (d.phaseT >= FX.frenzyFrames) {
      d.phase = 'fall';
      d.phaseT = 0;
    }
    return;
  }

  if (d.phase === 'fall') {
    let moving = false;
    for (const m of d.motes) {
      if (m.pos.y <= floor + 1e-4 && Math.abs(m.vel.y) < 0.004) {
        m.pos.y = floor;
        continue;
      }
      moving = true;
      m.vel.y -= FX.fallGravity * dtF;
      m.pos.addScaledVector(m.vel, dtF);
      m.vel.x *= Math.pow(0.96, dtF);
      m.vel.z *= Math.pow(0.96, dtF);
      if (m.pos.y < floor) {
        m.pos.y = floor;
        m.vel.y = -m.vel.y * 0.25;
        m.vel.x *= 0.6; m.vel.z *= 0.6;
      }
    }
    const fade = Math.max(0, 1 - d.phaseT / 70);
    setGlow(d, fade);
    d.aura.intensity = 1.4 * fade;
    // Move on once they've all come to rest, or when the clock runs out —
    // a mote wedged in a slow bounce shouldn't hold the whole death open.
    if (!moving || d.phaseT >= FX.fallFrames) {
      d.phase = 'vanish';
      d.phaseT = 0;
      for (const m of d.motes) m.goAt = Math.random() * FX.vanishFrames * 0.7;
    }
    return;
  }

  if (d.phase === 'vanish') {
    let any = false;
    for (const m of d.motes) {
      const t = (d.phaseT - m.goAt) / (FX.vanishFrames * 0.3);
      m.scaleMul = t <= 0 ? 1 : Math.max(0, 1 - t);
      if (m.scaleMul > 0) any = true;
    }
    setGlow(d, 0);
    d.aura.intensity = 0;
    if (!any) {
      d.phase = 'gone';
      for (const mesh of d.meshes) mesh.visible = false;
    }
  }
}

// Force the pair out now, whatever the cooldown says. For the workshop —
// waiting out a cooldown to look at an attack wastes everyone's time.
export function forceSwarmAttack(group) {
  const d = group.userData;
  if (d.isDead || d.phase !== 'held') return false;
  if (d.motes.some((m) => m.state !== 'home')) return false;
  const pool = d.motes.filter((m) => m.kind === 'glow' && m.state === 'home');
  for (let i = 0; i < FX.attackers && pool.length; i++) {
    const m = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    m.state = 'wind';
    m.t = 0;
  }
  d.attackTimer = FX.attackCooldown;
  return true;
}

// The glowing motes all share one material, so their brightness is a single
// assignment rather than a loop over instances.
const GLOW_FULL = new THREE.Color(0xff44cc);
function setGlow(d, mul) {
  for (const mesh of d.meshes) {
    if (mesh.userData.hitPart === 'eye') continue;
    if (mesh.material.isMeshBasicMaterial) {
      mesh.material.color.copy(GLOW_FULL).multiplyScalar(mul);
    }
  }
}
