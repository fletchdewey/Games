// src/map/grid_map.js
// Builds the level from the painted grid instead of hand-written rectangles.
//
// FLETCHER'S GUIDE:
// layout.js was a list of rooms you typed in by hand. This reads the map you
// painted in the Map Editor (localhost:8005), which build.sh bakes into
// grid_data.js, and turns it into real floors and walls.
//
// Three jobs:
//   1. buildGridMap()  — floor + wall meshes, and the data the game needs
//   2. wall extraction — a wall stands wherever floor meets empty space
//   3. room lookup     — which room (or hallway) a position is in
//
// It returns the SAME shape builder.js did — { bounds, walls, wallMeshes } —
// so the rest of the game didn't have to change much:
//   bounds     [{ x0, x1, z0, z1, id, label }]  for "which room am I in"
//   walls      [{ axis, pos, min, max }]        for player collision
//   wallMeshes meshes tagged isWall             so shots stop at walls

import * as THREE from 'three';
import { GRID } from './grid_data.js?v=a9f045b09a';

// Must match the Map Editor's grid origin or everything lands offset.
export const GX0 = -48, GZ0 = -96;
export const WALL_HEIGHT = 4;

// One value for every surface, so floor, walls and ceiling can't drift apart
// into three slightly different whites.
export const SURFACE_WHITE = 0xffffff;

// Grey lining along every wall: vertical ribs, floor to ceiling. Spaced on a
// world-aligned multiple so they line up across adjacent wall segments
// instead of restarting at each join.
export const TRIM_GREY = 0x8d96a5;
const TRIM_INSET = 0.03;
const RIB_SPACING = 2, RIB_W = 0.14;

const CS = GRID.cellSize || 1;
const cellSet = new Set(GRID.cells.map(([x, z]) => `${x},${z}`));
const has = (ix, iz) => cellSet.has(`${ix},${iz}`);

export const cellToWorld = (ix, iz) => [GX0 + ix * CS, GZ0 + iz * CS];
export const worldToCell = (wx, wz) =>
  [Math.floor((wx - GX0) / CS), Math.floor((wz - GZ0) / CS)];

// ─── ROOMS ──────────────────────────────────────────────────
// Each painted room becomes a bounds rect (for the "what room am I in" test)
// plus the exact cell list (so aliens only ever spawn on real floor, not in
// the empty corner of a bounding box).
export const ROOMS = (GRID.rooms || []).map((r) => {
  const xs = r.cells.map((c) => c[0]), zs = r.cells.map((c) => c[1]);
  return {
    id: r.id,
    label: r.name,
    door: !!r.door,
    cells: r.cells,
    x0: GX0 + Math.min(...xs) * CS,
    x1: GX0 + (Math.max(...xs) + 1) * CS,
    z0: GZ0 + Math.min(...zs) * CS,
    z1: GZ0 + (Math.max(...zs) + 1) * CS,
  };
});

// Cell → room id. Anything painted but untagged is hallway.
const roomOfCell = new Map();
for (const r of GRID.rooms || [])
  for (const [x, z] of r.cells) roomOfCell.set(`${x},${z}`, r.id);

/** Room id at a world position, or null in a hallway / off the map. */
export function roomIdAt(wx, wz) {
  const [ix, iz] = worldToCell(wx, wz);
  return roomOfCell.get(`${ix},${iz}`) || null;
}

/** Human-readable place name for the HUD. */
export function placeNameAt(wx, wz) {
  const [ix, iz] = worldToCell(wx, wz);
  const k = `${ix},${iz}`;
  if (!cellSet.has(k)) return '';
  const id = roomOfCell.get(k);
  if (!id) return 'Hallway';
  return (ROOMS.find((r) => r.id === id) || {}).label || id;
}

/** A guaranteed-on-floor point near the middle of a room. */
export function roomSpawn(roomId) {
  const r = ROOMS.find((q) => q.id === roomId);
  if (!r) return null;
  const mx = r.cells.reduce((a, c) => a + c[0], 0) / r.cells.length;
  const mz = r.cells.reduce((a, c) => a + c[1], 0) / r.cells.length;
  let best = r.cells[0], bd = Infinity;
  for (const c of r.cells) {
    const d = (c[0] - mx) ** 2 + (c[1] - mz) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  const [wx, wz] = cellToWorld(best[0], best[1]);
  return new THREE.Vector3(wx + CS / 2, 0, wz + CS / 2);
}

/** Random floor cell inside a room — used to scatter aliens. */
export function randomCellIn(roomId) {
  const r = ROOMS.find((q) => q.id === roomId);
  if (!r || !r.cells.length) return null;
  const c = r.cells[Math.floor(Math.random() * r.cells.length)];
  const [wx, wz] = cellToWorld(c[0], c[1]);
  return new THREE.Vector3(wx + CS / 2, 0, wz + CS / 2);
}

// ─── WALLS ──────────────────────────────────────────────────
// A wall stands on every edge where painted floor meets empty space.
// Raw, that's one segment per cell edge; colinear neighbours get merged so
// the collision loop walks tens of segments instead of hundreds.
function extractWalls() {
  // `dir` is which way the EMPTY space lies, so the surface normal is its
  // opposite. Without it every wall on an axis gets the same normal, and the
  // ones facing the other way light as if from behind — they come out grey.
  const runs = new Map();          // "axis|pos|dir" → [[min,max], ...]
  const add = (axis, pos, dir, min, max) => {
    const k = `${axis}|${pos}|${dir}`;
    if (!runs.has(k)) runs.set(k, []);
    runs.get(k).push([min, max]);
  };

  for (const k of cellSet) {
    const [ix, iz] = k.split(',').map(Number);
    const [x0, z0] = cellToWorld(ix, iz);
    const x1 = x0 + CS, z1 = z0 + CS;
    if (!has(ix + 1, iz)) add('x', x1,  1, z0, z1);
    if (!has(ix - 1, iz)) add('x', x0, -1, z0, z1);
    if (!has(ix, iz + 1)) add('z', z1,  1, x0, x1);
    if (!has(ix, iz - 1)) add('z', z0, -1, x0, x1);
  }

  const walls = [];
  for (const [k, list] of runs) {
    const [axis, posStr, dirStr] = k.split('|');
    const pos = parseFloat(posStr);
    const dir = parseInt(dirStr, 10);
    list.sort((a, b) => a[0] - b[0]);
    let [cmin, cmax] = list[0];
    for (let i = 1; i < list.length; i++) {
      if (list[i][0] <= cmax + 1e-6) {            // contiguous → extend
        cmax = Math.max(cmax, list[i][1]);
      } else {
        walls.push({ axis, pos, dir, min: cmin, max: cmax });
        [cmin, cmax] = list[i];
      }
    }
    walls.push({ axis, pos, dir, min: cmin, max: cmax });
  }
  return walls;
}

// ─── BUILD ──────────────────────────────────────────────────
export function buildGridMap(scene, materials = {}) {
  const floorMat = materials.floor ||
    new THREE.MeshLambertMaterial({ color: SURFACE_WHITE });
  const wallMat = materials.wall ||
    new THREE.MeshLambertMaterial({ color: SURFACE_WHITE, side: THREE.DoubleSide });

  // Floor: one merged mesh. Per-cell meshes would be 859 draw calls before a
  // single alien exists.
  const fp = [], fn = [], fu = [];
  for (const k of cellSet) {
    const [ix, iz] = k.split(',').map(Number);
    const [x0, z0] = cellToWorld(ix, iz);
    const x1 = x0 + CS, z1 = z0 + CS;
    fp.push(x0, 0, z0, x1, 0, z1, x1, 0, z0,
            x0, 0, z0, x0, 0, z1, x1, 0, z1);
    for (let i = 0; i < 6; i++) fn.push(0, 1, 0);
    fu.push(0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1);
  }
  const floorGeo = new THREE.BufferGeometry();
  floorGeo.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  floorGeo.setAttribute('normal', new THREE.Float32BufferAttribute(fn, 3));
  floorGeo.setAttribute('uv', new THREE.Float32BufferAttribute(fu, 2));
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.receiveShadow = true;
  floorMesh.userData.isWall = true;       // a shot aimed down stops at the floor
  scene.add(floorMesh);

  // Ceiling: the same cells as the floor, lifted to wall height with the
  // winding reversed so the normals face DOWN — otherwise it's lit from above
  // by nothing and renders black from inside the level.
  const cp = [], cn = [];
  for (const k of cellSet) {
    const [ix, iz] = k.split(',').map(Number);
    const [x0, z0] = cellToWorld(ix, iz);
    const x1 = x0 + CS, z1 = z0 + CS;
    cp.push(x0, WALL_HEIGHT, z0, x1, WALL_HEIGHT, z0, x1, WALL_HEIGHT, z1,
            x0, WALL_HEIGHT, z0, x1, WALL_HEIGHT, z1, x0, WALL_HEIGHT, z1);
    for (let i = 0; i < 6; i++) cn.push(0, -1, 0);
  }
  const ceilGeo = new THREE.BufferGeometry();
  ceilGeo.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
  ceilGeo.setAttribute('normal', new THREE.Float32BufferAttribute(cn, 3));
  const ceilMesh = new THREE.Mesh(ceilGeo,
    materials.ceiling || new THREE.MeshLambertMaterial({ color: SURFACE_WHITE }));
  ceilMesh.userData.isWall = true;        // shots stop here instead of escaping
  scene.add(ceilMesh);

  const walls = extractWalls();

  // Walls: one merged mesh for drawing, but each segment ALSO gets an
  // invisible box so shots can raycast against it and stop. One giant merged
  // mesh can't tell the shooter which wall was hit.
  const wp = [], wn = [];
  const wallMeshes = [];
  for (const w of walls) {
    let a = w.axis === 'x' ? [w.pos, w.min] : [w.min, w.pos];
    let b = w.axis === 'x' ? [w.pos, w.max] : [w.max, w.pos];
    // Wind the quad so its FRONT face is the side you stand on. The geometric
    // normal of this winding works out to (-1,0,0) for an x wall and (0,0,1)
    // for a z wall, so these two cases need the ends swapped. Leaving them
    // back-facing is why half the walls stayed grey: with DoubleSide, Three
    // flips the normal on back faces, undoing the inward normal we just set.
    if ((w.axis === 'x' && w.dir === -1) || (w.axis === 'z' && w.dir === 1)) {
      const t = a; a = b; b = t;
    }
    wp.push(a[0], 0, a[1], b[0], 0, b[1], b[0], WALL_HEIGHT, b[1],
            a[0], 0, a[1], b[0], WALL_HEIGHT, b[1], a[0], WALL_HEIGHT, a[1]);
    // Normal points back INTO the room, away from the empty side.
    const nx = w.axis === 'x' ? -w.dir : 0, nz = w.axis === 'x' ? 0 : -w.dir;
    for (let i = 0; i < 6; i++) wn.push(nx, 0, nz);

    const len = w.max - w.min;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(w.axis === 'x' ? 0.12 : len, WALL_HEIGHT,
                            w.axis === 'x' ? len : 0.12),
      new THREE.MeshBasicMaterial({ visible: false }));
    box.position.set(
      w.axis === 'x' ? w.pos : (w.min + w.max) / 2, WALL_HEIGHT / 2,
      w.axis === 'x' ? (w.min + w.max) / 2 : w.pos);
    box.userData.isWall = true;
    box.visible = true;                 // invisible material, still raycastable
    scene.add(box);
    wallMeshes.push(box);
  }
  // Trim band, built from the same segments and nudged off the wall face so
  // it can't z-fight. Unlit on purpose: a Lambert trim would go bright near a
  // lamp and dark between them, which is exactly the uneven look we just
  // finished fixing on the walls themselves.
  const tp = [];
  for (const w of walls) {
    const nx = w.axis === 'x' ? -w.dir : 0, nz = w.axis === 'x' ? 0 : -w.dir;
    const px = w.axis === 'x' ? w.pos + nx * TRIM_INSET : 0;
    const pz = w.axis === 'z' ? w.pos + nz * TRIM_INSET : 0;
    // Vertical ribs along this run, snapped to world multiples of RIB_SPACING.
    const half = RIB_W / 2;
    for (let t = Math.ceil(w.min / RIB_SPACING) * RIB_SPACING; t <= w.max; t += RIB_SPACING) {
      const t0 = Math.max(w.min, t - half), t1 = Math.min(w.max, t + half);
      if (t1 - t0 < 0.01) continue;
      const c = w.axis === 'x' ? [[px, t0], [px, t1]] : [[t0, pz], [t1, pz]];
      tp.push(c[0][0], 0, c[0][1], c[1][0], 0, c[1][1], c[1][0], WALL_HEIGHT, c[1][1],
              c[0][0], 0, c[0][1], c[1][0], WALL_HEIGHT, c[1][1], c[0][0], WALL_HEIGHT, c[0][1]);
    }
  }
  const trimGeo = new THREE.BufferGeometry();
  trimGeo.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
  scene.add(new THREE.Mesh(trimGeo, materials.trim ||
    new THREE.MeshBasicMaterial({ color: TRIM_GREY, side: THREE.DoubleSide })));

  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
  wallGeo.setAttribute('normal', new THREE.Float32BufferAttribute(wn, 3));
  const wallMesh = new THREE.Mesh(wallGeo, wallMat);
  scene.add(wallMesh);

  // ── LIGHTS ────────────────────────────────────────────────
  // builder.js lit each hand-written room; nothing lights a painted grid, so
  // the level came up pitch black. Lamps go on a coarse lattice over the
  // painted cells, so big rooms get several and corridors get their own —
  // rather than one light per room leaving the Hangar's corners dark.
  scene.add(new THREE.AmbientLight(0x8a94a6, 0.45));
  // 10 cells apart gives 24 lamps for this map. Tighter spacing looks nicer
  // but every point light is compiled into the same Lambert shader — at
  // STEP 6 that was 49 of them, which is a real cost for no visible gain.
  const STEP = 10;
  let lamps = 0;
  const seen = new Set();
  for (const k of cellSet) {
    const [ix, iz] = k.split(',').map(Number);
    const gx = Math.round(ix / STEP), gz = Math.round(iz / STEP);
    const gk = `${gx},${gz}`;
    if (seen.has(gk)) continue;
    seen.add(gk);
    const [wx, wz] = cellToWorld(ix, iz);
    const lamp = new THREE.PointLight(0xccd4e4, 0.55, STEP * CS * 1.6);
    lamp.position.set(wx + CS / 2, WALL_HEIGHT * 0.78, wz + CS / 2);
    scene.add(lamp);
    lamps++;
  }

  // bounds keeps the old field names so playerInRoom / currentRoomId still work.
  const bounds = ROOMS.map((r) => ({
    id: r.id, label: r.label, x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1,
  }));

  // Floor and ceiling join the raycast list so shots can't slip through the
  // level's top or bottom and fly off into the void.
  wallMeshes.push(floorMesh, ceilMesh);

  return { bounds, walls, wallMeshes, rooms: ROOMS, cellSize: CS, lamps,
           ceilingY: WALL_HEIGHT };
}
