// falo3d-2/map_walk.js
// Walk around the painted map. No aliens, no gun, fully lit.
//
// Reads falo3d-2/map_data.json (what the Map Editor saves) and builds the
// floor and walls from it, then drops you in with the REAL player controller
// from src/player/controller.js — same speed, same mouse look, same jump, same
// gamepad support — so what you feel here is what the game feels like.
//
// Nothing here writes to the map. It's a viewer.

import * as THREE from 'three';
import { createController, updateController } from '/src/player/controller.js';

// Must match the editor's grid origin, or everything lands in the wrong place.
const GX0 = -48, GZ0 = -96;
const WALL_H = 4;              // same as WALL_HEIGHT in src/map/layout.js
const EYE = 1.6;
const PLAYER_R = 0.35;         // same as PLAYER_RADIUS in src/game.js

const hud = document.getElementById('hud');
const note = document.getElementById('note');
const room = document.getElementById('room');
let lastPlace = null;

const res = await fetch('/api/map', { cache: 'no-store' });
const data = await res.json();
const CS = data.cellSize || 1;
const cells = new Set(data.cells.map(([x, z]) => `${x},${z}`));
if (!cells.size) {
  note.textContent = 'The map is empty — paint some floor at localhost:8005 first.';
  throw new Error('empty map');
}

const has = (ix, iz) => cells.has(`${ix},${iz}`);

// Which room each cell belongs to. Anything painted but untagged is hallway —
// that's exactly what the corridor generator produced.
const roomOf = new Map();
for (const r of (data.rooms || []))
  for (const [x, z] of r.cells) roomOf.set(`${x},${z}`, r.name);
const whereAmI = (ix, iz) =>
  cells.has(`${ix},${iz}`) ? (roomOf.get(`${ix},${iz}`) || 'Hallway') : '—';
const cellOf = (wx, wz) => [Math.floor((wx - GX0) / CS), Math.floor((wz - GZ0) / CS)];

// ─── SCENE ──────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x11141c);
scene.fog = new THREE.Fog(0x11141c, 60, 150);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 400);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Fully lit: heavy ambient so nothing is ever in shadow, plus a weak
// directional purely so walls read as surfaces instead of flat colour.
scene.add(new THREE.AmbientLight(0xffffff, 0.85));
const sun = new THREE.DirectionalLight(0xffffff, 0.45);
sun.position.set(40, 80, 20);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3f4a, 0.5));

// ─── GEOMETRY ───────────────────────────────────────────────
// Every cell and every wall segment goes into ONE merged buffer each, rather
// than one mesh per tile. 833 cells as individual meshes would be 833 draw
// calls before a single alien exists.
function buildFloor() {
  const pos = [], norm = [], uv = [];
  for (const k of cells) {
    const [ix, iz] = k.split(',').map(Number);
    const x0 = GX0 + ix * CS, z0 = GZ0 + iz * CS, x1 = x0 + CS, z1 = z0 + CS;
    pos.push(x0, 0, z0, x1, 0, z1, x1, 0, z0,
             x0, 0, z0, x0, 0, z1, x1, 0, z1);
    for (let i = 0; i < 6; i++) norm.push(0, 1, 0);
    uv.push(0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

function buildWalls() {
  const pos = [], norm = [];
  // A wall stands wherever a painted cell meets an unpainted one.
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let count = 0;
  for (const k of cells) {
    const [ix, iz] = k.split(',').map(Number);
    for (const [dx, dz] of dirs) {
      if (has(ix + dx, iz + dz)) continue;
      count++;
      const x0 = GX0 + ix * CS, z0 = GZ0 + iz * CS, x1 = x0 + CS, z1 = z0 + CS;
      let a, b;
      if (dx === 1)       { a = [x1, z0]; b = [x1, z1]; }
      else if (dx === -1) { a = [x0, z1]; b = [x0, z0]; }
      else if (dz === 1)  { a = [x1, z1]; b = [x0, z1]; }
      else                { a = [x0, z0]; b = [x1, z0]; }
      pos.push(a[0], 0, a[1], b[0], 0, b[1], b[0], WALL_H, b[1],
               a[0], 0, a[1], b[0], WALL_H, b[1], a[0], WALL_H, a[1]);
      const nx = -dx, nz = -dz;
      for (let i = 0; i < 6; i++) norm.push(nx, 0, nz);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  return { geo: g, count };
}

const floorMesh = new THREE.Mesh(buildFloor(),
  new THREE.MeshLambertMaterial({ color: 0x4a5668 }));
scene.add(floorMesh);

const { geo: wallGeo, count: wallCount } = buildWalls();
scene.add(new THREE.Mesh(wallGeo,
  new THREE.MeshLambertMaterial({ color: 0x79859b, side: THREE.DoubleSide })));

// Grid overlay on the floor, so you can feel the cell scale while walking.
const gridLines = [];
for (const k of cells) {
  const [ix, iz] = k.split(',').map(Number);
  const x0 = GX0 + ix * CS, z0 = GZ0 + iz * CS, x1 = x0 + CS, z1 = z0 + CS;
  gridLines.push(x0, 0.01, z0, x1, 0.01, z0, x0, 0.01, z0, x0, 0.01, z1);
}
const gg = new THREE.BufferGeometry();
gg.setAttribute('position', new THREE.Float32BufferAttribute(gridLines, 3));
scene.add(new THREE.LineSegments(gg,
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 })));

// ─── SPAWN ──────────────────────────────────────────────────
// The cell furthest from any wall — i.e. the middle of the most open space.
// A plain centroid lands you in a corridor as often as not, nose to the wall.
function mostOpenCell() {
  const dist = new Map(), queue = [];
  for (const k of cells) {
    const [ix, iz] = k.split(',').map(Number);
    const edge = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz]) => !has(ix+dx, iz+dz));
    if (edge) { dist.set(k, 1); queue.push(k); }
  }
  for (let head = 0; head < queue.length; head++) {
    const k = queue[head], d = dist.get(k);
    const [ix, iz] = k.split(',').map(Number);
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const n2 = `${ix+dx},${iz+dz}`;
      if (cells.has(n2) && !dist.has(n2)) { dist.set(n2, d + 1); queue.push(n2); }
    }
  }
  let best = null, bd = -1;
  for (const [k, d] of dist) if (d > bd) { bd = d; best = k; }
  return { cell: best.split(',').map(Number), clearance: bd };
}
const open = mostOpenCell();
const spawn = open.cell;

const ctrl = createController(camera, renderer.domElement);
ctrl.position.set(GX0 + (spawn[0] + 0.5) * CS, EYE, GZ0 + (spawn[1] + 0.5) * CS);
ctrl.groundY = EYE;

// ─── COLLISION ──────────────────────────────────────────────
// Painted cell = walkable. Checked at the player's corners so you can't clip a
// wall corner, and resolved on X and Z independently so sliding along a wall
// works instead of sticking.
function walkable(wx, wz) {
  for (const ox of [-PLAYER_R, PLAYER_R])
    for (const oz of [-PLAYER_R, PLAYER_R]) {
      const [ix, iz] = cellOf(wx + ox, wz + oz);
      if (!has(ix, iz)) return false;
    }
  return true;
}

let noclip = false;
addEventListener('keydown', (e) => {
  if (e.code === 'KeyN') { noclip = !noclip; flash(noclip ? 'noclip ON' : 'noclip off'); }
  if (e.code === 'KeyR') {
    ctrl.position.set(GX0 + (spawn[0] + 0.5) * CS, EYE, GZ0 + (spawn[1] + 0.5) * CS);
    flash('respawned');
  }
});
let flashUntil = 0, flashMsg = '';
const flash = (m) => { flashMsg = m; flashUntil = performance.now() + 1200; };

// ─── LOOP ───────────────────────────────────────────────────
const prev = new THREE.Vector3();
let last = performance.now();
function frame() {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  prev.copy(ctrl.position);
  updateController(ctrl, dt);

  if (!noclip) {
    const p = ctrl.position;
    if (!walkable(p.x, prev.z)) p.x = prev.x;
    if (!walkable(p.x, p.z)) p.z = prev.z;
  }
  camera.position.copy(ctrl.position);

  const [ix, iz] = cellOf(ctrl.position.x, ctrl.position.z);
  const place = whereAmI(ix, iz);
  if (place !== lastPlace) {
    lastPlace = place;
    room.textContent = place;
    room.style.color = place === 'Hallway' ? '#ffaa22'
                     : place === '—' ? '#ff6677' : '#7fd6ff';
  }
  hud.innerHTML =
    `<b>x</b> ${ctrl.position.x.toFixed(1)}  <b>z</b> ${ctrl.position.z.toFixed(1)}` +
    `  ·  cell ${ix},${iz}` +
    `  ·  ${cells.size} cells @ ${CS}u  ·  ${wallCount} walls` +
    `  ·  spawn clearance ${open.clearance} cells` +
    (noclip ? '  ·  <span style="color:#ffaa22">NOCLIP</span>' : '') +
    (now < flashUntil ? `  ·  <span style="color:#44ff88">${flashMsg}</span>` : '');

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

note.innerHTML = 'click to look around · <b>WASD</b> move · <b>space</b> jump · ' +
                 '<b>N</b> noclip · <b>R</b> respawn · <b>esc</b> release mouse';
