// src/cutscene/descent.js
// WHAT YOU ESCAPED TO
//
// FLETCHER'S GUIDE:
// The pod gets away, and for about twenty seconds you think you are going
// home. The planet ahead is blue and green with white cloud over it, and it
// is only when the cloud parts that you can see the land is purple, the
// lakes are red, the mountains are far too tall, and there is something
// already living there.
//
// None of this is a picture file. The planet's surface is drawn onto a
// canvas with code — oceans, then continents, then ice — and handed to
// three.js as a texture. There are two of them at the same size: the Earth
// one on top, the real one underneath. The lie is not clever, it is just
// the top layer fading out while the clouds are in the way.
//
// The last six seconds happen on real ground rather than on the sphere, and
// everything down there is laid out from one list of places (CASTLE, TOWN,
// OUTPOST, LAKES) so the camera path, the shape of the land and the
// buildings cannot disagree about where anything is.
//
// Press any key to skip it.

import * as THREE from 'three';
import { buildCrawler } from '../aliens/crawler.js?v=cbc9eb3c8b';
import { buildBrute } from '../aliens/brute.js?v=cbc9eb3c8b';
import { buildWatcher } from '../aliens/watcher.js?v=cbc9eb3c8b';
import { buildFloater } from '../aliens/floater.js?v=cbc9eb3c8b';

// ─── WHERE EVERYTHING IS ────────────────────────────────────
// The pod comes down the middle of a valley. Their city is ahead and to the
// left; the burning outpost is ahead and a long way further out, which is
// what the pod is aimed at. Both have to stay in frame at once, so these
// two numbers are the ones that decide the whole shot.
const CASTLE  = { x: -200, z: -1000 };
const OUTPOST = { x:  260, z: -1620 };

// The valley: flat inside this ellipse, mountains outside it. Flat ground
// is where the town, the outpost and the pod's path all have to live, and
// the mountains have to start far enough out that they ring the shot
// instead of standing in it.
const BASIN = { x: 60, z: -750, rx: 820, rz: 1000 };

// The ground itself. Five thousand across sounds absurd for six seconds of
// film, but the first cut was nine hundred, and at this altitude you could
// see the edge of the world behind the castle — which is the whole reason
// any of this was rebuilt.
const LAND = { size: 5000, seg: 200, cz: -700 };

// Red water. Holes in the land, dug by heightAt, so the discs sit in real
// basins rather than floating on a bumpy floor.
const LAKES = [
  { x: -480, z:  -620, r: 110 },
  { x:  180, z:  -300, r:  90 },
  { x: -120, z: -1380, r: 130 },
  { x:  430, z:  -980, r:  95 },
  { x: -620, z: -1180, r:  85 },
  { x:   60, z:   180, r: 100 },
];

const SKY = 0x3d2058;   // sky and haze are the same colour, so there is no
                        // seam where the land runs out

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ─── DRAWING A WORLD ────────────────────────────────────────

/** A canvas, drawn on by the function you pass, handed back as a texture. */
function painted(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/** A rough continent: a blob with a lumpy edge, rather than a circle. */
function blob(g, x, y, r, lumps = 9) {
  g.beginPath();
  for (let i = 0; i <= lumps; i++) {
    const a = (i / lumps) * Math.PI * 2;
    const rr = r * (0.55 + Math.random() * 0.7);
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr * 0.75;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();
}

/** Home, or near enough to fool you from a long way out. */
function earthTexture() {
  return painted(1024, 512, (g, w, h) => {
    g.fillStyle = '#12457f'; g.fillRect(0, 0, w, h);          // ocean
    g.fillStyle = '#0d3566';
    for (let i = 0; i < 26; i++) {                            // deeper water
      blob(g, Math.random() * w, Math.random() * h, 30 + Math.random() * 70);
    }
    for (let i = 0; i < 16; i++) {                            // land
      g.fillStyle = ['#2f6b35', '#3c7a3a', '#6b6a3a', '#5a4f31'][i % 4];
      blob(g, Math.random() * w, 70 + Math.random() * (h - 140),
           45 + Math.random() * 95, 11);
    }
    g.fillStyle = '#eef4f8';                                  // ice caps
    g.fillRect(0, 0, w, 26);
    g.fillRect(0, h - 30, w, 30);
    for (let i = 0; i < 22; i++) {
      blob(g, Math.random() * w, 26 + Math.random() * 22, 18 + Math.random() * 26, 7);
      blob(g, Math.random() * w, h - 34 - Math.random() * 22, 18 + Math.random() * 30, 7);
    }
  });
}

/** What is actually down there. */
function alienTexture() {
  return painted(1024, 512, (g, w, h) => {
    g.fillStyle = '#1b0b2b'; g.fillRect(0, 0, w, h);          // dark ground
    for (let i = 0; i < 20; i++) {                            // purple land
      g.fillStyle = ['#4a1c78', '#5d2492', '#3a1460', '#6b2ea8'][i % 4];
      blob(g, Math.random() * w, Math.random() * h, 55 + Math.random() * 110, 11);
    }
    for (let i = 0; i < 34; i++) {                            // red water
      g.fillStyle = ['#9b1220', '#c01a28', '#7a0d18'][i % 3];
      blob(g, Math.random() * w, 40 + Math.random() * (h - 80),
           16 + Math.random() * 46, 9);
    }
    g.fillStyle = 'rgba(255,120,190,0.14)';                   // sick haze
    for (let i = 0; i < 12; i++) {
      blob(g, Math.random() * w, Math.random() * h, 60 + Math.random() * 120, 8);
    }
  });
}

/** Cloud, with holes in it — the holes are the point. */
function cloudTexture() {
  return painted(1024, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    // Banded rather than scattered, the way weather actually sits on a
    // planet, and with real gaps in it — the gaps are what let the blue
    // through, and the blue is the whole lie.
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 34; i++) {
      const band = (i % 5) / 5 * h + (Math.random() - 0.5) * 48;
      blob(g, Math.random() * w, band, 24 + Math.random() * 52, 10);
    }
    g.fillStyle = 'rgba(238,245,255,0.5)';
    for (let i = 0; i < 26; i++) {
      blob(g, Math.random() * w, Math.random() * h, 14 + Math.random() * 34, 9);
    }
  });
}

// ─── THE POD ────────────────────────────────────────────────
// Seen from behind and slightly above, which is the only angle it is ever
// seen from, so it is built to look right from exactly there.
function buildPod() {
  const g = new THREE.Group();
  const hull = new THREE.MeshLambertMaterial({ color: 0x9aa3ad });
  const dark = new THREE.MeshLambertMaterial({ color: 0x3a4048 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 1.9, 12), hull);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 12), hull);
  nose.rotation.x = -Math.PI / 2; nose.position.z = -1.35; g.add(nose);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.5, 0.3, 12), dark);
  skirt.rotation.x = Math.PI / 2; skirt.position.z = 1.05; g.add(skirt);

  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.8), dark);
    const a = (i / 3) * Math.PI * 2;
    fin.position.set(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.6);
    fin.rotation.z = a;
    g.add(fin);
  }
  // The window you are looking out of.
  const win = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x8fd8ff }));
  win.position.set(0, 0.34, -0.5); g.add(win);

  // The motor, which is also the only light on the thing.
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.1, 10),
    new THREE.MeshBasicMaterial({ color: 0xffb648, transparent: true, opacity: 0.85 }));
  flame.rotation.x = Math.PI / 2; flame.position.z = 1.9;
  flame.name = 'flame';
  g.add(flame);
  const glow = new THREE.PointLight(0xffa030, 2.2, 9);
  glow.position.z = 1.6; g.add(glow);
  return g;
}

// ─── THE GROUND ─────────────────────────────────────────────
// A second set built for the last few seconds, when you are low enough that
// a painted sphere would not hold up. Swapped in behind the cloud, so you
// never see the join.

/**
 * How high the land is at any point — the one answer everything else asks.
 *
 * Height comes from sines laid across each other at different sizes: big
 * slow ones for the ranges, small fast ones for the roughness. That is why
 * the peaks are tall enough to look wrong — the biggest wave is simply
 * given a very large number.
 *
 * Then two things bend it. The valley flattens the middle, so the pod has
 * somewhere to fly and the town has somewhere to stand. The lakes dig
 * themselves basins, so red water sits in a hole instead of on a hill.
 */
function heightAt(x, z) {
  const raw =
      Math.sin(x * 0.0065) * Math.cos(z * 0.0051) * 115   // the ranges
    + Math.sin(x * 0.019 + 1.7) * Math.cos(z * 0.017) * 42
    + Math.sin(x * 0.051 + 0.6) * Math.cos(z * 0.047) * 13
    + Math.sin(x * 0.11) * Math.cos(z * 0.13) * 4;        // scree

  // 0.1 inside the valley, 1 out where the mountains are.
  const e = Math.hypot((x - BASIN.x) / BASIN.rx, (z - BASIN.z) / BASIN.rz);
  let y = Math.max(-20, raw) * (0.1 + 0.9 * smoothstep(1.0, 1.9, e));

  for (const L of LAKES) {
    const d = Math.hypot(x - L.x, z - L.z);
    if (d < L.r * 1.3) {
      const k = smoothstep(L.r * 1.3, L.r * 0.55, d);
      y = y * (1 - k) + (-26) * k;
    }
  }
  return y;
}

/** The land, as far out as the haze can hide. */
function buildTerrain() {
  const geo = new THREE.PlaneGeometry(LAND.size, LAND.size, LAND.seg, LAND.seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const low = new THREE.Color(0x3a1456);     // valley floor
  const mid = new THREE.Color(0x6b2ea8);     // the purple you see from orbit
  const high = new THREE.Color(0xd8c4f0);    // something like snow, but not

  for (let i = 0; i < pos.count; i++) {
    const y = heightAt(pos.getX(i), pos.getZ(i) + LAND.cz);
    pos.setY(i, y);
    const t = Math.min(1, Math.max(0, (y + 26) / 180));
    const c = t < 0.62
      ? low.clone().lerp(mid, t / 0.62)
      : mid.clone().lerp(high, (t - 0.62) / 0.38);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  // No flatShading here: r128's Lambert does not have it and warns once per
  // material, which is six lines of console noise for a setting that was
  // never applied in the first place.
  const mesh = new THREE.Mesh(geo,
    new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.position.z = LAND.cz;
  return mesh;
}

/** Red water, sitting in the holes it dug. */
function buildLakes() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xb01424 });
  const rim = new THREE.MeshBasicMaterial({ color: 0xe8304a });
  for (const L of LAKES) {
    const lake = new THREE.Mesh(new THREE.CircleGeometry(L.r, 30), mat);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(L.x, -20, L.z);
    g.add(lake);
    const ring = new THREE.Mesh(new THREE.RingGeometry(L.r * 0.96, L.r * 1.12, 30), rim);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(L.x, -19.6, L.z);
    g.add(ring);
  }
  return g;
}

/**
 * The castle.
 *
 * Deliberately far too big — it is meant to read as "something built this"
 * from an altitude where the mountains are already enormous.
 */
function buildCastle() {
  const g = new THREE.Group();
  const stone = new THREE.MeshLambertMaterial({ color: 0x2a1c3e });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1028 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xff2a5a });

  const keep = new THREE.Mesh(new THREE.BoxGeometry(70, 95, 70), stone);
  keep.position.y = 47; g.add(keep);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(58, 60, 6), dark);
  crown.position.y = 122; crown.rotation.y = Math.PI / 6; g.add(crown);

  // Four towers, taller than the keep, because nothing here is to scale.
  for (const [dx, dz] of [[-52, -52], [52, -52], [-52, 52], [52, 52]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(15, 19, 135, 8), stone);
    t.position.set(dx, 67, dz); g.add(t);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(21, 38, 8), dark);
    cap.position.set(dx, 152, dz); g.add(cap);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(5, 8, 6), glow);
    eye.position.set(dx, 128, dz); g.add(eye);
  }

  // Curtain wall.
  for (const [dx, dz, w, d] of [[0, -95, 190, 12], [0, 95, 190, 12],
                                [-95, 0, 12, 190], [95, 0, 12, 190]]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 40, d), stone);
    wall.position.set(dx, 20, dz); g.add(wall);
  }
  // Something burning in the courtyard.
  const fire = new THREE.PointLight(0xff3a60, 3.5, 320);
  fire.position.set(0, 60, 0); g.add(fire);
  return g;
}

/**
 * Their town, in rings around the castle, because the castle is what the
 * town is for.
 *
 * An alien house here is three shapes: a six-sided shell that is wider at
 * the bottom, a spire far too long for it, and sometimes one lit window.
 * Every one of them leans a little, which is most of what stops a field of
 * cones from looking like a field of cones.
 */
function buildTown() {
  const g = new THREE.Group();
  const shell = new THREE.MeshLambertMaterial({ color: 0x3a2150 });
  const roof = new THREE.MeshLambertMaterial({ color: 0x241334 });
  const hive = new THREE.MeshLambertMaterial({ color: 0x2c1a44 });
  const lamp = new THREE.MeshBasicMaterial({ color: 0x8cf0b4 });

  // Nothing inside the walls, and nothing standing in a lake.
  const clear = (x, z) => {
    if (Math.hypot(x - CASTLE.x, z - CASTLE.z) < 150) return false;
    for (const L of LAKES) if (Math.hypot(x - L.x, z - L.z) < L.r + 45) return false;
    return true;
  };

  const house = (x, z) => {
    const b = new THREE.Group();
    const h = 13 + Math.random() * 13;
    const r = 7 + Math.random() * 5;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.72, r, h, 6), shell);
    body.position.y = h / 2; b.add(body);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.95, h * 1.5, 6), roof);
    cap.position.y = h + h * 0.74; b.add(cap);
    if (Math.random() < 0.55) {
      const a = Math.random() * Math.PI * 2;
      const w = new THREE.Mesh(new THREE.SphereGeometry(1.6, 6, 5), lamp);
      w.position.set(Math.cos(a) * r * 0.85, h * 0.62, Math.sin(a) * r * 0.85);
      b.add(w);
    }
    b.rotation.y = Math.random() * Math.PI;
    b.rotation.z = (Math.random() - 0.5) * 0.11;
    b.position.set(x, heightAt(x, z) - 1, z);
    g.add(b);
  };

  for (const [ring, n] of [[175, 11], [250, 16], [330, 22], [415, 19]]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const rr = ring + (Math.random() - 0.5) * 64;
      const x = CASTLE.x + Math.cos(a) * rr;
      const z = CASTLE.z + Math.sin(a) * rr;
      if (clear(x, z)) house(x, z);
    }
  }

  // A few hive spires, so the skyline is not all one height.
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = 190 + Math.random() * 250;
    const x = CASTLE.x + Math.cos(a) * rr;
    const z = CASTLE.z + Math.sin(a) * rr;
    if (!clear(x, z)) continue;
    const base = heightAt(x, z);
    const h = 46 + Math.random() * 36;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 9, h, 6), hive);
    s.position.set(x, base + h / 2, z);
    s.rotation.z = (Math.random() - 0.5) * 0.15;
    g.add(s);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(3.4, 8, 6), lamp);
    tip.position.set(x, base + h + 2, z);
    g.add(tip);
  }
  return g;
}

/**
 * The outpost, out past the edge of town and burning.
 *
 * Ours, not theirs — grey prefabs, a landing pad, a comms mast and a wire
 * fence, so that from a long way off it reads as the last human thing on
 * the planet. One block is open to the sky with a fire in it and a column
 * of smoke leaning off in the wind, and that column is the only reason you
 * can pick the place out at this distance.
 *
 * The group carries its own tick(): twelve puffs climbing the column on a
 * loop, flames that never hold still, and a light that flickers with them.
 */
function buildOutpost() {
  const g = new THREE.Group();
  const prefab = new THREE.MeshLambertMaterial({ color: 0x8d9299 });
  const olive = new THREE.MeshLambertMaterial({ color: 0x4b5340 });
  const metal = new THREE.MeshLambertMaterial({ color: 0x5a6068 });
  const deck = new THREE.MeshBasicMaterial({ color: 0x1e2228 });
  const paint = new THREE.MeshBasicMaterial({ color: 0xe8c23a });
  const burnt = new THREE.MeshLambertMaterial({ color: 0x2b2a2c });

  // Prefab blocks, long low things with a roof vent each.
  for (const [x, z, w, d, h, mat] of [
    [-54, -26, 50, 26, 22, prefab],
    [8, -42, 42, 24, 19, prefab],
    [46, 30, 32, 20, 17, olive],
    [-34, 40, 28, 18, 15, olive],
  ]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, h / 2, z); g.add(b);
    const vent = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, 4, d * 0.4), metal);
    vent.position.set(x, h + 2, z); g.add(vent);
  }

  // Landing pad, with the markings that say what it is.
  const pad = new THREE.Mesh(new THREE.CircleGeometry(34, 26), deck);
  pad.rotation.x = -Math.PI / 2; pad.position.set(4, 0.6, 24); g.add(pad);
  const ring = new THREE.Mesh(new THREE.RingGeometry(26, 30, 26), paint);
  ring.rotation.x = -Math.PI / 2; ring.position.set(4, 0.9, 24); g.add(ring);

  // Comms mast.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 70, 6), metal);
  mast.position.set(-78, 35, 26); g.add(mast);
  for (const y of [40, 54, 64]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(22, 1.6, 1.6), metal);
    arm.position.set(-78, y, 26); arm.rotation.y = y * 0.4; g.add(arm);
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff3020 }));
  beacon.position.set(-78, 72, 26); g.add(beacon);

  // Fence and two watchtowers — the military look is mostly the fence.
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.6, 9, 1.6), metal);
    post.position.set(Math.cos(a) * 104, 4.5, Math.sin(a) * 104);
    g.add(post);
  }
  for (const [x, z] of [[-96, -74], [96, 74]]) {
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(3, 5, 26, 6), metal);
    legs.position.set(x, 13, z); g.add(legs);
    const box = new THREE.Mesh(new THREE.BoxGeometry(14, 9, 14), olive);
    box.position.set(x, 30, z); g.add(box);
  }

  // The block that lost. Walls still standing, roof gone, fire inside.
  const fx = 58, fz = -34;
  for (const [dx, dz, w, d] of [[-16, 0, 3, 30], [16, 0, 3, 30], [0, -15, 34, 3]]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 16, d), burnt);
    wall.position.set(fx + dx, 8, fz + dz); g.add(wall);
  }
  const flames = [];
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xffa32a,
                                                transparent: true, opacity: 0.95 });
  for (const [dx, dz, s] of [[0, 0, 1.3], [-8, 6, 0.9], [9, -4, 1], [2, 9, 0.8]]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(7 * s, 26 * s, 7), fireMat);
    f.position.set(fx + dx, 11 * s, fz + dz);
    g.add(f); flames.push(f);
  }
  const fireLight = new THREE.PointLight(0xff7a20, 4, 260);
  fireLight.position.set(fx, 20, fz); g.add(fireLight);

  // The smoke. Each puff climbs the column, swells, thins out and comes
  // back round to the bottom, which is enough to read as rising from a
  // thousand units away.
  const puffs = [];
  for (let i = 0; i < 12; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(1, 9, 7),
      new THREE.MeshBasicMaterial({ color: 0x3b3340, transparent: true,
                                    opacity: 0.6, depthWrite: false }));
    p.userData.off = i / 12;
    g.add(p); puffs.push(p);
  }

  let st = Math.random() * 8;
  g.userData.tick = (dt) => {
    st += dt;
    for (const p of puffs) {
      const k = (st * 0.17 + p.userData.off) % 1;
      p.scale.setScalar(10 + k * 36);
      p.position.set(fx + k * 54 + Math.sin(k * 7 + p.userData.off * 9) * 11,
                     14 + k * 215,
                     fz - k * 38);
      p.material.opacity = 0.72 * (1 - k * 0.92);
    }
    for (const f of flames) {
      f.scale.set(0.8 + Math.random() * 0.5, 0.75 + Math.random() * 0.85,
                  0.8 + Math.random() * 0.5);
    }
    fireLight.intensity = 3 + Math.random() * 2.6;
  };
  return g;
}

/**
 * Them, waiting for you.
 *
 * The same four models the station is full of, scaled up a long way — from
 * the altitude this is seen at, an actual-size Crawler would be less than a
 * pixel, and the point of the shot is that you can tell what they are.
 */
function buildWelcome() {
  const g = new THREE.Group();
  const kinds = [buildCrawler, buildBrute, buildWatcher, buildFloater];
  const place = (x, z, s) => {
    const make = kinds[Math.floor(Math.random() * kinds.length)];
    let m;
    try { m = make(); } catch (e) { return; }
    m.scale.setScalar(s);
    m.position.set(x, heightAt(x, z) - 1 + s * 0.45, z);
    m.rotation.y = Math.random() * Math.PI * 2;
    g.add(m);
  };
  for (let i = 0; i < 42; i++) {                 // in the streets
    const a = Math.random() * Math.PI * 2;
    const r = 130 + Math.random() * 320;
    place(CASTLE.x + Math.cos(a) * r, CASTLE.z + Math.sin(a) * r,
          10 + Math.random() * 9);
  }
  // All the way down the valley, not just the near half — the last two
  // seconds are spent over ground that the first version left empty.
  for (let i = 0; i < 36; i++) {                 // under the flight path
    place(-260 + Math.random() * 620, 150 - Math.random() * 1250,
          9 + Math.random() * 10);
  }
  for (let i = 0; i < 9; i++) {                  // and already at the outpost
    const a = Math.random() * Math.PI * 2;
    const r = 120 + Math.random() * 150;
    place(OUTPOST.x + Math.cos(a) * r, OUTPOST.z + Math.sin(a) * r,
          10 + Math.random() * 8);
  }
  return g;
}

// ─── THE CUTSCENE ───────────────────────────────────────────
// Five beats. The numbers are seconds from the moment the pod gets clear.
const BEAT = {
  approach: 0,      // a blue planet, a long way off
  clouds:   5.5,    // into the weather
  reveal:   9.5,    // the cloud opens and it is not home
  surface:  14.5,   // low enough to see what lives here
  impact:   20.5,   // the ground
  over:     23.0,
};

export function createDescent() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05040c);
  // The near plane matters more than it looks. Depth precision is spent
  // mostly on whatever is closest, so 0.1 against a 9000 far plane leaves
  // almost none for a planet two thousand units away — which showed up as
  // the real surface tearing through the fake one in red streaks. Nothing
  // here is ever nearer than the pod, so it can start much further out.
  const camera = new THREE.PerspectiveCamera(58, 16 / 9, 1.5, 9000);

  scene.add(new THREE.AmbientLight(0x6a5a80, 0.75));
  const sun = new THREE.DirectionalLight(0xffeedd, 1.5);
  sun.position.set(-1, 0.55, 1);
  scene.add(sun);

  // Stars. Behind everything, and they never move, which is what makes the
  // planet look like the thing that is moving.
  const starGeo = new THREE.BufferGeometry();
  const sp = [];
  for (let i = 0; i < 1400; i++) {
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5,
                                Math.random() - 0.5).normalize().multiplyScalar(4000);
    sp.push(v.x, v.y, v.z);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo,
    new THREE.PointsMaterial({ color: 0xffffff, size: 7, sizeAttenuation: true }));
  stars.frustumCulled = false;
  scene.add(stars);

  // ── The planet: two skins and a lid ──
  const R = 600;
  const planet = new THREE.Group();
  planet.position.set(0, -40, -2600);
  scene.add(planet);

  const truth = new THREE.Mesh(new THREE.SphereGeometry(R, 56, 40),
    new THREE.MeshLambertMaterial({ map: alienTexture() }));
  planet.add(truth);

  // The lie, a whisker above it, fading out once the cloud is in the way.
  // And a real gap between the two skins, rather than a whisker.
  const lie = new THREE.Mesh(new THREE.SphereGeometry(R * 1.014, 56, 40),
    new THREE.MeshLambertMaterial({ map: earthTexture(), transparent: true }));
  planet.add(lie);

  const cloud = new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 48, 32),
    new THREE.MeshLambertMaterial({ map: cloudTexture(), transparent: true,
                                    opacity: 0.8, depthWrite: false }));
  planet.add(cloud);

  // A rim of atmosphere, drawn from behind so it reads as a glow.
  const air = new THREE.Mesh(new THREE.SphereGeometry(R * 1.1, 40, 28),
    new THREE.MeshBasicMaterial({ color: 0x8f6ad8, transparent: true,
                                  opacity: 0.16, side: THREE.BackSide }));
  planet.add(air);

  // ── The ground, hidden until it is needed ──
  const ground = new THREE.Group();
  ground.visible = false;
  scene.add(ground);
  ground.add(buildTerrain());
  ground.add(buildLakes());
  const castle = buildCastle();
  castle.position.set(CASTLE.x, heightAt(CASTLE.x, CASTLE.z) - 6, CASTLE.z);
  ground.add(castle);
  ground.add(buildTown());
  const outpost = buildOutpost();
  outpost.position.set(OUTPOST.x, heightAt(OUTPOST.x, OUTPOST.z) - 1, OUTPOST.z);
  // Built at a sensible size and then made half again as big, because what
  // matters is that it is readable from eleven hundred units away, not that
  // its huts are to scale with their houses.
  outpost.scale.setScalar(1.55);
  ground.add(outpost);
  ground.add(buildWelcome());
  const groundSun = new THREE.DirectionalLight(0xffc0e0, 1.1);
  groundSun.position.set(-0.6, 1, 0.3);
  ground.add(groundSun);
  // Thick purple air, so the far mountains sit back rather than cutting out,
  // and the same colour as the sky, so the far edge of the land dissolves
  // instead of ending in a line.
  const haze = new THREE.FogExp2(SKY, 0.00055);

  // ── The pod ──
  const pod = buildPod();
  // Down in the corner and a good way out, so it frames the shot rather than
  // blocking it — the planet is what you are meant to be looking at.
  pod.scale.setScalar(0.72);
  pod.position.set(-3.6, -2.0, -10.4);
  // Turned enough that you see its flank and the nose going away from you.
  // Square on, all you can see is the ring of the skirt with the flame as a
  // flat orange disc inside it, which reads as a doughnut, not a spacecraft.
  pod.rotation.y = -0.34;
  // Hung off the camera rather than the scene, so it keeps its place in the
  // frame wherever the shot goes — the same way the gun does in the game.
  camera.add(pod);
  scene.add(camera);
  const flame = pod.getObjectByName('flame');

  let t = 0;
  let done = false;
  let fade = 0;             // 0 clear, 1 black
  let held = false;         // debug: stopped on one frame, see seek()

  function at(a, b, time) {           // 0..1 across a beat
    return Math.min(1, Math.max(0, (time - a) / (b - a)));
  }
  const ease = (x) => x * x * (3 - 2 * x);

  function update(dt) {
    if (done) return true;
    if (held) dt = 0;       // everything below reads t, so a zero step holds
    t += dt;

    // The pod rides in front of you the whole way, rolling slightly.
    pod.rotation.z = Math.sin(t * 0.7) * 0.11;
    pod.rotation.x = -0.06 + Math.sin(t * 0.5) * 0.04;
    if (flame) {
      const f = 0.8 + Math.random() * 0.5;
      flame.scale.set(f, 1 + Math.random() * 0.7, f);
    }
    planet.rotation.y += dt * 0.02;
    cloud.rotation.y += dt * 0.035;
    if (ground.visible) outpost.userData.tick(dt);

    if (t < BEAT.clouds) {
      // Coming in. The planet grows because we are closing on it.
      const k = ease(at(BEAT.approach, BEAT.clouds, t));
      // The planet is 600 across, so the camera has to stay well clear of
      // that or it ends up inside the world looking at the back of its own
      // atmosphere — which is exactly what the first cut of this did.
      planet.position.z = -2600 + k * 900;
      camera.position.set(0, 0.6, 0);
      camera.rotation.set(0, 0, 0);
      lie.material.opacity = 1;

    } else if (t < BEAT.reveal) {
      // Into the weather. Cloud swallows the view.
      const k = ease(at(BEAT.clouds, BEAT.reveal, t));
      planet.position.z = -1700 + k * 800;
      cloud.material.opacity = 0.8;
      camera.position.set(Math.sin(t * 1.3) * 0.25, 0.6 + Math.sin(t * 0.9) * 0.2, 0);

    } else if (t < BEAT.surface) {
      // The cloud opens. Underneath it, the lie goes.
      const k = ease(at(BEAT.reveal, BEAT.surface, t));
      // Ends 160 above the surface: close enough that it fills the frame,
      // far enough that it is still a world rather than a wall.
      planet.position.z = -900 + k * 140;
      lie.material.opacity = 1 - k;                 // Earth fades off it
      cloud.material.opacity = 0.8 * (1 - k * 0.95);
      air.material.opacity = 0.16 + k * 0.2;
      camera.position.set(Math.sin(t * 1.1) * 0.3, 0.6, 0);
      // The last half-second washes out, and the cut happens inside it.
      fade = k > 0.86 ? (k - 0.86) / 0.14 : 0;

    } else if (t < BEAT.impact) {
      // On the deck. Everything above is gone; this is the real ground.
      if (!ground.visible) {
        ground.visible = true;
        planet.visible = false;
        stars.visible = false;
        scene.background = new THREE.Color(SKY);        // a bruised sky
        scene.fog = haze;
      }
      const k = at(BEAT.surface, BEAT.impact, t);
      // Down the valley, aimed at the smoke.
      //
      // The drift and the turn are not decoration. Their city sits off to
      // the left of the line and the outpost is a long way beyond it, and
      // the shot has to hold both at once — too much turn and the castle
      // leaves the frame, too little and the pod is not going anywhere in
      // particular.
      camera.position.set(ease(k) * 55, 360 - ease(k) * 260, 650 - k * 900);
      camera.rotation.set(-0.46 + ease(k) * 0.20, -ease(k) * 0.09,
                          Math.sin(t * 0.6) * 0.04);
      pod.position.set(-3.6, -2.0 - k * 0.5, -10.4 + k * 1.4);
      // Back in out of the black the reveal ended on.
      fade = 1 - Math.min(1, (t - BEAT.surface) / 0.7);

    } else {
      // The ground. Nothing clever — it simply stops.
      const k = at(BEAT.impact, BEAT.over, t);
      camera.position.set(55 + k * 35, 100 - ease(k) * 62, -250 - k * 380);
      camera.rotation.set(-0.26 - ease(k) * 0.14, -0.09, 0);
      pod.position.set(-3.6, -2.5, -9.0 + k * 2.4);
      // Full black a little before the ground actually arrives, so you
      // never see the camera go through it.
      fade = ease(Math.min(1, Math.max(0, k - 0.3) * 2.4));
      if (t >= BEAT.over) done = true;
    }
    return done;
  }

  function skip() { done = true; fade = 1; }

  /**
   * Jump to a given second and stop there. Only the localhost debug hook
   * calls this: waiting twenty seconds to look at one frame is how two of
   * the bugs in the first cut of this survived as long as they did.
   */
  function seek(sec) {
    t = 0; done = false; held = false;
    while (t < sec && !done) update(1 / 60);
    held = true;
  }
  function blackness() { return fade; }

  function dispose() {
    scene.traverse((o) => {
      if (o.isMesh || o.isPoints) {
        if (o.geometry) o.geometry.dispose();
        const m = o.material;
        if (Array.isArray(m)) m.forEach((x) => x && x.dispose());
        else if (m) { if (m.map) m.map.dispose(); m.dispose(); }
      }
    });
  }

  return { scene, camera, update, skip, seek, blackness, dispose,
           get at() { return t; },
           get finished() { return done; } };
}
