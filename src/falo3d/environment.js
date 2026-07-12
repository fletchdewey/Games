// --- RUINED BUILDINGS (both sides of the street) ---
const buildingFires = []; // track fire positions for animated lights

function createRuinedBuilding(x, z, w, d, maxH, damage) {
  const group = new THREE.Group();
  const floors = 3 + Math.floor(rand() * 6);
  const floorH = 3;
  const actualH = Math.min(floors * floorH, maxH);

  // Main structure
  const bodyGeo = new THREE.BoxGeometry(w, actualH, d);
  const body = new THREE.Mesh(bodyGeo, concreteMat);
  body.position.y = actualH / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Window holes (dark recesses on front face)
  for (let fy = floorH; fy < actualH - 1; fy += floorH) {
    for (let wx = -w/2 + 1.5; wx < w/2 - 0.5; wx += 2.5) {
      if (rand() > damage) {
        // Intact-ish window
        const winGeo = new THREE.BoxGeometry(1.2, 1.8, 0.3);
        const win = new THREE.Mesh(winGeo, new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
        win.position.set(wx, fy + 1, d/2);
        group.add(win);
        // Some still have glass
        if (rand() > 0.6) {
          const glassGeo = new THREE.BoxGeometry(1.0, 1.5, 0.05);
          const glass = new THREE.Mesh(glassGeo, glassMat);
          glass.position.set(wx, fy + 1, d/2 + 0.15);
          group.add(glass);
        }
      } else {
        // Blown-out window
        const holeGeo = new THREE.BoxGeometry(1.5 + rand(), 2 + rand(), 0.5);
        const hole = new THREE.Mesh(holeGeo, new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
        hole.position.set(wx, fy + 1, d/2);
        group.add(hole);
      }
    }
  }

  // Damage chunks removed (top of building)
  if (damage > 0.3) {
    const chunkH = actualH * (0.1 + rand() * 0.3);
    const chunkW = w * (0.3 + rand() * 0.4);
    const chunkGeo = new THREE.BoxGeometry(chunkW, chunkH, d * 0.8);
    const chunk = new THREE.Mesh(chunkGeo, new THREE.MeshLambertMaterial({ color: 0x1a1008 }));
    chunk.position.set((rand()-0.5) * w * 0.3, actualH - chunkH/2 + 0.1, 0);
    group.add(chunk);
  }

  // Rebar at broken edges
  for (let r = 0; r < 3 + Math.floor(rand()*4); r++) {
    const rLen = 1 + rand() * 3;
    const rGeo = new THREE.CylinderGeometry(0.03, 0.03, rLen, 4);
    const rMesh = new THREE.Mesh(rGeo, rebarMat);
    rMesh.position.set((rand()-0.5)*w*0.4, actualH - rand()*2, (rand()-0.5)*d*0.3);
    rMesh.rotation.x = (rand()-0.5) * 1.2;
    rMesh.rotation.z = (rand()-0.5) * 1.2;
    group.add(rMesh);
  }

  // Floor slab edges visible
  for (let fy = floorH; fy < actualH; fy += floorH) {
    const slabGeo = new THREE.BoxGeometry(w + 0.2, 0.3, d + 0.2);
    const slab = new THREE.Mesh(slabGeo, concreteDkMat);
    slab.position.y = fy;
    group.add(slab);
  }

  // Scorch marks
  for (let s = 0; s < 2 + Math.floor(rand()*3); s++) {
    const scorchGeo = new THREE.PlaneGeometry(2 + rand()*3, 3 + rand()*4);
    const scorch = new THREE.Mesh(scorchGeo, new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.5 }));
    scorch.position.set((rand()-0.5)*w*0.3, rand()*actualH, d/2 + 0.16);
    group.add(scorch);
  }

  group.position.set(x, 0, z);
  scene.add(group);

  return { x, z, w, d, h: actualH, group };
}

// Buildings lining all 4 corridor segments + corridor walls at turns
// Helper: place buildings along a segment
function placeBuildingsAlongSegment(axis, fixedCoord, start, end, step) {
  // axis='z' means corridor runs along z, buildings offset on x
  // axis='x' means corridor runs along x, buildings offset on z
  const inc = start < end ? step : -step;
  for (let t = start; (inc > 0 ? t < end : t > end); t += inc) {
    const w = 8 + rand() * 10;
    const d = 6 + rand() * 8;
    const h = 15 + rand() * 30;
    const damage = 0.2 + rand() * 0.6;

    let bL, bR;
    if (axis === 'z') {
      bL = createRuinedBuilding(fixedCoord - 18 - d/2 - rand()*3, t, w, d, h, damage);
      bR = createRuinedBuilding(fixedCoord + 18 + d/2 + rand()*3, t, w, d, h, damage);
    } else {
      bL = createRuinedBuilding(t, fixedCoord - 18 - d/2 - rand()*3, w, d, h, damage);
      bR = createRuinedBuilding(t, fixedCoord + 18 + d/2 + rand()*3, w, d, h, damage);
    }
    platformData.push({ x: bL.x - bL.w/2, y: 0, z: bL.z - bL.d/2, w: bL.w, h: bL.h, d: bL.d });
    platformData.push({ x: bR.x - bR.w/2, y: 0, z: bR.z - bR.d/2, w: bR.w, h: bR.h, d: bR.d });

    if (rand() > 0.4) {
      const side = rand() > 0.5 ? bL : bR;
      buildingFires.push({ x: side.x, y: 2 + rand() * side.h * 0.5, z: side.z });
    }
  }
}

// Seg 1: straight corridor along z, centered at x=0
placeBuildingsAlongSegment('z', 0, 5, -150, 14);
// Seg 2: corridor along x, centered at z=-150
placeBuildingsAlongSegment('x', -150, -5, -145, 14);
// Seg 3: corridor along z, centered at x=-150
placeBuildingsAlongSegment('z', -150, -155, -295, 14);
// Seg 4: corridor along x, centered at z=-300
placeBuildingsAlongSegment('x', -300, -145, -5, 14);

// --- CORRIDOR WALLS AT TURNS (block the straight path, force turns) ---
const wallMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
// Turn 1: at z=-150, block straight ahead — wall across the end of seg 1
const t1Geo = new THREE.BoxGeometry(30, 12, 4);
const t1 = new THREE.Mesh(t1Geo, wallMat);
t1.position.set(0, 6, -150 - CORRIDOR_HALF - 2);
t1.castShadow = true;
scene.add(t1);
platformData.push({ x: -15, y: 0, z: -150 - CORRIDOR_HALF - 4, w: 30, h: 12, d: 4 });

// Turn 2: at x=-150, z=-150 — block going further left, force turn down
const t2Geo = new THREE.BoxGeometry(4, 12, 30);
const t2 = new THREE.Mesh(t2Geo, wallMat);
t2.position.set(-150 - CORRIDOR_HALF - 2, 6, -150);
t2.castShadow = true;
scene.add(t2);
platformData.push({ x: -150 - CORRIDOR_HALF - 4, y: 0, z: -165, w: 4, h: 12, d: 30 });

// Turn 3: at x=-150, z=-300 — block going further down, force turn right
const t3Geo = new THREE.BoxGeometry(30, 12, 4);
const t3 = new THREE.Mesh(t3Geo, wallMat);
t3.position.set(-150, 6, -300 - CORRIDOR_HALF - 2);
t3.castShadow = true;
scene.add(t3);
platformData.push({ x: -165, y: 0, z: -300 - CORRIDOR_HALF - 4, w: 30, h: 12, d: 4 });

// --- CONTINUOUS CORRIDOR WALLS (visible building facades along both sides) ---
const corridorWallMat = new THREE.MeshLambertMaterial({ color: 0x3a3632 });
const corridorWallDkMat = new THREE.MeshLambertMaterial({ color: 0x2a2622 });

function addCorridorWalls(axis, fixedCoord, start, end, step) {
  // Adds tall wall segments along both sides of a corridor
  const ch = CORRIDOR_HALF;
  const wallH = 10 + Math.random() * 5;
  const wallThick = 3;
  const inc = start < end ? step : -step;

  for (let t = start; (inc > 0 ? t < end : t > end); t += inc) {
    const segH = 8 + Math.random() * 8;
    const segLen = Math.abs(step) - 0.5;

    for (const side of [-1, 1]) {
      const wGeo = new THREE.BoxGeometry(
        axis === 'z' ? wallThick : segLen,
        segH,
        axis === 'z' ? segLen : wallThick
      );
      const mat = Math.random() > 0.5 ? corridorWallMat : corridorWallDkMat;
      const wall = new THREE.Mesh(wGeo, mat);

      if (axis === 'z') {
        wall.position.set(fixedCoord + side * (ch + wallThick/2), segH/2, t);
      } else {
        wall.position.set(t, segH/2, fixedCoord + side * (ch + wallThick/2));
      }
      wall.castShadow = true;
      wall.receiveShadow = true;
      scene.add(wall);

      // Window holes for visual interest
      if (segH > 10 && Math.random() > 0.4) {
        for (let wy = 4; wy < segH - 2; wy += 4) {
          const winGeo = new THREE.BoxGeometry(
            axis === 'z' ? wallThick + 0.2 : 1.5,
            2,
            axis === 'z' ? 1.5 : wallThick + 0.2
          );
          const win = new THREE.Mesh(winGeo, new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
          if (axis === 'z') {
            win.position.set(fixedCoord + side * (ch + wallThick/2), wy, t + (Math.random()-0.5) * segLen * 0.5);
          } else {
            win.position.set(t + (Math.random()-0.5) * segLen * 0.5, wy, fixedCoord + side * (ch + wallThick/2));
          }
          scene.add(win);
        }
      }

      // Jagged top (damage)
      for (let j = 0; j < 3; j++) {
        const jh = 1 + Math.random() * 2;
        const jGeo = new THREE.BoxGeometry(
          axis === 'z' ? wallThick * 0.8 : segLen * 0.3,
          jh,
          axis === 'z' ? segLen * 0.3 : wallThick * 0.8
        );
        const jMesh = new THREE.Mesh(jGeo, corridorWallDkMat);
        if (axis === 'z') {
          jMesh.position.set(fixedCoord + side * (ch + wallThick/2), segH + jh/2, t + (Math.random()-0.5) * segLen * 0.6);
        } else {
          jMesh.position.set(t + (Math.random()-0.5) * segLen * 0.6, segH + jh/2, fixedCoord + side * (ch + wallThick/2));
        }
        scene.add(jMesh);
      }
    }
  }
}

// Seg 1: along z at x=0
addCorridorWalls('z', 0, 5, -148, -8);
// Seg 2: along x at z=-150
addCorridorWalls('x', -150, -5, -148, -8);
// Seg 3: along z at x=-150
addCorridorWalls('z', -150, -155, -298, -8);
// Seg 4: along x at z=-300
addCorridorWalls('x', -300, -148, -5, 8);

// --- FIRES & FIRE LIGHTS ---
const fireLights = [];
for (const f of buildingFires) {
  // Point light for fire glow
  const light = new THREE.PointLight(0xff4400, 2, 25);
  light.position.set(f.x, f.y, f.z);
  scene.add(light);
  fireLights.push(light);

  // Static fire meshes (flickering handled in update loop)
  for (let i = 0; i < 5; i++) {
    const fGeo = new THREE.ConeGeometry(0.3 + Math.random()*0.5, 1 + Math.random()*2, 4);
    const fMesh = new THREE.Mesh(fGeo, Math.random() > 0.5 ? fireMat : fireGlowMat);
    fMesh.position.set(f.x + (Math.random()-0.5)*2, f.y + Math.random()*1.5, f.z + (Math.random()-0.5)*2);
    scene.add(fMesh);
  }
}

// Additional ground-level fires along the street
const streetFires = [];
for (let z = 0; z > -LEVEL_LENGTH; z -= 20) {
  if (rand() > 0.5) {
    const fx = (rand()-0.5) * 20;
    const light = new THREE.PointLight(0xff6600, 1.5, 15);
    light.position.set(fx, 1.5, z);
    scene.add(light);
    streetFires.push(light);
    // Fire cones
    for (let i = 0; i < 4; i++) {
      const fGeo = new THREE.ConeGeometry(0.2 + rand()*0.4, 0.8 + rand()*1.5, 4);
      const fMesh = new THREE.Mesh(fGeo, rand() > 0.5 ? fireMat : fireGlowMat);
      fMesh.position.set(fx + (rand()-0.5)*1.5, 0.5 + rand()*0.8, z + (rand()-0.5)*1.5);
      scene.add(fMesh);
    }
    // Burning vehicle wreck sometimes
    if (rand() > 0.6) {
      const carGeo = new THREE.BoxGeometry(2 + rand(), 1.2, 4 + rand()*2);
      const car = new THREE.Mesh(carGeo, new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
      car.position.set(fx, 0.6, z);
      car.rotation.y = (rand()-0.5) * 0.8;
      car.castShadow = true;
      scene.add(car);
      // Wheels
      for (const wx of [-0.8, 0.8]) {
        for (const wz of [-1.2, 1.2]) {
          const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.2, 6);
          wheelGeo.rotateZ(Math.PI/2);
          const wheel = new THREE.Mesh(wheelGeo, new THREE.MeshLambertMaterial({ color: 0x111111 }));
          wheel.position.set(fx + wx, 0.35, z + wz);
          scene.add(wheel);
        }
      }
    }
  }
}

// --- SMOKE COLUMNS ---
const smokeParticles = [];
for (const f of buildingFires) {
  for (let i = 0; i < 8; i++) {
    const sGeo = new THREE.SphereGeometry(1 + Math.random()*2, 5, 5);
    const sMesh = new THREE.Mesh(sGeo, smokeMat.clone());
    sMesh.position.set(f.x + (Math.random()-0.5)*3, f.y + 3 + i * 4 + Math.random()*5, f.z + (Math.random()-0.5)*3);
    scene.add(sMesh);
    smokeParticles.push({ mesh: sMesh, baseY: sMesh.position.y, baseX: sMesh.position.x, speed: 0.2 + Math.random()*0.3 });
  }
}

// --- DESTROYED SKYLINE (distant, centered on map) ---
const mapCenterX = -75, mapCenterZ = -150;
for (let i = 0; i < 40; i++) {
  const angle = (i / 40) * Math.PI * 2;
  const dist = 180 + rand() * 80;
  const h = 20 + rand() * 50;
  const w = 8 + rand() * 15;
  const d = 8 + rand() * 12;
  const geo = new THREE.BoxGeometry(w, h, d);
  const brightness = 0.05 + rand() * 0.08;
  const mat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(brightness, brightness * 0.9, brightness * 0.8)
  });
  const bldg = new THREE.Mesh(geo, mat);
  bldg.position.set(mapCenterX + Math.cos(angle) * dist, h / 2, mapCenterZ + Math.sin(angle) * dist);
  bldg.rotation.y = rand() * Math.PI;
  scene.add(bldg);

  // Skip skyline lights — invisible through fog at 180+ units
  rand();
}

// Ember particles spread across all segments
const embers = [];
const emberGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
// Helper: random point along the path
function randomPathPoint() {
  const seg = Math.floor(rand() * 4);
  if (seg === 0) return { x: (rand()-0.5)*24, z: -rand()*150 };
  if (seg === 1) return { x: -rand()*150, z: -150 + (rand()-0.5)*20 };
  if (seg === 2) return { x: -150 + (rand()-0.5)*24, z: -150 - rand()*150 };
  return { x: -150 + rand()*150, z: -300 + (rand()-0.5)*20 };
}
for (let i = 0; i < 80; i++) {
  const pt = randomPathPoint();
  const eMesh = new THREE.Mesh(emberGeo, emberMat);
  eMesh.position.set(pt.x, 1 + rand()*15, pt.z);
  scene.add(eMesh);
  embers.push({ mesh: eMesh, speed: 0.01 + rand()*0.03, drift: (rand()-0.5)*0.02, baseY: eMesh.position.y });
}

// Fires on destroyed vehicles
const vehicleFirePositions = [
  { x: -6, z: -25, h: 2 }, { x: 8, z: -50, h: 1.5 },
  { x: 5, z: -130, h: 2.5 },
  { x: -70, z: -155, h: 2 }, { x: -110, z: -148, h: 1.5 },
  { x: -145, z: -180, h: 2 }, { x: -155, z: -220, h: 1.5 },
  { x: -120, z: -295, h: 2 }, { x: -30, z: -298, h: 1.5 },
];
for (const vf of vehicleFirePositions) {
  if (rand() > 0.3) {
    const fl = new THREE.PointLight(0xff4400, 1.5, 10);
    fl.position.set(vf.x, vf.h, vf.z);
    scene.add(fl);
    streetFires.push(fl);
    for (let f = 0; f < 3; f++) {
      const fGeo = new THREE.ConeGeometry(0.15 + rand()*0.3, 0.6 + rand()*1.2, 4);
      const fMesh = new THREE.Mesh(fGeo, rand() > 0.5 ? fireMat : fireGlowMat);
      fMesh.position.set(vf.x + (rand()-0.5)*1.5, vf.h + rand()*0.5, vf.z + (rand()-0.5)*1.5);
      scene.add(fMesh);
    }
    for (let s = 0; s < 4; s++) {
      const sGeo = new THREE.SphereGeometry(0.6 + rand(), 4, 4);
      const sMesh = new THREE.Mesh(sGeo, smokeMat.clone());
      sMesh.position.set(vf.x + (rand()-0.5)*2, vf.h + 2 + s * 2.5 + rand()*2, vf.z + (rand()-0.5)*2);
      scene.add(sMesh);
      smokeParticles.push({ mesh: sMesh, baseY: sMesh.position.y, baseX: sMesh.position.x, speed: 0.15 + rand()*0.25 });
    }
  }
}

// Collect all fire/ambient lights for distance culling
const allFireLights = [...fireLights, ...streetFires];

// --- EXTRACTION HELICOPTER ---
const heloMat = new THREE.MeshLambertMaterial({ color: 0x3a4a3a }); // olive drab
const heloDkMat = new THREE.MeshLambertMaterial({ color: 0x2a3a2a });
const heloGlassMat = new THREE.MeshLambertMaterial({ color: 0x2a4a5a, transparent: true, opacity: 0.6 });
const heloRotorMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });

const shipGroup = new THREE.Group();

// --- Fuselage (main body) ---
// Center body
const fuseGeo = new THREE.BoxGeometry(2.8, 2.2, 8);
const fuse = new THREE.Mesh(fuseGeo, heloMat);
fuse.position.set(0, 0, 0);
fuse.castShadow = true;
shipGroup.add(fuse);

// Tapered nose
const noseGeo = new THREE.BoxGeometry(2.2, 1.6, 2.5);
const nose = new THREE.Mesh(noseGeo, heloMat);
nose.position.set(0, -0.2, -5);
nose.castShadow = true;
shipGroup.add(nose);

// Nose tip
const noseTipGeo = new THREE.BoxGeometry(1.4, 1, 1.5);
const noseTip = new THREE.Mesh(noseTipGeo, heloMat);
noseTip.position.set(0, -0.4, -6.5);
shipGroup.add(noseTip);

// Cockpit windshield (angled glass panels)
const windGeo = new THREE.BoxGeometry(2, 1.4, 1.8);
const wind = new THREE.Mesh(windGeo, heloGlassMat);
wind.position.set(0, 0.3, -5.2);
wind.rotation.x = 0.25;
shipGroup.add(wind);

// Side windows
for (const sx of [-1.42, 1.42]) {
  const sWinGeo = new THREE.BoxGeometry(0.08, 0.8, 2);
  const sWin = new THREE.Mesh(sWinGeo, heloGlassMat);
  sWin.position.set(sx, 0.3, -4.5);
  shipGroup.add(sWin);
}

// Cabin door openings (open side doors)
for (const sx of [-1.41, 1.41]) {
  const doorGeo = new THREE.BoxGeometry(0.1, 1.5, 2.2);
  const door = new THREE.Mesh(doorGeo, new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  door.position.set(sx, -0.1, -0.5);
  shipGroup.add(door);
}

// Rear fuselage taper
const rearGeo = new THREE.BoxGeometry(2.2, 1.6, 2);
const rear = new THREE.Mesh(rearGeo, heloMat);
rear.position.set(0, 0.2, 4.5);
shipGroup.add(rear);

// --- Tail boom ---
const tailBoomGeo = new THREE.BoxGeometry(0.8, 0.8, 6);
const tailBoom = new THREE.Mesh(tailBoomGeo, heloDkMat);
tailBoom.position.set(0, 0.6, 8.2);
tailBoom.castShadow = true;
shipGroup.add(tailBoom);

// Tail boom taper
const tailTaperGeo = new THREE.BoxGeometry(0.6, 0.6, 2);
const tailTaper = new THREE.Mesh(tailTaperGeo, heloDkMat);
tailTaper.position.set(0, 0.6, 11.5);
shipGroup.add(tailTaper);

// Horizontal stabilizers
for (const sx of [-1.2, 1.2]) {
  const stabGeo = new THREE.BoxGeometry(2.4, 0.12, 1.2);
  const stab = new THREE.Mesh(stabGeo, heloMat);
  stab.position.set(sx * 0.8, 0.7, 11);
  shipGroup.add(stab);
}

// Vertical tail fin
const finGeo = new THREE.BoxGeometry(0.12, 2, 1.5);
const fin = new THREE.Mesh(finGeo, heloMat);
fin.position.set(0, 1.8, 12);
fin.castShadow = true;
shipGroup.add(fin);

// --- Tail rotor ---
const tailRotorGroup = new THREE.Group();
for (let i = 0; i < 4; i++) {
  const bladeGeo = new THREE.BoxGeometry(0.08, 1.2, 0.2);
  const blade = new THREE.Mesh(bladeGeo, heloRotorMat);
  blade.position.y = 0.6;
  const bladeHolder = new THREE.Group();
  bladeHolder.add(blade);
  bladeHolder.rotation.z = (i / 4) * Math.PI * 2;
  tailRotorGroup.add(bladeHolder);
}
const tailRotorHub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.15, 6), heloRotorMat);
tailRotorGroup.add(tailRotorHub);
tailRotorGroup.position.set(0.15, 1.8, 12.5);
tailRotorGroup.rotation.x = Math.PI / 2;
shipGroup.add(tailRotorGroup);

// --- Main rotor mast ---
const mastGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.2, 6);
const mast = new THREE.Mesh(mastGeo, heloRotorMat);
mast.position.set(0, 1.8, -0.5);
shipGroup.add(mast);

// Rotor hub
const hubGeo = new THREE.CylinderGeometry(0.3, 0.25, 0.3, 8);
const hub = new THREE.Mesh(hubGeo, heloRotorMat);
hub.position.set(0, 2.5, -0.5);
shipGroup.add(hub);

// --- Main rotor blades (separate group for spinning) ---
const mainRotorGroup = new THREE.Group();
for (let i = 0; i < 4; i++) {
  const bladeGeo = new THREE.BoxGeometry(9, 0.06, 0.5);
  const blade = new THREE.Mesh(bladeGeo, heloRotorMat);
  blade.position.x = 4.5;
  const bladeArm = new THREE.Group();
  bladeArm.add(blade);
  bladeArm.rotation.y = (i / 4) * Math.PI * 2;
  mainRotorGroup.add(bladeArm);
}
mainRotorGroup.position.set(0, 2.65, -0.5);
shipGroup.add(mainRotorGroup);

// --- Engine nacelles (top of fuselage) ---
for (const sx of [-0.7, 0.7]) {
  const nacGeo = new THREE.BoxGeometry(1, 0.7, 2.5);
  const nac = new THREE.Mesh(nacGeo, heloDkMat);
  nac.position.set(sx, 1.4, 0);
  shipGroup.add(nac);
  // Exhaust
  const exhGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.8, 6);
  exhGeo.rotateX(Math.PI / 2);
  const exh = new THREE.Mesh(exhGeo, new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  exh.position.set(sx, 1.4, 1.5);
  shipGroup.add(exh);
}

// --- Landing gear (skids) ---
for (const sx of [-1.3, 1.3]) {
  // Skid rail
  const skidGeo = new THREE.BoxGeometry(0.15, 0.15, 5);
  const skid = new THREE.Mesh(skidGeo, heloRotorMat);
  skid.position.set(sx, -1.8, -1);
  shipGroup.add(skid);
  // Struts
  for (const sz of [-2, 1]) {
    const strutGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.9, 4);
    const strut = new THREE.Mesh(strutGeo, heloRotorMat);
    strut.position.set(sx, -1.35, sz);
    shipGroup.add(strut);
    // Cross-bar (angled)
    const xBarGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.1, 4);
    const xBar = new THREE.Mesh(xBarGeo, heloRotorMat);
    xBar.position.set(sx * 0.8, -1.2, sz);
    xBar.rotation.z = sx > 0 ? 0.3 : -0.3;
    shipGroup.add(xBar);
  }
}

// --- Minigun on side (mounted) ---
const gunMountGeo = new THREE.BoxGeometry(0.3, 0.3, 0.8);
const gunMount = new THREE.Mesh(gunMountGeo, new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
gunMount.position.set(-1.5, -0.5, -0.5);
shipGroup.add(gunMount);
const minigunGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.5, 6);
minigunGeo.rotateX(Math.PI / 2);
const minigun = new THREE.Mesh(minigunGeo, new THREE.MeshLambertMaterial({ color: 0x222222 }));
minigun.position.set(-1.5, -0.5, -1.5);
shipGroup.add(minigun);

// Minigun muzzle flash (toggled by door gunner logic)
const heloMuzzleGeo = new THREE.SphereGeometry(0.15, 4, 4);
const heloMuzzle = new THREE.Mesh(heloMuzzleGeo, marineMuzzleMat);
heloMuzzle.position.set(-1.5, -0.5, -2.3);
heloMuzzle.visible = false;
heloMuzzle.name = 'heloMuzzle';
shipGroup.add(heloMuzzle);

// --- Crew Chief (standing at right door, waving players in) ---
const crewChief = new THREE.Group();
// Boots
for (const lx of [-0.08, 0.08]) {
  const bootGeo = new THREE.BoxGeometry(0.1, 0.14, 0.15);
  const boot = new THREE.Mesh(bootGeo, marineBootMat);
  boot.position.set(lx, -1.1, 0);
  crewChief.add(boot);
}
// Legs
for (const lx of [-0.08, 0.08]) {
  const legGeo = new THREE.BoxGeometry(0.11, 0.28, 0.11);
  const leg = new THREE.Mesh(legGeo, marineFatiguesDkMat);
  leg.position.set(lx, -0.82, 0);
  crewChief.add(leg);
}
// Torso
const ccTorsoGeo = new THREE.BoxGeometry(0.28, 0.3, 0.16);
const ccTorso = new THREE.Mesh(ccTorsoGeo, marineFatiguesMat);
ccTorso.position.set(0, -0.52, 0);
crewChief.add(ccTorso);
// Vest
const ccVestGeo = new THREE.BoxGeometry(0.26, 0.22, 0.18);
const ccVest = new THREE.Mesh(ccVestGeo, marineVestMat);
ccVest.position.set(0, -0.5, 0);
crewChief.add(ccVest);
// Head
const ccHeadGeo = new THREE.BoxGeometry(0.16, 0.17, 0.16);
const ccHead = new THREE.Mesh(ccHeadGeo, marineSkinMat);
ccHead.position.set(0, -0.28, 0);
crewChief.add(ccHead);
// Helmet
const ccHelmetGeo = new THREE.SphereGeometry(0.12, 6, 5);
ccHelmetGeo.scale(1.05, 0.85, 1.1);
const ccHelmet = new THREE.Mesh(ccHelmetGeo, marineHelmetMat);
ccHelmet.position.set(0, -0.22, 0);
crewChief.add(ccHelmet);
// Left arm (down at side, holding door frame)
const ccArmLGeo = new THREE.BoxGeometry(0.08, 0.3, 0.08);
const ccArmL = new THREE.Mesh(ccArmLGeo, marineFatiguesMat);
ccArmL.position.set(-0.2, -0.6, 0);
crewChief.add(ccArmL);
// Right arm (waving — animated in update loop)
const ccArmR = new THREE.Group();
const ccArmRGeo = new THREE.BoxGeometry(0.08, 0.3, 0.08);
const ccArmRMesh = new THREE.Mesh(ccArmRGeo, marineFatiguesMat);
ccArmRMesh.position.y = -0.15;
ccArmR.add(ccArmRMesh);
// Hand
const ccHandGeo = new THREE.BoxGeometry(0.07, 0.06, 0.08);
const ccHand = new THREE.Mesh(ccHandGeo, marineSkinMat);
ccHand.position.y = -0.32;
ccArmR.add(ccHand);
ccArmR.position.set(0.2, -0.45, 0.05);
ccArmR.name = 'waveArm';
crewChief.add(ccArmR);

crewChief.position.set(1.3, 0, -0.5);
crewChief.rotation.y = Math.PI / 2;
shipGroup.add(crewChief);

// --- Markings (subtle panel lines) ---
for (let pz = -3; pz < 4; pz += 2) {
  const panelGeo = new THREE.BoxGeometry(2.82, 0.02, 0.04);
  const panel = new THREE.Mesh(panelGeo, heloDkMat);
  panel.position.set(0, 0.5, pz);
  shipGroup.add(panel);
}

// Position the helicopter
shipGroup.position.copy(SHIP_POS);
shipGroup.position.y = 2;
shipGroup.rotation.y = Math.PI; // face the player
scene.add(shipGroup);

// Beacon light (flashing green on tail)
const beacon = new THREE.PointLight(0x44ff44, 2, 30);
beacon.position.copy(SHIP_POS);
beacon.position.y = 5;
scene.add(beacon);

// Red anti-collision light on belly
const antiCol = new THREE.PointLight(0xff2222, 1, 15);
antiCol.position.copy(SHIP_POS);
antiCol.position.y = 0.5;
scene.add(antiCol);

// Rotor wash dust light (ground effect)
const washLight = new THREE.PointLight(0xff8844, 1.5, 12);
washLight.position.copy(SHIP_POS);
washLight.position.y = 0.3;
scene.add(washLight);

// === LZ OUTPOST (marine forward operating base around the helicopter) ===
// Uses Math.random() to avoid shifting the seeded rand() sequence

// --- Sandbag perimeter (horseshoe shape, open on the helo side) ---
function addOutpostSandbags(cx, cz, rot, count) {
  const g = new THREE.Group();
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < count; i++) {
      const bagGeo = new THREE.BoxGeometry(0.8, 0.3, 0.4);
      const bag = new THREE.Mesh(bagGeo, row % 2 === 0 ? sandbagMat : sandbagDkMat);
      const offset = row % 2 === 0 ? 0 : 0.4;
      bag.position.set(i * 0.75 - (count * 0.375) + offset, row * 0.28, 0);
      bag.rotation.y = (Math.random()-0.5) * 0.1;
      bag.castShadow = true;
      g.add(bag);
    }
  }
  g.position.set(cx, 0.15, cz);
  g.rotation.y = rot;
  scene.add(g);
}

// Front wall (facing the approach from seg 4)
addOutpostSandbags(-12, -300, Math.PI / 2, 10);
// Left flank
addOutpostSandbags(-8, -308, 0.2, 6);
// Right flank
addOutpostSandbags(-8, -292, -0.2, 6);
// Rear corners (close the horseshoe near the helo)
addOutpostSandbags(-2, -310, 0, 4);
addOutpostSandbags(-2, -290, 0, 4);

// --- Ammo crates ---
for (const cp of [{ x: 1, z: -296 }, { x: 1, z: -304 }, { x: -5, z: -298 }]) {
  const crateG = new THREE.Group();
  const crateBody = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5), crateMat);
  crateBody.position.y = 0.25;
  crateBody.castShadow = true;
  crateG.add(crateBody);
  const crateLid = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.52), militaryDk);
  crateLid.position.y = 0.53;
  crateG.add(crateLid);
  const crateLabel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.02), ammoMat);
  crateLabel.position.set(0, 0.3, 0.26);
  crateG.add(crateLabel);
  crateG.position.set(cp.x, 0, cp.z);
  crateG.rotation.y = Math.random() * 0.5;
  scene.add(crateG);
}

// --- Radio post (table with equipment) ---
const radioGroup = new THREE.Group();
// Folding table
const tableGeo = new THREE.BoxGeometry(1.2, 0.05, 0.7);
const table = new THREE.Mesh(tableGeo, militaryGreen);
table.position.y = 0.75;
radioGroup.add(table);
// Table legs
for (const lp of [[-0.5, -0.3], [-0.5, 0.3], [0.5, -0.3], [0.5, 0.3]]) {
  const legGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.75, 4);
  const leg = new THREE.Mesh(legGeo, metalWreck);
  leg.position.set(lp[0], 0.375, lp[1]);
  radioGroup.add(leg);
}
// Radio box
const radioGeo = new THREE.BoxGeometry(0.3, 0.2, 0.25);
const radio = new THREE.Mesh(radioGeo, militaryDk);
radio.position.set(-0.2, 0.88, 0);
radioGroup.add(radio);
// Antenna
const antennaGeo2 = new THREE.CylinderGeometry(0.008, 0.008, 0.8, 3);
const antenna2 = new THREE.Mesh(antennaGeo2, metalWreck);
antenna2.position.set(-0.2, 1.28, 0);
antenna2.rotation.z = 0.15;
radioGroup.add(antenna2);
// Map on table
const mapGeo = new THREE.BoxGeometry(0.5, 0.01, 0.4);
const mapMesh = new THREE.Mesh(mapGeo, new THREE.MeshLambertMaterial({ color: 0xc8b898 }));
mapMesh.position.set(0.2, 0.78, 0);
mapMesh.rotation.y = 0.2;
radioGroup.add(mapMesh);
radioGroup.position.set(4, 0, -296);
radioGroup.rotation.y = 0.3;
scene.add(radioGroup);

// --- Flares marking the LZ (red glow sticks on ground) ---
const flareMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
const flareGlowMat2 = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.4 });
const flarePositions = [
  { x: -10, z: -294 }, { x: -10, z: -306 },
  { x: -3, z: -310 }, { x: -3, z: -290 },
  { x: 3, z: -308 }, { x: 3, z: -292 },
];
for (const fp of flarePositions) {
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 4), flareMat);
  stick.position.set(fp.x, 0.12, fp.z);
  stick.rotation.z = Math.random() * 0.3;
  scene.add(stick);
  const flareGlow = new THREE.Mesh(new THREE.SphereGeometry(0.15, 4, 4), flareGlowMat2);
  flareGlow.position.set(fp.x, 0.2, fp.z);
  scene.add(flareGlow);
}

// --- Barbed wire (blocks all openings except the front approach) ---
function addBarbedWire(x, z, rot, length) {
  const g = new THREE.Group();
  // Posts
  for (let p = 0; p <= length; p += 1.5) {
    const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 4);
    const post = new THREE.Mesh(postGeo, barbWireMat);
    post.position.set(p - length / 2, 0.5, 0);
    g.add(post);
  }
  // Wire coils
  for (let c = 0; c < length; c += 0.8) {
    const coilGeo = new THREE.TorusGeometry(0.2, 0.015, 4, 8);
    const coil = new THREE.Mesh(coilGeo, barbWireMat);
    coil.position.set(c - length / 2 + 0.4, 0.7, 0);
    coil.rotation.y = Math.random() * Math.PI;
    coil.rotation.x = Math.random() * 0.3;
    g.add(coil);
  }
  // Second row (lower, offset)
  for (let c = 0; c < length; c += 1) {
    const coilGeo = new THREE.TorusGeometry(0.18, 0.012, 4, 8);
    const coil = new THREE.Mesh(coilGeo, barbWireMat);
    coil.position.set(c - length / 2 + 0.2, 0.35, 0.15);
    coil.rotation.y = Math.random() * Math.PI;
    g.add(coil);
  }
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  scene.add(g);
}

// Between left flank and rear left corner
addBarbedWire(-5, -309, 0, 3);
// Between right flank and rear right corner
addBarbedWire(-5, -291, 0, 3);
// Rear gap between the two rear corners (behind the helo)
addBarbedWire(-2, -300, Math.PI / 2, 8);
// Extra wire along the flanks (outside the sandbags)
addBarbedWire(-9, -310, 0.2, 4);
addBarbedWire(-9, -290, -0.2, 4);

// --- Fallen Marines (7 KIA around the outpost) ---
const fallenMarineMat = new THREE.MeshLambertMaterial({ color: 0x3a4a2a });
const fallenMarineDkMat = new THREE.MeshLambertMaterial({ color: 0x2a3a1a });
const fallenMarinePositions = [
  { x: -13, z: -297, rot: 0.3, rz: 1.4 },
  { x: -10, z: -310, rot: -0.5, rz: 1.5 },
  { x: -4, z: -306, rot: 1.2, rz: 1.3 },
  { x: 2, z: -309, rot: 0.8, rz: 1.5 },
  { x: -6, z: -293, rot: -1.0, rz: 1.4 },
  { x: -1, z: -295, rot: 2.1, rz: 1.6 },
  { x: -14, z: -303, rot: -0.2, rz: 1.3 },
];
for (const fm of fallenMarinePositions) {
  const body = new THREE.Group();
  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.55), fallenMarineMat);
  torso.position.y = 0.1;
  body.add(torso);
  // Vest
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.12, 0.4), marineVestMat);
  vest.position.set(0, 0.15, -0.05);
  body.add(vest);
  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.18), marineSkinMat);
  head.position.set(0, 0.08, -0.35);
  body.add(head);
  // Helmet (rolled off)
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 4), marineHelmetMat);
  helmet.position.set(0.2 + Math.random() * 0.3, 0.06, -0.3 + Math.random() * 0.2);
  body.add(helmet);
  // Legs
  for (const lx of [-0.1, 0.1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.4), fallenMarineDkMat);
    leg.position.set(lx, 0.06, 0.4);
    leg.rotation.y = (Math.random() - 0.5) * 0.3;
    body.add(leg);
  }
  // Boot
  for (const lx of [-0.1, 0.1]) {
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.15), marineBootMat);
    boot.position.set(lx, 0.05, 0.6);
    body.add(boot);
  }
  // Rifle (dropped nearby)
  const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.5), marineGunMat);
  rifle.position.set(0.3 + Math.random() * 0.2, 0.03, Math.random() * 0.3);
  rifle.rotation.y = Math.random() * Math.PI;
  body.add(rifle);
  // Blood pool
  const poolGeo = new THREE.PlaneGeometry(0.6 + Math.random() * 0.4, 0.4 + Math.random() * 0.3);
  const pool = new THREE.Mesh(poolGeo, bloodMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.01, -0.1);
  body.add(pool);

  body.position.set(fm.x, 0, fm.z);
  body.rotation.y = fm.rot;
  body.rotation.x = fm.rz;
  scene.add(body);
}

// --- Fallen Aliens (7 killed around the perimeter outside) ---
const fallenAlienPositions = [
  { x: -15, z: -295, rot: 1.8 },
  { x: -16, z: -305, rot: -0.6 },
  { x: -13, z: -311, rot: 0.4 },
  { x: -11, z: -289, rot: 2.5 },
  { x: -8, z: -313, rot: 1.1 },
  { x: -6, z: -287, rot: -1.3 },
  { x: -17, z: -300, rot: 0.1 },
];
for (const fa of fallenAlienPositions) {
  const body = new THREE.Group();
  // Torso (collapsed)
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.4, 5, 4), alienSkinMat);
  torso.scale.set(1, 0.5, 0.85);
  torso.position.y = 0.15;
  body.add(torso);
  // Skull
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.25, 5, 4), alienLightMat);
  skull.scale.set(0.8, 0.6, 1.3);
  skull.position.set(0, 0.1, -0.5);
  body.add(skull);
  // Dead eyes (dim)
  for (const ex of [-0.1, 0.1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), new THREE.MeshBasicMaterial({ color: 0x331100 }));
    eye.position.set(ex, 0.12, -0.7);
    body.add(eye);
  }
  // Spine ridges (broken/bent)
  for (let s = 0; s < 3; s++) {
    const ridge = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.15, 4), alienBoneMat);
    ridge.position.set(0, 0.2, 0.15 + s * 0.15);
    ridge.rotation.x = -0.3 + Math.random() * 0.6;
    ridge.rotation.z = (Math.random() - 0.5) * 0.5;
    body.add(ridge);
  }
  // Collapsed limbs
  for (const sx of [-0.35, 0.35]) {
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.5, 4), alienSkinMat);
    limb.position.set(sx, 0.05, -0.1);
    limb.rotation.z = sx > 0 ? 0.8 : -0.8;
    limb.rotation.x = Math.random() * 0.3;
    body.add(limb);
  }
  // Claw (sticking out)
  const claw = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.12, 3), alienTeethMat);
  claw.position.set(0.45, 0.03, -0.2);
  claw.rotation.z = 0.7;
  body.add(claw);
  // Green blood pool (alien blood)
  const alienBloodMat = new THREE.MeshBasicMaterial({ color: 0x0a2a0a, transparent: true, opacity: 0.4 });
  const aPoolGeo = new THREE.PlaneGeometry(0.5 + Math.random() * 0.4, 0.4 + Math.random() * 0.3);
  const aPool = new THREE.Mesh(aPoolGeo, alienBloodMat);
  aPool.rotation.x = -Math.PI / 2;
  aPool.position.set(0, 0.01, -0.3);
  body.add(aPool);

  body.position.set(fa.x, 0, fa.z);
  body.rotation.y = fa.rot;
  scene.add(body);
}

// --- Crashed Helicopter (failed extraction attempt, tells a story) ---
const crashGroup = new THREE.Group();

// Fuselage (crumpled, on its side)
const crashFuseGeo = new THREE.BoxGeometry(2.6, 2, 7);
const crashFuse = new THREE.Mesh(crashFuseGeo, new THREE.MeshLambertMaterial({ color: 0x2a3a2a }));
crashFuse.position.set(0, 0.8, 0);
crashFuse.castShadow = true;
crashGroup.add(crashFuse);

// Nose (bent)
const crashNoseGeo = new THREE.BoxGeometry(2, 1.4, 2);
const crashNose = new THREE.Mesh(crashNoseGeo, new THREE.MeshLambertMaterial({ color: 0x2a3a2a }));
crashNose.position.set(-0.3, 0.5, -4.2);
crashNose.rotation.z = 0.15;
crashGroup.add(crashNose);

// Crumpled cockpit glass (shattered)
const crashWindGeo = new THREE.BoxGeometry(1.6, 1, 1.2);
const crashWind = new THREE.Mesh(crashWindGeo, new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
crashWind.position.set(-0.2, 0.7, -5);
crashGroup.add(crashWind);

// Tail boom (snapped, bent at angle)
const crashTailGeo = new THREE.BoxGeometry(0.7, 0.7, 4);
const crashTail = new THREE.Mesh(crashTailGeo, new THREE.MeshLambertMaterial({ color: 0x1a2a1a }));
crashTail.position.set(0.3, 0.8, 5.5);
crashTail.rotation.x = 0.2;
crashTail.rotation.z = -0.15;
crashGroup.add(crashTail);

// Broken tail section (separated)
const crashTailEndGeo = new THREE.BoxGeometry(0.5, 0.5, 2.5);
const crashTailEnd = new THREE.Mesh(crashTailEndGeo, new THREE.MeshLambertMaterial({ color: 0x1a2a1a }));
crashTailEnd.position.set(1.5, 0.3, 9);
crashTailEnd.rotation.y = 0.4;
crashTailEnd.rotation.z = 0.3;
crashGroup.add(crashTailEnd);

// Tail fin (detached, on ground nearby)
const crashFinGeo = new THREE.BoxGeometry(0.1, 1.2, 1);
const crashFin = new THREE.Mesh(crashFinGeo, new THREE.MeshLambertMaterial({ color: 0x2a3a2a }));
crashFin.position.set(2.5, 0.3, 8.5);
crashFin.rotation.z = 1.2;
crashGroup.add(crashFin);

// Engine nacelles (one ripped off)
const crashNacGeo = new THREE.BoxGeometry(0.9, 0.6, 2);
const crashNac = new THREE.Mesh(crashNacGeo, new THREE.MeshLambertMaterial({ color: 0x1a2a1a }));
crashNac.position.set(0.6, 1.6, 0.5);
crashGroup.add(crashNac);
// Detached engine on ground
const crashNac2Geo = new THREE.BoxGeometry(0.9, 0.6, 2);
const crashNac2 = new THREE.Mesh(crashNac2Geo, new THREE.MeshLambertMaterial({ color: 0x1a2a1a }));
crashNac2.position.set(-3, 0.3, 1.5);
crashNac2.rotation.y = 0.6;
crashGroup.add(crashNac2);

// Broken rotor blades (scattered on ground)
for (let rb = 0; rb < 3; rb++) {
  const bladeLen = 4 + Math.random() * 3;
  const bladeGeo = new THREE.BoxGeometry(bladeLen, 0.05, 0.4);
  const blade = new THREE.Mesh(bladeGeo, heloRotorMat);
  blade.position.set(-2 + Math.random() * 6, 0.04, -3 + Math.random() * 8);
  blade.rotation.y = Math.random() * Math.PI;
  blade.rotation.z = (Math.random() - 0.5) * 0.2;
  crashGroup.add(blade);
}

// Rotor hub (bent mast still on fuselage)
const crashMastGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.8, 5);
const crashMast = new THREE.Mesh(crashMastGeo, heloRotorMat);
crashMast.position.set(0.2, 1.8, 0);
crashMast.rotation.z = 0.4;
crashGroup.add(crashMast);

// Landing skids (bent/crushed)
for (const sx of [-1.2, 1.2]) {
  const skidGeo = new THREE.BoxGeometry(0.12, 0.12, 4);
  const skid = new THREE.Mesh(skidGeo, heloRotorMat);
  skid.position.set(sx, -0.1, -0.5);
  skid.rotation.x = (Math.random() - 0.5) * 0.15;
  skid.rotation.z = sx > 0 ? 0.2 : -0.1;
  crashGroup.add(skid);
}

// Scorch marks on hull
for (let sc = 0; sc < 4; sc++) {
  const scorchGeo = new THREE.PlaneGeometry(1.5 + Math.random(), 1 + Math.random());
  const scorch = new THREE.Mesh(scorchGeo, new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.6 }));
  scorch.position.set((Math.random() - 0.5) * 2, 1.2 + Math.random() * 0.5, (Math.random() - 0.5) * 5);
  scorch.rotation.y = Math.random() * 0.5;
  crashGroup.add(scorch);
}

// Impact crater on ground
const craterGeo = new THREE.PlaneGeometry(6, 8);
const craterMat = new THREE.MeshBasicMaterial({ color: 0x0a0808, transparent: true, opacity: 0.4 });
const crater = new THREE.Mesh(craterGeo, craterMat);
crater.rotation.x = -Math.PI / 2;
crater.position.y = 0.02;
crashGroup.add(crater);

// Fire still burning in the engine
const crashFireLight = new THREE.PointLight(0xff4400, 1.2, 8);
crashFireLight.position.set(8, 1.5, -306.5);
scene.add(crashFireLight);
allFireLights.push(crashFireLight);

for (let cf = 0; cf < 4; cf++) {
  const cfGeo = new THREE.ConeGeometry(0.15 + Math.random() * 0.2, 0.5 + Math.random() * 0.8, 4);
  const cfMesh = new THREE.Mesh(cfGeo, Math.random() > 0.5 ? fireMat : fireGlowMat);
  cfMesh.position.set((Math.random() - 0.5) * 1.5, 1.5 + Math.random() * 0.5, 0.5 + (Math.random() - 0.5) * 1.5);
  crashGroup.add(cfMesh);
}

// Smoke rising (added to scene directly for animation compatibility)
for (let cs = 0; cs < 5; cs++) {
  const csGeo = new THREE.SphereGeometry(0.5 + Math.random(), 4, 4);
  const csMesh = new THREE.Mesh(csGeo, smokeMat.clone());
  const sx = 8 + (Math.random() - 0.5) * 2;
  const sy = 3 + cs * 2.5 + Math.random() * 2;
  const sz = -307 + (Math.random() - 0.5) * 2;
  csMesh.position.set(sx, sy, sz);
  scene.add(csMesh);
  smokeParticles.push({ mesh: csMesh, baseY: sy, baseX: sx, speed: 0.15 + Math.random() * 0.2 });
}

// Position: off to the right side of the LZ, tipped on its side
crashGroup.position.set(8, 0, -307);
crashGroup.rotation.y = 0.6;
crashGroup.rotation.z = 0.25;
scene.add(crashGroup);

// --- Outpost Marines (3 defenders at fixed positions behind sandbags) ---
const outpostMarines = [];
const outpostPositions = [
  { x: -11, z: -296, rot: Math.PI / 2 },
  { x: -11, z: -304, rot: Math.PI / 2 },
  { x: -7, z: -300, rot: Math.PI / 2 },
];
for (const op of outpostPositions) {
  const mesh = createMarineMesh();
  mesh.position.set(op.x, 0, op.z);
  mesh.rotation.y = op.rot;
  scene.add(mesh);
  outpostMarines.push({
    mesh, health: 999, alive: true,
    shootTimer: 10 + Math.floor(Math.random() * 30),
    muzzleTimer: 0, pos: op,
  });
}

// --- General (officer pointing toward the helicopter) ---
const generalGroup = new THREE.Group();
// Boots
for (const lx of [-0.1, 0.1]) {
  const bootGeo = new THREE.BoxGeometry(0.12, 0.16, 0.18);
  const boot = new THREE.Mesh(bootGeo, marineBootMat);
  boot.position.set(lx, 0.08, 0);
  generalGroup.add(boot);
}
// Legs
for (const lx of [-0.1, 0.1]) {
  const legGeo = new THREE.BoxGeometry(0.13, 0.35, 0.13);
  const leg = new THREE.Mesh(legGeo, marineFatiguesDkMat);
  leg.position.set(lx, 0.42, 0);
  generalGroup.add(leg);
}
// Torso
const genTorso = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.38, 0.2), marineFatiguesMat);
genTorso.position.y = 0.8;
generalGroup.add(genTorso);
// Vest (officer's — slightly different color)
const genVest = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.3, 0.22), new THREE.MeshLambertMaterial({ color: 0x4a4a3a }));
genVest.position.y = 0.82;
generalGroup.add(genVest);
// Rank insignia (small gold bar on chest)
const insignia = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.02), ammoMat);
insignia.position.set(0.08, 0.92, 0.12);
generalGroup.add(insignia);
// Left arm (at side)
const genArmL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.1), marineFatiguesMat);
genArmL.position.set(-0.24, 0.65, 0);
generalGroup.add(genArmL);
// Right arm (pointing toward helo — extended)
const genArmR = new THREE.Group();
const genUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.1), marineFatiguesMat);
genUpperArm.position.y = -0.1;
genArmR.add(genUpperArm);
const genForearm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.08), marineSkinMat);
genForearm.position.set(0, -0.28, 0.08);
genForearm.rotation.x = -0.5;
genArmR.add(genForearm);
// Pointing hand
const genHand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.12), marineSkinMat);
genHand.position.set(0, -0.35, 0.18);
genHand.rotation.x = -0.3;
genArmR.add(genHand);
genArmR.position.set(0.24, 0.9, 0.05);
genArmR.rotation.z = -1.2;
genArmR.name = 'pointArm';
generalGroup.add(genArmR);
// Head
const genHead = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.2), marineSkinMat);
genHead.position.y = 1.16;
generalGroup.add(genHead);
const genJaw = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.05, 0.12), marineSkinDkMat);
genJaw.position.set(0, 1.06, 0.03);
generalGroup.add(genJaw);
// Officer's cap (flat brim, not a helmet)
const capBody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.22), new THREE.MeshLambertMaterial({ color: 0x3a4a2a }));
capBody.position.y = 1.3;
generalGroup.add(capBody);
const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.12), new THREE.MeshLambertMaterial({ color: 0x2a3a1a }));
capBrim.position.set(0, 1.26, 0.12);
generalGroup.add(capBrim);
// Gold cap badge
const capBadge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), ammoMat);
capBadge.position.set(0, 1.3, 0.12);
generalGroup.add(capBadge);

generalGroup.position.set(3, 0, -299);
generalGroup.rotation.y = -Math.PI / 2;
scene.add(generalGroup);

// --- ABANDONED CAMPS (telling the story of war along the corridor) ---
// All use Math.random() — NOT rand() — to preserve seeded RNG sequence

function createFallenMarine(g, x, z, rot) {
  const b = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.55), fallenMarineMat);
  torso.position.y = 0.1;
  b.add(torso);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.12, 0.4), marineVestMat);
  vest.position.set(0, 0.15, -0.05);
  b.add(vest);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.18), marineSkinMat);
  head.position.set(0, 0.08, -0.35);
  b.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 4), marineHelmetMat);
  helmet.position.set(0.2 + Math.random() * 0.3, 0.06, -0.3);
  b.add(helmet);
  for (const lx of [-0.1, 0.1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.4), fallenMarineDkMat);
    leg.position.set(lx, 0.06, 0.4);
    b.add(leg);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.15), marineBootMat);
    boot.position.set(lx, 0.05, 0.6);
    b.add(boot);
  }
  const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.5), marineGunMat);
  rifle.position.set(0.3 + Math.random() * 0.2, 0.03, Math.random() * 0.3);
  rifle.rotation.y = Math.random() * Math.PI;
  b.add(rifle);
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6 + Math.random() * 0.4, 0.4 + Math.random() * 0.3),
    bloodMat
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.01, -0.1);
  b.add(pool);
  b.position.set(x, 0, z);
  b.rotation.set(1.45, rot, 0);
  g.add(b);
}

function createFallenAlien(g, x, z, rot) {
  const b = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.4, 5, 4), alienSkinMat);
  torso.scale.set(1, 0.5, 0.85);
  torso.position.y = 0.15;
  b.add(torso);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.25, 5, 4), alienLightMat);
  skull.scale.set(0.8, 0.6, 1.3);
  skull.position.set(0, 0.1, -0.5);
  b.add(skull);
  for (const ex of [-0.1, 0.1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), new THREE.MeshBasicMaterial({ color: 0x331100 }));
    eye.position.set(ex, 0.12, -0.7);
    b.add(eye);
  }
  for (let s = 0; s < 3; s++) {
    const ridge = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.15, 4), alienBoneMat);
    ridge.position.set(0, 0.2, 0.15 + s * 0.15);
    ridge.rotation.x = -0.3 + Math.random() * 0.6;
    b.add(ridge);
  }
  for (const sx of [-0.35, 0.35]) {
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.5, 4), alienSkinMat);
    limb.position.set(sx, 0.05, -0.1);
    limb.rotation.z = sx > 0 ? 0.8 : -0.8;
    b.add(limb);
  }
  const aPool = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5 + Math.random() * 0.4, 0.4 + Math.random() * 0.3),
    new THREE.MeshBasicMaterial({ color: 0x0a2a0a, transparent: true, opacity: 0.4 })
  );
  aPool.rotation.x = -Math.PI / 2;
  aPool.position.set(0, 0.01, -0.3);
  b.add(aPool);
  b.position.set(x, 0, z);
  b.rotation.y = rot;
  g.add(b);
}

// --- Abandoned Marine Checkpoint ---
// Sandbag semicircle, overturned table, scattered gear, shell casings, fallen marines
function createMarineCamp(cx, cz, facing) {
  const g = new THREE.Group();

  // Sandbag semicircle (5 stacks in an arc)
  for (let i = 0; i < 5; i++) {
    const angle = (i / 4) * Math.PI - Math.PI / 2;
    const radius = 3;
    const sx = Math.cos(angle) * radius;
    const sz = Math.sin(angle) * radius;
    for (let row = 0; row < 2; row++) {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.4), row % 2 === 0 ? sandbagMat : sandbagDkMat);
      bag.position.set(sx, 0.15 + row * 0.28, sz);
      bag.rotation.y = angle + Math.PI / 2;
      g.add(bag);
    }
  }

  // Overturned table
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.7), crateMat);
  tableTop.position.set(-0.5, 0.35, 0);
  tableTop.rotation.z = 0.8;
  g.add(tableTop);
  // Table leg sticking up
  const tableLeg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), metalWreck);
  tableLeg.position.set(-0.8, 0.5, 0.2);
  tableLeg.rotation.z = 0.8;
  g.add(tableLeg);

  // Ammo crates (scattered)
  for (let i = 0; i < 3; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.4), crateMat);
    crate.position.set(
      -1 + Math.random() * 2,
      0.17,
      -1 + Math.random() * 2
    );
    crate.rotation.y = Math.random() * Math.PI;
    if (i === 2) crate.rotation.z = 0.4; // one tipped over
    g.add(crate);
  }

  // Broken radio
  const radio = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.2), metalWreck);
  radio.position.set(0.8, 0.12, -0.5);
  radio.rotation.y = 0.6;
  g.add(radio);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 3), metalBurnt);
  antenna.position.set(0.85, 0.4, -0.5);
  antenna.rotation.z = 0.4;
  g.add(antenna);

  // Shell casings scattered on ground
  const casingMat = new THREE.MeshLambertMaterial({ color: 0xaa8833 });
  for (let i = 0; i < 12; i++) {
    const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.04, 3), casingMat);
    casing.position.set(
      (Math.random() - 0.5) * 4,
      0.02,
      (Math.random() - 0.5) * 4
    );
    casing.rotation.x = Math.PI / 2;
    casing.rotation.z = Math.random() * Math.PI;
    g.add(casing);
  }

  // Scorch mark on ground (grenade blast)
  const scorch = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 2.5),
    new THREE.MeshBasicMaterial({ color: 0x0a0808, transparent: true, opacity: 0.35 })
  );
  scorch.rotation.x = -Math.PI / 2;
  scorch.position.set(1, 0.01, 1.5);
  g.add(scorch);

  // Fallen marines
  createFallenMarine(g, 1.5, 2.5, 0.4);
  createFallenMarine(g, -2, 1, -0.8);

  g.position.set(cx, 0, cz);
  g.rotation.y = facing;
  scene.add(g);
}

// --- Alien Nest ---
// Organic mounds, egg sacs, slime puddles, fallen aliens
function createAlienNest(cx, cz, facing) {
  const g = new THREE.Group();
  const nestMat = new THREE.MeshLambertMaterial({ color: 0x2a1a3a });
  const nestLtMat = new THREE.MeshLambertMaterial({ color: 0x3a2a4a });
  const slimeMat = new THREE.MeshBasicMaterial({ color: 0x1a3a1a, transparent: true, opacity: 0.35 });
  const eggMat = new THREE.MeshLambertMaterial({ color: 0x4a3a5a, emissive: 0x221133, emissiveIntensity: 0.2 });
  const eggGlowMat = new THREE.MeshLambertMaterial({ color: 0x44ff66, emissive: 0x22ff44, emissiveIntensity: 0.4 });

  // Central organic mound (like a hive node)
  const moundGeo = new THREE.SphereGeometry(1.5, 6, 5);
  moundGeo.scale(1, 0.4, 1);
  const mound = new THREE.Mesh(moundGeo, nestMat);
  mound.position.y = 0.3;
  g.add(mound);

  // Smaller mounds around the main one
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 1.8 + Math.random() * 1.2;
    const sm = new THREE.Mesh(
      new THREE.SphereGeometry(0.5 + Math.random() * 0.4, 5, 4),
      nestLtMat
    );
    sm.scale.set(1, 0.35, 1);
    sm.position.set(Math.cos(angle) * dist, 0.15, Math.sin(angle) * dist);
    g.add(sm);
  }

  // Egg sacs (translucent, clustered)
  for (let i = 0; i < 5; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 0.5 + Math.random() * 1.5;
    const egg = new THREE.Mesh(
      new THREE.SphereGeometry(0.2 + Math.random() * 0.15, 5, 5),
      eggMat
    );
    egg.position.set(Math.cos(angle) * dist, 0.3 + Math.random() * 0.2, Math.sin(angle) * dist);
    egg.scale.y = 1.3;
    g.add(egg);
    // Tiny glow inside some eggs
    if (Math.random() > 0.5) {
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 4), eggGlowMat);
      inner.position.copy(egg.position);
      g.add(inner);
    }
  }

  // Organic tendrils spreading outward on ground
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const len = 1.5 + Math.random() * 2;
    const tendril = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.01, len, 3),
      nestMat
    );
    tendril.position.set(
      Math.cos(angle) * len * 0.5,
      0.02,
      Math.sin(angle) * len * 0.5
    );
    tendril.rotation.z = Math.PI / 2;
    tendril.rotation.y = -angle;
    g.add(tendril);
  }

  // Slime puddles
  for (let i = 0; i < 3; i++) {
    const puddle = new THREE.Mesh(
      new THREE.PlaneGeometry(1 + Math.random(), 0.8 + Math.random()),
      slimeMat
    );
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(
      (Math.random() - 0.5) * 4,
      0.01,
      (Math.random() - 0.5) * 4
    );
    g.add(puddle);
  }

  // Bone trophies (collected from kills — spine ridges and skulls on sticks)
  for (let i = 0; i < 2; i++) {
    const stickGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.2, 4);
    const stick = new THREE.Mesh(stickGeo, alienBoneMat);
    stick.position.set(-1.5 + i * 3, 0.6, -1);
    g.add(stick);
    // Skull on top
    const trophySkull = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 4), marineSkinDkMat);
    trophySkull.position.set(-1.5 + i * 3, 1.25, -1);
    g.add(trophySkull);
  }

  // Faint green glow light
  const nestLight = new THREE.PointLight(0x22ff44, 0.6, 8);
  nestLight.position.set(0, 1, 0);
  g.add(nestLight);
  allFireLights.push(nestLight);

  // Fallen alien nearby (guard that died)
  createFallenAlien(g, 3.5, 1, 0.8);

  g.position.set(cx, 0, cz);
  g.rotation.y = facing;
  scene.add(g);
}

// --- Place camps along the route ---

// Seg 1: Marine checkpoint that got overrun (z ~ -70)
createMarineCamp(0, -70, 0);

// Seg 2: Alien nest established in conquered territory (x ~ -60, z ~ -150)
createAlienNest(-60, -150, 0.5);

// Seg 3 early: Another abandoned marine position (x ~ -150, z ~ -200)
createMarineCamp(-150, -200, Math.PI / 2);

// Seg 3 late: Alien nest deeper in, closer to the boss (x ~ -150, z ~ -270)
createAlienNest(-150, -270, 1.2);

// Seg 4: Mixed battlefield — marine camp AND alien nest side by side (the last stand before LZ)
createMarineCamp(-80, -300, Math.PI / 2);
createAlienNest(-100, -300, -0.3);

// --- SPAWN BUILDING: Abandoned Military Command Post ---
// Player spawns at (0, 1.6, 5), facing -z into the corridor
// Building wraps around spawn with open front (toward the level)
(function() {
  const cpMat = new THREE.MeshLambertMaterial({ color: 0x4a4a3a });
  const cpDkMat = new THREE.MeshLambertMaterial({ color: 0x3a3a2a });
  const cpFloorMat = new THREE.MeshLambertMaterial({ color: 0x3a3a32 });
  const mapMat = new THREE.MeshLambertMaterial({ color: 0x6a6a5a });
  const pinMat = new THREE.MeshBasicMaterial({ color: 0xff2233 });
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x113322 });
  const cxWall = 0, czBack = 14, czFront = 4;
  const halfW = 7, wallH = 4, wallThick = 0.5;

  // Back wall
  const backGeo = new THREE.BoxGeometry(halfW * 2, wallH, wallThick);
  const back = new THREE.Mesh(backGeo, cpMat);
  back.position.set(cxWall, wallH / 2, czBack);
  back.castShadow = true;
  scene.add(back);
  platformData.push({ x: -halfW, y: 0, z: czBack - wallThick / 2, w: halfW * 2, h: wallH, d: wallThick });

  // Left wall
  const sideGeo = new THREE.BoxGeometry(wallThick, wallH, czBack - czFront);
  const leftWall = new THREE.Mesh(sideGeo, cpMat);
  leftWall.position.set(-halfW, wallH / 2, (czBack + czFront) / 2);
  leftWall.castShadow = true;
  scene.add(leftWall);
  platformData.push({ x: -halfW - wallThick / 2, y: 0, z: czFront, w: wallThick, h: wallH, d: czBack - czFront });

  // Right wall
  const rightWall = new THREE.Mesh(sideGeo, cpMat);
  rightWall.position.set(halfW, wallH / 2, (czBack + czFront) / 2);
  rightWall.castShadow = true;
  scene.add(rightWall);
  platformData.push({ x: halfW - wallThick / 2, y: 0, z: czFront, w: wallThick, h: wallH, d: czBack - czFront });

  // Partial front wall (left and right of doorway, leaving 4-unit opening)
  for (const fx of [-1, 1]) {
    const frontPartGeo = new THREE.BoxGeometry(halfW - 2, wallH, wallThick);
    const frontPart = new THREE.Mesh(frontPartGeo, cpMat);
    const fpx = fx * (halfW / 2 + 1);
    frontPart.position.set(fpx, wallH / 2, czFront);
    scene.add(frontPart);
    platformData.push({ x: fpx - (halfW - 2) / 2, y: 0, z: czFront - wallThick / 2, w: halfW - 2, h: wallH, d: wallThick });
  }
  // Door lintel
  const lintelGeo = new THREE.BoxGeometry(4.5, 0.5, wallThick);
  const lintel = new THREE.Mesh(lintelGeo, cpDkMat);
  lintel.position.set(0, wallH - 0.25, czFront);
  scene.add(lintel);

  // Roof (with holes for atmosphere)
  const roofGeo = new THREE.BoxGeometry(halfW * 2, 0.3, czBack - czFront);
  const roof = new THREE.Mesh(roofGeo, cpDkMat);
  roof.position.set(cxWall, wallH, (czBack + czFront) / 2);
  scene.add(roof);
  // Hole in roof (dark cutout)
  const holeGeo = new THREE.BoxGeometry(2.5, 0.4, 2);
  const hole = new THREE.Mesh(holeGeo, new THREE.MeshBasicMaterial({ color: 0x0a0a0a }));
  hole.position.set(2, wallH, 10);
  scene.add(hole);

  // Floor (slightly raised concrete)
  const floorGeo = new THREE.BoxGeometry(halfW * 2 - 1, 0.1, czBack - czFront - 1);
  const floor = new THREE.Mesh(floorGeo, cpFloorMat);
  floor.position.set(cxWall, 0.05, (czBack + czFront) / 2);
  scene.add(floor);

  // Scorch mark on floor
  const scorch = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 1.5),
    new THREE.MeshBasicMaterial({ color: 0x0a0808, transparent: true, opacity: 0.3 })
  );
  scorch.rotation.x = -Math.PI / 2;
  scorch.position.set(-2, 0.06, 8);
  scene.add(scorch);

  // Shell damage on back wall (avoid map area around x=-2)
  for (let i = 0; i < 3; i++) {
    let dmgX = (Math.random() - 0.5) * 8;
    if (dmgX > -3.5 && dmgX < -0.5) dmgX = dmgX < -2 ? -3.5 : -0.5;
    const dmgGeo = new THREE.SphereGeometry(0.3 + Math.random() * 0.3, 5, 4);
    const dmg = new THREE.Mesh(dmgGeo, new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    dmg.position.set(dmgX, 1 + Math.random() * 2, czBack - wallThick / 2 - 0.02);
    scene.add(dmg);
  }

  // Rebar sticking out of hole in roof
  for (let r = 0; r < 3; r++) {
    const rebarGeo = new THREE.CylinderGeometry(0.02, 0.02, 1 + Math.random());
    const rebar = new THREE.Mesh(rebarGeo, rebarMat);
    rebar.position.set(1.5 + Math.random() * 2, wallH - 0.5, 9.5 + Math.random() * 1.5);
    rebar.rotation.x = (Math.random() - 0.5) * 0.8;
    rebar.rotation.z = (Math.random() - 0.5) * 0.6;
    scene.add(rebar);
  }

  // === FURNITURE ===

  // Command table (center of room)
  const tableGeo = new THREE.BoxGeometry(2.5, 0.08, 1.2);
  const table = new THREE.Mesh(tableGeo, new THREE.MeshLambertMaterial({ color: 0x5a4a3a }));
  table.position.set(0, 0.85, 9);
  scene.add(table);
  // Table legs
  for (const tx of [-1.1, 1.1]) {
    for (const tz of [8.5, 9.5]) {
      const legGeo = new THREE.BoxGeometry(0.06, 0.85, 0.06);
      const leg = new THREE.Mesh(legGeo, new THREE.MeshLambertMaterial({ color: 0x4a3a2a }));
      leg.position.set(tx, 0.42, tz);
      scene.add(leg);
    }
  }

  // Map on table (paper with markings)
  const mapOnTable = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), mapMat);
  mapOnTable.rotation.x = -Math.PI / 2;
  mapOnTable.position.set(-0.2, 0.9, 9);
  scene.add(mapOnTable);
  // Map pins (red dots marking positions)
  for (const mp of [{ x: -0.5, z: 8.7 }, { x: 0.1, z: 9.2 }, { x: -0.8, z: 9.1 }, { x: 0.3, z: 8.8 }]) {
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 4), pinMat);
    pin.position.set(mp.x, 0.92, mp.z);
    scene.add(pin);
  }

  // Tactical screen (dead/flickering monitor on table)
  const monitorGeo = new THREE.BoxGeometry(0.6, 0.45, 0.05);
  const monitor = new THREE.Mesh(monitorGeo, metalWreck);
  monitor.position.set(0.8, 1.12, 9);
  scene.add(monitor);
  // Screen face (dim green)
  const screenFace = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), screenMat);
  screenFace.position.set(0.8, 1.12, 8.97);
  scene.add(screenFace);

  // Map on back wall (tactical map showing the L-shaped corridor)
  const mapGroup = new THREE.Group();
  const mapW = 2, mapH = 1.5;
  const mapZ = 0.02; // offset from wall (positive because group is rotated PI)

  // Background (tan paper)
  const wallMapGeo = new THREE.PlaneGeometry(mapW, mapH);
  const wallMap = new THREE.Mesh(wallMapGeo, new THREE.MeshLambertMaterial({ color: 0x8a7a5a }));
  wallMap.position.z = mapZ;
  mapGroup.add(wallMap);

  // Grid lines
  const gridMat = new THREE.MeshBasicMaterial({ color: 0x6a5a3a });
  for (let gx = -0.8; gx <= 0.8; gx += 0.4) {
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.005, mapH - 0.2), gridMat);
    gl.position.set(gx, 0, mapZ + 0.001);
    mapGroup.add(gl);
  }
  for (let gy = -0.6; gy <= 0.6; gy += 0.3) {
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(mapW - 0.2, 0.005), gridMat);
    gl.position.set(0, gy, mapZ + 0.001);
    mapGroup.add(gl);
  }

  // Street corridors (the L-shaped path, light gray)
  const streetMat = new THREE.MeshBasicMaterial({ color: 0x9a8a6a });
  // Seg 1: vertical (top of map)
  const s1 = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.55), streetMat);
  s1.position.set(0.6, 0.25, mapZ + 0.002);
  mapGroup.add(s1);
  // Seg 2: horizontal (top-right to mid)
  const s2 = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.12), streetMat);
  s2.position.set(0.33, -0.02, mapZ + 0.002);
  mapGroup.add(s2);
  // Seg 3: vertical (mid going down)
  const s3 = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.55), streetMat);
  s3.position.set(0.05, -0.3, mapZ + 0.002);
  mapGroup.add(s3);
  // Seg 4: horizontal (bottom, toward LZ)
  const s4 = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.12), streetMat);
  s4.position.set(-0.22, -0.56, mapZ + 0.002);
  mapGroup.add(s4);

  // Building footprints (dark rectangles along corridors)
  const bldgMat = new THREE.MeshBasicMaterial({ color: 0x4a3a2a });
  const bldgPositions = [
    // Seg 1 buildings (both sides)
    { x: 0.72, y: 0.4, w: 0.08, h: 0.12 },
    { x: 0.48, y: 0.35, w: 0.07, h: 0.1 },
    { x: 0.72, y: 0.18, w: 0.1, h: 0.08 },
    { x: 0.48, y: 0.12, w: 0.06, h: 0.1 },
    // Seg 2 buildings
    { x: 0.5, y: 0.08, w: 0.08, h: 0.06 },
    { x: 0.35, y: -0.12, w: 0.1, h: 0.06 },
    { x: 0.18, y: 0.08, w: 0.07, h: 0.07 },
    { x: 0.2, y: -0.12, w: 0.08, h: 0.06 },
    // Seg 3 buildings
    { x: 0.17, y: -0.2, w: 0.08, h: 0.1 },
    { x: -0.07, y: -0.25, w: 0.07, h: 0.08 },
    { x: 0.17, y: -0.42, w: 0.06, h: 0.1 },
    { x: -0.07, y: -0.4, w: 0.08, h: 0.06 },
    // Seg 4 buildings
    { x: -0.1, y: -0.46, w: 0.08, h: 0.06 },
    { x: -0.3, y: -0.66, w: 0.1, h: 0.06 },
    { x: -0.35, y: -0.46, w: 0.06, h: 0.07 },
    { x: -0.5, y: -0.66, w: 0.07, h: 0.06 },
  ];
  for (const bp of bldgPositions) {
    const bldg = new THREE.Mesh(new THREE.PlaneGeometry(bp.w, bp.h), bldgMat);
    bldg.position.set(bp.x, bp.y, mapZ + 0.003);
    mapGroup.add(bldg);
  }

  // Route line (red, showing the advance path through all 4 segs)
  const routeMat = new THREE.MeshBasicMaterial({ color: 0xff2233 });
  const routeSegs = [
    { x: 0.6, y: 0.25, w: 0.02, h: 0.5 },  // seg 1 down
    { x: 0.33, y: -0.02, w: 0.52, h: 0.02 }, // seg 2 left
    { x: 0.05, y: -0.3, w: 0.02, h: 0.5 },  // seg 3 down
    { x: -0.22, y: -0.56, w: 0.52, h: 0.02 }, // seg 4 left
  ];
  for (const rs of routeSegs) {
    const rLine = new THREE.Mesh(new THREE.PlaneGeometry(rs.w, rs.h), routeMat);
    rLine.position.set(rs.x, rs.y, mapZ + 0.004);
    mapGroup.add(rLine);
  }

  // Start marker (green circle at spawn - top of seg 1)
  const startMat = new THREE.MeshBasicMaterial({ color: 0x44cc44 });
  const startMark = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05), startMat);
  startMark.position.set(0.6, 0.5, mapZ + 0.005);
  mapGroup.add(startMark);

  // LZ marker (blue X at end of seg 4)
  const lzMat = new THREE.MeshBasicMaterial({ color: 0x4488ff });
  const lzX1 = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.01), lzMat);
  lzX1.position.set(-0.48, -0.56, mapZ + 0.005);
  lzX1.rotation.z = 0.7;
  mapGroup.add(lzX1);
  const lzX2 = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.01), lzMat);
  lzX2.position.set(-0.48, -0.56, mapZ + 0.005);
  lzX2.rotation.z = -0.7;
  mapGroup.add(lzX2);

  // Boss marker (red X near LZ)
  const bossX1 = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.01), routeMat);
  bossX1.position.set(-0.38, -0.56, mapZ + 0.005);
  bossX1.rotation.z = 0.7;
  mapGroup.add(bossX1);
  const bossX2 = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.01), routeMat);
  bossX2.position.set(-0.38, -0.56, mapZ + 0.005);
  bossX2.rotation.z = -0.7;
  mapGroup.add(bossX2);

  // Red pins at key positions
  for (const pp of [
    { x: 0.6, y: 0.0 },   // turn 1
    { x: 0.05, y: -0.02 }, // turn 2
    { x: 0.05, y: -0.56 }, // turn 3
  ]) {
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 4), pinMat);
    pin.position.set(pp.x, pp.y, mapZ + 0.006);
    mapGroup.add(pin);
  }

  // Position the whole map group on back wall
  mapGroup.position.set(-2, 2.2, czBack - wallThick / 2);
  mapGroup.rotation.y = Math.PI;
  scene.add(mapGroup);

  // Radio station (against right wall)
  const radioGeo = new THREE.BoxGeometry(0.5, 0.35, 0.3);
  const radio = new THREE.Mesh(radioGeo, metalWreck);
  radio.position.set(5.5, 0.95, 11);
  scene.add(radio);
  // Radio on small desk with legs
  const radioDeskGeo = new THREE.BoxGeometry(1.2, 0.06, 0.6);
  const radioDesk = new THREE.Mesh(radioDeskGeo, new THREE.MeshLambertMaterial({ color: 0x4a3a2a }));
  radioDesk.position.set(5.5, 0.75, 11);
  scene.add(radioDesk);
  for (const dlx of [-0.5, 0.5]) {
    for (const dlz of [10.75, 11.25]) {
      const dlegGeo = new THREE.BoxGeometry(0.06, 0.75, 0.06);
      const dleg = new THREE.Mesh(dlegGeo, new THREE.MeshLambertMaterial({ color: 0x4a3a2a }));
      dleg.position.set(5.5 + dlx, 0.375, dlz);
      scene.add(dleg);
    }
  }
  // Antenna
  const radioAntGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.8, 3);
  const radioAnt = new THREE.Mesh(radioAntGeo, metalBurnt);
  radioAnt.position.set(5.7, 1.5, 11);
  radioAnt.rotation.z = 0.3;
  scene.add(radioAnt);

  // Ammo crates stacked against left wall
  for (let i = 0; i < 4; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.45), crateMat);
    crate.position.set(-5.5 + (i % 2) * 0.7, 0.2 + Math.floor(i / 2) * 0.4, 11 + (i % 2) * 0.1);
    crate.rotation.y = (Math.random() - 0.5) * 0.15;
    scene.add(crate);
  }

  // Field cots (2, against back wall corners)
  for (const cx of [-4.5, 4]) {
    const cotFrame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 1.6), metalWreck);
    cotFrame.position.set(cx, 0.15, 12.5);
    scene.add(cotFrame);
    const cotCanvas = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.05, 1.4),
      new THREE.MeshLambertMaterial({ color: 0x4a5a3a })
    );
    cotCanvas.position.set(cx, 0.32, 12.5);
    scene.add(cotCanvas);
  }

  // Folding chairs (knocked over)
  const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.03, 0.35), metalWreck);
  chairSeat.position.set(-1.5, 0.25, 8.3);
  chairSeat.rotation.z = 1.2;
  scene.add(chairSeat);
  const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.03), metalWreck);
  chairBack.position.set(-1.5, 0.4, 8.1);
  chairBack.rotation.z = 1.2;
  scene.add(chairBack);

  // Sandbags at entrance (defensive position)
  for (let i = 0; i < 3; i++) {
    for (let row = 0; row < 2; row++) {
      const bag = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.3, 0.4),
        row % 2 === 0 ? sandbagMat : sandbagDkMat
      );
      bag.position.set(-1.5 + i * 1.2, 0.15 + row * 0.28, czFront - 0.8);
      bag.rotation.y = (Math.random() - 0.5) * 0.1;
      scene.add(bag);
    }
  }

  // Shell casings on floor
  const casingMat = new THREE.MeshLambertMaterial({ color: 0xaa8833 });
  for (let i = 0; i < 15; i++) {
    const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.04, 3), casingMat);
    casing.position.set(
      (Math.random() - 0.5) * 10,
      0.06,
      czFront + 1 + Math.random() * 8
    );
    casing.rotation.x = Math.PI / 2;
    casing.rotation.z = Math.random() * Math.PI;
    scene.add(casing);
  }

  // MRE wrappers / trash
  const trashMat = new THREE.MeshLambertMaterial({ color: 0x5a5a3a });
  for (let i = 0; i < 4; i++) {
    const trash = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.1), trashMat);
    trash.rotation.x = -Math.PI / 2;
    trash.rotation.z = Math.random() * Math.PI;
    trash.position.set(
      (Math.random() - 0.5) * 6,
      0.06,
      7 + Math.random() * 5
    );
    scene.add(trash);
  }

  // Light inside (dim, like a dying bulb)
  const cpLight = new THREE.PointLight(0xffaa66, 0.6, 12);
  cpLight.position.set(0, 3.5, 9);
  scene.add(cpLight);
  allFireLights.push(cpLight);

  // Dangling light fixture
  const wireGeo = new THREE.CylinderGeometry(0.008, 0.008, 1.2, 3);
  const wire = new THREE.Mesh(wireGeo, metalBurnt);
  wire.position.set(0, wallH - 0.6, 9);
  scene.add(wire);
  const bulbGeo = new THREE.SphereGeometry(0.06, 5, 5);
  const bulb = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.6 }));
  bulb.position.set(0, wallH - 1.2, 9);
  scene.add(bulb);

  // --- FALLEN SOLDIER MEMORIALS (3 battlefield crosses near back wall) ---
  const memPositions = [{ x: -1.8, z: 12.8 }, { x: 0, z: 12.8 }, { x: 1.8, z: 12.8 }];
  const dogtagMat = new THREE.MeshLambertMaterial({ color: 0x8a8a8a });
  const dogtagChainMat = new THREE.MeshLambertMaterial({ color: 0x6a6a6a });
  for (const mp of memPositions) {
    const mem = new THREE.Group();
    // Rifle (bayonet down, stock up)
    const rifleGeo = new THREE.BoxGeometry(0.05, 1.0, 0.06);
    const rifle = new THREE.Mesh(rifleGeo, marineGunMat);
    rifle.position.y = 0.5;
    mem.add(rifle);
    // Stock (wider top)
    const stockGeo = new THREE.BoxGeometry(0.07, 0.2, 0.1);
    const stock = new THREE.Mesh(stockGeo, marineBootMat);
    stock.position.y = 1.05;
    mem.add(stock);
    // Bayonet tip in ground
    const bayGeo = new THREE.ConeGeometry(0.015, 0.12, 4);
    const bay = new THREE.Mesh(bayGeo, new THREE.MeshLambertMaterial({ color: 0x8a8a8a }));
    bay.position.y = -0.02;
    bay.rotation.x = Math.PI;
    mem.add(bay);
    // Helmet resting on stock
    const helmetGeo = new THREE.SphereGeometry(0.14, 6, 5);
    helmetGeo.scale(1.05, 0.8, 1.1);
    const helmet = new THREE.Mesh(helmetGeo, marineHelmetMat);
    helmet.position.y = 1.2;
    mem.add(helmet);
    // Helmet band
    const hBandGeo = new THREE.BoxGeometry(0.2, 0.03, 0.2);
    const hBand = new THREE.Mesh(hBandGeo, marineHelmetBandMat);
    hBand.position.y = 1.18;
    mem.add(hBand);
    // Dog tags hanging from rifle grip
    const chainGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.2, 3);
    const chain = new THREE.Mesh(chainGeo, dogtagChainMat);
    chain.position.set(0.04, 0.85, 0.04);
    chain.rotation.z = 0.15;
    mem.add(chain);
    const tagGeo = new THREE.BoxGeometry(0.04, 0.06, 0.005);
    const tag = new THREE.Mesh(tagGeo, dogtagMat);
    tag.position.set(0.05, 0.73, 0.04);
    tag.rotation.z = 0.1;
    mem.add(tag);
    // Boots at base (pair, toes out)
    for (const bx of [-0.1, 0.1]) {
      const bootGeo = new THREE.BoxGeometry(0.1, 0.12, 0.18);
      const boot = new THREE.Mesh(bootGeo, marineBootMat);
      boot.position.set(bx, 0.06, 0.15);
      boot.rotation.y = bx > 0 ? 0.15 : -0.15;
      mem.add(boot);
    }
    mem.position.set(mp.x, 0, mp.z);
    scene.add(mem);
  }
})();
