// src/bosses/burrower_ai.js
// HOW THE BURROWER MOVES AND ATTACKS
//
// FLETCHER'S GUIDE:
// The fight is a loop with three beats:
//
//   SLITHERING   up close it comes at you over the floor, weaving. The whole
//                body is out and shootable, but it is SLOWER than you, so it
//                can never corner you in the open.
//   STALKING     once you have opened up some ground it dives, and underground
//                it is faster than you and completely invisible. It does not
//                swim at you — it swims to a spot BESIDE you, picking a new
//                angle every time, so the next one never comes from where the
//                last one did.
//   THE AMBUSH   the floor cracks and spits where it is about to come up. Then
//                it erupts and leaps, and lands on you.
//
// Everything rests on three ideas:
//
// 1. THE BODY FOLLOWS A TRAIL. Only the head is steered. Every frame its
//    position is pushed onto a trail, and each segment sits at a fixed
//    distance back along that trail. Weave the head and the body inherits an
//    S that travels down its length — nobody animates the S, it is just the
//    head's past.
//
// 2. THE TRAIL REMEMBERS HEIGHT, NOT JUST PLACE. Each trail point also carries
//    how deep under the floor the head was there, and how high above it. So the
//    body doesn't need to know about diving or leaping at all: it replays
//    whatever the head did, a moment later. That is the whole reason the leap
//    works — the body pours up out of the hole and arcs over after the head
//    without a line of code describing it.
//
// 3. IT DIGS ONE HOLE AND FEEDS ITSELF THROUGH IT. Diving isn't the worm
//    sinking; it's a hole punched at one spot that then stays there while the
//    worm keeps swimming forward. Anything nearer the head than the hole has
//    already gone through. So the dive needs no animation — just the distance
//    travelled since the hole was dug.
//
// Frames, like the other boss files: 60 to the second.

import * as THREE from 'three';
import { BLOOD_MAX, BLOOD_PARKED, POOL_MAX } from './burrower.js?v=6a024c4cb3';

export const FX = {
  // ── Getting about ──
  // The player walks at 5 u/s (0.083 per frame). On the surface it is slower
  // than you, which is what makes it go under: it cannot catch you in the
  // open, so it stops trying and comes the other way.
  surfaceSpeed: 0.055,      // 3.3 u/s
  burrowSpeed: 0.105,       // 6.3 u/s — faster than you, but it can't touch
                            // you down there
  turnRate: 0.035,          // how sharply it can steer

  // ── Weaving ──
  // The head's heading is wobbled, and the body inherits the result.
  weaveAmp: 0.55,           // radians of swing off its heading
  weaveRate: 1.5,           // how fast it weaves
  weaveUnder: 0.25,         // less of it underground, where it's committed

  // ── Choosing a mode ──
  diveBeyond: 9,            // further than this and it goes under
  minSurfaceFrames: 150,    // it won't dive again the instant it lands
  // ...but it won't slither forever either. The ambush is its ONLY attack, so
  // without this a player who simply stands still is never in any danger: it
  // closes to arm's length, never gets far enough away to want to dive, and
  // the two of you stare at each other. After this long on top it gives up on
  // the chase and goes under whatever the range is.
  maxSurfaceFrames: 330,
  minUnderFrames: 60,

  // ── Going under ──
  // Going in is just the worm moving: the hole stays put and the body feeds
  // through it, so it takes exactly as long as it takes to pull its own
  // length through one point.
  diveSpeed: 0.14,          // 8.4 u/s — it lunges into the ground
  bodyDepth: 2.2,           // how far under a submerged segment sits
  // One radius, so a surfaced segment rests ON the floor rather than half
  // sunk into it.
  surfaceLift: 1.0,
  holeLip: 1.6,             // how much body is mid-slide through the hole at
                            // any moment — the length of the rim
  undulate: 0.18,           // how high the surfaced body humps as it goes
  undulateRate: 2.2,

  // ── The ambush ──
  // It surfaces BESIDE you, not under you, so the leap is something you watch
  // coming rather than something that happens on top of you.
  ambushRadius: 3.6,        // how far off you it comes up
  ambushArrive: 1.0,        // close enough to that spot to call it arrived
  ambushTurn: 0.075,        // it steers harder underground, to make its mark
  stalkTimeout: 420,        // 7s, so it can never get stuck circling down there
  tellFrames: 30,           // half a second of floor cracking before it comes
                            // up. Underground it is invisible, so without this
                            // the leap would be unreadable and unfair.
  tellDebris: 0.9,          // chunks per frame during that warning

  // ── The leap ──
  burstUp: 0.2,             // launch, units/frame. ~47 frames of air, 2.3 up
  airGravity: 0.0085,
  burstOut: 12,             // frames to clear the hole on the way up
  lungeMin: 0.06,
  lungeMax: 0.2,            // 12 u/s flat out — it aims where you WERE, so
                            // running the moment the floor cracks gets you out
  lungeSteer: 0.03,         // only a mild correction mid-air
  slamRange: 2.4,
  slamDamage: 20,           // of 100. The hardest single hit in the game
  attackCooldown: 90,       // frames on the surface before it may dive again
  burstDebris: 44,          // the eruption throws up more than the dive does

  // ── Getting shot ──
  hp: 120,
  // It bolts the moment you hit it — but not instantly, or the first bullet
  // of every surfacing would send it away and you could never finish it. This
  // is how long it has to have been up before a hit drives it off, so you
  // always get a window to shoot. Set it to 0 for "one shot and it's gone".
  flinchAfter: 60,
  bloodCount: 11,           // specks thrown per hit
  bloodSpeed: 0.075,        // how hard they come out, units per frame
  bloodGravity: 0.0065,
  bloodLife: 75,            // frames before a speck disappears. At 40 the
                            // spray was gone before you could register it
  bloodSize: 0.11,          // this thing is shot from much further off than
                            // the other bosses, so the specks have to be
                            // bigger than theirs to read at all
  bloodLift: 1.1,           // upward kick. Higher and it fountains over the
                            // worm's own head instead of spraying off it

  // ── Coming apart ──
  // It doesn't fall over, it bursts. The body goes nose to tail in a quarter
  // of a second — fast enough to read as one explosion, staggered enough that
  // you can see it travel down the length of it.
  popEvery: 0.5,            // frames between one segment going and the next
  popBlood: 12,             // specks each one throws
  popSpeed: 0.13,           // harder than a bullet hit — this is it bursting
  poolEvery: 2,             // a pool dropped every N segments
  poolSize: 1.15,           // and how wide they get, at most
  remainsY: 0.05,           // how high the mouth sits once it's on the floor

  // ── Spoil ──
  // Floor it throws up going in and coming out.
  debrisBurst: 26,          // chunks thrown on the punch itself
  debrisTrickle: 0.5,       // chunks per frame while it's feeding through
  debrisPower: 0.15,        // upward kick, units/frame
  debrisSpread: 0.7,        // how much of that goes sideways instead
  debrisGravity: 0.006,
  debrisLife: 80,           // frames before a settled chunk fades out
};

const TRAIL_STEP = 0.1;     // how often a trail point is dropped, in units

export function initBurrower(group, at = { x: 0, z: -6 }) {
  const d = group.userData;
  const S = d.shape;

  d.heading = 0;
  d.headPos = new THREE.Vector3(at.x, 0, at.z);
  d.time = 0;

  // The head's own height state, which the trail records and the body replays.
  d.depth = 0;              // 0 = on the floor, 1 = fully under
  d.air = 0;                // units above the floor, for the leap
  d.airVel = 0;

  // Trail starts as a straight line stretching behind the head, so the body
  // has somewhere to be on frame one instead of collapsing onto the nose.
  d.trail = [];
  for (let i = 0; i < Math.ceil(S.length / TRAIL_STEP) + 40; i++) {
    d.trail.push({ x: at.x, z: at.z - i * TRAIL_STEP, depth: 0, air: 0 });
  }
  d.trailLag = 0;

  d.crossed = 0;            // ground covered since the hole was punched
  d.surfaceAt = 0;          // how much of it is under, for readouts
  d.mode = 'surface';       // surface | diving | under | tell | burst
  d.modeT = 0;
  d.ambushAngle = Math.random() * Math.PI * 2;
  d.ambush = new THREE.Vector3();
  d.lungeSpeed = 0;
  d.arena = null;
  d.hitThisLeap = false;
  d.wantsAttack = false;
  d.hp = FX.hp;
  d.defeated = false;
  d.dying = false;
  d.dieT = 0;
  d.popped = 0;
  d.isDead = false;
  // Put it back together, in case this is a respawn onto a corpse.
  d.skull.visible = true;
  for (const e of d.eyes) e.visible = true;
  d.head.rotation.set(0, 0, 0);
  for (const seg of d.segments) seg.mesh.visible = true;
  for (const pool of d.pools) pool.visible = false;
  d.nextPool = 0;
  d.attacks = [];           // notes the game turns into damage
  stepDebris(d, 0);         // park every chunk, or they all sit at the origin
  layout(group, 0);
}

// ── The trail ───────────────────────────────────────────────
//
// Points go down EXACTLY TRAIL_STEP apart, measured through the air as well as
// across the floor. The spacing has to be exact: an earlier version dropped one
// point per frame wherever the head had got to, so the gap was however far it
// moved that frame, while the lookup indexed the array as though every gap were
// 0.1. A segment the AI thought was 11 units back was really 13.6, and the body
// sank 2.5 units past the hole, through plain floor.
//
// Counting height into the spacing is what lets the body follow the leap. If
// only floor distance counted, a head going straight up would lay no trail at
// all and the neck would stretch away from the body.
function pushTrail(d) {
  const p = d.trail[0];
  let fx = p.x, fz = p.z, fd = p.depth, fa = p.air;
  let dx = d.headPos.x - fx, dz = d.headPos.z - fz, da = d.air - fa;
  let gap = Math.sqrt(dx * dx + dz * dz + da * da);
  let guard = 0;
  while (gap >= TRAIL_STEP && guard++ < 128) {
    const f = TRAIL_STEP / gap;
    fx += dx * f; fz += dz * f; fa += da * f;
    fd += (d.depth - fd) * f;
    d.trail.unshift({ x: fx, z: fz, depth: fd, air: fa });
    dx = d.headPos.x - fx; dz = d.headPos.z - fz; da = d.air - fa;
    gap = Math.sqrt(dx * dx + dz * dz + da * da);
  }
  d.trailLag = gap;        // the head is this far in front of trail[0]
  const keep = Math.ceil(d.shape.length / TRAIL_STEP) + 40;
  if (d.trail.length > keep) d.trail.length = keep;
}

/**
 * The point `dist` back from the HEAD along the trail, by true arc length.
 * Writes into `out` because two of these are live at once in layout().
 */
function trailAt(d, dist, out) {
  const back = dist - d.trailLag;       // distance back from trail[0]
  const p0 = d.trail[0];
  if (back <= 0) {                      // still between trail[0] and the head
    const f = d.trailLag > 1e-6 ? 1 - dist / d.trailLag : 0;
    out.x = p0.x + (d.headPos.x - p0.x) * f;
    out.z = p0.z + (d.headPos.z - p0.z) * f;
    out.depth = p0.depth + (d.depth - p0.depth) * f;
    out.air = p0.air + (d.air - p0.air) * f;
    return out;
  }
  const i = back / TRAIL_STEP;
  const a = Math.min(d.trail.length - 1, Math.floor(i));
  const b = Math.min(d.trail.length - 1, a + 1);
  const f = i - a;
  const pa = d.trail[a], pb = d.trail[b];
  out.x = pa.x + (pb.x - pa.x) * f;
  out.z = pa.z + (pb.z - pa.z) * f;
  out.depth = pa.depth + (pb.depth - pa.depth) * f;
  out.air = pa.air + (pb.air - pa.air) * f;
  return out;
}

const _at = { x: 0, z: 0, depth: 0, air: 0 };
const _ahead = { x: 0, z: 0, depth: 0, air: 0 };

// How deep the HEAD is, per mode. This is the only place depth is authored —
// the body just replays whatever got recorded on the trail.
//
// THE HOLE DOESN'T MOVE. It's punched where the head went in, and the head
// keeps going, so the hole is `crossed` units back along the body by now.
// Judging depth by position along the body instead made every part of it sink
// wherever it happened to be standing, nowhere near the hole it had dug.
function headDepth(d) {
  switch (d.mode) {
    case 'surface': return 0;
    case 'diving':  return Math.min(1, d.crossed / FX.holeLip);
    // Coming out it is being thrown, not swimming, so this one runs on time.
    case 'burst':   return Math.max(0, 1 - d.modeT / FX.burstOut);
    default:        return 1;         // under, tell
  }
}

function layout(group, dtF) {
  const d = group.userData;
  const t = d.time / 60;
  const hr = d.headR;

  d.head.position.set(d.headPos.x,
                      hr * FX.surfaceLift + d.air - d.depth * FX.bodyDepth,
                      d.headPos.z);
  d.head.rotation.y = d.heading;
  // Noses down as it goes in, and follows its own arc through the leap.
  d.head.rotation.x =
      d.mode === 'diving' ? -0.55 * (1 - d.depth)
    : d.mode === 'burst'  ? Math.max(-0.9, Math.min(0.9, d.airVel * 3.2))
    : 0;

  let under = 0;
  for (const seg of d.segments) {
    const p = trailAt(d, seg.dist, _at);
    // Only ever lifts. A ripple that swung both ways pushed the underside of
    // the body through the floor on every down-beat.
    const ripple = (Math.sin(t * FX.undulateRate - seg.along * 6) * 0.5 + 0.5)
                 * FX.undulate;
    seg.mesh.position.set(
      p.x,
      seg.r * FX.surfaceLift + p.air + ripple * (1 - p.depth)
        - p.depth * FX.bodyDepth,
      p.z);
    // Point each segment down the trail, so the body reads as one animal
    // rather than a string of beads.
    const ahead = trailAt(d, Math.max(0, seg.dist - 0.35), _ahead);
    seg.mesh.rotation.y = Math.atan2(ahead.x - p.x, ahead.z - p.z);
    seg.depth = p.depth;
    if (p.depth > 0.5) under++;
  }
  d.surfaceAt = under / d.segments.length;

  for (const gl of d.glows) {
    const s = gl.seg;
    gl.mesh.position.set(s.mesh.position.x,
                         s.mesh.position.y + s.r * 0.75,
                         s.mesh.position.z);
    gl.mesh.visible = s.depth < 0.4;
  }
}

export function updateBurrower(group, playerPos, dtF) {
  const d = group.userData;
  if (d.dying && !d.isDead) { stepDeath(group, dtF); return; }
  // Blood and spoil still settle after it's down — they shouldn't freeze in
  // mid-air the instant the fight ends.
  if (d.isDead) { stepBlood(d, dtF); stepDebris(d, dtF); return; }

  d.time += dtF;
  d.modeT += dtF;

  const toX = playerPos.x - d.headPos.x, toZ = playerPos.z - d.headPos.z;
  const dist = Math.hypot(toX, toZ);

  // ── Where it is trying to get to ──────────────────────────
  // Underground it heads for a spot BESIDE you, not for you. That offset is
  // the whole attack: it decides which side the leap comes from.
  let aimX = toX, aimZ = toZ;
  if (d.mode === 'under') {
    d.ambush.set(playerPos.x + Math.sin(d.ambushAngle) * FX.ambushRadius, 0,
                 playerPos.z + Math.cos(d.ambushAngle) * FX.ambushRadius);
    const inside = pen(d, d.ambush.x, d.ambush.z);
    if (inside) d.ambush.set(inside.x, 0, inside.z);
    aimX = d.ambush.x - d.headPos.x;
    aimZ = d.ambush.z - d.headPos.z;
  }

  // ── Which way to point ────────────────────────────────────
  let want = Math.atan2(aimX, aimZ);
  if (d.mode !== 'burst' && d.mode !== 'tell') {
    // Weave. Underground it commits more, since it's lining up where to come
    // out rather than trying to be hard to shoot.
    want += Math.sin(d.time / 60 * FX.weaveRate)
          * (d.mode === 'under' ? FX.weaveUnder : FX.weaveAmp);
  }
  let turn = want - d.heading;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  const rate = d.mode === 'under' ? FX.ambushTurn
             : d.mode === 'burst' ? FX.lungeSteer : FX.turnRate;
  d.heading += turn * Math.min(1, rate * dtF);

  // ── Moving ────────────────────────────────────────────────
  const speed = d.mode === 'under'   ? FX.burrowSpeed
              : d.mode === 'surface' ? FX.surfaceSpeed
              : d.mode === 'diving'  ? FX.diveSpeed
              : d.mode === 'burst'   ? d.lungeSpeed
              : 0;                                   // 'tell' holds still
  const step = speed * dtF;
  d.headPos.x += Math.sin(d.heading) * step;
  d.headPos.z += Math.cos(d.heading) * step;
  const held = pen(d, d.headPos.x, d.headPos.z);
  if (held) { d.headPos.x = held.x; d.headPos.z = held.z; }
  if (d.mode === 'diving') d.crossed += step;

  // ── The loop ──────────────────────────────────────────────
  if (d.mode === 'surface') {
    const giveUp = d.modeT > FX.maxSurfaceFrames;
    if ((dist > FX.diveBeyond || giveUp) && d.modeT > FX.minSurfaceFrames) {
      beginDive(d);
    }

  } else if (d.mode === 'diving') {
    // Done going in once the tail has been through the hole too.
    if (d.crossed >= d.shape.length + FX.holeLip) {
      d.mode = 'under'; d.modeT = 0;
      // A new side every time: at least a quarter turn off the last one, so
      // it never comes up twice running from the same place.
      d.ambushAngle += Math.PI * 0.5 + Math.random() * Math.PI;
    }

  } else if (d.mode === 'under') {
    const atSpot = Math.hypot(d.ambush.x - d.headPos.x,
                              d.ambush.z - d.headPos.z);
    if (d.wantsAttack
        || (atSpot < FX.ambushArrive && d.modeT > FX.minUnderFrames)
        || d.modeT > FX.stalkTimeout) {
      d.wantsAttack = false;
      d.mode = 'tell'; d.modeT = 0;
      markHole(d, 1, 0);               // it's coming up right here
    }

  } else if (d.mode === 'tell') {
    if (d.modeT >= FX.tellFrames) {
      d.mode = 'burst'; d.modeT = 0;
      d.air = 0;
      d.airVel = FX.burstUp;
      d.hitThisLeap = false;
      // Aim the jump to land where you are NOW. Flat out it is faster than
      // you, but it is committing to a spot — move and it comes down behind.
      const airtime = 2 * FX.burstUp / FX.airGravity;
      d.lungeSpeed = Math.max(FX.lungeMin,
                              Math.min(FX.lungeMax, dist / airtime));
      const h = d.holes[1].position;
      burstDebris(d, h.x, h.z, FX.burstDebris);
    }

  } else if (d.mode === 'burst') {
    d.air += d.airVel * dtF;
    d.airVel -= FX.airGravity * dtF;
    // It lands on you if you're under it as it comes down.
    if (!d.hitThisLeap && d.airVel < 0 && d.air < 1.6 && dist <= FX.slamRange) {
      d.hitThisLeap = true;
      d.attacks.push({ type: 'burrower_slam', damage: FX.slamDamage,
                       at: d.headPos.clone().setY(0), range: FX.slamRange });
    }
    if (d.air <= 0 && d.modeT > 4) {   // down
      d.air = 0; d.airVel = 0;
      d.mode = 'surface';
      d.modeT = FX.minSurfaceFrames - FX.attackCooldown;  // brief breather
      burstDebris(d, d.headPos.x, d.headPos.z, FX.debrisBurst);
    }
  }

  d.depth = headDepth(d);
  pushTrail(d);

  // ── Spoil ─────────────────────────────────────────────────
  // While it's feeding down the hole, and while the floor is breaking up.
  let trickle = 0, hx = 0, hz = 0;
  if (d.mode === 'diving') {
    trickle = FX.debrisTrickle;
    hx = d.holes[0].position.x; hz = d.holes[0].position.z;
  } else if (d.mode === 'tell') {
    trickle = FX.tellDebris;
    hx = d.holes[1].position.x; hz = d.holes[1].position.z;
  }
  for (let n = trickle * dtF; n > 0; n -= 1) {
    if (n >= 1 || Math.random() < n) burstDebris(d, hx, hz, 1);
  }
  stepDebris(d, dtF);
  stepBlood(d, dtF);

  layout(group, dtF);
}

// Going under, from wherever it is. Both the ordinary dive and bolting after
// a hit come through here, so they can't drift apart.
function beginDive(d) {
  d.mode = 'diving';
  d.modeT = 0;
  d.crossed = 0;
  markHole(d, 0, FX.holeLip * 0.5);     // it goes in HERE, and nowhere else
  const h = d.holes[0].position;
  burstDebris(d, h.x, h.z, FX.debrisBurst);
}

/**
 * Pen it inside the room it is fought in. Unlike the others it doesn't home
 * on the player — it deliberately overshoots, to a spot beside you and then
 * past you through the leap — so without a leash it walks out through a wall.
 *
 * The pen is a RECTANGLE, matching the room. A circle inside a 32x24 room
 * only reaches 10.5 units from the middle while the player can stand 20 away
 * in a corner, so the worm sat pinned against an invisible edge, looking
 * slow and unable to land a thing.
 */
export function setBurrowerArena(group, x0, z0, x1, z1, margin = 1.5) {
  const m = margin;
  group.userData.arena = {
    x0: Math.min(x0, x1) + m, x1: Math.max(x0, x1) - m,
    z0: Math.min(z0, z1) + m, z1: Math.max(z0, z1) - m,
  };
}

/** Pull a point back inside the arena. Returns null if it was already in. */
function pen(d, x, z) {
  const a = d.arena;
  if (!a) return null;
  const cx = Math.min(a.x1, Math.max(a.x0, x));
  const cz = Math.min(a.z1, Math.max(a.z0, z));
  if (cx === x && cz === z) return null;
  return { x: cx, z: cz };
}

/**
 * Make it attack NOW, without waiting for the fight to come round to it.
 * Mostly for the workshop — the game doesn't need to force anything.
 *
 * It can't leap from the surface, so from up there this sends it down first
 * and the attack fires the moment it's under. Returns what it did.
 */
export function forceBurrowerAttack(group) {
  const d = group.userData;
  if (d.isDead) return 'down';
  if (d.mode === 'tell' || d.mode === 'burst') return 'already attacking';
  if (d.mode === 'under') {
    d.wantsAttack = false;
    d.mode = 'tell';
    d.modeT = 0;
    markHole(d, 1, 0);
    return 'coming up';
  }
  d.wantsAttack = true;               // fires as soon as it gets under
  if (d.mode === 'surface') { beginDive(d); return 'diving first'; }
  return 'diving first';
}

// ── Getting shot ────────────────────────────────────────────
//
// Returns 'hit', 'dead', or null if it wasn't hittable. `at` is the impact
// point the caller raycast for; without one the blood comes off the head,
// which is still better than nothing coming out.
export function damageBurrower(group, amount, part, at) {
  const d = group.userData;
  if (d.isDead || d.dying) return null;
  // Nothing to shoot while it is all the way under. This lives here rather
  // than in the caller so there is one rule about when it can be hurt, and
  // raycasting onto buried geometry can't quietly bypass it.
  if (!burrowerExposed(group)) return null;

  const p = at || d.head.position;
  spatter(d, p.x, p.y, p.z);

  d.hp -= amount;
  if (d.hp <= 0) {
    d.hp = 0;
    d.defeated = true;
    d.dying = true;
    d.dieT = 0;
    d.popped = 0;
    return 'dead';
  }

  // And then it bolts. Only off the surface: shot at the top of its leap it
  // sees the leap through rather than folding mid-air.
  if (d.mode === 'surface' && d.modeT > FX.flinchAfter) beginDive(d);
  return 'hit';
}

// ── Coming apart ────────────────────────────────────────────
//
// It bursts rather than falling over. Each segment in turn throws its blood,
// vanishes, and sometimes leaves a pool where it stood — so the explosion
// travels down the body instead of happening everywhere at once. What's left
// at the end is the mouth, lying in the mess on the floor.
function stepDeath(group, dtF) {
  const d = group.userData;
  d.dieT += dtF;

  const want = Math.min(d.segments.length, Math.floor(d.dieT / FX.popEvery) + 1);
  while (d.popped < want) {
    const seg = d.segments[d.popped];
    d.popped++;
    const p = seg.mesh.position;
    // Only the parts of it that were above ground make a mess you can see.
    if (seg.depth < 0.6) {
      spatter(d, p.x, p.y, p.z, FX.popBlood, FX.popSpeed);
      if (d.popped % FX.poolEvery === 0) dropPool(d, p.x, p.z, seg.r);
    }
    seg.mesh.visible = false;
  }

  if (d.popped >= d.segments.length && !d.isDead) {
    // Strip the head down to the mouth and lay it flat where the head was.
    // The ring of teeth ends up pointing out of the floor.
    d.skull.visible = false;
    for (const e of d.eyes) e.visible = false;
    for (const gl of d.glows) gl.mesh.visible = false;
    spatter(d, d.head.position.x, Math.max(0.2, d.head.position.y),
            d.head.position.z, FX.popBlood * 2, FX.popSpeed);
    dropPool(d, d.headPos.x, d.headPos.z, d.headR * 1.6);
    d.head.rotation.set(-Math.PI / 2, 0, 0);
    d.head.position.set(d.headPos.x,
                        // so the mouth ring itself lands at remainsY
                        FX.remainsY - d.mouth.position.z,
                        d.headPos.z);
    d.isDead = true;
  }

  stepBlood(d, dtF);
  stepDebris(d, dtF);
}

function dropPool(d, x, z, r) {
  const pool = d.pools[d.nextPool];
  d.nextPool = (d.nextPool + 1) % POOL_MAX;
  pool.position.x = x + (Math.random() - 0.5) * 0.6;
  pool.position.z = z + (Math.random() - 0.5) * 0.6;
  const w = FX.poolSize * (0.45 + Math.random() * 0.75) * (r / 0.5);
  pool.scale.set(w, w * (0.75 + Math.random() * 0.5), 1);
  pool.rotation.z = Math.random() * Math.PI;   // in its own plane, so they
  pool.visible = true;                         // aren't all the same oval
}

function spatter(d, x, y, z, count, speed) {
  const b = d.blood;
  const n0 = count === undefined ? FX.bloodCount : count;
  const sp0 = speed === undefined ? FX.bloodSpeed : speed;
  for (let n = 0; n < n0; n++) {
    const i = b.next;
    b.next = (b.next + 1) % BLOOD_MAX;
    const a = Math.random() * Math.PI * 2;
    const sp = sp0 * (0.45 + Math.random() * 0.9);
    b.pos[i * 3] = x; b.pos[i * 3 + 1] = y; b.pos[i * 3 + 2] = z;
    b.vel[i * 3] = Math.cos(a) * sp;
    b.vel[i * 3 + 1] = sp * (0.4 + Math.random() * FX.bloodLift);
    b.vel[i * 3 + 2] = Math.sin(a) * sp;
    b.life[i] = FX.bloodLife;
  }
}

function stepBlood(d, dtF) {
  const b = d.blood;
  let live = false;
  for (let i = 0; i < BLOOD_MAX; i++) {
    if (b.life[i] <= 0) continue;
    live = true;
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
  if (live) b.points.geometry.attributes.position.needsUpdate = true;
  b.points.material.size = FX.bloodSize;   // so the slider does something
}

// ── Spoil ───────────────────────────────────────────────────
const _m = new THREE.Object3D();

/** Throw `n` chunks of floor up out of (x, z). */
export function burstDebris(d, x, z, n) {
  for (let i = 0; i < n; i++) {
    const c = d.chunks[d.next];
    d.next = (d.next + 1) % d.chunks.length;
    const a = Math.random() * Math.PI * 2;
    const out = FX.debrisPower * FX.debrisSpread * (0.3 + Math.random());
    c.x = x + Math.sin(a) * 0.5 * Math.random();
    c.y = 0.1;
    c.z = z + Math.cos(a) * 0.5 * Math.random();
    c.vx = Math.sin(a) * out;
    c.vz = Math.cos(a) * out;
    c.vy = FX.debrisPower * (0.5 + Math.random() * 0.8);
    c.rx = Math.random() * Math.PI;
    c.rz = Math.random() * Math.PI;
    c.spin = (Math.random() - 0.5) * 0.5;
    c.size = 0.5 + Math.random() * 0.9;
    c.max = FX.debrisLife * (0.6 + Math.random() * 0.6);
    c.life = c.max;
  }
}

function stepDebris(d, dtF) {
  let live = false;
  for (let i = 0; i < d.chunks.length; i++) {
    const c = d.chunks[i];
    if (c.life <= 0) { _m.scale.set(0, 0, 0); _m.updateMatrix();
                       d.debris.setMatrixAt(i, _m.matrix); continue; }
    live = true;
    c.life -= dtF;
    c.vy -= FX.debrisGravity * dtF;
    c.x += c.vx * dtF; c.y += c.vy * dtF; c.z += c.vz * dtF;
    if (c.y <= 0.04) {              // lands, and stays as spoil for a moment
      c.y = 0.04;
      c.vy = Math.abs(c.vy) > 0.04 ? -c.vy * 0.3 : 0;
      c.vx *= 0.4; c.vz *= 0.4; c.spin *= 0.4;
    }
    c.rx += c.spin * dtF; c.rz += c.spin * 0.7 * dtF;
    // Shrink away over the last third of its life rather than blinking out.
    const fade = Math.min(1, c.life / (c.max * 0.33));
    _m.position.set(c.x, c.y, c.z);
    _m.rotation.set(c.rx, 0, c.rz);
    _m.scale.setScalar(c.size * fade);
    _m.updateMatrix();
    d.debris.setMatrixAt(i, _m.matrix);
  }
  d.debris.instanceMatrix.needsUpdate = true;
  d.debris.visible = live;
}

// `lead` puts the hole ahead of the nose, which is what a moving dive needs:
// the nose is half-way down by the time it gets there, so it slides in rather
// than popping below the floor the instant it starts. Coming up it is 0 — the
// worm is stationary and the hole opens right under it.
function markHole(d, which, lead) {
  const h = d.holes[which];
  h.position.set(d.headPos.x + Math.sin(d.heading) * lead, 0.02,
                 d.headPos.z + Math.cos(d.heading) * lead);
  h.visible = true;
}

/** True while any part of it is up and can be shot. */
export const burrowerExposed = (group) => group.userData.surfaceAt < 0.98;
