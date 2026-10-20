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
import { PALETTE, getMaterial } from './shared/materials.js?v=a527ec0e62';

// === Alien modules ===
import { buildCrawler, animateCrawler, createCrawlerAI, updateCrawlerAI, hitCrawler, killCrawler } from './aliens/crawler.js?v=a527ec0e62';
import { buildFloater, animateFloater, createFloaterAI, updateFloaterAI, hitFloater, killFloater } from './aliens/floater.js?v=a527ec0e62';
import { buildWatcher, animateWatcher, createWatcherAI, updateWatcherAI, hitWatcher, killWatcher, restWatcher,
         EYE_HEIGHT as WATCHER_EYE_Y, CHEST_DROP as WATCHER_AIM_DROP } from './aliens/watcher.js?v=a527ec0e62';
import { buildBrute, animateBrute, createBruteAI, updateBruteAI, hitBrute, killBrute } from './aliens/brute.js?v=a527ec0e62';

// === The ending ===
import { createDescent } from './cutscene/descent.js?v=a527ec0e62';
import { createArrival } from './cutscene/arrival.js?v=a527ec0e62';

// === Sound ===
import { startAudio, playSound, startLoop, stopLoop, stopAllLoops,
         setLoopGain, loadSavedSound } from './audio/sound.js?v=a527ec0e62';
import { masterVolume } from './audio/sound.js?v=a527ec0e62';
import { say, hush, castList } from './audio/speech.js?v=a527ec0e62';
import { toggleSoundboard, closeSoundboard, soundboardOpen } from './audio/mixer.js?v=a527ec0e62';

// === Player ===
import { createController, updateController } from './player/controller.js?v=a527ec0e62';
import { CLASSES, WEAPONS, classById, winsSoFar, recordWin,
         commanderUnlocked, unlockState, classLocked, lockReason,
         unlockedWeapons, allowedCommanderWeapon, recordBeaten, recordSecret,
         DIFFICULTIES, difficultyById, savedDifficulty, saveDifficulty }
  from './player/classes.js?v=a527ec0e62';

// === The one on your side ===
import { buildSoldier } from './npc/soldier.js?v=a527ec0e62';
import { initSoldier, updateSoldier, releaseSoldier, hurtSoldier,
         soldierIsFree, soldierIsDown, soldierHealth, soldierCanBeBitten,
         FX as SOLDIER_FX } from './npc/soldier_ai.js?v=a527ec0e62';

// === Boss ===
import { createPuppetMaster } from './bosses/puppet_master.js?v=a527ec0e62';
import { createSwarm } from './bosses/swarm.js?v=a527ec0e62';
import { initSwarm, updateSwarm, damageSwarm } from './bosses/swarm_ai.js?v=a527ec0e62';
import { createTwins } from './bosses/twins.js?v=a527ec0e62';
import { initTwins, updateTwins, damageTwin } from './bosses/twins_ai.js?v=a527ec0e62';
import { createBurrower } from './bosses/burrower.js?v=a527ec0e62';
import { initBurrower, updateBurrower, damageBurrower,
         setBurrowerArena } from './bosses/burrower_ai.js?v=a527ec0e62';
import { initPuppetMaster, updatePuppetMaster, damagePuppetMaster,
         stepPuppetMasterFx, setPuppetArena } from './bosses/puppet_master_ai.js?v=a527ec0e62';

// === Map ===
// The level now comes from the grid you paint in the Map Editor, baked into
// grid_data.js by build.sh. layout.js / builder.js are the old hand-written
// rooms and are no longer used by v2.
import { cleanName, savedName, saveName } from './player/name.js?v=a527ec0e62';
import { startPresence } from './shared/presence.js?v=a527ec0e62';
import { buildGridMap, roomIdAt, placeNameAt, roomSpawn, randomCellIn, isFloorAt, ROOMS }
  from './map/grid_map.js?v=a527ec0e62';
import { buildHangarProps, buildCeilingWebs, buildFloorWebs,
         buildFloorTentacles, buildLaserScars,
         buildWatcherDebris, buildOutpostWreckage,
         buildHumanDebris, buildPrison, buildArmory,
         buildAlienBoard, buildAlienPods, buildWorkstations, prisonBrokenCell,
         buildEscapePod, setEscapePodUnlocked, updateEscapePod,
         buildLockedDoor, setLockedDoorOpen, updateLockedDoor, buildSecretRoom,
         buildSpaceDoor, setSpaceDoorOpen, updateSpaceDoor, hangPictures,
         addAftermath,
         buildStudyScreen, buildControlRoom } from './map/props.js?v=a527ec0e62';

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
    stepSound: 'crawler-step', stepEvery: 0.55,
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
    stepSound: 'brute-step', stepEvery: 1.5,      // long stride, heavy
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
  // Outpost 3. Capped below what the difficulty would otherwise give it:
  // a Watcher never moves and its beam lands the frame it fires, so there is
  // no closing the distance on eight of them and nothing to dodge once they
  // all have you. Six is as many as the room can hold and still be a fight.
  { room: 'room2', type: 'watcher', count: 4, cap: 6 },
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
/**
 * The thing in your hands, built from whichever weapon your class carries.
 *
 * It can be swapped while the title screen is up — picking a class rebuilds
 * it — so the old one has to come off the camera and give its geometry back
 * rather than being left parented and invisible.
 */
function createGun(camera, weaponId) {
  const w = WEAPONS[weaponId] || WEAPONS.assault;
  const g = w.build();
  g.position.set(0.25, -0.2, -0.4);
  camera.add(g);
  // The minigun builds its six barrels on a named group so they can turn.
  // Nothing else has one, and getObjectByName returns undefined for those.
  return { group: g, recoilTime: 0, weapon: w, id: weaponId,
           barrels: w.spins ? g.getObjectByName('barrels') : null,
           spin: 0 };
}

// What you say when you are hit. One at random, so taking fire sounds like
// a person rather than a doorbell.
const HURT_SOUNDS = ['hurt-oof', 'hurt-argh', 'hurt-ah'];

// Each boss has its own voice, and two of them explode rather than scream.
// Named by the boss's own id so adding a fifth boss is one line in each.
const BOSS_HIT_SOUND = {
  burrower: 'boss-hit-burrower', twins: 'boss-hit-twins',
  puppet_master: 'boss-hit-puppet_master', swarm: 'boss-hit-swarm',
};
const BOSS_DEATH_SOUND = {
  burrower: 'boss-explode', twins: 'boss-explode',
  puppet_master: 'boss-scream', swarm: 'boss-scream',
};

const GUN_SOUND = {
  assault: 'gun-assault', rifle: 'gun-assault', sniper: 'gun-sniper',
  smg: 'gun-smg', pistol: 'gun-pistol', minigun: 'gun-minigun',
  rpg: 'rpg-launch',
};

function swapGun(weaponId) {
  if (gun && gun.group) {
    camera.remove(gun.group);
    gun.group.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
  }
  gun = createGun(camera, weaponId);
}

function updateGun(gun, dt) {
  // Barrels wind up while you are firing and coast back down when you stop,
  // rather than snapping between still and spinning. `recoilTime` is already
  // the "a round just left this thing" signal, so it drives the wind-up too.
  if (gun.barrels) {
    const target = gun.recoilTime > 0 ? 26 : 0;
    gun.spin += (target - gun.spin) * Math.min(1, dt * 6);
    gun.barrels.rotation.z += gun.spin * dt;
  }
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
    hp: enemyHp(reg.hp), maxHp: enemyHp(reg.hp),
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

    // The outposts, and only the outposts, get more bodies on the hardest
    // setting. The pair in the torn-open prison cell, the Brute in the armory
    // and the two in the pods are each placed because of what happened in
    // that room; doubling them would turn a scene into a crowd and cost the
    // room the thing it was saying.
    const count = OUTPOSTS.includes(plan.room)
      ? Math.min(Math.round(plan.count * difficulty.swarm),
                 plan.cap != null ? plan.cap : Infinity)
      : plan.count;

    for (let i = 0; i < count; i++) {
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
    // Body and pilot keep separate health, so a blast that reaches both
    // is worth something to both.
    blastParts: true,
    // The pilot can eject out of the boss group, so it is raycast separately
    // or it stops being shootable the moment it bails.
    targets: (model) => [model.userData.pilotGroup],
    // What a rocket is allowed to go off against. The wreck is struck off
    // the list the moment the body dies: it cannot take a blast any more,
    // and while it was still solid every rocket burst on the corpse the
    // pilot had just climbed out of — which left the RPG with no way of
    // finishing this fight at all.
    solid(model) {
      const d = model.userData;
      const out = [];
      if (d.bodyHp > 0) out.push({ at: model.position, r: 2.2 });
      if (d.pilotGroup) {
        out.push({ at: d.pilotGroup.getWorldPosition(new THREE.Vector3()),
                   r: 1.2 });          // it is a small thing
      }
      return out;
    },
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
    // And they are two separate creatures with two separate healths, so a
    // blast caught between them hurts both.
    blastParts: true,
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
// In the Control Room, nose pointed at the launch door in its north wall.
//
// It used to stand in the Hangar beside the hull breach, and that was a
// mistake you found by playing it: the breach drags you toward it from six
// units away and kills you at the lip, so walking back across that end of
// the Hangar after winning kept killing people on the way to the exit. The
// Control Room has no breach in it at all. You kill the boss, the door
// behind him opens, and the pod is right there.
const CONTROL_ROOM = ROOMS.find((r) => r.id === 'room9');
const spaceDoor = buildSpaceDoor(scene, {
  x0: 38, x1: 48, z: CONTROL_ROOM.z0, side: 1,
});
walls.push(spaceDoor.wall);

// Turned a quarter so its nose faces the door and its hatch faces back into
// the room, which is the side you come from.
const escapePod = buildEscapePod(scene, { x: 43, z: 0, rot: Math.PI / 2 });
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

// ─── WHAT OPENS IT ──────────────────────────────────────────
// Clear every outpost. Not every alien in the station — the pair in the
// prison, the Brute in the armory, the Floaters in the pod room and the
// Watcher in the Hangar are all somebody else's problem. These four rooms
// are the job.
const OUTPOSTS = ['room4', 'room3', 'room2', 'room7'];   // outposts 1 to 4
let outpostsClear = 0;
let doorOpened = false;

const armory = buildArmory(scene, ROOMS.find((r) => r.id === 'room5'));
propColliders.push(...armory.colliders);

// The board the aliens planned the helicopter ambush on, left up in the
// armory. East wall, south of the lockers — the room's longest clear run.
// rotY turns the board's face (+Z) to point back into the room, at -X.
const ALIEN_BOARD = { x: 3.88, y: 1.85, z: -24.5, rotY: -Math.PI / 2 };
buildAlienBoard(scene, ALIEN_BOARD);

// ─── THE ROOM BEHIND THE BOARD ──────────────────────────────
// Built a long way from the station, because it is not part of it: the floor
// out here is baked from the painted grid and this room is deliberately not
// in it, so it brings its own floor, walls and light. Nothing can wander in.
// The only way through is the jump, below.
const secretRoom = buildSecretRoom(scene, { x: 160, z: -60 });
walls.push(...secretRoom.walls);
propColliders.push(...secretRoom.colliders);

// ─── PHOTOGRAPHS ────────────────────────────────────────────
// The people who were here, on the walls of every room. Each room gets the
// pictures that suit it — drill in the outposts, the mess in the prison
// block, the squad in the Hangar — and the spots are found by walking the
// room's own floor for edges where it stops, because the rooms are painted
// cell by cell and their bounding boxes are a poor guide to where the walls
// actually are.
//
// `avoid` keeps them off the walls that are already something: the Control
// Room's window and its launch door, the armory's attack board, the pods
// room's study screen.
const PICTURE_PLAN = [
  ['room1', ['squad', 'station', 'fighting', 'eating'], []],
  ['room2', ['training', 'fighting'], []],
  ['room3', ['pressups', 'squad'], []],
  ['room4', ['fighting', 'training'], []],
  ['room5', ['squad', 'pressups', 'fighting'],          // armory
    [{ x: 3.88, z: -24.5, r: 4.0 }]],                   // the attack board
  ['room6', ['eating', 'squad'], []],                   // prison block
  ['room7', ['training', 'station'], []],
  ['room8', ['console', 'squad'],                       // alien pods
    [{ x: -12, z: -12, r: 6.0 }]],                      // the study screen wall
  ['room9', ['console', 'squad', 'station'],            // control room
    [{ x: 56, z: 8, r: 16.0 },                          // the window + desk
     { x: 43, z: -4, r: 9.0 }]],                        // the launch door
];
for (const [id, kinds, avoid] of PICTURE_PLAN) {
  const rm = ROOMS.find((r) => r.id === id);
  if (rm) hangPictures(scene, rm, kinds, { avoid, seed: 3300 + id.length * 7 });
}

// ─── WHAT HAPPENED HERE ─────────────────────────────────────
// Drag marks, handprints up the walls, claw gouges, dropped kit and floor
// plates lifted out. Weighted per room by what went on in it: the prison and
// the pods room are where people were taken, the outposts are where the
// aliens live, and the armory and Control Room are where somebody was still
// trying to work when it reached them.
//
// Same avoid lists as the photographs, plus the floor-level things each room
// already has — you do not want a toolbox inside a specimen tank.
const AFTERMATH_PLAN = [
  ['room1', { drags: 2, hands: 1, claws: 1, kit: 2, panel: 1 },           // Hangar
    [], [{ x: 10, z: 33, r: 9 }, { x: 42, z: 53.5, r: 7 },                // crash site, fuel tank
         { x: 28, z: 51, r: 5 }]],
  ['room2', { drags: 1, hands: 1, claws: 2, kit: 1 }, [], []],            // Outpost 3
  ['room3', { drags: 1, claws: 2, kit: 1 }, [], []],                      // outpost 2
  ['room4', { drags: 2, hands: 1, claws: 2 }, [], []],                    // outpost 1
  ['room5', { drags: 1, claws: 1, kit: 2, panel: 1 },                     // armory
    [{ x: 3.88, z: -24.5, r: 4 }], []],
  ['room6', { drags: 2, hands: 2, claws: 2 }, [], []],                    // prison
  ['room7', { drags: 1, claws: 2, kit: 1 }, [], []],                      // outpost 4
  ['room8', { drags: 2, hands: 1, claws: 1 },                             // alien pods
    [{ x: -12, z: -12, r: 6 }],
    [{ x: -14.5, z: -11.5, r: 3.4 }, { x: -17, z: -15, r: 4.5 }]],        // broken pod, tanks
  ['room9', { hands: 1, claws: 1, kit: 1, panel: 2 },                     // Control Room
    [{ x: 56, z: 8, r: 16 }, { x: 43, z: -4, r: 9 }],
    [{ x: 43, z: 0, r: 4 }, { x: 55, z: 8, r: 3 }]],                      // the pod, the desk
];
for (const [id, want, avoid, floorAvoid] of AFTERMATH_PLAN) {
  const rm = ROOMS.find((r) => r.id === id);
  if (!rm) continue;
  const a = addAftermath(scene, rm, want, { avoid, floorAvoid,
                                            solid: propColliders,
                                            seed: 4100 + id.length * 13 });
  propColliders.push(...a.colliders);
}

// ─── THE SOLDIER ────────────────────────────────────────────
// Tied up against the back wall of the hidden room, which is the only reason
// the room is worth finding.
const soldier = buildSoldier();
scene.add(soldier);
// Against the far wall, clear of the crates — he was standing inside one,
// and since everything that moves asks the level whether it may stand
// somewhere, a man inside a crate cannot take a single step.
const SOLDIER_SPOT = { x: secretRoom.bounds.x0 + 2.6,
                       z: secretRoom.bounds.z1 - 1.6,
                       rot: 2.1 };
initSoldier(soldier, SOLDIER_SPOT);
let soldierFreedAnnounced = false;

// Where you were stood when you went through, so leaving puts you back.
let cameFrom = null;

/** Inside the hidden room? Used for the HUD name and for the way out. */
function inSecretRoom() {
  const b = secretRoom.bounds;
  return ctrl.position.x > b.x0 && ctrl.position.x < b.x1 &&
         ctrl.position.z > b.z0 && ctrl.position.z < b.z1;
}

/**
 * Jumping into the attack board.
 *
 * The board is flat on the armory's east wall, so this is the patch of air
 * in front of it. You have to be OFF THE FLOOR — walking into it does
 * nothing, which is what keeps it a secret rather than a door you find by
 * brushing past. The height is reachable: a standing jump peaks about 1.2
 * above eye level and the gate is 0.4 above that floor.
 */
function atBoardJump() {
  return ctrl.position.x > 3.2 &&
         Math.abs(ctrl.position.z - ALIEN_BOARD.z) < 2.2 &&
         ctrl.position.y > 2.0;
}

function enterSecretRoom() {
  cameFrom = { x: 2.4, z: ALIEN_BOARD.z };
  ctrl.position.set(secretRoom.arrive.x, 1.6, secretRoom.arrive.z);
  ctrl.velocity.set(0, 0, 0);
  ctrl.yaw = Math.PI / 2;          // facing back down the room
  ctrl.pitch = 0;
  bringSoldier(secretRoom.arrive.x, secretRoom.arrive.z);

  // Finding it once is enough — the RPG is yours from here on, on every
  // run and every difficulty, whether or not you get off the station this
  // time. It is the only class you unlock by looking rather than winning.
  recordSecret();
  if (!rpgAnnounced) {
    rpgAnnounced = true;
    playSound('unlock');
    announce('RPG UNLOCKED', 'It will be on the board when you next pick a class.');
  }

  // And the stash, which is good for this run only. Offered once: come back
  // in later and the choice you already made still stands.
  if (!perkOffered) {
    perkOffered = true;
    perkPromptEl.style.display = 'block';
  }
}

// Shown once per page, not once per run — it is news the first time and
// clutter every time after.
let rpgAnnounced = false;

/**
 * Taking one of the two off the shelf.
 *
 * Three grenades, or wounds that close on their own for the rest of the
 * run. You cannot have both, and you cannot change your mind: the other one
 * is gone the moment you touch either.
 */
function takePerk(which) {
  if (runPerk) return;
  runPerk = which;
  playSound('pickup');
  if (which === 'grenade') {
    grenadesLeft = 3;
    announce('THREE GRENADES', 'G throws one.');
  } else {
    announce('FIELD KIT', 'Two health a second, for as long as you last.');
  }
  perkPromptEl.style.display = 'none';
  updateHUD();
}

function leaveSecretRoom() {
  const back = cameFrom || { x: 2.4, z: ALIEN_BOARD.z };
  ctrl.position.set(back.x, 1.6, back.z);
  ctrl.velocity.set(0, 0, 0);
  ctrl.yaw = -Math.PI / 2;         // looking at the board you came through
  ctrl.pitch = 0;
  bringSoldier(back.x, back.z);
}

/**
 * He comes through with you.
 *
 * He walks toward you and nothing else, so without this he would set off
 * across a hundred and fifty units of nothing trying to reach the armory,
 * and you would never see him again. Teleporting is the honest answer: you
 * both went through the board, and he was stood next to you when you did.
 */
function bringSoldier(x, z) {
  if (!soldierIsFree(soldier) || soldierIsDown(soldier)) return;
  // A step behind and to one side, rather than inside you.
  const a = ctrl.yaw + Math.PI;
  soldier.position.set(x + Math.sin(a) * 1.4, 0, z + Math.cos(a) * 1.4);
  soldier.rotation.y = ctrl.yaw;
}

/** Stood at the hatch, ready to leave. */
function atSecretExit() {
  if (!inSecretRoom()) return false;
  return Math.hypot(ctrl.position.x - secretRoom.exit.x,
                    ctrl.position.z - secretRoom.exit.z) < 1.6;
}

// Outpost 4 — crates smashed open, their contents across the floor, and the
// plate a Brute shed in the fight. Its crates block you like the Hangar's do.
const wreckage = buildOutpostWreckage(scene, ROOMS.find((r) => r.id === 'room7'));
propColliders.push(...wreckage.colliders);

// The pods room, which is now four walls doing four different jobs: the
// tanks along the north, the station's own summary screen on the east with
// the chair nobody is in, the four desks that watched them on the south,
// and the one that didn't hold standing in the middle of all of it.
const pods = buildAlienPods(scene, ROOMS.find((r) => r.id === 'room8'));
propColliders.push(...pods.colliders);

// The terminal the station kept its notes on them on, facing the tanks from
// the far wall.
const study = buildStudyScreen(scene, ROOMS.find((r) => r.id === 'room8'));
propColliders.push(...study.colliders);

// One desk per tank, each with that specimen's own readout still up.
const stations = buildWorkstations(scene, ROOMS.find((r) => r.id === 'room8'));
propColliders.push(...stations.colliders);

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

// Ankle height. Anything this low is floor junk you walk over without
// thinking about it, and a spilled ammo box that stops a two-hundred-kilo
// Brute dead is the kind of thing that makes a room feel broken.
const STEP_OVER = 0.42;

/**
 * `r` is how wide the thing being moved is. It defaults to the player, who
 * was the only one that ever asked — the aliens walked through walls because
 * nothing on their side ever called this.
 *
 * `feet` is how high off the floor whoever is moving currently is. Pass it
 * and prop colliders start caring about their own height: anything shorter
 * than STEP_OVER never blocks at all, and anything you are already above you
 * pass straight over. Leave it out and every collider is as solid as it ever
 * was, from the floor to the sky — which is what the spawn checks, the
 * grenades and the rockets all still want.
 *
 * A collider with no `h` is infinitely tall whoever is asking. Height is
 * opt-in, so nothing that was solid yesterday stopped being solid today.
 */
function hitsWall(x, z, r = PLAYER_RADIUS, feet = null) {
  // Solid props. Circles, so a rotated wreck blocks its own shape rather than
  // a square patch around it. Checked first — it's a much shorter list.
  for (const c of propColliders) {
    const dx = x - c.x, dz = z - c.z;
    const rr = c.r + r;
    if (dx * dx + dz * dz >= rr * rr) continue;
    if (feet !== null && c.h != null) {
      if (c.h <= STEP_OVER) continue;          // stepped over
      if (feet >= c.h - 0.06) continue;        // jumped over, or stood on
    }
    return true;
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
 * The top of the tallest thing you are stood over, or 0 for bare floor.
 *
 * Without this, clearing a crate lands you INSIDE it: the jump carries you
 * over because your feet are above its top, then gravity puts them back
 * below it and every direction you try to move is blocked, including the
 * one you came from. With it, you land on the lid.
 */
function propTopAt(x, z, r = PLAYER_RADIUS) {
  let top = 0;
  for (const c of propColliders) {
    if (c.h == null || c.h <= STEP_OVER || c.h <= top) continue;
    const dx = x - c.x, dz = z - c.z;
    // EXACTLY the blocking radius, and that matters. Any smaller and there
    // is a ring where you are too close to walk but not close enough to be
    // lifted — land in it and every direction you try is blocked, including
    // back the way you came, and you are stuck there for good.
    const rr = c.r + r;
    if (dx * dx + dz * dz < rr * rr) top = c.h;
  }
  return top;
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

  // feet 0: on the floor, so ankle-high junk is stepped over and anything
  // taller still stops them.
  const alreadyTouching = hitsWall(prevX, prevZ, r, 0);
  const blocked = (x, z) =>
    !isFloorAt(x, z) || (!alreadyTouching && hitsWall(x, z, r, 0));

  if (blocked(pos.x, prevZ)) pos.x = prevX;
  if (blocked(pos.x, pos.z)) pos.z = prevZ;
}
// Is there a clear line between these two points, or is there a wall in it?
//
// The Watcher's beam arrives the instant it fires and takes 15 off you, so it
// has to be blocked by geometry or ducking behind a wall would mean nothing.
// Alien projectiles ask the same question of each step they take: this used
// to say they didn't need to, which was wrong — the projectile loop tested
// only the floor and the ceiling, so every Floater blast in the game flew
// straight through walls.
const sightRay = new THREE.Raycaster();
function clearShot(from, to) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const dist = dir.length();
  if (dist < 0.001) return true;
  sightRay.set(from, dir.divideScalar(dist));
  sightRay.far = dist;
  return sightRay.intersectObjects(wallMeshes).length === 0;
}

let gun = createGun(camera, 'assault');

// Declared here rather than down with the rest of the player's state,
// because spawnAliens() below asks how hard the game is in order to decide
// how much health to give each alien — and a `let` read before its own line
// is not undefined, it throws.
let difficulty = savedDifficulty();

// Whatever you set on the soundboard last time, before a note is played.
loadSavedSound();

// And whatever you change in the soundboard's own tab, as you change it.
// A storage event only reaches the tabs that did NOT make the change, so
// this is the game hearing the board rather than hearing itself.
window.addEventListener('storage', (e) => {
  if (e.key === 'falo3d2.sound') loadSavedSound();
});

const aliens = spawnAliens(scene);

// What the bodies standing in the outposts were counted out for. resetRun
// compares this against the difficulty in force and rebuilds if they parted.
let rosterSwarm = difficulty.swarm;
const boss = BOSS_ENABLED ? spawnBoss(scene) : null;
const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);
// Where this particular shot is actually aimed — the centre of the screen
// plus whatever spread the weapon has.
const aimPoint = new THREE.Vector2(0, 0);

let bullets = [];
let flashes = [];
let projectiles = [];
// Where a bolt was before this frame moved it, so the step it just took can
// be tested against the walls rather than only its landing point.
const projPrev = new THREE.Vector3();
let killCount = 0;
let playerHp = 100;
let playerHpMax = 100;
let isDead = false;

// ─── YOUR CLASS ─────────────────────────────────────────────
// Chosen on the title screen and applied when the run starts. It decides the
// gun in your hands, how hard it hits, how fast it fires, how straight it
// shoots, how much health you have and how quickly you move.
let playerClass = classById('assault');
let commanderWeapon = 'assault';     // only the Commander gets a say
let shotCooldown = 0;

// ─── WHAT THIS RUN GAVE YOU ─────────────────────────────────
// The room behind the board hands out one of two things, and the choice is
// good for that run only — walk back in on the next one and you choose
// again. Everything here is cleared by resetRun().
let runPerk = null;         // null, 'grenade' or 'kit'
let perkOffered = false;    // the choice is made once per run, not per visit
let grenadesLeft = 0;

/**
 * Health coming back, per second.
 *
 * Two sources and they stack, because they were earned separately: the
 * Medic carries it, and the field kit out of the secret room grants it to
 * whoever picked that over the grenade.
 */
function regenRate() {
  return (playerClass.regen || 0) + (runPerk === 'kit' ? 2 : 0);
}

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

// ─── THE RIDE DOWN ──────────────────────────────────────────
// Built the moment you get clear and thrown away when it is over. While it
// is running it owns the screen: the station is still there and still
// frozen behind it, but nothing of it is drawn.
let descent = null;
const cutFadeEl = document.getElementById('cut-fade');
const descentTextEl = document.getElementById('descent-text');
const descentLine1El = descentTextEl && descentTextEl.querySelector('.one');
const descentLine2El = descentTextEl && descentTextEl.querySelector('.two');
let descentTyped = 0;        // characters already given a key click

function startDescent() {
  descent = createDescent();
  document.body.classList.add('in-cutscene');
  if (cutFadeEl) {
    cutFadeEl.style.display = 'block';
    cutFadeEl.style.opacity = '0';
  }
  descentTyped = 0;
  if (descentTextEl) {
    descentTextEl.style.display = 'block';
    descentTextEl.style.opacity = '0';
    if (descentLine1El) descentLine1El.textContent = '';
    if (descentLine2El) descentLine2El.textContent = '';
  }
  // Anything the station was still droning goes now — with the cutscene
  // owning the loops, a Floater humming next to the pod bay would hum all
  // the way to the planet.
  stopLoop('floater-hover');
  stopLoop('minigun-spin');
  // Re-entry. The breach's air-roar is the right noise for it and already
  // tuned on the soundboard, so it is borrowed rather than written twice.
  startLoop('breach', { gain: 0.5 });
}

/** The cutscene is over — show what the run came to. */
function endDescent() {
  if (!descent) return;
  stopLoop('breach');
  descent.dispose();
  descent = null;
  document.body.classList.remove('in-cutscene');
  if (cutFadeEl) cutFadeEl.style.display = 'none';
  if (descentTextEl) descentTextEl.style.display = 'none';
  escapeScreen.style.display = 'flex';
  playSound('escape', { gain: 0.9 });
  if (document.pointerLockElement) document.exitPointerLock();
}

// ─── HOW YOU GOT HERE ───────────────────────────────────────
// The opening, and the only cutscene that runs before you have played a
// single frame. It owns the screen exactly the way the ride down does: the
// station is built and standing behind it, and none of it is drawn.
//
// It does not hand you straight to the game. The helicopter goes dark, and
// then you are on the floor of the Hangar with your eyes shutting on you —
// that part is not the cutscene, it is the real station with the camera
// lying on its side. Which is the point: the first thing you ever see of
// the level is from the floor of it.
let intro = null;
const cutLineEl = document.getElementById('cut-line');
const cutWhoEl = cutLineEl && cutLineEl.querySelector('.who');
const cutSaidEl = cutLineEl && cutLineEl.querySelector('.said');
let waking = -1;              // seconds since you came round, -1 when not
let wakeYaw = 0;              // the way the game would have had you facing
const WAKE_BLINK = 2.1;       // eyes, twice, before anything else
const WAKE_STAND = 1.6;       // and then your legs
const WAKE_TOTAL = WAKE_BLINK + WAKE_STAND;

// How dark it is while you come round: shut, a crack, shut again, open.
const BLINK = [[0, 1], [0.35, 0.22], [0.8, 0.92], [1.35, 0.08],
               [1.6, 0.5], [2.1, 0]];

function startIntro() {
  intro = createArrival();
  wakeYaw = ctrl.yaw;         // before the cutscene lets the mouse wander
  document.body.classList.add('in-cutscene');
  if (cutFadeEl) {
    cutFadeEl.style.display = 'block';
    cutFadeEl.style.opacity = '1';     // it opens out of black
  }
}

/** Whatever the cutscene asks for, in the game's own voice. */
function introCue(c) {
  if (c.line) {
    // The words. The browser's own speech synthesiser says them — see
    // audio/speech.js — and the subtitle under them is drawn every frame
    // from the cutscene's own clock, so a machine with no voices still
    // gets the scene and a slow voice never drags the subtitles about.
    say(c.line.role, c.line.speak || c.line.text, masterVolume());
    return;
  }
  const id = c.sound;
  if (id === 'rotor-on') startLoop('rotor', { gain: ROTOR_GAIN });
  else if (id === 'radio-on') {
    playSound('radio-squelch', { gain: 0.8 });
    startLoop('radio-hiss', { gain: 0.9 });
  } else if (id === 'radio-off') {
    stopLoop('radio-hiss');
    playSound('radio-squelch', { gain: 0.6 });
  } else if (id === 'ray-on') {
    playSound('watcher-charge', { gain: 0.75 });
    startLoop('tractor', { gain: 0.95 });
  } else if (id === 'grab') {
    stopLoop('rotor');
    playSound('pod-launch', { gain: 0.6 });
  } else if (id === 'swallow') {
    playSound('space-door', { gain: 1 });
  } else if (id === 'quiet') {
    stopLoop('tractor');
  }
}

// How loud the helicopter is with nobody talking, and with somebody. A
// rotor at full belt and a sentence at the same time is a rotor; every
// film with a helicopter in it ducks the one under the other.
const ROTOR_GAIN = 0.9;
const ROTOR_DUCK = 0.4;

/** Put the subtitle up, or take it down. */
function showLine(l) {
  if (!cutLineEl) return;
  if (!l) {
    if (cutLineEl.style.display !== 'none') cutLineEl.style.display = 'none';
    return;
  }
  // Your own line is the one place the game says your name out loud.
  // Shouted in capitals like the other two, so your name sits in the
  // scene rather than looking like a different kind of thing.
  const who = l.role === 'you'
    ? (playerName ? playerName.toUpperCase() : 'YOU') : l.who;
  cutLineEl.style.display = 'block';
  cutLineEl.style.opacity = String(l.alpha);
  if (cutWhoEl && cutWhoEl.textContent !== who) cutWhoEl.textContent = who;
  if (cutSaidEl && cutSaidEl.textContent !== l.text) cutSaidEl.textContent = l.text;
  if (cutLineEl.classList.contains('radio') !== (l.role === 'radio')) {
    cutLineEl.classList.toggle('radio', l.role === 'radio');
  }
}

/** The helicopter is gone. You are on the floor, and the game has started
 *  without telling you. `skipped` means you pressed a key to get here, so
 *  the blinking is cut and you only get the standing up. */
function endIntro(skipped) {
  if (!intro) return;
  intro.dispose();
  intro = null;
  hush();                     // mid-sentence, if that is where you skipped
  showLine(null);
  stopLoop('rotor');
  stopLoop('tractor');
  stopLoop('radio-hiss');
  waking = skipped ? WAKE_BLINK - 0.25 : 0;
  playSound('hurt-ah', { gain: 0.45 });
}

/**
 * Coming round.
 *
 * The world is not live for these three and a half seconds — `started` is
 * still false, so nothing thinks and nothing can touch you — and the camera
 * is driven straight rather than through the controller: on its side on the
 * floor, then up to eye height as you get your legs under you.
 */
function updateWaking(dt) {
  waking += dt;
  const k = Math.min(1, Math.max(0, (waking - WAKE_BLINK) / WAKE_STAND));
  const e = k * k * (3 - 2 * k);

  ctrl.position.set(START_POS.x, 0.32 + e * (1.6 - 0.32), START_POS.z);
  ctrl.yaw = wakeYaw - (1 - e) * 0.3;
  ctrl.pitch = -0.6 + e * 0.6;
  camera.position.copy(ctrl.position);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = ctrl.yaw;
  camera.rotation.x = ctrl.pitch;
  camera.rotation.z = (1 - e) * 0.7;        // your cheek is on the deck

  // Eyes. Straight interpolation through the table above, so the shape of
  // it is one line to edit rather than a nest of ifs.
  let dark = 0;
  for (let i = 0; i < BLINK.length - 1; i++) {
    const [t0, v0] = BLINK[i], [t1, v1] = BLINK[i + 1];
    if (waking >= t0 && waking <= t1) {
      dark = v0 + (v1 - v0) * ((waking - t0) / (t1 - t0));
      break;
    }
  }
  if (cutFadeEl) cutFadeEl.style.opacity = String(dark);

  if (waking >= WAKE_TOTAL) {
    // On your feet, and it is your game from here.
    waking = -1;
    camera.rotation.z = 0;
    ctrl.position.copy(START_POS);
    ctrl.yaw = wakeYaw;
    ctrl.pitch = 0;
    ctrl.velocity.set(0, 0, 0);
    ctrl.onGround = true;
    // Any key you pressed to skip the cutscene is, as far as the browser is
    // concerned, still held down.
    for (const key in ctrl.keys) ctrl.keys[key] = false;
    document.body.classList.remove('in-cutscene');
    if (cutFadeEl) cutFadeEl.style.display = 'none';
    started = true;
    if (!ctrl.locked) {
      try {
        const lock = canvas.requestPointerLock();
        if (lock && lock.catch) lock.catch(() => {});
      } catch (e) { /* nothing to do about it */ }
    }
  }
}

const escapeTallyEl = document.getElementById('escape-tally');
const escapeAgainBtn = document.getElementById('escape-again');
const escapeQuitBtn = document.getElementById('escape-quit');
const usePromptEl = document.getElementById('use-prompt');
const perkPromptEl = document.getElementById('perk-prompt');
const perkHudEl = document.getElementById('perk-hud');
const objectiveEl = document.getElementById('objective');
const soldierHudEl = document.getElementById('soldier-hud');
const soldierBarEl = document.getElementById('soldier-bar');
const escapeCrewEl = document.getElementById('escape-crew');
const bossBannerTitleEl = document.getElementById('boss-banner-title');
let deathCause = null;
const startOverlay = document.getElementById('start-overlay');

// ─── WHO YOU ARE ────────────────────────────────────────────
// Asked once, the first time this machine ever plays, and then shown in the
// corner for good. The gate sits over the title screen rather than before
// it, so the station is already running behind it the way it always was.
const nameGateEl = document.getElementById('name-gate');
const nameInputEl = document.getElementById('name-input');
const nameGoEl = document.getElementById('name-go');
const nameWhyEl = document.getElementById('name-why');
const playerNameEl = document.getElementById('player-name');
let playerName = savedName();

function showPlayerName() {
  if (!playerNameEl) return;
  playerNameEl.textContent = playerName || '';
  playerNameEl.style.display = playerName ? 'block' : 'none';
}

function submitName() {
  const r = cleanName(nameInputEl ? nameInputEl.value : '');
  if (!r.ok) {
    // Taken away rather than left there to be nudged past the filter.
    if (nameInputEl) { nameInputEl.value = ''; nameInputEl.focus(); }
    if (nameWhyEl) nameWhyEl.textContent = r.why;
    return;
  }
  playerName = r.name;
  saveName(playerName);
  if (nameWhyEl) nameWhyEl.textContent = '';
  if (nameGateEl) nameGateEl.style.display = 'none';
  showPlayerName();
}

if (nameGoEl) nameGoEl.addEventListener('click', submitName);
if (nameInputEl) {
  nameInputEl.addEventListener('keydown', (e) => {
    e.stopPropagation();            // the game's own keys are not listening here
    if (e.key === 'Enter') submitName();
  });
}
if (!playerName && nameGateEl) {
  nameGateEl.style.display = 'flex';
  if (nameInputEl) setTimeout(() => nameInputEl.focus(), 50);
}
showPlayerName();

// Tell the site someone is playing this one, so the library can say how
// many are. Once, on load — nothing but a random id and the game's name.
startPresence('falo3d-2');

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
  // The soundboard freezes the station the same way the title screen does.
  // You cannot tune a gunshot while a Brute is walking up behind you, and
  // being killed by something hidden under a panel would be the game's
  // fault rather than yours.
  return started && !isDead && !escaped && !soundboardOpen();
}

function updateHUD() {
  // As a fraction of this class's maximum: a Sniper on 70 is at full health,
  // not at seventy per cent of a bar that stops at a hundred.
  const pct = playerHpMax > 0 ? (playerHp / playerHpMax) * 100 : 0;
  healthBar.style.width = pct + '%';
  healthBar.style.background = pct > 60 ? '#44ff88' : pct > 30 ? '#ffaa22' : '#ff2244';
  healthText.textContent = 'HP ' + playerHp;
  healthText.style.color = healthBar.style.background;
  killsEl.textContent = 'KILLS: ' + killCount;

  // What the secret room gave you, if you have been in it. The grenades
  // count down as you throw them; the kit just says it is working.
  if (perkHudEl) {
    if (grenadesLeft > 0) {
      perkHudEl.textContent = 'GRENADES ' + grenadesLeft + '  ·  G';
      perkHudEl.style.display = 'block';
    } else if (regenRate() > 0) {
      perkHudEl.textContent = 'HEALING';
      perkHudEl.style.display = 'block';
    } else {
      perkHudEl.style.display = 'none';
    }
  }
}

/** Put the chosen class into effect. Called when a run begins. */
/** How much of a thing there is to shoot through, at this difficulty. */
function enemyHp(base) {
  return Math.max(1, Math.round(base * difficulty.enemyHp));
}

/** What one round takes off, weapon and class together. */
function shotDamage() {
  return (gun.weapon.damage || 1) * (playerClass.damageMul || 1);
}

// ─── THINGS THAT GO OFF ─────────────────────────────────────
// The RPG's rockets and the secret room's grenades. Both of them end the
// same way, so the blast is one function and they only differ in how they
// travel to it.
let rockets = [];
let grenades = [];
let blasts = [];      // the visible ball of fire, purely cosmetic

/**
 * A blast at `at`, hurting everything within `radius`.
 *
 * Falls off with distance rather than being flat, so a rocket into the
 * middle of a pack kills what it landed on and wounds the rest — which is
 * the reason to aim it at all, instead of at whichever one is closest.
 */
function explode(at, radius, damage) {
  // The fireball. Short-lived and in front of everything, because it has to
  // read on one frame in a corridor that is already orange.
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(1, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.85 })
  );
  ball.position.copy(at);
  ball.scale.setScalar(0.4);
  scene.add(ball);
  playSound('explosion', { dist: at.distanceTo(camera.position) });
  blasts.push({ mesh: ball, life: 0.42, max: 0.42, radius });
  flashes.push(createFlash(scene, at.clone()));

  // Aliens. Distance is measured to the body rather than to a mesh, so a
  // Brute's outstretched arm does not count as being caught in it.
  //
  // And a wall stops it. Without the sight check a rocket fired in one room
  // kills things standing in the next one, which is both unfair in the hand
  // and impossible to read — you hear kills you cannot account for. The
  // Watcher's own line-of-sight test does the work.
  let cried = false;
  for (const a of aliens) {
    if (a.gone || !a.alive) continue;
    const d = a.model.position.distanceTo(at);
    if (d > radius) continue;
    const chest = a.model.position.clone();
    chest.y += 0.7;
    if (!clearShot(at, chest)) continue;
    const share = Math.max(1, Math.round(damage * (1 - d / radius)));
    a.hp -= share;
    a.flashTimer = 0.12;
    a.reg.hit(a.ai);
    if (a.hp <= 0) {
      a.alive = false;
      a.deathTimer = 0;
      a.reg.kill(a.ai);
      // One death cry for the lot of them rather than eight at the same
      // instant, which is just a loud smear.
      if (!cried) { cried = true; playSound('alien-death', { dist: d }); }
      killCount++;
    }
  }
  updateHUD();

  // The boss, if any of it was standing in it.
  //
  // Its modules want to be told WHICH part was hit, so the blast finds the
  // nearest shootable piece of EVERY part it reaches and reports them one
  // at a time. Every part, rather than only the nearest of the lot,
  // because of the Puppet Master: once its body is dead the pilot runs
  // about on its own, and a blast that found the wreck first reported a
  // hit on a part with no health left — which that boss throws away. The
  // RPG therefore could not finish that fight at all. A blast is also the
  // one thing that genuinely does hit two parts of something at once.
  if (boss && boss.active && !boss.defeated) {
    const nearest = new Map();          // hitPart -> how far off it was
    const where = new THREE.Vector3();
    const look = (root) => {
      if (!root) return;
      root.traverse((o) => {
        if (!o.isMesh || !o.visible || !o.userData.hitPart) return;
        o.getWorldPosition(where);
        const d = where.distanceTo(at);
        if (d >= radius) return;
        const best = nearest.get(o.userData.hitPart);
        if (best != null && best <= d) return;
        if (!clearShot(at, where)) return;
        nearest.set(o.userData.hitPart, d);
      });
    };
    look(boss.model);
    // Some bosses keep part of themselves outside their own group — the
    // Puppet Master's pilot ejects into the scene. The same list the
    // hitscan path has always used.
    for (const extra of (boss.kind.targets ? boss.kind.targets(boss.model) : [])) {
      look(extra);
    }
    // `damage` already carries the class multiplier: it was applied a
    // second time here, which quietly made every blast a Commander let off
    // worth four times what the class card says.
    const give = (part, d) =>
      boss.kind.hit(boss.model, part, at.clone(),
                    boss.kind.bullet * damage * (1 - d / radius)
                      / difficulty.enemyHp);
    if (boss.kind.blastParts) {
      // Parts with their own health: each takes its own share. Only the
      // two bosses that are really two things say so.
      for (const [part, d] of nearest) give(part, d);
    } else {
      // One pool of health wearing several labels — a Burrower's head,
      // eyes and body are all the same Burrower. Reporting each of them
      // would charge the blast three times for one explosion.
      let part = null, best = Infinity;
      for (const [p, d] of nearest) if (d < best) { best = d; part = p; }
      if (part) give(part, best);
    }
  }
}

/**
 * Is any shootable piece of the boss right here?
 *
 * A rocket asks this to know it has arrived. Asking the boss's own
 * position is not enough — that is the middle of its feet, and the Puppet
 * Master's pilot ends the fight ten metres away from them.
 */
function bossIsAt(p) {
  if (!boss || !boss.active || boss.defeated) return false;
  // A kind can say which of its pieces are solid enough to set a rocket
  // off, and how big each one is. Only one does, and only because part of
  // it stops counting halfway through the fight.
  if (boss.kind.solid) {
    for (const s of boss.kind.solid(boss.model)) {
      if (s && s.at && s.at.distanceTo(p) < s.r) return true;
    }
    return false;
  }
  // Otherwise: anything of it you could have shot. This used to ask the
  // boss's GROUP where it was, which is no good for the two of them that
  // leave the group at the origin and lay themselves out inside it — a
  // rocket aimed at either Twin flew straight through and went off on the
  // far wall, if it went off at all.
  const where = new THREE.Vector3();
  let near = false;
  const look = (root) => {
    if (!root || near) return;
    root.traverse((o) => {
      if (near || !o.isMesh || !o.visible || !o.userData.hitPart) return;
      o.getWorldPosition(where);
      if (where.distanceTo(p) < 1.1) near = true;
    });
  };
  look(boss.model);
  for (const extra of (boss.kind.targets ? boss.kind.targets(boss.model) : [])) {
    look(extra);
  }
  return near;
}

/** A rocket, leaving the tube. */
function fireRocket(from, dir, weapon) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.26, 8),
    new THREE.MeshLambertMaterial({ color: 0x6a5a3a }));
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.06, 0.14, 8),
    new THREE.MeshLambertMaterial({ color: 0x8a3a2a }));
  head.rotation.x = -Math.PI / 2; head.position.z = -0.19; g.add(head);
  // The flame behind it, which is most of what you actually see.
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xffbb44 }));
  flame.position.z = 0.2; g.add(flame);
  g.add(new THREE.PointLight(0xffaa33, 1.4, 6));
  g.position.copy(from);
  g.lookAt(from.clone().add(dir));
  scene.add(g);
  rockets.push({ mesh: g, dir: dir.clone(), speed: 22, life: 4,
                 damage: weapon.damage, blast: weapon.blast });
}

/** One of the three out of the secret room, lobbed underarm. */
function throwGrenade() {
  if (grenadesLeft <= 0 || !worldIsLive()) return;
  grenadesLeft--;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 7, 6),
    new THREE.MeshLambertMaterial({ color: 0x3a4a32 }));
  const from = camera.position.clone().add(
    new THREE.Vector3(0.1, -0.15, -0.4).applyQuaternion(camera.quaternion));
  mesh.position.copy(from);
  scene.add(mesh);
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  grenades.push({
    mesh,
    // Thrown along your aim with some lift on it, so it lands out in front
    // rather than at your feet.
    vel: dir.multiplyScalar(13).add(new THREE.Vector3(0, 3.4, 0)),
    fuse: 1.6,
  });
  updateHUD();
}

/** Rockets in flight, grenades on their fuse, and fireballs fading out. */
function updateOrdnance(dt, live) {
  if (live) {
    rockets = rockets.filter((r) => {
      r.life -= dt;
      const step = r.speed * dt;
      const p = r.mesh.position;
      p.addScaledVector(r.dir, step);

      // What it ran into. Anything here ends the same way.
      let hit = null;
      if (p.y < 0.1 || p.y > 4.2 || hitsWall(p.x, p.z, 0.25) ||
          !isFloorAt(p.x, p.z)) {
        hit = p.clone();
      }
      if (!hit) {
        for (const a of aliens) {
          if (a.gone || !a.alive || !a.model.visible) continue;
          // Against the body, not the origin — a model's origin is at its
          // feet, so measuring in three dimensions let a rocket fly straight
          // through a Brute's chest and carry on into the far wall.
          const ap = a.model.position;
          const flat = Math.hypot(ap.x - p.x, ap.z - p.z);
          const high = p.y - ap.y;
          if (flat < 1.0 && high > -0.6 && high < 2.4) { hit = p.clone(); break; }
        }
      }
      if (!hit && bossIsAt(p)) hit = p.clone();

      if (hit) {
        // The thing it actually struck takes the direct hit as well as its
        // share of the blast — a rocket in the chest should beat a rocket
        // at your feet.
        explode(hit, r.blast.radius,
                (r.blast.damage + r.damage) * (playerClass.damageMul || 1));
        removeOrdnance(r.mesh);
        return false;
      }
      if (r.life <= 0) { removeOrdnance(r.mesh); return false; }
      return true;
    });

    grenades = grenades.filter((g) => {
      g.fuse -= dt;
      const p = g.mesh.position;
      g.vel.y -= 16 * dt;                     // heavier than real gravity; it lobs
      const wasX = p.x, wasZ = p.z;
      p.addScaledVector(g.vel, dt);

      // Off a wall, and off the floor. Neither is a real bounce — the point
      // of it is that a grenade thrown down a corridor stays in the corridor.
      if (hitsWall(p.x, p.z, 0.15) || !isFloorAt(p.x, p.z)) {
        p.x = wasX; p.z = wasZ;
        g.vel.x *= -0.4; g.vel.z *= -0.4;
      }
      if (p.y <= 0.12) {
        p.y = 0.12;
        g.vel.y = Math.abs(g.vel.y) > 2 ? -g.vel.y * 0.35 : 0;
        g.vel.x *= 0.7; g.vel.z *= 0.7;
      }

      if (g.fuse <= 0) {
        explode(p.clone(), 5, 7 * (playerClass.damageMul || 1));
        removeOrdnance(g.mesh);
        return false;
      }
      return true;
    });
  }

  // The fireballs fade whether or not the world is live — they are already
  // over, and freezing one in the air on the death screen looks like a bug.
  blasts = blasts.filter((b) => {
    b.life -= dt;
    if (b.life <= 0) {
      scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      b.mesh.material.dispose();
      return false;
    }
    const t = 1 - b.life / b.max;
    b.mesh.scale.setScalar(0.4 + t * b.radius * 0.9);
    b.mesh.material.opacity = 0.85 * (1 - t);
    return true;
  });
}

// ─── THE SOUNDSCAPE ─────────────────────────────────────────
// The noises that are not events: your own boots, the drones that rise and
// fall as you move around them, and the minigun's barrels.
let walkRun = 0;          // ground covered since the last footfall
let lastFootX = 0, lastFootZ = 0;

function updateSoundscape(dt, live) {
  // While the soundboard is up it owns the looping sounds — otherwise its
  // HOLD buttons start a drone and this stops it again on the very next
  // frame, and the three loops are the ones you most need to sit and listen
  // to while you tune them.
  if (soundboardOpen()) return;

  // And while the ride down is playing it owns them too. It starts its own
  // air-roar for re-entry, and the world is not live once you have escaped,
  // so the branch below was stopping that loop on the very next frame —
  // the whole cutscene has been running in silence since it was written.
  if (descent || intro) return;

  if (!live) {
    // Nothing should still be droning behind the death screen.
    stopLoop('floater-hover');
    stopLoop('breach');
    stopLoop('minigun-spin');
    return;
  }

  // Your boots, paced by distance walked and only while you are on the floor.
  const moved = Math.hypot(ctrl.position.x - lastFootX, ctrl.position.z - lastFootZ);
  lastFootX = ctrl.position.x; lastFootZ = ctrl.position.z;
  if (ctrl.onGround) {
    walkRun += moved;
    if (walkRun >= 1.9) { walkRun = 0; playSound('footstep'); }
  } else {
    walkRun = 1.4;        // land already most of the way to the next step
  }

  // One hover drone for the whole station, pitched at whichever Floater is
  // nearest. Eight separate voices would cost eight oscillators each and
  // still only ever be heard as one sound.
  let nearestFloater = Infinity;
  for (const a of aliens) {
    if (a.gone || !a.alive || a.type !== 'floater' || !a.model.visible) continue;
    const d = a.model.position.distanceTo(ctrl.position);
    if (d < nearestFloater) nearestFloater = d;
  }
  droneTo('floater-hover', nearestFloater, 16);

  // The hull breach, which you can hear long before the pull starts.
  let nearestBreach = Infinity;
  for (const h of hazards) {
    const x = Math.min(Math.max(ctrl.position.x, h.xMin), h.xMax);
    const d = Math.hypot(ctrl.position.x - x, ctrl.position.z - h.z);
    if (d < nearestBreach) nearestBreach = d;
  }
  droneTo('breach', nearestBreach, 26);

  // The barrels, which spin while you are firing and wind down when you stop.
  if (gun.weapon.spins && gun.recoilTime > 0) startLoop('minigun-spin');
  else stopLoop('minigun-spin');
}

/** Hold a looping sound at a volume set by how far off the thing is. */
function droneTo(id, dist, range) {
  if (dist > range) { stopLoop(id); return; }
  startLoop(id);
  const t = 1 - dist / range;
  setLoopGain(id, Math.min(1, t * t * 1.4));
}

function removeOrdnance(mesh) {
  scene.remove(mesh);
  mesh.traverse((o) => {
    if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
  });
}

function clearOrdnance() {
  for (const r of rockets) removeOrdnance(r.mesh);
  for (const g of grenades) removeOrdnance(g.mesh);
  for (const b of blasts) {
    scene.remove(b.mesh);
    b.mesh.geometry.dispose();
    b.mesh.material.dispose();
  }
  rockets = []; grenades = []; blasts = [];
}

/**
 * One round, resolved the instant it is fired.
 *
 * A ray out of the camera, stopped by the first thing it meets — alien,
 * boss or wall — and a tracer drawn to wherever that was.
 */
function fireHitscanShot(w) {
    // Spread: nudge the aim point off centre. The sniper's is zero, which
    // is most of what you are paying for.
    if (w.spread > 0) {
      aimPoint.set((Math.random() - 0.5) * w.spread * 2,
                   (Math.random() - 0.5) * w.spread * 2);
    } else {
      aimPoint.set(0, 0);
    }
    raycaster.setFromCamera(aimPoint, camera);

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
        // A boss's health is set inside its own module, so instead of
        // reaching in to change it, the bullet is worth less. From the
        // player's side those are the same thing.
        boss.kind.hit(boss.model, hitObj.userData.hitPart, hits[0].point,
                      boss.kind.bullet * shotDamage() / difficulty.enemyHp);
        playSound(BOSS_HIT_SOUND[boss.kind.id] || 'boss-hit-burrower');
      } else {
        for (const alien of aliens) {
          let found = false;
          alien.model.traverse((c) => { if (c === hitObj) found = true; });
          if (found && alien.alive) {
            alien.hp -= shotDamage();
            alien.flashTimer = 0.12;
            alien.reg.hit(alien.ai);
            const away = alien.model.position.distanceTo(camera.position);
            // A moan lasts nearly half a second and the minigun fires
            // twenty-seven times a second. Let every round start one and the
            // thing you are shooting becomes a wall of overlapping voices,
            // so each alien only moans so often — the hits still land, it
            // just does not say so every single time.
            // `time` belongs to the game loop; this runs out here, so it
            // reads the clock itself.
            const nowSec = performance.now() / 1000;
            if (nowSec - (alien.lastMoan || -9) > 0.3) {
              alien.lastMoan = nowSec;
              playSound('alien-hit', { dist: away });
            }
            if (alien.hp <= 0) {
              alien.alive = false;
              alien.deathTimer = 0;
              alien.reg.kill(alien.ai);
              playSound('alien-death', { dist: away });
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

/** One rocket, which resolves later and somewhere else. See updateOrdnance. */
function fireRocketShot(w) {
  const from = camera.position.clone().add(
    new THREE.Vector3(0.12, -0.1, -0.5).applyQuaternion(camera.quaternion));
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  fireRocket(from, dir, w);
  flashes.push(createFlash(scene, from));
}

function applyClass() {
  if (playerClass.id === 'commander') {
    commanderWeapon = allowedCommanderWeapon(commanderWeapon);
  }
  const w = playerClass.id === 'commander' ? commanderWeapon : playerClass.weapon;
  swapGun(w);
  playerHpMax = Math.max(1, Math.round(playerClass.hp * difficulty.health));
  playerHp = playerHpMax;
  shotCooldown = 0;
  healFraction = 0;
  updateHUD();
}

// Health is a whole number everywhere it is read — the bar, the kill check,
// the text. Two a second is less than one a frame, so the part of a point
// that has not arrived yet waits here rather than being rounded away sixty
// times a second into nothing.
let healFraction = 0;

function healOverTime(dt) {
  const rate = regenRate();
  if (rate <= 0 || playerHp <= 0 || playerHp >= playerHpMax) {
    healFraction = 0;
    return;
  }
  healFraction += rate * dt;
  if (healFraction < 1) return;
  const whole = Math.floor(healFraction);
  healFraction -= whole;
  playerHp = Math.min(playerHpMax, playerHp + whole);
  updateHUD();
}

function damagePlayer(amount) {
  // Belt and braces: every caller is already behind worldIsLive(), but this
  // is the one function that can actually hurt you, so it checks too.
  if (!worldIsLive()) return;
  // One place for the difficulty to bite: every alien, every boss, the
  // vacuum and the floor tentacles all arrive here.
  const taken = Math.max(1, Math.round(amount * difficulty.incoming));
  playerHp = Math.max(0, playerHp - taken);
  playSound(HURT_SOUNDS[Math.floor(Math.random() * HURT_SOUNDS.length)]);
  dmgFlashTimer = 0.3;
  dmgFlashEl.style.opacity = '1';
  updateHUD();

  if (playerHp <= 0) {
    isDead = true;
    // Everything that was droning or spinning stops with you.
    stopAllLoops();
    playSound('death');
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
  //
  // Changing the difficulty can change how MANY there are, though, and this
  // loop only ever rebuilds the bodies it already has. When the swarm size
  // has moved, the whole roster goes and the spawn plan runs again from
  // scratch — otherwise picking IMPOSSIBLE from the home screen would hand
  // you its damage and its health on normal's four-to-an-outpost.
  if (rosterSwarm !== difficulty.swarm) {
    for (const a of aliens) {
      scene.remove(a.model);
      if (!a.gone) disposeModel(a.model);
    }
    aliens.length = 0;
    aliens.push(...spawnAliens(scene));
    rosterSwarm = difficulty.swarm;
  }

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
    // Re-read rather than reused: the difficulty may have changed since
    // these were built, and maxHp was fixed at the old one.
    a.maxHp = enemyHp(a.reg.hp);
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

  // He is tied up again, back in the room, and you have to find him afresh.
  initSoldier(soldier, SOLDIER_SPOT);
  soldier.rotation.x = 0;
  soldier.visible = true;        // he climbs back out for the next run
  soldierFreedAnnounced = false;
  if (soldierHudEl) soldierHudEl.style.display = 'none';
  // And you are never left standing in the hidden room at the start of a run.
  cameFrom = null;

  // The door is shut and bolted again, and its wall goes back into the level.
  outpostsClear = 0;
  doorOpened = false;
  setLockedDoorOpen(lockedDoor, false);
  if (!walls.includes(lockedDoor.wall)) walls.push(lockedDoor.wall);
  objectiveEl.classList.remove('done');
  objectiveEl.textContent = 'OUTPOSTS CLEARED 0/' + OUTPOSTS.length;

  // The way out is sealed again, and the run is no longer over.
  escaped = false;
  bossBannerTimer = 0;

  // If a run is restarted out from under the ride down, it goes with it.
  if (descent) {
    stopLoop('breach');
    descent.dispose();
    descent = null;
    document.body.classList.remove('in-cutscene');
    if (cutFadeEl) cutFadeEl.style.display = 'none';
    if (descentTextEl) descentTextEl.style.display = 'none';
  }

  // The room's gift is good for one run. So is anything still in the air.
  runPerk = null;
  perkOffered = false;
  grenadesLeft = 0;
  healFraction = 0;
  clearOrdnance();
  if (perkPromptEl) perkPromptEl.style.display = 'none';
  escapeScreen.style.display = 'none';
  usePromptEl.style.display = 'none';
  setEscapePodUnlocked(escapePod, false);
  setSpaceDoorOpen(spaceDoor, false);
  if (!walls.includes(spaceDoor.wall)) walls.push(spaceDoor.wall);

  // The player, and whichever class they picked.
  killCount = 0;
  applyClass();
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
  drawClassPicker();       // in case this run unlocked something
  drawDifficulty();
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
  stopAllLoops();
  playSound('pod-launch');
  // This is the only place a win is recorded. Two of them: who you were,
  // which is what eventually unlocks the Commander, and what you were up
  // against, which is what unlocks the Scout, the Medic and the Minigun.
  recordWin(playerClass.id);
  recordBeaten(difficulty.id);
  usePromptEl.style.display = 'none';
  // In case you got here inside the banner's few seconds — it sits above
  // every other screen, so left up it would be printed across this one.
  bossBannerTimer = 0;
  if (bossBannerEl) bossBannerEl.style.display = 'none';
  escapeTallyEl.textContent =
    killCount === 1 ? '1 of them did not make it off with you.'
                    : killCount + ' of them did not make it off with you.';

  // Does the soldier get off with you?
  //
  // He has to actually BE there — he follows at about three units, so if you
  // walked to the pod he is at your shoulder, but if he is lying dead in an
  // outpost or still tied up behind the board he is not coming. Three
  // outcomes, and the one where you never found him says nothing at all,
  // because as far as that run is concerned he does not exist.
  escapeCrewEl.classList.remove('lost');
  if (!soldierIsFree(soldier)) {
    escapeCrewEl.textContent = '';
  } else if (soldierIsDown(soldier)) {
    escapeCrewEl.textContent = 'You left the soldier on the station.';
    escapeCrewEl.classList.add('lost');
  } else if (Math.hypot(soldier.position.x - escapePod.board.x,
                        soldier.position.z - escapePod.board.z) < 9) {
    escapeCrewEl.textContent = 'The soldier made it into the seat behind you.';
    // He is inside now. Left standing on the pad he would be visible through
    // the hatch on the very screen saying he came with you.
    soldier.visible = false;
  } else {
    escapeCrewEl.textContent = 'The soldier was too far behind. The door shut without him.';
    escapeCrewEl.classList.add('lost');
  }

  // Not the tally yet — first you find out where you are going.
  startDescent();
  if (document.pointerLockElement) document.exitPointerLock();
}

playAgainBtn.addEventListener('click', playAgain);
quitBtn.addEventListener('click', quitToTitle);
escapeAgainBtn.addEventListener('click', playAgain);
escapeQuitBtn.addEventListener('click', quitToTitle);

// Your hand is on the keyboard already, so take it from there too.
document.addEventListener('keydown', (e) => {
  // Skipping a cutscene. Any key at all, because by the third time you have
  // seen one you want the game, not the view.
  if (intro) { intro.skip(); return; }
  if (descent) { descent.skip(); return; }

  // The soundboard, which works whether or not you are playing — you need to
  // hear a gun to tune it, and you need to tune it without being eaten.
  if (e.code === 'KeyM') {
    startAudio();
    if (toggleSoundboard() && document.pointerLockElement) document.exitPointerLock();
    return;
  }
  if (soundboardOpen()) return;       // typing on the board is not playing

  // The two that do anything while you are actually playing.
  if (e.code === 'KeyE') { tryUsePod(); return; }
  if (e.code === 'KeyG') { throwGrenade(); return; }
  // Picking what the secret room gives you, while that choice is up.
  if (perkPromptEl && perkPromptEl.style.display === 'block') {
    if (e.code === 'Digit1') { takePerk('grenade'); return; }
    if (e.code === 'Digit2') { takePerk('kit'); return; }
  }
  if (!isDead && !escaped) return;
  if (e.code === 'KeyR') playAgain();
  else if (e.code === 'KeyQ') quitToTitle();
});

/** Put something across the middle of the screen for a few seconds. */
function announce(title, line) {
  if (bossBannerTitleEl) bossBannerTitleEl.textContent = title;
  if (bossBannerLineEl) bossBannerLineEl.textContent = line;
  if (bossBannerEl) bossBannerEl.style.display = 'flex';
  bossBannerTimer = 4.5;
}

/**
 * How many outposts are empty, and open the door when that reaches four.
 *
 * Counted from `alive` rather than from the kill count, so it is a statement
 * about the rooms rather than a tally that could drift: an outpost is clear
 * when nothing in it is still standing, and it cannot un-clear itself,
 * because the dead do not come back within a run.
 */
function checkOutposts() {
  let clear = 0;
  for (const id of OUTPOSTS) {
    if (!aliens.some((a) => a.room === id && a.alive)) clear++;
  }
  if (clear === outpostsClear) return;

  outpostsClear = clear;
  objectiveEl.textContent = 'OUTPOSTS CLEARED ' + clear + '/' + OUTPOSTS.length;

  if (clear < OUTPOSTS.length) {
    playSound('outpost-clear');
    announce('OUTPOST CLEAR', (OUTPOSTS.length - clear) + ' still holding.');
    return;
  }
  // All four. The bolts draw back and the door opens — and the way through
  // only exists once its wall segment is out of the level's list.
  objectiveEl.classList.add('done');
  objectiveEl.textContent = 'ALL OUTPOSTS CLEAR';
  if (!doorOpened) {
    doorOpened = true;
    playSound('outpost-clear');
    // Heard from wherever you are: it is the whole station's door, and you
    // are meant to know it has moved even if you are nowhere near it.
    playSound('door-grind');
    setLockedDoorOpen(lockedDoor, true);
    const i = walls.indexOf(lockedDoor.wall);
    if (i >= 0) walls.splice(i, 1);
    announce('THE DOOR IS OPEN', 'Every outpost is clear. The Control Room is unsealed.');
  }
}

/**
 * The soldier, once a frame.
 *
 * Freeing him is a proximity check rather than a key: you walked into a
 * hidden room and found a man tied to the floor, and stopping to press a
 * button at him would be the wrong beat entirely.
 *
 * Everything he is allowed to know about the world is assembled here and
 * handed over — which aliens are worth shooting, and whether he can see
 * them. He reports a shot; the damage and the tracer are done out here,
 * because that is where the aliens and the bullets live.
 */
function stepSoldier(dt, dtFrames) {
  if (soldierIsDown(soldier)) { updateSoldier(soldier, null, dtFrames); return; }

  if (!soldierIsFree(soldier)) {
    const near = Math.hypot(ctrl.position.x - soldier.position.x,
                            ctrl.position.z - soldier.position.z);
    if (near < SOLDIER_FX.freeRange && releaseSoldier(soldier)) {
      playSound('soldier-freed');
      announce('CUT HIM LOOSE', 'He picks up his rifle and falls in behind you.');
      soldierFreedAnnounced = true;
    }
    updateSoldier(soldier, { playerPos: ctrl.position, aliens: [] }, dtFrames);
    updateSoldierHud();
    return;
  }

  // Only what he could plausibly shoot: alive, not cleared away, and drawn.
  const shootable = [];
  for (const a of aliens) {
    if (!a.alive || a.gone || !a.model.visible) continue;
    shootable.push(a);
  }

  const event = updateSoldier(soldier, {
    playerPos: ctrl.position,
    playerYaw: ctrl.yaw,
    aliens: shootable,
    canSee: (from, to) => clearShot(
      new THREE.Vector3(from.x, from.y + 1.3, from.z),
      new THREE.Vector3(to.x, to.y + 0.4, to.z)),
    blocked: (x, z) => hitsWall(x, z, 0.4),
  }, dtFrames);

  if (event && event.type === 'shot') {
    bullets.push(createBullet(scene, event.from, event.to));
    flashes.push(createFlash(scene, event.from));
    const a = event.target;
    if (a.alive && !a.gone) {
      a.hp -= event.damage;
      a.flashTimer = 0.1;
      a.reg.hit(a.ai);
      if (a.hp <= 0) {
        a.alive = false;
        a.deathTimer = 0;
        a.reg.kill(a.ai);
        killCount++;
        updateHUD();
      }
    }
  }

  // Anything stood on him takes a bite out of him. This is the only way he
  // dies, and he has to be able to — a companion that cannot be lost is
  // scenery that happens to shoot.
  for (const a of shootable) {
    const d = Math.hypot(a.model.position.x - soldier.position.x,
                         a.model.position.z - soldier.position.z);
    if (d < a.reg.attackRange && soldierCanBeBitten(soldier)) {
      if (hurtSoldier(soldier, a.reg.attackDmg) === 'down') {
        announce('HE IS DOWN', 'You are on your own again.');
      }
      break;
    }
  }
  updateSoldierHud();
}

function updateSoldierHud() {
  if (!soldierHudEl) return;
  if (!soldierIsFree(soldier) || soldierIsDown(soldier)) {
    if (soldierHudEl.style.display !== 'none') soldierHudEl.style.display = 'none';
    return;
  }
  const h = soldierHealth(soldier);
  soldierHudEl.style.display = 'block';
  soldierBarEl.style.width = Math.max(0, (h.hp / h.max) * 100) + '%';
}

/** Are you stood at the pod's hatch with it open? */
function atOpenPod() {
  if (!escapePod.group.userData.unlocked) return false;
  const b = escapePod.board;
  return Math.hypot(ctrl.position.x - b.x, ctrl.position.z - b.z) < 2.2;
}

function tryUsePod() {
  if (!worldIsLive()) return;
  if (atSecretExit()) { leaveSecretRoom(); return; }
  if (atOpenPod()) escapeStation();
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
  if (!boss.active && playerInRoom(boss.roomId)) {
    boss.active = true;
    playSound('boss-roar');
  }
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
      playSound(BOSS_DEATH_SOUND[boss.kind.id] || 'boss-scream');
      killCount++;
      updateHUD();
      // Whichever one it was says so — the banner used to claim the Puppet
      // Master had fallen whatever you had actually just killed.
      announce('BOSS DEFEATED', kind.fell);
      // And the way out comes alive. The bolts blow somewhere across the
      // station and the lamp on the pod turns green.
      setEscapePodUnlocked(escapePod, true);
      // And the wall behind him opens onto space. Its wall segment comes out
      // of the level, though nothing can walk through it anyway — the pod is
      // in the way, and there is nothing out there to walk to.
      setSpaceDoorOpen(spaceDoor, true);
      playSound('space-door');
      const wi = walls.indexOf(spaceDoor.wall);
      if (wi >= 0) walls.splice(wi, 1);
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

// ─── PICKING A CLASS ────────────────────────────────────────
// Drawn fresh each time the title screen comes up, because what is unlocked
// can change between runs — finish as the last of the three and the
// Commander is waiting the moment you come back to this screen.
const classPickerEl = document.getElementById('class-picker');
const difficultyRowEl = document.getElementById('difficulty-row');
const difficultyNoteEl = document.getElementById('difficulty-note');

function drawDifficulty() {
  difficultyRowEl.innerHTML = '';
  for (const d of DIFFICULTIES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = d.name;
    if (difficulty.id === d.id) b.className = 'picked';
    b.addEventListener('click', (e) => {
      e.stopPropagation();           // the overlay itself starts the game
      difficulty = d;
      saveDifficulty(d.id);
      // Health and the aliens' health both move, so the run has to be
      // rebuilt rather than just re-labelled.
      resetRun();
      drawDifficulty();
      drawClassPicker();
    });
    difficultyRowEl.appendChild(b);
  }
  difficultyNoteEl.textContent = difficulty.note;
}
const weaponPickEl = document.getElementById('weapon-pick');

function drawClassPicker() {
  // Read once. Every one of these goes to localStorage, and there are eight
  // cards asking the same three questions.
  const st = unlockState();
  const wins = st.wins;
  const unlocked = commanderUnlocked(wins);
  classPickerEl.innerHTML = '';
  for (const c of CLASSES) {
    const locked = classLocked(c, st);
    const card = document.createElement('div');
    card.className = 'class-card'
      + (locked ? ' locked' : '')
      + (playerClass.id === c.id ? ' picked' : '');
    card.innerHTML =
      '<div class="cname">' + c.name + '</div>' +
      '<div class="cblurb">' + (locked ? lockReason(c, st) : c.blurb) + '</div>' +
      '<div class="cstats">' + c.stats + '</div>' +
      (wins.includes(c.id) ? '<div class="cwon">ESCAPED</div>' : '');
    if (!locked) {
      card.addEventListener('click', (e) => {
        e.stopPropagation();        // the overlay itself starts the game
        playerClass = c;
        applyClass();
        drawClassPicker();
      });
    } else {
      card.addEventListener('click', (e) => e.stopPropagation());
    }
    classPickerEl.appendChild(card);
  }

  // The Commander's choice of weapon, and only the Commander's.
  const showWeapons = playerClass.id === 'commander' && unlocked;
  weaponPickEl.style.display = showWeapons ? 'block' : 'none';
  if (showWeapons) {
    weaponPickEl.innerHTML = 'Weapon: ';
    commanderWeapon = allowedCommanderWeapon(commanderWeapon, st);
    for (const id of unlockedWeapons(st)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = WEAPONS[id].label;
      if (commanderWeapon === id) b.className = 'picked';
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        commanderWeapon = id;
        applyClass();
        drawClassPicker();
      });
      weaponPickEl.appendChild(b);
    }
  }
}
drawClassPicker();
drawDifficulty();

// ─── START ──────────────────────────────────────────────────
startOverlay.addEventListener('click', () => {
  // Nothing starts until there is a name to put in the corner.
  if (nameGateEl && nameGateEl.style.display === 'flex') return;
  startOverlay.style.display = 'none';
  // A browser refuses to play anything until the person has clicked, so this
  // is the first moment the game is allowed to make a sound at all.
  startAudio();
  applyClass();
  // And you do not start on the station. You start in the back of a
  // helicopter, about thirty seconds before anybody takes you off one.
  // `started` stays false until you are on your feet in the Hangar.
  startIntro();
  // Last, and never allowed to take the rest of this with it: a browser
  // that refuses the lock throws, and the cutscene would never have begun.
  try {
    const lock = canvas.requestPointerLock();
    if (lock && lock.catch) lock.catch(() => {});
  } catch (e) { /* the mouse just stays free; clicking the view grabs it */ }
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

  // --- The opening ---
  // Drawn instead of the station, same as the ride down. Nothing below this
  // runs while it is up.
  if (intro) {
    if (intro.camera.aspect !== camera.aspect) {
      intro.camera.aspect = camera.aspect;
      intro.camera.updateProjectionMatrix();
    }
    const over = intro.update(Math.min(dt, 0.05));
    const due = intro.cues();
    if (due) for (const c of due) introCue(c);
    const talk = intro.line();
    showLine(talk);
    // Duck the aircraft under whoever is speaking.
    setLoopGain('rotor', talk ? ROTOR_DUCK : ROTOR_GAIN);
    if (cutFadeEl) cutFadeEl.style.opacity = String(intro.blackness());
    renderer.render(intro.scene, intro.camera);
    // Skipping ends it through this same path, so whether a key did it is
    // the cutscene's business to remember rather than the keyboard's.
    if (over) endIntro(intro.skipped);
    return;
  }
  // And coming round on the floor afterwards, which IS the station — so it
  // falls through and gets drawn with everything else.
  if (waking >= 0) updateWaking(dt);

  const live = worldIsLive();
  // He thinks in frames like the bosses do, not seconds like the aliens.
  const dtFrames = Math.min(dt * 60, 3);

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
    ctrl.speed = bogged ? WEB_SPEED : (playerClass.speed || WALK_SPEED);

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

    // What is under your feet this frame — the floor, or the lid of
    // something you jumped onto.
    const gy = 1.6 + propTopAt(ctrl.position.x, ctrl.position.z);
    ctrl.groundY = gy;
    // And if the ground just dropped out from under you, you are no longer
    // standing on it. The controller only applies gravity when it thinks you
    // are in the air, so without this, walking off a crate walks you out
    // over the floor at crate height and keeps you there.
    if (ctrl.onGround && ctrl.position.y > gy + 0.02) ctrl.onGround = false;
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
    const feet = pos.y - 1.6;
    if (hitsWall(pos.x, prevZ, PLAYER_RADIUS, feet)) pos.x = prevX;
    if (hitsWall(pos.x, pos.z, PLAYER_RADIUS, feet)) pos.z = prevZ;
    camera.position.copy(pos);
  }
  updateGun(gun, dt);

  // Let the banner have its moment and then get out of the way.
  if (bossBannerTimer > 0) {
    bossBannerTimer -= dt;
    if (bossBannerTimer <= 0 && bossBannerEl) bossBannerEl.style.display = 'none';
  }

  // --- The soldier ---
  if (live) stepSoldier(dt, dtFrames);

  // --- Through the board ---
  // Checked here rather than on the jump keypress: you go through when your
  // HEAD is in the right patch of air, not when you press the key, so a jump
  // from further back that carries you into it still counts.
  if (live && !inSecretRoom() && atBoardJump()) enterSecretRoom();

  // --- The locked door ---
  // The check is cheap — twenty-two aliens — and doing it here rather than
  // at each kill means it cannot be missed by a death that happens down some
  // path that forgot to call it.
  if (live) checkOutposts();
  updateLockedDoor(lockedDoor, dt);

  // --- The escape pod ---
  // Its hatch and lamp animate even on the menus: the lamp is scenery, and a
  // door caught halfway open behind the death screen would look broken. The
  // PROMPT is not scenery though — it only belongs on screen while you are
  // actually stood there able to press the key.
  updateEscapePod(escapePod, dt, time);
  updateSpaceDoor(spaceDoor, dt);

  // One prompt, whichever thing you are stood at.
  let promptText = null;
  if (live && atSecretExit()) promptText = 'E — LEAVE';
  else if (live && atOpenPod()) promptText = 'E — LAUNCH';
  const promptWanted = promptText ? 'block' : 'none';
  if (usePromptEl.style.display !== promptWanted) {
    usePromptEl.style.display = promptWanted;
  }
  if (promptText && usePromptEl.textContent !== promptText) {
    usePromptEl.textContent = promptText;
  }

  // --- Damage flash decay ---
  if (dmgFlashTimer > 0) {
    dmgFlashTimer -= dt;
    dmgFlashEl.style.opacity = String(Math.max(0, dmgFlashTimer / 0.3));
  }

  // --- Shooting ---
  // Rate of fire belongs to the weapon now. A click asks to shoot; whether
  // it actually does depends on whether the thing in your hands is ready.
  // An automatic weapon keeps asking for as long as the trigger is held.
  if (shotCooldown > 0) shotCooldown -= dt;
  const w = gun.weapon;
  const wantsToFire = ctrl.shootRequested || (w.auto && ctrl.shootHeld);
  ctrl.shootRequested = false;
  if (wantsToFire && shotCooldown <= 0) {
    shotCooldown = w.fireEvery;
    if (live) {
      gun.recoilTime = w.fireEvery > 0.5 ? 0.2 : 0.08;
      // What leaves the weapon. Everything but the RPG puts a line
      // through the air and resolves instantly; the RPG puts an object
      // in the air and resolves wherever that object stops.
      playSound(GUN_SOUND[gun.id] || 'gun-assault');
      if (w.rocket) fireRocketShot(w);
      else fireHitscanShot(w);
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

    // ─── STRAGGLERS GO HOME ───────────────────────────────────
    //
    // FLETCHER'S GUIDE:
    // Anything that chased you out of its outpost and then lost you is
    // frozen exactly where it stopped, because parked aliens do not think.
    // It stands in that corridor for the rest of the run, alive — and an
    // outpost is counted clear when nothing BELONGING to it is still
    // standing, so the room you emptied goes on reporting itself as held.
    // You are told four are holding when three are, and there is nothing in
    // any of the four rooms to kill.
    //
    // A parked alien is also invisible, so putting it back where it started
    // cannot be seen happening. It only ever moves while no one is looking,
    // and it means a straggler is always findable in the room whose name is
    // on it. Anything still inside its own room is left where it wandered.
    if (!active && a.alive && !a.gone &&
        roomIdAt(a.model.position.x, a.model.position.z) !== a.room) {
      a.model.position.copy(a.spawnPos);
      if (a.reg.rest) a.reg.rest(a.model);      // drop a half-fired beam
      a.ai = a.reg.createAI();                  // and come home idle
      a.model.userData.ai = a.ai;
    }

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
    //
    // The clock it runs on is scaled by the difficulty. Every module moves by
    // `something * dt * 60`, so a longer frame is a longer stride — but the
    // Crawler, Floater and Brute count their state timers in frames, not
    // seconds, so their wind-ups, pounce arcs and recoveries keep their real
    // length. They close on you faster without their tells getting shorter,
    // which is the version of "faster" you can still read and play against.
    const aiEvent = a.reg.updateAI(a.model, a.ai, ctrl.position, dt * difficulty.speed);

    // ...and then take back any of that movement that went through a wall.
    // Dead ones are left alone — their collapse is an animation, and a body
    // slumping half into a wall beats one that twitches as it falls.
    if (a.alive) keepOutOfWalls(a.model.position, wasX, wasZ, a.reg.bodyRadius || 0.6);

    // The Watcher opening up. This is the only warning you get before its
    // beam, which lands the frame it fires, so it is the most important
    // sound in the game — hear it and you have about a second to break
    // line of sight.
    if (a.type === 'watcher' && a.ai.state === 'charge' && a.heard !== 'charge') {
      playSound('watcher-charge', { dist });
    }
    if (a.type !== 'watcher' || a.ai.state !== a.heard) a.heard = a.ai.state;

    // Footfalls, paced by ground actually covered rather than by a timer —
    // an alien standing still should not be walking on the spot, and one
    // sprinting should not sound like one strolling.
    if (a.alive && a.reg.stepSound) {
      a.stepRun = (a.stepRun || 0)
        + Math.hypot(a.model.position.x - wasX, a.model.position.z - wasZ);
      if (a.stepRun >= a.reg.stepEvery) {
        a.stepRun = 0;
        playSound(a.reg.stepSound, { dist });
      }
    }

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
      if (aiEvent && (aiEvent.type === 'ground_slam' || aiEvent.type === 'eye_beam')) {
        playSound(aiEvent.type === 'eye_beam' ? 'watcher-beam' : 'brute-slam',
                  { dist });
        damagePlayer(a.reg.attackDmg);
      }
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
        playSound('floater-blast', { dist });
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
    projPrev.copy(p.mesh.position);
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
    // Hit wall? The whole step is tested, not just where it ended up — a
    // bolt moving a quarter of a unit a frame would otherwise step straight
    // over anything thinner than that.
    const pp = p.mesh.position;
    if (pp.y < 0 || pp.y > ceilingY) { removeProjectile(p); return false; }
    if (!clearShot(projPrev, pp)) { removeProjectile(p); return false; }
    return true;
  });

  // --- Everything that is heard rather than seen ---
  updateSoundscape(dt, live);

  // --- Your rockets, your grenades, and the fire they leave ---
  updateOrdnance(dt, live);

  // --- Wounds closing ---
  if (live) healOverTime(dt);

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
    // The hidden room has no painted floor, so the station does not know a
    // name for it — left to itself the HUD would keep showing ARMORY, the
    // last real room you were in, while you stood somewhere else entirely.
    if (inSecretRoom()) {
      roomLabelEl.textContent = 'BEHIND THE BOARD';
    } else {
      const rm = placeNameAt(ctrl.position.x, ctrl.position.z);
      if (rm) roomLabelEl.textContent = rm;
    }
  }

  // --- Render ---
  // The cutscene draws instead of the station, not as well as it.
  if (descent) {
    // It is built once and the window can change size under it, so its
    // camera is kept in step with the one the game uses.
    if (descent.camera.aspect !== camera.aspect) {
      descent.camera.aspect = camera.aspect;
      descent.camera.updateProjectionMatrix();
    }
    // A tab left in the background hands back one enormous frame; without
    // the clamp the whole ride down happens between two paints.
    const over = descent.update(Math.min(dt, 0.05));
    if (cutFadeEl) cutFadeEl.style.opacity = String(descent.blackness());
    if (descentTextEl) {
      const cap = descent.caption();
      if (descentLine1El) descentLine1El.textContent = cap.one;
      if (descentLine2El) descentLine2El.textContent = cap.two;
      descentTextEl.style.opacity = String(cap.alpha);
      // A key under each new character — but only ever one a frame, so a
      // dropped frame taps once instead of letting off a burst.
      if (cap.typed > descentTyped) {
        if (cap.alpha > 0.05) playSound('type-key');
        descentTyped = cap.typed;
      }
    }
    renderer.render(descent.scene, descent.camera);
    if (over) endDescent();
    return;
  }
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
    /** Win on demand, so the ride down can be watched without earning it. */
    escape() { escaped = false; escapeStation(); },
    /** Come round on the Hangar floor without sitting through the ride
     *  in. `true` for the shorter version a key press leaves you. */
    wakeUp(skipped) {
      if (intro) { intro.dispose(); intro = null; }
      document.body.classList.add('in-cutscene');
      if (cutFadeEl) cutFadeEl.style.display = 'block';
      started = false;
      waking = skipped ? WAKE_BLINK - 0.25 : 0;
      return true;
    },
    /** Put any weapon in your hands, whether or not it is unlocked — for
     *  checking that every one of them still shoots. */
    arm(id) {
      if (!WEAPONS[id]) return Object.keys(WEAPONS);
      swapGun(id);
      shotCooldown = 0;
      return id;
    },
    /** Pull the trigger once from the console, along the current aim. */
    fire() { ctrl.shootRequested = true; return true; },
    /** Which voice each speaker ended up with on this machine. */
    cast() { return castList(); },
    /** Watch the opening again without reloading the page. */
    replayIntro() { if (!intro) { waking = -1; startIntro(); } return true; },
    get introAt() { return intro ? intro.at : -1; },
    /** The whole cutscene object, for poking at a frame from the console. */
    get introObj() { return intro; },
    introSeek(sec) { if (intro) intro.seek(sec); return intro ? intro.at : -1; },
    /** Where the cutscene has got to, in seconds. */
    get descentAt() { return descent ? descent.at : -1; },
    /** Hold the cutscene on the frame at a given second, to look at it. */
    descentSeek(sec) { if (descent) descent.seek(sec); return descent ? descent.at : -1; },
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
