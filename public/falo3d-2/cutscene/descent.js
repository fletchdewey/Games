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
import { buildCrawler } from '../aliens/crawler.js?v=42aab17414';
import { buildBrute } from '../aliens/brute.js?v=42aab17414';
import { buildWatcher } from '../aliens/watcher.js?v=42aab17414';
import { buildFloater } from '../aliens/floater.js?v=42aab17414';
import { buildSoldier, poseStand, poseAim, freeSoldier } from '../npc/soldier.js?v=42aab17414';

// ─── WHERE EVERYTHING IS ────────────────────────────────────
// The pod comes down the middle of a valley. Their city is ahead and to the
// left; the burning outpost is ahead and a long way further out, which is
// what the pod is aimed at. Both have to stay in frame at once, so these
// two numbers are the ones that decide the whole shot.
// Further out than the old one stood, and further than feels right on
// paper: at four times the size it needs fifteen hundred units of air in
// front of it before you can see its shape instead of its wall.
const CASTLE  = { x: -950, z: -2000 };
const OUTPOST = { x:  320, z: -2200 };

// The castle is four times the one first built here — written into
// buildCastle() at full size rather than scaled up, so its detail is
// detail. Everything else moved to make room for it: the city ring, the
// valley that holds the city, and the land that holds the valley.

// The valley: flat inside this ellipse, mountains outside it. Flat ground
// is where the town, the outpost and the pod's path all have to live, and
// the mountains have to start far enough out that they ring the shot
// instead of standing in it.
const BASIN = { x: -500, z: -1300, rx: 1850, rz: 2000 };

// The outpost sits out past the end of the valley, where the land starts
// climbing again, so whoever built it levelled a site first. Without this
// its huts stand on a mountainside and the pod lands on a slope.
const SITE = { r: 340, y: 6 };

// The ground itself. Five thousand across sounds absurd for six seconds of
// film, but the first cut was nine hundred, and at this altitude you could
// see the edge of the world behind the castle — which is the whole reason
// any of this was rebuilt.
const LAND = { size: 7000, seg: 240, cz: -900 };

// The pod's way in, as a line along the ground: the fly-over, then the run
// out to the outpost. Nothing gets built within PATH_PAD of it, because a
// city whose houses are sixty tall will otherwise put one exactly where the
// pod has to be.
const PATH = [[0, 650], [55, -250], [300, -1990]];
const PATH_PAD = 300;

function offPath(x, z, pad) {
  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, az] = PATH[i], [bx, bz] = PATH[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1,
      ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    if (Math.hypot(x - (ax + dx * t), z - (az + dz * t)) < pad) return false;
  }
  return true;
}

// Red water. Holes in the land, dug by heightAt, so the discs sit in real
// basins rather than floating on a bumpy floor.
const LAKES = [
  { x: -1700, z: -2250, r: 230 },
  { x:   640, z:  -520, r: 190 },
  { x:  -300, z:    80, r: 170 },
  { x:   980, z: -1500, r: 210 },
  { x: -1600, z:  -560, r: 190 },
  { x:  -420, z: -2320, r: 240 },
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

/** A camp sign: dark letters on a board, painted rather than modelled. */
function signTexture(lines) {
  return painted(512, lines.length > 1 ? 256 : 160, (g, w, h) => {
    g.fillStyle = '#cfc8b6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#23262c'; g.lineWidth = 12;
    g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#23262c';
    g.font = 'bold 78px Menlo, monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((t, i) => {
      g.fillText(t, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 88);
    });
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
      Math.sin(x * 0.0065) * Math.cos(z * 0.0051) * 218   // the ranges
    + Math.sin(x * 0.019 + 1.7) * Math.cos(z * 0.017) * 80
    + Math.sin(x * 0.051 + 0.6) * Math.cos(z * 0.047) * 25
    + Math.sin(x * 0.11) * Math.cos(z * 0.13) * 8;        // scree

  // Nearly nothing inside the valley, full height out where the mountains
  // are. The ramp ends sooner than it used to, because the valley is now
  // wide enough that a slow one would push the ranges off the edge of the
  // world before they ever got to full height.
  const e = Math.hypot((x - BASIN.x) / BASIN.rx, (z - BASIN.z) / BASIN.rz);
  let y = Math.max(-20, raw) * (0.07 + 0.93 * smoothstep(1.0, 1.7, e));

  for (const L of LAKES) {
    const d = Math.hypot(x - L.x, z - L.z);
    if (d < L.r * 1.3) {
      const k = smoothstep(L.r * 1.3, L.r * 0.55, d);
      y = y * (1 - k) + (-26) * k;
    }
  }
  const sd = Math.hypot(x - OUTPOST.x, z - OUTPOST.z);
  if (sd < SITE.r) {
    const k = smoothstep(SITE.r, SITE.r * 0.55, sd);
    y = y * (1 - k) + SITE.y * k;
  }
  const cd = Math.hypot(x - CASTLE.x, z - CASTLE.z);
  if (cd < 820) y += 58 * smoothstep(820, 200, cd);
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
    const t = Math.min(1, Math.max(0, (y + 26) / 330));
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
 * A horn: a tapering spike that curves as it goes, built as a chain of
 * cones each hung off the end of the last one and leaned a little further.
 * Four of them on a roof is the difference between a building and a shell
 * something grew.
 */
function horn(len, r, mat, bend = 0.3, segs = 3) {
  const root = new THREE.Group();
  let parent = root;
  const seg = len / segs;
  for (let i = 0; i < segs; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.x = bend;
    if (i > 0) pivot.position.y = seg;
    const rr = r * (1 - i * 0.26);
    const c = new THREE.Mesh(
      new THREE.CylinderGeometry(rr * 0.68, rr, seg, 6), mat);
    c.position.y = seg / 2;
    pivot.add(c);
    parent.add(pivot);
    parent = pivot;
  }
  return root;
}

/**
 * The castle.
 *
 * Four times what it was, and built at that size rather than scaled up to
 * it, so the detail is detail and not four-times-bigger detail: battlements
 * along every wall, eight towers instead of four, a gatehouse facing the
 * way you come in, lit windows in rows up the keep, braziers burning along
 * the parapet, and horns — on the keep, on every tower, over the gate —
 * because whatever lives here did not quarry this, it grew it.
 *
 * Roughly seven hundred and fifty across and six hundred and fifty tall. It
 * is meant to be the largest thing on the planet that is not a mountain.
 */
function buildCastle() {
  const g = new THREE.Group();
  const stone = new THREE.MeshLambertMaterial({ color: 0x2a1c3e });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1028 });
  const bone = new THREE.MeshLambertMaterial({ color: 0x4a3a62 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xff2a5a });
  const lit = new THREE.MeshBasicMaterial({ color: 0xffb03a });
  const eye = new THREE.MeshBasicMaterial({ color: 0xff6ab0 });

  /** Teeth along the top of a wall, which is most of what says "castle". */
  const battlement = (cx, cy, cz, len, along, step = 34) => {
    const n = Math.max(2, Math.round(len / step));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5;
      const m = new THREE.Mesh(new THREE.BoxGeometry(16, 22, 16), stone);
      m.position.set(cx + (along ? t * len : 0), cy + 11,
                     cz + (along ? 0 : t * len));
      g.add(m);
    }
  };

  // ── The keep ──
  const keep = new THREE.Mesh(new THREE.BoxGeometry(280, 380, 280), stone);
  keep.position.y = 190; g.add(keep);
  // Buttresses, so it is not one smooth slab from any angle.
  for (const [dx, dz, w, d] of [[-140, 0, 26, 300], [140, 0, 26, 300],
                                [0, -140, 300, 26], [0, 140, 300, 26]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 330, d), dark);
    b.position.set(dx, 165, dz); g.add(b);
  }
  // Windows: rows of them up two faces, which is what gives it a storey
  // count and therefore a size.
  for (let row = 0; row < 7; row++) {
    for (let col = -2; col <= 2; col++) {
      const y = 70 + row * 44;
      const w1 = new THREE.Mesh(new THREE.BoxGeometry(14, 26, 6), lit);
      w1.position.set(col * 52, y, 142); g.add(w1);
      const w2 = new THREE.Mesh(new THREE.BoxGeometry(6, 26, 14), lit);
      w2.position.set(142, y, col * 52); g.add(w2);
    }
  }
  battlement(0, 380, 140, 280, true);
  battlement(0, 380, -140, 280, true);
  battlement(-140, 380, 0, 280, false);
  battlement(140, 380, 0, 280, false);

  // The crown, and the needle through it.
  const crown = new THREE.Mesh(new THREE.ConeGeometry(232, 240, 6), dark);
  crown.position.y = 500; crown.rotation.y = Math.PI / 6; g.add(crown);
  const needle = new THREE.Mesh(new THREE.CylinderGeometry(6, 26, 200, 6), bone);
  needle.position.y = 620; g.add(needle);
  const top = new THREE.Mesh(new THREE.SphereGeometry(22, 10, 8), eye);
  top.position.y = 730; g.add(top);
  // Horns off the crown.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const h = horn(190, 17, bone, 0.26);
    h.position.set(Math.cos(a) * 150, 470, Math.sin(a) * 150);
    h.rotation.y = -a + Math.PI / 2;
    h.rotation.z = Math.cos(a) * 0.5;
    h.rotation.x = Math.sin(a) * 0.5;
    g.add(h);
  }

  // ── Eight towers: four on the corners, four on the walls ──
  const towers = [[-208, -208, 1], [208, -208, 1], [-208, 208, 1], [208, 208, 1],
                  [0, -300, 0.78], [0, 300, 0.78], [-300, 0, 0.78], [300, 0, 0.78]];
  for (const [dx, dz, k] of towers) {
    const h = 540 * k;
    const t = new THREE.Mesh(
      new THREE.CylinderGeometry(60 * k, 76 * k, h, 8), stone);
    t.position.set(dx, h / 2, dz); g.add(t);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(84 * k, 150 * k, 8), dark);
    cap.position.set(dx, h + 75 * k, dz); g.add(cap);
    const e = new THREE.Mesh(new THREE.SphereGeometry(20 * k, 10, 8), glow);
    e.position.set(dx, h + 10, dz); g.add(e);
    // A ring of lit slits near the top, and a horn off the cap.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const w = new THREE.Mesh(new THREE.BoxGeometry(10, 30, 10), lit);
      w.position.set(dx + Math.cos(a) * 62 * k, h - 110 * k,
                     dz + Math.sin(a) * 62 * k);
      g.add(w);
    }
    const hr = horn(150 * k, 13 * k, bone, 0.3);
    hr.position.set(dx, h + 130 * k, dz);
    hr.rotation.y = dx * 0.01;
    g.add(hr);
  }

  // ── Curtain wall, with teeth ──
  for (const [dx, dz, w, d, len, along] of [
    [0, -380, 760, 48, 760, true], [0, 380, 760, 48, 760, true],
    [-380, 0, 48, 760, 760, false], [380, 0, 48, 760, 760, false]]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 160, d), stone);
    wall.position.set(dx, 80, dz); g.add(wall);
    battlement(dx, 160, dz, len, along, 54);
  }

  // ── The gate, on the side you come in from ──
  for (const dx of [-86, 86]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(46, 56, 300, 8), stone);
    t.position.set(dx, 150, 380); g.add(t);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(62, 90, 8), dark);
    cap.position.set(dx, 345, 380); g.add(cap);
    const h = horn(120, 11, bone, 0.34);
    h.position.set(dx, 380, 380); g.add(h);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(220, 60, 70), dark);
  lintel.position.set(0, 230, 380); g.add(lintel);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(104, 150, 72),
    new THREE.MeshBasicMaterial({ color: 0x8c1030 }));
  mouth.position.set(0, 75, 380); g.add(mouth);
  const road = new THREE.Mesh(new THREE.BoxGeometry(150, 4, 420), dark);
  road.position.set(0, 2, 600); g.add(road);

  // ── Braziers along the parapet, and the fire in the yard ──
  for (const [bx, bz] of [[-380, -380], [380, -380], [-380, 380], [380, 380],
                          [0, -380], [0, 380], [-380, 0], [380, 0]]) {
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(22, 8, 6), lit);
    bowl.position.set(bx, 190, bz); g.add(bowl);
  }
  const fire = new THREE.PointLight(0xff3a60, 4, 1100);
  fire.position.set(0, 240, 0); g.add(fire);
  const up = new THREE.PointLight(0xff6ab0, 2.2, 900);
  up.position.set(0, 760, 0); g.add(up);
  return g;
}

/**
 * Their town.
 *
 * Three kinds of house, none of which has a straight edge anywhere in it:
 * a pod squatting under a curled spine, a stack of fused bulbs leaning off
 * true, and a nest held up off the ground on four splayed legs. All of them
 * lit from inside through a membrane, none of them square to the next one.
 *
 * Rings around the castle, pushed out past its wall, and nothing within
 * three hundred of the line the pod comes down.
 */
function buildTown() {
  const g = new THREE.Group();
  const chitin = new THREE.MeshLambertMaterial({ color: 0x3a2150 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x241334 });
  const shellM = new THREE.MeshLambertMaterial({ color: 0x4e2b70 });
  const bone = new THREE.MeshLambertMaterial({ color: 0x4a3a62 });
  const lamp = new THREE.MeshBasicMaterial({ color: 0x8cf0b4 });
  const lampB = new THREE.MeshBasicMaterial({ color: 0xff7ac0 });

  const clear = (x, z) => {
    if (Math.hypot(x - CASTLE.x, z - CASTLE.z) < 520) return false;  // the wall
    if (Math.hypot(x - OUTPOST.x, z - OUTPOST.z) < 700) return false;
    for (const L of LAKES) if (Math.hypot(x - L.x, z - L.z) < L.r + 90) return false;
    return offPath(x, z, PATH_PAD);
  };

  // A pod squatting on the ground under a curled spine.
  const podHut = (b, r) => {
    const body = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), chitin);
    body.scale.set(1, 0.82, 1); body.position.y = r * 0.68; b.add(body);
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.9, r * 1.15, r * 0.5, 7), dark);
    skirt.position.y = r * 0.25; b.add(skirt);
    const spine = horn(r * 2.4, r * 0.2, bone, 0.34);
    spine.position.y = r * 1.3; spine.rotation.y = Math.random() * 3; b.add(spine);
    const slit = new THREE.Mesh(
      new THREE.BoxGeometry(r * 0.9, r * 0.26, r * 0.3), lamp);
    slit.position.set(0, r * 0.75, r * 0.82); b.add(slit);
  };

  // Fused bulbs, each smaller than the one under it, leaning off true.
  const hiveStack = (b, r) => {
    let y = 0, lean = 0;
    for (let i = 0; i < 3; i++) {
      const rr = r * (1 - i * 0.2);
      lean += (Math.random() - 0.5) * r * 0.4;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(rr, 9, 7), shellM);
      bulb.scale.set(1, 1.15, 1);
      bulb.position.set(lean, y + rr, 0);
      b.add(bulb);
      y += rr * 1.5;
    }
    const spine = horn(r * 2.2, r * 0.17, bone, 0.26);
    spine.position.set(lean, y, 0); b.add(spine);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const e = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 6, 5), lampB);
      e.position.set(lean + Math.cos(a) * r * 0.75, y * 0.55,
                     Math.sin(a) * r * 0.75);
      b.add(e);
    }
  };

  // A nest held up off the ground, which nothing human would build.
  const stiltNest = (b, r) => {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.6;
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.09, r * 0.16, r * 1.5, 5), dark);
      leg.position.set(Math.cos(a) * r * 0.42, r * 0.72, Math.sin(a) * r * 0.42);
      leg.rotation.z = -Math.cos(a) * 0.3;
      leg.rotation.x = Math.sin(a) * 0.3;
      b.add(leg);
    }
    const body = new THREE.Mesh(new THREE.SphereGeometry(r * 0.95, 9, 7), chitin);
    body.scale.set(1, 1.2, 1); body.position.y = r * 2.1; b.add(body);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.8, r * 1.5, 7), dark);
    cap.position.y = r * 3.2; b.add(cap);
    const under = new THREE.Mesh(new THREE.SphereGeometry(r * 0.3, 7, 6), lamp);
    under.position.y = r * 1.35; b.add(under);
  };

  const house = (x, z) => {
    const b = new THREE.Group();
    const roll = Math.random();
    const r = 22 + Math.random() * 16;
    if (roll < 0.52) podHut(b, r);
    else if (roll < 0.76) hiveStack(b, r);
    else stiltNest(b, r);
    b.rotation.y = Math.random() * Math.PI * 2;
    b.rotation.z = (Math.random() - 0.5) * 0.1;
    b.position.set(x, heightAt(x, z) - 2, z);
    g.add(b);
  };

  for (const [ring, n] of [[620, 16], [830, 22], [1040, 26], [1250, 24]]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.34;
      const rr = ring + (Math.random() - 0.5) * 150;
      const x = CASTLE.x + Math.cos(a) * rr;
      const z = CASTLE.z + Math.sin(a) * rr;
      if (clear(x, z)) house(x, z);
    }
  }

  // Hive towers: far too tall for the houses under them, which is the point.
  for (let i = 0; i < 9; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = 620 + Math.random() * 600;
    const x = CASTLE.x + Math.cos(a) * rr;
    const z = CASTLE.z + Math.sin(a) * rr;
    if (!clear(x, z)) continue;
    const base = heightAt(x, z);
    const h = 120 + Math.random() * 90;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(7, 26, h, 7), shellM);
    s.position.set(x, base + h / 2, z);
    s.rotation.z = (Math.random() - 0.5) * 0.16;
    g.add(s);
    for (let j = 0; j < 3; j++) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(14 - j * 3, 8, 6), chitin);
      bulb.position.set(x, base + h * (0.42 + j * 0.2), z);
      g.add(bulb);
    }
    const tip = new THREE.Mesh(new THREE.SphereGeometry(10, 9, 7), lampB);
    tip.position.set(x, base + h + 6, z);
    g.add(tip);
  }
  return g;
}

/**
 * The outpost: ours, burning at one end, and the only place on this planet
 * that is not crawling.
 *
 * Big ridge tents rather than huts — a prism with a flat floor and a roof
 * ridge, which is three lines and reads as canvas from any distance. Each
 * one is signposted on two posts at its door, the signs being text painted
 * onto a canvas exactly the way the planet's oceans were.
 *
 * The people are the game's own soldier, posed and left standing: a
 * commander bent over the planning table in the marked circle with two of
 * them either side, and eight more spaced round the wire looking out. They
 * are built at four times the model's size, because this camp is built at
 * about that much over life size so that it reads from the air.
 *
 * The group carries its own tick(): the smoke climbing, the fire moving,
 * the beacon blinking, and every one of them breathing.
 */
function buildOutpost() {
  const g = new THREE.Group();
  const canvasM = new THREE.MeshLambertMaterial({ color: 0x8d8f7e });
  const canvasB = new THREE.MeshLambertMaterial({ color: 0x6d7360 });
  const olive = new THREE.MeshLambertMaterial({ color: 0x4b5340 });
  const metal = new THREE.MeshLambertMaterial({ color: 0x5a6068 });
  const deck = new THREE.MeshBasicMaterial({ color: 0x1e2228 });
  const paint = new THREE.MeshBasicMaterial({ color: 0xe8c23a });
  const burnt = new THREE.MeshLambertMaterial({ color: 0x2b2a2c });
  const sandbag = new THREE.MeshLambertMaterial({ color: 0x6b6250 });
  const door = new THREE.MeshLambertMaterial({ color: 0x2b2f35 });
  const lit = new THREE.MeshBasicMaterial({ color: 0xffe3a8 });
  const red = new THREE.MeshBasicMaterial({ color: 0xc02030 });

  const people = [];
  const PERSON = 5.2;          // soldier scale inside this group

  /** One of ours, stood where you put him and facing where you say. */
  function soldier(x, z, face, kind, y = 0) {
    let m;
    try { m = buildSoldier(); } catch (e) { return null; }
    freeSoldier(m);            // he is not anybody's prisoner
    m.scale.setScalar(PERSON);
    m.position.set(x, y, z);
    m.rotation.y = face;
    g.add(m);
    people.push({ m, kind, phase: Math.random() * 6 });
    return m;
  }

  // ── Tents ──
  // A three-sided prism lying on its side: flat floor, ridge along the top.
  const tent = (x, z, len, r, lines) => {
    const t = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, len, 3, 1), canvasM);
    t.rotation.x = -Math.PI / 2;        // ridge runs along z
    t.position.set(x, r * 0.5, z);      // flat face down on the ground
    g.add(t);
    // Ridge pole ends and the guy ropes off them.
    for (const e of [-1, 1]) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, r * 1.6, 5), canvasB);
      pole.position.set(x, r * 0.8, z + e * len / 2);
      g.add(pole);
      for (const sx of [-1, 1]) {
        const rope = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.22, r * 1.9, 4), canvasB);
        rope.position.set(x + sx * r * 0.8, r * 0.62, z + e * (len / 2 + r * 0.5));
        rope.rotation.z = sx * 0.72;
        rope.rotation.x = -e * 0.5;
        g.add(rope);
      }
    }
    // The door, on the end you come at it from.
    const flap = new THREE.Mesh(new THREE.BoxGeometry(r * 0.7, r * 0.95, 1), door);
    flap.position.set(x, r * 0.48, z + len / 2 + 0.6);
    g.add(flap);
    // And the sign, on two posts in front of it.
    const sw = r * 1.45, sh = lines.length > 1 ? sw * 0.42 : sw * 0.3;
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(1.1, r * 1.05, 1.1), metal);
      post.position.set(x + sx * sw * 0.45, r * 0.52, z + len / 2 + 7);
      g.add(post);
    }
    const board = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh),
      new THREE.MeshBasicMaterial({ map: signTexture(lines),
                                    side: THREE.DoubleSide }));
    board.position.set(x, r * 0.86, z + len / 2 + 7.6);
    g.add(board);
    return t;
  };

  tent(-66, 8, 48, 18, ['MEDICAL']);
  tent(-26, -52, 52, 17, ['MESS HALL']);
  tent(40, -48, 46, 16, ['ARMORY']);
  tent(74, 6, 44, 17, ["CAPTAIN'S", 'QUARTERS']);

  // A red cross on the medical tent, so it is the right tent even unread.
  for (const [w, h] of [[22, 7], [7, 22]]) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(w, h), red);
    bar.position.set(-66, 20, 8 + 48 / 2 + 0.9);
    g.add(bar);
  }

  // ── The command circle, and the three of them in it ──
  const pad = new THREE.Mesh(new THREE.CircleGeometry(20, 28), deck);
  pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.5, 26); g.add(pad);
  const ring = new THREE.Mesh(new THREE.RingGeometry(17, 20, 28), paint);
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.8, 26); g.add(ring);

  // The planning table: a lit map on trestles, with pieces on it.
  const top = new THREE.Mesh(new THREE.BoxGeometry(13, 0.9, 8), olive);
  top.position.set(0, 4.2, 26); g.add(top);
  const map = new THREE.Mesh(new THREE.PlaneGeometry(11.6, 6.8),
    new THREE.MeshBasicMaterial({ color: 0x6fd8c8 }));
  map.rotation.x = -Math.PI / 2; map.position.set(0, 4.7, 26); g.add(map);
  for (const [lx, lz] of [[-5.6, -3.2], [5.6, -3.2], [-5.6, 3.2], [5.6, 3.2]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4.2, 0.8), metal);
    leg.position.set(lx, 2.1, 26 + lz); g.add(leg);
  }
  for (let i = 0; i < 7; i++) {               // pieces pushed about on it
    const pc = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.9),
      i % 3 === 0 ? red : deck);
    pc.position.set(-4.6 + Math.random() * 9.2, 5.3,
                    23.4 + Math.random() * 5.2);
    g.add(pc);
  }
  const lamp = new THREE.PointLight(0x9fe8ff, 1.6, 90);
  lamp.position.set(0, 12, 26); g.add(lamp);

  const commander = soldier(0, 19, 0, 'commander');
  if (commander) {
    // Older coat, no helmet paint, and no rifle in his hands.
    commander.userData.fat.color.set(0x3c4433);
    commander.userData.rifle.visible = false;
  }
  soldier(-11, 19.5, 0.12, 'guard');
  soldier(11, 19.5, -0.12, 'guard');

  // Sandbags round the circle, because a table in the open is just a table.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    if (Math.abs(a - Math.PI / 2) < 0.5) continue;        // leave a way in
    const bag = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.6, 3.4), sandbag);
    bag.position.set(Math.cos(a) * 23, 1.3, 26 + Math.sin(a) * 23);
    bag.rotation.y = -a;
    g.add(bag);
  }

  // ── Stores: crates, barrels, a water tank, a parked rover ──
  for (let i = 0; i < 11; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(7, 6, 7), olive);
    c.position.set(58 + (i % 4) * 8.4, 3 + Math.floor(i / 4) * 6.2, -18 + (i % 3) * 8);
    c.rotation.y = Math.random() * 0.3;
    g.add(c);
  }
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 7, 8), metal);
    b.position.set(-44 + i * 7.4, 3.5, -22); g.add(b);
  }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 16, 10), metal);
  tank.rotation.z = Math.PI / 2; tank.position.set(-78, 18, -34); g.add(tank);
  for (const lx of [-86, -70]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(2, 20, 2), metal);
    leg.position.set(lx, 10, -34); g.add(leg);
  }
  // The rover.
  const rover = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 26), olive);
  hull.position.y = 7; rover.add(hull);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 10), canvasB);
  cab.position.set(0, 13, -4); rover.add(cab);
  for (const wx of [-7.4, 7.4]) for (const wz of [-8, 0, 8]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 3, 8), burnt);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 4, wz); rover.add(w);
  }
  rover.position.set(-34, 0, 40); rover.rotation.y = 0.5; g.add(rover);

  // ── Floodlights ──
  for (const [fx2, fz2] of [[-52, 24], [52, 30]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.4, 34, 6), metal);
    pole.position.set(fx2, 17, fz2); g.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 3), lit);
    head.position.set(fx2, 35, fz2); g.add(head);
    const pl = new THREE.PointLight(0xfff0d0, 1.1, 110);
    pl.position.set(fx2, 34, fz2); g.add(pl);
  }

  // ── Comms mast ──
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 70, 6), metal);
  mast.position.set(-78, 35, 26); g.add(mast);
  for (const y of [40, 54, 64]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(22, 1.6, 1.6), metal);
    arm.position.set(-78, y, 26); arm.rotation.y = y * 0.4; g.add(arm);
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff3020 }));
  beacon.position.set(-78, 72, 26); g.add(beacon);

  // ── The wire, and the men on it ──
  const GATE = Math.PI / 2;                   // the way in faces the pod
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    if (Math.abs(a - GATE) < 0.2) continue;
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.6, 9, 1.6), metal);
    post.position.set(Math.cos(a) * 104, 4.5, Math.sin(a) * 104);
    g.add(post);
  }
  for (const y of [4, 7.6]) {
    const holder = new THREE.Group();
    holder.rotation.y = -Math.PI / 2;         // puts the gap at the gate
    const rail = new THREE.Mesh(
      new THREE.TorusGeometry(104, 0.35, 4, 56, Math.PI * 2 - 0.42), metal);
    rail.rotation.x = -Math.PI / 2; rail.position.y = y;
    holder.add(rail); g.add(holder);
  }
  // Twelve of them stood on the wire, facing out.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.3;
    soldier(Math.cos(a) * 96, Math.sin(a) * 96, Math.atan2(Math.cos(a), Math.sin(a)),
            'watch');
  }
  // And one in each tower.
  for (const [x, z] of [[-96, -74], [96, 74]]) {
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(3, 5, 26, 6), metal);
    legs.position.set(x, 13, z); g.add(legs);
    const deckTop = new THREE.Mesh(new THREE.BoxGeometry(16, 1.5, 16), olive);
    deckTop.position.set(x, 26, z); g.add(deckTop);
    for (const [ox, oz] of [[-7.5, 0], [7.5, 0], [0, -7.5], [0, 7.5]]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(ox ? 1.4 : 16, 5, oz ? 1.4 : 16), metal);
      rail.position.set(x + ox, 29, z + oz); g.add(rail);
    }
    soldier(x, z, Math.atan2(x, z), 'watch', 26.8);
  }

  // ── The tent that lost, and what is still burning in it ──
  const fx = 12, fz = -82;
  const ruin = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 40, 3, 1), burnt);
  ruin.rotation.x = -Math.PI / 2; ruin.rotation.z = 0.5;
  ruin.position.set(fx - 4, 5, fz - 6); g.add(ruin);
  for (const [dx, dz] of [[-15, 10], [16, 6]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 26, 5), burnt);
    pole.position.set(fx + dx, 10, fz + dz);
    pole.rotation.z = dx * 0.03; g.add(pole);
  }
  const flames = [];
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xffa32a,
                                                transparent: true, opacity: 0.95 });
  for (const [dx, dz, sc] of [[0, 0, 1.3], [-8, 6, 0.9], [9, -4, 1], [2, 9, 0.8]]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(7 * sc, 26 * sc, 7), fireMat);
    f.position.set(fx + dx, 11 * sc, fz + dz);
    g.add(f); flames.push(f);
  }
  const fireLight = new THREE.PointLight(0xff7a20, 3, 170);
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
    fireLight.intensity = 2.2 + Math.random() * 1.7;
    beacon.visible = (st % 1.7) < 0.85;     // something still running
    // Nobody down there is a statue.
    for (const p of people) {
      const t2 = st * 0.9 + p.phase;
      poseStand(p.m, t2, 0);
      if (p.kind === 'watch') {
        poseAim(p.m, -0.22 + Math.sin(t2 * 0.5) * 0.05);
        p.m.rotation.y += Math.sin(t2 * 0.33) * 0.0015;
      } else if (p.kind === 'guard') {
        poseAim(p.m, -0.75);                // rifle held across, muzzle down
      } else {
        // The commander, leaning on the table and reading it.
        const d = p.m.userData;
        d.hips.rotation.x = 0.2;
        d.headPivot.rotation.x = 0.5 + Math.sin(t2 * 0.7) * 0.06;
        d.arms.forEach((arm) => {
          arm.shoulder.rotation.x = -0.62;
          arm.shoulder.rotation.z = arm.side * 0.3;
          arm.elbow.rotation.x = -0.5;
        });
      }
    }
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
    if (Math.hypot(x - OUTPOST.x, z - OUTPOST.z) < 700) return;
    const make = kinds[Math.floor(Math.random() * kinds.length)];
    let m;
    try { m = make(); } catch (e) { return; }
    m.scale.setScalar(s);
    m.position.set(x, heightAt(x, z) - 1 + s * 0.45, z);
    m.rotation.y = Math.random() * Math.PI * 2;
    g.add(m);
  };
  for (let i = 0; i < 46; i++) {                 // in the streets
    const a = Math.random() * Math.PI * 2;
    const r = 520 + Math.random() * 850;         // outside the curtain wall
    place(CASTLE.x + Math.cos(a) * r, CASTLE.z + Math.sin(a) * r,
          10 + Math.random() * 9);
  }
  // All the way down the valley, not just the near half — the last two
  // seconds are spent over ground that the first version left empty.
  for (let i = 0; i < 38; i++) {                 // under the flight path
    place(-340 + Math.random() * 820, 150 - Math.random() * 1500,
          9 + Math.random() * 10);
  }
  // Nothing of theirs at the outpost. It is ours, and it is the one place
  // on this planet that is not crawling.
  return g;
}

// ─── THE CUTSCENE ───────────────────────────────────────────
// Five beats. The numbers are seconds from the moment the pod gets clear.
const BEAT = {
  approach: 0,      // a blue planet, a long way off
  clouds:   5.5,    // into the weather
  reveal:   9.5,    // the cloud opens and it is not home
  surface:  14.5,   // low enough to see what lives here
  land:     20.0,   // the pod leaves you and goes down to the outpost
  down:     27.0,   // on the deck, engine out
  over:     29.8,
};

// What it says along the top on the way down. The clock is the cutscene's
// own, not a timer of its own, so it types in step with the beats and a
// skip takes it with everything else.
//
// The second line lands just after the cloud opens, which is the moment
// the planet stops being the one you were hoping for.
const LINES = [
  { at: 1.2, text: "YOU'VE ESCAPED THE SPACESHIP AND ARE NOW APPROACHING EARTH." },
  { at: 10.0, text: "BUT SOMETHING DOESN'T FEEL RIGHT." },
];
const TYPE_RATE = 26;        // characters a second

// How much bigger the pod gets at the moment it stops being the thing you
// are sitting in and becomes the thing you are watching. See startLanding().
const SWAP = 6.111;

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
  castle.position.set(CASTLE.x, heightAt(CASTLE.x, CASTLE.z) - 10, CASTLE.z);
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
  // A weak fill from the other side. The camera finishes on the far side of
  // the pod from the sun, and without this the last shot of the game is a
  // silhouette of the thing you escaped in.
  const fill = new THREE.DirectionalLight(0xc9a8ff, 0.55);
  fill.position.set(0.9, 0.5, 0.6);
  ground.add(fill);
  // Thick purple air, so the far mountains sit back rather than cutting out,
  // and the same colour as the sky, so the far edge of the land dissolves
  // instead of ending in a line.
  const haze = new THREE.FogExp2(SKY, 0.0003);

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
  let flamePower = 1;

  // ── The landing ──
  // Open ground just outside the wire on the near side, so the pod comes
  // down between you and the outpost rather than in the middle of it.
  const L = new THREE.Vector3(OUTPOST.x - 10, 0, OUTPOST.z + 200);
  L.y = heightAt(L.x, L.z) + 3.9;       // far enough up that the fins clear
  let landing = false;
  let landYaw = 0;
  const P0 = new THREE.Vector3();       // where the pod is when it is let go
  const q0 = new THREE.Quaternion();    // and how it was lying at the time
  const qTarget = new THREE.Quaternion();
  const off0 = new THREE.Vector3();     // camera offset from the pod, start
  // Round to the side and low, so the last frame is the pod broadside with
  // its nose toward the outpost, rather than its engine filling the shot.
  const off1 = new THREE.Vector3(52, 20, 46);                 // and parked
  const lookOff0 = new THREE.Vector3();
  const lookOff1 = new THREE.Vector3(4, 9, -70);
  const camOff = new THREE.Vector3();
  const lookOff = new THREE.Vector3();
  const podPos = new THREE.Vector3();

  // Dust, kicked up in the last fraction of a second and hanging after.
  const dustPuffs = [];
  for (let i = 0; i < 7; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x8a5ec0, transparent: true,
                                    opacity: 0.5, depthWrite: false }));
    d.visible = false;
    ground.add(d); dustPuffs.push(d);
  }

  /**
   * Hand the pod over to the world.
   *
   * It has spent the whole cutscene parented to the camera at arm's length,
   * which is the only reason it stays in the corner of the frame. To land
   * it, it has to be a thing in the scene instead — and it has to become one
   * without the frame changing. So it is moved six times further away and
   * made six times bigger along the same line of sight: same pixels, same
   * shot, and from the next frame on it is somewhere you can fly it to.
   */
  function startLanding() {
    landing = true;
    const wp = new THREE.Vector3();
    pod.getWorldPosition(wp);
    pod.getWorldQuaternion(q0);
    camera.remove(pod);
    scene.add(pod);
    P0.copy(camera.position).add(wp.sub(camera.position).multiplyScalar(SWAP));
    pod.scale.setScalar(0.72 * SWAP);
    pod.position.copy(P0);
    pod.quaternion.copy(q0);
    off0.subVectors(camera.position, P0);
    // Where the camera is pointed at this instant, written as an offset from
    // the pod, so the pan onto it starts from exactly the shot already up.
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    lookOff0.copy(camera.position).add(fwd.multiplyScalar(off0.length())).sub(P0);
    landYaw = Math.atan2(-(L.x - P0.x), -(L.z - P0.z));
  }

  function dust() {
    const d = (t - (BEAT.down - 0.85)) / 2.4;
    for (let i = 0; i < dustPuffs.length; i++) {
      const p = dustPuffs[i];
      p.visible = d > 0;
      if (!p.visible) continue;
      const a = (i / dustPuffs.length) * Math.PI * 2 + 0.4;
      const k = Math.min(1, d);
      p.position.set(L.x + Math.cos(a) * (4 + k * 19), L.y - 3.6 + k * 2.4,
                     L.z + Math.sin(a) * (4 + k * 19));
      p.scale.setScalar(2.5 + k * 6);
      p.material.opacity = 0.34 * (1 - Math.min(1, d) * 0.85);
    }
  }

  function enterGround() {
    ground.visible = true;
    planet.visible = false;
    stars.visible = false;
    scene.background = new THREE.Color(SKY);        // a bruised sky
    scene.fog = haze;
  }

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

    // The pod rides in front of you the whole way, rolling slightly — until
    // it is let go, after which it is flown rather than carried.
    if (!landing) {
      pod.rotation.z = Math.sin(t * 0.7) * 0.11;
      pod.rotation.x = -0.06 + Math.sin(t * 0.5) * 0.04;
    }
    if (flame) {
      const f = (0.8 + Math.random() * 0.5) * flamePower;
      flame.visible = flamePower > 0.03;
      flame.scale.set(f, (1 + Math.random() * 0.7) * flamePower, f);
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

    } else if (t < BEAT.land) {
      // On the deck. Everything above is gone; this is the real ground.
      if (!ground.visible) enterGround();
      const k = at(BEAT.surface, BEAT.land, t);
      // Down the valley, aimed at the smoke.
      //
      // The drift and the turn are not decoration. Their city sits off to
      // the left of the line and the outpost is a long way beyond it, and
      // the shot has to hold both at once — too much turn and the castle
      // leaves the frame, too little and the pod is not going anywhere in
      // particular.
      camera.position.set(ease(k) * 55, 420 - ease(k) * 290, 650 - k * 900);
      camera.rotation.set(-0.34 + ease(k) * 0.14, -ease(k) * 0.04,
                          Math.sin(t * 0.6) * 0.04);
      pod.position.set(-3.6, -2.0 - k * 0.5, -10.4 + k * 1.4);
      // Back in out of the black the reveal ended on.
      fade = 1 - Math.min(1, (t - BEAT.surface) / 0.7);

    } else if (t < BEAT.down) {
      // The run in. You stop being inside the pod and start watching it.
      if (!ground.visible) enterGround();
      if (!landing) startLanding();
      const k = at(BEAT.land, BEAT.down, t);
      const e = ease(k);
      // Across first, down second: the height lags the distance, so it
      // arrives over the site before it arrives on it.
      podPos.lerpVectors(P0, L, e);
      podPos.y = P0.y + (L.y - P0.y) * Math.pow(e, 1.45);
      pod.position.copy(podPos);
      // Swing onto the heading early, then bring the nose up to flare.
      const flare = k > 0.62
        ? Math.sin(Math.min(1, (k - 0.62) / 0.38) * Math.PI) * 0.2 : 0;
      qTarget.setFromEuler(new THREE.Euler(flare, landYaw, 0));
      pod.quaternion.copy(q0).slerp(qTarget, ease(Math.min(1, k / 0.3)));
      flamePower = 1 - smoothstep(0.74, 0.99, k);
      // The camera trails it the whole way down and ends up standing off to
      // one side of it, with the outpost behind.
      camOff.lerpVectors(off0, off1, e);
      camera.position.copy(podPos).add(camOff);
      lookOff.lerpVectors(lookOff0, lookOff1, ease(Math.min(1, k * 2)));
      camera.lookAt(podPos.x + lookOff.x, podPos.y + lookOff.y,
                    podPos.z + lookOff.z);
      dust();
      fade = 0;

    } else {
      // Down. Engine out, dust settling, and then the black.
      const k = at(BEAT.down, BEAT.over, t);
      pod.position.copy(L);
      qTarget.setFromEuler(new THREE.Euler(0, landYaw, 0));
      pod.quaternion.copy(qTarget);
      flamePower = 0;
      camera.position.copy(L).add(off1);
      camera.lookAt(L.x + lookOff1.x, L.y + lookOff1.y, L.z + lookOff1.z);
      dust();
      fade = ease(Math.min(1, Math.max(0, k - 0.35) * 2));
      if (t >= BEAT.over) done = true;
    }
    return done;
  }

  /**
   * The caption as it stands this frame: each line typed as far as the
   * clock has got, a cursor on whichever one is being written, and an
   * opacity that lifts it in at the start and takes it away before the
   * ground arrives.
   */
  function caption() {
    const shown = LINES.map((L) => {
      if (t < L.at) return null;
      return L.text.slice(0, Math.floor((t - L.at) * TYPE_RATE));
    });
    const blink = Math.floor(t * 2.4) % 2 === 0;
    const out = ['', ''];
    for (let i = 0; i < 2; i++) {
      if (shown[i] === null) continue;
      const full = shown[i].length >= LINES[i].text.length;
      // The cursor is on the line still being written; once a line is
      // finished it only keeps the cursor while nothing has taken over.
      const mine = i === 1 || shown[1] === null;
      out[i] = shown[i] + (mine && (!full || blink) ? '_' : '');
    }
    const outAt = BEAT.surface - 0.9;
    const alpha = t < outAt
      ? Math.min(1, (t - LINES[0].at + 0.2) / 0.45)
      : 1 - (t - outAt) / 0.9;
    // How many characters have landed in all, so whoever is listening can
    // put a key under each new one without knowing anything about timing.
    let typed = 0;
    for (let i = 0; i < 2; i++) {
      if (shown[i]) typed += Math.min(shown[i].length, LINES[i].text.length);
    }
    return { one: out[0], two: out[1], typed,
             alpha: Math.min(1, Math.max(0, alpha)) };
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

  return { scene, camera, update, skip, seek, blackness, caption, dispose,
           get at() { return t; },
           get finished() { return done; } };
}
