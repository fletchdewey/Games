// src/map/props.js
// Set dressing. Right now: the Hangar crash site.
//
// FLETCHER'S GUIDE:
// Everything here is built from boxes, cylinders and spheres like the aliens
// are — no model files. Props are decoration only: they're drawn and they
// stop bullets, but they don't block movement (see PROP_SOLID at the bottom
// for where that would go).
//
// Scale: walls are 4 units and your eye is at 1.6, so a unit reads as about
// a metre. The helicopter is sized as a real one would be — ~13 long.

import * as THREE from 'three';
import { roomIdAt, worldToCell, isFloorAt, WALL_HEIGHT as WALL_H,
         SURFACE_WHITE } from './grid_map.js?v=3fb94f9293';
// Specimens for the pods room. These come from workshop_models.js — the
// current models, straight out of the Alien Workshop — not from the older
// crawler/floater/brute modules the fightable aliens are still built from.
import { buildCrawler, buildFloater, buildBrute, buildWatcher }
  from '../aliens/workshop_models.js?v=3fb94f9293';
// The control room's map screen is drawn from the same painted cells the
// level itself is built from.
import { GRID } from './grid_data.js?v=3fb94f9293';

// Deterministic jitter, so the wreck looks scattered but lands in the same
// place every run. Math.random() here would move the bodies on every reload.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const M = {
  hull:    () => new THREE.MeshLambertMaterial({ color: 0x3f4a3a }),   // olive drab
  hullDk:  () => new THREE.MeshLambertMaterial({ color: 0x2b3328 }),
  metal:   () => new THREE.MeshLambertMaterial({ color: 0x4a4f55 }),
  glass:   () => new THREE.MeshLambertMaterial({ color: 0x1b2430 }),
  scorch:  () => new THREE.MeshBasicMaterial({ color: 0x14100f }),
  blood:   () => new THREE.MeshBasicMaterial({ color: 0x4a0a0c }),
  fatigue: () => new THREE.MeshLambertMaterial({ color: 0x3a4232 }),
  flesh:   () => new THREE.MeshLambertMaterial({ color: 0x8a6a56 }),
  helmet:  () => new THREE.MeshLambertMaterial({ color: 0x2f3a2c }),
  crateWood:  () => new THREE.MeshLambertMaterial({ color: 0x6b5637 }),
  crateMetal: () => new THREE.MeshLambertMaterial({ color: 0x55606b }),
  crateTrim:  () => new THREE.MeshLambertMaterial({ color: 0x3d3124 }),
  tank:       () => new THREE.MeshLambertMaterial({ color: 0x8a9099 }),
  hazard:     () => new THREE.MeshLambertMaterial({ color: 0xb4761c }),
  pilot:   () => new THREE.MeshLambertMaterial({ color: 0x2a2f3a }),   // flight suit
  labCoat: () => new THREE.MeshLambertMaterial({ color: 0xcfcfc4 }),   // the people who studied them
  labTrim: () => new THREE.MeshLambertMaterial({ color: 0x8e9298 }),
  hair:    () => new THREE.MeshLambertMaterial({ color: 0x3a2e24 }),
  // Watcher parts — same colours the workshop model uses, so a leg on the
  // floor reads as having come off one of them.
  legSkin:  () => new THREE.MeshLambertMaterial({ color: 0x4a5058 }),
  legArmor: () => new THREE.MeshLambertMaterial({ color: 0x2a2a38 }),
  legNub:   () => new THREE.MeshLambertMaterial({ color: 0x3a3a4a }),
  // Brute parts — the workshop model's armour and bone colours.
  bruteArmor: () => new THREE.MeshLambertMaterial({ color: 0x2a2a38 }),
  bruteBone:  () => new THREE.MeshLambertMaterial({ color: 0xc8b8a0 }),
  // Human kit left behind.
  ammoBox:  () => new THREE.MeshLambertMaterial({ color: 0x4b5236 }),
  stencil:  () => new THREE.MeshLambertMaterial({ color: 0xb9bda6 }),
  gunMetal: () => new THREE.MeshLambertMaterial({ color: 0x33383e }),
  gunStock: () => new THREE.MeshLambertMaterial({ color: 0x4a3a2a }),
  brass:    () => new THREE.MeshLambertMaterial({ color: 0xa8853a }),
  bar:      () => new THREE.MeshLambertMaterial({ color: 0x565e66 }),
  cellWall: () => new THREE.MeshLambertMaterial({ color: SURFACE_WHITE }),
  bunk:     () => new THREE.MeshLambertMaterial({ color: 0x6a717a }),
  humanBone: () => new THREE.MeshLambertMaterial({ color: 0xd6cbb2 }),
  rag:       () => new THREE.MeshLambertMaterial({ color: 0x2f3629 }),
  locker:    () => new THREE.MeshLambertMaterial({ color: 0x737a80 }),
  benchTop:  () => new THREE.MeshLambertMaterial({ color: 0x5c6269 }),
  pegboard:  () => new THREE.MeshLambertMaterial({ color: 0x7d8288 }),
};

// ─── BLOOD ──────────────────────────────────────────────────
// A ragged pool plus a couple of satellite splashes. Unlit, so it stays dark
// against a white floor instead of washing out under a lamp.
function bloodPool(r, seed) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const mat = M.blood();

  const make = (radius, segs) => {
    const pts = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const rr = radius * (0.68 + rand() * 0.52);     // ragged edge
      pts.push(new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr));
    }
    const m = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts)), mat);
    m.rotation.x = -Math.PI / 2;
    return m;
  };

  const main = make(r, 11);
  main.position.y = 0.015;
  g.add(main);
  for (let i = 0; i < 2; i++) {
    const s = make(r * (0.22 + rand() * 0.2), 7);
    s.position.set((rand() - 0.5) * r * 2.6, 0.012, (rand() - 0.5) * r * 2.6);
    g.add(s);
  }
  return g;
}

// ─── A BODY ─────────────────────────────────────────────────
// Lying down, limbs splayed. `kind` swaps the uniform for a flight suit.
function deadBody(kind, seed) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const sci = kind === 'scientist';
  // A scientist is the same body in a lab coat with no helmet on it. They
  // were not dressed for any of this, which is the point of putting them in
  // the room full of the things that were being studied.
  const cloth = sci ? M.labCoat() : kind === 'pilot' ? M.pilot() : M.fatigue();
  const skin = M.flesh();

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.26, 0.95), cloth);
  torso.position.y = 0.13;
  g.add(torso);

  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.24, 0.3), cloth);
  hips.position.set(0, 0.12, -0.56);
  g.add(hips);

  // Head lolled to one side.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 6), skin);
  head.position.set((rand() - 0.5) * 0.3, 0.15, 0.68);
  g.add(head);
  // Headgear — or hair, on the one who never expected to need any.
  const hat = new THREE.Mesh(
    new THREE.SphereGeometry(sci ? 0.165 : 0.18, 8, 5, 0, Math.PI * 2, 0,
                             sci ? Math.PI * 0.42 : Math.PI * 0.55),
    sci ? M.hair() : kind === 'pilot' ? M.metal() : M.helmet());
  hat.position.copy(head.position);
  hat.position.y += sci ? 0.05 : 0.04;
  hat.rotation.z = (rand() - 0.5) * (sci ? 0.5 : 1.2);
  g.add(hat);

  if (sci) {
    // The coat is open over something darker, and there is a badge on it.
    const under = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.6), M.labTrim());
    under.position.set(0, 0.2, 0.08);
    g.add(under);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x6effa8 }));
    badge.position.set(0.17, 0.25, 0.3);
    g.add(badge);
  }

  // Arms and legs, flung at their own angles.
  const limb = (len, r0, r1) =>
    new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 5), cloth);
  for (const side of [-1, 1]) {
    const arm = limb(0.62, 0.085, 0.07);
    arm.position.set(side * 0.33, 0.1, 0.22);
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = side * (0.5 + rand() * 0.9);
    g.add(arm);

    const leg = limb(0.78, 0.11, 0.085);
    leg.position.set(side * 0.16, 0.11, -0.95);
    leg.rotation.x = Math.PI / 2;
    leg.rotation.z = side * (0.12 + rand() * 0.45);
    g.add(leg);

    const boot = new THREE.Mesh(
      new THREE.BoxGeometry(sci ? 0.13 : 0.16, sci ? 0.1 : 0.13, sci ? 0.21 : 0.26),
      M.hullDk());
    boot.position.set(side * (0.16 + rand() * 0.2), 0.07, -1.35);
    g.add(boot);
  }
  return g;
}

// ─── BROKEN HELICOPTER ──────────────────────────────────────
// Down on one side with the tail snapped and a blade thrown clear. Kept under
// the 4-unit ceiling by being tipped over, which is also why it reads wrecked.
function brokenHelicopter() {
  const g = new THREE.Group();
  const hull = M.hull(), dk = M.hullDk(), metal = M.metal();

  const body = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), hull);
  body.scale.set(1.0, 0.92, 2.4);
  body.position.y = 1.25;
  g.add(body);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.15, 9, 7), M.glass());
  nose.scale.set(0.95, 0.85, 1.25);
  nose.position.set(0, 1.3, 3.0);
  g.add(nose);

  // Engine deck and the rotor mast above it.
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.6, 2.2), dk);
  deck.position.set(0, 2.35, -0.3);
  g.add(deck);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.75, 7), metal);
  mast.position.set(0, 2.85, -0.3);
  g.add(mast);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.3, 7, 6), metal);
  hub.position.set(0, 3.2, -0.3);
  g.add(hub);

  // Three blades still attached, all bent. The fourth is on the floor below.
  for (let i = 0; i < 3; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.1, 0.42), dk);
    blade.position.set(Math.cos(a) * 2.8, 3.18 - i * 0.12, -0.3 + Math.sin(a) * 2.8);
    blade.rotation.y = a;
    blade.rotation.z = (i - 1) * 0.22;              // drooping, not level
    g.add(blade);
  }

  // Tail boom, snapped and hanging.
  const boomPivot = new THREE.Group();
  boomPivot.position.set(0, 1.6, -3.1);
  // Snapped and twisted, but tilted UP not down — at -0.38 the fin and tail
  // rotor ended up a metre under the floor, invisible and clipped.
  boomPivot.rotation.x = 0.14;
  boomPivot.rotation.z = 0.42;
  g.add(boomPivot);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.26, 4.2, 7), hull);
  boom.rotation.x = Math.PI / 2;
  boom.position.z = -2.1;
  boomPivot.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.8), hull);
  fin.position.set(0, 0.5, -4.1);
  boomPivot.add(fin);
  const tailHub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 6), metal);
  tailHub.rotation.z = Math.PI / 2;
  tailHub.position.set(0, 0.2, -4.0);
  boomPivot.add(tailHub);
  for (let i = 0; i < 2; i++) {
    const tb = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.05, 0.2), dk);
    tb.position.set(0.1, 0.2, -4.0);
    tb.rotation.x = i * Math.PI / 2 + 0.4;
    boomPivot.add(tb);
  }

  // Skids — the near one collapsed, which is what tips the whole airframe.
  for (const side of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4.2, 6), metal);
    skid.rotation.x = Math.PI / 2;
    skid.position.set(side * 1.15, side < 0 ? 0.12 : 0.5, 0.3);
    skid.rotation.z = side < 0 ? 0.1 : 0;
    g.add(skid);
    for (const z of [1.3, -0.9]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 5), metal);
      strut.position.set(side * 0.95, side < 0 ? 0.35 : 0.7, z);
      strut.rotation.z = side * 0.35;
      g.add(strut);
    }
  }

  // Torn side door, hanging open.
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 1.5), dk);
  door.position.set(-1.45, 1.1, 0.6);
  door.rotation.z = 0.5;
  door.rotation.y = 0.4;
  g.add(door);

  return g;
}

// ─── CRATES ─────────────────────────────────────────────────
// A box plus two battens. Kept to three meshes each because they come in
// clusters — detail per crate costs a lot once there are twenty of them.
function crate(w, h, d, seed) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    rand() > 0.45 ? M.crateWood() : M.crateMetal());
  body.position.y = h / 2;
  g.add(body);
  // Battens, a touch proud of the face so they read as separate timber.
  for (const yy of [h * 0.22, h * 0.78]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, h * 0.1, d * 1.02),
      M.crateTrim());
    band.position.y = yy;
    g.add(band);
  }
  return g;
}

// A cluster of crates, some stacked, some knocked over.
function crateStack(seed) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const footprints = [];
  const n = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const w = 0.9 + rand() * 0.5, h = 0.8 + rand() * 0.5, d = 0.9 + rand() * 0.5;
    const c = crate(w, h, d, seed + i * 17);
    const ox = (rand() - 0.5) * 2.6, oz = (rand() - 0.5) * 2.6;
    const stacked = rand() > 0.62;
    c.position.set(ox, stacked ? 0.85 + rand() * 0.2 : 0, oz);
    c.rotation.y = (rand() - 0.5) * 0.9;
    if (rand() > 0.8) c.rotation.z = (rand() - 0.5) * 0.5;   // toppled
    g.add(c);
    if (!stacked) footprints.push({ x: ox, z: oz, r: Math.max(w, d) * 0.6 });
  }
  g.userData.footprints = footprints;
  return g;
}

// ─── FUEL TANK ──────────────────────────────────────────────
// Horizontal bowser on cradles, with a hazard band, filler pipe and valve.
function fuelTank() {
  const g = new THREE.Group();
  const R = 1.45, L = 8;

  const drum = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 16), M.tank());
  drum.rotation.z = Math.PI / 2;
  drum.position.y = R + 0.55;
  g.add(drum);
  for (const sx of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(R, 14, 8,
      0, Math.PI * 2, 0, Math.PI / 2), M.tank());
    cap.rotation.z = sx * Math.PI / 2;
    cap.position.set(sx * L / 2, R + 0.55, 0);
    g.add(cap);
  }
  // Hazard band around the middle.
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.01, R * 1.01, 1.1, 16),
    M.hazard());
  band.rotation.z = Math.PI / 2;
  band.position.y = R + 0.55;
  g.add(band);

  // Cradles.
  for (const sx of [-2.4, 2.4]) {
    const cradle = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, R * 2.1), M.metal());
    cradle.position.set(sx, 0.55, 0);
    g.add(cradle);
  }
  // Filler pipe and valve wheel on top.
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1.1, 8), M.metal());
  pipe.position.set(-1.6, R + 1.5, 0);
  g.add(pipe);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.07, 6, 12), M.hazard());
  wheel.position.set(-1.6, R + 2.0, 0);
  wheel.rotation.x = Math.PI / 2;
  g.add(wheel);
  // Hose coiled off the near end.
  const hose = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.11, 6, 14), M.hullDk());
  hose.position.set(L / 2 + 0.4, 0.12, 1.1);
  hose.rotation.x = Math.PI / 2;
  g.add(hose);

  return g;
}

// ─── OPEN TO SPACE ──────────────────────────────────────────
// The whole wall is gone — floor to ceiling, corner to corner. No frame and
// no mullions: this is a breach, not a window.
//
// Everything is unlit (MeshBasicMaterial / PointsMaterial) on purpose. With
// Lambert the ceiling lamps would light the "void" and space would glow grey.
//
// It is still a BACKDROP. The wall collider stays, so you can't physically
// walk out — the vacuum kills you before you get that far.
//
// `side` says which way the room lies: +1 when the floor is at z greater than
// the wall, -1 when it is at z less. Everything is nudged into the room by
// that sign, so the same builder works on either face of the hangar.
function spaceWall(x0, x1, wallZ, side = 1) {
  const g = new THREE.Group();
  const rand = rng(90210);
  const w = x1 - x0, h = WALL_H;
  const cx = (x0 + x1) / 2, cy = h / 2;

  // DoubleSide: a plane faces +Z, so on the far wall it would be edge-on to
  // the player and the void would read as nothing at all.
  const void_ = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color: 0x03040a, side: THREE.DoubleSide }));
  void_.position.set(cx, cy, wallZ + side * 0.04);
  g.add(void_);

  // Stars sit in FRONT of the void, or they'd be hidden behind it.
  const pts = [], cols = [];
  for (let i = 0; i < 700; i++) {
    pts.push(cx + (rand() - 0.5) * w * 0.998,
             cy + (rand() - 0.5) * h * 0.998,
             wallZ + side * 0.08);
    const b = 0.35 + rand() * 0.65;
    const t = rand();
    cols.push(b * (t > 0.85 ? 1 : t < 0.12 ? 0.72 : 0.95),
              b * (t > 0.85 ? 0.86 : 0.95),
              b * (t > 0.85 ? 0.7 : 1));
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  starGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
    size: 0.07, sizeAttenuation: true, vertexColors: true })));

  // Torn edge where the hull gave way — a ragged lip top and bottom so the
  // breach doesn't read as a clean rectangle someone cut on purpose.
  const lip = [];
  const steps = Math.round(w / 0.6);
  for (let i = 0; i < steps; i++) {
    const lx = x0 + (i / steps) * w, lw = w / steps + 0.02;
    for (const [yBase, dir] of [[0, 1], [h, -1]]) {
      const t = 0.12 + rand() * 0.42;
      lip.push({ x: lx + lw / 2, y: yBase + dir * t / 2, w: lw, hh: t });
    }
  }
  for (const l of lip) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(l.w, l.hh, 0.22), M.metal());
    m.position.set(l.x, l.y, wallZ + side * 0.06);
    g.add(m);
  }
  return g;
}

// ─── WALL DAMAGE ────────────────────────────────────────────
// Bullet holes and scorch marks, sprayed across the room's own wall
// segments. Both merge into a single mesh each — seventy separate little
// meshes would cost seventy draw calls for a few hundred triangles.
//
// A decal sits on the wall plane, nudged into the room along that wall's
// inward normal so it can't z-fight with the surface it's painted on.
function wallDamage(walls, bounds, skips, seed) {
  const rand = rng(seed);
  const OFF = 0.05;

  // Only walls that border this room, and never the breach — you can't put
  // a bullet hole in open space.
  const usable = walls.filter((w) => {
    const mid = w.axis === 'x'
      ? { x: w.pos, z: (w.min + w.max) / 2 }
      : { x: (w.min + w.max) / 2, z: w.pos };
    if (mid.x < bounds.x0 - 1 || mid.x > bounds.x1 + 1) return false;
    if (mid.z < bounds.z0 - 1 || mid.z > bounds.z1 + 1) return false;
    if (w.axis === 'z' && skips.some((b) => Math.abs(w.pos - b.z) < 0.01 &&
        w.max > b.xMin && w.min < b.xMax)) return false;
    return w.max - w.min > 1;
  });
  if (!usable.length) return { holes: null, scorch: null, count: 0 };

  // Place one decal: returns its four corners on the wall plane.
  const quad = (w, t, y, r) => {
    const nx = w.axis === 'x' ? -w.dir : 0, nz = w.axis === 'x' ? 0 : -w.dir;
    if (w.axis === 'x') {
      const px = w.pos + nx * OFF;
      return [[px, y - r, t - r], [px, y - r, t + r], [px, y + r, t + r], [px, y + r, t - r]];
    }
    const pz = w.pos + nz * OFF;
    return [[t - r, y - r, pz], [t + r, y - r, pz], [t + r, y + r, pz], [t - r, y + r, pz]];
  };
  const push = (arr, c) => {
    arr.push(...c[0], ...c[1], ...c[2], ...c[0], ...c[2], ...c[3]);
  };

  const holePts = [], scorchPts = [];
  // Bullet holes cluster at chest height, where people actually shoot.
  for (let i = 0; i < 90; i++) {
    const w = usable[Math.floor(rand() * usable.length)];
    const t = w.min + 0.3 + rand() * (w.max - w.min - 0.6);
    const y = 0.5 + Math.pow(rand(), 0.7) * 2.1;
    push(holePts, quad(w, t, y, 0.045 + rand() * 0.05));
  }
  // Scorches are bigger, lower and rarer.
  for (let i = 0; i < 16; i++) {
    const w = usable[Math.floor(rand() * usable.length)];
    const t = w.min + 0.6 + rand() * (w.max - w.min - 1.2);
    const y = 0.3 + rand() * 1.9;
    push(scorchPts, quad(w, t, y, 0.35 + rand() * 0.65));
  }

  const mk = (pts, color, opacity) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false,
      side: THREE.DoubleSide }));
  };
  return {
    holes: mk(holePts, 0x15181c, 0.92),
    scorch: mk(scorchPts, 0x1b1714, 0.38),
    count: 90 + 16,
  };
}

// ─── WEBS ───────────────────────────────────────────────────
// Every strand is real geometry, not a line. THREE.LineSegments would be the
// obvious choice and it is cheaper, but a line is locked to one hardware
// pixel however close you are, so a web three metres overhead reads as
// nothing at all. Each strand is instead two thin quads crossed at right
// angles down its length: a thread with actual width, visible from any angle,
// through the same path as the floor and walls.
//
// Ceiling and floor webs are the same shapes at different heights, so they
// share this pen. It draws into one vertex buffer and hands back one mesh.
function webPen(thick) {
  const pts = [];
  let strands = 0;

  // One quad: the segment swept sideways along (nx, ny, nz).
  function ribbon(a, b, nx, ny, nz) {
    const hx = nx * thick, hy = ny * thick, hz = nz * thick;
    const v0 = [a[0] - hx, a[1] - hy, a[2] - hz];
    const v1 = [a[0] + hx, a[1] + hy, a[2] + hz];
    const v2 = [b[0] + hx, b[1] + hy, b[2] + hz];
    const v3 = [b[0] - hx, b[1] - hy, b[2] - hz];
    pts.push(...v0, ...v1, ...v2, ...v0, ...v2, ...v3);
  }

  // A strand = two ribbons crossed, so it never turns edge-on and vanishes.
  function seg(a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return;
    strands++;
    const ux = dx / len, uy = dy / len, uz = dz / len;
    // First perpendicular: horizontal. For a strand hanging straight down the
    // ground track is zero length, so fall back to a fixed axis.
    let p1x = -uz, p1z = ux;
    const m = Math.hypot(p1x, p1z);
    if (m < 1e-3) { p1x = 1; p1z = 0; } else { p1x /= m; p1z /= m; }
    ribbon(a, b, p1x, 0, p1z);
    // Second perpendicular: u × p1, which tilts out of horizontal.
    ribbon(a, b, uy * p1z, uz * p1x - ux * p1z, -uy * p1x);
  }

  // A ring span, bowed inward and dipped mid-chord. A straight chord between
  // two spokes makes the ring read as a hexagon; a real web hangs in scallops.
  const BOW = 0.13;
  function ringSpan(cx, cz, dir, k, rr, y, dip) {
    let prev = null;
    for (let t = 0; t <= 3; t++) {
      const f = t / 3, d = Math.sin(Math.PI * f);
      const [ux, uz] = dir(k + f);
      const p = [cx + ux * rr * (1 - BOW * d), y - d * dip, cz + uz * rr * (1 - BOW * d)];
      if (prev) seg(prev, p);
      prev = p;
    }
  }

  // Spokes out from a hub, then bowed rings across them. `dir(k)` is the unit
  // direction of spoke k, `yAt(f)` the height at radius fraction f, and `hang`
  // the longest dangling strand (0 for none).
  function spin(o) {
    const { cx, cz, R, dir, spokes, rings, hubY, yAt, dip, rand, hang } = o;
    for (let k = 0; k < spokes; k++) {
      const [ux, uz] = dir(k);
      seg([cx, hubY, cz], [cx + ux * R, yAt(1), cz + uz * R]);
    }
    for (let r = 1; r <= rings; r++) {
      const f = r / rings;
      const rr = f * R * (0.85 + rand() * 0.3);
      for (let k = 0; k < spokes; k++) ringSpan(cx, cz, dir, k, rr, yAt(f), dip);
    }
    for (let i = 0; i < 2 && hang > 0; i++) {
      const [ux, uz] = dir(rand() * spokes);
      const rr = R * (0.4 + rand() * 0.5);
      const x = cx + ux * rr, z = cz + uz * rr, top = yAt(rr / R);
      seg([x, top, z], [x + (rand() - 0.5) * 0.2,
                        top - hang * (0.35 + rand() * 0.65),
                        z + (rand() - 0.5) * 0.2]);
    }
  }

  // Full radial web.
  function orb(cx, cz, R, hubY, yAt, dip, rand, hang) {
    const spokes = 11, off = rand() * Math.PI;
    const dir = (k) => {
      const a = off + (k / spokes) * Math.PI * 2;
      return [Math.cos(a), Math.sin(a)];
    };
    spin({ cx, cz, R, dir, spokes, rings: 5, hubY, yAt, dip, rand, hang });
  }

  // Basic, not Lambert: a web should stay the same shade whichever way a
  // strand faces. DoubleSide because a ribbon is a sheet with no inside.
  function mesh(color) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color, side: THREE.DoubleSide }));
    m.renderOrder = 1;
    return m;
  }

  return { orb, seg, mesh, count: () => strands };
}

// ─── CEILING WEBS ───────────────────────────────────────────
// Unlit and slightly brighter than the ceiling: the ceiling renders grey
// because the lamps hang just below it and graze it, so a pale web reads
// against it. A white Lambert web would vanish into the surface.
export function buildCeilingWebs(scene, room, seed = 31337) {
  const rand = rng(seed);
  const pen = webPen(0.006);
  const CEIL = WALL_H - 0.05;
  // A web sags away from its anchors, deepest mid-span.
  const sag = (f, depth) => CEIL - 0.03 - Math.sin(Math.PI * f) * depth;

  // There were quarter-webs tucked into the four ceiling corners too. A web in
  // a corner sits edge-on to the whole room however it is draped, so it never
  // read as anything but a row of jagged teeth. Removed — the open ceiling
  // webs below carry the look on their own.
  //
  // Strung across the open ceiling, on a jittered grid rather than at random.
  // Pure scatter clumped and left a whole span of ceiling bare, so a forward
  // glance saw nothing and you had to crane straight up to find a web. One per
  // cell with jitter keeps it irregular without leaving holes.
  const innerW = room.x1 - room.x0 - 3, innerD = room.z1 - room.z0 - 2.4;
  const cols = Math.max(1, Math.round(innerW / 3.5));
  const rows = Math.max(1, Math.round(innerD / 2.8));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = room.x0 + 1.5 + (c + 0.2 + rand() * 0.6) * (innerW / cols);
      const cz = room.z0 + 1.2 + (r + 0.2 + rand() * 0.6) * (innerD / rows);
      pen.orb(cx, cz, 0.8 + rand() * 0.7, sag(0.5, 0.3),
              (f) => sag(1 - f, 0.3), 0.035, rand, 1.6);
    }
  }

  const mesh = pen.mesh(0xeef2f8);
  scene.add(mesh);
  return { mesh, strands: pen.count() };
}

// ─── FLOOR WEBS ─────────────────────────────────────────────
// Matted webbing you have to wade through. Same shapes as the ceiling webs,
// laid flat, but grey instead of near-white: the floor is white and the webs
// are unlit, so a pale web on it would be invisible — and you need to see
// these to decide whether to go round.
//
// Returns the circles that slow you down. They're a little tighter than the
// web looks, so the edge of the mat doesn't grab you as you brush past.
export function buildFloorWebs(scene, room, count = 4, seed = 5150) {
  const rand = rng(seed);
  const pen = webPen(0.011);           // thicker: you see these nearly edge-on
  const zones = [];

  // Spread along the room's long axis, kept off the walls so you can always
  // walk round one rather than being funnelled into it.
  const MARGIN = 1.9;
  const spanX = room.x1 - room.x0 - MARGIN * 2;
  const spanZ = room.z1 - room.z0 - MARGIN * 2;
  for (let i = 0; i < count; i++) {
    const R = 1.1 + rand() * 0.5;
    const cx = room.x0 + MARGIN + (i + 0.15 + rand() * 0.7) * (spanX / count);
    const cz = room.z0 + MARGIN + rand() * spanZ;
    // Domed: the middle is lifted off the floor, the rim lies on it. Kept
    // clear of y = 0 so the strands can't z-fight with the floor itself.
    pen.orb(cx, cz, R, 0.12, (f) => 0.03 + 0.07 * (1 - f), 0.012, rand, 0);
    zones.push({ x: cx, z: cz, r: R * 0.85 });
  }

  const mesh = pen.mesh(0x95a1b2);
  scene.add(mesh);
  return { mesh, zones, strands: pen.count() };
}

// ─── FLOOR TENTACLES ────────────────────────────────────────
// Pink growths crawling across the floor that shock you if you tread on one.
//
// Built as merged tubes rather than scaled cylinders: a tentacle wanders and
// tapers, so every segment needs its own radius and heading, and one mesh for
// the lot keeps the whole room at a single draw call.
const NODE_PROTO = new THREE.SphereGeometry(1, 7, 5).toNonIndexed()
  .attributes.position.array;

export function buildFloorTentacles(scene, room, count = 5, seed = 77213) {
  const rand = rng(seed);
  const skin = [], glow = [], zones = [], roots = [];
  const SIDES = 7, STEP = 0.42, LEN = 16;
  const MARGIN = 1.1;
  const MIN_SEP = 3.6;                 // between tentacle roots

  // A blob at a joint, also what caps the open end of a tapering tube.
  function node(arr, cx, cy, cz, r) {
    for (let i = 0; i < NODE_PROTO.length; i += 3) {
      arr.push(cx + NODE_PROTO[i] * r, cy + NODE_PROTO[i + 1] * r,
               cz + NODE_PROTO[i + 2] * r);
    }
  }

  for (let t = 0; t < count; t++) {
    // Start somewhere in the room and crawl, turning a little each step. The
    // walk is reflected off the walls rather than clamped, so a tentacle that
    // reaches the edge turns and keeps going instead of piling up on itself.
    // Roots are kept apart by rejection sampling. Purely random starts
    // clumped two or three together and left most of the floor clear, which
    // is the opposite of a hazard you have to pick your way through.
    let x = 0, z = 0;
    for (let tries = 0; tries < 40; tries++) {
      x = room.x0 + MARGIN + rand() * (room.x1 - room.x0 - MARGIN * 2);
      z = room.z0 + MARGIN + rand() * (room.z1 - room.z0 - MARGIN * 2);
      if (roots.every((r) => (r[0] - x) ** 2 + (r[1] - z) ** 2 > MIN_SEP ** 2)) break;
    }
    roots.push([x, z]);
    let h = rand() * Math.PI * 2;
    const path = [];
    for (let i = 0; i <= LEN; i++) {
      path.push([x, z]);
      // Less turn than a true random walk: a tightly coiling tentacle sits in
      // one spot, and these should reach across the floor.
      h += (rand() - 0.5) * 0.5;
      let nx = x + Math.cos(h) * STEP, nz = z + Math.sin(h) * STEP;
      if (nx < room.x0 + MARGIN || nx > room.x1 - MARGIN) { h = Math.PI - h; nx = x; }
      if (nz < room.z0 + MARGIN || nz > room.z1 - MARGIN) { h = -h; nz = z; }
      x = nx; z = nz;
    }

    const R0 = 0.085 + rand() * 0.025, R1 = 0.022;
    const radiusAt = (f) =>
      (R0 + (R1 - R0) * f) * (1 + 0.3 * Math.sin(f * Math.PI * 5));

    let prev = null;
    for (let i = 0; i < path.length; i++) {
      const f = i / (path.length - 1);
      const r = radiusAt(f);
      const cy = r + 0.015;              // resting on the floor, not in it
      // Heading from the neighbours, so the ring is square to the path.
      const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const L = Math.hypot(dx, dz) || 1;
      const nx = -dz / L, nz = dx / L;   // sideways, in the floor plane
      const ring = [];
      for (let k = 0; k < SIDES; k++) {
        const th = (k / SIDES) * Math.PI * 2;
        const c = Math.cos(th) * r, up = Math.sin(th) * r;
        ring.push([path[i][0] + nx * c, cy + up, path[i][1] + nz * c]);
      }
      if (prev) {
        for (let k = 0; k < SIDES; k++) {
          const j = (k + 1) % SIDES;
          skin.push(...prev[k], ...prev[j], ...ring[j],
                    ...prev[k], ...ring[j], ...ring[k]);
        }
      }
      prev = ring;

      // Shock points: the bright bits, and what the damage zones follow.
      if (i % 3 === 0 || i === path.length - 1) {
        node(glow, path[i][0], cy, path[i][1], r * 1.25);
      }
      zones.push({ x: path[i][0], z: path[i][1], r: r + 0.3 });
    }
    node(skin, path[0][0], radiusAt(0) + 0.015, path[0][1], radiusAt(0) * 1.3);
  }

  const mk = (pts, mat) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.computeVertexNormals();
    return new THREE.Mesh(g, mat);
  };
  const group = new THREE.Group();
  group.add(mk(skin, new THREE.MeshLambertMaterial({ color: 0xd94b94 })));
  // Unlit, so the shock points stay bright whatever the room lighting does.
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff9ad8 });
  group.add(mk(glow, glowMat));
  group.traverse((o) => { if (o.isMesh) o.userData.isWall = true; });
  scene.add(group);

  return { group, zones, glowMat };
}

// ─── LASER SCARS ────────────────────────────────────────────
// Where a Watcher's beam has raked the walls. The Hangar's bullet holes are
// small, round and square to the room; these are long slashes at any angle
// with a paler core down the middle, so they read as something swept across
// the surface rather than punched through it.
export function buildLaserScars(scene, walls, room, count = 24, seed = 8123) {
  const rand = rng(seed);

  const usable = walls.filter((w) => {
    const mid = w.axis === 'x' ? { x: w.pos, z: (w.min + w.max) / 2 }
                               : { x: (w.min + w.max) / 2, z: w.pos };
    return mid.x >= room.x0 - 1 && mid.x <= room.x1 + 1 &&
           mid.z >= room.z0 - 1 && mid.z <= room.z1 + 1 && w.max - w.min > 1;
  });
  if (!usable.length) return { scars: 0 };

  // (u, v) are distance along the wall and height up it. A scar is a rectangle
  // rotated inside that plane — which is the whole point, since an axis-
  // aligned quad can only ever give you a level streak.
  function mark(arr, w, u, v, len, thick, ang, off) {
    const du = Math.cos(ang) * len / 2, dv = Math.sin(ang) * len / 2;
    const nu = -Math.sin(ang) * thick / 2, nv = Math.cos(ang) * thick / 2;
    const corners = [[u - du - nu, v - dv - nv], [u + du - nu, v + dv - nv],
                     [u + du + nu, v + dv + nv], [u - du + nu, v - dv + nv]];
    const p = corners.map(([cu, cv]) => w.axis === 'x'
      ? [w.pos - w.dir * off, cv, cu]
      : [cu, cv, w.pos - w.dir * off]);
    arr.push(...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3]);
  }

  const char = [], core = [];
  const pick = () => usable[Math.floor(rand() * usable.length)];
  const along = (w) => w.min + 0.4 + rand() * Math.max(0.2, w.max - w.min - 0.8);

  for (let i = 0; i < count; i++) {
    const w = pick(), u = along(w), v = 0.35 + rand() * 2.8;
    const len = 0.5 + rand() * 2.2, ang = (rand() - 0.5) * Math.PI;
    mark(char, w, u, v, len, 0.09 + rand() * 0.07, ang, 0.05);
    mark(core, w, u, v, len * 0.78, 0.03, ang, 0.06);
  }
  // A few round blooms where the beam went straight in instead of across.
  for (let i = 0; i < 5; i++) {
    const w = pick(), u = along(w), v = 0.5 + rand() * 2.4;
    const d = 0.28 + rand() * 0.26;
    mark(char, w, u, v, d, d, rand() * Math.PI, 0.05);
    mark(core, w, u, v, d * 0.4, d * 0.4, rand() * Math.PI, 0.06);
  }

  const mk = (pts, color, opacity) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false,
      side: THREE.DoubleSide }));
  };
  const group = new THREE.Group();
  group.add(mk(char, 0x1a1512, 0.88));
  // Cyan, because that is the colour the Watcher's beam is.
  group.add(mk(core, 0x8fdcff, 0.5));
  scene.add(group);
  return { group, scars: count + 5 };
}

// ─── SEVERED WATCHER LEGS ───────────────────────────────────
// Lengths and radii taken from the Watcher in the alien workshop, so these
// are recognisably off the same creature rather than generic debris.
const WL = { upperLen: 0.85, lowerLen: 0.95, upperR: 0.055, lowerR: 0.03,
             footSize: 0.05 };

// One leg lying on the floor, built along +X from the torn-off hip.
function watcherLeg(rand, mats) {
  const g = new THREE.Group();
  const lift = WL.upperR + 0.012;      // resting on the floor, not sunk in it

  // CylinderGeometry grows about its own centre on Y, so each segment is
  // shifted to start at the origin and then laid along +X.
  const bone = (len, r0, r1, mat) => {
    const geo = new THREE.CylinderGeometry(r0, r1, len, 5);
    geo.translate(0, len / 2, 0);
    geo.rotateZ(-Math.PI / 2);
    return new THREE.Mesh(geo, mat);
  };

  const hip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), mats.nub);
  hip.position.y = lift;
  g.add(hip);

  const upper = bone(WL.upperLen, WL.upperR, WL.upperR * 0.75, mats.skin);
  upper.position.y = lift;
  g.add(upper);

  // The knee keeps whatever angle it came to rest at. Turning it about Y
  // rather than Z keeps the shin flat on the floor instead of in the air.
  const knee = new THREE.Group();
  knee.position.set(WL.upperLen, lift, 0);
  knee.rotation.y = (rand() - 0.5) * 1.7;
  g.add(knee);
  knee.add(new THREE.Mesh(
    new THREE.SphereGeometry(WL.upperR * 1.1, 5, 5), mats.skin));
  knee.add(bone(WL.lowerLen, WL.upperR * 0.75, WL.lowerR, mats.skin));

  const ankle = new THREE.Group();
  ankle.position.x = WL.lowerLen;
  knee.add(ankle);
  ankle.add(new THREE.Mesh(
    new THREE.SphereGeometry(WL.lowerR * 1.2, 4, 4), mats.skin));
  const footGeo = new THREE.ConeGeometry(WL.footSize, WL.footSize * 2.5, 4);
  footGeo.translate(0, WL.footSize * 1.2, 0);
  footGeo.rotateZ(-Math.PI / 2);
  const foot = new THREE.Mesh(footGeo, mats.armor);
  foot.rotation.y = (rand() - 0.5) * 0.9;
  ankle.add(foot);
  return g;
}

// The burn left where a leg was cut off and dropped. Ragged ellipse rather
// than a circle, so it lies along the leg instead of ringing it.
function scorchPatch(rand, len, wid, mat) {
  const pts = [], segs = 19;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    // Gently ragged. A wide jitter on few segments gives spikes, and the
    // result reads as a shard of something lying there, not as a burn.
    const rr = 0.8 + rand() * 0.26;
    pts.push(new THREE.Vector2(Math.cos(a) * rr * len / 2,
                               Math.sin(a) * rr * wid / 2));
  }
  const m = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts)), mat);
  m.rotation.x = -Math.PI / 2;
  return m;
}

export function buildWatcherDebris(scene, room, count = 8, seed = 4711) {
  const rand = rng(seed);
  // Three materials for the whole scatter, not three per leg.
  const mats = { skin: M.legSkin(), armor: M.legArmor(), nub: M.legNub() };
  const group = new THREE.Group();
  const MARGIN = 1.3, MIN_SEP = 2.5;
  const spots = [];
  // Two layers per burn: a dark centre inside a much fainter halo. One flat
  // patch reads as a grey sticker; the halo gives it an edge that fades the
  // way scorching actually does. Transparent rather than solid black, or it
  // reads as a hole in a white floor.
  const burnCore = new THREE.MeshBasicMaterial({
    color: 0x17120f, transparent: true, opacity: 0.55, depthWrite: false });
  const burnHalo = new THREE.MeshBasicMaterial({
    color: 0x2a2320, transparent: true, opacity: 0.22, depthWrite: false });

  for (let i = 0; i < count; i++) {
    // Spread by rejection sampling: each leg tries for a spot at least
    // MIN_SEP from every one already placed.
    let x = 0, z = 0;
    for (let tries = 0; tries < 40; tries++) {
      x = room.x0 + MARGIN + rand() * (room.x1 - room.x0 - MARGIN * 2);
      z = room.z0 + MARGIN + rand() * (room.z1 - room.z0 - MARGIN * 2);
      if (spots.every((p) => (p[0] - x) ** 2 + (p[1] - z) ** 2 > MIN_SEP ** 2)) break;
    }
    spots.push([x, z]);
    const facing = rand() * Math.PI * 2;

    // Burn first, so the leg draws over it. Centred along the leg rather than
    // on its hip, since the leg runs out along +X from there.
    //
    // rotation.z spins the shape in its own plane and is applied BEFORE the
    // rotation.x that lays it flat, so it takes `facing` directly — negate it
    // and the burn comes out mirrored across the leg.
    const mx = x + Math.cos(facing) * 0.8, mz = z - Math.sin(facing) * 0.8;
    for (const [scale, mat, y] of [[1.4, burnHalo, 0.011], [1, burnCore, 0.013]]) {
      const mark = scorchPatch(rand, 2.2 * scale, 1.0 * scale, mat);
      mark.position.set(mx, y, mz);
      mark.rotation.z = facing;
      group.add(mark);
    }

    const leg = watcherLeg(rand, mats);
    leg.position.set(x, 0, z);
    leg.rotation.y = facing;
    // A shallow roll so they aren't all pressed perfectly flat, kept small
    // enough that no foot ends up buried in the floor.
    leg.rotation.z = (rand() - 0.5) * 0.18;
    group.add(leg);
  }

  // Debris stops bullets like the Hangar props do, but you can step over it.
  group.traverse((o) => { if (o.isMesh) o.userData.isWall = true; });
  scene.add(group);
  return { group, spots };
}

// ─── BROKEN CRATES AND SPILLED CARGO ────────────────────────
// The Hangar's crates are solid boxes. These are the same crates after
// something went through them: built as five separate panels so sides can be
// missing or sprung open, which a single box can't do.
function brokenCrate(w, h, d, rand) {
  const g = new THREE.Group();
  const T = 0.07;                      // panel thickness
  const board = rand() > 0.45 ? M.crateWood() : M.crateMetal();

  const base = new THREE.Mesh(new THREE.BoxGeometry(w, T, d), board);
  base.position.y = T / 2;
  g.add(base);

  const sides = [{ x: 0, z: d / 2, len: w, ry: 0 },
                 { x: 0, z: -d / 2, len: w, ry: 0 },
                 { x: w / 2, z: 0, len: d, ry: Math.PI / 2 },
                 { x: -w / 2, z: 0, len: d, ry: Math.PI / 2 }];
  let lost = 0;
  for (const s of sides) {
    if (lost < 2 && rand() > 0.58) { lost++; continue; }   // panel blown clean off
    // Two nested groups rather than setting both angles on one: Euler order
    // would apply the lean in world space and shear the panel off its edge.
    const yaw = new THREE.Group();
    yaw.position.set(s.x, 0, s.z);
    yaw.rotation.y = s.ry;
    const lean = new THREE.Group();
    lean.rotation.x = rand() > 0.55 ? (rand() - 0.5) * 0.8 : 0;
    yaw.add(lean);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(s.len, h, T), board);
    panel.position.y = h / 2;
    lean.add(panel);
    g.add(yaw);
  }

  const band = new THREE.Mesh(
    new THREE.BoxGeometry(w * 1.03, h * 0.1, d * 1.03), M.crateTrim());
  band.position.y = h * 0.2;
  g.add(band);
  return g;
}

// ─── BRUTE ARMOUR ───────────────────────────────────────────
// Shed plate, sized from the Brute in the alien workshop: the spiked pauldron
// that caps its shoulder and the box plates off its spine.
function brutePauldron(mats) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.33, 6, 5);
  geo.scale(1.05, 0.85, 1.05);
  g.add(new THREE.Mesh(geo, mats.armor));
  for (const sp of [{ x: 0.16, y: 0.24, z: 0.04, rz: 0.45, rx: -0.25, len: 0.34 },
                    { x: 0.27, y: 0.1, z: -0.1, rz: 1.0, rx: 0.2, len: 0.3 },
                    { x: 0.08, y: 0.24, z: -0.2, rz: 0.2, rx: 0.6, len: 0.26 }]) {
    const cone = new THREE.ConeGeometry(0.05, sp.len, 4);
    cone.translate(0, sp.len / 2, 0);
    const spike = new THREE.Mesh(cone, mats.bone);
    spike.position.set(sp.x, sp.y, sp.z);
    spike.rotation.set(sp.rx, 0, sp.rz);
    g.add(spike);
  }
  return g;
}

export function buildOutpostWreckage(scene, room, seed = 9042) {
  const rand = rng(seed);
  const group = new THREE.Group();
  const colliders = [];
  const mats = { armor: M.bruteArmor(), bone: M.bruteBone() };
  const scrapWood = M.crateWood(), scrapMetal = M.crateMetal();

  const MARGIN = 1.6;
  const spotIn = (sep, taken) => {
    let x = 0, z = 0;
    for (let tries = 0; tries < 40; tries++) {
      x = room.x0 + MARGIN + rand() * (room.x1 - room.x0 - MARGIN * 2);
      z = room.z0 + MARGIN + rand() * (room.z1 - room.z0 - MARGIN * 2);
      if (taken.every((p) => (p[0] - x) ** 2 + (p[1] - z) ** 2 > sep * sep)) break;
    }
    taken.push([x, z]);
    return [x, z];
  };

  /**
   * A spot against one of the four walls.
   *
   * FLETCHER: the crates used to be dropped anywhere in the room, and four
   * Brutes in a twelve-by-eight room with three crates in the middle of it
   * spend the fight shouldering into furniture. Shoved to the edges they do
   * the same job — cover, and something to put between you and a charge —
   * without standing in the middle of the only floor anybody is using.
   */
  const spotAtEdge = (sep, taken) => {
    const EDGE = 1.15;
    let x = 0, z = 0;
    for (let tries = 0; tries < 50; tries++) {
      const side = Math.floor(rand() * 4);
      const t = 0.14 + rand() * 0.72;
      if (side === 0) { x = room.x0 + EDGE; z = room.z0 + (room.z1 - room.z0) * t; }
      else if (side === 1) { x = room.x1 - EDGE; z = room.z0 + (room.z1 - room.z0) * t; }
      else if (side === 2) { z = room.z0 + EDGE; x = room.x0 + (room.x1 - room.x0) * t; }
      else { z = room.z1 - EDGE; x = room.x0 + (room.x1 - room.x0) * t; }
      if (taken.every((p) => (p[0] - x) ** 2 + (p[1] - z) ** 2 > sep * sep)) break;
    }
    taken.push([x, z]);
    return [x, z];
  };

  // Three smashed crates, kept apart so they don't read as one heap.
  const big = [];
  for (let i = 0; i < 3; i++) {
    const [x, z] = spotAtEdge(3.0, big);
    const w = 1.0 + rand() * 0.5, h = 0.75 + rand() * 0.4, d = 1.0 + rand() * 0.5;
    const c = brokenCrate(w, h, d, rand);
    c.position.set(x, 0, z);
    c.rotation.y = rand() * Math.PI * 2;
    // No roll. A crate rolled on its side lifts one bottom edge clear of the
    // floor and buries the other, and the sprung panels already say "wrecked"
    // without it.
    group.add(c);
    // Its real height goes with it, so it can be jumped onto and stood on
    // rather than being a wall with no top.
    colliders.push({ x, z, r: Math.max(w, d) * 0.6, h: h + 0.06 });
  }

  // Spilled contents and torn-off boards, scattered freely — this is the
  // mess around the crates, so it wants no minimum spacing at all.
  const loose = [];
  for (let i = 0; i < 14; i++) {
    const [x, z] = spotIn(0, loose);
    const kind = rand();
    let m;
    if (kind < 0.5) {                                  // board off a crate side
      m = new THREE.Mesh(new THREE.BoxGeometry(
        0.5 + rand() * 0.9, 0.06, 0.14 + rand() * 0.12),
        rand() > 0.5 ? scrapWood : scrapMetal);
      m.position.set(x, 0.03, z);
    } else if (kind < 0.78) {                          // canister, on its side
      const r = 0.1 + rand() * 0.05;
      m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3 + rand() * 0.2, 8),
                         scrapMetal);
      m.position.set(x, r, z);
      m.rotation.z = Math.PI / 2;
    } else {                                           // bar or rod
      m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7 + rand() * 0.5, 6),
                         scrapMetal);
      m.position.set(x, 0.04, z);
      m.rotation.z = Math.PI / 2;
    }
    m.rotation.y = rand() * Math.PI * 2;
    group.add(m);
  }

  // Brute plate shed in the fight.
  const armour = [];
  for (let i = 0; i < 2; i++) {
    const [x, z] = spotIn(2.5, armour);
    const p = brutePauldron(mats);
    // Left near enough upright that the spikes point up out of it rather
    // than down through the floor.
    p.position.set(x, 0.26, z);
    p.rotation.set((rand() - 0.5) * 0.5, rand() * Math.PI * 2, (rand() - 0.5) * 0.5);
    group.add(p);
  }
  for (let i = 0; i < 4; i++) {
    const [x, z] = spotIn(1.1, armour);
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.42 - rand() * 0.12, 0.1, 0.28 - rand() * 0.06),
      mats.armor);
    plate.position.set(x, 0.05, z);
    plate.rotation.set((rand() - 0.5) * 0.3, rand() * Math.PI * 2, (rand() - 0.5) * 0.3);
    group.add(plate);
  }
  for (let i = 0; i < 3; i++) {
    const [x, z] = spotIn(0.8, armour);
    const len = 0.26 + rand() * 0.1;
    const cone = new THREE.ConeGeometry(0.05, len, 4);
    cone.translate(0, len / 2, 0);
    const spike = new THREE.Mesh(cone, mats.bone);
    spike.position.set(x, 0.05, z);
    spike.rotation.set(0, rand() * Math.PI * 2, Math.PI / 2);
    group.add(spike);
  }

  group.traverse((o) => { if (o.isMesh) o.userData.isWall = true; });
  scene.add(group);
  return { group, colliders };
}

// ─── HUMAN DEBRIS ───────────────────────────────────────────
// What the garrison left behind: ammo crates, wrecked rifles, dropped mags
// and spent brass. Meant to sit alongside the alien dressing in each outpost,
// so it takes an `avoid` list of circles — webs, tentacles — and keeps clear
// of them rather than laying a rifle through one.

// One prototype, transformed per casing into a single merged mesh. Forty
// individual cylinders would be forty draw calls for a handful of triangles.
const CASING_PROTO = (() => {
  const g = new THREE.CylinderGeometry(0.012, 0.015, 0.048, 5);
  g.rotateZ(Math.PI / 2);
  return g.toNonIndexed().attributes.position.array;
})();

function ammoCrate(rand, mats) {
  const g = new THREE.Group();
  const W = 0.68, H = 0.32, D = 0.4;

  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), mats.box);
  body.position.y = H / 2;
  g.add(body);

  // Stencilled markings, proud of the face so they don't z-fight it.
  for (const zz of [D / 2 + 0.005, -D / 2 - 0.005]) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(W * 0.42, 0.05, 0.01),
                                mats.stencil);
    mark.position.set(-W * 0.12, H * 0.6, zz);
    g.add(mark);
  }

  // The lid swings on its back edge, so an open crate hinges instead of
  // floating at an angle above the box.
  const hinge = new THREE.Group();
  hinge.position.set(0, H, -D / 2);
  hinge.rotation.x = rand() > 0.45 ? -(0.8 + rand() * 0.8) : 0;
  g.add(hinge);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.05, D), mats.box);
  lid.position.z = D / 2;
  hinge.add(lid);

  // Mags packed upright inside, visible when the lid is up.
  if (hinge.rotation.x !== 0) {
    for (let i = 0; i < 4; i++) {
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.16, D * 0.6),
                                 mats.metal);
      mag.position.set(-W * 0.3 + i * 0.1, H * 0.78, (rand() - 0.5) * 0.05);
      mag.rotation.y = (rand() - 0.5) * 0.2;
      g.add(mag);
    }
  }
  return g;
}

// A pistol on the floor, built along +X with the muzzle leading. Small enough
// that it only reads as a sidearm next to something else for scale, which is
// why it goes by a body rather than on its own.
function pistol(mats) {
  const g = new THREE.Group();
  const Y = 0.028;
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.045, 0.035), mats.metal);
  slide.position.set(0, Y + 0.02, 0);
  g.add(slide);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.03, 0.032), mats.metal);
  frame.position.set(-0.01, Y - 0.005, 0);
  g.add(frame);
  // Lying on its side, so the grip runs out flat instead of into the floor.
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.028, 0.11), mats.stock);
  grip.position.set(-0.07, Y, 0.06);
  grip.rotation.y = -0.25;
  g.add(grip);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.022, 0.012), mats.metal);
  guard.position.set(-0.02, Y - 0.012, 0.035);
  g.add(guard);
  return g;
}

// A rifle on the floor, built along +X: stock, receiver, barrel, mag, grip.
// `snapped` breaks the barrel off and throws it clear.
function brokenRifle(rand, mats, snapped) {
  const g = new THREE.Group();
  const Y = 0.05;

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.085, 0.06), mats.stock);
  stock.position.set(-0.3, Y, 0);
  g.add(stock);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.07), mats.metal);
  body.position.set(0, Y, 0);
  g.add(body);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.055), mats.stock);
  grip.position.set(-0.08, Y - 0.03, 0.05);
  grip.rotation.x = 0.5;
  g.add(grip);

  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.045, 0.14), mats.metal);
  mag.position.set(0.04, Y - 0.02, 0.08);
  mag.rotation.x = -0.4;
  g.add(mag);

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.015, 0.42, 6), mats.metal);
  barrel.rotation.z = Math.PI / 2;
  if (snapped) {
    // Thrown forward and off to one side, still roughly in line with the gun.
    barrel.position.set(0.52 + rand() * 0.3, 0.017, (rand() - 0.5) * 0.5);
    barrel.rotation.y = (rand() - 0.5) * 1.2;
  } else {
    barrel.position.set(0.38, Y, 0);
  }
  g.add(barrel);
  return g;
}

export function buildHumanDebris(scene, room, avoid = [], seed = 3301) {
  const rand = rng(seed);
  const group = new THREE.Group();
  const mats = { box: M.ammoBox(), stencil: M.stencil(),
                 metal: M.gunMetal(), stock: M.gunStock() };

  const MARGIN = 1.4;
  const taken = [];
  // A spot clear of the alien dressing and of anything already dropped.
  const spot = (sep, clearance) => {
    let x = 0, z = 0;
    for (let tries = 0; tries < 50; tries++) {
      x = room.x0 + MARGIN + rand() * (room.x1 - room.x0 - MARGIN * 2);
      z = room.z0 + MARGIN + rand() * (room.z1 - room.z0 - MARGIN * 2);
      const offAliens = avoid.every((a) =>
        (a.x - x) ** 2 + (a.z - z) ** 2 > (a.r + clearance) ** 2);
      const offOthers = taken.every((p) =>
        (p[0] - x) ** 2 + (p[1] - z) ** 2 > sep * sep);
      if (offAliens && offOthers) break;
    }
    taken.push([x, z]);
    return [x, z];
  };

  for (let i = 0; i < 2; i++) {
    const [x, z] = spot(2.6, 0.9);
    const c = ammoCrate(rand, mats);
    c.position.set(x, 0, z);
    c.rotation.y = rand() * Math.PI * 2;
    group.add(c);
  }
  for (let i = 0; i < 2; i++) {
    const [x, z] = spot(1.8, 0.8);
    const r = brokenRifle(rand, mats, rand() > 0.5);
    r.position.set(x, 0, z);
    r.rotation.y = rand() * Math.PI * 2;
    r.rotation.z = (rand() - 0.5) * 0.12;
    group.add(r);
  }
  for (let i = 0; i < 3; i++) {
    const [x, z] = spot(0.7, 0.5);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.045, 0.15),
                               mats.metal);
    mag.position.set(x, 0.023, z);
    mag.rotation.y = rand() * Math.PI * 2;
    group.add(mag);
  }
  // A helmet, upturned where it rolled to a stop. The hemisphere runs from
  // y 0 up to its radius, so flipping it alone puts the whole dome under the
  // floor — it has to be lifted by the radius to sit on its crown. DoubleSide
  // because a bowl with no cap shows you its inside face from above.
  {
    const R = 0.15;
    const [x, z] = spot(0.9, 0.6);
    const mat = M.helmet();
    mat.side = THREE.DoubleSide;
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(R, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    shell.position.set(x, R * 0.96, z);
    shell.rotation.set(Math.PI + (rand() - 0.5) * 0.4, rand() * Math.PI * 2, 0);
    group.add(shell);
  }

  // Spent brass, clustered near the rifles rather than spread evenly — it
  // falls where someone stood and fired, not all over the room.
  const casings = [];
  for (let i = 0; i < 44; i++) {
    const from = taken[2 + Math.floor(rand() * 2)] || taken[0];
    const a = rand() * Math.PI * 2, d = rand() * 1.5;
    const cx = from[0] + Math.cos(a) * d, cz = from[1] + Math.sin(a) * d;
    const ang = rand() * Math.PI * 2, c = Math.cos(ang), sn = Math.sin(ang);
    for (let k = 0; k < CASING_PROTO.length; k += 3) {
      const px = CASING_PROTO[k], py = CASING_PROTO[k + 1], pz = CASING_PROTO[k + 2];
      casings.push(cx + px * c + pz * sn, py + 0.015, cz - px * sn + pz * c);
    }
  }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute(casings, 3));
  cg.computeVertexNormals();
  group.add(new THREE.Mesh(cg, M.brass()));

  group.traverse((o) => { if (o.isMesh) o.userData.isWall = true; });
  scene.add(group);
  return { group };
}

// ─── THE PRISON BLOCK ───────────────────────────────────────
// Three cells down one wall: two intact, one torn open from the inside.
//
// Every bar in the block is one merged mesh. A cell front is fifteen bars and
// three rails, so built as separate meshes the block alone would cost sixty
// draw calls before anything is in it.
const BAR_PROTO = (() => {
  const g = new THREE.CylinderGeometry(1, 1, 1, 6);
  g.translate(0, 0.5, 0);                     // grows up from its own origin
  return g.toNonIndexed().attributes.position.array;
})();

// One bar: a unit cylinder scaled to (r, len, r), tilted, then placed. The
// tilt is applied Z first then X, which is what lets a bar lean out of the
// wall and lie flat at the same time.
function pushBar(arr, px, py, pz, r, len, rx = 0, rz = 0) {
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  for (let i = 0; i < BAR_PROTO.length; i += 3) {
    const x = BAR_PROTO[i] * r, y = BAR_PROTO[i + 1] * len, z = BAR_PROTO[i + 2] * r;
    const x1 = x * cz - y * sz, y1 = x * sz + y * cz, z1 = z;
    arr.push(px + x1, py + y1 * cx - z1 * sx, pz + y1 * sx + z1 * cx);
  }
}

// A box pushed straight into a shared vertex array, for merging a lot of
// small rectangular parts — cage wire, hooks, rails — into one draw call.
// BOX_PROTO's vertices run -0.5..0.5, so w/h/d are the finished dimensions.
const BOX_PROTO = new THREE.BoxGeometry(1, 1, 1).toNonIndexed()
  .attributes.position.array;
function pushBox(arr, cx, cy, cz, w, h, d) {
  for (let i = 0; i < BOX_PROTO.length; i += 3) {
    arr.push(cx + BOX_PROTO[i] * w,
             cy + BOX_PROTO[i + 1] * h,
             cz + BOX_PROTO[i + 2] * d);
  }
}

const CELL = { W: 3.6, D: 2.6, T: 0.2, BAR_TOP: 3.0, R: 0.04, GAP: 0.24 };
// Of the three cells, the middle one is the one that failed — its door is
// lying in the walkway. Named here rather than inside the builder because
// prisonBrokenCell() below has to agree with it.
const BROKEN_CELL = 1;

/**
 * The inside of the torn-open cell, in world space.
 *
 * The prison works its layout out from CELL and the room's corner, and
 * anything that wants to put something INSIDE that cell needs exactly the
 * same arithmetic. Copying the numbers into the caller is how a cell and its
 * contents drift apart the first time the prison moves, so it lives here,
 * next to the bars it has to line up with.
 */
export function prisonBrokenCell(room) {
  const { W, D, T } = CELL;
  const z0 = room.z0 + 0.8 + BROKEN_CELL * (W + T);
  return { x0: room.x0, x1: room.x0 + D, z0, z1: z0 + W };
}

// A cot: welded frame, headboard, thin mattress and a pillow. Built with its
// length along Z so it drops straight against the cells' back wall.
const COT = { L: 1.9, W: 0.7, FH: 0.34, MT: 0.12 };

// A skeleton sat with its back against a wall, legs out in front. Built
// facing +X: the spine leans back toward -X and the legs run out along +X.
function skeleton(rand) {
  const g = new THREE.Group();
  const b = M.humanBone(), rag = M.rag();

  // Long bones are laid along +X from their own origin, the same way the
  // Watcher's legs are, so a joint is just the end of the previous bone.
  const limb = (len, r) => {
    const geo = new THREE.CylinderGeometry(r, r * 0.86, len, 5);
    geo.translate(0, len / 2, 0);
    geo.rotateZ(-Math.PI / 2);
    return new THREE.Mesh(geo, b);
  };
  const knuckle = (r) => new THREE.Mesh(new THREE.SphereGeometry(r, 5, 4), b);

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.13, 0.28), b);
  pelvis.position.set(0, 0.1, 0);
  g.add(pelvis);

  // Spine slumped back against the wall. Rotating about Z tips +Y toward -X,
  // which is exactly the lean we want, and everything parented to it —
  // ribs, skull, arms — comes along.
  const spine = new THREE.Group();
  spine.position.set(0, 0.15, 0);
  spine.rotation.z = 0.26;
  g.add(spine);

  for (let i = 0; i < 4; i++) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.09), b);
    v.position.y = 0.07 + i * 0.12;
    spine.add(v);
  }
  for (let i = 0; i < 5; i++) {
    const rr = 0.165 - i * 0.014;
    const geo = new THREE.TorusGeometry(rr, 0.013, 4, 9, Math.PI * 1.15);
    geo.rotateX(-Math.PI / 2);          // ring from upright to horizontal
    geo.rotateY(-Math.PI / 2);          // arc wrapping the chest, gap at the spine
    const rib = new THREE.Mesh(geo, b);
    rib.position.y = 0.16 + i * 0.1;
    spine.add(rib);
  }
  // What's left of the fatigues. Kept small and hung off the front of the
  // ribs — at full torso size it just boxed the ribcage in and you lost it.
  for (let i = 0; i < 2; i++) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.15, 0.17), rag);
    r.position.set(0.1, 0.26 + i * 0.19, (i - 0.5) * 0.2);
    r.rotation.x = (rand() - 0.5) * 0.5;
    r.rotation.z = (rand() - 0.5) * 0.3;
    spine.add(r);
  }

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.105, 7, 6), b);
  skull.scale.set(0.95, 1, 1.08);
  skull.position.set(0.02, 0.62, 0);
  skull.rotation.z = -0.5;              // chin down on the chest
  spine.add(skull);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.1), b);
  jaw.position.set(0.09, 0.55, 0);
  spine.add(jaw);

  for (const side of [-1, 1]) {
    // Arm hanging from the shoulder, forearm fallen into the lap.
    const sh = new THREE.Group();
    sh.position.set(0, 0.5, side * 0.15);
    spine.add(sh);
    sh.add(knuckle(0.035));
    const upper = limb(0.3, 0.028);
    upper.rotation.z = -1.35;           // straight down the ribs
    sh.add(upper);
    const elbow = new THREE.Group();
    elbow.position.set(0.3 * Math.cos(-1.35), 0.3 * Math.sin(-1.35), 0);
    sh.add(elbow);
    elbow.add(knuckle(0.03));
    const fore = limb(0.26, 0.022);
    fore.rotation.z = -0.5;
    fore.rotation.y = -side * 0.5;
    elbow.add(fore);

    // Leg straight out along the floor, knee slightly turned out.
    const hip = new THREE.Group();
    hip.position.set(0.04, 0.1, side * 0.1);
    g.add(hip);
    const femur = limb(0.44, 0.034);
    femur.rotation.y = -side * 0.22;
    hip.add(femur);
    const knee = new THREE.Group();
    knee.position.set(0.44 * Math.cos(side * 0.22), 0, -0.44 * Math.sin(-side * 0.22));
    hip.add(knee);
    knee.add(knuckle(0.035));
    const tibia = limb(0.42, 0.027);
    tibia.rotation.y = side * 0.14;
    knee.add(tibia);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.15), M.hullDk());
    boot.position.set(0.5, 0.02, 0);
    knee.add(boot);
  }

  // Helmet rolled off and come to rest beside it.
  const helmMat = M.helmet();
  helmMat.side = THREE.DoubleSide;
  const helm = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), helmMat);
  helm.position.set(0.25, 0.144, (rand() > 0.5 ? 1 : -1) * 0.42);
  helm.rotation.set(Math.PI + (rand() - 0.5) * 0.4, rand() * Math.PI, 0);
  g.add(helm);
  return g;
}

function cot(rand, mouldy) {
  const g = new THREE.Group();
  const { L, W, FH, MT } = COT;
  const steel = M.bunk();
  // Damp has got into the one nobody has been able to reach.
  const tick = new THREE.MeshLambertMaterial({
    color: mouldy ? 0x7c8270 : 0xc2c5bc });

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, FH, 0.06), steel);
      leg.position.set(sx * (W / 2 - 0.05), FH / 2, sz * (L / 2 - 0.08));
      g.add(leg);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, L), steel);
    rail.position.set(sx * (W / 2 - 0.04), FH - 0.035, 0);
    g.add(rail);
  }
  for (const sz of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.BoxGeometry(W, 0.07, 0.05), steel);
    end.position.set(0, FH - 0.035, sz * (L / 2 - 0.03));
    g.add(end);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(W, 0.3, 0.05), steel);
  head.position.set(0, FH + 0.15, -(L / 2 - 0.03));
  g.add(head);

  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(W - 0.08, MT, L - 0.12), tick);
  pad.position.y = FH + MT / 2;
  g.add(pad);
  const topY = FH + MT;

  const pillow = new THREE.Mesh(
    new THREE.BoxGeometry(W - 0.26, 0.09, 0.34), tick);
  pillow.position.set(0, topY + 0.045, -(L / 2 - 0.32));
  pillow.rotation.x = 0.06;
  g.add(pillow);

  if (mouldy) {
    // Blooms across the ticking. Stacked a fraction apart in y so overlapping
    // patches don't z-fight each other where they meet.
    const dark = new THREE.MeshBasicMaterial({
      color: 0x3b4a2e, transparent: true, opacity: 0.85, depthWrite: false });
    const pale = new THREE.MeshBasicMaterial({
      color: 0x6d7a4e, transparent: true, opacity: 0.5, depthWrite: false });
    for (let i = 0; i < 8; i++) {
      const patch = scorchPatch(rand, 0.14 + rand() * 0.3, 0.12 + rand() * 0.26,
                                rand() < 0.55 ? dark : pale);
      patch.position.set((rand() - 0.5) * (W - 0.22),
                         topY + 0.004 + i * 0.0006,
                         (rand() - 0.5) * (L - 0.34));
      g.add(patch);
    }
  }
  return g;
}

export function buildPrison(scene, room, seed = 6610) {
  const rand = rng(seed);
  const group = new THREE.Group();
  const colliders = [];
  const bars = [];                              // merged into one mesh at the end
  const wallMat = M.cellWall(), barMat = M.bar();

  const { W, D, T, BAR_TOP, R, GAP } = CELL;
  const FX = room.x0 + D;                       // the barred face of every cell
  const pitch = W + T;
  // Pushed off the far wall and stopped short of the doorway end.
  const z0 = room.z0 + 0.8;

  // Partition walls, one more than there are cells.
  for (let i = 0; i <= 3; i++) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(D, WALL_H, T), wallMat);
    const pz = z0 + i * pitch - T / 2;
    w.position.set(room.x0 + D / 2, WALL_H / 2, pz);
    group.add(w);
    for (let d = 0.3; d < D; d += 0.5) {
      colliders.push({ x: room.x0 + d, z: pz, r: 0.22 });
    }
  }

  for (let c = 0; c < 3; c++) {
    const cz = z0 + c * pitch;                  // this cell's front edge, low z
    const broken = c === BROKEN_CELL;

    // Header above the bars, so the cell doesn't open onto bare ceiling.
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(T, WALL_H - BAR_TOP, W), wallMat);
    head.position.set(FX, (WALL_H + BAR_TOP) / 2, cz + W / 2);
    group.add(head);

    // The door sits in the middle of the face; its edges get thicker bars.
    const doorW = 1.1, doorZ0 = cz + (W - doorW) / 2, doorZ1 = doorZ0 + doorW;
    const count = Math.floor(W / GAP);
    for (let i = 1; i < count; i++) {
      const bz = cz + i * (W / count);
      const inDoor = bz > doorZ0 && bz < doorZ1;
      if (broken) {
        // The door and the bars either side of it are gone; two of what is
        // left is bent out into the walkway.
        if (inDoor) continue;
        if (rand() < 0.3) continue;             // torn away
        if (rand() < 0.3) {
          // Bent: a straight lower half with the top half folded outward.
          const kneeY = 0.9 + rand() * 0.7, lean = -(0.5 + rand() * 0.6);
          pushBar(bars, FX, 0, bz, R, kneeY);
          pushBar(bars, FX, kneeY, bz, R, BAR_TOP - kneeY, 0, lean);
          continue;
        }
      }
      const edge = Math.abs(bz - doorZ0) < 0.08 || Math.abs(bz - doorZ1) < 0.08;
      pushBar(bars, FX, 0, bz, edge ? R * 1.7 : R, BAR_TOP);
    }
    // Frame uprights at the door edges, and rails across the whole face.
    for (const dz of [doorZ0, doorZ1]) {
      if (!broken) pushBar(bars, FX, 0, dz, R * 1.7, BAR_TOP);
    }
    for (const y of [0.08, 1.5, BAR_TOP - 0.08]) {
      if (broken && y > 0.5) {
        // Rails survive only outside the hole the thing came through.
        pushBar(bars, FX, y, cz, R * 1.2, doorZ0 - cz - 0.3, Math.PI / 2);
        pushBar(bars, FX, y, doorZ1 + 0.3, R * 1.2,
                cz + W - doorZ1 - 0.3, Math.PI / 2);
      } else {
        pushBar(bars, FX, y, cz, R * 1.2, W, Math.PI / 2);
      }
    }

    if (!broken) {
      // Lock plate, on the walkway side of the bars.
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.2), barMat);
      lock.position.set(FX + 0.09, 1.1, doorZ1 - 0.12);
      group.add(lock);
      // Solid across the face — this one still holds.
      for (let d = 0.25; d < W; d += 0.45) {
        colliders.push({ x: FX, z: cz + d, r: 0.2 });
      }
    } else {
      // Only the stretches of bar still standing stop you.
      for (let d = 0.25; d < W; d += 0.45) {
        const bz = cz + d;
        if (bz > doorZ0 - 0.35 && bz < doorZ1 + 0.35) continue;
        colliders.push({ x: FX, z: bz, r: 0.2 });
      }
    }

    // Cot against the back wall. The one in the cell nobody could get back
    // into has gone mouldy.
    const bed = cot(rand, broken);
    const bx = room.x0 + 0.52, bz = cz + W / 2;
    bed.position.set(bx, 0, bz);
    if (broken) bed.rotation.y = 0.12;          // shoved askew
    group.add(bed);
    if (broken) {
      // Only this cell can be walked into, so only this cot has to stop you.
      for (const dz of [-0.6, 0, 0.6]) colliders.push({ x: bx, z: bz + dz, r: 0.34 });
    }

    // Who was in here. One didn't last long enough to be found; the other
    // has been here a great deal longer.
    if (c === 0) {
      const bx2 = room.x0 + 1.6, bz2 = cz + W / 2 + 0.2;
      // Pool goes down first so the body sits on top of it.
      const pool = bloodPool(0.8, seed + 77);
      pool.position.set(bx2 - 0.05, 0, bz2 + 0.25);
      group.add(pool);
      const dead = deadBody('soldier', seed + 91);
      dead.position.set(bx2, 0, bz2);
      dead.rotation.y = 0.18;
      group.add(dead);
    } else if (c === 2) {
      const bones = skeleton(rand);
      // Back against the partition, so it isn't fighting the cot for the
      // one wall a sitting figure can lean on.
      bones.position.set(room.x0 + 1.45, 0, cz + 0.22);
      bones.rotation.y = -Math.PI / 2;
      group.add(bones);
    }
  }

  // The middle cell's door, wrenched off and dropped in the walkway.
  {
    const doorPts = [];
    const dw = 1.1, dh = 2.2;
    for (let i = 0; i <= 5; i++) pushBar(doorPts, 0, 0, i * (dw / 5), R, dh);
    for (const y of [0.05, dh - 0.05]) {
      pushBar(doorPts, 0, y, 0, R * 1.5, dw, Math.PI / 2);
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(doorPts, 3));
    dg.computeVertexNormals();
    const door = new THREE.Mesh(dg, barMat);
    // Laid flat, hinge end still near the cell it came out of.
    door.rotation.set(0, 0.5, -Math.PI / 2);
    door.position.set(FX + 1.5, R * 1.6, z0 + BROKEN_CELL * pitch + 0.3);
    group.add(door);
  }

  // Scorching on the floor where the cell gave way.
  // Opacity, not colour, is what decides how dark this lands: at 0.45 over a
  // white floor even near-black comes out mid-grey and reads as a rug.
  const burn = new THREE.MeshBasicMaterial({
    color: 0x16110e, transparent: true, opacity: 0.66, depthWrite: false });
  const mark = scorchPatch(rand, 2.4, 1.8, burn);
  mark.position.set(FX + 0.3, 0.012, z0 + BROKEN_CELL * pitch + W / 2);
  group.add(mark);

  // ── WHAT THE PRISONERS LEFT ───────────────────────────────
  // Decals on the flat faces of the block. A wall is addressed as (u, v) —
  // along it and up it — so the same code writes on the back wall and on a
  // partition without caring which axis either lies on.
  const dents = [], cracks = [], scratches = [];
  const quad = (arr, pl, u, v, len, thick, ang) => {
    const du = Math.cos(ang) * len / 2, dv = Math.sin(ang) * len / 2;
    const nu = -Math.sin(ang) * thick / 2, nv = Math.cos(ang) * thick / 2;
    const cs = [[u - du - nu, v - dv - nv], [u + du - nu, v + dv - nv],
                [u + du + nu, v + dv + nv], [u - du + nu, v - dv + nv]];
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const [cu, cv] = cs[i];
      if (pl.axis === 'x') arr.push(pl.pos + pl.off, cv, cu);
      else arr.push(cu, cv, pl.pos + pl.off);
    }
  };

  // A fist-sized dent: overlapping slabs make an irregular blotch, and a few
  // hairlines run out of it. One quad would just be a rectangle on the wall.
  function punch(pl, u, v, size) {
    for (let i = 0; i < 7; i++) {
      const sz = size * (0.55 + rand() * 0.6);
      quad(dents, pl, u + (rand() - 0.5) * size * 0.45,
           v + (rand() - 0.5) * size * 0.45, sz, sz * (0.55 + rand() * 0.45),
           rand() * Math.PI);
    }
    for (let i = 0; i < 5; i++) {
      const a = rand() * Math.PI * 2, len = size * (1.0 + rand() * 1.9);
      quad(cracks, pl, u + Math.cos(a) * len / 2, v + Math.sin(a) * len / 2,
           len, 0.014, a);
    }
  }

  // Five-barred gates: four uprights and a slash across them.
  function tally(pl, u0, v0, days) {
    // Sized to be legible from the walkway. At 1cm strokes these were sub-
    // pixel from outside the bars, which is the only place you can stand.
    const PER_ROW = 5, GW = 0.3, RH = 0.3, S = 0.06;
    for (let g = 0; g * 5 < days; g++) {
      const bu = u0 + (g % PER_ROW) * GW, bv = v0 - Math.floor(g / PER_ROW) * RH;
      const n = Math.min(5, days - g * 5);
      for (let i = 0; i < Math.min(n, 4); i++) {
        quad(scratches, pl, bu + i * S, bv, 0.2, 0.018, Math.PI / 2);
      }
      if (n === 5) {
        quad(scratches, pl, bu + S * 1.5, bv, 0.31, 0.018, Math.PI / 2 - 0.75);
      }
    }
  }

  const back = { axis: 'x', pos: room.x0, off: 0.05 };   // cell back wall
  const DAYS = [34, 11, 61];                             // per cell
  for (let c = 0; c < 3; c++) {
    const cz = z0 + c * pitch;
    tally(back, cz + 0.5, 1.5, DAYS[c]);
    // Partition faces looking into this cell.
    const sides = [{ axis: 'z', pos: cz, off: 0.02 },
                   { axis: 'z', pos: cz + W, off: -0.02 }];
    const hits = c === BROKEN_CELL ? 7 : 4;                   // this one fought
    for (let i = 0; i < hits; i++) {
      const pl = rand() < 0.45 ? back : sides[rand() < 0.5 ? 0 : 1];
      const u = pl === back ? cz + 0.6 + rand() * (W - 1.2)
                            : room.x0 + 0.5 + rand() * (D - 1.0);
      punch(pl, u, 1.15 + rand() * 0.55, 0.15 + rand() * 0.09);
    }
  }
  // And a few out in the walkway, on the wall opposite the cells.
  const far = { axis: 'x', pos: room.x1, off: -0.05 };
  for (let i = 0; i < 5; i++) {
    punch(far, room.z0 + 1.5 + rand() * (room.z1 - room.z0 - 3),
          1.2 + rand() * 0.5, 0.15 + rand() * 0.08);
  }

  const decal = (pts, color, opacity) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false,
      side: THREE.DoubleSide }));
  };
  // A dent is a shadow, not a hole — grey and faint. The cracks and the
  // scratches are cut into the surface, so those go dark.
  group.add(decal(dents, 0x6d757f, 0.55));
  group.add(decal(cracks, 0x3a4047, 0.88));
  group.add(decal(scratches, 0x30343b, 0.95));

  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(bars, 3));
  bg.computeVertexNormals();
  group.add(new THREE.Mesh(bg, barMat));

  group.traverse((o) => { if (o.isMesh) o.userData.isWall = true; });
  scene.add(group);
  return { group, colliders };
}

// ─── THE ARMORY ─────────────────────────────────────────────
// Lockers down one wall, a weapon rack on another, and a bench where the
// rifles were serviced. The lockers have been standing in damp air a long
// time, so they carry rust.

// A rifle stood on its butt in a rack, built upward from the floor.
function rackRifle(rand, mats) {
  const g = new THREE.Group();
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.07), mats.stock);
  stock.position.y = 0.15;
  g.add(stock);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.4, 0.075), mats.metal);
  body.position.y = 0.5;
  g.add(body);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.05), mats.metal);
  mag.position.set(0, 0.42, 0.08);
  mag.rotation.x = -0.25;
  g.add(mag);
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.014, 0.46, 6), mats.metal);
  barrel.position.y = 0.93;
  g.add(barrel);
  g.rotation.z = (rand() - 0.5) * 0.12;        // not quite square in the slot
  return g;
}

export function buildArmory(scene, room, seed = 1174) {
  const rand = rng(seed);
  const group = new THREE.Group();
  const colliders = [];
  const steel = M.locker(), top = M.benchTop(), peg = M.pegboard();
  const mats = { metal: M.gunMetal(), stock: M.gunStock() };

  // Rust blooms on a flat face, written in whatever space the caller is
  // working in: (u, v) run across and up the face, `pos` is its offset along
  // the third axis. Used here in a door's own local space, so the rust swings
  // with the door instead of hanging in the air where the door used to be.
  function rustPatch(arr, pos, u, v, size) {
    for (let i = 0; i < 5; i++) {
      const w = size * (0.4 + rand() * 0.55), h = size * (0.35 + rand() * 0.6);
      // Tight jitter. Spread wide, the blobs drift off the edge of the panel
      // and hang in the air beside it, since this plane has no bounds.
      const du = u + (rand() - 0.5) * size * 0.35,
            dv = v + (rand() - 0.5) * size * 0.35;
      const ang = rand() * Math.PI;
      const cu = Math.cos(ang) * w / 2, sv = Math.sin(ang) * w / 2;
      const nu = -Math.sin(ang) * h / 2, nv = Math.cos(ang) * h / 2;
      const cs = [[du - cu - nu, dv - sv - nv], [du + cu - nu, dv + sv - nv],
                  [du + cu + nu, dv + sv + nv], [du - cu + nu, dv - sv + nv]];
      for (const k of [0, 1, 2, 0, 2, 3]) arr.push(pos, cs[k][1], cs[k][0]);
    }
  }
  const rustMat = new THREE.MeshBasicMaterial({
    color: 0x6b3d1d, transparent: true, opacity: 0.42, depthWrite: false,
    side: THREE.DoubleSide });

  // ── LOCKERS, down the east wall ───────────────────────────
  const LW = 0.62, LH = 1.9, LD = 0.5, PITCH = 0.74;
  const lockerX = room.x1 - LD / 2 - 0.05;
  for (let i = 0; i < 6; i++) {
    const lz = room.z0 + 2.4 + i * PITCH;
    const open = rand() < 0.45;

    if (open) {
      // Hollow carcass: back, sides, top and bottom. A solid box would just
      // show you a slab where the inside of the locker ought to be.
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.04, LH, LW), steel);
      back.position.set(lockerX + LD / 2, LH / 2, lz);
      group.add(back);
      for (const sz of [-1, 1]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(LD, LH, 0.04), steel);
        side.position.set(lockerX, LH / 2, lz + sz * LW / 2);
        group.add(side);
      }
      for (const [yy, th] of [[LH - 0.02, 0.04], [0.02, 0.04]]) {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(LD, th, LW), steel);
        cap.position.set(lockerX, yy, lz);
        group.add(cap);
      }
      const shelf = new THREE.Mesh(
        new THREE.BoxGeometry(LD - 0.08, 0.03, LW - 0.08), steel);
      shelf.position.set(lockerX, LH - 0.45, lz);
      group.add(shelf);
      const coat = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.8, LW - 0.22), M.fatigue());
      coat.position.set(lockerX + 0.08, LH - 0.95, lz + (rand() - 0.5) * 0.1);
      group.add(coat);
      if (rand() < 0.6) {
        const spill = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.1, 0.22), M.helmet());
        spill.position.set(lockerX - LD / 2 - 0.35, 0.05, lz + (rand() - 0.5) * 0.4);
        spill.rotation.y = rand() * Math.PI;
        group.add(spill);
      }
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(LD, LH, LW), steel);
      body.position.set(lockerX, LH / 2, lz);
      group.add(body);
    }

    // The door hangs on its own pivot at one edge, so "open" swings it out
    // into the room instead of sliding it sideways off the cabinet.
    const hinge = new THREE.Group();
    hinge.position.set(lockerX - LD / 2 - 0.02, LH / 2, lz - LW / 2);
    hinge.rotation.y = open ? -(0.9 + rand() * 0.7) : 0;
    group.add(hinge);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.04, LH - 0.06, LW), steel);
    door.position.z = LW / 2;
    hinge.add(door);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.04), mats.metal);
    handle.position.set(-0.04, -0.1, LW - 0.12);
    hinge.add(handle);
    for (const vy of [LH / 2 - 0.25, LH / 2 - 0.38]) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, LW * 0.6), mats.metal);
      slat.position.set(-0.03, vy, LW / 2);
      hinge.add(slat);
    }

    // Rust on the door's outer face, heaviest along the bottom where water
    // sat. Centres stay a patch-width inside the panel so nothing bleeds off.
    const pts = [];
    for (let r = 0; r < 7; r++) {
      const size = 0.07 + rand() * 0.1;
      const u = size + rand() * (LW - size * 2);
      const v = -(LH / 2 - 0.1) + Math.pow(rand(), 2.4) * (LH - 0.2);
      rustPatch(pts, -0.045, u, v, size);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    hinge.add(new THREE.Mesh(rg, rustMat));

    colliders.push({ x: lockerX, z: lz, r: 0.42 });
  }

  // ── WEAPON RACK, on the west wall north of the door ───────
  {
    const rz0 = room.z0 + 0.6, rLen = 3.0, rx = room.x0 + 0.24;
    const frameMat = steel;
    for (const zz of [rz0, rz0 + rLen]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.25, 0.07), frameMat);
      post.position.set(rx, 0.62, zz);
      group.add(post);
    }
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, rLen), frameMat);
    tray.position.set(rx, 0.1, rz0 + rLen / 2);
    group.add(tray);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, rLen), frameMat);
    rail.position.set(rx + 0.1, 1.0, rz0 + rLen / 2);
    group.add(rail);

    // Slots, most of them emptied on the way out.
    const SLOTS = 9;
    for (let i = 0; i < SLOTS; i++) {
      const sz = rz0 + (i + 0.5) * (rLen / SLOTS);
      const divider = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.03), frameMat);
      divider.position.set(rx, 0.18, sz - rLen / SLOTS / 2);
      group.add(divider);
      if (rand() < 0.4) {
        const rifle = rackRifle(rand, mats);
        rifle.position.set(rx + 0.02, 0.13, sz);
        rifle.rotation.y = Math.PI / 2;
        group.add(rifle);
      }
    }
    for (let d = 0.3; d < rLen; d += 0.5) {
      colliders.push({ x: rx, z: rz0 + d, r: 0.2 });
    }
  }

  // ── WORKBENCH, along the north wall ───────────────────────
  {
    const BL = 4.0, BD = 0.85, BH = 0.92;
    const bx = room.x0 + 3.2, bz = room.z0 + BD / 2 + 0.06;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(BL, 0.08, BD), top);
    slab.position.set(bx, BH, bz);
    group.add(slab);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, BH, 0.08), steel);
        leg.position.set(bx + sx * (BL / 2 - 0.15), BH / 2, bz + sz * (BD / 2 - 0.12));
        group.add(leg);
      }
    }
    const under = new THREE.Mesh(new THREE.BoxGeometry(BL - 0.4, 0.05, BD - 0.3), steel);
    under.position.set(bx, 0.3, bz);
    group.add(under);

    // Pegboard with the shadows of tools that are no longer on it.
    const board = new THREE.Mesh(new THREE.BoxGeometry(BL, 1.15, 0.05), peg);
    board.position.set(bx, BH + 0.65, room.z0 + 0.04);
    group.add(board);
    const marks = [];
    for (let i = 0; i < 11; i++) {
      const w = 0.05 + rand() * 0.06, h = 0.14 + rand() * 0.3;
      const mx = bx - BL / 2 + 0.3 + rand() * (BL - 0.6);
      const my = BH + 0.3 + rand() * 0.85;
      const ang = (rand() - 0.5) * 0.9;
      const cu = Math.cos(ang + Math.PI / 2) * h / 2, sv = Math.sin(ang + Math.PI / 2) * h / 2;
      const nu = -Math.sin(ang + Math.PI / 2) * w / 2, nv = Math.cos(ang + Math.PI / 2) * w / 2;
      const cs = [[mx - cu - nu, my - sv - nv], [mx + cu - nu, my + sv - nv],
                  [mx + cu + nu, my + sv + nv], [mx - cu + nu, my - sv + nv]];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        marks.push(cs[k][0], cs[k][1], room.z0 + 0.075);
      }
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.Float32BufferAttribute(marks, 3));
    group.add(new THREE.Mesh(mg, new THREE.MeshBasicMaterial({
      color: 0x3f444a, transparent: true, opacity: 0.55, depthWrite: false,
      side: THREE.DoubleSide })));

    // Vice bolted to one end.
    const vice = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.3), mats.metal);
    vice.position.set(bx - BL / 2 + 0.45, BH + 0.12, bz);
    group.add(vice);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.3), mats.metal);
    jaw.position.set(bx - BL / 2 + 0.3, BH + 0.14, bz);
    group.add(jaw);

    // Parts laid out mid-strip: receivers, barrels, mags, a stripped rifle.
    for (let i = 0; i < 8; i++) {
      const px = bx - BL / 2 + 0.9 + rand() * (BL - 1.5);
      const pz = bz + (rand() - 0.5) * (BD - 0.3);
      const kind = rand();
      let part;
      if (kind < 0.4) {
        part = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.4, 6), mats.metal);
        part.rotation.z = Math.PI / 2;
        part.position.set(px, BH + 0.06, pz);
      } else if (kind < 0.7) {
        part = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.07), mats.metal);
        part.position.set(px, BH + 0.08, pz);
      } else {
        part = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.15), mats.metal);
        part.position.set(px, BH + 0.07, pz);
      }
      part.rotation.y = rand() * Math.PI;
      group.add(part);
    }
    const stripped = brokenRifle(rand, mats, true);
    stripped.position.set(bx + BL / 2 - 1.1, BH + 0.04, bz);
    stripped.rotation.y = 0.2;
    group.add(stripped);

    for (let d = -BL / 2 + 0.3; d < BL / 2; d += 0.5) {
      colliders.push({ x: bx + d, z: bz, r: 0.4 });
    }
  }

  // ── THE WEAPONS CAGE, south-east corner ───────────────────
  // The secure rack: mesh walls and a gate that has been prised off its
  // latch and left standing wide. The heavy weapons are gone. This is the
  // one piece of story in the room — somebody reached the armory first and
  // took everything worth carrying before the rest of them got here.
  //
  // Only the two faces that front the room get wire. The other two sit flat
  // against the room's own walls, where nobody can ever see them.
  {
    const CX0 = room.x1 - 3.5, CX1 = room.x1 - 0.14;
    const CZ0 = room.z0 + 0.14, CZ1 = room.z0 + 1.8;
    const CH = 2.25, WIRE = 0.022, PITCH = 0.17;
    const GX0 = CX0 + 0.5, GX1 = GX0 + 1.05;        // the gate's gap

    const wire = [];
    const meshX = (a, b, z) => {
      for (let x = a; x <= b + 1e-6; x += PITCH) pushBox(wire, x, CH / 2, z, WIRE, CH, WIRE);
      for (let y = PITCH; y < CH; y += PITCH) pushBox(wire, (a + b) / 2, y, z, b - a, WIRE, WIRE);
    };
    const meshZ = (a, b, x) => {
      for (let z = a; z <= b + 1e-6; z += PITCH) pushBox(wire, x, CH / 2, z, WIRE, CH, WIRE);
      for (let y = PITCH; y < CH; y += PITCH) pushBox(wire, x, y, (a + b) / 2, WIRE, WIRE, b - a);
    };
    meshX(CX0, GX0, CZ1);
    meshX(GX1, CX1, CZ1);
    meshZ(CZ0, CZ1, CX0);
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
    wg.computeVertexNormals();
    group.add(new THREE.Mesh(wg, M.bar()));

    // Corner posts and a top rail, so the mesh reads as hung on a frame.
    for (const [px, pz] of [[CX0, CZ0], [CX0, CZ1], [CX1, CZ1], [CX1, CZ0]]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, CH, 0.08), steel);
      post.position.set(px, CH / 2, pz);
      group.add(post);
    }
    for (const [a, b, ax] of [[CX0, CX1, 'x'], [CZ0, CZ1, 'z']]) {
      const rail = new THREE.Mesh(ax === 'x'
        ? new THREE.BoxGeometry(b - a, 0.07, 0.07)
        : new THREE.BoxGeometry(0.07, 0.07, b - a), steel);
      rail.position.set(ax === 'x' ? (a + b) / 2 : CX0, CH,
                        ax === 'x' ? CZ1 : (a + b) / 2);
      group.add(rail);
    }

    // The gate swings on its right-hand edge. Positive yaw carries the free
    // edge to +Z, i.e. out into the room rather than back through the wall.
    const gate = new THREE.Group();
    gate.position.set(GX1, 0, CZ1);
    gate.rotation.y = 2.55;      // flung past square, back along the cage face
    group.add(gate);
    const GW = GX1 - GX0, GH = CH - 0.12;
    const gw = [];
    for (let x = -GW; x <= 1e-6; x += PITCH) pushBox(gw, x, GH / 2, 0, WIRE, GH, WIRE);
    for (let y = PITCH; y < GH; y += PITCH) pushBox(gw, -GW / 2, y, 0, GW, WIRE, WIRE);
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(gw, 3));
    gg.computeVertexNormals();
    gate.add(new THREE.Mesh(gg, M.bar()));
    for (const [gx, gy, gwid, ghi] of [[-GW / 2, 0.03, GW, 0.06],
                                       [-GW / 2, GH, GW, 0.06],
                                       [-0.03, GH / 2, 0.06, GH],
                                       [-GW + 0.03, GH / 2, 0.06, GH]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(gwid, ghi, 0.05), steel);
      b.position.set(gx, gy, 0);
      gate.add(b);
    }
    // The hasp, bent back where it was levered off.
    const hasp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.03), mats.metal);
    hasp.position.set(-GW + 0.06, 1.05, 0.05);
    hasp.rotation.z = 0.7;
    gate.add(hasp);

    // What did it: bolt cutters, dropped on the floor by the gate.
    {
      const bc = new THREE.Group();
      for (const sz of [-1, 1]) {
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.035, 0.035),
                                      M.fatigue());
        handle.position.set(0.3, 0.02, sz * 0.055);
        handle.rotation.y = sz * 0.07;
        bc.add(handle);
        const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.04, 0.035), mats.metal);
        jaw.position.set(-0.08, 0.02, sz * 0.03);
        jaw.rotation.y = -sz * 0.12;
        bc.add(jaw);
      }
      bc.position.set(GX0 + 0.35, 0, CZ1 + 0.62);
      bc.rotation.y = 2.3;
      group.add(bc);
    }

    // Inside: a low rack with most of its brackets empty.
    const irz = CZ0 + 0.34;
    const itray = new THREE.Mesh(new THREE.BoxGeometry(CX1 - CX0 - 0.5, 0.06, 0.34), steel);
    itray.position.set((CX0 + CX1) / 2, 0.1, irz);
    group.add(itray);
    const irail = new THREE.Mesh(new THREE.BoxGeometry(CX1 - CX0 - 0.5, 0.07, 0.09), steel);
    irail.position.set((CX0 + CX1) / 2, 1.05, irz - 0.1);
    group.add(irail);
    for (let i = 0; i < 6; i++) {
      const sx = CX0 + 0.5 + i * ((CX1 - CX0 - 1.0) / 5);
      const brk = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.3), steel);
      brk.position.set(sx, 0.2, irz);
      group.add(brk);
      // Two left. Everything else went out of the door.
      if (i === 1 || i === 4) {
        const r = rackRifle(rand, mats);
        r.position.set(sx + 0.06, 0.13, irz);
        r.rotation.y = Math.PI / 2;
        group.add(r);
      }
    }

    // A crate of ammunition they couldn't carry, left on the cage floor.
    const left = ammoCrate(rand, { box: M.ammoBox(), stencil: M.stencil(), metal: mats.metal });
    left.position.set(CX0 + 0.75, 0, CZ1 - 0.45);
    left.rotation.y = 0.4;
    group.add(left);

    // Stencilled plate over the cage, on the wall behind it.
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.34, 0.04), M.hullDk());
    plate.position.set((CX0 + CX1) / 2, CH + 0.42, room.z0 + 0.06);
    group.add(plate);
    const letters = [];
    for (let i = 0; i < 7; i++) {
      pushBox(letters, (CX0 + CX1) / 2 - 0.56 + i * 0.19, CH + 0.42, room.z0 + 0.09,
              0.1, 0.15, 0.012);
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(letters, 3));
    lg.computeVertexNormals();
    group.add(new THREE.Mesh(lg, M.stencil()));

    // You can walk in through the gate, and nowhere else.
    for (let x = CX0; x <= CX1; x += 0.4) {
      if (x > GX0 - 0.2 && x < GX1 + 0.2) continue;
      colliders.push({ x, z: CZ1, r: 0.18 });
    }
    for (let z = CZ0; z <= CZ1; z += 0.4) colliders.push({ x: CX0, z, r: 0.18 });
    for (let t = 0.2; t <= GW; t += 0.35) {
      colliders.push({ x: GX1 - t * Math.cos(gate.rotation.y),
                       z: CZ1 + t * Math.sin(gate.rotation.y), r: 0.14 });
    }
  }

  // ── AMMUNITION, stacked along the north wall ──────────────
  // Next to the door you come in by, which is where you would stack it.
  {
    const crateMats = { box: M.ammoBox(), stencil: M.stencil(), metal: mats.metal };
    // An open-lidded crate can't have another one sitting on it, so whatever
    // ammoCrate decided to open gets sorted to the top of its own stack.
    const lidAngle = (c) => {
      const h = c.children.find((ch) => ch.isGroup);
      return h ? Math.abs(h.rotation.x) : 0;
    };
    const az = room.z1 - 0.42;
    for (const [sx, n] of [[room.x0 + 6.5, 3], [room.x0 + 7.6, 2], [room.x0 + 8.7, 2]]) {
      const made = [];
      for (let i = 0; i < n; i++) made.push(ammoCrate(rand, crateMats));
      made.sort((a, b) => lidAngle(a) - lidAngle(b));
      made.forEach((c, i) => {
        c.position.set(sx + (rand() - 0.5) * 0.1, i * 0.37, az + (rand() - 0.5) * 0.08);
        c.rotation.y = (rand() - 0.5) * 0.26;
        group.add(c);
      });
      colliders.push({ x: sx, z: az, r: 0.42 });
    }

    // One dragged off the stack and tipped over. Tipping it puts the body's
    // width along world Y, so it has to be lifted by half a width to sit on
    // the floor instead of sinking into it.
    const spilt = ammoCrate(rand, crateMats);
    spilt.position.set(room.x0 + 5.5, 0.34, room.z1 - 1.45);
    spilt.rotation.set(0, 0.5, Math.PI / 2);
    group.add(spilt);

    // Loose rounds thrown clear of it.
    // pushBox is axis-aligned, so rounds laid with it all point the same way
    // and read as a grid. pushBar takes a heading: rx of a quarter turn lays
    // the bar flat, and rz then spins it to face anywhere on the floor.
    const brass = [];
    for (let i = 0; i < 52; i++) {
      const a = rand() * Math.PI * 2, d = 0.25 + Math.pow(rand(), 0.6) * 1.5;
      pushBar(brass, room.x0 + 5.5 + Math.cos(a) * d, 0.013,
              room.z1 - 1.45 + Math.sin(a) * d * 0.8,
              0.012, 0.055, Math.PI / 2, rand() * Math.PI * 2);
    }
    const bg2 = new THREE.BufferGeometry();
    bg2.setAttribute('position', new THREE.Float32BufferAttribute(brass, 3));
    bg2.computeVertexNormals();
    group.add(new THREE.Mesh(bg2, M.brass()));
  }

  // ── BODY ARMOUR, west wall north of the doorway ───────────
  // Hooks with most of their kit already taken, which says the same thing
  // the cage does without repeating it.
  {
    const hx = room.x0 + 0.12, z0 = room.z1 - 1.1, LEN = 4.3;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, LEN), steel);
    rail.position.set(hx, 1.82, z0 - LEN / 2);
    group.add(rail);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, LEN), steel);
    shelf.position.set(hx + 0.1, 2.12, z0 - LEN / 2);
    group.add(shelf);

    const hooks = [];
    for (let i = 0; i < 7; i++) {
      const hz = z0 - 0.3 - i * ((LEN - 0.6) / 6);
      pushBox(hooks, hx + 0.06, 1.75, hz, 0.06, 0.2, 0.03);
      if (i === 1 || i === 3 || i === 6) {
        // A plate carrier: front panel, back panel, shoulder straps over
        // the rail. Hung, not worn, so it hangs straight down.
        const v = new THREE.Group();
        v.position.set(hx + 0.14, 1.64, hz);
        for (const sx of [-0.07, 0.07]) {
          const panel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.36), M.fatigue());
          panel.position.set(sx, -0.26, 0);
          v.add(panel);
        }
        for (const sz of [-0.11, 0.11]) {
          const strap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.07), M.fatigue());
          strap.position.set(-0.03, 0.0, sz);
          v.add(strap);
        }
        const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.2), M.hullDk());
        pouch.position.set(0.12, -0.3, 0);
        v.add(pouch);
        group.add(v);
      }
    }
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.Float32BufferAttribute(hooks, 3));
    hg.computeVertexNormals();
    group.add(new THREE.Mesh(hg, steel));

    // Helmets on the shelf. DoubleSide: the shelf is above eye level, so you
    // look up into the open underside of the dome.
    const helmMat = new THREE.MeshLambertMaterial({
      color: 0x2f3a2c, side: THREE.DoubleSide });
    for (const hz of [z0 - 0.9, z0 - 2.6]) {
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), helmMat);
      dome.position.set(hx + 0.12, 2.15, hz);
      group.add(dome);
    }
  }

  // ── ONE CEILING FIXTURE ───────────────────────────────────
  // The painted-grid lighting puts its lamps on a 10-cell lattice, and the
  // armory falls between them — which is why this room reads darker than the
  // rest of the station. One more point light is 1/24th on top of a shader
  // cost the whole level already pays, and it buys back the entire room.
  {
    const fx = room.x0 + 4.4, fz = (room.z0 + room.z1) / 2 + 1.5;
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 2.2), steel);
    housing.position.set(fx, WALL_H - 0.14, fz);
    group.add(housing);
    const tube = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 2.0),
      new THREE.MeshBasicMaterial({ color: 0xe8f0ff }));
    tube.position.set(fx, WALL_H - 0.21, fz);
    group.add(tube);
    const lamp = new THREE.PointLight(0xdbe6f7, 0.8, 13, 1.5);
    lamp.position.set(fx, WALL_H - 0.5, fz);
    group.add(lamp);
  }

  group.traverse((o) => { if (o.isMesh) o.userData.isWall = true; });
  scene.add(group);
  return { group, colliders };
}

// ─── THE ALIEN BATTLE BOARD ─────────────────────────────────
// A briefing panel the aliens left up: columns of their own script, and a
// diagram of how they took the helicopter down.
//
// The whole thing is drawn flat in the board's own XY plane and the group is
// then placed against a wall. Working in board coordinates means a glyph is
// just (x, y) on a page — no wall-axis arithmetic anywhere in the drawing.
//
// `at` is where it hangs: {x, y, z} and `rotY`, the turn that points the
// board's face (its +Z) into the room.
export function buildAlienBoard(scene, at, seed = 2187) {
  const rand = rng(seed);
  const group = new THREE.Group();
  const W = 5.2, H = 3.0, FACE = 0.07;

  const panel = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.12),
    new THREE.MeshLambertMaterial({ color: 0x1b2129 }));
  panel.position.z = -0.06;
  group.add(panel);
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x2c3340 });
  for (const [bw, bh, bx, by] of [[W + 0.14, 0.1, 0, H / 2], [W + 0.14, 0.1, 0, -H / 2],
                                  [0.1, H + 0.14, -W / 2, 0], [0.1, H + 0.14, W / 2, 0]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.16), frameMat);
    bar.position.set(bx, by, -0.02);
    group.add(bar);
  }

  const script = [], plan = [], attack = [];
  const stroke = (arr, x, y, len, thick, ang) => {
    const dx = Math.cos(ang) * len / 2, dy = Math.sin(ang) * len / 2;
    const nx = -Math.sin(ang) * thick / 2, ny = Math.cos(ang) * thick / 2;
    const cs = [[x - dx - nx, y - dy - ny], [x + dx - nx, y + dy - ny],
                [x + dx + nx, y + dy + ny], [x - dx + nx, y - dy + ny]];
    for (const k of [0, 1, 2, 0, 2, 3]) arr.push(cs[k][0], cs[k][1], FACE);
  };
  const ring = (arr, cx, cy, r, thick, segs = 14) => {
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
      const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r;
      const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
      stroke(arr, (x0 + x1) / 2, (y0 + y1) / 2, Math.hypot(x1 - x0, y1 - y0) * 1.1,
             thick, Math.atan2(y1 - y0, x1 - x0));
    }
  };
  const arrow = (arr, x0, y0, x1, y1, thick) => {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
    stroke(arr, (x0 + x1) / 2, (y0 + y1) / 2, len, thick, ang);
    const hl = Math.min(0.22, len * 0.3);
    for (const off of [2.5, -2.5]) {
      const a = ang + off;
      stroke(arr, x1 + Math.cos(a) * hl / 2, y1 + Math.sin(a) * hl / 2, hl, thick, a);
    }
  };
  const dashed = (arr, x0, y0, x1, y1, thick) => {
    const n = 7;
    for (let i = 0; i < n; i += 2) {
      const t0 = i / n, t1 = (i + 1) / n;
      const ax = x0 + (x1 - x0) * t0, ay = y0 + (y1 - y0) * t0;
      const bx = x0 + (x1 - x0) * t1, by = y0 + (y1 - y0) * t1;
      stroke(arr, (ax + bx) / 2, (ay + by) / 2, Math.hypot(bx - ax, by - ay),
             thick, Math.atan2(by - ay, bx - ax));
    }
  };

  // One character of the script: a few strokes locked to four angles, which
  // is what keeps a random scatter reading as writing rather than scribble.
  const ANGLES = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4];
  function glyph(cx, cy, w, h, thick) {
    const n = 3 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      const a = ANGLES[Math.floor(rand() * ANGLES.length)];
      const span = a === 0 ? w : a === Math.PI / 2 ? h : Math.min(w, h) * 1.25;
      stroke(script, cx + (rand() - 0.5) * w * 0.5, cy + (rand() - 0.5) * h * 0.5,
             span * (0.45 + rand() * 0.55), thick, a);
    }
    if (rand() < 0.35) {
      stroke(script, cx + (rand() - 0.5) * w * 0.6, cy + (rand() - 0.5) * h * 0.6,
             thick * 2.4, thick * 2.4, 0);                    // a punctuating dot
    }
  }

  // Header across the top, then a column of smaller text down the left.
  for (let i = 0; i < 9; i++) {
    glyph(-W / 2 + 0.45 + i * 0.44, H / 2 - 0.33, 0.3, 0.34, 0.035);
  }
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 2; col++) {
      glyph(-W / 2 + 0.36 + col * 0.34, H / 2 - 0.95 - row * 0.3, 0.22, 0.22, 0.026);
    }
  }
  for (let i = 0; i < 11; i++) {
    glyph(-W / 2 + 0.4 + i * 0.38, -H / 2 + 0.26, 0.24, 0.24, 0.026);
  }

  // ── THE DIAGRAM ───────────────────────────────────────────
  // Nothing in the diagram may stray past the frame. These clamp anything
  // placed by hand back inside it — the staging rings were originally set by
  // eye and two of them ended up hanging in the air off the right edge.
  const PAD = 0.3;
  const inX = (v) => Math.max(-W / 2 + PAD, Math.min(W / 2 - PAD, v));
  const inY = (v) => Math.max(-H / 2 + PAD, Math.min(H / 2 - PAD, v));

  // The helicopter, dead centre of their plan.
  const HX = 0.6, HY = 0.02, T = 0.032;
  stroke(plan, HX, HY, 1.0, T, 0);                       // fuselage spine
  stroke(plan, HX - 0.1, HY + 0.13, 0.55, T, 0);         // cabin roof
  stroke(plan, HX - 0.1, HY - 0.13, 0.55, T, 0);         // cabin floor
  stroke(plan, HX - 0.38, HY, 0.27, T, Math.PI / 2);     // nose
  stroke(plan, HX + 0.5, HY + 0.1, 0.22, T, Math.PI / 2);  // tail fin
  stroke(plan, HX, HY + 0.3, 1.5, T, 0);                 // rotor disc, edge on
  stroke(plan, HX, HY + 0.22, 0.16, T, Math.PI / 2);     // mast
  const BOX = 0.74;
  ring(plan, HX, HY, BOX, 0.018, 20);                     // the kill box
  // The helicopter's own inbound track, running into the kill box. Kept in
  // the clear band between the left column of script and the diagram.
  dashed(plan, -1.25, 0.72, HX - 0.95, HY + 0.32, 0.02);

  // Four attack runs converging on it, each from its own staging point.
  // The fourth run comes in from behind. Kept clear of the bottom line of
  // script — dropped any lower, its staging ring sits on top of the writing.
  // Staging points, kept inside the frame and clear of the lines of script
  // that run along the top and bottom.
  const FROM = [[1.95, 0.95], [2.02, 0.0], [1.85, -0.8], [-1.15, -0.72]];
  for (const [rx, ry] of FROM) {
    const fx = inX(rx), fy = inY(ry);
    const d = Math.hypot(HX - fx, HY - fy), ux = (HX - fx) / d, uy = (HY - fy) / d;
    ring(attack, fx, fy, 0.14, 0.022, 10);
    // Arrow stops at the edge of the kill box rather than in its middle.
    arrow(attack, fx + ux * 0.2, fy + uy * 0.2,
          HX - ux * (BOX + 0.08), HY - uy * (BOX + 0.08), 0.028);
  }

  const layer = (pts, color) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color, side: THREE.DoubleSide }));
  };
  group.add(layer(script, 0x5fe08a));    // their writing
  group.add(layer(plan, 0x74d2ff));      // what they were looking at
  group.add(layer(attack, 0xff7038));    // what they did to it

  // A hooded lamp over the board. The glyphs are unlit so they always burn
  // bright, but the panel and frame are Lambert — without a light of their own
  // they sink into the dark end of the room and the whole board reads as a
  // shadow on the wall rather than as a thing you walk over to read.
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.42),
    new THREE.MeshLambertMaterial({ color: 0x39414d }));
  hood.position.set(0, H / 2 + 0.3, 0.3);
  hood.rotation.x = 0.4;
  group.add(hood);
  const bulb = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 0.16),
    new THREE.MeshBasicMaterial({ color: 0xffe2b0 }));
  bulb.position.set(0, H / 2 + 0.23, 0.42);
  group.add(bulb);
  const lamp = new THREE.PointLight(0xffe0b4, 1.5, 7, 1.4);
  lamp.position.set(0, H / 2 - 0.1, 1.0);
  group.add(lamp);

  group.position.set(at.x, at.y, at.z);
  group.rotation.y = at.rotY || 0;
  group.traverse((o) => { if (o.isMesh) o.userData.isWall = true; });
  scene.add(group);
  return { group };
}


// ─── THE ALIEN PODS ─────────────────────────────────────────
// Four specimen tanks along the room's long wall, one of each kind of alien
// held in green fluid. They face the way you come in, smallest to largest.
//
// All four come from the workshop models, including the Watcher, which has no
// fightable counterpart in the game yet at all.

const POD = { R: 0.62, BASE_H: 0.28, GLASS_H: 2.0, CAP_H: 0.26 };

export function buildAlienPods(scene, room, seed = 8808) {
  const rand = rng(seed);
  const group = new THREE.Group();
  const colliders = [];

  const shell = M.metal(), dark = M.hullDk();
  // depthWrite off and a late renderOrder: the glass and the specimen inside
  // it sit at almost the same depth, so left to sort themselves out by
  // distance the glass flickers in front of and behind the creature.
  const glassMat = new THREE.MeshLambertMaterial({
    color: 0x2fbd6a, transparent: true, opacity: 0.3,
    side: THREE.DoubleSide, depthWrite: false });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x6effa8 });
  const fluidMote = new THREE.MeshBasicMaterial({ color: 0x9dffc4 });

  const INNER_H = POD.GLASS_H - 0.3, INNER_W = (POD.R - 0.13) * 2;
  // Fitting every specimen to the same box would make a Crawler and a Brute
  // the same size. Each one fills its own fraction of the tank instead, so
  // the row still reads smallest to largest.
  const SPECIMENS = [
    { make: buildCrawler, fill: 0.95 },
    { make: buildFloater, fill: 0.88 },
    // The workshop builds the Watcher with its lids sealed and irises them
    // open in its animation loop. Nothing animates a specimen, so left alone
    // it reads as a blank ball — and the glowing iris is the only thing that
    // names it. The workshop's own formula is
    //   rotation.x = PI/2 - (shutClosed + open * shutterOpen)
    // with shutClosed 0.3 and shutterOpen 1.15, so this is about 70% open.
    { make: buildWatcher, fill: 0.95,
      pose: (m) => m.userData.shutters.forEach((sh) => { sh.rotation.x = 0.47; }) },
    { make: buildBrute,   fill: 1.0 },
  ];

  // All four along the north wall: the room's long unbroken run, and the
  // one you are looking straight at coming in from the south-west corner.
  const pz = room.z0 + 1.25;
  SPECIMENS.forEach((spec, i) => {
    const px = room.x0 + 2.9 + i * 2.75;
    const pod = new THREE.Group();
    pod.position.set(px, 0, pz);
    group.add(pod);

    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.78, POD.BASE_H, 12), shell);
    plinth.position.y = POD.BASE_H / 2;
    pod.add(plinth);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.78, 0.72, POD.CAP_H, 12), shell);
    cap.position.y = POD.BASE_H + POD.GLASS_H + POD.CAP_H / 2;
    pod.add(cap);

    // Struts on the diagonals, so none of them stands across the front.
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k / 4) * Math.PI * 2;
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, POD.GLASS_H, 0.07), dark);
      strut.position.set(Math.cos(a) * (POD.R + 0.03), POD.BASE_H + POD.GLASS_H / 2,
                         Math.sin(a) * (POD.R + 0.03));
      pod.add(strut);
    }

    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(POD.R, POD.R, POD.GLASS_H, 16, 1, true), glassMat);
    glass.position.y = POD.BASE_H + POD.GLASS_H / 2;
    glass.renderOrder = 3;
    pod.add(glass);

    // Lit from the floor of the tank and again from the lid.
    for (const [gy, gr] of [[POD.BASE_H + 0.04, 0.56], [POD.BASE_H + POD.GLASS_H - 0.05, 0.5]]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(gr, gr, 0.05, 16), glowMat);
      ring.position.y = gy;
      pod.add(ring);
    }

    // Particulate hanging in the fluid.
    const motes = [];
    for (let m = 0; m < 14; m++) {
      const a = rand() * Math.PI * 2, d = rand() * (POD.R - 0.12);
      pushBox(motes, Math.cos(a) * d, POD.BASE_H + 0.15 + rand() * (POD.GLASS_H - 0.3),
              Math.sin(a) * d, 0.022, 0.022, 0.022);
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.Float32BufferAttribute(motes, 3));
    mg.computeVertexNormals();
    pod.add(new THREE.Mesh(mg, fluidMote));

    // The specimen, scaled from its own measured size rather than a guess, so
    // changing an alien's model can't leave it poking through the glass.
    const holder = new THREE.Group();
    const model = spec.make();
    // Pose before measuring: opening the Watcher's lids changes its extents.
    if (spec.pose) spec.pose(model);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const k = spec.fill * Math.min(INNER_H / size.y,
                                   INNER_W / Math.max(size.x, size.z));
    model.scale.setScalar(k);
    model.position.set(-c.x * k, -c.y * k, -c.z * k);
    holder.add(model);
    holder.position.y = POD.BASE_H + POD.GLASS_H / 2;
    pod.add(holder);

    // Feed pipes from the lid into the ceiling.
    for (let k2 = 0; k2 < 3; k2++) {
      const a = (k2 / 3) * Math.PI * 2 + 0.5;
      const top = POD.BASE_H + POD.GLASS_H + POD.CAP_H;
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, WALL_H - top, 6), dark);
      pipe.position.set(Math.cos(a) * 0.4, (top + WALL_H) / 2, Math.sin(a) * 0.4);
      pod.add(pipe);
    }

    // Control panel on the front of the plinth, tipped up to be read.
    const panel = new THREE.Group();
    panel.position.set(0, 0.46, 0.66);
    panel.rotation.x = -0.6;
    pod.add(panel);
    panel.add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.28, 0.05), dark));
    const glyphs = [];
    for (let r = 0; r < 3; r++) {
      for (let col = 0; col < 3; col++) {
        if (rand() < 0.3) continue;
        pushBox(glyphs, -0.13 + col * 0.13, 0.08 - r * 0.08, 0.03,
                0.04 + rand() * 0.05, 0.02, 0.012);
      }
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(glyphs, 3));
    gg.computeVertexNormals();
    panel.add(new THREE.Mesh(gg, glowMat));

    colliders.push({ x: px, z: pz, r: 0.85 });
  });

  // ── THE ONE THAT DIDN'T HOLD ───────────────────────────────
  //
  // FLETCHER'S GUIDE:
  // A containment pod three times the size of the specimen tanks, stood
  // opposite the door so it is the thing you walk in on. They tried to keep
  // the boss in it. The glass is gone — not cracked, GONE, blown outward
  // with the shards lying in a fan pointing away from it, which is the whole
  // story told in one detail: whatever did that was on the inside.
  //
  // Everything else follows from that. The cap is wrenched up off its seat,
  // two of the struts are bent outward, the restraint rings that were meant
  // to hold something down are snapped open, and the fluid it was kept in is
  // across the floor.
  {
    // Dead centre of the room now that there is a room to be central in —
    // the three working walls are taken, and this is the thing you walk
    // round rather than the thing in a corner.
    // Centre of the WALKABLE floor, which is not the centre of the room —
    // three of the four walls have something standing against them, and the
    // first attempt at centring put this between the door and the tanks.
    const BX = room.x0 + 5.8, BZ = room.z0 + 6.0;
    const BR = 1.7, BASE = 0.55, GLASS = 3.0, CAP = 0.45;
    const big = new THREE.Group();
    big.position.set(BX, 0, BZ);
    group.add(big);

    // Plinth: armoured, not the thin steel ring the specimen tanks stand on.
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(BR + 0.3, BR + 0.45, BASE, 14), shell);
    plinth.position.y = BASE / 2;
    big.add(plinth);
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(BR + 0.12, BR + 0.12, 0.16, 14), dark);
    rim.position.y = BASE + 0.05;
    big.add(rim);

    // Struts. Two of them bowed outward where it came through.
    const BENT = [1, 4];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      const bent = BENT.includes(k);
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, GLASS * (bent ? 0.82 : 1), 0.16), dark);
      const lean = bent ? 0.38 : 0;
      strut.position.set(Math.cos(a) * (BR + 0.1) * (1 + lean * 0.5),
                         BASE + GLASS / 2 * (bent ? 0.82 : 1),
                         Math.sin(a) * (BR + 0.1) * (1 + lean * 0.5));
      strut.rotation.z = -Math.cos(a) * lean;
      strut.rotation.x = Math.sin(a) * lean;
      big.add(strut);
    }

    // What is left of the glass: stumps standing in the frame, no cylinder.
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      if (rand() < 0.45) continue;                 // most of it is on the floor
      const h = 0.25 + rand() * 0.8;
      const shard = new THREE.Mesh(
        new THREE.ConeGeometry(0.12 + rand() * 0.1, h, 3), glassMat);
      shard.position.set(Math.cos(a) * BR, BASE + 0.1 + h / 2, Math.sin(a) * BR);
      shard.rotation.y = a;
      shard.rotation.z = (rand() - 0.5) * 0.3;
      shard.renderOrder = 3;
      big.add(shard);
    }

    // The cap, lifted off its seat and dropped back crooked.
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(BR + 0.2, BR + 0.05, CAP, 14), shell);
    cap.position.set(0.35, BASE + GLASS + CAP / 2 - 0.1, 0.2);
    cap.rotation.z = 0.19;
    cap.rotation.x = -0.1;
    big.add(cap);

    // Torn feed lines, hanging rather than running to the ceiling.
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.7;
      const len = 0.5 + rand() * 1.1;
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, len, 6), dark);
      pipe.position.set(Math.cos(a) * 0.7, WALL_H - len / 2, Math.sin(a) * 0.7);
      pipe.rotation.z = (rand() - 0.5) * 0.5;
      big.add(pipe);
    }

    // The restraints. Snapped open, which is the detail that says this held
    // something rather than displayed it. One material for all four, not one
    // each.
    //
    // On a column, because hanging in mid-air they read as a symbol rather
    // than as hardware — cuffs are bolted to something, and the something is
    // what you were meant to be chained to.
    const cuffMat = new THREE.MeshLambertMaterial({ color: 0x3c4249 });
    const spine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.2, GLASS * 0.86, 8), cuffMat);
    spine.position.y = BASE + GLASS * 0.43;
    big.add(spine);
    // Sheared off at the top, where whatever was in here took it with them.
    const shear = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.17, 0.5, 8), cuffMat);
    shear.position.set(0.1, BASE + GLASS * 0.86 + 0.2, 0.06);
    shear.rotation.z = 0.35;
    big.add(shear);
    for (const ry of [BASE + 0.6, BASE + 1.7]) {
      for (const half of [-1, 1]) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.5, 0.09, 5, 8, Math.PI * 0.8), cuffMat);
        ring.position.set(half * 0.55, ry, 0);
        ring.rotation.y = Math.PI / 2;
        ring.rotation.z = half > 0 ? 0.5 : Math.PI - 0.5;
        big.add(ring);
      }
    }

    // Shards and spilled fluid, thrown clear on the side the door is on.
    for (let k = 0; k < 22; k++) {
      const a = rand() * Math.PI * 2;
      const dd = BR + 0.4 + rand() * 2.6;
      const piece = new THREE.Mesh(
        new THREE.BoxGeometry(0.1 + rand() * 0.22, 0.03, 0.08 + rand() * 0.16),
        glassMat);
      piece.position.set(Math.cos(a) * dd, 0.02, Math.sin(a) * dd);
      piece.rotation.y = rand() * Math.PI;
      piece.rotation.x = (rand() - 0.5) * 0.25;
      piece.renderOrder = 3;
      big.add(piece);
    }
    // Clear of the plinth, which is over two units across — the first
    // version put every puddle underneath it, where none of them could be
    // seen at all.
    for (let k = 0; k < 4; k++) {
      const a = rand() * Math.PI * 2, dd = BR + 0.7 + rand() * 1.8;
      const spill = new THREE.Mesh(
        new THREE.CircleGeometry(0.8 + rand() * 0.7, 12),
        new THREE.MeshBasicMaterial({ color: 0x2f7d4a, transparent: true,
                                      opacity: 0.5 }));
      spill.rotation.x = -Math.PI / 2;
      spill.position.set(Math.cos(a) * dd, 0.012 + k * 0.002, Math.sin(a) * dd);
      big.add(spill);
    }

    // A toppled control stand, shoved aside and lying on the floor rather
    // than standing between the door and the pod — which is where the first
    // version put it, blocking the one view of this that matters.
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.55), shell);
    stand.position.set(-0.3, 0.14, BR + 1.3);
    stand.rotation.z = 0.5;
    stand.rotation.y = 0.7;
    big.add(stand);
    const standLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 0.16), dark);
    standLeg.position.set(0.15, 0.3, BR + 1.55);
    standLeg.rotation.z = 1.2;
    big.add(standLeg);

    // It gets its own collider ring — one circle round a pod this wide would
    // wall off most of the room.
    colliders.push({ x: BX, z: BZ, r: BR + 0.35 });
  }

  // ── The two who were studying them ────────────────────────
  // One by the broken pod, one back at the row of tanks. They are in lab
  // coats rather than armour: nobody in this room was dressed for what
  // happened in it, and the specimen cards on the wall are in their
  // handwriting.
  for (const [bx, bz, rot, kind, pool] of [
    [room.x0 + 5.4, room.z0 + 5.3, 2.4, 'scientist', 1.0],
    [room.x0 + 2.2, room.z0 + 3.2, -0.9, 'scientist', 0.85],
  ]) {
    const blood = bloodPool(pool, seed + Math.round(bx * 13));
    blood.position.set(bx - Math.sin(rot) * 0.5, 0, bz - Math.cos(rot) * 0.5);
    group.add(blood);
    const body = deadBody(kind, seed + Math.round(bz * 7));
    body.position.set(bx, 0, bz);
    body.rotation.y = rot;
    group.add(body);
  }

  // One light for the row. The grid lamps are on a 10-cell lattice and this
  // room falls between them, same as the armory did — and the tanks are the
  // only thing in here worth seeing.
  const lamp = new THREE.PointLight(0x8affc0, 1.0, 11, 1.4);
  lamp.position.set(room.x0 + 5.0, 2.3, pz + 2.0);
  group.add(lamp);

  group.traverse((o) => { if (o.isMesh) o.userData.isWall = true; });
  scene.add(group);
  return { group, colliders };
}


// ─── THE STUDY SCREEN ───────────────────────────────────────
// A terminal on the wall facing the pods, holding the notes the station kept
// on what is in them. Everything else in the game is built from boxes, but a
// wall of findings has to be readable, so this one is a canvas drawn with
// real text and hung on the wall as a texture.
//
// The log at the bottom is the point of the room: they were studying these
// things, the notes stop mid-entry, and Pod 3's lids are open in the tank.

const STUDY = [
  { pod: 'POD 1', name: 'CRAWLER', cls: 'pack hunter', mass: '41 kg',
    threat: 'MODERATE', status: 'SEDATED', state: 'ok',
    bars: [['SEDATION', 0.84], ['FEED LINE', 0.76], ['ACTIVITY', 0.14]],
    notes: 'Flanks. Will not come at you straight. Closes the last four metres in one jump.' },
  { pod: 'POD 2', name: 'FLOATER', cls: 'psionic', mass: '23 kg',
    threat: 'HIGH', status: 'DOSE DOUBLED', state: 'warn',
    bars: [['SEDATION', 0.49], ['FEED LINE', 0.63], ['CORE OUTPUT', 0.97]],
    notes: 'No muscle anywhere in it. Holds altitude with nothing. Cabin pressure spikes a half second before it fires.' },
  { pod: 'POD 3', name: 'WATCHER', cls: 'ranged', mass: '58 kg',
    threat: 'SEVERE', status: 'AWAKE', state: 'bad',
    bars: [['SEDATION', 0.08], ['FEED LINE', 0.31], ['ACTIVITY', 0.92]],
    notes: 'The eye is the only soft tissue on it. One clean hit is lethal. It knows, and keeps the lids shut until it fires.' },
  { pod: 'POD 4', name: 'BRUTE', cls: 'shock', mass: '310 kg',
    threat: 'SEVERE', status: 'SEDATED / RESTRAINED', state: 'ok',
    bars: [['SEDATION', 0.91], ['FEED LINE', 0.80], ['ACTIVITY', 0.09]],
    notes: 'Plate is grown, not worn. Commits to a charge and cannot turn out of it. Give it a wall.' },
];

const LOG = [
  ['DAY 36', 'All four sedated. Feed lines stable. Bay sealed overnight.'],
  ['DAY 38', 'Pod 2 core output up 400%. Sedation dose doubled.'],
  ['DAY 41', 'Pod 3 lids open on morning check. Nobody opened them.'],
  ['DAY 42', 'Re-sealed Pod 3. Lids open again within the hour. It is awake and it is'],
];

function studyCanvas() {
  const CW = 1024, CH = 640;
  const cv = document.createElement('canvas');
  cv.width = CW; cv.height = CH;
  const x = cv.getContext('2d');

  const GREEN = '#6effa8', DIM = '#2f8f5c', WARN = '#ffb347';
  x.fillStyle = '#04130c';
  x.fillRect(0, 0, CW, CH);

  // Header
  x.fillStyle = '#0c2f1d';
  x.fillRect(0, 0, CW, 54);
  x.fillStyle = GREEN;
  x.font = 'bold 26px "Courier New", monospace';
  x.fillText('SPECIMEN STUDY — CONTAINMENT BAY 4', 22, 36);
  x.font = '18px "Courier New", monospace';
  x.fillStyle = DIM;
  x.textAlign = 'right';
  x.fillText('STATION FALO / XENOBIOLOGY', CW - 22, 35);
  x.textAlign = 'left';

  // Four columns, one per tank, in the order they stand along the wall.
  const COLW = (CW - 44) / 4;
  STUDY.forEach((s, i) => {
    const cx = 22 + i * COLW, w = COLW - 18;
    x.strokeStyle = '#174a31';
    x.lineWidth = 2;
    x.strokeRect(cx, 74, w, 300);

    x.fillStyle = DIM;
    x.font = '15px "Courier New", monospace';
    x.fillText(s.pod, cx + 12, 100);
    x.fillStyle = GREEN;
    x.font = 'bold 27px "Courier New", monospace';
    x.fillText(s.name, cx + 12, 130);

    x.font = '15px "Courier New", monospace';
    x.fillStyle = DIM;
    x.fillText('CLASS ' + s.cls, cx + 12, 156);
    x.fillText('MASS  ' + s.mass, cx + 12, 176);
    x.fillStyle = s.threat === 'SEVERE' ? WARN : GREEN;
    x.fillText('THREAT ' + s.threat, cx + 12, 196);

    // Findings, wrapped to the column by measuring as we go.
    x.fillStyle = GREEN;
    x.font = '15px "Courier New", monospace';
    let line = '', ly = 224;
    for (const word of s.notes.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (x.measureText(t).width > w - 24) { x.fillText(line, cx + 12, ly); line = word; ly += 19; }
      else line = t;
    }
    if (line) x.fillText(line, cx + 12, ly);
  });

  // The log.
  x.strokeStyle = '#174a31';
  x.beginPath(); x.moveTo(22, 400); x.lineTo(CW - 22, 400); x.stroke();
  x.fillStyle = DIM;
  x.font = '16px "Courier New", monospace';
  x.fillText('BAY LOG', 22, 428);
  let ly = 462;
  LOG.forEach(([day, text], i) => {
    const last = i === LOG.length - 1;
    x.fillStyle = last ? WARN : DIM;
    x.font = '17px "Courier New", monospace';
    x.fillText(day, 22, ly);
    x.fillStyle = last ? WARN : GREEN;
    x.fillText(text, 120, ly);
    ly += 30;
  });
  // The entry stops here. A cursor still blinking on it says more than a
  // finished sentence would.
  x.fillStyle = WARN;
  x.fillRect(120 + x.measureText(LOG[LOG.length - 1][1]).width + 8, ly - 44, 11, 18);

  // CRT scanlines, drawn over everything.
  x.fillStyle = 'rgba(0,0,0,0.16)';
  for (let sy = 0; sy < CH; sy += 4) x.fillRect(0, sy, CW, 2);

  const tex = new THREE.CanvasTexture(cv);
  // 640 is not a power of two. Without these the texture is resized or comes
  // back blank depending on the driver.
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  return tex;
}

export function buildStudyScreen(scene, room) {
  const group = new THREE.Group();
  const W = 3.2, H = 2.0;
  const shell = M.metal(), dark = M.hullDk();

  const bezel = new THREE.Mesh(new THREE.BoxGeometry(W + 0.22, H + 0.22, 0.12), dark);
  group.add(bezel);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W, H),
    new THREE.MeshBasicMaterial({ map: studyCanvas() }));
  face.position.z = 0.07;
  group.add(face);

  // Mounts holding it off the wall.
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.22), shell);
    arm.position.set(sx * (W / 2 - 0.2), H / 2 - 0.1, -0.12);
    group.add(arm);
  }

  // A console shelf under it, so the screen reads as something worked at
  // rather than a poster.
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.07, 0.52), shell);
  shelf.position.set(0, -H / 2 - 0.42, 0.22);
  group.add(shelf);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.06), dark);
    leg.position.set(sx * W * 0.34, -H / 2 - 0.66, 0.1);
    group.add(leg);
  }
  const keys = new THREE.Mesh(new THREE.BoxGeometry(W * 0.44, 0.04, 0.26), dark);
  keys.position.set(-0.15, -H / 2 - 0.36, 0.26);
  keys.rotation.x = -0.12;
  group.add(keys);
  const lamps = [];
  for (let i = 0; i < 5; i++) {
    pushBox(lamps, W * 0.26 + i * 0.07, -H / 2 - 0.36, 0.3, 0.035, 0.02, 0.02);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lamps, 3));
  lg.computeVertexNormals();
  group.add(new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ color: 0x6effa8 })));

  // The east wall, facing back across the room at the tanks.
  const SX = room.x1 - 0.08, SZ = room.z0 + 6.0;
  group.position.set(SX, 1.85, SZ);
  group.rotation.y = -Math.PI / 2;
  group.traverse((o) => { if (o.isMesh) o.userData.isWall = true; });
  scene.add(group);

  // And the chair in front of it.
  //
  // FLETCHER: it is empty, and it is turned away from the screen it was
  // pulled up to. A chair square-on to a desk reads as furniture. One left
  // at an angle, with nobody in it, reads as somebody who got up.
  const chair = commandChair(true);
  // Off to one side of the screen rather than square in front of it: dead
  // centre, the chair back covers the half of the readout you want to read.
  chair.position.set(room.x1 - 2.4, 0, SZ + 1.15);
  chair.rotation.y = -0.52;
  scene.add(chair);

  return { group, colliders: [
    { x: SX - 0.5, z: SZ, r: 0.7 },
    { x: room.x1 - 2.4, z: SZ + 1.15, r: 0.45 },
  ] };
}

// ─── THE WORKSTATIONS ───────────────────────────────────────
// FLETCHER'S GUIDE:
// Four desks along the south wall, one per tank, each with that specimen's
// own readout on it. They are the reason the big screen on the east wall is
// a summary: somebody sat at each of these watching ONE of them, and the
// state those four screens are in is the story of what went wrong here —
// two sedated and quiet, one with its dose doubled and its core output
// nearly off the scale, and one that is simply awake.
//
// The numbers come from the same STUDY table the big screen reads, so the
// two walls cannot disagree about what is in the tanks.

/** Text that wraps itself, because a notes field does not fit on one line. */
function wrapText(x, text, left, top, width, lineH) {
  const words = String(text).split(' ');
  let line = '', y = top;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (x.measureText(test).width > width && line) {
      x.fillText(line, left, y); line = word; y += lineH;
    } else line = test;
  }
  if (line) x.fillText(line, left, y);
  return y;
}

function stationCanvas(s) {
  return crtPanel(512, 384, (x, w) => {
    const bad = s.state === 'bad', warn = s.state === 'warn';
    const hue = bad ? BAD : warn ? WARN : GREEN;

    x.fillStyle = bad ? '#3a0f0c' : warn ? '#3a2a0c' : '#0c2f1d';
    x.fillRect(0, 0, w, 40);
    x.fillStyle = hue;
    x.font = 'bold 22px "Courier New", monospace';
    x.fillText(s.pod + '  ' + s.name, 14, 28);

    // The status line, which is the thing you are meant to read first.
    x.fillStyle = DIM;
    x.font = '15px "Courier New", monospace';
    x.fillText('STATUS', 14, 74);
    x.fillStyle = hue;
    x.font = 'bold 26px "Courier New", monospace';
    x.fillText(s.status, 14, 102);

    x.font = '16px "Courier New", monospace';
    let y = 140;
    for (const [k, v] of [['CLASS', s.cls], ['MASS', s.mass], ['THREAT', s.threat]]) {
      x.fillStyle = DIM; x.fillText(k, 14, y);
      x.fillStyle = k === 'THREAT' ? hue : GREEN;
      x.fillText(String(v).toUpperCase(), 150, y);
      y += 24;
    }

    // Bars. A number is a number; a bar says at a glance which one is wrong.
    y += 10;
    for (const [label, frac] of s.bars) {
      x.fillStyle = DIM;
      x.font = '14px "Courier New", monospace';
      x.fillText(label, 14, y);
      x.strokeStyle = '#174a31'; x.lineWidth = 2;
      x.strokeRect(150, y - 12, 330, 14);
      x.fillStyle = frac > 0.9 ? BAD : frac < 0.2 ? BAD : frac < 0.55 ? WARN : GREEN;
      x.fillRect(152, y - 10, 326 * Math.max(0.02, frac), 10);
      y += 26;
    }

    x.fillStyle = DIM;
    x.font = '14px "Courier New", monospace';
    wrapText(x, s.notes, 14, y + 12, w - 28, 19);
  });
}

export function buildWorkstations(scene, room) {
  const group = new THREE.Group();
  const colliders = [];
  const shell = M.metal(), dark = M.hullDk();
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x6effa8 });

  STUDY.forEach((s, i) => {
    const x = room.x0 + 3.6 + i * 2.9;
    const z = room.z1 - 1.05;              // backs to the south wall
    const desk = new THREE.Group();
    desk.position.set(x, 0, z);
    group.add(desk);

    const top = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 0.8), shell);
    top.position.y = 0.78;
    desk.add(top);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.78, 0.7), dark);
      leg.position.set(sx * 0.95, 0.39, 0);
      desk.add(leg);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 0.06), dark);
    back.position.set(0, 0.48, 0.34);
    desk.add(back);

    // The screen, tipped back and facing out into the room.
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.92, 0.07), dark);
    bezel.position.set(0, 1.38, 0.2);
    bezel.rotation.x = 0.15;
    desk.add(bezel);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8),
      new THREE.MeshBasicMaterial({ map: stationCanvas(s) }));
    face.position.set(0, 1.38, 0.155);
    face.rotation.x = 0.15;
    face.rotation.y = Math.PI;             // the canvas faces -z, into the room
    desk.add(face);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.12), shell);
    stand.position.set(0, 1.0, 0.24);
    desk.add(stand);

    // Keyboard, and a lamp that is still on.
    const keys = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.04, 0.26), dark);
    keys.position.set(-0.1, 0.84, -0.18);
    keys.rotation.x = -0.08;
    desk.add(keys);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.1), lampMat);
    lamp.position.set(0.72, 0.86, -0.1);
    desk.add(lamp);

    // A stool, pushed in at three of them and shoved aside at the Watcher's.
    const stool = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.07, 10), dark);
    seat.position.y = 0.52;
    stool.add(seat);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.7;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.52, 5), shell);
      leg.position.set(Math.cos(a) * 0.14, 0.26, Math.sin(a) * 0.14);
      leg.rotation.z = -Math.cos(a) * 0.12;
      leg.rotation.x = Math.sin(a) * 0.12;
      stool.add(leg);
    }
    const shoved = s.state === 'bad';
    stool.position.set(shoved ? 0.9 : 0.05, 0, -1.0 + (shoved ? -0.35 : 0));
    stool.rotation.y = shoved ? 0.6 : 0;
    desk.add(stool);

    // The plate on the wall above it, so the desk is that one's desk even
    // with the screen dark.
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.26, 0.05), dark);
    plate.position.set(x, 2.3, room.z1 - 0.1);
    group.add(plate);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.2),
      new THREE.MeshBasicMaterial({
        map: crtPanel(256, 56, (c, w2) => {
          c.fillStyle = '#6effa8';
          c.font = 'bold 26px "Courier New", monospace';
          c.textAlign = 'center';
          c.fillText(s.pod + ' / ' + s.name, w2 / 2, 38);
        }),
      }));
    label.position.set(x, 2.3, room.z1 - 0.14);
    label.rotation.y = Math.PI;
    group.add(label);

    colliders.push({ x, z: z + 0.1, r: 0.95, h: 0.86 });   // vault the desk
  });

  group.traverse((o) => { if (o.isMesh) o.userData.isWall = true; });
  scene.add(group);
  return { group, colliders };
}


// ─── THE CONTROL ROOM ───────────────────────────────────────
// You come through the Locked Door heading east, so the wall you walk at is
// the room's 24m unbroken east run. A window onto space along the top of it,
// the station's main control station filling the whole wall underneath, and
// three command chairs at the middle of it with their crew still in them.

// A screen, drawn as text on a canvas. Everything else in the level is built
// from boxes, but a readout has to be read.
function crtPanel(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const x = cv.getContext('2d');
  x.fillStyle = '#04130c';
  x.fillRect(0, 0, w, h);
  draw(x, w, h);
  x.fillStyle = 'rgba(0,0,0,0.16)';
  for (let sy = 0; sy < h; sy += 4) x.fillRect(0, sy, w, 2);
  const tex = new THREE.CanvasTexture(cv);
  // Non power-of-two: without these it comes back resized or blank.
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  return tex;
}

const GREEN = '#6effa8', DIM = '#2f8f5c', WARN = '#ffb347', BAD = '#ff6b5e';

function readoutPanel(title, rows) {
  return crtPanel(512, 320, (x, w) => {
    x.fillStyle = '#0c2f1d';
    x.fillRect(0, 0, w, 36);
    x.fillStyle = GREEN;
    x.font = 'bold 20px "Courier New", monospace';
    x.fillText(title, 14, 25);
    let y = 72;
    for (const [label, value, state] of rows) {
      x.font = '17px "Courier New", monospace';
      x.fillStyle = DIM;
      x.fillText(label, 14, y);
      x.fillStyle = state === 'bad' ? BAD : state === 'warn' ? WARN : GREEN;
      x.textAlign = 'right';
      x.fillText(value, w - 14, y);
      x.textAlign = 'left';
      y += 30;
    }
  });
}

// A plan of the station, drawn from the same painted cells the level is built
// from — so it is a true map of everywhere you have walked, not a drawing of
// one.
function stationMapPanel() {
  return crtPanel(512, 384, (x, w, h) => {
    const cells = GRID.cells;
    let ix0 = Infinity, ix1 = -Infinity, iz0 = Infinity, iz1 = -Infinity;
    for (const [cx, cz] of cells) {
      if (cx < ix0) ix0 = cx; if (cx > ix1) ix1 = cx;
      if (cz < iz0) iz0 = cz; if (cz > iz1) iz1 = cz;
    }
    x.fillStyle = '#0c2f1d';
    x.fillRect(0, 0, w, 32);
    x.fillStyle = GREEN;
    x.font = 'bold 18px "Courier New", monospace';
    x.fillText('STATION PLAN', 12, 22);

    // The map is drawn with x across and z DOWN the panel, the way you'd hold
    // a plan — north is up, which is -z in the world.
    const PAD = 16, TOP = 44;
    const s = Math.min((w - PAD * 2) / (ix1 - ix0 + 1),
                       (h - TOP - PAD) / (iz1 - iz0 + 1));
    const ox = (w - (ix1 - ix0 + 1) * s) / 2;
    const oy = TOP + ((h - TOP - PAD) - (iz1 - iz0 + 1) * s) / 2;
    const px = (cx) => ox + (cx - ix0) * s;
    const py = (cz) => oy + (iz1 - cz) * s;

    x.fillStyle = '#17482f';
    for (const [cx, cz] of cells) x.fillRect(px(cx), py(cz), s + 0.6, s + 0.6);

    // This room picked out, and a caret on it.
    for (const r of GRID.rooms || []) {
      if (r.id !== 'room9') continue;
      x.fillStyle = '#6effa8';
      for (const [cx, cz] of r.cells) x.fillRect(px(cx), py(cz), s + 0.6, s + 0.6);
      const mx = r.cells.reduce((a, c) => a + c[0], 0) / r.cells.length;
      const mz = r.cells.reduce((a, c) => a + c[1], 0) / r.cells.length;
      x.fillStyle = '#04130c';
      x.font = 'bold 11px "Courier New", monospace';
      x.textAlign = 'center';
      x.fillText('CTRL', px(mx) + s / 2, py(mz) + s / 2);
      x.textAlign = 'left';
    }
  });
}

// A command chair: pedestal, seat, high back, arms. Built facing +X, which is
// the way the whole console faces.
function commandChair(big) {
  const g = new THREE.Group();
  const frame = M.hullDk(), pad = big ? M.pilot() : M.metal();
  const SEAT = 0.46, BW = big ? 0.6 : 0.54;

  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.06, 10), frame);
  foot.position.y = 0.03;
  g.add(foot);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, SEAT - 0.1, 8), frame);
  stem.position.y = SEAT / 2;
  g.add(stem);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, BW), pad);
  seat.position.y = SEAT;
  g.add(seat);
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, big ? 0.82 : 0.68, BW), pad);
  back.position.set(-0.24, SEAT + (big ? 0.44 : 0.37), 0);
  back.rotation.z = -0.12;                   // reclined, not upright
  g.add(back);
  if (big) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.36), pad);
    head.position.set(-0.33, SEAT + 0.95, 0);
    head.rotation.z = -0.12;
    g.add(head);
  }
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.09), frame);
    arm.position.set(0.04, SEAT + 0.26, side * (BW / 2 + 0.02));
    g.add(arm);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.26, 0.07), frame);
    post.position.set(-0.16, SEAT + 0.13, side * (BW / 2 + 0.02));
    g.add(post);
  }
  return g;
}

// Someone still in their chair. Built facing +X like the chair.
//
// `lean` tips the upper body forward over the console (negative is forward,
// since rotating +Y about Z carries it to +X), `roll` tips it sideways. The
// whole upper body hangs off one pivot at the hip so the head, arms and
// shoulders all go with it instead of being posed one at a time.
function seatedBody({ cloth, capMat, lean, roll, armDrop, seed }) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const skin = M.flesh();
  const SEAT = 0.46;

  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.44), cloth);
  hips.position.set(-0.02, SEAT + 0.13, 0);
  g.add(hips);

  // Thighs forward off the seat, shins down to the floor.
  for (const side of [-1, 1]) {
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.5, 6), cloth);
    thigh.position.set(0.22, SEAT + 0.11, side * 0.14);
    thigh.rotation.z = Math.PI / 2;
    g.add(thigh);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), cloth);
    knee.position.set(0.45, SEAT + 0.08, side * 0.15);
    g.add(knee);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.48, 6), cloth);
    shin.position.set(0.45, SEAT - 0.17, side * 0.15);
    shin.rotation.z = 0.12;
    g.add(shin);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.15), M.hullDk());
    boot.position.set(0.52, 0.06, side * 0.15);
    g.add(boot);
  }

  const upper = new THREE.Group();
  upper.position.set(-0.02, SEAT + 0.2, 0);
  upper.rotation.x = roll;
  upper.rotation.z = lean;
  g.add(upper);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.56, 0.46), cloth);
  torso.position.y = 0.28;
  upper.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), skin);
  head.position.set(0.02, 0.68, 0);
  upper.add(head);
  if (capMat) {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), capMat);
    cap.position.set(0.02, 0.7, 0);
    upper.add(cap);
    const peak = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.26), capMat);
    peak.position.set(0.18, 0.69, 0);
    upper.add(peak);
  }
  // One arm on the rest, one hanging off it.
  for (const side of [-1, 1]) {
    const drop = side === armDrop;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.56, 6), cloth);
    if (drop) {
      arm.position.set(-0.04, 0.16, side * 0.3);
      arm.rotation.x = side * 0.25;
    } else {
      arm.position.set(0.2, 0.3, side * 0.26);
      arm.rotation.z = Math.PI / 2 - 0.3;
    }
    upper.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 4), skin);
    hand.position.copy(arm.position);
    hand.position.x += drop ? 0.0 : 0.26;
    hand.position.y += drop ? -0.3 : -0.08;
    hand.position.z += drop ? side * 0.07 : 0;
    upper.add(hand);
  }
  // Rank bars on the shoulders for the one wearing the cap.
  if (capMat) {
    for (const side of [-1, 1]) {
      for (let b = 0; b < 2; b++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.015, 0.03), M.brass());
        bar.position.set(0.02 + b * 0.05, 0.53, side * 0.2);
        upper.add(bar);
      }
    }
  }
  return g;
}

export function buildControlRoom(scene, room, seed = 4040) {
  const rand = rng(seed);
  const group = new THREE.Group();
  const colliders = [];
  const shell = M.metal(), dark = M.hullDk(), trim = M.bar();

  const WX = room.x1;                       // the wall you walk at
  // How far the pilots sit out from the general. At a couple of metres the
  // three of them read as one clump rather than as a crew working a wall.
  const CREW_SPREAD = 4.4;
  const Z0 = room.z0 + 0.5, Z1 = room.z1 - 0.5, ZL = Z1 - Z0, ZC = (Z0 + Z1) / 2;
  const CREW_Z = [ZC + CREW_SPREAD, ZC, ZC - CREW_SPREAD];

  // ── THE WINDOW ────────────────────────────────────────────
  // Built like the Hangar's breach but intact: void, stars in front of it,
  // then a planet in front of those so it occludes them the way a world
  // would. A plane faces +Z, so everything turns a quarter to face back down
  // the room at -X.
  const SILL = 2.02, HEAD = 3.56, WH = HEAD - SILL, WY = (SILL + HEAD) / 2;
  const GZ0 = room.z0 + 1.2, GZ1 = room.z1 - 1.2, GW = GZ1 - GZ0, GZC = (GZ0 + GZ1) / 2;
  {
    const faceOut = (mesh, inset) => {
      mesh.position.set(WX - inset, WY, GZC);
      mesh.rotation.y = -Math.PI / 2;
      group.add(mesh);
    };
    faceOut(new THREE.Mesh(new THREE.PlaneGeometry(GW, WH),
      new THREE.MeshBasicMaterial({ color: 0x03040a, side: THREE.DoubleSide })), 0.04);

    const pts = [], cols = [];
    for (let i = 0; i < 900; i++) {
      const b = 0.3 + rand() * 0.7, t = rand();
      pts.push(WX - 0.1,
               WY + (rand() - 0.5) * WH * 0.99,
               GZC + (rand() - 0.5) * GW * 0.99);
      cols.push(b * (t > 0.85 ? 1 : 0.9), b * (t > 0.85 ? 0.86 : 0.96),
                b * (t > 0.85 ? 0.7 : 1));
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    sg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    group.add(new THREE.Points(sg, new THREE.PointsMaterial({
      size: 0.055, sizeAttenuation: true, vertexColors: true })));

    // A world below, rising past the sill. Its centre has to sit BELOW the
    // sill by less than its radius, or the top of the disc clears the window
    // head and all you see is a flat blue band with no curve to it at all.
    const PR = 2.3, PCY = SILL - 1.15;
    const planet = new THREE.Mesh(new THREE.CircleGeometry(PR, 44),
      new THREE.MeshBasicMaterial({ color: 0x16283f }));
    planet.position.set(WX - 0.14, PCY, GZC + GW * 0.2);
    planet.rotation.y = -Math.PI / 2;
    group.add(planet);
    const limb = new THREE.Mesh(
      new THREE.RingGeometry(PR - 0.07, PR, 44, 1, 0.6, 1.95),
      new THREE.MeshBasicMaterial({ color: 0x6f9fd4, side: THREE.DoubleSide }));
    limb.position.set(WX - 0.145, PCY, GZC + GW * 0.2);
    limb.rotation.y = -Math.PI / 2;
    group.add(limb);

    // Frame: sill, head, and mullions splitting it into panes.
    for (const [fy, fh] of [[SILL - 0.09, 0.18], [HEAD + 0.09, 0.18]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, fh, GW + 0.36), shell);
      bar.position.set(WX - 0.15, fy, GZC);
      group.add(bar);
    }
    const PANES = 7;
    for (let i = 0; i <= PANES; i++) {
      const mz = GZ0 + (i / PANES) * GW;
      const mull = new THREE.Mesh(new THREE.BoxGeometry(0.26, WH + 0.1, 0.16), shell);
      mull.position.set(WX - 0.13, WY, mz);
      group.add(mull);
    }
    // The glass itself: barely there, but it catches the room's light and
    // stops the window reading as an open hole like the Hangar's breach.
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(GW, WH),
      new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true,
        opacity: 0.05, side: THREE.DoubleSide, depthWrite: false }));
    glass.position.set(WX - 0.2, WY, GZC);
    glass.rotation.y = -Math.PI / 2;
    glass.renderOrder = 3;
    group.add(glass);
  }

  // ── THE CONTROL STATION ───────────────────────────────────
  // One run the whole length of the wall: cabinet, desk, a panel raked up off
  // the back of it, and an upright bank of screens above that.
  const DD = 1.0;                              // desk depth
  const DX = WX - DD / 2 - 0.06;               // desk centre
  const DESK_Y = 0.78;
  {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(DD - 0.18, DESK_Y - 0.08, ZL), dark);
    cab.position.set(DX + 0.05, (DESK_Y - 0.08) / 2, ZC);
    group.add(cab);
    const top = new THREE.Mesh(new THREE.BoxGeometry(DD, 0.08, ZL), shell);
    top.position.set(DX, DESK_Y, ZC);
    group.add(top);

    // The raked panel. Rotating about Z tips it up at the back; the height it
    // then stands is what the upright bank above has to start from.
    const RAKE = 0.62, RL = 0.56;
    const rake = new THREE.Mesh(new THREE.BoxGeometry(RL, 0.07, ZL), shell);
    rake.position.set(WX - 0.3, DESK_Y + 0.21, ZC);
    rake.rotation.z = RAKE;
    group.add(rake);

    const BANK_Y0 = 1.08, BANK_H = SILL - BANK_Y0, BANK_YC = BANK_Y0 + BANK_H / 2;
    const bank = new THREE.Mesh(new THREE.BoxGeometry(0.16, BANK_H, ZL), dark);
    bank.position.set(WX - 0.1, BANK_YC, ZC);
    group.add(bank);

    // Switch banks and indicator lights across the raked panel, merged.
    const keys = [], lamps = [], warnLamps = [];
    for (let z = Z0 + 0.4; z < Z1 - 0.3; z += 0.42) {
      // Thin the switchgear out where someone is sitting, at whichever three
      // places along the wall the crew actually ended up.
      const atCrew = CREW_Z.some((cz) => Math.abs(z - cz) < 1.1);
      if (atCrew && rand() < 0.5) continue;
      for (let k = 0; k < 4; k++) {
        pushBox(keys, WX - 0.52 + k * 0.025, DESK_Y + 0.3 + k * 0.1, z,
                0.05, 0.02, 0.26);
      }
      const bucket = rand() < 0.18 ? warnLamps : lamps;
      for (let k = 0; k < 3; k++) {
        pushBox(bucket, WX - 0.33, DESK_Y + 0.57, z - 0.1 + k * 0.1,
                0.03, 0.02, 0.04);
      }
    }
    for (const [arr, col] of [[keys, 0x9aa3ad], [lamps, 0x6effa8], [warnLamps, 0xffb347]]) {
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      bg.computeVertexNormals();
      group.add(new THREE.Mesh(bg, col === 0x9aa3ad
        ? new THREE.MeshLambertMaterial({ color: col })
        : new THREE.MeshBasicMaterial({ color: col })));
    }

    // Screens along the upright bank. The map is the middle one, over the
    // general's chair, because that is the one you walk at.
    const PANELS = [
      readoutPanel('REACTOR', [['CORE OUTPUT', '12%', 'bad'], ['COOLANT', 'HOLDING'],
                               ['VENT 3', 'FAULT', 'warn'], ['SCRAM', 'ARMED', 'warn']]),
      readoutPanel('LIFE SUPPORT', [['BAY 4', 'SEALED', 'warn'], ['HANGAR', 'VACUUM', 'bad'],
                                    ['O2 RESERVE', '31%', 'warn'], ['SCRUBBERS', 'ONLINE']]),
      stationMapPanel(),
      readoutPanel('DOOR CONTROL', [['SECTOR 1-3', 'OPEN'], ['PRISON BLOCK', 'OPEN', 'warn'],
                                    ['CONTROL', 'LOCKED', 'bad'], ['OVERRIDE', 'THIS PANEL']]),
      readoutPanel('CONTACTS', [['BAY 4', '4 HELD', 'warn'], ['BAY 4', '0 HELD', 'bad'],
                                ['STATION', 'UNKNOWN', 'bad'], ['BEACON', 'NO REPLY', 'bad']]),
    ];
    // Seven positions across the wall, cycling the five readouts, with the
    // station plan put dead centre over the general's chair — that is the one
    // you walk straight at coming through the door.
    // Fit each screen between the bank's bottom edge and the underside of the
    // window sill. Sized off the bank's own height instead, the sill's frame
    // bar laid across the top 10cm of every one — which is exactly where the
    // title of each readout is.
    const SCR_TOP = SILL - 0.22, SCR_BOT = BANK_Y0 + 0.06;
    const SH = SCR_TOP - SCR_BOT, SCR_Y = (SCR_TOP + SCR_BOT) / 2;
    const SLOTS = 7;
    for (let i = 0; i < SLOTS; i++) {
      const sz = Z0 + (i + 0.5) * (ZL / SLOTS);
      const tex = i === (SLOTS - 1) / 2 ? PANELS[2]
                                        : PANELS[(i * 2 + 1) % PANELS.length];
      const sw = SH * (tex.image.width / tex.image.height);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(sw, SH),
        new THREE.MeshBasicMaterial({ map: tex }));
      scr.position.set(WX - 0.19, SCR_Y, sz);
      scr.rotation.y = -Math.PI / 2;
      group.add(scr);
      const bez = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, SH + 0.08, sw + 0.08), dark);
      bez.position.set(WX - 0.15, SCR_Y, sz);
      group.add(bez);
    }

    for (let z = Z0; z <= Z1; z += 0.7) colliders.push({ x: DX, z, r: 0.62 });
  }

  // ── THE CREW ──────────────────────────────────────────────
  // General in the middle with the map over his head, a pilot either side.
  // Each one slumped differently: three identical poses read as a glitch.
  //
  // `yaw` swivels the chair and whoever is in it together. Square-on to the
  // console, all you see walking in is three chair backs. The general's is
  // turned furthest: he came off the console to face the door.
  const CREW = [
    { z: CREW_Z[0], big: false, cloth: M.pilot(), cap: null, yaw: 0.34,
      lean: -0.95, roll: 0.1, armDrop: 1, seed: 611 },      // forward onto the desk
    { z: CREW_Z[1], big: true, cloth: M.fatigue(), cap: M.helmet(), yaw: 1.05,
      lean: 0.16, roll: -0.3, armDrop: -1, seed: 733 },     // back, turned to the door
    { z: CREW_Z[2], big: false, cloth: M.pilot(), cap: null, yaw: -0.42,
      lean: -0.2, roll: 0.55, armDrop: 1, seed: 857 },      // lolled to one side
  ];
  for (const c of CREW) {
    const chair = commandChair(c.big);
    chair.position.set(DX - 1.15, 0, c.z);
    chair.rotation.y = c.yaw;
    group.add(chair);
    const body = seatedBody({ cloth: c.cloth, capMat: c.cap, lean: c.lean,
                              roll: c.roll, armDrop: c.armDrop, seed: c.seed });
    body.position.set(DX - 1.15, 0, c.z);
    body.rotation.y = c.yaw;
    group.add(body);

    const pool = bloodPool(0.4 + rand() * 0.18, c.seed + 9);
    pool.position.set(DX - 0.95, 0, c.z + (rand() - 0.5) * 0.3);
    group.add(pool);
    colliders.push({ x: DX - 1.15, z: c.z, r: 0.5 });
  }
  // The general bled onto his own console.
  const smear = bloodPool(0.28, 2929);
  smear.position.set(DX + 0.1, DESK_Y + 0.05, ZC + 0.1);
  group.add(smear);

  // ── THE DOOR ──────────────────────────────────────────────
  // Two of them posted either side of the only way in, still where they fell.
  // The opening is found from the painted map rather than written down here:
  // it is wherever a cell just outside the room's west edge has floor on it,
  // so re-painting the map moves these two with it.
  {
    const CS = GRID.cellSize || 2;
    const painted = new Set(GRID.cells.map((c) => c[0] + ',' + c[1]));
    let dz0 = Infinity, dz1 = -Infinity;
    for (let z = room.z0 + 0.5; z < room.z1; z += CS / 2) {
      const [ix, iz] = worldToCell(room.x0 - CS / 2, z);
      if (!painted.has(ix + ',' + iz)) continue;
      dz0 = Math.min(dz0, z); dz1 = Math.max(dz1, z);
    }
    const gunMats = { metal: M.gunMetal(), stock: M.gunStock() };
    const GUARDS = [
      { z: dz0 - 1.4, rot: 0.38, arm: 'rifle', seed: 5121 },
      { z: dz1 + 1.4, rot: Math.PI - 0.32, arm: 'pistol', seed: 6233 },
    ];
    for (const gd of GUARDS) {
      const gx = room.x0 + 1.35;
      const pool = bloodPool(0.85 + (gd.seed % 7) * 0.03, gd.seed + 3);
      pool.position.set(gx, 0, gd.z);
      pool.rotation.y = gd.rot;
      group.add(pool);

      const body = deadBody('soldier', gd.seed);
      body.position.set(gx, 0, gd.z);
      body.rotation.y = gd.rot;
      group.add(body);

      // The weapon thrown clear of the hand it fell out of. It has to land
      // past the edge of the blood: dark gunmetal on a dark pool reads as
      // nothing at all, and the pistol is small enough to vanish entirely.
      // deadBody lies along Z with the head at +Z, so +X is out to its side.
      const reach = gd.arm === 'rifle' ? 0.8 : 1.2;
      const hand = new THREE.Vector3(reach, 0, reach * 0.45).applyAxisAngle(
        new THREE.Vector3(0, 1, 0), gd.rot);
      const gun = gd.arm === 'rifle'
        ? brokenRifle(rng(gd.seed + 11), gunMats, false)
        : pistol(gunMats);
      gun.position.set(gx + hand.x, 0, gd.z + hand.z);
      gun.rotation.y = gd.rot + (gd.arm === 'rifle' ? 1.1 : 2.4);
      group.add(gun);

      // Brass where they stood and fired it.
      const brass = [];
      const br = rng(gd.seed + 29);
      for (let i = 0; i < 22; i++) {
        const a = br() * Math.PI * 2, d = 0.5 + Math.pow(br(), 0.6) * 1.3;
        pushBar(brass, gx + Math.cos(a) * d, 0.013, gd.z + Math.sin(a) * d,
                0.012, 0.055, Math.PI / 2, br() * Math.PI * 2);
      }
      const bg3 = new THREE.BufferGeometry();
      bg3.setAttribute('position', new THREE.Float32BufferAttribute(brass, 3));
      bg3.computeVertexNormals();
      group.add(new THREE.Mesh(bg3, M.brass()));
    }
  }

  // ── LIGHT ─────────────────────────────────────────────────
  // Two fixtures over the console only. Lighting all 32x24 of this room would
  // cost four or five more point lights on a shader the whole level shares,
  // and leaving the far end dark puts the eye on the wall you came in facing.
  for (const lz of [ZC - 4.5, ZC + 4.5]) {
    const housing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.34), shell);
    housing.position.set(WX - 1.6, WALL_H - 0.14, lz);
    group.add(housing);
    const tube = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.24),
      new THREE.MeshBasicMaterial({ color: 0xdce8ff }));
    tube.position.set(WX - 1.6, WALL_H - 0.21, lz);
    group.add(tube);
    const lamp = new THREE.PointLight(0xcfe0f5, 1.1, 14, 1.4);
    lamp.position.set(WX - 2.2, WALL_H - 0.7, lz);
    group.add(lamp);
  }

  group.traverse((o) => { if (o.isMesh) o.userData.isWall = true; });
  scene.add(group);
  return { group, colliders };
}

// ─── THE HANGAR CRASH SITE ──────────────────────────────────
export function buildHangarProps(scene, room, walls = []) {
  const group = new THREE.Group();
  const rand = rng(20261016);

  // Placed inside the Hangar's big open block, not its bounding box — the
  // room is an L and the bbox centre would sit in the empty notch.
  const HX = 10, HZ = 33;          // crash site centre, world units

  const heli = brokenHelicopter();
  heli.position.set(HX, 0, HZ);
  heli.rotation.y = -0.55;
  heli.rotation.z = 0.16;          // tipped onto the collapsed skid
  heli.rotation.x = -0.05;
  group.add(heli);

  // Scorch under the airframe, and a blade thrown clear of it.
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(5.2, 14), M.scorch());
  scorch.rotation.x = -Math.PI / 2;
  scorch.position.set(HX, 0.008, HZ);
  group.add(scorch);

  const loose = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.1, 0.42), M.hullDk());
  loose.position.set(HX + 6.5, 0.06, HZ + 3.4);
  loose.rotation.y = 1.1;
  loose.rotation.z = 0.04;
  group.add(loose);

  // Debris scattered around the wreck.
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2, d = 4 + rand() * 6;
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(0.3 + rand() * 0.7, 0.08, 0.25 + rand() * 0.6),
      rand() > 0.5 ? M.hullDk() : M.metal());
    p.position.set(HX + Math.cos(a) * d, 0.04, HZ + Math.sin(a) * d);
    p.rotation.y = rand() * Math.PI;
    p.rotation.z = (rand() - 0.5) * 0.2;
    group.add(p);
  }

  // The pilot, thrown clear of the cockpit. Everyone gets blood underneath.
  const bodies = [
    { kind: 'pilot',   x: HX + 4.6, z: HZ + 4.2, rot: 2.1,  blood: 1.5 },
    { kind: 'soldier', x: HX - 5.2, z: HZ + 2.6, rot: 0.6,  blood: 1.2 },
    { kind: 'soldier', x: HX + 1.8, z: HZ - 6.4, rot: 3.6,  blood: 1.3 },
    { kind: 'soldier', x: HX + 8.4, z: HZ - 2.2, rot: 5.0,  blood: 1.1 },
    { kind: 'soldier', x: HX - 2.4, z: HZ + 7.8, rot: 1.4,  blood: 1.4 },
  ];
  bodies.forEach((b, i) => {
    const pool = bloodPool(b.blood, 1000 + i * 77);
    pool.position.set(b.x, 0, b.z);
    pool.rotation.y = b.rot;
    group.add(pool);

    const body = deadBody(b.kind, 500 + i * 131);
    body.position.set(b.x, 0, b.z);
    body.rotation.y = b.rot;
    group.add(body);
  });

  // ── CRATES AND FUEL ───────────────────────────────────────
  // Positions are validated against the painted cells, not the room's
  // bounding box: the Hangar is an L and its bbox centre is empty floorless
  // space, so a plausible-looking coordinate can sit outside the level.
  const onHangarFloor = (x, z) => roomIdAt(x, z) === 'room1';
  const extraColliders = [];

  const stacks = [
    [1.5, 25.5], [4.2, 45.0], [23.0, 26.0], [24.0, 44.5],
    [34.0, 55.0], [49.0, 51.5], [57.0, 55.5],
  ];
  let placedStacks = 0, skipped = 0;
  stacks.forEach(([sx, sz], i) => {
    if (!onHangarFloor(sx, sz)) { skipped++; return; }
    const st = crateStack(7000 + i * 53);
    st.position.set(sx, 0, sz);
    st.rotation.y = (i * 0.7) % Math.PI;
    group.add(st);
    placedStacks++;
    for (const f of st.userData.footprints) {
      const c = Math.cos(st.rotation.y), sn = Math.sin(st.rotation.y);
      extraColliders.push({
        x: sx + f.x * c + f.z * sn,
        z: sz - f.x * sn + f.z * c,
        r: f.r,
      });
    }
  });

  // Fuel tank down the long south strip, well clear of the wreck.
  const TX = 42, TZ = 53.5, TROT = 0;
  if (onHangarFloor(TX, TZ)) {
    const tank = fuelTank();
    tank.position.set(TX, 0, TZ);
    tank.rotation.y = TROT;
    group.add(tank);
    // Circles down the drum's axis rather than one box around the whole thing.
    for (let lz = -4; lz <= 4; lz += 1.33) {
      extraColliders.push({
        x: TX + Math.cos(TROT) * lz, z: TZ - Math.sin(TROT) * lz, r: 1.5,
      });
    }
  }

  // The south wall is gone either side of the fuel tank. This used to be the
  // north wall, but that is where the Hangar's only doorway is — the breach
  // sat across the exit and the vacuum killed you on your way out of the room.
  // The tank keeps a pillar of intact hull behind it, which is also the only
  // thing on this side worth not venting.
  const BZ = 58, BSIDE = -1;             // floor lies at z < 58
  const BREACHES = [
    { xMin: -4, xMax: 36, z: BZ, side: BSIDE },
    { xMin: 48, xMax: 62, z: BZ, side: BSIDE },
  ];
  for (const b of BREACHES) group.add(spaceWall(b.xMin, b.xMax, b.z, b.side));

  // ── COLLISION ─────────────────────────────────────────────
  // Circles, not bounding boxes. The loose rotor blade is 5.6 long and turned
  // 63 degrees — its AABB would wall off a big patch of empty floor. A circle
  // doesn't care how the prop is rotated.
  //
  // Only things with real bulk get one. Flat debris, the scorch ring and the
  // blood are walked over, not around.
  const colliders = [];
  const heliCos = Math.cos(heli.rotation.y), heliSin = Math.sin(heli.rotation.y);
  // Along the airframe's own axis, then rotated into the world.
  for (const [lz, r] of [[3.0, 1.2], [1.8, 1.5], [0.6, 1.6], [-0.6, 1.6],
                         [-1.8, 1.5], [-3.0, 1.2], [-4.2, 0.7], [-5.4, 0.6],
                         [-6.6, 0.5]]) {
    colliders.push({
      x: HX + heliSin * lz, z: HZ + heliCos * lz, r,
    });
  }
  // A body is low but you still shouldn't walk through one. Kept tight so you
  // can step around without the corpse feeling like a bollard.
  for (const b of bodies) colliders.push({ x: b.x, z: b.z, r: 0.62 });
  colliders.push(...extraColliders);

  // Props stop bullets like walls do, so a shot can't pass through a body.
  group.traverse((o) => { if (o.isMesh) o.userData.isWall = true; });

  scene.add(group);

  const meshes = [];
  group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  // Battle damage, skipping the breached wall.
  const dmg = wallDamage(walls, room || { x0: -4, x1: 62, z0: 22, z1: 58 },
                         BREACHES, 4242);
  if (dmg.holes) { group.add(dmg.holes); group.add(dmg.scorch); }

  // The vacuum. `pull` is where it starts dragging you, `kill` is the point
  // of no return — set wider than the wall collider (which stops you at
  // 0.35) so you actually die instead of standing against the breach.
  const hazards = BREACHES.map((b) => ({
    type: 'vacuum', xMin: b.xMin, xMax: b.xMax, z: b.z, side: b.side,
    pull: 6, force: 7.5, kill: 1.3,
  }));

  return { group, meshes, colliders, placedStacks, skipped, hazards };
}

// ─── MILITARY ESCAPE POD ────────────────────────────────────
//
// FLETCHER'S GUIDE:
// The way off the station. It sits in the Hangar from the moment you start,
// sealed, with a red lamp on it — so you walk past the exit at the beginning
// and know where you have to get back to. Kill the boss and the lamp goes
// green, the bolts blow and the hatch swings open.
//
// It is built lying along X with its NOSE at +x, because it is parked against
// the Hangar's east wall and that is the way it leaves: nose first, straight
// through the hull. The engine is therefore at -x and the hatch is on the
// SIDE facing -z, which is the side you walk up to it from.
//
// Everything that changes is stashed on userData so setEscapePodUnlocked can
// find it without the caller knowing how the thing is put together.
const POD_SHELL = {
  len: 3.6,          // nose to engine
  r: 1.05,           // hull radius
  liftY: 1.15,       // height of the hull's centre line off the floor
  hatchW: 1.25,
  hatchH: 1.75,
};

export function buildEscapePod(scene, at = { x: 0, z: 0, rot: 0 }) {
  const S = POD_SHELL;
  const g = new THREE.Group();
  g.position.set(at.x, 0, at.z);
  // Turned so the nose points wherever it is meant to leave through. Built
  // along X, so everything below is in the pod's own frame and the rotation
  // is applied once, here — including to the collider ring and the spot you
  // stand on, which are worked out in world space at the end.
  const rot = at.rot || 0;
  g.rotation.y = rot;

  const hull = M.hull(), dark = M.hullDk(), steel = M.metal();
  const stripe = M.hazard(), mark = M.stencil(), glass = M.glass();

  // ── Cradle ────────────────────────────────────────────────
  // Two rails and a pair of clamps. The pod is HELD, not parked — it should
  // look like something that leaves in a hurry rather than something stored.
  for (const sz of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(S.len + 1.4, 0.22, 0.34), steel);
    rail.position.set(0, 0.11, sz * 0.95);
    g.add(rail);
    for (const lx of [-1.2, 0.4]) {
      const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.95, 0.26), dark);
      clamp.position.set(lx, 0.55, sz * 0.95);
      g.add(clamp);
    }
  }

  // ── Hull ──────────────────────────────────────────────────
  // Eight-sided rather than round: it reads as plated armour at a distance,
  // and it matches the faceted look of everything else in the station.
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(S.r, S.r, S.len, 8), hull);
  body.rotation.z = Math.PI / 2;
  body.position.y = S.liftY;
  g.add(body);

  // Armour bands, and a heat shield collar where the nose meets the body.
  for (const [lx, rr, w] of [[-1.35, S.r * 1.04, 0.3], [0.1, S.r * 1.04, 0.26],
                             [1.5, S.r * 1.02, 0.22]]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, w, 8), dark);
    band.rotation.z = Math.PI / 2;
    band.position.set(lx, S.liftY, 0);
    g.add(band);
  }

  // Nose — blunt, armoured, pointed at the wall it goes through.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(S.r, 1.3, 8), dark);
  nose.rotation.z = -Math.PI / 2;
  nose.position.set(S.len / 2 + 0.65, S.liftY, 0);
  g.add(nose);

  // ── Engine ────────────────────────────────────────────────
  const bell = new THREE.Mesh(
    new THREE.CylinderGeometry(S.r * 0.52, S.r * 0.86, 0.95, 8, 1, true), steel);
  bell.rotation.z = Math.PI / 2;
  bell.position.set(-S.len / 2 - 0.45, S.liftY, 0);
  bell.material.side = THREE.DoubleSide;
  g.add(bell);
  // Down inside it, so the engine isn't a hole when you look in.
  const throat = new THREE.Mesh(new THREE.CircleGeometry(S.r * 0.5, 8),
    new THREE.MeshBasicMaterial({ color: 0x120e0c }));
  throat.rotation.y = -Math.PI / 2;
  throat.position.set(-S.len / 2 - 0.02, S.liftY, 0);
  g.add(throat);
  // Steering thrusters round the tail.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.3, 6), dark);
    t.rotation.z = Math.PI / 2;
    t.position.set(-S.len / 2 + 0.1, S.liftY + Math.sin(a) * S.r * 0.72,
                   Math.cos(a) * S.r * 0.72);
    g.add(t);
  }

  // ── Hatch ─────────────────────────────────────────────────
  // On a hinge group at its leading edge, so opening it is one rotation and
  // the door swings out into the walkway like a real blast door.
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(S.hatchW + 0.28, S.hatchH + 0.26, 0.12), dark);
  frame.position.set(0, S.liftY - 0.05, -S.r - 0.02);
  g.add(frame);

  // The lit inside, revealed when the door swings clear.
  const cabin = new THREE.Mesh(
    new THREE.PlaneGeometry(S.hatchW, S.hatchH),
    new THREE.MeshBasicMaterial({ color: 0x14301f }));
  cabin.position.set(0, S.liftY - 0.05, -S.r + 0.04);
  g.add(cabin);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.5), M.fatigue());
  seat.position.set(0, S.liftY - 0.55, -S.r + 0.3);
  g.add(seat);

  const hinge = new THREE.Group();
  hinge.position.set(S.hatchW / 2, S.liftY - 0.05, -S.r - 0.08);
  g.add(hinge);
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(S.hatchW, S.hatchH, 0.16), hull);
  door.position.set(-S.hatchW / 2, 0, 0);
  hinge.add(door);
  // A wheel and two dogs, so it reads as something sealed rather than shut.
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.055, 5, 10), steel);
  wheel.position.set(-S.hatchW / 2, 0, -0.14);
  hinge.add(wheel);
  for (const dy of [-0.6, 0.6]) {
    const dog = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.1), steel);
    dog.position.set(-S.hatchW / 2, dy, -0.12);
    hinge.add(dog);
  }

  // ── Markings ──────────────────────────────────────────────
  // Hazard chevrons above the hatch, and blocks that read as a stencilled
  // unit number from across the Hangar without being actual letters.
  for (let i = 0; i < 5; i++) {
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.06), stripe);
    ch.position.set(-0.56 + i * 0.28, S.liftY + S.hatchH / 2 + 0.2, -S.r - 0.06);
    ch.rotation.z = 0.5;
    g.add(ch);
  }
  for (const [mx, mw] of [[-0.95, 0.16], [-0.7, 0.1], [-0.5, 0.16], [-0.2, 0.1]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(mw, 0.24, 0.05), mark);
    m.position.set(mx, S.liftY + 0.72, -S.r - 0.05);
    g.add(m);
  }

  // ── The lamp ──────────────────────────────────────────────
  // The whole point of the thing, from the player's side: red until the boss
  // is dead, then green. Its own material, because it gets recoloured.
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xff2233 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), lampMat);
  lamp.position.set(0, S.liftY + S.hatchH / 2 + 0.52, -S.r - 0.04);
  g.add(lamp);
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.1, 8), dark);
  hood.position.set(0, S.liftY + S.hatchH / 2 + 0.72, -S.r - 0.04);
  g.add(hood);
  const glow = new THREE.PointLight(0xff2233, 1.1, 7);
  glow.position.copy(lamp.position);
  g.add(glow);

  // ── Console ───────────────────────────────────────────────
  // Beside the hatch, so there is somewhere for the lock to live.
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.25, 0.22), steel);
  post.position.set(-1.85, 0.62, -S.r - 0.5);
  g.add(post);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x5a1016 });
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.44, 0.1), screenMat);
  screen.position.set(-1.85, 1.38, -S.r - 0.5);
  screen.rotation.x = -0.25;
  g.add(screen);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.56, 0.08), dark);
  bezel.position.set(-1.85, 1.38, -S.r - 0.56);
  bezel.rotation.x = -0.25;
  g.add(bezel);

  scene.add(g);
  g.userData = {
    lamp, lampMat, glow, hinge, screenMat, cabin, unlocked: false, open: 0,
  };

  // Circles down the hull, the way the helicopter is done — a box round a
  // 5-unit pod would wall off a chunk of floor you should be able to walk on.
  // Turned into world space by hand: the colliders and the boarding point
  // live outside the scene graph, so the group's rotation does not reach them.
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const toWorld = (lx, lz) => ({
    x: at.x + lx * cos + lz * sin,
    z: at.z - lx * sin + lz * cos,
  });
  const colliders = [];
  for (let lx = -2.1; lx <= 2.1; lx += 0.7) {
    colliders.push({ ...toWorld(lx, 0), r: 1.0 });
  }
  colliders.push({ ...toWorld(-1.85, -S.r - 0.5), r: 0.3 });   // the console

  return { group: g, colliders,
           // Where you stand to get in — off the hatch, which faces -z in the
           // pod's own frame.
           board: toWorld(0, -S.r - 1.5) };
}

/** Red and sealed, or green and open. */
export function setEscapePodUnlocked(pod, unlocked) {
  const d = pod.group.userData;
  d.unlocked = unlocked;
  d.lampMat.color.setHex(unlocked ? 0x44ff88 : 0xff2233);
  d.glow.color.setHex(unlocked ? 0x44ff88 : 0xff2233);
  d.screenMat.color.setHex(unlocked ? 0x125a2a : 0x5a1016);
  if (!unlocked) { d.open = 0; d.hinge.rotation.y = 0; }
}

/**
 * Swings the hatch and breathes on the lamp. `dt` in seconds.
 *
 * The door eases rather than snapping: the moment it opens is the reward for
 * the whole fight, and a door that is simply in a different place the next
 * frame doesn't read as anything happening at all.
 */
export function updateEscapePod(pod, dt, time) {
  const d = pod.group.userData;
  const want = d.unlocked ? 1 : 0;
  if (d.open !== want) {
    d.open += Math.sign(want - d.open) * dt * 0.8;
    d.open = Math.max(0, Math.min(1, d.open));
    // Eased, and swung well clear so the lit cabin is actually visible.
    const e = d.open * d.open * (3 - 2 * d.open);
    d.hinge.rotation.y = -e * 2.1;
  }
  // Locked: a slow warning pulse. Unlocked: a steadier, brighter beacon.
  const p = d.unlocked ? 1.5 + Math.sin(time * 5) * 0.5
                       : 0.7 + Math.sin(time * 2) * 0.35;
  d.glow.intensity = p;
}

// ─── THE LOCKED DOOR ────────────────────────────────────────
//
// FLETCHER'S GUIDE:
// The room called "Locked Door" is a 4-wide chamber you cross east to west:
// in from the hallway on one side, out to the Control Room on the other. So
// the door stands ACROSS it, filling the whole ten units from wall to wall
// and the full height of the room. It is the thing between you and the boss.
//
// No window, on purpose. A window would tell you what is behind it, and the
// point of this door is that it doesn't.
//
// It is built as two leaves meeting down the middle even though nothing opens
// yet, because that is what a blast door looks like — and when the mechanic
// to open it arrives, the leaves are already there to slide apart.
//
// Solid in two separate ways, because the game has two separate ideas of
// solid: a wall SEGMENT stops you walking through it, and its meshes join
// wallMeshes so bullets stop on it too. Both are returned for the caller to
// install; see the comment on the return value.
const DOOR = {
  thick: 0.62,        // heavy. This is not an office door
  jamb: 0.5,          // the frame either side
  lintelH: 0.55,
};

export function buildLockedDoor(scene, room) {
  const g = new THREE.Group();
  const meshes = [];
  const add = (m) => { g.add(m); meshes.push(m); return m; };

  const steel = M.metal(), dark = M.hullDk(), stripe = M.hazard();
  const bolt = M.bar(), mark = M.stencil();

  // Across the room's long axis, half way along the short one.
  const DX = (room.x0 + room.x1) / 2;
  const z0 = room.z0, z1 = room.z1, span = z1 - z0;
  const mid = (z0 + z1) / 2;
  const H = WALL_H;

  // ── Frame ─────────────────────────────────────────────────
  for (const jz of [z0, z1]) {
    const jamb = add(new THREE.Mesh(
      new THREE.BoxGeometry(DOOR.thick + 0.5, H, DOOR.jamb), dark));
    jamb.position.set(DX, H / 2, jz + (jz === z0 ? DOOR.jamb / 2 : -DOOR.jamb / 2));
  }
  const lintel = add(new THREE.Mesh(
    new THREE.BoxGeometry(DOOR.thick + 0.5, DOOR.lintelH, span), dark));
  lintel.position.set(DX, H - DOOR.lintelH / 2, mid);

  // ── The leaves ────────────────────────────────────────────
  // Two of them, meeting at the middle. The gap between is a hair under
  // nothing — it should read as a seam, not a crack you could see through.
  const leafW = span / 2 - DOOR.jamb - 0.02;
  const leafH = H - DOOR.lintelH;
  // Each leaf gets its own group so opening the door is two numbers rather
  // than moving twenty meshes. They start at the origin, so everything inside
  // keeps the same coordinates it had when this was one solid slab.
  const leaves = [];
  for (const side of [-1, 1]) {
    const cz = mid + side * (leafW / 2 + 0.02);
    const leafG = new THREE.Group();
    g.add(leafG);
    leaves.push({ group: leafG, side });
    const add = (m) => { leafG.add(m); meshes.push(m); return m; };

    const leaf = add(new THREE.Mesh(
      new THREE.BoxGeometry(DOOR.thick, leafH, leafW), steel));
    leaf.position.set(DX, leafH / 2, cz);

    // Recessed armour panels, two rows. Proud of the face rather than cut
    // into it — a box standing off the surface reads as plating at this
    // size, and costs one mesh instead of a hole in the geometry.
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const panel = add(new THREE.Mesh(
          new THREE.BoxGeometry(0.1, leafH * 0.3, leafW * 0.36), dark));
        panel.position.set(DX + (DOOR.thick / 2 + 0.05) * -1,
                           leafH * (0.3 + row * 0.38),
                           cz + (col ? 1 : -1) * leafW * 0.21);
      }
    }
    // And the same on the far face, so it isn't flat from the Control Room.
    for (let row = 0; row < 2; row++) {
      const panel = add(new THREE.Mesh(
        new THREE.BoxGeometry(0.1, leafH * 0.3, leafW * 0.78), dark));
      panel.position.set(DX + DOOR.thick / 2 + 0.05,
                         leafH * (0.3 + row * 0.38), cz);
    }

    // A grab handle, the size the door deserves.
    const handle = add(new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, leafW * 0.3), bolt));
    handle.position.set(DX - DOOR.thick / 2 - 0.12, leafH * 0.52,
                        cz - side * leafW * 0.26);

    // Markings go ON the leaf, not on the room. Painted into the main group
    // instead, they stayed hanging in mid-air across the opening once the
    // door slid back — stripes floating where the door used to be.
    for (let sz = cz - leafW / 2 + 0.45; sz < cz + leafW / 2 - 0.2; sz += 0.9) {
      const st = add(new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.5, 0.42), stripe));
      st.position.set(DX - DOOR.thick / 2 - 0.04, 0.42, sz);
      st.rotation.x = 0.55;
    }
    // A stencilled number, on one leaf only — both would read as a pattern.
    if (side < 0) {
      for (const [mz, mw] of [[-0.95, 0.3], [-0.5, 0.18], [-0.1, 0.3]]) {
        const m = add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, mw), mark));
        m.position.set(DX - DOOR.thick / 2 - 0.04, leafH * 0.82, cz + mz);
      }
    }
  }

  // ── The seam ──────────────────────────────────────────────
  // A raised strip down the join with locking bolts driven across it, so the
  // door reads as SEALED rather than merely shut.
  // Its own group: when the door opens the bolts draw back out of sight
  // rather than hanging in the gap the leaves just left.
  const sealG = new THREE.Group();
  g.add(sealG);
  const addSeal = (m) => { sealG.add(m); meshes.push(m); return m; };
  const seam = addSeal(new THREE.Mesh(
    new THREE.BoxGeometry(DOOR.thick + 0.14, leafH, 0.2), dark));
  seam.position.set(DX, leafH / 2, mid);
  for (let i = 0; i < 4; i++) {
    const y = leafH * (0.18 + i * 0.22);
    const lug = addSeal(new THREE.Mesh(
      new THREE.BoxGeometry(DOOR.thick + 0.3, 0.3, 0.9), bolt));
    lug.position.set(DX, y, mid);
  }

  // ── The panel that will one day open it ───────────────────
  // Dead for now — unlit, and nothing reads it. It is here so the mechanic
  // has somewhere to live, and so the door looks like something that COULD
  // be opened rather than a wall pretending to be a door.
  const post = add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.3, 0.2), steel));
  post.position.set(DX - 1.2, 0.65, z0 + 1.3);
  const panel = add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.12), dark));
  panel.position.set(DX - 1.2, 1.45, z0 + 1.3);
  const readerMat = new THREE.MeshBasicMaterial({ color: 0x5a1016 });
  const reader = add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.06), readerMat));
  reader.position.set(DX - 1.44, 1.45, z0 + 1.3);
  reader.rotation.y = Math.PI / 2;

  // Tagged the way the level's own walls are, so the shooting code treats a
  // hit on it as "stopped by a wall" rather than falling through to ask
  // whether it was an alien. Without this the tracer still stops in the right
  // place, but only by accident.
  for (const m of meshes) m.userData.isWall = true;

  scene.add(g);
  // `openAmount` is 0 shut, 1 fully apart. `travel` is how far each leaf has
  // to slide to clear the opening — its own width, so the way through is as
  // wide as the door was.
  g.userData = { readerMat, leaves, sealG, open: false, openAmount: 0,
                 travel: leafW };

  return {
    group: g,
    // Push this into the level's wall list and you cannot walk through it.
    // Take it back OUT and the way is clear — which is what opening does.
    // One exact segment rather than a row of circles: it is a flat slab, and
    // this is how every other wall in the station is done.
    wall: { axis: 'x', pos: DX, min: z0, max: z1 },
    // And into wallMeshes, so shots stop on it instead of passing through to
    // whatever is in the Control Room.
    meshes,
    at: { x: DX, z: mid },
  };
}

/** Tell the door to open or shut. The movement itself is in updateLockedDoor. */
export function setLockedDoorOpen(door, open) {
  const d = door.group.userData;
  d.open = open;
  d.readerMat.color.setHex(open ? 0x125a2a : 0x5a1016);
  if (!open) {
    // Shut instantly on a reset — nobody is watching a new run begin.
    d.openAmount = 0;
    for (const l of d.leaves) l.group.position.z = 0;
    d.sealG.visible = true;
  }
}

/**
 * Slides the leaves. `dt` in seconds.
 *
 * Slow on purpose — four seconds end to end. This door is the reward for
 * clearing every outpost in the station, and something that heavy should
 * take its time. The bolts go first, then it starts to move.
 */
export function updateLockedDoor(door, dt) {
  const d = door.group.userData;
  const want = d.open ? 1 : 0;
  if (d.openAmount === want) return;

  d.openAmount = Math.min(1, d.openAmount + dt * 0.25);
  // Nothing moves for the first fifth: that is the bolts withdrawing.
  const slide = Math.max(0, (d.openAmount - 0.2) / 0.8);
  const eased = slide * slide * (3 - 2 * slide);
  for (const l of d.leaves) l.group.position.z = l.side * eased * d.travel;
  d.sealG.visible = d.openAmount < 0.2;
}

/** Fully apart, so the caller knows when the way is actually clear. */
export function lockedDoorIsOpen(door) {
  return door.group.userData.openAmount >= 1;
}

// ─── THE ROOM BEHIND THE BOARD ──────────────────────────────
//
// FLETCHER'S GUIDE:
// A room that is not on the map. The station's floor is baked from the grid
// you paint in the Map Editor, so a room that is deliberately not in that
// grid has no floor, no walls and no name — it has to bring its own.
//
// That turns out to be the easy way to do a secret: rather than cutting a
// hole in the station and hoping nobody walks into it by accident, the room
// is built somewhere nothing else will ever be, and the only way in is the
// one we choose. Walk the whole station and you will never find its door,
// because it hasn't got one.
//
// It returns its own wall segments for the caller to push into the level's
// collision list. Without them you would walk straight out into the dark.
/** A canvas drawn once and tiled across a surface. */
function tiled(w, h, rx, ry, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  return tex;
}

/** Deck plate: seams, rivets along them, and sixty years of boots. */
function deckTexture(rx, ry) {
  return tiled(256, 256, rx, ry, (g, w, h) => {
    g.fillStyle = '#4f555b';
    g.fillRect(0, 0, w, h);
    // Two plates across the tile, so the seams do not line up in a grid.
    g.strokeStyle = '#3c4248';
    g.lineWidth = 3;
    g.strokeRect(0, 0, w, h);
    g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
    g.fillStyle = '#595f65';
    for (let i = 0; i < 26; i++) {           // rivets down the seams
      const y = 10 + i * 10;
      g.fillRect(4, y, 3, 3); g.fillRect(w - 7, y, 3, 3);
      g.fillRect(w / 2 - 5, y, 3, 3);
    }
    // Scuffs and stains. Nothing regular, or it reads as a pattern.
    for (let i = 0; i < 40; i++) {
      g.fillStyle = Math.random() < 0.5
        ? 'rgba(255,255,255,0.045)' : 'rgba(30,26,24,0.09)';
      g.fillRect(Math.random() * w, Math.random() * h,
                 10 + Math.random() * 60, 2 + Math.random() * 8);
    }
    for (let i = 0; i < 5; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const st = g.createRadialGradient(x, y, 0, x, y, 20 + Math.random() * 34);
      st.addColorStop(0, 'rgba(36,28,22,0.3)');
      st.addColorStop(1, 'rgba(36,28,22,0)');
      g.fillStyle = st;
      g.fillRect(x - 60, y - 60, 120, 120);
    }
  });
}

/** Wall plating: a seam across the middle, rivets, rust running down from
 *  them, and a kick plate along the bottom where everything gets kicked. */
function wallPlateTexture(rx) {
  return tiled(256, 256, rx, 1, (g, w, h) => {
    g.fillStyle = '#656b71';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#5a6066';                 // upper half, very slightly off
    g.fillRect(0, 0, w, 96);
    g.strokeStyle = '#5d646b';
    g.lineWidth = 3;
    for (const y of [96, 0]) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, h); g.stroke();
    g.fillStyle = '#656c72';
    for (let i = 0; i < 14; i++) g.fillRect(8 + i * 18, 90, 4, 4);
    // Rust, running down from every seam it can.
    for (let i = 0; i < 9; i++) {
      const x = Math.random() * w, y = 96 + Math.random() * 10;
      const run = g.createLinearGradient(0, y, 0, y + 40 + Math.random() * 70);
      run.addColorStop(0, 'rgba(96,58,30,0.42)');
      run.addColorStop(1, 'rgba(96,58,30,0)');
      g.fillStyle = run;
      g.fillRect(x, y, 3 + Math.random() * 7, 110);
    }
    g.fillStyle = '#3e454b';                 // kick plate
    g.fillRect(0, 214, w, 42);
    g.fillStyle = 'rgba(20,18,16,0.25)';
    for (let i = 0; i < 18; i++) {
      g.fillRect(Math.random() * w, 216 + Math.random() * 36,
                 4 + Math.random() * 26, 2 + Math.random() * 5);
    }
  });
}

/** Letters sprayed through a stencil onto a strip of plate. */
function stencilStrip(text) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 72;
  const g = cv.getContext('2d');
  g.fillStyle = '#3c4249';
  g.fillRect(0, 0, 256, 72);
  g.fillStyle = '#c3c8bd';
  g.font = 'bold 40px monospace';
  g.textAlign = 'center';
  g.fillText(text, 128, 52);
  // Sprayed, not printed: a few gaps where the stencil sat proud.
  g.fillStyle = 'rgba(60,66,73,0.85)';
  for (let i = 0; i < 16; i++) {
    g.fillRect(Math.random() * 256, 14 + Math.random() * 44,
               2 + Math.random() * 7, 2 + Math.random() * 5);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  return tex;
}

/** The thing pinned over the bench: somebody's map of the station, with
 *  the way out of it worked out in pencil. */
function pinnedNoteTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 192;
  const g = cv.getContext('2d');
  g.fillStyle = '#d9d2bd';
  g.fillRect(0, 0, 256, 192);
  g.fillStyle = 'rgba(120,100,70,0.16)';
  for (let i = 0; i < 24; i++) {
    g.fillRect(Math.random() * 256, Math.random() * 192,
               6 + Math.random() * 30, 2 + Math.random() * 10);
  }
  // A plan of somewhere, drawn by somebody who was not an architect.
  g.strokeStyle = '#4a4336';
  g.lineWidth = 2;
  const rooms = [[18, 30, 60, 46], [92, 22, 54, 40], [160, 34, 66, 52],
                 [26, 104, 74, 52], [120, 96, 48, 40], [182, 110, 48, 44]];
  for (const [x, y, w, h] of rooms) g.strokeRect(x, y, w, h);
  g.lineWidth = 1.4;
  g.setLineDash([5, 4]);
  g.beginPath();
  g.moveTo(48, 130); g.lineTo(48, 76); g.lineTo(119, 60);
  g.lineTo(144, 96); g.lineTo(206, 110);
  g.stroke();
  g.setLineDash([]);
  // The one that is circled, and twice underlined, is this one.
  g.strokeStyle = '#8a2a1e';
  g.lineWidth = 2.5;
  g.beginPath(); g.ellipse(53, 130, 40, 32, 0, 0, Math.PI * 2); g.stroke();
  g.font = 'bold 13px monospace';
  g.fillStyle = '#8a2a1e';
  g.fillText('HERE', 34, 134);
  g.fillStyle = '#4a4336';
  g.font = '11px monospace';
  g.fillText('DO NOT USE THE DOOR', 20, 176);
  // Days, in fives, in the corner.
  g.strokeStyle = '#4a4336';
  g.lineWidth = 1.6;
  for (let b = 0; b < 4; b++) {
    const x = 196 + b * 14;
    for (let i = 0; i < 4; i++) {
      g.beginPath(); g.moveTo(x + i * 2.6, 158); g.lineTo(x + i * 2.6, 172); g.stroke();
    }
    g.beginPath(); g.moveTo(x - 2, 172); g.lineTo(x + 11, 158); g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  return tex;
}

export function buildSecretRoom(scene, at, seed = 4413) {
  const rand = rng(seed);
  const group = new THREE.Group();
  group.position.set(at.x, 0, at.z);

  const W = 11, D = 9, H = 3.4;                 // lower than the station: tight
  const x0 = -W / 2, x1 = W / 2, z0 = -D / 2, z1 = D / 2;
  const colliders = [];
  const put = (mesh, x, y, z, ry = 0) => {
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    group.add(mesh);
    return mesh;
  };
  const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  const solid = (x, z, r, h) => colliders.push(h == null
    ? { x: at.x + x, z: at.z + z, r }
    : { x: at.x + x, z: at.z + z, r, h });

  const trimMat = new THREE.MeshLambertMaterial({ color: 0x4e555c });
  const steelMat = M.metal();
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x343a40 });

  // ── The room itself ──────────────────────────────────────
  // Plated rather than painted. The walls were four blank slabs and the
  // floor one flat grey sheet, which is why the whole thing read as a
  // corridor somebody had forgotten to finish.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D),
    new THREE.MeshLambertMaterial({ map: deckTexture(4, 3) }));
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D),
    new THREE.MeshLambertMaterial({ color: 0x272c31 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = H;
  group.add(ceil);

  const longWall = new THREE.MeshLambertMaterial({ map: wallPlateTexture(3) });
  const endWall = new THREE.MeshLambertMaterial({ map: wallPlateTexture(2.5) });
  for (const cz of [z0, z1]) put(box(W, H, 0.2, longWall), 0, H / 2, cz);
  for (const cx of [x0, x1]) put(box(0.2, H, D, endWall), cx, H / 2, 0);

  // Ribs standing off the long walls, and a rail along both of them at
  // shoulder height — the room reads as built rather than as a box.
  for (let i = 1; i < 5; i++) {
    for (const cz of [z0 + 0.14, z1 - 0.14]) {
      put(box(0.12, H, 0.08, trimMat), x0 + (W / 5) * i, H / 2, cz);
    }
  }
  for (const cz of [z0 + 0.2, z1 - 0.2]) {
    put(box(W - 0.6, 0.07, 0.07, trimMat), 0, 2.05, cz);
  }

  // ── Up top: pipes, a vent, and the lamp's own cable ───────
  for (const cz of [-2.3, 2.3]) {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, W - 0.4, 8), steelMat);
    pipe.rotation.z = Math.PI / 2;
    put(pipe, 0, H - 0.22, cz);
    for (const cx of [-3.4, -0.6, 2.2, 4.4]) {
      put(box(0.1, 0.3, 0.16, trimMat), cx, H - 0.08, cz);   // hangers
    }
  }
  const vent = put(box(1.1, 0.07, 0.8, darkMat), -2.0, H - 0.05, -3.2);
  for (let i = 0; i < 6; i++) {
    put(box(1.0, 0.03, 0.06, trimMat), -2.0, H - 0.09, -3.5 + i * 0.12);
  }

  // ── The one light in here ────────────────────────────────
  const flex = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5), darkMat);
  put(flex, 0, H - 0.25, 0);
  const cage = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.34, 0.2, 8), trimMat);
  put(cage, 0, H - 0.5, 0);
  for (let i = 0; i < 6; i++) {               // the cage over the glass
    const bar = box(0.02, 0.3, 0.02, trimMat);
    bar.position.set(Math.cos(i / 6 * Math.PI * 2) * 0.24, H - 0.72,
                     Math.sin(i / 6 * Math.PI * 2) * 0.24);
    group.add(bar);
  }
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), bulbMat);
  put(bulb, 0, H - 0.66, 0);
  // Short range on purpose. At twenty-two it lit the room evenly, corner
  // to corner, which is what a ceiling grid does — not what one bulb on a
  // flex does. Now it falls off and the ends of the room are dim.
  const lamp = new THREE.PointLight(0xffe2a0, 2.5, 14, 1.2);
  put(lamp, 0, H - 0.8, 0);
  const fill = new THREE.PointLight(0xdfe6f0, 0.55, 12, 1.3);
  put(fill, x0 + 2.4, H - 0.9, 0);

  // ── Somebody lived in here ───────────────────────────────
  // A bunk against the far wall, and the shelf by the way in with the two
  // things on it that the game offers you the moment you arrive. They
  // were a line of text and nothing else before this.
  const matMat = new THREE.MeshLambertMaterial({ color: 0x4a5144 });
  const blanketMat = new THREE.MeshLambertMaterial({ color: 0x3b4336 });
  const bunkX = 1.6, bunkZ = z1 - 0.75;
  put(box(2.1, 0.12, 0.9, M.crateTrim()), bunkX, 0.3, bunkZ);
  for (const dx of [-0.9, 0.9]) {
    for (const dz of [-0.35, 0.35]) {
      put(box(0.1, 0.3, 0.1, M.crateTrim()), bunkX + dx, 0.15, bunkZ + dz);
    }
  }
  put(box(2.0, 0.16, 0.8, matMat), bunkX, 0.44, bunkZ);
  const blanket = box(0.9, 0.2, 0.75, blanketMat);
  put(blanket, bunkX - 0.5, 0.58, bunkZ, 0.1);
  const pillow = box(0.5, 0.14, 0.4, matMat);
  put(pillow, bunkX + 0.72, 0.57, bunkZ, -0.2);
  solid(bunkX, bunkZ, 1.15, 0.6);

  // The shelf: two boards, three grenades on the lower one and a field
  // kit on the upper. These are the choice the prompt is talking about.
  // Where you can see it from the spot you arrive on, which is the whole
  // point of it: the game offers you its two things the instant you land
  // in here, and the shelf they are on was out of frame.
  const shelfX = 0.6, shelfZ = z0 + 0.52;
  for (const dx of [-0.85, 0.85]) {
    put(box(0.09, 1.85, 0.5, trimMat), shelfX + dx, 0.92, shelfZ);
  }
  for (const sy of [0.62, 1.22, 1.78]) {
    put(box(1.8, 0.07, 0.5, M.benchTop()), shelfX, sy, shelfZ);
  }
  const kit = put(box(0.52, 0.3, 0.36, M.labCoat()), shelfX - 0.5, 1.4, shelfZ, 0.12);
  put(box(0.3, 0.07, 0.02, new THREE.MeshBasicMaterial({ color: 0xcc2b2b })),
      shelfX - 0.5, 1.42, shelfZ + 0.19, 0.12);
  put(box(0.07, 0.22, 0.02, new THREE.MeshBasicMaterial({ color: 0xcc2b2b })),
      shelfX - 0.5, 1.42, shelfZ + 0.19, 0.12);
  for (let i = 0; i < 3; i++) {
    const nade = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 6), M.ammoBox());
    put(nade, shelfX + 0.1 + i * 0.26, 0.76, shelfZ - 0.04 + (i % 2) * 0.12);
    put(box(0.03, 0.12, 0.03, M.gunMetal()),
        shelfX + 0.1 + i * 0.26, 0.9, shelfZ - 0.04 + (i % 2) * 0.12);
  }
  // Tins and a canteen on the top board, because he had to eat.
  for (let i = 0; i < 4; i++) {
    const tin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.1, 8), M.ammoBox());
    put(tin, shelfX - 0.7 + i * 0.2, 1.86, shelfZ + 0.1);
  }
  solid(shelfX, shelfZ, 0.95);

  // A crate for a table, with what he had on it.
  // Between the ribs, not on one: the ribs stand at x0 + 2.2i, and the
  // first cut of this put the table and the note it is under at -1.1,
  // which is exactly where one of them is. The note read as two sheets
  // with a post down the middle of it.
  const tableX = -2.3, tableZ = z0 + 0.7;
  put(box(1.0, 0.86, 0.8, M.crateMetal()), tableX, 0.43, tableZ, 0.06);
  put(box(1.3, 0.07, 0.95, M.crateWood()), tableX, 0.9, tableZ, 0.06);
  const mug = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.06, 0.12, 8), M.labTrim());
  put(mug, tableX + 0.32, 0.99, tableZ + 0.12);
  put(box(0.26, 0.02, 0.2, M.labCoat()), tableX - 0.2, 0.94, tableZ - 0.05, 0.3);
  const lampShade = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.18, 8, 1, true), trimMat);
  lampShade.rotation.x = Math.PI;
  put(lampShade, tableX - 0.45, 1.08, tableZ - 0.2);
  solid(tableX, tableZ, 0.85, 1.0);

  // What he worked out, pinned over it.
  // Under the rail rather than across it, and clear of the table top.
  const note = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.93),
    new THREE.MeshBasicMaterial({ map: pinnedNoteTexture() }));
  put(note, tableX, 1.52, z0 + 0.12);
  for (const dx of [-0.54, 0.54]) {
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xcc3322 }));
    put(pin, tableX + dx, 1.92, z0 + 0.13);
  }

  // A bucket, a coil of cable, and two crates shoved where they will not
  // be in the way of anybody walking the length of the room.
  const bucket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.17, 0.34, 10), steelMat);
  put(bucket, 3.6, 0.17, z1 - 0.6);
  solid(3.6, z1 - 0.6, 0.3, 0.38);
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 5, 12), darkMat);
  coil.rotation.x = Math.PI / 2;
  put(coil, 4.6, 0.07, z1 - 1.4);
  solid(4.6, z1 - 1.4, 0.38, 0.2);
  for (const [cx, cz, cw, ch, cd, rot] of [
    [x0 + 1.3, z0 + 1.2, 1.0, 0.8, 0.9, 0.2],
    [x0 + 1.1, z1 - 1.3, 0.8, 0.6, 0.8, -0.4],
  ]) {
    const crate = box(cw, ch, cd, M.crateMetal());
    put(crate, cx, ch / 2, cz, rot);
    solid(cx, cz, Math.max(cw, cd) * 0.6, ch + 0.05);
  }

  // ── And what the room is for now ─────────────────────────
  // A ring bolted to the wall where the soldier sits, with the chain still
  // on it. He is put there by the game, not by this file.
  const ringX = x0 + 2.6, ringZ = z1 - 0.18;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 5, 10), darkMat);
  put(ring, ringX, 0.85, ringZ);
  put(box(0.16, 0.16, 0.08, trimMat), ringX, 0.85, ringZ + 0.06);
  for (let i = 0; i < 5; i++) {
    const link = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 4, 8), darkMat);
    link.rotation.x = Math.PI / 2;
    link.rotation.z = i * 0.6;
    put(link, ringX + 0.05 + i * 0.07, 0.78 - i * 0.14, ringZ - 0.1 - i * 0.05);
  }

  // Days, in fives, cut into the plating where he could reach them.
  const scratch = new THREE.MeshBasicMaterial({ color: 0x2a2320 });
  for (let b = 0; b < 6; b++) {
    const bz = -2.0 + b * 0.78;
    const full = b < 5;
    const n = full ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3 + rand() * 0.06, 0.02),
        scratch);
      s.position.set(x1 - 0.12, 1.1, bz + i * 0.1);
      s.rotation.x = (rand() - 0.5) * 0.14;
      group.add(s);
    }
    if (full) {                         // the fifth, struck across the four
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.44, 0.02), scratch);
      s.position.set(x1 - 0.12, 1.1, bz + 0.15);
      s.rotation.x = 1.0;
      group.add(s);
    }
  }

  // A panel off the wall with the loom behind it showing — this room is
  // somewhere between two others, and nothing in here was finished.
  put(box(0.06, 0.9, 1.1, darkMat), x1 - 0.1, 1.5, z0 + 1.6);
  for (let i = 0; i < 5; i++) {
    const wire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.7 + rand() * 0.5, 5),
      i % 2 ? new THREE.MeshLambertMaterial({ color: 0x7a2f2f })
            : new THREE.MeshLambertMaterial({ color: 0x2f4a7a }));
    wire.rotation.z = 0.3 + rand() * 0.5;
    wire.rotation.x = (rand() - 0.5) * 0.6;
    put(wire, x1 - 0.22, 1.5 - i * 0.12, z0 + 1.3 + i * 0.16);
  }
  const leaning = box(0.05, 1.0, 1.1, trimMat);   // the panel itself
  put(leaning, x1 - 0.42, 0.5, z0 + 2.6, 0.2);
  leaning.rotation.z = 0.22;
  solid(x1 - 0.42, z0 + 2.6, 0.6, 1.05);

  // A drain in the deck, because somebody washed this floor down once.
  const drain = new THREE.Mesh(new THREE.CircleGeometry(0.26, 12), darkMat);
  drain.rotation.x = -Math.PI / 2;
  put(drain, -3.0, 0.012, 2.4);
  for (let i = 0; i < 5; i++) {
    put(box(0.44, 0.012, 0.04, trimMat), -3.0, 0.02, 2.2 + i * 0.1);
  }

  // ── The way out ──────────────────────────────────────────
  // A hatch, dogged shut, with a wheel on it and a light that says it
  // still works. It used to be a plain slab with a green dot over it.
  const hatchX = x0 + 0.12;
  put(box(0.1, 2.3, 1.7, trimMat), hatchX + 0.02, 1.15, 0);       // frame
  const leaf = put(box(0.14, 2.0, 1.4, steelMat), hatchX + 0.08, 1.0, 0);
  for (const [dy, dz] of [[0.78, 0.55], [0.78, -0.55], [-0.78, 0.55], [-0.78, -0.55]]) {
    put(box(0.1, 0.16, 0.16, darkMat), hatchX + 0.17, 1.0 + dy, dz);   // dogs
  }
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x8e959b });
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.055, 6, 16), wheelMat);
  wheel.rotation.y = Math.PI / 2;
  put(wheel, hatchX + 0.24, 1.0, 0);
  for (let i = 0; i < 4; i++) {
    const spoke = box(0.05, 0.64, 0.05, wheelMat);
    spoke.rotation.x = i * Math.PI / 4;
    put(spoke, hatchX + 0.24, 1.0, 0);
  }
  // Stencilled, rather than a blank white bar with nothing on it.
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.22),
    new THREE.MeshBasicMaterial({ map: stencilStrip('MAINT. 7') }));
  label.rotation.y = Math.PI / 2;
  put(label, hatchX + 0.17, 2.15, 0);
  for (let i = 0; i < 5; i++) {                                      // hazard
    const st = box(0.03, 0.2, 0.18, M.hazard());
    st.rotation.x = 0.6;
    put(st, hatchX + 0.17, 0.18, -0.5 + i * 0.25);
  }
  const hatchLamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0x44ff88 }));
  put(hatchLamp, hatchX + 0.26, 2.5, 0);
  const hatchGlow = new THREE.PointLight(0x44ff88, 0.7, 5, 1.4);
  put(hatchGlow, hatchX + 0.5, 2.4, 0);

  group.traverse((o) => { if (o.isMesh) o.userData.isWall = true; });
  scene.add(group);

  // The bulb is not well. Mostly it sits still; every few seconds it dips
  // for a tenth of a second, which is the difference between a room with a
  // light in it and a room nobody has been able to fix.
  let clock = 0, dipLeft = 0, nextDip = 3 + rand() * 5;
  function tick(dt) {
    clock += dt;
    if (dipLeft > 0) {
      dipLeft -= dt;
      const k = 0.4 + Math.random() * 0.45;
      lamp.intensity = 2.5 * k;
      bulbMat.color.setRGB(1, 0.7 + k * 0.21, 0.4 + k * 0.29);
      if (dipLeft <= 0) {
        lamp.intensity = 2.5;
        bulbMat.color.setHex(0xffe9b0);
        nextDip = clock + 3 + Math.random() * 7;
      }
    } else if (clock >= nextDip) {
      dipLeft = 0.06 + Math.random() * 0.14;
    }
  }

  return {
    group,
    tick,
    // Pushed into the level's wall list by the caller, or you walk out of it.
    walls: [
      { axis: 'z', pos: at.z + z0, min: at.x + x0, max: at.x + x1 },
      { axis: 'z', pos: at.z + z1, min: at.x + x0, max: at.x + x1 },
      { axis: 'x', pos: at.x + x0, min: at.z + z0, max: at.z + z1 },
      { axis: 'x', pos: at.x + x1, min: at.z + z0, max: at.z + z1 },
    ],
    colliders,
    // Where you land coming in, and where you stand to leave.
    arrive: { x: at.x + x1 - 1.6, z: at.z },
    exit: { x: at.x + x0 + 1.4, z: at.z },
    bounds: { x0: at.x + x0, x1: at.x + x1, z0: at.z + z0, z1: at.z + z1 },
  };
}

// ─── THE SPACE DOOR ─────────────────────────────────────────
//
// FLETCHER'S GUIDE:
// A launch door in the Control Room's north wall, which is one of the walls
// with nothing behind it but the outside. Shut, it is a slab of armour with
// a red lamp. Open, it is a hole in the station with the stars behind it,
// and the escape pod parked in front of it goes out through it.
//
// It does NOT suck you out. The breach in the Hangar does, because that is a
// hole something tore; this is a door, with the station still holding its
// air on this side of it. That is the whole reason the pod moved in here.
export function buildSpaceDoor(scene, at) {
  const g = new THREE.Group();
  const { x0, x1, z, side = 1 } = at;
  const W = x1 - x0, cx = (x0 + x1) / 2, H = WALL_H;

  // The outside, behind everything else.
  g.add(spaceWall(x0, x1, z, side));

  const steel = M.metal(), dark = M.hullDk(), stripe = M.hazard();

  // Frame: jambs either side and a head across the top.
  for (const jx of [x0, x1]) {
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.5, H, 0.7), dark);
    jamb.position.set(jx + (jx === x0 ? 0.25 : -0.25), H / 2, z + side * 0.35);
    g.add(jamb);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(W + 1.0, 0.6, 0.8), dark);
  head.position.set(cx, H - 0.3, z + side * 0.35);
  g.add(head);

  // Two leaves, meeting in the middle, sliding apart into the jambs.
  const leafW = W / 2 - 0.02;
  const leafH = H - 0.6;
  const leaves = [];
  for (const sideSign of [-1, 1]) {
    const lg = new THREE.Group();
    g.add(lg);
    leaves.push({ group: lg, side: sideSign });
    const lx = cx + sideSign * (leafW / 2 + 0.01);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(leafW, leafH, 0.42), steel);
    leaf.position.set(lx, leafH / 2, z + side * 0.3);
    lg.add(leaf);
    // Ribs across it, and hazard stripes along the bottom edge.
    for (let i = 0; i < 3; i++) {
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(leafW * 0.86, 0.18, 0.1), dark);
      rib.position.set(lx, leafH * (0.25 + i * 0.26), z + side * 0.52);
      lg.add(rib);
    }
    for (let i = 0; i < 5; i++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.26, 0.06), stripe);
      st.position.set(lx - leafW * 0.35 + i * leafW * 0.18, 0.3, z + side * 0.54);
      st.rotation.z = 0.5;
      lg.add(st);
    }
  }

  // The lamp over it: red while it is shut, green once it is open.
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xff2233 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), lampMat);
  lamp.position.set(cx, H - 0.72, z + side * 0.8);
  g.add(lamp);
  const glow = new THREE.PointLight(0xff2233, 1.2, 9);
  glow.position.copy(lamp.position);
  g.add(glow);

  g.traverse((o) => { if (o.isMesh) o.userData.isWall = true; });
  scene.add(g);
  g.userData = { leaves, lampMat, glow, open: false, openAmount: 0,
                 travel: leafW };

  return {
    group: g,
    // Shut, it is a wall. The caller puts this in the level's wall list and
    // takes it back out when it opens.
    wall: { axis: 'z', pos: z, min: x0, max: x1 },
  };
}

/** Tell it to open. The movement is in updateSpaceDoor. */
export function setSpaceDoorOpen(door, open) {
  const d = door.group.userData;
  d.open = open;
  d.lampMat.color.setHex(open ? 0x44ff88 : 0xff2233);
  d.glow.color.setHex(open ? 0x44ff88 : 0xff2233);
  if (!open) {
    d.openAmount = 0;
    for (const l of d.leaves) l.group.position.x = 0;
  }
}

export function updateSpaceDoor(door, dt) {
  const d = door.group.userData;
  const want = d.open ? 1 : 0;
  if (d.openAmount === want) return;
  d.openAmount = Math.min(1, d.openAmount + dt * 0.35);
  const e = d.openAmount * d.openAmount * (3 - 2 * d.openAmount);
  for (const l of d.leaves) l.group.position.x = l.side * e * d.travel;
}

// ─── PHOTOGRAPHS ────────────────────────────────────────────
//
// FLETCHER'S GUIDE:
// Framed pictures on the walls of every room: the people who lived here,
// doing the things people do. Fighting, eating, training, standing about
// having their photo taken.
//
// There are no textures in this game, so a photograph has to be BUILT — each
// one is a little flat diorama of coloured boxes standing a few millimetres
// off a backing board. Drawn small and seen from across a room that reads as
// a picture, which is all it has to do.
//
// Everything is in picture space: x and y from 0 to 1 across the frame, so a
// scene can be written down once and then hung at any size.
const PIC = {
  sepia:  0xb9a888,     // the paper
  ink:    0x3b332a,     // figures
  inkLt:  0x6d6050,     // figures further back
  frame:  0x4a4036,
  glass:  0x2b2721,
  flash:  0xe8c87a,     // muzzle flare
  alien:  0x2f3a30,
  table:  0x6b5a44,
  metal:  0x7c7a72,
};

/**
 * A person in picture space, standing about 0.42 of the frame's height.
 *
 * The first version drew them at a sixth of that and the pictures read as
 * blank sepia rectangles from anywhere but nose-to-the-glass. A figure in a
 * photograph on a wall has to be a large fraction of the photograph or there
 * is no picture, only a frame.
 */
function picFigure(out, x, y, s, col, pose = 'stand') {
  const H = 0.42 * s;            // head to foot
  const bw = 0.09 * s;           // shoulders
  const hd = 0.085 * s;          // head
  const legH = H * 0.38, torsoH = H * 0.4;

  if (pose === 'sit') {
    out.push({ x, y: y + torsoH * 0.5, w: bw, h: torsoH, c: col });
    out.push({ x, y: y + torsoH + hd * 0.55, w: hd, h: hd, c: col });
    out.push({ x: x + bw * 0.95, y: y - legH * 0.1, w: bw * 1.5, h: bw * 0.55, c: col });
    return;
  }
  if (pose === 'press') {        // flat out, arms under
    out.push({ x, y: y + bw * 0.5, w: H * 0.82, h: bw * 0.62, c: col });
    out.push({ x: x - H * 0.44, y: y + bw * 0.75, w: hd, h: hd, c: col });
    for (const ox of [-H * 0.2, H * 0.2]) {
      out.push({ x: x + ox, y: y + bw * 0.1, w: bw * 0.42, h: bw * 0.8, c: col });
    }
    return;
  }

  // Legs, torso, head — the shared spine of every upright pose.
  out.push({ x: x - bw * 0.26, y: y + legH * 0.5, w: bw * 0.36, h: legH, c: col });
  out.push({ x: x + bw * 0.26, y: y + legH * 0.5, w: bw * 0.36, h: legH, c: col });
  out.push({ x, y: y + legH + torsoH * 0.5, w: bw, h: torsoH, c: col });
  out.push({ x, y: y + legH + torsoH + hd * 0.55, w: hd, h: hd, c: col });

  const shoulderY = y + legH + torsoH * 0.82;
  if (pose === 'star') {         // arms out and up
    for (const sdir of [-1, 1]) {
      out.push({ x: x + sdir * bw * 0.92, y: shoulderY + torsoH * 0.22,
                 w: bw * 0.9, h: bw * 0.34, c: col });
    }
  } else if (pose === 'aim') {   // both arms forward, holding something
    out.push({ x: x + bw * 0.95, y: shoulderY, w: bw * 1.0, h: bw * 0.34, c: col });
  } else if (pose === 'crouch') {
    out.push({ x: x + bw * 0.9, y: shoulderY - torsoH * 0.1,
               w: bw * 0.95, h: bw * 0.32, c: col });
  } else {                       // arms down by the sides
    for (const sdir of [-1, 1]) {
      out.push({ x: x + sdir * bw * 0.72, y: y + legH + torsoH * 0.42,
                 w: bw * 0.3, h: torsoH * 0.82, c: col });
    }
  }
}

/** A rifle held out level, from a figure at x. */
function picRifle(out, x, y, s, col) {
  out.push({ x: x + 0.14 * s, y, w: 0.2 * s, h: 0.022 * s, c: col });
}

const PIC_SCENES = {
  // Two of them firing at something coming out of the dark.
  fighting(out) {
    out.push({ x: 0.5, y: 0.1, w: 1.0, h: 0.2, c: PIC.inkLt });          // ground
    picFigure(out, 0.2, 0.2, 1.0, PIC.ink, 'aim');
    picRifle(out, 0.2, 0.47, 1.0, PIC.ink);
    picFigure(out, 0.42, 0.2, 1.0, PIC.ink, 'aim');
    picRifle(out, 0.42, 0.47, 1.0, PIC.ink);
    out.push({ x: 0.62, y: 0.47, w: 0.07, h: 0.045, c: PIC.flash });
    out.push({ x: 0.4, y: 0.47, w: 0.06, h: 0.04, c: PIC.flash });
    // The thing they are shooting at.
    out.push({ x: 0.84, y: 0.36, w: 0.26, h: 0.14, c: PIC.alien });
    for (const lx of [0.73, 0.8, 0.88, 0.95]) {
      out.push({ x: lx, y: 0.22, w: 0.022, h: 0.17, c: PIC.alien });
    }
    out.push({ x: 0.79, y: 0.4, w: 0.035, h: 0.035, c: 0xa8302a });      // eye
  },

  // Mess table.
  eating(out) {
    out.push({ x: 0.5, y: 0.3, w: 0.84, h: 0.055, c: PIC.table });       // top
    out.push({ x: 0.14, y: 0.17, w: 0.045, h: 0.21, c: PIC.table });
    out.push({ x: 0.86, y: 0.17, w: 0.045, h: 0.21, c: PIC.table });
    picFigure(out, 0.26, 0.3, 0.92, PIC.ink, 'sit');
    picFigure(out, 0.52, 0.3, 0.92, PIC.ink, 'sit');
    picFigure(out, 0.78, 0.3, 0.92, PIC.ink, 'sit');
    for (const px of [0.3, 0.56, 0.82]) {
      out.push({ x: px, y: 0.335, w: 0.08, h: 0.022, c: PIC.sepia });    // trays
    }
  },

  // Drill, in a line.
  training(out) {
    out.push({ x: 0.5, y: 0.1, w: 1.0, h: 0.2, c: PIC.inkLt });
    picFigure(out, 0.17, 0.2, 0.95, PIC.ink, 'star');
    picFigure(out, 0.39, 0.2, 0.95, PIC.ink, 'stand');
    picFigure(out, 0.61, 0.2, 0.95, PIC.ink, 'star');
    picFigure(out, 0.83, 0.2, 0.95, PIC.ink, 'stand');
  },

  // Press-ups, watched by the one counting.
  pressups(out) {
    out.push({ x: 0.5, y: 0.1, w: 1.0, h: 0.2, c: PIC.inkLt });
    picFigure(out, 0.3, 0.2, 1.05, PIC.ink, 'press');
    picFigure(out, 0.3, 0.42, 1.05, PIC.ink, 'press');
    picFigure(out, 0.82, 0.2, 1.0, PIC.ink, 'stand');
  },

  // The squad, lined up for the camera.
  squad(out) {
    out.push({ x: 0.5, y: 0.09, w: 1.0, h: 0.18, c: PIC.inkLt });
    let x = 0.16;
    for (let i = 0; i < 4; i++) {
      picFigure(out, x, 0.18, i === 1 ? 1.06 : 0.96, PIC.ink, 'stand');
      x += 0.23;
    }
  },

  // On shift at the consoles.
  console(out) {
    out.push({ x: 0.5, y: 0.74, w: 0.9, h: 0.34, c: PIC.inkLt });        // bank
    for (let i = 0; i < 4; i++) {
      out.push({ x: 0.18 + i * 0.215, y: 0.75, w: 0.16, h: 0.26, c: PIC.glass });
    }
    out.push({ x: 0.5, y: 0.3, w: 0.94, h: 0.07, c: PIC.table });        // desk
    picFigure(out, 0.3, 0.3, 0.95, PIC.ink, 'stand');
    picFigure(out, 0.68, 0.3, 0.95, PIC.ink, 'stand');
  },

  // The station from outside, before any of this.
  station(out) {
    out.push({ x: 0.5, y: 0.5, w: 1.0, h: 1.0, c: PIC.glass });
    out.push({ x: 0.48, y: 0.47, w: 0.66, h: 0.16, c: PIC.metal });
    out.push({ x: 0.26, y: 0.47, w: 0.14, h: 0.36, c: PIC.metal });
    out.push({ x: 0.72, y: 0.47, w: 0.14, h: 0.28, c: PIC.metal });
    out.push({ x: 0.48, y: 0.66, w: 0.1, h: 0.14, c: PIC.metal });
    for (const [sx, sy] of [[0.12,0.84],[0.3,0.76],[0.84,0.86],[0.9,0.62],
                            [0.16,0.18],[0.74,0.14],[0.5,0.9],[0.62,0.26]]) {
      out.push({ x: sx, y: sy, w: 0.022, h: 0.022, c: PIC.sepia });
    }
  },
};

/**
 * One framed picture, hung flat on a wall.
 * `face` is the direction it looks out in: 'x+', 'x-', 'z+', 'z-'.
 */
export function buildWallPicture(parent, { x, y, z, face, kind, w = 1.5 }) {
  const g = new THREE.Group();
  const h = w * 0.72;
  const shapes = [];
  (PIC_SCENES[kind] || PIC_SCENES.squad)(shapes);

  g.add(new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.05),
    new THREE.MeshLambertMaterial({ color: PIC.frame })));
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshLambertMaterial({ color: PIC.sepia }));
  paper.position.z = 0.027;
  g.add(paper);

  // Everything in the scene, merged by colour so one picture is a handful of
  // draw calls rather than forty.
  const byColour = new Map();
  for (const s of shapes) {
    if (!byColour.has(s.c)) byColour.set(s.c, []);
    byColour.get(s.c).push(s);
  }
  let depth = 0.03;
  for (const [col, list] of byColour) {
    const verts = [];
    for (const s of list) {
      pushBox(verts, (s.x - 0.5) * w, (s.y - 0.5) * h, depth,
              s.w * w, s.h * h, 0.004);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: col })));
    depth += 0.0015;                       // so coplanar colours can't z-fight
  }

  g.position.set(x, y, z);
  g.rotation.y = face === 'x+' ? Math.PI / 2 : face === 'x-' ? -Math.PI / 2
               : face === 'z-' ? Math.PI : 0;
  parent.add(g);
  return g;
}

/**
 * Hang pictures round a room, on walls that actually exist.
 *
 * The rooms are irregular — painted cell by cell in the Map Editor — so the
 * bounding box is a poor guide to where the walls are. Rather than writing
 * down twenty positions by hand and getting several of them wrong, this
 * walks the room's floor and finds every cell edge where the floor stops.
 * That edge IS a wall, and the picture faces back into the room.
 *
 * `avoid` is a list of {x, z, r} to keep clear of: the big window, the
 * attack board, the launch door — the walls that are already something.
 */
export function hangPictures(scene, room, kinds, opts = {}) {
  const group = new THREE.Group();
  const CS = 2, EPS = 0.06;
  const avoid = opts.avoid || [];
  const y = opts.y === undefined ? 2.05 : opts.y;
  const minApart = opts.minApart === undefined ? 4.5 : opts.minApart;
  const rand = rng(opts.seed || 7781);

  const spots = [];
  for (let x = room.x0 + CS / 2; x < room.x1; x += CS) {
    for (let z = room.z0 + CS / 2; z < room.z1; z += CS) {
      if (!isFloorAt(x, z)) continue;
      const sides = [
        [!isFloorAt(x - CS, z), x - CS / 2 + EPS, z, 'x+'],
        [!isFloorAt(x + CS, z), x + CS / 2 - EPS, z, 'x-'],
        [!isFloorAt(x, z - CS), x, z - CS / 2 + EPS, 'z+'],
        [!isFloorAt(x, z + CS), x, z + CS / 2 - EPS, 'z-'],
      ];
      for (const [isWall, wx, wz, face] of sides) {
        if (!isWall) continue;
        if (avoid.some((a) => Math.hypot(wx - a.x, wz - a.z) < a.r)) continue;
        spots.push({ x: wx, z: wz, face, k: rand() });
      }
    }
  }

  // Spread them out rather than clustering three in one corner.
  spots.sort((a, b) => a.k - b.k);
  const chosen = [];
  for (const s of spots) {
    if (chosen.length >= kinds.length) break;
    if (chosen.some((c) => Math.hypot(c.x - s.x, c.z - s.z) < minApart)) continue;
    chosen.push(s);
  }

  chosen.forEach((s, i) => {
    buildWallPicture(group, { x: s.x, y, z: s.z, face: s.face,
                              kind: kinds[i % kinds.length],
                              w: opts.w || 1.5 });
  });

  group.traverse((o) => { if (o.isMesh) o.userData.isWall = true; });
  scene.add(group);
  return { group, hung: chosen.length, wanted: kinds.length };
}

// ─── WHAT HAPPENED HERE ─────────────────────────────────────
//
// FLETCHER'S GUIDE:
// Marks left behind. Not decoration — each of these says something, and the
// saying is the point:
//
//   DRAG MARKS   somebody did not walk out of this room
//   HANDPRINTS   they went UP the wall, which means they went backwards
//   CLAW GOUGES  what did it is about this tall and came through here often
//   SPILLED KIT  somebody dropped what they were carrying and ran
//   LIFTED PANEL somebody was under the floor trying to fix it when it came
//
// All of them are flat geometry in one or two draw calls each, because there
// are a lot of them and none of them needs to be more than a stain.

/** A tapering smear, from a point and heading somewhere. */
function dragMark(len, angle, seed) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const mat = M.blood();
  const steps = Math.max(4, Math.round(len * 3));
  const verts = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const d = t * len;
    const w = (0.55 - t * 0.42) * (0.7 + rand() * 0.6);   // thins as it goes
    const cx = Math.sin(angle) * d + (rand() - 0.5) * 0.14;
    const cz = Math.cos(angle) * d + (rand() - 0.5) * 0.14;
    pushBox(verts, cx, 0.014, cz, w, 0.004, w * (0.8 + rand() * 0.5));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, mat));
  return g;
}

/** Four fingers and a palm, smeared downward. `face` is the way it looks. */
function handPrints(count, seed) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const mat = M.blood();
  const verts = [];
  for (let h = 0; h < count; h++) {
    // Each print lower and further along than the last: he was going
    // backwards and holding on.
    const ox = h * (0.42 + rand() * 0.2);
    const oy = -h * (0.3 + rand() * 0.18);
    pushBox(verts, ox, oy, 0, 0.11, 0.13, 0.01);                  // palm
    for (let f = 0; f < 4; f++) {
      pushBox(verts, ox - 0.05 + f * 0.034, oy + 0.11, 0, 0.022,
              0.08 + rand() * 0.05, 0.01);                        // fingers
    }
    // And the streak it left on the way down.
    pushBox(verts, ox, oy - 0.2, 0, 0.055, 0.34, 0.008);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, mat));
  return g;
}

/** Parallel scoring, the width of something's hand. */
function clawGouges(sets, seed) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const mat = new THREE.MeshLambertMaterial({ color: 0x5c524a });
  const verts = [];
  for (let s = 0; s < sets; s++) {
    const bx = (rand() - 0.5) * 1.1;
    const by = (rand() - 0.5) * 0.5;
    const lean = (rand() - 0.5) * 0.5;
    for (let c = 0; c < 4; c++) {
      const h = 0.4 + rand() * 0.5;
      pushBox(verts, bx + c * 0.075 + lean * c * 0.05, by, 0, 0.022, h, 0.012);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, mat));
  return g;
}

/** A dropped box with its contents thrown clear. */
function spilledKit(kind, seed) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const boxMat = kind === 'ammo' ? M.ammoBox() : M.crateMetal();
  const bits = kind === 'ammo' ? M.brass() : M.gunMetal();

  const box = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.26, 0.34), boxMat);
  box.position.set(0, 0.13, 0);
  box.rotation.z = 1.35;                       // tipped over
  box.rotation.y = rand() * 0.7;
  g.add(box);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.32), boxMat);
  lid.position.set(0.42, 0.02, 0.2);
  lid.rotation.y = 0.8 + rand();
  g.add(lid);

  // The contents, thrown in the direction it fell.
  const verts = [];
  for (let i = 0; i < 11; i++) {
    const a = rand() * Math.PI * 2, d = 0.35 + rand() * 1.1;
    pushBox(verts, Math.cos(a) * d, 0.025, Math.sin(a) * d,
            0.05 + rand() * 0.1, 0.05, 0.03 + rand() * 0.07);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, bits));
  return g;
}

/** A floor plate lifted out and leaned aside, cables in the hole. */
function liftedPanel(seed) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const plate = M.metal(), dark = M.hullDk();

  // The hole, and the dark underneath it.
  const hole = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 1.1),
    new THREE.MeshBasicMaterial({ color: 0x0d1013 }));
  hole.position.y = 0.012;
  g.add(hole);
  for (let i = 0; i < 4; i++) {
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.9 + rand() * 0.2, 5),
      i % 2 ? dark : M.crateTrim());
    cable.rotation.z = Math.PI / 2;
    cable.rotation.y = rand() * Math.PI;
    cable.position.set((rand() - 0.5) * 0.4, 0.05, (rand() - 0.5) * 0.5);
    g.add(cable);
  }
  // The plate itself, stood on edge against the hole.
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 1.1), plate);
  panel.position.set(0.72, 0.5, 0.1);
  panel.rotation.z = 1.25;
  panel.rotation.y = 0.2 + rand() * 0.3;
  g.add(panel);
  // And the tool left in the hole.
  const tool = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.07), M.gunMetal());
  tool.position.set(-0.2, 0.06, 0.25);
  tool.rotation.y = 0.9;
  g.add(tool);
  return g;
}

/**
 * Wall spots in a room: every cell edge where the floor stops.
 *
 * Pulled out of hangPictures so the marks can hang off the same walls the
 * photographs do, and so there is one place that knows how to find a wall in
 * a room that was painted cell by cell rather than drawn as a rectangle.
 */
export function wallSpotsIn(room, opts = {}) {
  const CS = 2, EPS = opts.eps === undefined ? 0.06 : opts.eps;
  const avoid = opts.avoid || [];
  const out = [];
  const rand = rng(opts.seed || 5150);
  for (let x = room.x0 + CS / 2; x < room.x1; x += CS) {
    for (let z = room.z0 + CS / 2; z < room.z1; z += CS) {
      if (!isFloorAt(x, z)) continue;
      const sides = [
        [!isFloorAt(x - CS, z), x - CS / 2 + EPS, z, 'x+'],
        [!isFloorAt(x + CS, z), x + CS / 2 - EPS, z, 'x-'],
        [!isFloorAt(x, z - CS), x, z - CS / 2 + EPS, 'z+'],
        [!isFloorAt(x, z + CS), x, z + CS / 2 - EPS, 'z-'],
      ];
      for (const [isWall, wx, wz, face] of sides) {
        if (!isWall) continue;
        if (avoid.some((a) => Math.hypot(wx - a.x, wz - a.z) < a.r)) continue;
        out.push({ x: wx, z: wz, face, k: rand() });
      }
    }
  }
  out.sort((a, b) => a.k - b.k);
  return out;
}

const FACE_ROT = { 'x+': Math.PI / 2, 'x-': -Math.PI / 2, 'z-': Math.PI, 'z+': 0 };

/** Floor spots: painted cells clear of everything in `avoid`. */
function floorSpotsIn(room, avoid, seed) {
  const CS = 2;
  const out = [];
  const rand = rng(seed || 2468);
  for (let x = room.x0 + CS / 2; x < room.x1; x += CS) {
    for (let z = room.z0 + CS / 2; z < room.z1; z += CS) {
      if (!isFloorAt(x, z)) continue;
      if (avoid.some((a) => Math.hypot(x - a.x, z - a.z) < a.r)) continue;
      out.push({ x, z, k: rand() });
    }
  }
  out.sort((a, b) => a.k - b.k);
  return out;
}

/**
 * Scatter the aftermath through one room.
 *
 * `want` says how many of each: { drags, hands, claws, kit, panel }. Spots
 * are found from the room's own floor rather than written down, for the same
 * reason the photographs are — most of these rooms are not rectangles.
 */
export function addAftermath(scene, room, want = {}, opts = {}) {
  const group = new THREE.Group();
  // Everything the room already has standing in it, grown by a margin. The
  // room scan only knows where the FLOOR stops — it has no idea that the
  // prison's west wall has a block of cells in front of it, so the first
  // version painted handprints on the inside of a sealed cell where nobody
  // could ever see them. The props all carry colliders; using them is both
  // more accurate than a hand-written list and impossible to forget to
  // update when a room gains something new.
  const solid = (opts.solid || []).map((c) => ({ x: c.x, z: c.z, r: c.r + 1.1 }));
  const avoid = (opts.avoid || []).concat(solid);
  const seed = opts.seed || 9090;
  const rand = rng(seed);
  const colliders = [];

  // ── Walls ─────────────────────────────────────────────────
  const wallSpots = wallSpotsIn(room, { avoid, seed: seed + 11, eps: 0.05 });
  let wi = 0;
  const takeWall = (minApart, used) => {
    while (wi < wallSpots.length) {
      const s = wallSpots[wi++];
      if (used.some((u) => Math.hypot(u.x - s.x, u.z - s.z) < minApart)) continue;
      used.push(s);
      return s;
    }
    return null;
  };
  const usedWall = [];
  for (let i = 0; i < (want.hands || 0); i++) {
    const s = takeWall(5, usedWall);
    if (!s) break;
    const m = handPrints(2 + Math.round(rand()), seed + 70 + i);
    m.position.set(s.x, 1.55, s.z);
    m.rotation.y = FACE_ROT[s.face];
    group.add(m);
  }
  for (let i = 0; i < (want.claws || 0); i++) {
    const s = takeWall(4, usedWall);
    if (!s) break;
    const m = clawGouges(1 + Math.round(rand()), seed + 130 + i);
    m.position.set(s.x, 1.25 + rand() * 0.35, s.z);
    m.rotation.y = FACE_ROT[s.face];
    group.add(m);
  }

  // ── Floor ─────────────────────────────────────────────────
  const floorSpots = floorSpotsIn(room, avoid.concat(opts.floorAvoid || []), seed + 23);
  let fi = 0;
  const usedFloor = [];
  const takeFloor = (minApart) => {
    while (fi < floorSpots.length) {
      const s = floorSpots[fi++];
      if (usedFloor.some((u) => Math.hypot(u.x - s.x, u.z - s.z) < minApart)) continue;
      usedFloor.push(s);
      return s;
    }
    return null;
  };
  for (let i = 0; i < (want.drags || 0); i++) {
    const s = takeFloor(4.5);
    if (!s) break;
    const m = dragMark(1.6 + rand() * 1.8, rand() * Math.PI * 2, seed + 200 + i);
    m.position.set(s.x, 0, s.z);
    group.add(m);
  }
  for (let i = 0; i < (want.kit || 0); i++) {
    const s = takeFloor(4);
    if (!s) break;
    const m = spilledKit(rand() < 0.5 ? 'ammo' : 'tools', seed + 300 + i);
    m.position.set(s.x, 0, s.z);
    m.rotation.y = rand() * Math.PI * 2;
    group.add(m);
    colliders.push({ x: s.x, z: s.z, r: 0.42, h: 0.3 });   // walked over
  }
  for (let i = 0; i < (want.panel || 0); i++) {
    const s = takeFloor(5);
    if (!s) break;
    const m = liftedPanel(seed + 400 + i);
    m.position.set(s.x, 0, s.z);
    m.rotation.y = rand() * Math.PI * 2;
    group.add(m);
    // The plate standing on edge: too tall to walk through, low enough to
    // jump, and a thing you can stand on once you are up there.
    colliders.push({ x: s.x + 0.7, z: s.z, r: 0.5, h: 0.95 });
  }

  group.traverse((o) => { if (o.isMesh) o.userData.isWall = true; });
  scene.add(group);
  return { group, colliders };
}
