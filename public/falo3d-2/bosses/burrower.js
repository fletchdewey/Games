// src/bosses/burrower.js
// BOSS: The Burrower — a giant worm that slithers at you, and goes under the
// floor when it has ground to cover.
//
// FLETCHER'S GUIDE:
// The body does NOT have a shape. It has a HEAD that moves, and every segment
// behind it sits on the trail the head has already taken — like a train on
// its own track. Steer the head and the whole body follows through the same
// curve a moment later, which is what makes a worm look like a worm.
//
// That one idea gives us everything:
//   SLITHERING    the head weaves side to side, so the body inherits an S
//                 that travels down its length. Nobody animates the S.
//   BURROWING     each segment has its own DEPTH. Push the head's depth down
//                 and let it travel backwards along the body, and the worm
//                 dives nose-first and is swallowed by the floor in order.
//   RE-EMERGING   the same thing played the other way.
//
// An earlier version baked a fixed arch into the geometry. It looked fine
// standing still and could never have done any of the above.
//
// Nothing here moves. The brain is in burrower_ai.js.

import * as THREE from 'three';
import { PALETTE } from '../shared/materials.js?v=cbc9eb3c8b';

export const SHAPE = {
  length: 11,        // nose to tail, in units
  thick: 0.62,       // body radius at the thickest point
  segments: 30,      // more of them keeps a long body smooth
  taper: 0.55,       // how much thinner the tail is than the middle
  mouth: 0.62,       // mouth radius as a fraction of body thickness
  outerTeeth: 20,
  innerTeeth: 13,
};

const COL = {
  skin: 0x3a2a2a,
  gullet: 0x4a1a1a,
  hole: 0x120d0d,
  spoil: 0x4a3c30,   // torn-up floor
  blood: 0x7ad426,   // it bleeds green
  pool: 0x4e8f18,    // and it leaves a lot of it on the floor
};

// Blood specks alive at once. A ring buffer — oldest gets reused. Big enough
// that the death, which bursts every segment of an 11-unit body at once, has
// room for the lot without eating its own spray.
export const BLOOD_MAX = 400;
export const BLOOD_PARKED = -999;

/** Flat pools left where the body came apart. */
export const POOL_MAX = 18;

// Chunks of thrown floor alive at once. A ring buffer, so this has to be
// bigger than one full in-or-out throws: a burst of 26 plus the trickle over
// a ~90 frame dive is around 70, and at 60 it was recycling chunks that were
// still in the air, blinking them out mid-flight.
export const DEBRIS_MAX = 120;

/** Body radius at `along` — 0 at the nose, 1 at the tail. */
export function radiusAt(along, S = SHAPE) {
  // Thickest at the head, tapering steadily to the tail. An earlier version
  // swelled toward the middle, which made the NOSE the thinnest part of the
  // worm — so the head came out smaller than the body behind it.
  return S.thick * (1 - S.taper * along);
}

export function createBurrower(opts = {}) {
  const S = { ...SHAPE, ...opts };
  const g = new THREE.Group();

  const skin = new THREE.MeshLambertMaterial({ color: COL.skin });
  const bone = new THREE.MeshLambertMaterial({ color: PALETTE.bone });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff2244 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: PALETTE.eyeRed });

  // ── The head ──────────────────────────────────────────────
  // Its own group, so the AI can drive it and have the mouth, teeth and eyes
  // come along. They used to be loose meshes pinned to a fixed point, which
  // only worked because the worm never went anywhere.
  const head = new THREE.Group();
  g.add(head);

  const headR = S.thick;        // the head is the thickest part of it
  const skull = new THREE.Mesh(new THREE.SphereGeometry(headR, 9, 7), skin);
  skull.scale.set(1, 1, 1.25);
  head.add(skull);
  // The skull and eyes get stripped when it dies — the mouth ring and its
  // teeth are the only part of it left on the floor.


  const MR = S.thick * S.mouth;
  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(MR, MR * 0.25, 6, 12),
    new THREE.MeshLambertMaterial({ color: COL.gullet }));
  mouth.position.z = headR * 0.95;
  head.add(mouth);

  // Two rings. One reads as a toothed rim; two at different depths read as a
  // throat with something down it.
  const teeth = [];
  for (const ring of [
    { count: S.outerTeeth, radius: MR * 0.92, z: headR * 1.1, r: 0.038, len: 0.26, lean: 0 },
    { count: S.innerTeeth, radius: MR * 0.55, z: headR * 0.92, r: 0.03, len: 0.2, lean: 0.5 },
  ]) {
    for (let i = 0; i < ring.count; i++) {
      const a = (i / ring.count) * Math.PI * 2
              + (ring.lean ? Math.PI / ring.count : 0);
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(ring.r, ring.len, 4), bone);
      tooth.position.set(Math.cos(a) * ring.radius, Math.sin(a) * ring.radius, ring.z);
      tooth.rotation.x = Math.PI * 0.5 + Math.sin(a) * ring.lean * 0.4;
      tooth.rotation.z = -Math.cos(a) * ring.lean * 0.4;
      head.add(tooth);
      teeth.push(tooth);
    }
  }

  const eyes = [];
  for (const ex of [0.17, -0.17]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), eyeMat);
    e.position.set(ex, headR * 0.55, headR * 0.4);
    head.add(e);
    eyes.push(e);
  }

  // ── The body ──────────────────────────────────────────────
  // `along` is how far behind the nose this segment rides, 0 to 1.
  const segments = [];
  for (let i = 1; i <= S.segments; i++) {
    const along = i / S.segments;
    const r = radiusAt(along, S);
    const sG = new THREE.SphereGeometry(r, 8, 6);
    sG.scale(1, 1, 1.25);
    const mesh = new THREE.Mesh(sG, skin);
    g.add(mesh);
    segments.push({ mesh, along, r, dist: along * S.length });
  }

  // Lit patches down the back, on a handful of segments.
  const glows = [];
  for (let i = 2; i < segments.length - 2; i += 4) {
    const seg = segments[i];
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 5, 4), glowMat);
    g.add(m);
    glows.push({ mesh: m, seg });
  }

  // ── The floor ─────────────────────────────────────────────
  // Spoil. Chunks of floor thrown clear when it punches through, and a bit
  // more spat out while its body grinds down the hole after it.
  //
  // One InstancedMesh, one draw call, and a plain array of chunk state the AI
  // steps. Dead chunks are parked at zero scale rather than removed, so the
  // count never changes and nothing is allocated mid-fight.
  const debrisGeo = new THREE.TetrahedronGeometry(0.13);
  const debris = new THREE.InstancedMesh(
    debrisGeo, new THREE.MeshLambertMaterial({ color: COL.spoil }), DEBRIS_MAX);
  debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  debris.frustumCulled = false;
  g.add(debris);

  const chunks = [];
  for (let i = 0; i < DEBRIS_MAX; i++) {
    chunks.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
                  rx: 0, rz: 0, spin: 0, life: 0, max: 1, size: 1 });
  }

  // Blood. One Points object holding every speck, so a whole fight's worth of
  // hits costs a single draw call, as a fixed ring buffer so a long fight
  // reuses the oldest rather than allocating. Spent specks are parked far
  // below the floor rather than deleted — cheaper than rebuilding the
  // attribute, and invisible either way. That is also why culling is off: the
  // parked ones blow the bounding sphere up.
  const bloodPos = new Float32Array(BLOOD_MAX * 3);
  for (let i = 0; i < BLOOD_MAX; i++) bloodPos[i * 3 + 1] = BLOOD_PARKED;
  const bloodGeo = new THREE.BufferGeometry();
  bloodGeo.setAttribute('position', new THREE.BufferAttribute(bloodPos, 3));
  const bloodPoints = new THREE.Points(bloodGeo, new THREE.PointsMaterial({
    color: COL.blood, size: 0.11, sizeAttenuation: true,
    transparent: true, opacity: 0.95, depthWrite: false,
  }));
  bloodPoints.frustumCulled = false;
  g.add(bloodPoints);
  const blood = { points: bloodPoints, pos: bloodPos,
                  vel: new Float32Array(BLOOD_MAX * 3),
                  life: new Float32Array(BLOOD_MAX), next: 0 };

  // Pools of it, dropped along the body when it comes apart. Flat discs on
  // the floor, each nudged to its own height so coplanar ones can't z-fight.
  const pools = [];
  for (let i = 0; i < POOL_MAX; i++) {
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(1, 14),
      new THREE.MeshBasicMaterial({ color: COL.pool,
                                    transparent: true, opacity: 0.92 }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.03 + i * 0.0015;
    pool.visible = false;
    g.add(pool);
    pools.push(pool);
  }

  // Holes get left where it dives and where it comes up. Two of them, reused
  // — it only ever has a most-recent entry and exit.
  const holes = [];
  for (let i = 0; i < 2; i++) {
    const hole = new THREE.Mesh(
      new THREE.CircleGeometry(1.15, 20),
      new THREE.MeshBasicMaterial({ color: COL.hole }));
    hole.rotation.x = -Math.PI / 2;
    hole.position.y = 0.02;
    hole.visible = false;
    g.add(hole);
    holes.push(hole);
  }

  g.traverse((o) => { if (o.isMesh) o.userData.hitPart = 'body'; });
  for (const e of eyes) e.userData.hitPart = 'eye';
  head.userData.hitPart = 'head';

  g.userData = { type: 'burrower', shape: S, head, segments, teeth, eyes,
                 glows, debris, chunks, next: 0, blood, pools, nextPool: 0,
                 skull, mouth, holes, headR };
  return g;
}
