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
import { PALETTE, getMaterial } from './shared/materials.js?v=0b04e48cd1';

// === Alien modules ===
import { buildCrawler, animateCrawler, createCrawlerAI, updateCrawlerAI, hitCrawler, killCrawler } from './aliens/crawler.js?v=0b04e48cd1';
import { buildFloater, animateFloater, createFloaterAI, updateFloaterAI, hitFloater, killFloater } from './aliens/floater.js?v=0b04e48cd1';
import { buildWatcher, animateWatcher, createWatcherAI, updateWatcherAI, hitWatcher, killWatcher, restWatcher,
         EYE_HEIGHT as WATCHER_EYE_Y, CHEST_DROP as WATCHER_AIM_DROP } from './aliens/watcher.js?v=0b04e48cd1';
import { buildBrute, animateBrute, createBruteAI, updateBruteAI, hitBrute, killBrute } from './aliens/brute.js?v=0b04e48cd1';

// === Player ===
import { createController, updateController } from './player/controller.js?v=0b04e48cd1';

// === Boss ===
import { createPuppetMaster } from './bosses/puppet_master.js?v=0b04e48cd1';
import { createSwarm } from './bosses/swarm.js?v=0b04e48cd1';
import { initSwarm, updateSwarm, damageSwarm } from './bosses/swarm_ai.js?v=0b04e48cd1';
import { createTwins } from './bosses/twins.js?v=0b04e48cd1';
import { initTwins, updateTwins, damageTwin } from './bosses/twins_ai.js?v=0b04e48cd1';
import { createBurrower } from './bosses/burrower.js?v=0b04e48cd1';
import { initBurrower, updateBurrower, damageBurrower,
         setBurrowerArena } from './bosses/burrower_ai.js?v=0b04e48cd1';
import { initPuppetMaster, updatePuppetMaster, damagePuppetMaster,
         stepPuppetMasterFx, setPuppetArena } from './bosses/puppet_master_ai.js?v=0b04e48cd1';

// === Map ===
// The level now comes from the grid you paint in the Map Editor, baked into
// grid_data.js by build.sh. layout.js / builder.js are the old hand-written
// rooms and are no longer used by v2.
import { buildGridMap, roomIdAt, placeNameAt, roomSpawn, randomCellIn, isFloorAt, ROOMS }
  from './map/grid_map.js?v=0b04e48cd1';
import { buildHangarProps, buildCeilingWebs, buildFloorWebs,
         buildFloorTentacles, buildLaserScars,
         buildWatcherDebris, buildOutpostWreckage,
         buildHumanDebris, buildPrison, buildArmory,
         buildAlienBoard, buildAlienPods, prisonBrokenCell,
         buildEscapePod, setEscapePodUnlocked, updateEscapePod, buildLockedDoor,
         buildStudyScreen, buildControlRoom } from './map/props.js?v=0b04e48cd1';

// ─── ALIEN REGISTRY ─────────────────────────────────────────
// Maps alien type names to their module functions so we can
// spawn and update them generically.
//
// baseY is the height the model is parked at, and it has one job: put the
// FEET on the floor. It is not a guess — each one is measured from the model
// itself, by posing it through a whole walk cycle and taking the lowest point
// its legs reach. Get it wrong and nothing errors; the alien just stands in
// the floor. The Brute was 0.56 under and the Spire 0.77 under, which is most
// of a leg, and neither had ever been checked.
const ALIEN_TYPES = {
  crawler: {
    build: buildCrawler, animate: animateCrawler,
    createAI: createCrawlerAI, updateAI: updateCrawlerAI,
    hit: hitCrawler, kill: killCrawler,
    hp: 3, baseY: 0.32, attackType: 'melee', attackRange: 2.5,   // feet measured at -0.32
    attackDmg: 8, attackCD: 1.5, speed: 0.04,
    spawnGap: 2.8,          // 2.6 wide across the legs, plus a little air
    bodyRadius: 0.7,        // the shell; the splayed legs are allowed to overlap
    // States where the idle walk cycle should play (see aliens/crawler.js).
    // During action states (pounce/recover/hurt) the AI drives the pose.
    idleStates: ['patrol', 'chase'],
  },
  floater: {
    build: buildFloater, animate: animateFloater,
    createAI: createFloaterAI, updateAI: updateFloaterAI,
    hit: hitFloater, kill: killFloater,
    hp: 2, baseY: 1.5, attackType: 'ranged', attackRange: 10,   // hovers; no feet to land
    attackDmg: 12, attackCD: 2.0, speed: 0.025,
    spawnGap: 2.0,          // the smallest of the four, at 1.3 across
    bodyRadius: 0.6,        // the bell. Its tentacles trail through, which is fine
    projSpeed: 6, projColor: 0xff44cc,
    idleStates: ['hover', 'chase'],
  },
  // The Watcher stands where the Spire used to. It is a turret, not a walker:
  // it never leaves its spot, so it has no speed and no patrol.
  watcher: {
    build: buildWatcher, animate: animateWatcher,
    createAI: createWatcherAI, updateAI: updateWatcherAI,
    hit: hitWatcher, kill: killWatcher,
    hp: 1, baseY: 0.05, attackType: 'beam', attackRange: 12,   // feet measured at -0.05
    attackDmg: 15, attackCD: 0, speed: 0,
    spawnGap: 3.4,          // 2.6 across the tripod, and it never moves off it
    bodyRadius: 0.8,        // never actually moves, so this never comes up
    // Its beam lands on the one frame the shot connects, like the Brute's
    // slam — not on a proximity timer. Standing beside one does nothing at
    // all until it actually fires, which is what makes the telegraph worth
    // reading instead of decorative.
    attackViaAI: true,
    // Checked against the walls every frame before it is allowed to see you.
    // See clearShot() — the only alien that gets this, and the only one whose
    // shot is instant enough to need it.
    needsSight: true,
    // What to put away when the world stops. See the freeze in the loop.
    rest: restWatcher,
    idleStates: ['scan'],
  },
  brute: {
    build: buildBrute, animate: animateBrute,
    createAI: createBruteAI, updateAI: updateBruteAI,
    hit: hitBrute, kill: killBrute,
    hp: 6, baseY: 0.86, attackType: 'melee', attackRange: 3.5,   // feet measured at -0.86
    attackDmg: 10, attackCD: 2.0, speed: 0.035,   // 10% of the player's 100 HP
    spawnGap: 3.2,          // the widest of the four, at 3.0 shoulder to shoulder
    bodyRadius: 0.9,        // its torso. Any wider and it could not fit a doorway
    // The Brute lands damage on its slam's impact frame, not on a proximity
    // timer — otherwise the charge/dodge is decorative and it hits you for
    // simply being near it. See the alien update loop.
    attackViaAI: true,
    idleStates: ['patrol', 'chase'],
  },
};

// ─── ALIEN SPAWN PLAN ───────────────────────────────────────
// Which aliens spawn in which rooms. One outpost per species, four of each,
// so every room you walk into is a different problem rather than a different
// mix of the same one.
//
// Room ids: room1 Hangar · room2 Outpost 3 · room3 outpost 2 · room4 outpost 1
// room5 armory · room6 prison · room7 outpost 4 · room8 alien pods
// room9 Control Room (boss) · room10 Locked Door
//
// `spots` overrides the random scatter with exact positions. The pair in the
// prison are in the BROKEN cell specifically — the one whose door is lying
// in the walkway — because that is the whole point of them. Scattered on a
// random floor cell of the prison they would stand in the corridor, and the
// torn-open cell would go back to being scenery.
const SPAWN_PLAN = [
  { room: 'room7', type: 'brute',   count: 4 },   // outpost 4
  { room: 'room2', type: 'watcher', count: 4 },   // Outpost 3
  { room: 'room3', type: 'floater', count: 4 },   // outpost 2
  { room: 'room4', type: 'crawler', count: 4 },   // outpost 1
  { room: 'room6', type: 'crawler', count: 2, spots: brokenCellSpots() },
  { room: 'room5', type: 'brute',   count: 1 },   // armory
  { room: 'room8', type: 'floater', count: 2 },   // alien pods
  { room: 'room1', type: 'watcher', count: 1 },   // Hangar — where you start
];

/**
 * Two standing spots inside the prison's torn-open cell.
 *
 * The cell is 2.6 deep and 3.6 across with a cot down its back wall, so
 * there is one usable strip: forward of the cot, back from the bars. They
 * sit either side of the doorway gap rather than in it, so you see them
 * through the bars before the hole lines up and they come out.
 */
function brokenCellSpots() {
  const prison = ROOMS.find((r) => r.id === 'room6');
  if (!prison) return [];
  const c = prisonBrokenCell(prison);
  const x = c.x0 + 1.6;                     // clear of the cot, off the bars
  return [{ x, z: c.z0 + 0.95 }, { x, z: c.z1 - 0.95 }];
}

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
// A visible tracer round that actually flies out of the gun. The shot's
// damage is instant (hitscan raycast); this is the glowing bolt you SEE.
// It's a bright sphere with its own light — a ball reads the same from
// every angle, so (unlike a thin cylinder aimed down your view axis) it's
// never edge-on and invisible. It flies straight out along the crosshair.
function createBullet(scene, from, to) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const maxDist = Math.max(0.2, dir.length());
  dir.normalize();
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffee66, transparent: true, opacity: 1 })
  );
  mesh.position.copy(from);
  const light = new THREE.PointLight(0xffcc44, 3, 8);
  mesh.add(light);
  scene.add(mesh);
  return { mesh, dir, speed: 35, life: 1.2, traveled: 0, maxDist };
}

function createFlash(scene, pos) {
  const l = new THREE.PointLight(0xffaa44, 3, 8);
  l.position.copy(pos); scene.add(l);
  return { light: l, life: 0.05 };
}

// ─── ALIEN PROJECTILES ──────────────────────────────────────
// `opts.model` throws a solid object instead of the usual glowing bolt — the
// Puppet Master's pilot lobs whatever junk is lying around the station, and a
// thrown spanner has no business lighting the room up. `opts.spin` tumbles it.
function createAlienProjectile(scene, from, to, color, speed, damage, opts = {}) {
  const dir = new THREE.Vector3().subVectors(to, from).normalize();
  let mesh;
  if (opts.model) {
    mesh = opts.model;
  } else {
    mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 5, 5),
      new THREE.MeshBasicMaterial({ color })
    );
    mesh.add(new THREE.PointLight(color, 1, 4));
  }
  mesh.position.copy(from);
  scene.add(mesh);
  return { mesh, dir, speed, life: 4, damage, spin: opts.spin || null };
}

// Remove a projectile from the scene and free its GPU resources.
function removeProjectile(p) {
  scene.remove(p.mesh);
  // A thrown object is a Group of meshes, not one mesh with its own geometry.
  if (p.mesh.geometry) p.mesh.geometry.dispose();
  if (p.mesh.material) p.mesh.material.dispose();
  p.mesh.traverse((o) => {
    if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
  });
}

// Free a model's GPU geometry when we throw it away (materials come from
// the shared cache / per-instance clones and are cheap to leave for GC).
function disposeModel(model) {
  model.traverse((o) => {
    if (o.isMesh && o.geometry) o.geometry.dispose();
  });
}

// ─── SPAWN ALIENS ───────────────────────────────────────────

/**
 * A painted cell in `roomId` that is `gap` clear of everything in `placed`
 * and not standing in the scenery.
 *
 * The second half matters in the cluttered rooms. A painted cell only means
 * there is floor there — it says nothing about the weapon racks bolted to it,
 * and the armory is mostly weapon racks. An alien dropped inside one isn't
 * stuck (it walks out, the collision lets anything already overlapping move
 * freely) but you would see it standing in a crate for the first second.
 *
 * Two fallbacks, in order of how much they give up: the roomiest spot that
 * is at least clear of scenery, then the roomiest spot at all — so a room too
 * cramped to satisfy both still spreads them as well as it can rather than
 * stacking them.
 */
function spacedCellIn(roomId, placed, gap, radius) {
  let best = null, bestGap = -1;
  let bestClear = null, bestClearGap = -1;
  for (let attempt = 0; attempt < 40; attempt++) {
    const spot = randomCellIn(roomId);
    if (!spot) return null;

    let nearest = Infinity;
    for (const p of placed) {
      const d = Math.hypot(spot.x - p.x, spot.z - p.z);
      if (d < nearest) nearest = d;
    }
    const clearOfScenery = !hitsWall(spot.x, spot.z, radius);

    if (clearOfScenery && nearest >= gap) return spot;
    if (clearOfScenery && nearest > bestClearGap) { bestClearGap = nearest; bestClear = spot; }
    if (nearest > bestGap) { bestGap = nearest; best = spot; }
  }
  return bestClear || best;
}

/** Build one alien and stand it at x,z. Shared by the scatter and by the
 *  hand-placed pair in the prison. */
function placeAlien(aliens, scene, reg, plan, x, z) {
  const model = reg.build();
  const ai = reg.createAI();
  model.position.set(x, reg.baseY, z);
  model.userData.baseY = reg.baseY;
  model.userData.ai = ai;
  scene.add(model);
  aliens.push({
    model, ai, type: plan.type, reg,
    room: plan.room,          // used to park aliens in rooms you're not in
    hp: reg.hp, maxHp: reg.hp,
    alive: true, gone: false, flashTimer: 0, deathTimer: 0,
    spawnPos: new THREE.Vector3(x, reg.baseY, z),
    attackTimer: reg.attackCD * (0.5 + Math.random()),
  });
}

function spawnAliens(scene) {
  const aliens = [];
  // Where everything already stands, per room, so the next one can avoid it.
  const taken = {};

  SPAWN_PLAN.forEach((plan) => {
    const roomDef = ROOMS.find(r => r.id === plan.room);
    if (!roomDef) return;

    const reg = ALIEN_TYPES[plan.type];
    if (!reg) return;

    for (let i = 0; i < plan.count; i++) {
      // An exact spot, when the plan names one — see brokenCellSpots().
      // Everything below is the scatter, which is wrong for a placement that
      // only means anything in one particular corner of a room.
      if (plan.spots) {
        const want = plan.spots[i];
        if (!want) continue;
        placeAlien(aliens, scene, reg, plan, want.x, want.z);
        continue;
      }

      // Pick an actual painted cell. Scattering inside a bounding box would
      // drop aliens into the empty notches of an irregular room.
      //
      // And keep it clear of the ones already placed in this room. Cells are
      // 2 units and a Brute is nearly 3 wide, so four of them dropped on
      // random cells don't just risk sharing one — neighbouring cells overlap
      // too, and you would walk in on a single knot of bodies. Try for a cell
      // that is a whole body-width from everything already down; if the room
      // is too cramped for that, take the roomiest one we saw.
      const spot = spacedCellIn(plan.room, taken[plan.room] || (taken[plan.room] = []),
                                reg.spawnGap || 2, reg.bodyRadius || 0.6);
      if (!spot) continue;
      taken[plan.room].push(spot);
      placeAlien(aliens, scene, reg, plan, spot.x, spot.z);
    }
  });

  return aliens;
}

// ─── SPAWN BOSS ─────────────────────────────────────────────
// One Puppet Master waits in the Control Room — the arena behind the Locked
// Door. The fight begins when the player first steps into it.
const BOSS_ROOM = 'room9';

const BOSS_ENABLED = true;

// ─── THE BOSSES ─────────────────────────────────────────────
// One of the four is waiting in the Control Room, picked at random when the
// level loads — a 25% chance each. You don't know which until you open the
// door.
//
// They are built very differently from each other, so rather than teaching
// this file about all four, each one says here how it is made, driven, shot
// and shown. Everything below dispatches through this table, so adding a
// fifth boss is a new entry and nothing else.
//
// Per-bullet damage differs because each was balanced against its own health
// in its own workshop: the Burrower was tuned at 10 a shot (120 health, so a
// dozen hits) and the rest at 1.
const BOSS_KINDS = [
  {
    id: 'puppet_master',
    fell: 'The Puppet Master falls.',
    bullet: 1,
    create: () => createPuppetMaster(),
    place(model, at, arena) {
      model.position.set(at.x, 0, at.z);
      initPuppetMaster(model);
      // Pen the ejected pilot in. Unleashed it flees the player in a straight
      // line and walks out through the wall and off the map.
      setPuppetArena(model, arena.x, arena.z, arena.r);
    },
    // The Puppet Master stops being driven once it's beaten and does its own
    // pilot flop instead — that was already working, so it is left alone.
    update(model, playerPos, dtF, dt, defeated) {
      const d = model.userData;
      if (defeated) {
        if (d.pilotGroup) {
          d.pilotGroup.rotation.z =
            Math.min(Math.PI / 2, (d.pilotGroup.rotation.z || 0) + dt * 3);
        }
        return;
      }
      updatePuppetMaster(model, playerPos, dtF);
      // Blood, the pilot bailing out, the body going down, and the pilot's
      // own end — all of it lives in the boss module, so its workshop plays
      // back exactly what happens here rather than a copy of it.
      stepPuppetMasterFx(model, dtF, scene);
    },
    hit: (model, part, point, amount) =>
      damagePuppetMaster(model, amount, part, point),
    dead: (d) => d.isDead,
    // The pilot can eject out of the boss group, so it is raycast separately
    // or it stops being shootable the moment it bails.
    targets: (model) => [model.userData.pilotGroup],
    flash: (model) => [[model, 'body'], [model.userData.pilotGroup, 'pilot']],
    hud(d, defeated) {
      const bodyPct = Math.max(0, d.bodyHp / d.bodyHpMax) * 100;
      const pilotPct = Math.max(0, d.pilotHp / d.pilotHpMax) * 100;
      if (defeated) return { label: 'PUPPET MASTER — DOWN', pct: 0 };
      if (d.phase === 'ejected')
        return { label: 'PILOT — SHOOT IT!', pct: pilotPct, colour: '#44ff88' };
      if (d.pilotExposed)
        return { label: 'PILOT EXPOSED — SHOOT IT!', pct: pilotPct, colour: '#44ff88' };
      return { label: 'THE PUPPET MASTER', pct: bodyPct, colour: '#ff2244' };
    },
  },
  {
    id: 'swarm',
    fell: 'The Swarm scatters for good.',
    bullet: 1,
    create: () => createSwarm(),
    place(model, at) { model.position.set(at.x, 0, at.z); initSwarm(model); },
    // Keeps being driven after it dies: the motes' frenzy-and-fall is inside
    // updateSwarm, so stopping would freeze them in mid-air.
    update: (model, playerPos, dtF) => updateSwarm(model, playerPos, dtF),
    hit: (model, part, point, amount) => damageSwarm(model, amount, point),
    dead: (d) => d.isDead,
    hud(d, defeated) {
      if (defeated) return { label: 'THE SWARM — SCATTERED', pct: 0 };
      const pct = Math.max(0, d.hp / d.hpMax) * 100;
      // It can't be hurt while it's blown apart, so say so rather than
      // letting the player empty a magazine into it for nothing.
      if (d.phase !== 'held')
        return { label: 'SCATTERED — WAIT FOR IT', pct, colour: '#6a6a7a' };
      return { label: 'THE SWARM', pct, colour: '#ff2244' };
    },
  },
  {
    id: 'twins',
    fell: 'Both Twins are down.',
    bullet: 1,
    create: () => createTwins(),
    // Like the Burrower, the group stays at the origin and the pair is placed
    // in world space inside. Their AI compares the player's position against
    // each twin's own position, and those two have to be the same space.
    place(model, at) { initTwins(model, { x: at.x, z: at.z }); },
    update: (model, playerPos, dtF) => updateTwins(model, playerPos, dtF),
    // Its meshes are tagged with which twin they belong to, so the hit goes
    // to the one actually shot.
    hit: (model, part, point, amount) => damageTwin(model, part, amount),
    dead: (d) => d.defeated,
    hud(d, defeated) {
      if (defeated) return { label: 'THE TWINS — BOTH DOWN', pct: 0 };
      const live = d.twins.filter((t) => t.state === 'up');
      const pct = d.twins.reduce((a, t) => a + Math.max(0, t.hp), 0)
                / d.twins.reduce((a, t) => a + t.hpMax, 0) * 100;
      // One left standing means the other is being carried back into the
      // fight — that's the bit the player has to interrupt.
      if (live.length === 1)
        return { label: 'KILL IT BEFORE IT REVIVES', pct, colour: '#ffaa22' };
      return { label: 'THE TWINS', pct, colour: '#ff2244' };
    },
  },
  {
    id: 'burrower',
    fell: 'The Burrower comes apart.',
    bullet: 10,
    create: () => createBurrower(),
    // The only one that doesn't ride its group: it lays its body out in the
    // group's own space and expects the group left at the origin, so the
    // spawn point goes into initBurrower instead of into model.position.
    place(model, at, arena) {
      initBurrower(model, { x: at.x, z: at.z });
      setBurrowerArena(model, arena.x0, arena.z0, arena.x1, arena.z1);
    },
    update: (model, playerPos, dtF) => updateBurrower(model, playerPos, dtF),
    hit: (model, part, point, amount) =>
      damageBurrower(model, amount, part, point),
    dead: (d) => d.isDead,
    hud(d, defeated) {
      if (defeated) return { label: 'THE BURROWER — DOWN', pct: 0 };
      const pct = Math.max(0, d.hp / 120) * 100;
      if (d.surfaceAt >= 0.98)
        return { label: 'UNDERGROUND — WATCH THE FLOOR', pct, colour: '#6a6a7a' };
      return { label: 'THE BURROWER', pct, colour: '#ff2244' };
    },
  },
];

// `forceId` is only ever passed by the localhost dev hook, so a particular
// boss can be checked without reloading until it comes up.
function spawnBoss(scene, forceId) {
  const kind = forceId
    ? BOSS_KINDS.find((k) => k.id === forceId)
    : BOSS_KINDS[Math.floor(Math.random() * BOSS_KINDS.length)];
  // Middle of the arena. roomSpawn() always lands on a painted cell.
  const at = roomSpawn(BOSS_ROOM) || new THREE.Vector3(0, 0, 0);

  // The room it is fought in, given both ways: a circle for the Puppet
  // Master's pilot leash, and the actual rectangle for anything that has to
  // be able to reach the player anywhere in the room.
  const r = ROOMS.find((rm) => rm.id === BOSS_ROOM);
  const arena = r
    ? { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2,
        r: Math.min(r.x1 - r.x0, r.z1 - r.z0) / 2 - 1.5,
        x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 }
    : { x: at.x, z: at.z, r: 8,
        x0: at.x - 8, x1: at.x + 8, z0: at.z - 8, z1: at.z + 8 };

  const model = kind.create();
  kind.place(model, at, arena);
  scene.add(model);

  return {
    kind,
    model,
    roomId: BOSS_ROOM,
    active: false,      // has the fight started?
    defeated: false,
  };
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

const { bounds, walls, wallMeshes, ceilingY } = buildGridMap(scene);

// Hangar set dressing — the crash site. Its meshes join wallMeshes so shots
// stop on a body or the airframe instead of passing through.
const hangarProps = buildHangarProps(scene, ROOMS.find((r) => r.id === 'room1'), walls);
wallMeshes.push(...hangarProps.meshes);
const propColliders = hangarProps.colliders;

// ─── THE WAY OUT ────────────────────────────────────────────
// In the open at the south end of the Hangar, nose pointed at the hull
// breach — which is where it goes, and why it is parked facing a hole rather
// than a wall. Far enough back from the lip that you never have to walk into
// the vacuum's pull to reach it.
//
// In plain sight from where you start, and sealed, with a red lamp on it. The
// exit is something you walk past at the beginning and have to come back to.
// Measured, not guessed: the floor in this bay runs z 48 to 57, and the pod
// is about 5.2 long nose to engine bell. Centred at 51 it sits tail 48.4 to
// nose 53.6, clear of the floor edge behind it, and the spot you board from
// is 7 units back from the breach — outside the 6 where the vacuum starts
// pulling, so getting in is never a fight with the hull.
const escapePod = buildEscapePod(scene, { x: 28, z: 51, rot: -Math.PI / 2 });
propColliders.push(...escapePod.colliders);
let escaped = false;
// How long the BOSS DEFEATED banner stays up. It used to sit there for the
// rest of the run, which was fine when killing the boss was effectively the
// end — now there is a walk back to the pod, and a banner across the middle
// of the screen the whole way is just in the way.
let bossBannerTimer = 0;
const hazards = hangarProps.hazards;

// Outpost 1 — cobwebbed ceiling, and webbing matted across the floor that
// bogs you down while you're standing in it.
const OUTPOST_1 = ROOMS.find((r) => r.id === 'room4');
buildCeilingWebs(scene, OUTPOST_1);
const floorWebs = buildFloorWebs(scene, OUTPOST_1, 4);

// Outpost 2 — pink growths across the floor that shock you if you tread on one.
const tentacles = buildFloorTentacles(scene, ROOMS.find((r) => r.id === 'room3'), 5);

// Outpost 3 — a Watcher died fighting here: beam scars raked up the walls and
// its legs still on the floor.
const OUTPOST_3 = ROOMS.find((r) => r.id === 'room2');
buildLaserScars(scene, walls, OUTPOST_3);
buildWatcherDebris(scene, OUTPOST_3, 8);

// The garrison's side of the same three fights. Each one is told where the
// alien dressing in that room is, so a rifle doesn't end up lying through a
// web or a tentacle.
buildHumanDebris(scene, OUTPOST_1, floorWebs.zones, 3301);
buildHumanDebris(scene, ROOMS.find((r) => r.id === 'room3'), tentacles.zones, 5507);
buildHumanDebris(scene, OUTPOST_3, [], 7717);

// The prison block: two cells still locked, one torn open.
const prison = buildPrison(scene, ROOMS.find((r) => r.id === 'room6'));
propColliders.push(...prison.colliders);

// The armory: rusted lockers, a weapon rack and the bench the rifles were
// serviced on.
// ─── THE LOCKED DOOR ────────────────────────────────────────
// Across the room named after it, between you and the Control Room. Solid in
// both of the ways this game means solid: a wall segment so you cannot walk
// through it, and its meshes in wallMeshes so shots stop on it.
//
// Nothing opens it yet. That is deliberate — the look first, the mechanism
// after — and it does mean the boss is sealed off behind it for now.
const lockedDoor = buildLockedDoor(scene, ROOMS.find((r) => r.id === 'room10'));
walls.push(lockedDoor.wall);
wallMeshes.push(...lockedDoor.meshes);

const armory = buildArmory(scene, ROOMS.find((r) => r.id === 'room5'));
propColliders.push(...armory.colliders);

// The board the aliens planned the helicopter ambush on, left up in the
// armory. East wall, south of the lockers — the room's longest clear run.
// rotY turns the board's face (+Z) to point back into the room, at -X.
buildAlienBoard(scene, { x: 3.88, y: 1.85, z: -24.5, rotY: -Math.PI / 2 });

// Outpost 4 — crates smashed open, their contents across the floor, and the
// plate a Brute shed in the fight. Its crates block you like the Hangar's do.
const wreckage = buildOutpostWreckage(scene, ROOMS.find((r) => r.id === 'room7'));
propColliders.push(...wreckage.colliders);

// The pods room: one of each alien held in a green tank, along the south
// wall — the room's only solid run, and the wall you face coming in.
const pods = buildAlienPods(scene, ROOMS.find((r) => r.id === 'room8'));
propColliders.push(...pods.colliders);

// The terminal the station kept its notes on them on, facing the tanks from
// the far wall.
const study = buildStudyScreen(scene, ROOMS.find((r) => r.id === 'room8'));
propColliders.push(...study.colliders);

// The Control Room: a window onto space along the wall you walk at, the
// station's control station filling it underneath, and the crew still at it.
const control = buildControlRoom(scene, ROOMS.find((r) => r.id === 'room9'));
propColliders.push(...control.colliders);

// Start in the Hangar. The old (0, 1.6, 2) is open space on the painted map.
const START_POS = (() => {
  const p = roomSpawn('room1') || new THREE.Vector3(0, 0, 0);
  return new THREE.Vector3(p.x, 1.6, p.z);
})();
const ctrl = createController(camera, canvas);
// createController starts at the world origin, which is empty space on the
// painted map — you'd spawn outside the level in the dark.
ctrl.position.copy(START_POS);

// ─── PLAYER WALL COLLISION ──────────────────────────────────
// The controller moves the camera without knowing about walls
// (by design). Here we push the player back out of any solid wall
// segment, resolving X and Z independently so you slide along walls
// and still pass cleanly through doorways.
const PLAYER_RADIUS = 0.35;
const WALK_SPEED = 5;                  // matches the controller's own default
const WEB_SPEED = 2.1;                 // wading through floor webbing
const SHOCK_DAMAGE = 5;                // 5% of full health per shock
const SHOCK_INTERVAL = 0.9;            // seconds between shocks while stood on one
let shockCooldown = 0;
let shockFlash = 0;

// `r` is how wide the thing being moved is. It defaults to the player, who
// was the only one that ever asked — the aliens walked through walls because
// nothing on their side ever called this.
function hitsWall(x, z, r = PLAYER_RADIUS) {
  // Solid props. Circles, so a rotated wreck blocks its own shape rather than
  // a square patch around it. Checked first — it's a much shorter list.
  for (const c of propColliders) {
    const dx = x - c.x, dz = z - c.z;
    const rr = c.r + r;
    if (dx * dx + dz * dz < rr * rr) return true;
  }
  for (const w of walls) {
    if (w.axis === 'x') {
      // Constant-X wall spanning Z ∈ [min,max]
      if (Math.abs(x - w.pos) < r &&
          z >= w.min - r && z <= w.max + r) return true;
    } else {
      // Constant-Z wall spanning X ∈ [min,max]
      if (Math.abs(z - w.pos) < r &&
          x >= w.min - r && x <= w.max + r) return true;
    }
  }
  return false;
}

/**
 * Somewhere an alien is not allowed to stand.
 *
 * TWO tests, and it needs both. hitsWall() keeps its body from overlapping a
 * wall, but it only looks at where the alien ENDED UP, and a wall is only a
 * band about a metre either side of its plane. Anything that can cross more
 * than that band in a single frame skips over the band entirely and lands in
 * the void beyond, having never once been "inside" a wall.
 *
 * The Floater does exactly that. Its hover doesn't drift — it assigns a
 * position outright, on a circle around where it spawned, so dropping out of
 * a chase snaps it across the room in one frame. That is how they were
 * getting outside the station. The floor test is what catches it: no size of
 * step can land on a cell that was never painted.
 */
/**
 * Keep a moved alien out of the walls.
 *
 * The alien brains steer straight at you and know nothing about the level —
 * the walls live out here, not in the alien modules — so instead of asking
 * each of them to check, we let one move however it likes and then undo the
 * parts of that move that ended up somewhere it shouldn't be. X and Z are
 * undone separately, which is what makes an alien slide along a wall and
 * round a doorway rather than stopping dead against it. Same trick the
 * player uses.
 *
 * The two tests are NOT equally strict, and that distinction is the whole
 * thing:
 *
 *   THE FLOOR is absolute. Every alien spawns on painted floor and there is
 *   no legitimate reason for one to be anywhere else, so it is never allowed
 *   off it — whatever state it is in, however big the step. That is what
 *   stops a teleport (the Floater snapping onto its hover circle) from
 *   skipping clean over a wall without ever being inside it.
 *
 *   THE BODY is advisory. A wide alien stood beside a wall really does
 *   overlap it — a Brute is nearly two metres across — and if we treated
 *   that as "trapped" and waved it through, as a first version of this did,
 *   it would stroll out of the station every time it hugged a corner. So
 *   when it is already touching, we stop asking and let the floor rule hold
 *   it. It can scrape along the wall; it cannot leave the building.
 */
function keepOutOfWalls(pos, prevX, prevZ, r) {
  // Should never happen now, but if something has already put it off the
  // floor, let it move freely rather than freezing it out there forever.
  if (!isFloorAt(prevX, prevZ)) return;

  const alreadyTouching = hitsWall(prevX, prevZ, r);
  const blocked = (x, z) =>
    !isFloorAt(x, z) || (!alreadyTouching && hitsWall(x, z, r));

  if (blocked(pos.x, prevZ)) pos.x = prevX;
  if (blocked(pos.x, pos.z)) pos.z = prevZ;
}
// Is there a clear line between these two points, or is there a wall in it?
//
// Only the Watcher asks. Everything else that shoots at you lobs a slow,
// visible projectile that the projectile loop already flies through the world
// one step at a time. The Watcher's beam arrives the instant it fires and
// takes 15 off you, so it has to be blocked by geometry or ducking behind a
// wall would mean nothing.
const sightRay = new THREE.Raycaster();
function clearShot(from, to) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const dist = dir.length();
  if (dist < 0.001) return true;
  sightRay.set(from, dir.divideScalar(dist));
  sightRay.far = dist;
  return sightRay.intersectObjects(wallMeshes).length === 0;
}

const gun = createGun(camera);
const aliens = spawnAliens(scene);
const boss = BOSS_ENABLED ? spawnBoss(scene) : null;
const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);

let bullets = [];
let flashes = [];
let projectiles = [];
let killCount = 0;
let playerHp = 100;
let isDead = false;

// Has the player actually started playing?
//
// The game loop has always run from the moment the page loads, with the
// title screen simply drawn on top of a station that was already live. You
// could be shot, and killed, while reading the controls — the Watcher in the
// Hangar made that obvious, because it opens fire two seconds after it sees
// you and does not need to walk anywhere first. The same was true on the
// death screen: the fight carried on behind it.
//
// Nothing about a boss or an alien should happen on either screen, so one
// flag decides it, and `worldIsLive()` below is the only thing that asks.
let started = false;
// Whether the world was live last frame, so the moment it stops can be
// noticed exactly once.
let wasLive = false;
let dmgFlashTimer = 0;

// ─── HUD ELEMENTS ──────────────────────────────────────────
const healthBar = document.getElementById('health-bar');
const healthText = document.getElementById('health-text');
const killsEl = document.getElementById('kills');
const roomLabelEl = document.getElementById('room-label');
const dmgFlashEl = document.getElementById('damage-flash');
const deathScreen = document.getElementById('death-screen');
const deathMsgEl = document.getElementById('death-msg');
const playAgainBtn = document.getElementById('play-again');
const quitBtn = document.getElementById('quit-game');
const escapeScreen = document.getElementById('escape-screen');
const escapeTallyEl = document.getElementById('escape-tally');
const escapeAgainBtn = document.getElementById('escape-again');
const escapeQuitBtn = document.getElementById('escape-quit');
const usePromptEl = document.getElementById('use-prompt');
let deathCause = null;
const startOverlay = document.getElementById('start-overlay');

// Boss HUD (added to the page markup)
const bossHudEl = document.getElementById('boss-hud');
const bossNameEl = document.getElementById('boss-name');
const bossBarEl = document.getElementById('boss-bar');
const bossBannerEl = document.getElementById('boss-banner');
const bossBannerLineEl = document.getElementById('boss-banner-line');

/**
 * Is the world running right now?
 *
 * False on the title screen and on the death screen — the two times the
 * player is looking at a menu and cannot do anything about what is pointed
 * at them. Everything that moves, thinks, or takes health off you is behind
 * this: the player, the aliens, the boss, bullets in flight and the station's
 * own hazards. Rendering is NOT, so both screens still show the room rather
 * than a black rectangle.
 */
function worldIsLive() {
  return started && !isDead && !escaped;
}

function updateHUD() {
  healthBar.style.width = playerHp + '%';
  healthBar.style.background = playerHp > 60 ? '#44ff88' : playerHp > 30 ? '#ffaa22' : '#ff2244';
  healthText.textContent = 'HP ' + playerHp;
  healthText.style.color = healthBar.style.background;
  killsEl.textContent = 'KILLS: ' + killCount;
}

function damagePlayer(amount) {
  // Belt and braces: every caller is already behind worldIsLive(), but this
  // is the one function that can actually hurt you, so it checks too.
  if (!worldIsLive()) return;
  playerHp = Math.max(0, playerHp - amount);
  dmgFlashTimer = 0.3;
  dmgFlashEl.style.opacity = '1';
  updateHUD();

  if (playerHp <= 0) {
    isDead = true;
    deathMsgEl.textContent = deathCause || 'The station keeps what it kills.';
    deathCause = null;
    deathScreen.style.display = 'flex';
    // Give the mouse back. It's locked to the canvas while you're playing, so
    // without this there's no cursor to click either button with.
    if (document.pointerLockElement) document.exitPointerLock();
  }
}

// ─── STARTING OVER ──────────────────────────────────────────
// Dying used to drop you back at the airlock with full health two seconds
// later, keeping your kills and leaving the boss however you'd left it. Now
// it's a choice: play again, or quit to the title screen. Both of them begin
// a brand new run, so everything the last one accumulated has to be put back
// by hand. Anything missed here is a bug you only ever see on the second
// playthrough — a tracer still in flight, a boss already dead, last run's
// kill count.

/** Put the world back exactly how a fresh page load finds it. */
function resetRun() {
  // Things in flight. These each hold a mesh or a light in the scene, so they
  // go first — reviving the world around them would leave them hanging there.
  for (const b of bullets) {
    scene.remove(b.mesh);
    b.mesh.geometry.dispose();
    b.mesh.material.dispose();
  }
  bullets.length = 0;
  for (const f of flashes) scene.remove(f.light);
  flashes.length = 0;
  for (const p of projectiles) removeProjectile(p);
  projectiles.length = 0;

  // Aliens. Every one of them, including the ones you killed — this is a new
  // run, and within a run death is permanent, so this is the ONLY thing that
  // ever brings them back. Clearing `gone` is what does it; miss that and a
  // second playthrough starts with holes where your first one's kills were.
  //
  // Rebuilt rather than revived: a death animation hides sub-meshes and moves
  // parts about, so reusing the body gives you a half-rendered alien. A body
  // that has already been taken out of the scene is simply replaced the same
  // way as any other.
  for (const a of aliens) {
    scene.remove(a.model);
    if (!a.gone) disposeModel(a.model);   // already freed when it went

    const model = a.reg.build();
    model.position.copy(a.spawnPos);
    model.userData.baseY = a.reg.baseY;
    a.ai = a.reg.createAI();
    model.userData.ai = a.ai;
    scene.add(model);

    a.model = model;
    a.alive = true;
    a.gone = false;
    a.hp = a.maxHp;
    a.deathTimer = 0;
    a.flashTimer = 0;
    a.attackTimer = a.reg.attackCD * (0.5 + Math.random());
  }

  // The boss, through the real spawn — so a new run rolls the dice again and
  // you aren't handed the same fight twice just because it's what killed you.
  if (boss) {
    scene.remove(boss.model);
    disposeModel(boss.model);
    Object.assign(boss, spawnBoss(scene));
    if (bossHudEl) bossHudEl.style.display = 'none';
    if (bossBannerEl) bossBannerEl.style.display = 'none';
  }

  // The way out is sealed again, and the run is no longer over.
  escaped = false;
  bossBannerTimer = 0;
  escapeScreen.style.display = 'none';
  usePromptEl.style.display = 'none';
  setEscapePodUnlocked(escapePod, false);

  // The player.
  killCount = 0;
  playerHp = 100;
  isDead = false;
  deathCause = null;
  dmgFlashTimer = 0;
  dmgFlashEl.style.opacity = '0';
  shockCooldown = 0;
  shockFlash = 0;
  tentacles.glowMat.color.setHex(0xff9ad8);

  ctrl.position.copy(START_POS);
  ctrl.velocity.set(0, 0, 0);
  ctrl.yaw = Math.PI;
  ctrl.pitch = 0;
  ctrl.onGround = true;
  ctrl.shootRequested = false;
  // As far as the browser is concerned, whatever you were holding when you
  // died is still held — the keyup never came. Without this you spawn already
  // walking, and with the trigger down you'd fire the moment you land.
  for (const k in ctrl.keys) ctrl.keys[k] = false;

  updateHUD();
}

/** Button one: straight back in at the start, from scratch. */
function playAgain() {
  resetRun();
  deathScreen.style.display = 'none';
  // Chrome refuses a lock requested too soon after the last one was released,
  // and we release it on death. If it won't take, the mouse just stays free
  // and clicking the view grabs it — so swallow it rather than let it throw.
  const lock = canvas.requestPointerLock();
  if (lock && lock.catch) lock.catch(() => {});
}

/** Button two: back to the title screen. The run is thrown away either way,
 *  so Click to Play drops you into a clean station rather than the one you
 *  just walked out of. */
function quitToTitle() {
  resetRun();
  started = false;         // back to a station that is standing still
  deathScreen.style.display = 'none';
  startOverlay.style.display = 'flex';
}

/**
 * Out. Called when you press E stood at the open hatch.
 *
 * The run ends the same shape as dying does — the world stops, the mouse
 * comes back, and you get the same two choices — because it is the same
 * thing from the game's point of view: this run is over, pick another.
 */
function escapeStation() {
  if (escaped || !worldIsLive()) return;
  escaped = true;
  usePromptEl.style.display = 'none';
  // In case you got here inside the banner's few seconds — it sits above
  // every other screen, so left up it would be printed across this one.
  bossBannerTimer = 0;
  if (bossBannerEl) bossBannerEl.style.display = 'none';
  escapeTallyEl.textContent =
    killCount === 1 ? '1 of them did not make it off with you.'
                    : killCount + ' of them did not make it off with you.';
  escapeScreen.style.display = 'flex';
  if (document.pointerLockElement) document.exitPointerLock();
}

playAgainBtn.addEventListener('click', playAgain);
quitBtn.addEventListener('click', quitToTitle);
escapeAgainBtn.addEventListener('click', playAgain);
escapeQuitBtn.addEventListener('click', quitToTitle);

// Your hand is on the keyboard already, so take it from there too.
document.addEventListener('keydown', (e) => {
  // E is the only key that does anything while you are actually playing.
  if (e.code === 'KeyE') { tryUsePod(); return; }
  if (!isDead && !escaped) return;
  if (e.code === 'KeyR') playAgain();
  else if (e.code === 'KeyQ') quitToTitle();
});

/** Are you stood at the pod's hatch with it open? */
function atOpenPod() {
  if (!escapePod.group.userData.unlocked) return false;
  const b = escapePod.board;
  return Math.hypot(ctrl.position.x - b.x, ctrl.position.z - b.z) < 2.2;
}

function tryUsePod() {
  if (worldIsLive() && atOpenPod()) escapeStation();
}

// ─── ALIEN ACTIVATION ────────────────────────────────────────
//
// Every alien in the level used to think and animate every frame, in every
// room, whether or not you were anywhere near it. Three.js frustum-culls the
// *drawing* of anything off-screen for free, but it can't skip the AI, and it
// can't tell that a room two doors down is hidden behind a wall — a frustum is
// just a cone, so those aliens were still being drawn.
//
// So: only the room you're standing in runs. Aliens elsewhere keep their state
// (a charging Brute is still charging when you come back) but cost nothing.
//
// The radius is the escape hatch for corridors. A corridor is its own room id,
// so nothing would match there, and without a fallback every alien in the
// level would park the moment you stepped through a doorway — you'd watch them
// blink out. Inside a real room it barely matters, because the room match
// already activates everything in that room regardless of distance.
//
// Measured against the actual spawn plan (24 aliens / 1182 meshes), averaged
// over the random spawn scatter:
//     radius  8 → 2.7 aliens active (9.0x)   risks visible pop-in from corridors
//     radius 12 → 3.1 aliens active (7.8x)   covers the near half of the next room
//     radius 18 → 6.0 aliens active (4.0x)   pulls in whole neighbouring rooms
const ACTIVE_RADIUS = 12;

// The player's room ID. The HUD's getCurrentRoom() returns a *label* and
// deliberately skips corridors (they have none), so it can't be reused here.
function currentRoomId() {
  // Grid lookup, so an irregular room reports correctly instead of matching
  // the empty corner of its bounding box.
  return roomIdAt(ctrl.position.x, ctrl.position.z);
}

// ─── BOSS ────────────────────────────────────────────────────
function playerInRoom(roomId) {
  const b = bounds.find(bb => bb.id === roomId);
  if (!b) return false;
  const p = ctrl.position;
  return p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1;
}

// White hit-flash: tint the matching hit-part meshes bright for a few
// frames after they're shot (the AI leaves a `flashFrames` counter).
function stepBossFlash(group, part) {
  const f = group.userData.flashFrames || 0;
  if (f > 0) {
    group.userData.flashFrames = f - 1;
    group.userData._flashing = true;
    group.traverse((o) => {
      if (o.isMesh && o.material.emissive && o.userData.hitPart === part) {
        o.material.emissive.setScalar(0.7);
      }
    });
  } else if (group.userData._flashing) {
    group.userData._flashing = false;
    group.traverse((o) => {
      if (o.isMesh && o.material.emissive && o.userData.hitPart === part) {
        o.material.emissive.setScalar(0);
      }
    });
  }
}

// Turn one note from a boss brain into something that happens to the player.
// Every boss queues its hits this way instead of reaching for the player
// itself, so there is one place that decides what a boss attack does.
function applyBossAttack(model, atk) {
  switch (atk.type) {
    case 'pilot_throw':
      projectiles.push(createAlienProjectile(
        scene, atk.origin, atk.target, 0x44ff88, 6, atk.damage,
        { model: atk.model, spin: atk.spin }));
      return;

    case 'twin_bolt':
      projectiles.push(createAlienProjectile(
        scene, atk.from, atk.to, 0x66ccff, 9, atk.damage));
      return;

    case 'body_slam': {
      const d = model.userData;
      if (model.position.distanceTo(ctrl.position) <= (d.attackRange || 3) + 1) {
        damagePlayer(atk.damage);
      }
      return;
    }

    // Swings and slams name the spot they landed on. Checking it here, against
    // where the player is NOW, means stepping out of a wind-up gets you clear
    // — the brain decided to swing, but it doesn't decide whether it connects.
    case 'twin_swing':
    case 'burrower_slam': {
      const at = atk.at;
      const reach = Math.hypot(ctrl.position.x - at.x, ctrl.position.z - at.z);
      if (reach <= (atk.range || 2.5)) damagePlayer(atk.damage);
      return;
    }

    // The Swarm's motes fly to you and bite on arrival, so there is nothing
    // left to check by the time it says so.
    default:
      if (atk.damage) damagePlayer(atk.damage);
  }
}

function updateBoss(dt) {
  const d = boss.model.userData;
  const kind = boss.kind;

  // The fight starts when the player steps into the Control Room.
  if (!boss.active && playerInRoom(boss.roomId)) boss.active = true;
  if (!boss.active) return;

  // The boss brains count time in frames, so hand them dt in frames.
  const dtF = Math.min(dt * 60, 3);
  kind.update(boss.model, ctrl.position, dtF, dt, boss.defeated);

  if (!boss.defeated) {
    // Apply whatever the brain queued. Some bosses post one note a frame,
    // others a list; drain both rather than making them agree.
    if (d.currentAttack) { applyBossAttack(boss.model, d.currentAttack);
                           d.currentAttack = null; }
    if (d.attacks && d.attacks.length) {
      for (const atk of d.attacks) applyBossAttack(boss.model, atk);
      d.attacks.length = 0;
    }

    if (kind.dead(d)) {
      boss.defeated = true;
      killCount++;
      updateHUD();
      // Whichever one it was says so — the banner used to claim the Puppet
      // Master had fallen whatever you had actually just killed.
      if (bossBannerLineEl) bossBannerLineEl.textContent = kind.fell;
      if (bossBannerEl) bossBannerEl.style.display = 'flex';
      bossBannerTimer = 4.5;
      // And the way out comes alive. The bolts blow somewhere across the
      // station and the lamp on the pod turns green.
      setEscapePodUnlocked(escapePod, true);
    }
  } else if (d.attacks) {
    // Nothing a dying boss queues should still land on the player.
    d.attacks.length = 0;
    d.currentAttack = null;
  }

  // Hit flashes, for the bosses that have them.
  if (kind.flash) {
    for (const [group, part] of kind.flash(boss.model)) stepBossFlash(group, part);
  }

  // HUD.
  if (bossHudEl) {
    bossHudEl.style.display = 'block';
    const h = kind.hud(d, boss.defeated);
    bossNameEl.textContent = h.label;
    bossBarEl.style.width = Math.max(0, Math.min(100, h.pct)) + '%';
    if (h.colour) bossBarEl.style.background = h.colour;
  }
}

// ─── START ──────────────────────────────────────────────────
startOverlay.addEventListener('click', () => {
  startOverlay.style.display = 'none';
  started = true;          // the station comes alive here, and not before
  canvas.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  ctrl.locked = document.pointerLockElement === canvas;
});

canvas.addEventListener('click', () => {
  // Not while you're dead or sat on the title screen — those are the two
  // times the cursor is the whole point.
  if (isDead || startOverlay.style.display !== 'none') return;
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

  const live = worldIsLive();

  // --- Player ---
  if (live) {
    const prevX = ctrl.position.x, prevZ = ctrl.position.z;

    // Webbing underfoot. The controller reads ctrl.speed fresh every frame,
    // so this is set both ways each frame rather than only on the way in —
    // otherwise you'd leave the web still wading.
    let bogged = false;
    for (const w of floorWebs.zones) {
      if ((ctrl.position.x - w.x) ** 2 + (ctrl.position.z - w.z) ** 2 < w.r * w.r) {
        bogged = true;
        break;
      }
    }
    ctrl.speed = bogged ? WEB_SPEED : WALK_SPEED;

    // Tentacles. The first step onto one shocks you immediately and standing
    // there keeps shocking you; the cooldown resets the moment you're clear,
    // so stepping off and back on costs you a fresh hit rather than letting
    // you wait the timer out with a foot on it.
    let onTentacle = false;
    for (const t of tentacles.zones) {
      if ((ctrl.position.x - t.x) ** 2 + (ctrl.position.z - t.z) ** 2 < t.r * t.r) {
        onTentacle = true;
        break;
      }
    }
    if (!onTentacle) {
      shockCooldown = 0;
    } else {
      shockCooldown -= dt;
      if (shockCooldown <= 0) {
        shockCooldown = SHOCK_INTERVAL;
        shockFlash = 0.14;
        // Only claim the kill if this hit is the one that lands it, or a
        // later death to something else would still read "Electrocuted".
        if (playerHp - SHOCK_DAMAGE <= 0) deathCause = 'Electrocuted';
        damagePlayer(SHOCK_DAMAGE);
      }
    }
    if (shockFlash > 0) {
      shockFlash -= dt;
      tentacles.glowMat.color.setHex(shockFlash > 0 ? 0xffffff : 0xff9ad8);
    }

    updateController(ctrl, dt);

  // ─── VACUUM ─────────────────────────────────────────────
  // The hull breach drags you toward it and kills you at the lip. The pull
  // is routed through hitsWall so it can't shove you through geometry on
  // the way — it only ever moves you into space you could have walked into.
  if (live) {
    for (const h of hazards) {
      if (ctrl.position.x < h.xMin || ctrl.position.x > h.xMax) continue;
      // `side` is +1 when the floor lies at z greater than the breach and -1
      // when it lies at z less, so distance and pull both read the same way
      // whichever wall of the Hangar is open.
      const side = h.side || 1;
      const d = (ctrl.position.z - h.z) * side;
      if (d < 0 || d > h.pull) continue;
      const t = 1 - d / h.pull;
      const nz = ctrl.position.z - side * h.force * t * t * dt;
      if (!hitsWall(ctrl.position.x, nz)) ctrl.position.z = nz;
      if (d < h.kill) {
        deathCause = 'Sucked into space';
        damagePlayer(9999);
      }
    }
  }

  // Keep the player's head under the ceiling. Nothing currently jumps high
  // enough to clip it, but that's a property of today's jumpForce, not a
  // guarantee — clamp it so the ceiling is solid regardless.
  const headroom = ceilingY - 0.25;
  if (ctrl.position.y > headroom) {
    ctrl.position.y = headroom;
    if (ctrl.velocity.y > 0) ctrl.velocity.y = 0;
  }

    // Wall collision — resolve X and Z independently so the player
    // slides along walls instead of sticking, and doorways stay open.
    const pos = ctrl.position;
    if (hitsWall(pos.x, prevZ)) pos.x = prevX;
    if (hitsWall(pos.x, pos.z)) pos.z = prevZ;
    camera.position.copy(pos);
  }
  updateGun(gun, dt);

  // Let the banner have its moment and then get out of the way.
  if (bossBannerTimer > 0) {
    bossBannerTimer -= dt;
    if (bossBannerTimer <= 0 && bossBannerEl) bossBannerEl.style.display = 'none';
  }

  // --- The escape pod ---
  // Its hatch and lamp animate even on the menus: the lamp is scenery, and a
  // door caught halfway open behind the death screen would look broken. The
  // PROMPT is not scenery though — it only belongs on screen while you are
  // actually stood there able to press the key.
  updateEscapePod(escapePod, dt, time);
  const canLaunch = live && atOpenPod();
  const promptWanted = canLaunch ? 'block' : 'none';
  if (usePromptEl.style.display !== promptWanted) {
    usePromptEl.style.display = promptWanted;
  }

  // --- Damage flash decay ---
  if (dmgFlashTimer > 0) {
    dmgFlashTimer -= dt;
    dmgFlashEl.style.opacity = String(Math.max(0, dmgFlashTimer / 0.3));
  }

  // --- Shooting ---
  if (ctrl.shootRequested) {
    ctrl.shootRequested = false;
    if (live) {
      gun.recoilTime = 0.08;
      raycaster.setFromCamera(screenCenter, camera);

      // Parked aliens are hidden, and r128's raycaster does NOT skip invisible
      // meshes — without the visible check they'd still soak bullets from
      // across the level. (The boss code below already guards this way.)
      const hitMeshes = [];
      aliens.forEach((a) => {
        if (!a.gone && a.alive && a.model.visible) {
          a.model.traverse((c) => { if (c.isMesh && c.visible) hitMeshes.push(c); });
        }
      });
      // Boss meshes. Some bosses keep part of themselves outside their own
      // group — the Puppet Master's pilot ejects into the scene — so each
      // kind names any extra groups that still have to be shootable.
      if (boss && boss.active && !boss.defeated) {
        const push = (o) => { if (o.isMesh && o.visible) hitMeshes.push(o); };
        boss.model.traverse(push);
        for (const extra of (boss.kind.targets ? boss.kind.targets(boss.model) : [])) {
          if (extra) extra.traverse(push);
        }
      }
      // Walls too, so a shot stops at the nearest surface — it can't punch
      // through a wall (which used to hide the tracer) or hit an enemy behind one.
      for (const wm of wallMeshes) hitMeshes.push(wm);

      const hits = raycaster.intersectObjects(hitMeshes);
      const from = camera.position.clone().add(
        new THREE.Vector3(0.15, -0.1, -0.3).applyQuaternion(camera.quaternion)
      );
      let to;

      if (hits.length > 0) {
        to = hits[0].point;
        const hitObj = hits[0].object;

        if (hitObj.userData.isWall) {
          // Shot blocked by a wall — no damage, tracer stops here.
        } else if (boss && boss.active && !boss.defeated && hitObj.userData.hitPart) {
          // Boss hit — its meshes carry a hitPart tag saying which bit of it
          // was shot. hits[0].point is the exact impact, so blood comes out
          // of the hole rather than the middle of whatever was hit.
          boss.kind.hit(boss.model, hitObj.userData.hitPart, hits[0].point,
                        boss.kind.bullet);
        } else {
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
        }
      } else {
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        to = from.clone().add(dir.multiplyScalar(30));
      }

      // Fire a visible tracer bolt from the muzzle to the impact point.
      bullets.push(createBullet(scene, from, to));
      flashes.push(createFlash(scene, from));
    }
  }

  // --- Update aliens ---
  // Resolved once per frame rather than per alien — it's a scan over every
  // room's bounds.
  const playerRoom = currentRoomId();

  aliens.forEach((a) => {
    // Dead for good. Nothing left to do with it — no body, no brain, and
    // nothing to shoot. See below for why it stays in the list.
    if (a.gone) return;

    if (!a.alive) {
      // Corpses wait with everyone else — their clear-up clock should not
      // run down behind a menu.
      if (!live) return;
      a.deathTimer += dt;
      // Let the AI module handle the death animation
      a.reg.updateAI(a.model, a.ai, ctrl.position, dt);
      // Remove after 5 seconds
      if (a.deathTimer > 5) {
        a.model.visible = false;
      }
      // And after 8, it is gone — the body comes out of the scene and its
      // geometry is freed. It does NOT come back: clearing a room is meant
      // to stay cleared, so what you killed stays killed for the rest of the
      // run. Starting a new run rebuilds the lot (see resetRun).
      //
      // The entry stays in `aliens` rather than being spliced out, because
      // resetRun needs the spawn point, the type and the registry to put this
      // one back when you play again. `gone` is what makes it inert.
      if (a.deathTimer > 8) {
        scene.remove(a.model);
        disposeModel(a.model);
        a.gone = true;
      }
      return;
    }

    // Park anything outside the player's room. Dead aliens are deliberately
    // left out of this (they return above) — their clear-up timer has to keep
    // running or a corpse in another room would never clear.
    const dist = a.model.position.distanceTo(ctrl.position);
    const active = a.room === playerRoom || dist < ACTIVE_RADIUS;
    if (a.model.visible !== active) a.model.visible = active;

    // Deciding what is VISIBLE happens even while the world is frozen, and
    // has to: the parking above is the only thing that hides the aliens in
    // other rooms, and freezing before it ran left all twenty-two of them
    // drawn at once — so the title screen showed creatures through the walls
    // from three rooms away. Thinking stops here; being invisible does not.
    if (!live) return;
    if (!active) return;

    // Flash timer
    if (a.flashTimer > 0) a.flashTimer -= dt;

    // Where it stood before it got a say, so the walls can put it back.
    const wasX = a.model.position.x, wasZ = a.model.position.z;

    // Hand the Watcher its line of sight before it thinks. The walls belong
    // to the level, not to the alien module, so the test has to happen here.
    if (a.reg.needsSight) {
      const eye = a.model.position.clone();
      eye.y += WATCHER_EYE_Y;
      const chest = ctrl.position.clone();
      chest.y -= WATCHER_AIM_DROP;
      a.model.userData.hasSight = clearShot(eye, chest);
    }

    // Run AI. Some aliens report an attack landing as a returned event.
    const aiEvent = a.reg.updateAI(a.model, a.ai, ctrl.position, dt);

    // ...and then take back any of that movement that went through a wall.
    // Dead ones are left alone — their collapse is an animation, and a body
    // slumping half into a wall beats one that twitches as it falls.
    if (a.alive) keepOutOfWalls(a.model.position, wasX, wasZ, a.reg.bodyRadius || 0.6);

    // Idle animation — the same walk cycles / pulses / throbs shown in
    // the Alien Workshop. Only played during locomotion/idle states so
    // it doesn't overwrite the AI's action poses (pounce, charge, slam,
    // aim, etc.). This is what makes the aliens look alive in-game.
    if (a.reg.idleStates.includes(a.ai.state)) {
      a.reg.animate(a.model, time);
    }

    // Aliens that time their own attacks (the Brute's slam) damage you on the
    // frame their animation connects, and skip the generic timer entirely —
    // running both would let it hit you mid-charge, mid-stumble, or while
    // standing still, which is exactly what made the dodge pointless.
    if (a.reg.attackViaAI) {
      if (aiEvent && (aiEvent.type === 'ground_slam' || aiEvent.type === 'eye_beam'))
        damagePlayer(a.reg.attackDmg);
      return;
    }

    // Simple attack logic on top of AI (dist computed above)
    a.attackTimer -= dt;

    if (a.attackTimer <= 0 && dist < a.reg.attackRange * 1.2 && dist < 20) {
      a.attackTimer = a.reg.attackCD;
      if (a.reg.attackType === 'melee' && dist < a.reg.attackRange) {
        damagePlayer(a.reg.attackDmg);
      } else if (a.reg.attackType === 'ranged' && dist >= 3) {
        const from = a.model.position.clone();
        from.y += 0.5;   // out of the body rather than out of its feet
        const to = ctrl.position.clone(); to.y = 1.2;
        projectiles.push(createAlienProjectile(
          scene, from, to, a.reg.projColor, a.reg.projSpeed, a.reg.attackDmg
        ));
      }
    }
  });

  // Freezing can leave a visual stuck on. The Watcher's beam is drawn by its
  // AI, so stopping the AI mid-shot doesn't end the shot — it just stops
  // anyone updating it, and the beam stays lit and pointed at you for as long
  // as the menu is up. So on the one frame the world stops, anything holding
  // something like that is told to put it away.
  if (wasLive && !live) {
    for (const a of aliens) if (a.reg.rest) a.reg.rest(a.model);
  }
  wasLive = live;

  // --- Update boss ---
  if (live && boss) updateBoss(dt);

  // --- Update projectiles ---
  // Frozen with everything else. A bolt already in the air when you died
  // should not still be travelling toward you while you decide whether to
  // play again — and it certainly should not land when you do.
  if (live) projectiles = projectiles.filter((p) => {
    p.life -= dt;
    if (p.life <= 0) { removeProjectile(p); return false; }
    p.mesh.position.addScaledVector(p.dir, p.speed * dt);
    if (p.spin) {
      p.mesh.rotation.x += p.spin.x * dt;
      p.mesh.rotation.y += p.spin.y * dt;
      p.mesh.rotation.z += p.spin.z * dt;
    }
    // Hit player?
    if (p.mesh.position.distanceTo(ctrl.position) < 0.6) {
      damagePlayer(p.damage != null ? p.damage : 10);
      removeProjectile(p);
      return false;
    }
    // Hit wall?
    const pp = p.mesh.position;
    if (pp.y < 0 || pp.y > 4) { removeProjectile(p); return false; }
    return true;
  });

  // --- Fly tracer rounds toward their impact point ---
  bullets = bullets.filter((b) => {
    b.life -= dt;
    const step = b.speed * dt;
    b.traveled += step;
    b.mesh.position.addScaledVector(b.dir, step);
    const arrived = b.traveled >= b.maxDist;
    if (arrived || b.life <= 0) {
      // A little spark of light where it hits.
      if (arrived) flashes.push(createFlash(scene, b.mesh.position.clone()));
      scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      b.mesh.material.dispose();
      return false;
    }
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
    const rm = placeNameAt(ctrl.position.x, ctrl.position.z);
    if (rm) roomLabelEl.textContent = rm;
  }

  // --- Render ---
  renderer.render(scene, camera);
}

// A way into the running game from the console, for checking a boss fight
// without playing through to the Control Room every time. Localhost only —
// the deployed game exposes nothing.
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  window.__game = {
    boss, ctrl, scene, BOSS_KINDS, aliens,
    get hp() { return playerHp; },
    get kills() { return killCount; },
    get dead() { return isDead; },
    get bullets() { return bullets.length; },
    get shots() { return projectiles.length; },
    /** Die on demand, so the death screen can be checked without a fight. */
    kill() { damagePlayer(9999); },
    /** The level's own collision test, for checking placements from here. */
    hitsWall, isFloorAt,
    /** Drop the player into the arena so the fight starts. */
    toBoss() {
      const at = roomSpawn(BOSS_ROOM);
      if (at) ctrl.position.set(at.x, ctrl.position.y, at.z);
    },
    /** Replace the waiting boss with a named one, through the real spawn. */
    respawn(id) {
      scene.remove(boss.model);
      const next = spawnBoss(scene, id);
      Object.assign(boss, next);
      if (bossBannerEl) bossBannerEl.style.display = 'none';
      return boss.kind.id;
    },
  };
}

// Draw the HUD once before the first frame. It used to be set only by the
// first thing that hurt you, which worked solely because the station was
// already live behind the title screen — so with that stopped, the health
// bar sat at whatever width the stylesheet gave it until you took a hit.
updateHUD();

// Start the loop
requestAnimationFrame(gameLoop);
