// src/bosses/burrower.js
// BOSS: The Burrower — a giant worm that comes up through the floor.
//
// FLETCHER'S GUIDE:
// The body is a CURVE, not a fixed shape. Every segment's position comes from
// one function of t (0 at the tail, 1 at the head), so the whole worm can be
// re-shaped by changing numbers rather than by rebuilding it. That matters
// for what comes next: burrowing and re-emerging means the curve has to move,
// and a shape baked into the geometry could never do that.
//
// The curve is not a plain arch. A sine arch puts BOTH ends in the floor,
// which means the worm has no leading end and its mouth can only sit somewhere
// along its middle. So the far end rears back up and levels off: tail into the
// ground, body over the top, head lifted clear and pointing forward.
//
// Nothing here animates. That lives in burrower_ai.js when it exists.

import * as THREE from 'three';
import { PALETTE } from '../shared/materials.js?v=3a46e74894';

// Everything about the worm's shape. Exported so a workshop can drive it.
export const SHAPE = {
  span: 11,         // tail hole to head, in units
  rise: 3.2,        // how high the arch gets. The station ceiling is 4, so
                    // the peak is held under 3 — walk under it, don't clip
                    // through the roof.
  thick: 0.62,      // body radius at the thickest point
  segments: 30,     // more of them keeps a long body smooth
  headLift: 0.55,   // how much the head end rears back up out of the arch
  liftStart: 0.72,  // how far along the body before it starts rearing
  taperEnd: 0.82,   // past here the body stops thinning — the head end is
                    // the end you look at, so it mustn't come to a point
  mouth: 0.62,      // mouth radius, as a fraction of body thickness
  outerTeeth: 20,
  innerTeeth: 13,
};

const COL = {
  skin: 0x3a2a2a,
  gullet: 0x4a1a1a,
  floor: 0x1a1a1a,
};

/** Height of the body at t, 0 (tail) to 1 (head). */
export function bodyY(t, S = SHAPE) {
  const arch = Math.sin(t * Math.PI) * S.rise - 0.3;
  const lift = Math.max(0, (t - S.liftStart) / (1 - S.liftStart));
  return arch + lift * lift * S.rise * S.headLift;
}

/** Body radius at t. */
export function bodyR(t, S = SHAPE) {
  return S.thick * (0.35 + 0.65 * Math.sin(Math.min(t, S.taperEnd) * Math.PI));
}

/** Distance along the worm's axis at t. */
export const bodyX = (t, S = SHAPE) => (t - 0.5) * S.span;

export function createBurrower(opts = {}) {
  const S = { ...SHAPE, ...opts };
  const g = new THREE.Group();

  const skin = new THREE.MeshLambertMaterial({ color: COL.skin });
  const bone = new THREE.MeshLambertMaterial({ color: PALETTE.bone });
  const glow = new THREE.MeshBasicMaterial({ color: 0xff2244 });
  const eye = new THREE.MeshBasicMaterial({ color: PALETTE.eyeRed });
  const floorMat = new THREE.MeshLambertMaterial({ color: COL.floor });

  // The hole it came up through. One hole: the head end no longer enters the
  // floor, so there is nothing for a second one to be.
  const ground = new THREE.Mesh(new THREE.RingGeometry(0.8, 4.5, 24), floorMat);
  ground.rotation.x = -Math.PI * 0.5;
  ground.position.set(bodyX(0, S), -0.3, 0);
  g.add(ground);

  const segments = [];
  for (let i = 0; i < S.segments; i++) {
    const t = i / (S.segments - 1);
    const y = bodyY(t, S);
    if (y <= -0.25) continue;                 // below the floor: not drawn
    const r = bodyR(t, S);
    const sG = new THREE.SphereGeometry(r, 8, 6);
    sG.scale(1, 1, 1.3);
    const seg = new THREE.Mesh(sG, skin);
    seg.position.set(bodyX(t, S), y, 0);
    g.add(seg);
    segments.push({ mesh: seg, t, baseX: bodyX(t, S), baseY: y, r });
  }

  // ── The head, at the leading tip ──────────────────────────
  const hx = bodyX(1, S), hy = bodyY(1, S);
  const MR = S.thick * S.mouth;

  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(MR, MR * 0.25, 6, 12),
    new THREE.MeshLambertMaterial({ color: COL.gullet }));
  mouth.position.set(hx + 0.22, hy, 0);
  mouth.rotation.y = Math.PI * 0.5;
  g.add(mouth);

  // Two rings. One ring reads as a toothed rim; two at different depths read
  // as a throat with something down it.
  const teeth = [];
  for (const ring of [
    { count: S.outerTeeth, radius: MR * 0.92, x: 0.34, r: 0.038, len: 0.26, lean: 0 },
    { count: S.innerTeeth, radius: MR * 0.55, x: 0.17, r: 0.03, len: 0.2, lean: 0.5 },
  ]) {
    for (let i = 0; i < ring.count; i++) {
      const a = (i / ring.count) * Math.PI * 2
              + (ring.lean ? Math.PI / ring.count : 0);
      const tooth = new THREE.Mesh(
        new THREE.ConeGeometry(ring.r, ring.len, 4), bone);
      tooth.position.set(hx + ring.x,
                         hy + Math.sin(a) * ring.radius,
                         Math.cos(a) * ring.radius);
      tooth.rotation.z = -Math.PI * 0.5 + Math.sin(a) * ring.lean * 0.5;
      tooth.rotation.y = -Math.cos(a) * ring.lean * 0.5;
      g.add(tooth);
      teeth.push(tooth);
    }
  }

  const eyes = [];
  for (const ez of [0.17, -0.17]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), eye);
    e.position.set(hx - 0.16, hy + 0.16, ez);
    g.add(e);
    eyes.push(e);
  }

  // Lit patches down the back.
  const glows = [];
  for (let i = 3; i < S.segments - 3; i += 3) {
    const t = i / (S.segments - 1);
    const y = bodyY(t, S);
    if (y <= 0) continue;
    const r = bodyR(t, S);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 5, 4), glow);
    m.position.set(bodyX(t, S), y + r * 0.7, r * 0.6);
    g.add(m);
    glows.push({ mesh: m, t });
  }

  // Floor it brought up with it.
  for (let i = 0; i < 12; i++) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(
      0.18 + Math.random() * 0.3, 0.1, 0.18 + Math.random() * 0.22), floorMat);
    const a = Math.random() * Math.PI * 2, rr = 1.1 + Math.random() * 1.9;
    d.position.set(bodyX(0, S) + Math.cos(a) * rr, -0.22, Math.sin(a) * rr);
    d.rotation.set(Math.random(), Math.random(), Math.random());
    g.add(d);
  }

  // One over the hole, one on the head. A single light at the origin left
  // both ends of an eleven-unit body in the dark.
  for (const [lx, ly] of [[bodyX(0, S), 0.4], [hx, hy]]) {
    const l = new THREE.PointLight(0xff2244, 1.2, 9);
    l.position.set(lx, ly, 0);
    g.add(l);
  }

  g.traverse((o) => { if (o.isMesh) o.userData.hitPart = 'body'; });
  for (const e of eyes) e.userData.hitPart = 'eye';

  g.userData = { type: 'burrower', shape: S, segments, teeth, eyes, glows,
                 head: { x: hx, y: hy } };
  return g;
}
