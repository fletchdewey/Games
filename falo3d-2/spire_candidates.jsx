import { useState, useEffect, useRef } from "react";
import * as THREE from "three";

// Nine candidates to replace the Spire.
//
// The Spire's ROLE stays fixed — it's the roster's ranged attacker (12-unit
// range, lobs a projectile, squishy up close). Every design here can do that
// job. What changes is what you're looking at.
//
// They're deliberately spread across different silhouettes, because the
// replacement also has to stay distinct from the other three: Crawler is low
// and long, Brute is bulk and shoulders, Floater is a round hoverer.

const PAL = {
  skin1: 0x2a3a2a, skin2: 0x3b2040, skin3: 0x1a2a3a, skin4: 0x3a2a1a,
  skin5: 0x33283a, bone: 0xc8b8a0, armor: 0x2a2a38, armorLt: 0x3a3a4a,
  glowGreen: 0x44ff88, glowPink: 0xff44cc, glowCyan: 0x44ccff,
  glowOrange: 0xffaa22, glowAcid: 0xaaff33, eye: 0xff2222,
  mech: 0x4a5058, chitin: 0x22202c,
};

const M = (color) => new THREE.MeshLambertMaterial({ color });
const G = (color) => new THREE.MeshBasicMaterial({ color });

// Cone with its origin at the base, so you place it where it sprouts from.
function spike(mat, r, len, seg = 4) {
  const geo = new THREE.ConeGeometry(r, len, seg);
  geo.translate(0, len / 2, 0);
  return new THREE.Mesh(geo, mat);
}

// Parent-child leg chain so the joints stay connected however it animates.
// lowerSplay bends the knee sideways, which is what gives a raised spider knee.
function legChain({ upperLen, lowerLen, upperR, lowerR, mat, boneMat,
                    upperTilt = 0, lowerTilt = 0, lowerSplay = 0, footSize = 0 }) {
  const hip = new THREE.Group();
  const ug = new THREE.CylinderGeometry(upperR, upperR * 0.8, upperLen, 5);
  ug.translate(0, -upperLen / 2, 0);
  const upper = new THREE.Mesh(ug, mat);
  upper.rotation.x = upperTilt;
  hip.add(upper);

  const knee = new THREE.Group();
  knee.position.y = -upperLen;
  upper.add(knee);
  knee.add(new THREE.Mesh(new THREE.SphereGeometry(upperR * 1.15, 5, 4), mat));

  const lg = new THREE.CylinderGeometry(upperR * 0.8, lowerR, lowerLen, 5);
  lg.translate(0, -lowerLen / 2, 0);
  const lower = new THREE.Mesh(lg, mat);
  lower.rotation.x = lowerTilt;
  lower.rotation.z = lowerSplay;
  knee.add(lower);

  const foot = new THREE.Group();
  foot.position.y = -lowerLen;
  lower.add(foot);
  if (footSize) {
    const f = spike(boneMat, footSize, footSize * 3);
    f.rotation.x = 2.2;
    foot.add(f);
  }
  return { hip, upper, knee, lower, foot };
}

// Radial ring of legs — used by most of these, so it's worth factoring out.
function ringLegs(g, count, radius, y, opts, startAngle = 0) {
  const legs = [];
  for (let i = 0; i < count; i++) {
    const a = startAngle + (i / count) * Math.PI * 2;
    const leg = legChain(opts);
    leg.hip.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
    leg.hip.rotation.y = -a;
    leg.hip.rotation.z = opts.splay || 0;
    g.add(leg.hip);
    legs.push({ ...leg, baseUpperTilt: opts.upperTilt || 0, baseLowerTilt: opts.lowerTilt || 0 });
  }
  return legs;
}


// ─── 1. ARTILLERY TICK ──────────────────────────────────────
// Bloated sac on stubby legs with a mortar tube grown out of its back.
// Lobs arcing shells — the only one here that could shoot over cover.
function buildTick() {
  const g = new THREE.Group();
  const sk = M(PAL.skin4), bn = M(PAL.bone), ar = M(PAL.armor), gl = G(PAL.glowOrange);

  const bodyGeo = new THREE.SphereGeometry(0.72, 7, 6);
  bodyGeo.scale(1.05, 0.9, 1.15);
  const body = new THREE.Mesh(bodyGeo, sk);
  body.position.y = 0.78;
  g.add(body);

  // Segment ridges across the sac
  for (let i = 0; i < 4; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.5 - i * 0.07, 0.05, 4, 10), ar);
    r.position.set(0, 0.78 + i * 0.1, -0.1 - i * 0.12);
    r.rotation.x = Math.PI * 0.5 - 0.3;
    g.add(r);
  }

  // Mortar tube — the thing that says "artillery"
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 1.0, 7), ar);
  tube.position.set(0, 1.35, -0.35);
  tube.rotation.x = -0.55;
  g.add(tube);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.05, 4, 8), bn);
  mouth.position.set(0, 1.78, 0.02);
  mouth.rotation.x = Math.PI * 0.5 - 0.55;
  g.add(mouth);
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.13, 5, 5), gl);
  ember.position.set(0, 1.74, 0.0);
  g.add(ember);

  // Small head tucked under the sac
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 5, 4), sk);
  head.position.set(0, 0.5, 0.72);
  g.add(head);
  for (const x of [-0.08, 0.08]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 4, 4), G(PAL.eye));
    e.position.set(x, 0.55, 0.88);
    g.add(e);
  }

  const legs = ringLegs(g, 4, 0.48, 0.5, {
    upperLen: 0.34, lowerLen: 0.42, upperR: 0.07, lowerR: 0.035,
    mat: sk, boneMat: bn, upperTilt: 0.2, lowerTilt: -0.5, footSize: 0.04, splay: 0.55,
  }, Math.PI / 4);

  g.userData = { animType: "tick", legs, ember, body };
  return g;
}

// ─── 2. HARPOONER ───────────────────────────────────────────
// Upright eel with one enormous barbed spear arm. Fires the harpoon on a
// tether — the most "aimed" looking of the nine.
function buildHarpooner() {
  const g = new THREE.Group();
  const sk = M(PAL.skin2), bn = M(PAL.bone), gl = G(PAL.glowPink);

  const torsoGeo = new THREE.CylinderGeometry(0.17, 0.34, 1.5, 7);
  const torso = new THREE.Mesh(torsoGeo, sk);
  torso.position.y = 1.0;
  torso.rotation.x = -0.12;
  g.add(torso);

  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 5), sk);
  hood.scale.set(1.3, 0.75, 0.8);
  hood.position.set(0, 1.72, -0.05);
  g.add(hood);

  const headGeo = new THREE.ConeGeometry(0.17, 0.55, 5);
  headGeo.translate(0, 0.27, 0);
  const head = new THREE.Mesh(headGeo, sk);
  head.position.set(0, 1.66, 0.1);
  head.rotation.x = 1.45;         // snout points forward
  g.add(head);
  for (const x of [-0.08, 0.08]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), G(PAL.eye));
    e.position.set(x, 1.78, 0.2);
    g.add(e);
  }

  // Spear arm — long, braced, barbed
  const armPivot = new THREE.Group();
  armPivot.position.set(0.3, 1.3, 0.1);
  g.add(armPivot);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 1.9, 5), bn);
  shaft.position.set(0, 0, 0.85);
  shaft.rotation.x = Math.PI * 0.5;
  armPivot.add(shaft);
  const tip = spike(bn, 0.11, 0.5, 5);
  tip.position.set(0, 0, 1.8);
  tip.rotation.x = Math.PI * 0.5;
  armPivot.add(tip);
  for (const s of [-1, 1]) {        // barbs
    const b = spike(bn, 0.05, 0.26, 4);
    b.position.set(s * 0.07, 0, 1.6);
    b.rotation.x = Math.PI * 0.5;
    b.rotation.z = s * 0.9;
    armPivot.add(b);
  }
  const socket = new THREE.Mesh(new THREE.SphereGeometry(0.2, 5, 5), sk);
  armPivot.add(socket);

  // Off arm, small and tucked
  const off = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.8, 5), sk);
  off.position.set(-0.3, 1.1, 0.15);
  off.rotation.x = -0.9;
  g.add(off);

  const vent = [];
  for (const y of [0.9, 1.15, 1.4]) {
    const v = new THREE.Mesh(new THREE.SphereGeometry(0.07, 4, 4), gl);
    v.position.set(-0.22, y, -0.2);
    g.add(v);
    vent.push(v);
  }

  const legs = ringLegs(g, 2, 0.22, 0.4, {
    upperLen: 0.46, lowerLen: 0.48, upperR: 0.09, lowerR: 0.05,
    mat: sk, boneMat: bn, upperTilt: 0.25, lowerTilt: -0.55, footSize: 0.05,
  }, Math.PI / 2);

  g.userData = { animType: "harpooner", legs, armPivot, vent, hood };
  return g;
}

// ─── 3. MORTAR BEETLE ───────────────────────────────────────
// Armoured dome that cracks open to fire, then seals. Reads as "safe to
// ignore" until the shell splits — the only one with a visible tell.
function buildBeetle() {
  const g = new THREE.Group();
  const sk = M(PAL.chitin), ar = M(PAL.armorLt), bn = M(PAL.bone), gl = G(PAL.glowCyan);

  const under = new THREE.Mesh(new THREE.SphereGeometry(0.62, 7, 5), sk);
  under.scale.set(1.15, 0.6, 1.3);
  under.position.y = 0.55;
  g.add(under);

  // Two shell halves on pivots so they can hinge open
  const shells = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.68, 0);
    g.add(pivot);
    const half = new THREE.Mesh(new THREE.SphereGeometry(0.66, 7, 5,
      s > 0 ? 0 : Math.PI, Math.PI), ar);
    half.scale.set(1.12, 0.72, 1.3);
    pivot.add(half);
    // Ridge along each shell
    for (let i = 0; i < 3; i++) {
      const rg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.9 - i * 0.2), sk);
      rg.position.set(s * (0.18 + i * 0.16), 0.4 - i * 0.07, -0.05);
      pivot.add(rg);
    }
    shells.push({ pivot, side: s });
  }

  // Barrel hidden inside, rises when the shell opens
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.85, 6), bn);
  barrel.position.set(0, 0.8, -0.1);
  barrel.rotation.x = -0.4;
  g.add(barrel);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 5), gl);
  core.position.set(0, 1.1, 0.05);
  g.add(core);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 5, 4), sk);
  head.scale.set(1.0, 0.7, 1.0);
  head.position.set(0, 0.46, 0.75);
  g.add(head);
  for (const x of [-0.09, 0.09]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), G(PAL.eye));
    e.position.set(x, 0.5, 0.9);
    g.add(e);
  }
  for (const s of [-1, 1]) {       // antennae
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.5, 4), bn);
    a.position.set(s * 0.1, 0.68, 0.82);
    a.rotation.set(-0.7, 0, s * 0.4);
    g.add(a);
  }

  const legs = ringLegs(g, 6, 0.5, 0.42, {
    upperLen: 0.3, lowerLen: 0.34, upperR: 0.05, lowerR: 0.028,
    mat: sk, boneMat: bn, upperTilt: 0.2, lowerTilt: -0.6, footSize: 0.03, splay: 0.7,
  });

  g.userData = { animType: "beetle", legs, shells, barrel, core };
  return g;
}

// ─── 4. SIREN ───────────────────────────────────────────────
// Tall, thin, draped. Inflates a throat sac and screams — a cone attack
// rather than a projectile, if you want the ranged slot to play differently.
function buildSiren() {
  const g = new THREE.Group();
  const sk = M(PAL.skin5), bn = M(PAL.bone), gl = G(PAL.glowPink);

  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.26, 2.0, 6), sk);
  stalk.position.y = 1.15;
  g.add(stalk);

  const sac = new THREE.Mesh(new THREE.SphereGeometry(0.33, 6, 6), sk);
  sac.position.set(0, 1.85, 0.16);
  g.add(sac);
  const sacGlow = new THREE.Mesh(new THREE.SphereGeometry(0.17, 5, 5), gl);
  sacGlow.position.set(0, 1.85, 0.26);
  g.add(sacGlow);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.23, 6, 5), bn);
  skull.scale.set(0.85, 1.15, 0.9);
  skull.position.set(0, 2.3, 0.02);
  g.add(skull);
  // Gaping mouth ring — the scream
  const maw = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.04, 4, 9), bn);
  maw.position.set(0, 2.24, 0.2);
  maw.rotation.x = Math.PI * 0.5;
  g.add(maw);
  for (const x of [-0.09, 0.09]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 4, 4), G(PAL.eye));
    e.position.set(x, 2.42, 0.17);
    g.add(e);
  }

  // Hanging drapes — long flat panels that sway
  const drapes = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(a) * 0.22, 1.75, Math.sin(a) * 0.22);
    g.add(pivot);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.17, 1.25, 0.03), sk);
    panel.position.y = -0.62;
    pivot.add(panel);
    drapes.push({ pivot, phase: i * 0.9 });
  }

  const legs = ringLegs(g, 3, 0.2, 0.3, {
    upperLen: 0.4, lowerLen: 0.42, upperR: 0.06, lowerR: 0.03,
    mat: sk, boneMat: bn, upperTilt: 0.2, lowerTilt: -0.5, footSize: 0.035, splay: 0.3,
  });

  g.userData = { animType: "siren", legs, sac, sacGlow, drapes };
  return g;
}

// ─── 5. SPORECASTER ─────────────────────────────────────────
// Rooted, immobile, asymmetric — a gun emplacement rather than a creature.
// It can't chase you at all, which changes how a room plays.
function buildSporecaster() {
  const g = new THREE.Group();
  const sk = M(PAL.skin1), bn = M(PAL.bone), gl = G(PAL.glowAcid);

  // Root flare
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const root = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.13, 0.75, 5), sk);
    root.position.set(Math.cos(a) * 0.3, 0.12, Math.sin(a) * 0.3);
    root.rotation.set(Math.sin(a) * 0.85, 0, -Math.cos(a) * 0.85);
    g.add(root);
  }
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 7, 5), sk);
  bulb.scale.set(1.1, 0.8, 1.1);
  bulb.position.y = 0.4;
  g.add(bulb);

  // Bent stalk built from segments so it curves
  const stalk = new THREE.Group();
  stalk.position.y = 0.6;
  g.add(stalk);
  let prev = stalk;
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Group();
    seg.position.y = 0.32;
    seg.rotation.x = 0.16;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1 - i * 0.012, 0.12 - i * 0.012, 0.34, 5), sk);
    mesh.position.y = 0.17;
    seg.add(mesh);
    prev.add(seg);
    prev = seg;
  }

  // Firing pod at the tip
  const pod = new THREE.Mesh(new THREE.SphereGeometry(0.33, 7, 6), sk);
  pod.scale.set(1.0, 1.15, 1.0);
  pod.position.y = 0.34;
  prev.add(pod);
  const mouthGeo = new THREE.ConeGeometry(0.26, 0.42, 7, 1, true);
  const mouth = new THREE.Mesh(mouthGeo, bn);
  mouth.position.set(0, 0.5, 0.14);
  mouth.rotation.x = 2.4;
  prev.add(mouth);
  const spore = new THREE.Mesh(new THREE.SphereGeometry(0.15, 5, 5), gl);
  spore.position.set(0, 0.52, 0.22);
  prev.add(spore);

  // Hanging seed pods
  const pods = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.15, 5, 5), sk);
    p.scale.set(0.8, 1.2, 0.8);
    p.position.set(s * 0.3, 0.1, -0.1);
    prev.add(p);
    pods.push(p);
  }

  g.userData = { animType: "spore", stalkTip: prev, spore, pods, bulb };
  return g;
}

// ─── 6. WATCHER ─────────────────────────────────────────────
// A single armoured eye slung in a tripod. Fires a sustained beam.
//
// The whole design is built around readability: the eye is the silhouette,
// the telegraph AND the weak point, all the same object. Armoured shutters
// clamp over it at rest and iris open only to fire, so the thing is literally
// only vulnerable while it's dangerous.
//
// The beam is ONE mesh, built here once and reused. It is never rebuilt — it
// just gets scaled along its length and aimed, which is why a sustained beam
// is cheaper than the projectile system it replaces (that allocates a fresh
// mesh per shot).
function buildWatcher() {
  const g = new THREE.Group();
  const mech = M(PAL.mech), ar = M(PAL.armor), arLt = M(PAL.armorLt), gl = G(PAL.glowCyan);

  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.32, 7, 5), ar);
  hub.scale.set(1.25, 0.62, 1.25);
  hub.position.y = 1.54;
  g.add(hub);
  // Collar the eye hangs from
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 0.2, 7), arLt);
  collar.position.y = 1.4;
  g.add(collar);

  // Heat vents around the hub — they flare as it charges.
  const vents = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.16), arLt);
    slot.position.set(Math.cos(a) * 0.33, 1.56, Math.sin(a) * 0.33);
    slot.rotation.y = -a;
    g.add(slot);
    const glowSlot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.1), gl);
    glowSlot.position.set(Math.cos(a) * 0.36, 1.56, Math.sin(a) * 0.36);
    glowSlot.rotation.y = -a;
    g.add(glowSlot);
    vents.push(glowSlot);
  }

  // The eye, hanging under the hub on cables.
  const eyePivot = new THREE.Group();
  eyePivot.position.set(0, 1.26, 0);
  g.add(eyePivot);

  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.38, 9, 8), M(0xd8d0c0));
  eyePivot.add(ball);

  // Layered iris: two concentric rings plus the lens, so the charge-up has
  // something to read on rather than one flat disc brightening.
  const irisOuter = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 4, 12), gl);
  irisOuter.position.z = 0.28;
  eyePivot.add(irisOuter);
  const irisInner = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 4, 10), gl);
  irisInner.position.z = 0.33;
  eyePivot.add(irisInner);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.17, 7, 7), gl);
  lens.position.z = 0.26;
  lens.scale.set(1, 1, 0.45);
  eyePivot.add(lens);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.085, 6, 6), G(0x001018));
  pupil.position.z = 0.36;
  pupil.scale.set(1, 1, 0.4);
  eyePivot.add(pupil);

  // Armoured upper shell
  const brow = new THREE.Mesh(new THREE.SphereGeometry(0.44, 9, 5, 0, Math.PI * 2, 0, 1.0), ar);
  brow.position.y = 0.02;
  eyePivot.add(brow);

  // Four shutter petals that clamp over the lens at rest.
  // Outer group picks the radial direction, inner group swings the petal open.
  const shutters = [];
  for (let i = 0; i < 4; i++) {
    const outer = new THREE.Group();
    outer.rotation.z = (i / 4) * Math.PI * 2;
    eyePivot.add(outer);
    const inner = new THREE.Group();
    outer.add(inner);
    const petal = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 8, 4, 0, Math.PI * 2, 0, 0.75), arLt);
    inner.add(petal);
    shutters.push(inner);
  }

  // Cables tethering the eye to the hub
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 4), mech);
    cable.position.set(Math.cos(a) * 0.23, 1.42, Math.sin(a) * 0.23);
    cable.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
    g.add(cable);
  }

  // THE BEAM. Unit length along +Y, shifted so its base sits at the origin,
  // then turned to fire down +Z. Aiming is a lookAt; range is scale.y.
  const beamGeo = new THREE.CylinderGeometry(0.045, 0.1, 1, 6, 1, true);
  beamGeo.translate(0, 0.5, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
    color: 0x88eeff, transparent: true, opacity: 0.75, side: THREE.DoubleSide,
  }));
  beam.rotation.x = Math.PI * 0.5;
  beam.position.z = 0.3;
  beam.visible = false;
  eyePivot.add(beam);

  // Flare at the muzzle and a spot where it lands.
  const flare = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), G(0xaaf4ff));
  flare.position.z = 0.4;
  flare.visible = false;
  eyePivot.add(flare);
  const impact = new THREE.Mesh(new THREE.SphereGeometry(0.17, 6, 6), G(0xaaf4ff));
  impact.visible = false;
  eyePivot.add(impact);

  const legs = ringLegs(g, 3, 0.27, 1.5, {
    upperLen: 0.85, lowerLen: 0.95, upperR: 0.055, lowerR: 0.03,
    mat: mech, boneMat: ar, upperTilt: 0, lowerTilt: 0.1,
    lowerSplay: -1.0, footSize: 0.05, splay: 1.0,
  });

  g.userData = {
    animType: "watcher", legs, eyePivot, lens, pupil, irisOuter, irisInner,
    shutters, vents, beam, flare, impact,
  };
  return g;
}

// ─── 7. RAILGUN STRIDER ─────────────────────────────────────
// Tiny body carried absurdly high on four stilts, cannon slung underneath.
// Shoots flat and fast; you fight the legs, not the body.
function buildStrider() {
  const g = new THREE.Group();
  const mech = M(PAL.mech), ar = M(PAL.armor), bn = M(PAL.bone), gl = G(PAL.glowOrange);

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 7, 5), ar);
  body.scale.set(1.25, 0.72, 1.5);
  body.position.y = 2.95;
  g.add(body);

  const cowl = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 4), mech);
  cowl.scale.set(1.1, 0.55, 1.0);
  cowl.position.set(0, 3.15, -0.2);
  g.add(cowl);

  // Rail cannon slung under the hull
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.8, 6), mech);
  rail.position.set(0, 2.68, 0.25);
  rail.rotation.x = Math.PI * 0.5;
  g.add(rail);
  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 1.1), ar);
    fin.position.set(s * 0.13, 2.68, 0.2);
    g.add(fin);
  }
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.13, 5, 5), gl);
  muzzle.position.set(0, 2.68, 1.15);
  g.add(muzzle);

  // Sensor cluster
  for (const x of [-0.12, 0, 0.12]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), G(PAL.eye));
    e.position.set(x, 3.02, 0.52);
    g.add(e);
  }

  // Four very long stilts with high knees. These are the whole point — the
  // hull has to sit above everything else on the roster.
  const legs = ringLegs(g, 4, 0.34, 2.9, {
    upperLen: 1.2, lowerLen: 1.95, upperR: 0.075, lowerR: 0.038,
    mat: mech, boneMat: bn, upperTilt: 0, lowerTilt: 0.1,
    lowerSplay: -1.15, footSize: 0.06, splay: 1.15,
  }, Math.PI / 4);

  g.userData = { animType: "strider", legs, muzzle, body };
  return g;
}

// ─── 8. ACID LOBBER ─────────────────────────────────────────
// Hunched quadruped hauling a rack of acid sacs. Shots leave a puddle, so it
// controls ground rather than just dealing damage.
function buildLobber() {
  const g = new THREE.Group();
  const sk = M(PAL.skin1), bn = M(PAL.bone), gl = G(PAL.glowAcid);

  const torsoGeo = new THREE.SphereGeometry(0.6, 7, 6);
  torsoGeo.scale(1.05, 0.95, 1.35);
  const torso = new THREE.Mesh(torsoGeo, sk);
  torso.position.set(0, 0.85, -0.1);
  torso.rotation.x = 0.3;
  g.add(torso);

  // Acid sacs on the back, biggest in the middle
  const sacs = [];
  const place = [
    { x: -0.3, y: 1.2, z: -0.5, r: 0.21 },
    { x: 0.3, y: 1.2, z: -0.5, r: 0.21 },
    { x: 0, y: 1.32, z: -0.72, r: 0.26 },
    { x: 0, y: 1.22, z: -0.2, r: 0.18 },
  ];
  for (const p of place) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(p.r, 6, 5), gl);
    s.position.set(p.x, p.y, p.z);
    g.add(s);
    sacs.push({ mesh: s, base: p.r });
  }

  // Neck and spitting head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.5, 5), sk);
  neck.position.set(0, 1.05, 0.5);
  neck.rotation.x = 0.9;
  g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 5), sk);
  head.scale.set(0.9, 0.8, 1.3);
  head.position.set(0, 1.12, 0.82);
  g.add(head);
  const maw = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 6, 1, true), bn);
  maw.position.set(0, 1.08, 1.08);
  maw.rotation.x = -Math.PI * 0.5;
  g.add(maw);
  const drip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 5, 5), gl);
  drip.position.set(0, 1.06, 1.14);
  g.add(drip);
  for (const x of [-0.12, 0.12]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), G(PAL.eye));
    e.position.set(x, 1.24, 0.95);
    g.add(e);
  }

  const legs = ringLegs(g, 4, 0.42, 0.62, {
    upperLen: 0.42, lowerLen: 0.46, upperR: 0.08, lowerR: 0.04,
    mat: sk, boneMat: bn, upperTilt: 0.25, lowerTilt: -0.55, footSize: 0.045, splay: 0.45,
  }, Math.PI / 4);

  g.userData = { animType: "lobber", legs, sacs, drip };
  return g;
}

// ─── 9. NEEDLER ─────────────────────────────────────────────
// A pincushion that fires volleys of its own quills. The quills visibly
// deplete and regrow, so you can read its ammo from across the room.
function buildNeedler() {
  const g = new THREE.Group();
  const sk = M(PAL.skin3), bn = M(PAL.bone), gl = G(PAL.glowCyan);

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.58, 8, 7), sk);
  core.position.y = 0.85;
  g.add(core);

  // Quills on a golden-angle spiral so they don't band
  const quills = [];
  const N = 26;
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 1.4;        // bias toward the upper half
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = i * 2.399963;
    const dir = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r).normalize();
    const q = spike(bn, 0.035, 0.44 + (i % 3) * 0.07);
    q.position.copy(dir.clone().multiplyScalar(0.52)).add(new THREE.Vector3(0, 0.85, 0));
    q.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.add(q);
    quills.push({ mesh: q, dir, phase: i * 0.4 });
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 6, 5), sk);
  head.scale.set(1.0, 0.85, 1.1);
  head.position.set(0, 0.72, 0.6);
  g.add(head);
  for (const x of [-0.1, 0.1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.055, 4, 4), G(PAL.eye));
    e.position.set(x, 0.76, 0.78);
    g.add(e);
  }
  const vent = new THREE.Mesh(new THREE.SphereGeometry(0.1, 5, 5), gl);
  vent.position.set(0, 0.62, 0.74);
  g.add(vent);

  const legs = ringLegs(g, 6, 0.42, 0.62, {
    upperLen: 0.36, lowerLen: 0.44, upperR: 0.05, lowerR: 0.028,
    mat: sk, boneMat: bn, upperTilt: 0.2, lowerTilt: -0.55, footSize: 0.035, splay: 0.8,
  });

  g.userData = { animType: "needler", legs, quills, core, vent };
  return g;
}


// ─── IDLE ANIMATION ─────────────────────────────────────────
// Each one gets a signature motion, because half of what makes a design read
// is how it moves. A still model always looks better than it plays.
function walk(legs, time, speed, amp) {
  legs.forEach((leg, i) => {
    const cycle = Math.sin(time * speed + (i / legs.length) * Math.PI * 2);
    leg.upper.rotation.x = leg.baseUpperTilt + cycle * amp;
    leg.lower.rotation.x = leg.baseLowerTilt - Math.abs(cycle) * amp * 0.6;
  });
}

function animateCandidate(model, time) {
  const d = model.userData;
  switch (d.animType) {
    case "tick": {
      walk(d.legs, time, 5, 0.18);
      const t = 1 + Math.sin(time * 2.5) * 0.05;
      d.body.scale.set(t, 1 / t, t);
      d.ember.scale.setScalar(1 + Math.sin(time * 6) * 0.25);
      model.position.y = Math.abs(Math.sin(time * 10)) * 0.02;
      break;
    }
    case "harpooner": {
      walk(d.legs, time, 3.5, 0.2);
      // Spear tracks in small aiming arcs, then jabs
      const jab = Math.max(0, Math.sin(time * 1.6)) ** 6;
      d.armPivot.rotation.y = Math.sin(time * 0.9) * 0.22;
      d.armPivot.position.z = 0.1 + jab * 0.4;
      d.hood.scale.set(1.3 + jab * 0.25, 0.75, 0.8);
      d.vent.forEach((v, i) => v.scale.setScalar(1 + Math.sin(time * 4 + i) * 0.3));
      break;
    }
    case "beetle": {
      walk(d.legs, time, 4, 0.15);
      // Shell cracks open, barrel rises, then it seals again
      const open = Math.max(0, Math.sin(time * 1.1)) ** 2;
      d.shells.forEach((s) => { s.pivot.rotation.z = -s.side * open * 0.85; });
      d.barrel.position.y = 0.8 + open * 0.3;
      d.core.scale.setScalar(0.6 + open * 1.1);
      break;
    }
    case "siren": {
      walk(d.legs, time, 2.2, 0.12);
      const breathe = 1 + Math.sin(time * 2) * 0.22;
      d.sac.scale.set(breathe, breathe, breathe);
      d.sacGlow.scale.setScalar(breathe * (1 + Math.sin(time * 9) * 0.12));
      d.drapes.forEach((dr) => {
        dr.pivot.rotation.x = Math.sin(time * 1.4 + dr.phase) * 0.22;
        dr.pivot.rotation.z = Math.cos(time * 1.1 + dr.phase) * 0.16;
      });
      model.rotation.z = Math.sin(time * 1.2) * 0.025;
      break;
    }
    case "spore": {
      // Rooted — it sways and throbs, it never walks
      d.stalkTip.rotation.z = Math.sin(time * 1.3) * 0.1;
      d.stalkTip.rotation.x = 0.16 + Math.sin(time * 0.9) * 0.08;
      d.spore.scale.setScalar(1 + Math.sin(time * 3.5) * 0.3);
      d.pods.forEach((p, i) => p.scale.setScalar(1 + Math.sin(time * 2.4 + i * 2) * 0.12));
      d.bulb.scale.y = 0.8 + Math.sin(time * 1.8) * 0.04;
      break;
    }
    case "watcher": {
      walk(d.legs, time, 1.8, 0.1);
      model.position.y = Math.sin(time * 1.1) * 0.03;

      // Full attack cycle on a 5s loop, so you can see how it would read
      // in-game: SCAN → shutters open → charge → FIRE → seal.
      const CYCLE = 5;
      const p = (time % CYCLE) / CYCLE;
      const BEAM_RANGE = 6;      // stand-in for the real 12-unit range

      let open = 0, charge = 0, firing = false;
      if (p < 0.5) {                      // scanning, shutters clamped
        d.eyePivot.rotation.y = Math.sin(time * 0.9) * 0.75;
        d.eyePivot.rotation.x = Math.sin(time * 0.6) * 0.2;
      } else if (p < 0.68) {              // shutters iris open
        open = (p - 0.5) / 0.18;
      } else if (p < 0.84) {              // locked on, winding up
        open = 1;
        charge = (p - 0.68) / 0.16;
      } else if (p < 0.93) {              // FIRING
        open = 1; charge = 1; firing = true;
      } else {                            // shutters clamp shut again
        open = 1 - (p - 0.93) / 0.07;
      }

      // Once it commits, the eye holds dead still — that stillness is the
      // "it has picked you" signal.
      if (p >= 0.5) {
        d.eyePivot.rotation.y *= 0.85;
        d.eyePivot.rotation.x *= 0.85;
      }

      d.shutters.forEach((s, i) => {
        s.rotation.x = -open * 1.15 - (firing ? Math.sin(time * 40 + i) * 0.02 : 0);
      });

      const heat = charge * (0.7 + Math.sin(time * 18) * 0.3);
      d.lens.scale.set(1 + heat * 0.3, 1 + heat * 0.3, 0.45);
      d.irisOuter.rotation.z = time * (1 + charge * 7);
      d.irisInner.rotation.z = -time * (1.4 + charge * 9);
      d.irisInner.scale.setScalar(1 - charge * 0.3);
      d.vents.forEach((v, i) =>
        v.scale.setScalar(1 + charge * 1.6 + Math.sin(time * 6 + i) * 0.15));

      d.beam.visible = firing;
      d.flare.visible = firing;
      d.impact.visible = firing;
      if (firing) {
        // The entire per-frame cost of the beam: one scale, one position.
        const jitter = 1 + Math.sin(time * 50) * 0.06;
        d.beam.scale.set(jitter, BEAM_RANGE, jitter);
        d.flare.scale.setScalar(0.9 + Math.sin(time * 45) * 0.25);
        d.impact.position.z = 0.3 + BEAM_RANGE;
        d.impact.scale.setScalar(1.1 + Math.sin(time * 38) * 0.35);
      }
      break;
    }
    case "strider": {
      walk(d.legs, time, 1.5, 0.22);
      d.muzzle.scale.setScalar(1 + Math.max(0, Math.sin(time * 1.4)) ** 8 * 1.6);
      model.position.y = Math.abs(Math.sin(time * 3)) * 0.05;
      model.rotation.z = Math.sin(time * 1.5) * 0.02;
      break;
    }
    case "lobber": {
      walk(d.legs, time, 3, 0.18);
      d.sacs.forEach((s, i) => {
        const p = 1 + Math.sin(time * 2.2 + i * 1.3) * 0.14;
        s.mesh.scale.set(p, p, p);
      });
      d.drip.scale.setScalar(1 + Math.sin(time * 4) * 0.35);
      break;
    }
    case "needler": {
      walk(d.legs, time, 4.5, 0.16);
      // Quills bristle outward in a wave, then settle
      const bristle = Math.max(0, Math.sin(time * 1.5)) ** 3;
      d.quills.forEach((q) => {
        const push = 0.52 + bristle * 0.12 + Math.sin(time * 3 + q.phase) * 0.015;
        q.mesh.position.copy(q.dir.clone().multiplyScalar(push)).add(new THREE.Vector3(0, 0.85, 0));
      });
      d.vent.scale.setScalar(1 + bristle * 0.5);
      break;
    }
  }
}


const CANDIDATES = [
  { n: "Artillery Tick", c: "#ffaa22", build: buildTick,
    d: "Bloated sac on stubby legs with a mortar grown out of its back. Lobs arcing shells — the only one that could shoot over cover.",
    tag: "Low & bloated" },
  { n: "Harpooner", c: "#ff44cc", build: buildHarpooner,
    d: "Upright eel with one enormous barbed spear arm. Fires a harpoon on a tether — the most deliberate, aimed-looking of the nine.",
    tag: "Tall & upright" },
  { n: "Mortar Beetle", c: "#44ccff", build: buildBeetle,
    d: "Armoured dome that cracks open to fire, then seals shut. Looks harmless until the shell splits — a built-in tell.",
    tag: "Armoured dome" },
  { n: "Siren", c: "#ff66aa", build: buildSiren,
    d: "Tall, thin and draped. Inflates a throat sac and screams a cone instead of firing a shot — makes the ranged slot play differently.",
    tag: "Tall & draped" },
  { n: "Sporecaster", c: "#aaff33", build: buildSporecaster,
    d: "Rooted, immobile, asymmetric. A gun emplacement rather than a creature — it can never chase you, which changes how a room plays.",
    tag: "Rooted turret" },
  { n: "Watcher", c: "#44ccff", build: buildWatcher,
    d: "SELECTED. Armoured shutters iris open, the lens spins up, then it holds a beam on you — so it's only vulnerable while it's dangerous. Glass cannon: 1 HP, 15% damage.",
    tag: "Tripod & eye" },
  { n: "Railgun Strider", c: "#ffcc44", build: buildStrider,
    d: "Tiny hull carried absurdly high on four stilts, cannon slung underneath. Shoots flat and fast; you fight the legs, not the body.",
    tag: "Very tall stilts" },
  { n: "Acid Lobber", c: "#aaff33", build: buildLobber,
    d: "Hunched quadruped hauling a rack of acid sacs. Shots leave a puddle behind, so it controls ground instead of just dealing damage.",
    tag: "Hunched quad" },
  { n: "Needler", c: "#66ddff", build: buildNeedler,
    d: "A pincushion that fires volleys of its own quills. They visibly deplete and regrow, so you can read its ammo from across the room.",
    tag: "Radial pincushion" },
];


function Viewer({ cand, index }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const model = cand.build();

    // Frame each model to its own size — these range from a rooted stump to a
    // 3.4-unit strider, and a fixed camera would crop half of them.
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const mid = box.getCenter(new THREE.Vector3());
    const reach = Math.max(size.x, size.y, size.z);

    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(0, mid.y + reach * 0.22, reach * 2.25);
    camera.lookAt(0, mid.y, 0);

    scene.add(new THREE.AmbientLight(0x334455, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 0.95);
    key.position.set(3, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x445566, 0.35);
    fill.position.set(-2, 1, -2);
    scene.add(fill);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(reach * 0.3, reach * 0.62, 28),
      new THREE.MeshBasicMaterial({ color: 0x222233, transparent: true, opacity: 0.3 })
    );
    ring.rotation.x = -Math.PI * 0.5;
    ring.position.y = box.min.y - 0.02;
    scene.add(ring);
    scene.add(model);

    let time = index * 1.7;
    const baseY = model.position.y;
    function loop() {
      time += 0.016;
      model.rotation.y = time * 0.45;
      animateCandidate(model, time);
      model.position.y += baseY;
      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(loop);
    }
    loop();

    return () => { cancelAnimationFrame(frameRef.current); renderer.dispose(); };
  }, [cand, index]);

  return <canvas ref={canvasRef} width={420} height={420}
                 style={{ width: "100%", height: "100%", display: "block" }} />;
}


export default function SpireCandidates() {
  const [sel, setSel] = useState(null);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a12", padding: "32px 20px 60px",
                  fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#e8e8f0", margin: 0,
                     letterSpacing: 4, textTransform: "uppercase" }}>
          Spire Replacements
        </h1>
        <p style={{ fontSize: 13, color: "#667", margin: "10px auto 0", maxWidth: 620, lineHeight: 1.6 }}>
          Nine candidates for the roster's ranged slot. All nine can do the Spire's job —
          shoot from about 12 units, fragile up close. Click one to highlight it.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
                    gap: 16, maxWidth: 1180, margin: "0 auto" }}>
        {CANDIDATES.map((cand, i) => {
          const active = sel === i;
          return (
            <div key={cand.n} onClick={() => setSel(active ? null : i)} style={{
              background: active ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${active ? cand.c : "#222233"}`,
              borderRadius: 10, overflow: "hidden", cursor: "pointer",
              transition: "all 0.25s ease",
              boxShadow: active ? `0 0 22px ${cand.c}22, inset 0 0 34px ${cand.c}08` : "none",
            }}>
              <div style={{ height: 280, position: "relative" }}>
                <Viewer cand={cand} index={i} />
                <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(0,0,0,0.6)",
                              color: "#889", fontSize: 10, padding: "3px 8px", borderRadius: 4,
                              letterSpacing: 1, textTransform: "uppercase" }}>
                  {i + 1}
                </div>
                <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.6)",
                              color: cand.c, fontSize: 10, padding: "3px 8px", borderRadius: 4 }}>
                  {cand.tag}
                </div>
              </div>
              <div style={{ padding: "12px 16px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%",
                                background: cand.c, boxShadow: `0 0 8px ${cand.c}` }} />
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: "#e8e8f0", margin: 0,
                               letterSpacing: 2, textTransform: "uppercase" }}>
                    {cand.n}
                  </h2>
                </div>
                <p style={{ fontSize: 12, lineHeight: 1.55, color: "#889", margin: 0 }}>{cand.d}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ maxWidth: 1180, margin: "26px auto 0", padding: "16px 20px",
                    background: "rgba(255,255,255,0.02)", border: "1px solid #1a1a2a",
                    borderRadius: 8, fontSize: 12, lineHeight: 1.75, color: "#667" }}>
        <strong style={{ color: "#99a" }}>Picking one:</strong>{" "}
        Silhouette matters more than detail — these get seen at a distance, in a dark room,
        next to a Crawler (low and long), a Brute (shoulders and bulk) and a Floater (round
        hoverer). The three that read most differently from that lineup are the{" "}
        <span style={{ color: "#ffcc44" }}>Strider</span> (absurd height),{" "}
        <span style={{ color: "#aaff33" }}>Sporecaster</span> (rooted, asymmetric) and{" "}
        <span style={{ color: "#44ccff" }}>Watcher</span> (one big eye, no body to speak of).
        Several also change how the ranged slot <em>plays</em>, not just how it looks — the
        Sporecaster can't chase you at all, the Siren's scream is a cone rather than a
        projectile, and the Watcher's beam punishes standing still.
      </div>
    </div>
  );
}
