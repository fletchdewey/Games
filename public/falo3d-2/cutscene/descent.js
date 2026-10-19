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
// Press any key to skip it.

import * as THREE from 'three';
import { buildCrawler } from '../aliens/crawler.js?v=b0980c7470';
import { buildBrute } from '../aliens/brute.js?v=b0980c7470';
import { buildWatcher } from '../aliens/watcher.js?v=b0980c7470';
import { buildFloater } from '../aliens/floater.js?v=b0980c7470';

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
 * Mountains, and far too many of them.
 *
 * Height comes from sines laid across each other at different sizes — big
 * slow ones for the ranges, small fast ones for the roughness. That is the
 * whole of it, and it is why the peaks are tall enough to look wrong: the
 * biggest wave is simply given a very large number.
 */
function buildTerrain() {
  const size = 900, seg = 150;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const low = new THREE.Color(0x3a1456);     // valley floor
  const mid = new THREE.Color(0x6b2ea8);     // the purple you see from orbit
  const high = new THREE.Color(0xd8c4f0);    // something like snow, but not

  let peak = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h =
        Math.sin(x * 0.0065) * Math.cos(z * 0.0051) * 115   // the ranges
      + Math.sin(x * 0.019 + 1.7) * Math.cos(z * 0.017) * 42
      + Math.sin(x * 0.051 + 0.6) * Math.cos(z * 0.047) * 13
      + Math.sin(x * 0.11) * Math.cos(z * 0.13) * 4;        // scree
    const y = Math.max(-18, h);
    pos.setY(i, y);
    if (y > peak) peak = y;

    const t = Math.min(1, Math.max(0, (y + 18) / 170));
    const c = t < 0.62
      ? low.clone().lerp(mid, t / 0.62)
      : mid.clone().lerp(high, (t - 0.62) / 0.38);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.userData.peak = peak;
  return mesh;
}

/** Red water, sitting in the low ground. */
function buildLakes() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xb01424 });
  const rim = new THREE.MeshBasicMaterial({ color: 0xe8304a });
  const spots = [
    [-210, 120, 70], [140, -60, 95], [-40, -260, 60],
    [290, 210, 78], [-320, -110, 52], [60, 300, 66],
  ];
  for (const [x, z, r] of spots) {
    const lake = new THREE.Mesh(new THREE.CircleGeometry(r, 26), mat);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(x, -14, z);
    g.add(lake);
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.96, r * 1.1, 26), rim);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, -13.6, z);
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
 * Them, waiting for you.
 *
 * The same four models the station is full of, scaled up a long way — from
 * the altitude this is seen at, an actual-size Crawler would be less than a
 * pixel, and the point of the shot is that you can tell what they are.
 */
function buildWelcome() {
  const g = new THREE.Group();
  const kinds = [buildCrawler, buildBrute, buildWatcher, buildFloater];
  // Two groups. Most of them are gathered round the castle, because that is
  // what the castle is for; the rest are spread down the line the pod falls
  // along, so there is something to see the whole way in.
  const place = (x, z, s) => {
    const make = kinds[Math.floor(Math.random() * kinds.length)];
    let m;
    try { m = make(); } catch (e) { return; }
    m.scale.setScalar(s);
    m.position.set(x, -12 + s * 0.45, z);
    m.rotation.y = Math.random() * Math.PI * 2;
    g.add(m);
  };
  for (let i = 0; i < 40; i++) {                 // round the castle
    const a = Math.random() * Math.PI * 2;
    const r = 110 + Math.random() * 190;
    place(-60 + Math.cos(a) * r, -210 + Math.sin(a) * r, 10 + Math.random() * 9);
  }
  for (let i = 0; i < 34; i++) {                 // under the flight path
    place(-230 + Math.random() * 460, 260 - Math.random() * 520,
          9 + Math.random() * 10);
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
  const terrain = buildTerrain();
  ground.add(terrain);
  ground.add(buildLakes());
  const castle = buildCastle();
  castle.position.set(-60, -10, -210);
  ground.add(castle);
  ground.add(buildWelcome());
  const groundSun = new THREE.DirectionalLight(0xffc0e0, 1.1);
  groundSun.position.set(0.4, 1, 0.3);
  ground.add(groundSun);
  // Thick purple air, so the far mountains sit back rather than cutting out.
  const haze = new THREE.FogExp2(0x2a1240, 0.0016);

  // ── The pod ──
  const pod = buildPod();
  // Down in the corner and a good way out, so it frames the shot rather than
  // blocking it — the planet is what you are meant to be looking at.
  pod.scale.setScalar(0.8);
  pod.position.set(-2.7, -1.5, -8.2);
  pod.rotation.y = 0.26;
  // Hung off the camera rather than the scene, so it keeps its place in the
  // frame wherever the shot goes — the same way the gun does in the game.
  camera.add(pod);
  scene.add(camera);
  const flame = pod.getObjectByName('flame');

  let t = 0;
  let done = false;
  let fade = 0;             // 0 clear, 1 black

  function at(a, b, time) {           // 0..1 across a beat
    return Math.min(1, Math.max(0, (time - a) / (b - a)));
  }
  const ease = (x) => x * x * (3 - 2 * x);

  function update(dt) {
    if (done) return true;
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
        scene.background = new THREE.Color(0x3a1a52);   // a bruised sky
        scene.fog = haze;
      }
      const k = at(BEAT.surface, BEAT.impact, t);
      // Falling toward it, and drifting to the right as it goes.
      //
      // The drift is not decoration. The castle's keep is ninety-five tall
      // and sits just off the line the pod was coming down, so flying
      // straight gave you four seconds of a dark wall filling the frame —
      // the camera passes it now instead of hitting it.
      const height = 340 - ease(k) * 220;
      camera.position.set(ease(k) * 95, height, 520 - k * 640);
      camera.rotation.set(-0.42 + k * 0.2, -ease(k) * 0.16,
                          Math.sin(t * 0.6) * 0.04);
      pod.position.set(-2.7, -1.5 - k * 0.5, -8.2 + k * 1.4);
      fade = 0;

    } else {
      // The ground. Nothing clever — it simply stops.
      const k = at(BEAT.impact, BEAT.over, t);
      // The last of it: nose over, ground comes up, and the black gets
      // there first.
      camera.position.set(95, 120 - ease(k) * 118, -120 - k * 190);
      camera.rotation.set(-0.22 - k * 0.6, -0.16, 0);
      pod.position.set(-2.7, -1.5, -8.2 + k * 2.4);
      // Full black a little before the ground actually arrives, so you
      // never see the camera go through it.
      fade = ease(Math.min(1, k * 1.9));
      if (t >= BEAT.over) done = true;
    }
    return done;
  }

  function skip() { done = true; fade = 1; }
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

  return { scene, camera, update, skip, blackness, dispose,
           get at() { return t; },
           get finished() { return done; } };
}
