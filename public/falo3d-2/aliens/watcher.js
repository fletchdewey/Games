// src/aliens/watcher.js
// The Watcher — an armoured eye on a tripod. It doesn't chase you. It stands
// where it was put, sweeps the room, and when it finds you it opens its
// shutters, spins up, and holds a beam on you.
//
// FLETCHER'S GUIDE:
// This file does THREE things, same as every other alien:
//   1. buildWatcher()   — the model (from the Alien Workshop, not from here)
//   2. animateWatcher() — the idle sweep, the leg sway, the hover
//   3. the AI brain     — scan, open, charge, fire, seal
//
// It is the odd one out of the four, and deliberately so. The Crawler, the
// Floater and the Brute all come at you. The Watcher is a TURRET: it is the
// one that punishes standing still in the open, which is exactly the thing
// the other three teach you to do. 15 damage a shot and 1 HP of its own — it
// hurts badly and dies to a single bullet. A glass cannon.
//
// It also means the Watcher needs no pathfinding at all. It never moves. The
// whole brain below is a stopwatch and a line of sight.
//
// THE FIRING CYCLE, which is the whole alien:
//
//   SCAN  ─(sees you)─► TRACK ─(aimed)─► OPEN ─► CHARGE ─► FIRE ─► SEAL ─┐
//     ▲                                            │                     │
//     └────────────────────────────────────────────┴─────────────────────┘
//                                     (you break line of sight, or it's done)
//
// The telegraph is the point. Shutters opening and the iris spinning up give
// you most of two seconds to get behind something. A Watcher that just fired
// would be a sniper you can't play against.
//
// And "get behind something" has to actually work, so unlike the Floater —
// whose blast is a slow ball you can watch coming and sidestep — the Watcher
// is checked against the walls. Its beam is instant and costs 15, so without
// that it would shoot you through the floor plan from the next room.

import * as THREE from 'three';
import { buildWatcher as buildWatcherModel, W } from './workshop_models.js?v=8f6b3dc7e5';
import { rememberColor } from './model_colors.js?v=8f6b3dc7e5';

// Everything above is in SECONDS, not frames, because that is the unit the
// workshop's own numbers are written in and converting them twice is how the
// timings would quietly drift away from the model you tuned.
export const WATCHER = {
  ...W,
  sightRange: W.beamRange,   // 12 — if it can see that far it can shoot that far
  trackTime: 0.45,           // swinging round to face you before it commits
  damage: 15,
  deathFall: 1.1,            // seconds of toppling over
};

const STATE = {
  SCAN:  'scan',
  TRACK: 'track',
  OPEN:  'open',
  CHARGE:'charge',
  FIRE:  'fire',
  SEAL:  'seal',
  DEAD:  'dead',
};

// ─── 1. GEOMETRY ────────────────────────────────────────────────
// Straight from the workshop. Nothing is built here.

export function buildWatcher() {
  const g = buildWatcherModel();
  rememberColor(g.userData.lens.material);
  g.userData.type = 'watcher';
  return g;
}


// ─── 2. ANIMATION ───────────────────────────────────────────────
//
// Only the idle half of the workshop's loop lives here: the legs shifting
// their weight, the hover, and the eye wandering. The firing half is the
// AI's job, because out here it has to happen when it sees YOU rather than
// on a timer.

/** Legs and hover. Runs in every state — a Watcher mid-shot is still stood up. */
function stance(d, model, time, baseY) {
  d.legs.forEach((leg, i) => {
    const c = Math.sin(time * 1.8 + (i / 3) * Math.PI * 2);
    leg.upper.rotation.x = c * 0.1;
    leg.lower.rotation.x = 0.1 - Math.abs(c) * 0.06;
  });
  model.position.y = baseY + Math.sin(time * 1.1) * 0.03;
}

export function animateWatcher(model, time) {
  const d = model.userData;
  if (!d.legs) return;
  stance(d, model, time, model.userData.baseY || 0);

  // Idle sweep — looking for you, not at you.
  d.eyePivot.rotation.y = Math.sin(time * 0.9) * WATCHER.scanSweep;
  d.eyePivot.rotation.x = Math.sin(time * 0.6) * WATCHER.scanSweep * 0.27;

  shutters(d, 0);
  iris(d, time, 0);
  beamOff(d);
}

/** `open` 0 = sealed shut, 1 = wide open. */
function shutters(d, open) {
  const delta = WATCHER.shutClosed + open * WATCHER.shutterOpen;
  d.shutters.forEach((sh) => { sh.rotation.x = Math.PI / 2 - delta; });
}

/** `charge` 0 = cold and idling, 1 = white hot and about to let go. */
function iris(d, time, charge) {
  const heat = charge * (0.7 + Math.sin(time * 18) * 0.3);
  d.lens.scale.set(1 + heat * 0.3, 1 + heat * 0.3, 0.45);
  d.irisOuter.rotation.z = time * (1 + charge * WATCHER.spinRate);
  d.irisInner.rotation.z = -time * (1.4 + charge * WATCHER.spinRate * 1.3);
  d.irisInner.scale.setScalar(1 - charge * 0.3);
  d.vents.forEach((v, i) =>
    v.scale.setScalar(1 + charge * 1.6 + Math.sin(time * 6 + i) * 0.15));
}

function beamOff(d) {
  d.beam.visible = d.flare.visible = d.impact.visible = false;
  // Hiding it is not enough on its own: Box3 counts invisible meshes, so a
  // stretched-but-hidden 12-unit beam drags the model's bounds out across the
  // room long after the shot ended — and the game measures models.
  d.beam.scale.set(1, 0.001, 1);
  d.impact.position.z = 0;
}

/** Beam drawn out to `dist` rather than to a fixed length, so the bright dot
 *  at the end lands ON you instead of hanging in the air short or long. */
function beamOn(d, time, dist) {
  const reach = Math.max(0.5, dist - WATCHER.eyeRadius * 0.8);
  const j = 1 + Math.sin(time * 50) * 0.06;
  d.beam.visible = d.flare.visible = d.impact.visible = true;
  d.beam.scale.set(j, reach, j);
  d.flare.scale.setScalar(0.9 + Math.sin(time * 45) * 0.25);
  d.impact.position.z = WATCHER.eyeRadius * 0.8 + reach;
  d.impact.scale.setScalar(1.1 + Math.sin(time * 38) * 0.35);
}


// ─── 3. AI ──────────────────────────────────────────────────────

export function createWatcherAI() {
  return {
    state: STATE.SCAN,
    stateTimer: 0,     // SECONDS in the current state
    clock: 0,          // its own running time, for the spin and shimmer
    fired: false,      // has this shot already landed? one hit per beam
  };
}

/**
 * Returns `{ type: 'eye_beam' }` on the single frame its beam connects.
 * The game registry marks the Watcher attackViaAI, so that return value is
 * the ONLY way it damages you — there is no proximity timer behind it, and
 * standing next to one does nothing until it actually shoots.
 */
export function updateWatcherAI(model, ai, playerPos, dt) {
  const d = model.userData;
  const baseY = model.userData.baseY || 0;
  ai.stateTimer += dt;
  ai.clock += dt;

  if (ai.state === STATE.DEAD) {
    const t = Math.min(ai.stateTimer / WATCHER.deathFall, 1);
    // Knees go first, then it goes over sideways. The eye is already out.
    d.legs.forEach((leg) => {
      leg.upper.rotation.x = t * 0.9;
      leg.lower.rotation.x = -t * 1.3;
    });
    model.position.y = baseY - t * 0.55;
    model.rotation.z = t * t * (Math.PI * 0.4);
    shutters(d, 0);
    beamOff(d);
    // The eye goes out, so a corpse can't sit there looking like it's still
    // watching you. Restored on respawn, which rebuilds the model outright.
    d.lens.material.color.setHex(0x16343a);
    return null;
  }

  const to = new THREE.Vector3().subVectors(playerPos, model.position);
  const dist = to.length();
  // Close enough AND actually visible. `hasSight` is set by the game each
  // frame, because the level's walls live out there and not in here. It is
  // only ever false when something is in the way, so an undefined value — a
  // Watcher in a test harness with no level around it — counts as visible.
  const inRange = dist < WATCHER.sightRange && d.hasSight !== false;

  stance(d, model, ai.clock, baseY);

  // --- SCAN: standing watch ---
  if (ai.state === STATE.SCAN) {
    d.eyePivot.rotation.y = Math.sin(ai.clock * 0.9) * WATCHER.scanSweep;
    d.eyePivot.rotation.x = Math.sin(ai.clock * 0.6) * WATCHER.scanSweep * 0.27;
    shutters(d, 0);
    iris(d, ai.clock, 0);
    beamOff(d);
    if (inRange) { ai.state = STATE.TRACK; ai.stateTimer = 0; }
    return null;
  }

  // Everything from here on is aimed at you. The body turns to face you and
  // the eye handles the up-and-down, which is the same split the Floater and
  // the Spire use — turning the whole tripod to look at your feet would swing
  // the legs through the floor.
  aim(model, d, to, Math.min(1, ai.stateTimer / WATCHER.trackTime));

  // Lose sight of it at any point before the shot and it stands down.
  if (!inRange && ai.state !== STATE.FIRE && ai.state !== STATE.SEAL) {
    ai.state = STATE.SEAL; ai.stateTimer = 0;
  }

  if (ai.state === STATE.TRACK) {
    shutters(d, 0);
    iris(d, ai.clock, 0);
    if (ai.stateTimer >= WATCHER.trackTime) { ai.state = STATE.OPEN; ai.stateTimer = 0; }
    return null;
  }

  if (ai.state === STATE.OPEN) {
    const t = Math.min(ai.stateTimer / WATCHER.openTime, 1);
    shutters(d, t);
    iris(d, ai.clock, 0);
    if (t >= 1) { ai.state = STATE.CHARGE; ai.stateTimer = 0; }
    return null;
  }

  if (ai.state === STATE.CHARGE) {
    const t = Math.min(ai.stateTimer / WATCHER.chargeTime, 1);
    shutters(d, 1);
    iris(d, ai.clock, t);
    if (t >= 1) { ai.state = STATE.FIRE; ai.stateTimer = 0; ai.fired = false; }
    return null;
  }

  if (ai.state === STATE.FIRE) {
    shutters(d, 1);
    iris(d, ai.clock, 1);
    beamOn(d, ai.clock, dist);
    if (ai.stateTimer >= WATCHER.fireTime) { ai.state = STATE.SEAL; ai.stateTimer = 0; }
    // One hit per beam, on the frame it lights up, and only if you are still
    // standing in it. Damage on every frame of a 0.45s beam would be 27 hits.
    if (!ai.fired) {
      ai.fired = true;
      if (inRange) return { type: 'eye_beam' };
    }
    return null;
  }

  if (ai.state === STATE.SEAL) {
    const t = Math.min(ai.stateTimer / WATCHER.sealTime, 1);
    shutters(d, 1 - t);
    iris(d, ai.clock, 0);
    beamOff(d);
    if (t >= 1) { ai.state = STATE.SCAN; ai.stateTimer = 0; }
    return null;
  }

  return null;
}

/** Turn the body toward the player and pitch the eye at their chest.
 *  `blend` eases the swing in so it doesn't snap round the instant you appear. */
function aim(model, d, to, blend) {
  const want = Math.atan2(to.x, to.z);
  model.rotation.y += shortestTurn(model.rotation.y, want) * Math.min(1, blend * 0.5 + 0.08);

  // Pitch is measured from the EYE, not from the model's origin — the eye is
  // most of two units up the tripod, so aiming from the feet points the beam
  // over your head at anything close.
  const flat = Math.max(0.5, Math.hypot(to.x, to.z));
  const rise = to.y - CHEST_DROP - EYE_HEIGHT;
  // Positive rotation.x tips the eye's +z (where the beam goes) DOWNWARD, so
  // looking up is negative. Eased rather than snapped, or it twitches.
  const pitch = -Math.atan2(rise, flat);
  d.eyePivot.rotation.y *= 0.8;
  d.eyePivot.rotation.x += (pitch - d.eyePivot.rotation.x) * 0.25;
}

// Where the eye sits above the model's origin, and how far below the player's
// camera their chest is — the beam should hit a body, not a hat. Exported
// because game.js casts the line-of-sight ray from the same two points, and
// a sight line that starts somewhere other than the muzzle is worthless.
export const EYE_HEIGHT = W.hubHeight - 0.28;
export const CHEST_DROP = 0.4;

/** Turning right round the short way instead of unwinding the long way. */
function shortestTurn(from, to) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/**
 * Put the beam away.
 *
 * Called when the world stops — the title screen, or the death screen. The
 * beam is drawn by the AI, so freezing the AI mid-shot doesn't end the shot,
 * it just stops anyone updating it: a beam that was in flight when you died
 * stays lit and pointed at you for as long as the menu is up, which reads as
 * being shot while you decide whether to play again.
 */
export function restWatcher(model) {
  const d = model.userData;
  if (d.beam) beamOff(d);
}

/** 1 HP. Anything that hits it, kills it — that is the whole trade. */
export function hitWatcher(ai) {
  if (ai.state === STATE.DEAD) return;
  ai.state = STATE.DEAD;
  ai.stateTimer = 0;
}

export function killWatcher(ai) {
  ai.state = STATE.DEAD;
  ai.stateTimer = 0;
}
