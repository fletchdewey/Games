// src/map/builder.js
// Generates Three.js room geometry from the layout data.
//
// FLETCHER'S GUIDE:
// This file reads the room definitions from layout.js and
// builds actual 3D walls, floors, and ceilings. It's like
// the Lego instruction manual — layout.js is the parts list,
// this file is the step-by-step build.
//
// The trickiest part is DOORWAYS. Where two rooms share a wall,
// we need to leave a gap so the player can walk through.
// The code detects these automatically by checking if another
// room's boundary crosses through a wall.

import * as THREE from 'three';
import { ROOMS, WALL_HEIGHT } from './layout.js?v=09b9b82554';

const WH = WALL_HEIGHT;

// Compute AABB from room definition
function roomBounds(r) {
  const hw = r.size[0] / 2, hd = r.size[1] / 2;
  return { x0: r.pos[0] - hw, x1: r.pos[0] + hw, z0: r.pos[1] - hd, z1: r.pos[1] + hd, id: r.id };
}

// Find gaps on a wall where other rooms cross through
function findGaps(axis, wallPos, wallMin, wallMax, allBounds, skipId) {
  const gaps = [];
  for (const q of allBounds) {
    if (q.id === skipId) continue;
    if (axis === 'x') {
      if (q.x0 <= wallPos + 0.1 && q.x1 >= wallPos - 0.1) {
        const oMin = Math.max(q.z0, wallMin), oMax = Math.min(q.z1, wallMax);
        if (oMax > oMin + 0.1) gaps.push([oMin, oMax]);
      }
    } else {
      if (q.z0 <= wallPos + 0.1 && q.z1 >= wallPos - 0.1) {
        const oMin = Math.max(q.x0, wallMin), oMax = Math.min(q.x1, wallMax);
        if (oMax > oMin + 0.1) gaps.push([oMin, oMax]);
      }
    }
  }
  return gaps;
}

// Split a wall range into solid segments around gaps
function splitWall(wMin, wMax, gaps) {
  gaps.sort((a, b) => a[0] - b[0]);
  const segs = [];
  let cur = wMin;
  for (const [gMin, gMax] of gaps) {
    if (gMin > cur + 0.05) segs.push([cur, gMin]);
    cur = Math.max(cur, gMax);
  }
  if (cur < wMax - 0.05) segs.push([cur, wMax]);
  return segs;
}

// Draw wall segments with gaps for doorways.
// Also records each solid segment into `walls` for player collision.
// axis 'x' → the wall sits at a constant X (wallPos) and spans Z ∈ [min,max].
// axis 'z' → the wall sits at a constant Z (wallPos) and spans X ∈ [min,max].
function drawWallSegs(segs, axis, wallPos, rotY, mat, scene, walls) {
  for (const [sMin, sMax] of segs) {
    const len = sMax - sMin;
    if (len < 0.05) continue;
    const ctr = (sMin + sMax) / 2;
    const geo = new THREE.PlaneGeometry(len, WH);
    const mesh = new THREE.Mesh(geo, mat);
    if (axis === 'x') {
      mesh.position.set(wallPos, WH / 2, ctr);
    } else {
      mesh.position.set(ctr, WH / 2, wallPos);
    }
    mesh.rotation.y = rotY;
    scene.add(mesh);
    if (walls) walls.push({ axis, pos: wallPos, min: sMin, max: sMax });
  }
}

/**
 * Builds the entire map.
 * @param {THREE.Scene} scene
 * @returns {{ bounds: Array, walls: Array }}
 *   bounds — room AABBs {x0,x1,z0,z1,id} used for the room label.
 *   walls  — solid wall segments {axis,pos,min,max} used for player collision.
 */
export function buildMap(scene) {
  const allBounds = ROOMS.map(roomBounds);
  const walls = [];

  ROOMS.forEach((r, ri) => {
    const b = allBounds[ri];
    const { x0, x1, z0, z1 } = b;

    // Floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(r.size[0], r.size[1]),
      new THREE.MeshLambertMaterial({ color: r.color })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(r.pos[0], 0, r.pos[1]);
    floor.receiveShadow = true;
    scene.add(floor);

    // Floor border stripe
    const bMat = new THREE.MeshBasicMaterial({ color: r.stripe, transparent: true, opacity: 0.5 });
    for (const [geo, px, pz] of [
      [new THREE.PlaneGeometry(r.size[0], 0.15), r.pos[0], z0 + 0.07],
      [new THREE.PlaneGeometry(r.size[0], 0.15), r.pos[0], z1 - 0.07],
    ]) {
      const m = new THREE.Mesh(geo, bMat); m.rotation.x = -Math.PI / 2; m.position.set(px, 0.01, pz); scene.add(m);
    }
    for (const [geo, px, pz] of [
      [new THREE.PlaneGeometry(0.15, r.size[1]), x0 + 0.07, r.pos[1]],
      [new THREE.PlaneGeometry(0.15, r.size[1]), x1 - 0.07, r.pos[1]],
    ]) {
      const m = new THREE.Mesh(geo, bMat); m.rotation.x = -Math.PI / 2; m.position.set(px, 0.01, pz); scene.add(m);
    }

    // Walls with doorway gaps
    const wallMat = new THREE.MeshLambertMaterial({ color: r.color, side: THREE.DoubleSide });
    const nGaps = findGaps('z', z0, x0, x1, allBounds, r.id);
    const sGaps = findGaps('z', z1, x0, x1, allBounds, r.id);
    const wGaps = findGaps('x', x0, z0, z1, allBounds, r.id);
    const eGaps = findGaps('x', x1, z0, z1, allBounds, r.id);

    drawWallSegs(splitWall(x0, x1, nGaps), 'z', z0, 0, wallMat, scene, walls);
    drawWallSegs(splitWall(x0, x1, sGaps), 'z', z1, Math.PI, wallMat, scene, walls);
    drawWallSegs(splitWall(z0, z1, wGaps), 'x', x0, Math.PI / 2, wallMat, scene, walls);
    drawWallSegs(splitWall(z0, z1, eGaps), 'x', x1, -Math.PI / 2, wallMat, scene, walls);

    // Eye-height stripes (same gap logic)
    const stMat = new THREE.MeshBasicMaterial({ color: r.stripe, transparent: true, opacity: 0.4 });
    for (const [segs, axis, pos, rotY] of [
      [splitWall(x0, x1, nGaps), 'z', z0, 0],
      [splitWall(x0, x1, sGaps), 'z', z1, Math.PI],
      [splitWall(z0, z1, wGaps), 'x', x0, Math.PI / 2],
      [splitWall(z0, z1, eGaps), 'x', x1, -Math.PI / 2],
    ]) {
      for (const [sMin, sMax] of segs) {
        const len = sMax - sMin; if (len < 0.05) continue;
        const ctr = (sMin + sMax) / 2;
        const st = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.08), stMat);
        if (axis === 'x') { st.position.set(pos, 1.6, ctr); }
        else { st.position.set(ctr, 1.6, pos); }
        st.rotation.y = rotY;
        scene.add(st);
      }
    }

    // Ceiling
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(r.size[0], r.size[1]),
      new THREE.MeshLambertMaterial({ color: 0x282830 })
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(r.pos[0], WH, r.pos[1]);
    scene.add(ceil);

    // Room light
    const intensity = r.label ? 1.2 : 0.6;
    const range = Math.max(r.size[0], r.size[1]) * 1.2;
    const light = new THREE.PointLight(r.label ? r.stripe : 0xccccdd, intensity, range);
    light.position.set(r.pos[0], 3.5, r.pos[1]);
    scene.add(light);
  });

  // Ambient
  scene.add(new THREE.AmbientLight(0x667788, 0.7));

  return { bounds: allBounds, walls };
}

/**
 * Find which named room the player is in.
 */
export function getCurrentRoom(pos, bounds) {
  for (const b of bounds) {
    if (pos.x > b.x0 && pos.x < b.x1 && pos.z > b.z0 && pos.z < b.z1) {
      const room = ROOMS.find(r => r.id === b.id);
      if (room && room.label) return room.label;
    }
  }
  return '';
}
