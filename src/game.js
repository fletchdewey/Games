// game.js — Main entry point for Falo 3D-2
//
// FLETCHER'S GUIDE:
// This is the conductor of the orchestra. Every other file is an
// instrument — the aliens, the controller, the map. This file
// tells them all when to play and what to do each frame.
//
// The game loop runs ~60 times per second:
//   1. Read player input (controller)
//   2. Move the player
//   3. Check if they shot (raycasting)
//   4. Update every alien's AI brain
//   5. Move alien projectiles
//   6. Check if the player got hit
//   7. Update the HUD (health, kills, room name)
//   8. Draw everything

import * as THREE from 'three';

// === Shared modules ===
import { PALETTE, getMaterial } from './shared/materials.js';

// === Alien modules ===
import { buildCrawler, animateCrawler, createCrawlerAI, updateCrawlerAI, hitCrawler, killCrawler } from './aliens/crawler.js';
import { buildFloater, animateFloater, createFloaterAI, updateFloaterAI, hitFloater, killFloater } from './aliens/floater.js';
import { buildSpire, animateSpire, createSpireAI, updateSpireAI, hitSpire, killSpire } from './aliens/spire.js';
import { buildBrute, animateBrute, createBruteAI, updateBruteAI, hitBrute, killBrute } from './aliens/brute.js';

// === Player ===
import { createController, updateController } from './player/controller.js';

// === Map ===
import { buildMap, getCurrentRoom } from './map/builder.js';

// ─── ALIEN REGISTRY ─────────────────────────────────────────
// Maps alien type names to their module functions so we can
// spawn and update them generically.
const ALIEN_TYPES = {
  crawler: {
    build: buildCrawler, animate: animateCrawler,
    createAI: createCrawlerAI, updateAI: updateCrawlerAI,
    hit: hitCrawler, kill: killCrawler,
    hp: 3, baseY: 0.25, attackType: 'melee', attackRange: 2.5,
    attackDmg: 8, attackCD: 1.5, speed: 0.04,
  },
  floater: {
    build: buildFloater, animate: animateFloater,
    createAI: createFloaterAI, updateAI: updateFloaterAI,
    hit: hitFloater, kill: killFloater,
    hp: 2, baseY: 1.5, attackType: 'ranged', attackRange: 10,
    attackDmg: 12, attackCD: 2.0, speed: 0.025,
    projSpeed: 6, projColor: 0xff44cc,
  },
  spire: {
    build: buildSpire, animate: animateSpire,
    createAI: createSpireAI, updateAI: updateSpireAI,
    hit: hitSpire, kill: killSpire,
    hp: 3, baseY: 0.3, attackType: 'ranged', attackRange: 12,
    attackDmg: 10, attackCD: 2.5, speed: 0.02,
    projSpeed: 5, projColor: 0xffaa22,
  },
  brute: {
    build: buildBrute, animate: animateBrute,
    createAI: createBruteAI, updateAI: updateBruteAI,
    hit: hitBrute, kill: killBrute,
    hp: 6, baseY: 0.3, attackType: 'melee', attackRange: 3.5,
    attackDmg: 15, attackCD: 2.0, speed: 0.035,
  },
};

// ─── ALIEN SPAWN PLAN ───────────────────────────────────────
// Which aliens spawn in which rooms.
const SPAWN_PLAN = [
  { room: 'outpost1', type: 'crawler', count: 4 },
  { room: 'outpost2', type: 'floater', count: 3 },
  { room: 'outpost3', type: 'spire',   count: 3 },
  { room: 'outpost4', type: 'brute',   count: 2 },
  { room: 'cafeteria', type: 'crawler', count: 2 },
  { room: 'hospital', type: 'floater', count: 1 },
  { room: 'prison', type: 'crawler', count: 3 },
  { room: 'alien_pods', type: 'spire', count: 2 },
  { room: 'control_room', type: 'brute', count: 1 },
  { room: 'control_room', type: 'floater', count: 2 },
  { room: 'control_room', type: 'spire', count: 1 },
];

// ─── GUN ────────────────────────────────────────────────────
function createGun(camera) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x333340 });
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.3), mat));
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), mat);
  grip.position.set(0, -0.08, 0.08); grip.rotation.x = 0.2; g.add(grip);
  const mz = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.06, 6),
    new THREE.MeshLambertMaterial({ color: 0x222230 })
  );
  mz.rotation.x = Math.PI / 2; mz.position.set(0, 0.01, -0.18); g.add(mz);
  g.position.set(0.25, -0.2, -0.4);
  camera.add(g);
  return { group: g, recoilTime: 0 };
}

function updateGun(gun, dt) {
  if (gun.recoilTime > 0) {
    gun.recoilTime -= dt;
    const k = Math.max(0, gun.recoilTime) * 8;
    gun.group.rotation.x = -k * 0.15;
    gun.group.position.z = -0.4 + k * 0.02;
  } else {
    gun.group.rotation.x = 0;
    gun.group.position.z = -0.4;
  }
}

// ─── BULLET TRACERS ─────────────────────────────────────────
function createTracer(scene, from, to) {
  const d = new THREE.Vector3().subVectors(to, from);
  const len = d.length();
  const geo = new THREE.CylinderGeometry(0.008, 0.008, len, 4);
  geo.translate(0, len / 2, 0); geo.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0xffdd44, transparent: true, opacity: 0.8
  }));
  mesh.position.copy(from); mesh.lookAt(to);
  scene.add(mesh);
  return { mesh, life: 0.1 };
}

function createFlash(scene, pos) {
  const l = new THREE.PointLight(0xffaa44, 3, 8);
  l.position.copy(pos); scene.add(l);
  return { light: l, life: 0.05 };
}

// ─── ALIEN PROJECTILES ──────────────────────────────────────
function createAlienProjectile(scene, from, to, color, speed) {
  const dir = new THREE.Vector3().subVectors(to, from).normalize();
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 5, 5),
    new THREE.MeshBasicMaterial({ color })
  );
  mesh.position.copy(from);
  const light = new THREE.PointLight(color, 1, 4);
  mesh.add(light);
  scene.add(mesh);
  return { mesh, dir, speed, life: 4 };
}

// ─── SPAWN ALIENS ───────────────────────────────────────────
import { ROOMS } from './map/layout.js';

function spawnAliens(scene) {
  const aliens = [];

  SPAWN_PLAN.forEach((plan) => {
    const roomDef = ROOMS.find(r => r.id === plan.room);
    if (!roomDef) return;

    const reg = ALIEN_TYPES[plan.type];
    if (!reg) return;

    for (let i = 0; i < plan.count; i++) {
      const model = reg.build();
      const ai = reg.createAI();

      // Scatter within the room
      const hw = roomDef.size[0] / 2 - 1.5;
      const hd = roomDef.size[1] / 2 - 1.5;
      const sx = roomDef.pos[0] + (Math.random() * 2 - 1) * hw;
      const sz = roomDef.pos[1] + (Math.random() * 2 - 1) * hd;

      model.position.set(sx, reg.baseY, sz);
      model.userData.baseY = reg.baseY;
      model.userData.ai = ai;
      scene.add(model);

      aliens.push({
        model, ai, type: plan.type, reg,
        hp: reg.hp, maxHp: reg.hp,
        alive: true, flashTimer: 0, deathTimer: 0,
        spawnPos: new THREE.Vector3(sx, reg.baseY, sz),
        attackTimer: reg.attackCD * (0.5 + Math.random()),
      });
    }
  });

  return aliens;
}

// ─── INIT ───────────────────────────────────────────────────
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060608);
scene.fog = new THREE.FogExp2(0x060608, 0.012);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
scene.add(camera);

const bounds = buildMap(scene);
const ctrl = createController(camera, canvas);
const gun = createGun(camera);
const aliens = spawnAliens(scene);
const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);

let tracers = [];
let flashes = [];
let projectiles = [];
let killCount = 0;
let playerHp = 100;
let isDead = false;
let dmgFlashTimer = 0;

// ─── HUD ELEMENTS ──────────────────────────────────────────
const healthBar = document.getElementById('health-bar');
const healthText = document.getElementById('health-text');
const killsEl = document.getElementById('kills');
const roomLabelEl = document.getElementById('room-label');
const dmgFlashEl = document.getElementById('damage-flash');
const deathScreen = document.getElementById('death-screen');
const startOverlay = document.getElementById('start-overlay');

function updateHUD() {
  healthBar.style.width = playerHp + '%';
  healthBar.style.background = playerHp > 60 ? '#44ff88' : playerHp > 30 ? '#ffaa22' : '#ff2244';
  healthText.textContent = 'HP ' + playerHp;
  healthText.style.color = healthBar.style.background;
  killsEl.textContent = 'KILLS: ' + killCount;
}

function damagePlayer(amount) {
  if (isDead) return;
  playerHp = Math.max(0, playerHp - amount);
  dmgFlashTimer = 0.3;
  dmgFlashEl.style.opacity = '1';
  updateHUD();

  if (playerHp <= 0) {
    isDead = true;
    deathScreen.style.display = 'flex';
    setTimeout(() => {
      playerHp = 100;
      isDead = false;
      deathScreen.style.display = 'none';
      ctrl.position.set(0, 1.6, 2);
      ctrl.yaw = Math.PI;
      ctrl.pitch = 0;
      updateHUD();
    }, 2000);
  }
}

// ─── START ──────────────────────────────────────────────────
startOverlay.addEventListener('click', () => {
  startOverlay.style.display = 'none';
  canvas.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  ctrl.locked = document.pointerLockElement === canvas;
});

canvas.addEventListener('click', () => {
  if (!ctrl.locked) {
    canvas.requestPointerLock();
  }
});

// ─── RESIZE ─────────────────────────────────────────────────
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

// ─── GAME LOOP ──────────────────────────────────────────────
let lastTime = performance.now();
let roomCheckTimer = 0;

function gameLoop(now) {
  requestAnimationFrame(gameLoop);

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  const time = now / 1000;

  // --- Player ---
  if (!isDead) {
    updateController(ctrl, dt);

    // Wall collision (same as map test — check X and Z independently)
    const pos = ctrl.position;
    // Already handled in controller for room bounds, but we need
    // to clamp to map bounds here since controller doesn't know about rooms
  }
  updateGun(gun, dt);

  // --- Damage flash decay ---
  if (dmgFlashTimer > 0) {
    dmgFlashTimer -= dt;
    dmgFlashEl.style.opacity = String(Math.max(0, dmgFlashTimer / 0.3));
  }

  // --- Shooting ---
  if (ctrl.shootRequested) {
    ctrl.shootRequested = false;
    if (!isDead) {
      gun.recoilTime = 0.08;
      raycaster.setFromCamera(screenCenter, camera);

      const hitMeshes = [];
      aliens.forEach((a) => {
        if (a.alive) a.model.traverse((c) => { if (c.isMesh) hitMeshes.push(c); });
      });

      const hits = raycaster.intersectObjects(hitMeshes);
      const from = camera.position.clone().add(
        new THREE.Vector3(0.15, -0.1, -0.3).applyQuaternion(camera.quaternion)
      );
      let to;

      if (hits.length > 0) {
        to = hits[0].point;
        const hitObj = hits[0].object;
        for (const alien of aliens) {
          let found = false;
          alien.model.traverse((c) => { if (c === hitObj) found = true; });
          if (found && alien.alive) {
            alien.hp--;
            alien.flashTimer = 0.12;
            alien.reg.hit(alien.ai);
            if (alien.hp <= 0) {
              alien.alive = false;
              alien.deathTimer = 0;
              alien.reg.kill(alien.ai);
              killCount++;
              updateHUD();
            }
            break;
          }
        }
      } else {
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        to = from.clone().add(dir.multiplyScalar(30));
      }

      tracers.push(createTracer(scene, from, to));
      flashes.push(createFlash(scene, from));
    }
  }

  // --- Update aliens ---
  aliens.forEach((a) => {
    if (!a.alive) {
      a.deathTimer += dt;
      // Let the AI module handle the death animation
      a.reg.updateAI(a.model, a.ai, ctrl.position, dt);
      // Remove after 5 seconds
      if (a.deathTimer > 5) {
        a.model.visible = false;
      }
      // Respawn after 8 seconds
      if (a.deathTimer > 8) {
        a.alive = true;
        a.hp = a.maxHp;
        a.deathTimer = 0;
        a.model.visible = true;
        a.model.position.copy(a.spawnPos);
        a.model.rotation.set(0, 0, 0);
        a.model.scale.setScalar(1);
        a.ai = a.reg.createAI();
        a.model.userData.ai = a.ai;
        a.attackTimer = a.reg.attackCD;
      }
      return;
    }

    // Flash timer
    if (a.flashTimer > 0) a.flashTimer -= dt;

    // Run AI
    a.reg.updateAI(a.model, a.ai, ctrl.position, dt);

    // Simple attack logic on top of AI
    a.attackTimer -= dt;
    const dist = a.model.position.distanceTo(ctrl.position);

    if (a.attackTimer <= 0 && dist < a.reg.attackRange * 1.2 && dist < 20) {
      a.attackTimer = a.reg.attackCD;
      if (a.reg.attackType === 'melee' && dist < a.reg.attackRange) {
        damagePlayer(a.reg.attackDmg);
      } else if (a.reg.attackType === 'ranged' && dist >= 3) {
        const from = a.model.position.clone();
        from.y += a.type === 'spire' ? 1.3 : a.type === 'floater' ? 0.5 : 0.5;
        const to = ctrl.position.clone(); to.y = 1.2;
        projectiles.push(createAlienProjectile(
          scene, from, to, a.reg.projColor, a.reg.projSpeed
        ));
      }
    }
  });

  // --- Update projectiles ---
  projectiles = projectiles.filter((p) => {
    p.life -= dt;
    if (p.life <= 0) { scene.remove(p.mesh); return false; }
    p.mesh.position.addScaledVector(p.dir, p.speed * dt);
    // Hit player?
    if (p.mesh.position.distanceTo(ctrl.position) < 0.6) {
      damagePlayer(12);
      scene.remove(p.mesh);
      return false;
    }
    // Hit wall?
    const pp = p.mesh.position;
    if (pp.y < 0 || pp.y > 4) { scene.remove(p.mesh); return false; }
    return true;
  });

  // --- Decay tracers & flashes ---
  tracers = tracers.filter((t) => {
    t.life -= dt;
    if (t.life <= 0) { scene.remove(t.mesh); t.mesh.geometry.dispose(); return false; }
    t.mesh.material.opacity = t.life / 0.1;
    return true;
  });
  flashes = flashes.filter((f) => {
    f.life -= dt;
    if (f.life <= 0) { scene.remove(f.light); return false; }
    f.light.intensity = (f.life / 0.05) * 3;
    return true;
  });

  // --- Room label ---
  roomCheckTimer += dt;
  if (roomCheckTimer > 0.2) {
    roomCheckTimer = 0;
    const rm = getCurrentRoom(ctrl.position, bounds);
    if (rm) roomLabelEl.textContent = rm;
  }

  // --- Render ---
  renderer.render(scene, camera);
}

// Start the loop
requestAnimationFrame(gameLoop);
