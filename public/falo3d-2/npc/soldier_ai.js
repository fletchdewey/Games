// src/npc/soldier_ai.js
// WHAT THE SOLDIER DOES
//
// FLETCHER'S GUIDE:
// He is the only thing in the game that is on your side, and that changes how
// he has to be written. An alien only has to look dangerous. He has to be
// USEFUL — which means he must keep up with you, must shoot things you are
// already fighting, and must not get in your way while doing it.
//
//   TIED      sat against the wall. Does nothing until you walk up to him.
//   RISING    gets to his feet. Half a second, and he is yours.
//   FOLLOW    walks after you, stopping short so he isn't stood on your heel.
//   ENGAGE    an alien in range and in sight: he plants and shoots it.
//   DOWN      he can die. That is the whole reason he is worth anything.
//
// He never decides anything about the world — he reports. Picking a target
// is his; dealing the damage and drawing the tracer is the game's, because
// the aliens and the bullets live out there.

import * as THREE from 'three';
import { poseTied, poseStand, poseAim, poseDead, freeSoldier, SOLDIER }
  from './soldier.js?v=c795c8d6b6';

export const FX = {
  freeRange: 2.0,          // how close you have to get to cut him loose
  riseFrames: 34,

  followGap: 2.9,          // he stops this far off you
  // Faster than you, and it has to be. At 0.082 he was a hair SLOWER than
  // your 0.083 walk, so over a long corridor he fell steadily further behind
  // and only ever caught up when you stopped. A follower has to be able to
  // close a gap, not merely hold one.
  speed: 0.096,
  // And a limit past which walking is hopeless — through the board without
  // him, or wedged on something. Rather than lose him for the rest of the
  // run he simply catches up. It is a long way: far enough that it can never
  // happen while you can actually see him.
  lost: 30,
  turn: 0.22,

  sight: 15,               // how far he will take a shot
  fireEvery: 34,           // frames between rounds, about half a second
  damage: 1,               // same as one of your bullets
  spread: 0.09,

  hurtEvery: 72,           // how often an alien stood on him can bite
  dieFrames: 55,
};

const _v = new THREE.Vector3();

export function initSoldier(group, at) {
  group.position.set(at.x, 0, at.z);
  group.rotation.y = at.rot || 0;
  group.rotation.x = 0;
  group.rotation.z = 0;
  // Tie him back up. freeSoldier hides these for good, so a second run found
  // him sat in the same place in the same pose with nothing holding him.
  for (const b of group.userData.bindings) b.visible = true;
  group.userData.ai = {
    state: 'tied',
    t: 0,
    hp: SOLDIER.hp,
    hpMax: SOLDIER.hp,
    fireT: 0,
    hurtT: 0,
    clock: 0,
    target: null,
  };
  poseTied(group, 0);
  return group;
}

/** Has he been cut loose? Everything downstream keys off this. */
export function soldierIsFree(group) {
  const ai = group.userData.ai;
  return ai && ai.state !== 'tied';
}

export function soldierIsDown(group) {
  const ai = group.userData.ai;
  return ai && (ai.state === 'dying' || ai.state === 'down');
}

export function soldierHealth(group) {
  const ai = group.userData.ai;
  return ai ? { hp: ai.hp, max: ai.hpMax } : null;
}

/** Cut him loose. Safe to call twice. */
export function releaseSoldier(group) {
  const ai = group.userData.ai;
  if (!ai || ai.state !== 'tied') return false;
  ai.state = 'rising';
  ai.t = 0;
  freeSoldier(group);
  return true;
}

export function hurtSoldier(group, amount) {
  const ai = group.userData.ai;
  if (!ai || ai.state === 'tied' || ai.state === 'dying' || ai.state === 'down') {
    return null;
  }
  ai.hp -= amount;
  if (ai.hp <= 0) {
    ai.hp = 0;
    ai.state = 'dying';
    ai.t = 0;
    return 'down';
  }
  return 'hit';
}

/**
 * One frame of him.
 *
 * `ctx` is everything out in the world he is allowed to know about:
 *   playerPos   where you are
 *   aliens      the live ones he could shoot, already filtered by the caller
 *   canSee(a,b) line of sight, because the walls are the level's business
 *
 * Returns a shot to fire, or null. The caller does the damage.
 */
export function updateSoldier(group, ctx, dtF) {
  const d = group.userData;
  const ai = d.ai;
  if (!ai) return null;
  ai.t += dtF;
  ai.clock += dtF / 60;

  // ── DOWN ──────────────────────────────────────────────────
  if (ai.state === 'dying') {
    const p = Math.min(1, ai.t / FX.dieFrames);
    poseDead(group, p * p);
    if (p >= 1) { ai.state = 'down'; ai.t = 0; }
    return null;
  }
  if (ai.state === 'down') return null;

  // ── TIED ──────────────────────────────────────────────────
  if (ai.state === 'tied') {
    poseTied(group, ai.clock);
    return null;
  }

  // ── RISING ────────────────────────────────────────────────
  // Nothing fancy: the tied pose eased into the standing one. He is not
  // shootable or shootING until he is up, which is what stops him firing
  // from the floor on the frame you free him.
  if (ai.state === 'rising') {
    const p = Math.min(1, ai.t / FX.riseFrames);
    poseTied(group, ai.clock);
    poseStand(group, ai.clock, 0);
    const e = p * p * (3 - 2 * p);
    d.hips.position.y = 0.42 + (0.92 - 0.42) * e;
    d.hips.rotation.x = -0.22 + 0.26 * e;
    d.legs.forEach((leg, i) => {
      leg.hip.rotation.x = (-1.5 + i * 0.12) * (1 - e);
      leg.knee.rotation.x = 1.9 * (1 - e);
      leg.hip.rotation.z = ((i ? 1 : -1) * 0.18) * (1 - e);
    });
    d.headPivot.rotation.x = 0.5 * (1 - e) - 0.02 * e;
    if (p >= 1) { ai.state = 'follow'; ai.t = 0; }
    return null;
  }

  // ── ON HIS FEET ───────────────────────────────────────────
  if (ai.fireT > 0) ai.fireT -= dtF;
  if (ai.hurtT > 0) ai.hurtT -= dtF;

  const me = group.position;
  const toPlayer = _v.set(ctx.playerPos.x - me.x, 0, ctx.playerPos.z - me.z);
  let playerDist = toPlayer.length();

  // Hopelessly far: he was left behind by something walking cannot undo.
  if (playerDist > FX.lost) {
    const behind = (ctx.playerYaw || 0) + Math.PI;
    me.x = ctx.playerPos.x + Math.sin(behind) * 1.6;
    me.z = ctx.playerPos.z + Math.cos(behind) * 1.6;
    toPlayer.set(ctx.playerPos.x - me.x, 0, ctx.playerPos.z - me.z);
    playerDist = toPlayer.length();
  }

  // Pick something to shoot: the nearest he can both reach and see.
  let target = null, best = Infinity;
  for (const a of ctx.aliens) {
    const ax = a.model.position.x, az = a.model.position.z;
    const dd = Math.hypot(ax - me.x, az - me.z);
    if (dd > FX.sight || dd >= best) continue;
    if (ctx.canSee && !ctx.canSee(me, a.model.position)) continue;
    best = dd;
    target = a;
  }
  ai.target = target;

  // Face what matters: the alien if there is one, otherwise you.
  const faceX = target ? target.model.position.x : ctx.playerPos.x;
  const faceZ = target ? target.model.position.z : ctx.playerPos.z;
  turnToward(group, faceX, faceZ, dtF);

  // Close the gap. He walks toward YOU even while shooting, unless he is
  // already close enough — a bodyguard who stops to duel every alien gets
  // left in another room.
  let walking = 0;
  if (playerDist > FX.followGap) {
    const step = Math.min(FX.speed * dtF, playerDist - FX.followGap);
    const nx = me.x + (toPlayer.x / playerDist) * step;
    const nz = me.z + (toPlayer.z / playerDist) * step;
    // The level decides whether he may stand there — unless he is ALREADY
    // standing in something, in which case refusing the move would pin him
    // there for the rest of the game. Exactly the trap the aliens were in.
    const stuck = ctx.blocked && ctx.blocked(me.x, me.z);
    if (stuck || !ctx.blocked || !ctx.blocked(nx, nz)) { me.x = nx; me.z = nz; }
    walking = Math.min(1, step / (FX.speed * Math.max(dtF, 0.001)));
  }

  poseStand(group, ai.clock, walking);

  if (target) {
    // Pitch the rifle toward it rather than firing flat — a Floater hovers.
    const rise = target.model.position.y - (me.y + SOLDIER.eyeY);
    poseAim(group, Math.max(-0.5, Math.min(0.5, rise / Math.max(1, best))));
    if (ai.fireT <= 0) {
      ai.fireT = FX.fireEvery;
      const from = new THREE.Vector3();
      d.muzzle.getWorldPosition(from);
      const to = target.model.position.clone();
      to.y += 0.4;
      to.x += (Math.random() - 0.5) * FX.spread * best * 0.3;
      to.z += (Math.random() - 0.5) * FX.spread * best * 0.3;
      return { type: 'shot', from, to, target, damage: FX.damage };
    }
  }
  return null;
}

/** Can something standing here bite him? Asked by the game, answered here so
 *  the cadence lives with the rest of his numbers. */
export function soldierCanBeBitten(group) {
  const ai = group.userData.ai;
  if (!ai || ai.state === 'tied' || ai.state === 'dying' || ai.state === 'down') {
    return false;
  }
  if (ai.hurtT > 0) return false;
  ai.hurtT = FX.hurtEvery;
  return true;
}

function turnToward(group, x, z, dtF) {
  const want = Math.atan2(x - group.position.x, z - group.position.z);
  let diff = want - group.rotation.y;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  group.rotation.y += diff * Math.min(1, FX.turn * dtF);
}
