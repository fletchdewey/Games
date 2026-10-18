// src/npc/soldier.js
// THE SOLDIER — the one they left tied up behind the board.
//
// FLETCHER'S GUIDE:
// The first thing in this game that is on your side. He is built the same way
// as everything else that moves: a stack of boxes on a stack of pivots, so a
// pose is a handful of angles rather than a new model. That matters more for
// him than for an alien, because he has to do four quite different things —
// sit tied up, stand, walk, and raise a rifle — and they all have to be the
// same body.
//
// Nothing here moves on its own. The brain is in soldier_ai.js.

import * as THREE from 'three';

const COL = {
  fatigue: 0x4a5340,
  fatigueDk: 0x39402f,
  vest: 0x2f3529,
  skin: 0x8a6a56,
  helmet: 0x414a38,
  boot: 0x24262a,
  gunMetal: 0x33383e,
  gunStock: 0x4a3a2a,
  rope: 0x8a7a55,
};

export const SOLDIER = {
  hp: 60,
  eyeY: 1.52,          // roughly where his head is, for line-of-sight
};

/** One limb: a pivot, a segment hanging off it, and a joint below that. */
function limb(parent, { len, r, mat, y = 0, x = 0, z = 0 }) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  parent.add(pivot);
  const geo = new THREE.CylinderGeometry(r, r * 0.88, len, 6);
  geo.translate(0, -len / 2, 0);
  const seg = new THREE.Mesh(geo, mat);
  pivot.add(seg);
  const joint = new THREE.Group();
  joint.position.y = -len;
  pivot.add(joint);
  return { pivot, seg, joint };
}

export function buildSoldier() {
  const g = new THREE.Group();

  const fat = new THREE.MeshLambertMaterial({ color: COL.fatigue });
  const fatDk = new THREE.MeshLambertMaterial({ color: COL.fatigueDk });
  const vestM = new THREE.MeshLambertMaterial({ color: COL.vest });
  const skinM = new THREE.MeshLambertMaterial({ color: COL.skin });
  const helmM = new THREE.MeshLambertMaterial({ color: COL.helmet });
  const bootM = new THREE.MeshLambertMaterial({ color: COL.boot });
  const ropeM = new THREE.MeshLambertMaterial({ color: COL.rope });

  // ── Hips, and everything above them ───────────────────────
  // One group at the waist, so sitting is a single rotation rather than
  // moving the torso, the arms and the head in step.
  const hips = new THREE.Group();
  hips.position.y = 0.92;
  g.add(hips);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.28), fat);
  torso.position.y = 0.31;
  hips.add(torso);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.33), vestM);
  vest.position.y = 0.34;
  hips.add(vest);
  for (const px of [-0.14, 0.14]) {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.09), fatDk);
    pouch.position.set(px, 0.2, 0.19);
    hips.add(pouch);
  }

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 6), skinM);
  neck.position.y = 0.66;
  hips.add(neck);
  const headPivot = new THREE.Group();
  headPivot.position.y = 0.72;
  hips.add(headPivot);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.23), skinM);
  head.position.y = 0.12;
  headPivot.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.155, 8, 6), helmM);
  helmet.scale.set(1.05, 0.82, 1.1);
  helmet.position.y = 0.2;
  headPivot.add(helmet);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.1), helmM);
  brim.position.set(0, 0.15, 0.13);
  headPivot.add(brim);

  // ── Arms ──────────────────────────────────────────────────
  const arms = [];
  for (const side of [-1, 1]) {
    const shoulder = limb(hips, { len: 0.3, r: 0.065, mat: fat,
                                  x: side * 0.27, y: 0.54 });
    const elbow = limb(shoulder.joint, { len: 0.28, r: 0.055, mat: fat });
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), skinM);
    hand.position.y = -0.03;
    elbow.joint.add(hand);
    arms.push({ side, shoulder: shoulder.pivot, elbow: elbow.pivot,
                hand: elbow.joint });
  }

  // ── Legs ──────────────────────────────────────────────────
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = limb(hips, { len: 0.44, r: 0.085, mat: fat,
                             x: side * 0.13, y: 0.02 });
    const knee = limb(hip.joint, { len: 0.42, r: 0.07, mat: fat });
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.26), bootM);
    boot.position.set(0, -0.05, 0.05);
    knee.joint.add(boot);
    legs.push({ side, hip: hip.pivot, knee: knee.pivot, foot: knee.joint });
  }

  // ── The rifle ─────────────────────────────────────────────
  // Parented to his right hand, so aiming is the arm's job and the gun just
  // goes where the hand goes.
  const rifle = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.62),
    new THREE.MeshLambertMaterial({ color: COL.gunMetal }));
  rifle.add(body);
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.42, 6),
    new THREE.MeshLambertMaterial({ color: COL.gunMetal }));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.48;
  rifle.add(barrel);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.26),
    new THREE.MeshLambertMaterial({ color: COL.gunStock }));
  stock.position.set(0, -0.02, -0.4);
  rifle.add(stock);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.17, 0.09), fatDk);
  mag.position.set(0, -0.13, 0.04);
  rifle.add(mag);
  const muzzle = new THREE.Object3D();
  muzzle.position.z = 0.7;
  rifle.add(muzzle);
  rifle.position.set(0, -0.06, 0.12);
  rifle.rotation.x = -Math.PI / 2;
  arms[1].hand.add(rifle);

  // ── What he is tied with ──────────────────────────────────
  // Hidden the moment he is cut loose. Two loops at the wrists behind him and
  // one round the ankles — the ankles are what makes him read as KEPT rather
  // than merely captured.
  const bindings = [];
  for (const [bx, by, bz, rr] of [[0, -0.02, -0.17, 0.075], [0, 0.04, -0.17, 0.075]]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.022, 4, 8), ropeM);
    loop.position.set(bx, by, bz);
    loop.rotation.y = Math.PI / 2;
    arms[0].hand.add(loop);
    bindings.push(loop);
  }
  const ankleRope = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 4, 10), ropeM);
  ankleRope.rotation.x = Math.PI / 2;
  g.add(ankleRope);
  bindings.push(ankleRope);

  g.userData = { type: 'soldier', hips, headPivot, head, helmet, arms, legs,
                 rifle, muzzle, bindings, ankleRope,
                 skinM, fat, gait: 0 };
  return g;
}

// ─── POSES ──────────────────────────────────────────────────
// Each one sets every joint it cares about, so there is no order they have to
// be called in and no state left over from the last one.

/** Sat on the floor, back against the wall, wrists behind him. */
export function poseTied(g, t = 0) {
  const d = g.userData;
  d.hips.position.y = 0.42;
  d.hips.rotation.x = -0.22;
  g.rotation.z = 0;
  // Knees up in front of him.
  d.legs.forEach((leg, i) => {
    leg.hip.rotation.x = -1.5 + i * 0.12;
    leg.knee.rotation.x = 1.9;
    leg.hip.rotation.z = (i ? 1 : -1) * 0.18;
  });
  // Arms back and down — the wrists are behind his back, out of sight.
  d.arms.forEach((arm) => {
    arm.shoulder.rotation.x = 0.55;
    arm.shoulder.rotation.z = arm.side * 0.12;
    arm.elbow.rotation.x = -0.5;
  });
  // Head down, lifting a little as he breathes.
  d.headPivot.rotation.x = 0.5 + Math.sin(t * 1.1) * 0.05;
  // Position only. Whether it is SHOWN is freeSoldier's business — setting
  // visible here meant the rope came straight back on the next frame and he
  // walked around still tied at the ankles.
  d.ankleRope.position.set(0, 0.16, 0.56);
}

/** On his feet. `walk` 0 is standing, 1 is a full stride. */
export function poseStand(g, t = 0, walk = 0) {
  const d = g.userData;
  d.hips.position.y = 0.92 + Math.abs(Math.sin(t * 7)) * 0.02 * walk;
  d.hips.rotation.x = 0.04 + walk * 0.06;
  d.headPivot.rotation.x = -0.02;
  const swing = Math.sin(t * 7) * walk;
  d.legs.forEach((leg, i) => {
    const s = i ? swing : -swing;
    leg.hip.rotation.x = s * 0.55;
    leg.hip.rotation.z = 0;
    leg.knee.rotation.x = Math.max(0, -s) * 0.8;
  });
  d.arms.forEach((arm, i) => {
    const s = i ? -swing : swing;
    arm.shoulder.rotation.x = s * 0.4;
    arm.shoulder.rotation.z = arm.side * 0.08;
    arm.elbow.rotation.x = -0.35 - Math.abs(s) * 0.2;
  });
}

/** Rifle up and pointed. Overrides the arms only, so the legs keep walking. */
export function poseAim(g, pitch = 0) {
  const d = g.userData;
  // Right arm out straight, left arm across to support the fore-end.
  d.arms[1].shoulder.rotation.x = -1.45 + pitch;
  d.arms[1].shoulder.rotation.z = 0;
  d.arms[1].elbow.rotation.x = -0.15;
  d.arms[0].shoulder.rotation.x = -1.2 + pitch;
  d.arms[0].shoulder.rotation.z = 0.5;
  d.arms[0].elbow.rotation.x = -0.65;
}

/** Face down, done. */
export function poseDead(g, p = 1) {
  const d = g.userData;
  g.rotation.x = p * 1.45;
  d.hips.position.y = 0.92 - p * 0.55;
  d.hips.rotation.x = 0.1;
  d.headPivot.rotation.x = 0.3;
  d.legs.forEach((leg) => { leg.hip.rotation.x = 0.1; leg.knee.rotation.x = 0.25; });
  d.arms.forEach((arm) => {
    arm.shoulder.rotation.x = 0.4;
    arm.shoulder.rotation.z = arm.side * 0.5;
    arm.elbow.rotation.x = -0.2;
  });
}

/** Cut loose: the ropes come off and never come back. */
export function freeSoldier(g) {
  for (const b of g.userData.bindings) b.visible = false;
}
