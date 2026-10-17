// src/bosses/swarm.js
// BOSS: The Swarm — not one alien but hundreds of tiny ones holding the shape
// of a humanoid between them.
//
// FLETCHER'S GUIDE:
// Every other model in this game is a bag of meshes: a torso mesh, an arm
// mesh, a head mesh. This one can't be. It is one creature made of many, and
// the whole point is that the many can come apart.
//
// So it is built as DATA instead — an array of motes, each knowing where in
// the silhouette it belongs — drawn by a single InstancedMesh. One draw call
// covers the lot, however many there are. The workshop version of this used
// 82 separate meshes, which is more draw calls than any alien in the game and
// would never have reached "hundreds" of anything.
//
// That shape is also what makes the rest of it possible. Scattering is just
// moving numbers in an array; nothing has to be created or destroyed.
//
// Nothing here animates. The brain lives next door in swarm_ai.js.

import * as THREE from 'three';

export const SWARM = {
  // How many motes hold the shape. Cheap to raise — they all draw together.
  count: 160,
  // Share of them that are the brighter, glowing sort.
  glowShare: 0.18,
  hoverY: 0.35,        // how far off the floor the whole mass sits
};

const COL_BODY = new THREE.Color(0x2b1e30);
const COL_GLOW = new THREE.Color(0xff44cc);
const COL_EYE = new THREE.Color(0xff2244);

// Where in the silhouette a mote can sit. Each region returns a home point
// and a size, and carries a `drift`: how far down the body it is, which the
// float uses to make the lower motes trail behind the upper ones.
function silhouette(rand) {
  const pick = rand();
  // Rough mass distribution of a body — most of it is torso.
  if (pick < 0.13) {                                   // head
    return { x: (rand() - 0.5) * 0.5, y: 2.0 + (rand() - 0.5) * 0.4,
             z: (rand() - 0.5) * 0.4, r: 0.04 + rand() * 0.03 };
  }
  if (pick < 0.47) {                                   // torso
    return { x: (rand() - 0.5) * 0.7, y: 1.0 + rand() * 0.8,
             z: (rand() - 0.5) * 0.5, r: 0.04 + rand() * 0.04 };
  }
  if (pick < 0.71) {                                   // arms
    const side = rand() < 0.5 ? -1 : 1;
    const t = rand();
    return { x: side * (0.5 + t * 0.8) + (rand() - 0.5) * 0.15,
             y: 1.4 - t * 0.6 + (rand() - 0.5) * 0.1,
             z: (rand() - 0.5) * 0.2, r: 0.03 + rand() * 0.025 };
  }
  const side = rand() < 0.5 ? -1 : 1;                  // legs
  const t = rand();
  return { x: side * 0.2 + (rand() - 0.5) * 0.2,
           y: 0.8 - t * 1.0 + (rand() - 0.5) * 0.05,
           z: (rand() - 0.5) * 0.2, r: 0.035 + rand() * 0.03 };
}

export function createSwarm(count = SWARM.count) {
  const g = new THREE.Group();
  const rand = Math.random;

  const motes = [];
  for (let i = 0; i < count; i++) {
    const p = silhouette(rand);
    const glow = rand() < SWARM.glowShare;
    motes.push({
      home: new THREE.Vector3(p.x, p.y, p.z),
      pos: new THREE.Vector3(p.x, p.y, p.z),
      vel: new THREE.Vector3(),
      r: p.r,
      phase: rand() * Math.PI * 2,
      spin: 0.6 + rand() * 1.8,
      kind: glow ? 'glow' : 'body',
      // 0 at the head, 1 at the feet. The float uses this to make the bottom
      // of the mass lag, which is what sells it as drifting rather than walking.
      low: Math.max(0, Math.min(1, (2.2 - p.y) / 2.4)),
    });
  }

  // Two eyes, placed rather than scattered — they're what you look at, and
  // what you aim at.
  for (const ex of [-0.12, 0.12]) {
    motes.push({
      home: new THREE.Vector3(ex, 2.05, 0.2),
      pos: new THREE.Vector3(ex, 2.05, 0.2),
      vel: new THREE.Vector3(),
      r: 0.06, phase: 0, spin: 0.4, kind: 'eye', low: 0,
    });
  }

  // One InstancedMesh per colour rather than one for everything.
  //
  // Per-instance colour would have put the whole swarm in a single draw call,
  // but it needs vertexColors on the material, which then expects a `color`
  // attribute on the geometry. Without one that attribute reads as zero and
  // multiplies every mote to black — which is exactly what it did.
  //
  // Three draw calls instead of one is a rounding error against the 82 this
  // used to cost, and splitting by colour is better anyway: the glowing motes
  // and the eyes want an unlit material so they actually glow, which a single
  // shared material could never give them.
  const geo = new THREE.SphereGeometry(1, 5, 4);
  const byKind = {
    body: { mat: new THREE.MeshLambertMaterial({ color: COL_BODY }), list: [] },
    glow: { mat: new THREE.MeshBasicMaterial({ color: COL_GLOW }), list: [] },
    eye: { mat: new THREE.MeshBasicMaterial({ color: COL_EYE }), list: [] },
  };
  for (const m of motes) byKind[m.kind].list.push(m);

  const dummy = new THREE.Object3D();
  const meshes = [];
  for (const kind of Object.keys(byKind)) {
    const { mat, list } = byKind[kind];
    if (!list.length) continue;
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    list.forEach((m, i) => {
      m.mesh = mesh;
      m.index = i;
      dummy.position.copy(m.pos);
      dummy.scale.setScalar(m.r);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    // The motes move well outside the bounds of their starting matrices, and
    // a scattered swarm is far bigger still — without this it vanishes the
    // moment it drifts off the edge of its own stale bounding sphere.
    mesh.frustumCulled = false;
    mesh.userData.hitPart = kind === 'eye' ? 'eye' : 'body';
    g.add(mesh);
    meshes.push(mesh);
  }

  const aura = new THREE.PointLight(0xff2244, 1.4, 7);
  aura.position.set(0, 1.2, 0);
  g.add(aura);

  g.userData = { type: 'swarm', motes, meshes, geo, aura, dummy };
  return g;
}

/** Push the motes' current positions into their instance buffers. */
export function syncSwarm(group) {
  const d = group.userData;
  const dummy = d.dummy;
  for (const m of d.motes) {
    dummy.position.copy(m.pos);
    dummy.scale.setScalar(m.r * (m.scaleMul || 1));
    dummy.updateMatrix();
    m.mesh.setMatrixAt(m.index, dummy.matrix);
  }
  for (const mesh of d.meshes) mesh.instanceMatrix.needsUpdate = true;
}

/** Free the GPU buffers when a swarm is thrown away. */
export function disposeSwarm(group) {
  const d = group.userData;
  d.geo.dispose();
  for (const mesh of d.meshes) {
    mesh.material.dispose();
    mesh.dispose();
  }
}
