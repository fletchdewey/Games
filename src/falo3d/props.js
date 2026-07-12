// --- WAR DEBRIS ---
const militaryGreen = new THREE.MeshLambertMaterial({ color: 0x3a4a2a });
const militaryDk = new THREE.MeshLambertMaterial({ color: 0x2a3a1a });
const metalWreck = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
const metalBurnt = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
const sandbagMat = new THREE.MeshLambertMaterial({ color: 0x8a7a5a });
const sandbagDkMat = new THREE.MeshLambertMaterial({ color: 0x6a5a3a });
const bloodMat = new THREE.MeshBasicMaterial({ color: 0x3a0808, transparent: true, opacity: 0.5 });
const barbWireMat = new THREE.MeshLambertMaterial({ color: 0x5a5a5a });
const crateMat = new THREE.MeshLambertMaterial({ color: 0x5a6a3a });

// Destroyed military vehicles scattered along the street
function createDestroyedTank(x, z, rot) {
  const g = new THREE.Group();
  // Hull
  const hullGeo = new THREE.BoxGeometry(3.2, 1.2, 5.5);
  const hull = new THREE.Mesh(hullGeo, metalWreck);
  hull.position.y = 0.8;
  hull.castShadow = true;
  g.add(hull);
  // Track guards
  for (const sx of [-1.7, 1.7]) {
    const tgGeo = new THREE.BoxGeometry(0.3, 0.5, 5.5);
    const tg = new THREE.Mesh(tgGeo, metalBurnt);
    tg.position.set(sx, 0.5, 0);
    g.add(tg);
  }
  // Turret (tilted/damaged)
  const turGeo = new THREE.BoxGeometry(2.2, 0.8, 2.5);
  const tur = new THREE.Mesh(turGeo, metalWreck);
  tur.position.set(0.1, 1.8, -0.3);
  tur.rotation.y = (rand()-0.5) * 0.5;
  tur.rotation.z = (rand()-0.5) * 0.15;
  g.add(tur);
  // Barrel (bent/broken)
  const barGeo = new THREE.CylinderGeometry(0.12, 0.15, 4, 6);
  barGeo.rotateX(Math.PI/2);
  const bar = new THREE.Mesh(barGeo, metalBurnt);
  bar.position.set(0, 1.9, -3.2);
  bar.rotation.x = (rand()-0.5) * 0.2;
  bar.rotation.y = (rand()-0.5) * 0.3;
  g.add(bar);
  // Blown-off hatch
  const hatchGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 6);
  const hatch = new THREE.Mesh(hatchGeo, metalWreck);
  hatch.position.set(rand()*2, 0.1, rand()*2 - 3);
  hatch.rotation.set(rand(), rand(), rand());
  g.add(hatch);
  // Tracks (broken)
  for (const sx of [-1.7, 1.7]) {
    for (let tz = -2.2; tz < 2.5; tz += 0.6) {
      const wGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 6);
      wGeo.rotateZ(Math.PI/2);
      const w = new THREE.Mesh(wGeo, metalBurnt);
      w.position.set(sx, 0.35, tz);
      g.add(w);
    }
  }
  // Scorch marks on hull
  const scGeo = new THREE.PlaneGeometry(2, 2);
  const sc = new THREE.Mesh(scGeo, new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.4 }));
  sc.position.set(rand()-0.5, 1.2, 2.76);
  g.add(sc);
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  scene.add(g);
}

function createDestroyedHumvee(x, z, rot) {
  const g = new THREE.Group();
  const bodyGeo = new THREE.BoxGeometry(2, 1.3, 4);
  const body = new THREE.Mesh(bodyGeo, militaryGreen);
  body.position.y = 0.8;
  body.castShadow = true;
  g.add(body);
  // Hood
  const hoodGeo = new THREE.BoxGeometry(1.8, 0.3, 1.2);
  const hood = new THREE.Mesh(hoodGeo, militaryDk);
  hood.position.set(0, 0.9, -2.2);
  hood.rotation.x = 0.15;
  g.add(hood);
  // Windshield (smashed)
  const wsGeo = new THREE.BoxGeometry(1.6, 0.8, 0.08);
  const ws = new THREE.Mesh(wsGeo, new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  ws.position.set(0, 1.6, -1.4);
  ws.rotation.x = 0.3;
  g.add(ws);
  // Wheels (some missing)
  for (const wx of [-1, 1]) {
    for (const wz of [-1.3, 1.3]) {
      if (rand() > 0.3) {
        const wGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 6);
        wGeo.rotateZ(Math.PI/2);
        const w = new THREE.Mesh(wGeo, metalBurnt);
        w.position.set(wx * 1.1, 0.35, wz);
        g.add(w);
      }
    }
  }
  // Turret mount (empty or damaged .50 cal)
  if (rand() > 0.4) {
    const mountGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 5);
    const mount = new THREE.Mesh(mountGeo, metalBurnt);
    mount.position.set(0, 1.7, 0);
    g.add(mount);
    const gunGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 4);
    gunGeo.rotateX(Math.PI/2);
    const gun = new THREE.Mesh(gunGeo, metalBurnt);
    gun.position.set(0, 1.9, -0.4);
    gun.rotation.x = rand() * 0.3;
    g.add(gun);
  }
  // Damage holes
  for (let h = 0; h < 3; h++) {
    const hGeo = new THREE.SphereGeometry(0.15 + rand()*0.15, 4, 4);
    const hole = new THREE.Mesh(hGeo, metalBurnt);
    hole.position.set((rand()-0.5)*1.5, 0.5 + rand()*0.8, (rand()-0.5)*3);
    g.add(hole);
  }
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  scene.add(g);
}

// Place destroyed vehicles along the street
// Seg 1 vehicles
createDestroyedTank(-6, -25, 0.3);
createDestroyedHumvee(8, -50, 0.8);
createDestroyedHumvee(-4, -90, -0.2);
createDestroyedTank(5, -130, -0.5 + Math.PI);
// Seg 2 vehicles (along x-axis at z=-150)
createDestroyedHumvee(-30, -145, 1.2);
createDestroyedTank(-70, -155, 0.8);
createDestroyedHumvee(-110, -148, -0.3);
// Seg 3 vehicles (along z-axis at x=-150)
createDestroyedTank(-145, -180, 0.1);
createDestroyedHumvee(-155, -220, 1.5);
createDestroyedHumvee(-148, -260, -0.6);
// Seg 4 vehicles (along x-axis at z=-300)
createDestroyedTank(-120, -295, 0.4);
createDestroyedHumvee(-70, -305, -0.2);
createDestroyedHumvee(-30, -298, 1.8);

// Collision for vehicles (axis-aligned bounding boxes)
const vehicleCollisions = [
  // Seg 1
  { x: -6, z: -25, w: 4, d: 6, h: 2 },
  { x: 8, z: -50, w: 2.5, d: 4.5, h: 1.5 },
  { x: -4, z: -90, w: 2.5, d: 4.5, h: 1.5 },
  { x: 5, z: -130, w: 4, d: 6, h: 2 },
  // Seg 2
  { x: -30, z: -145, w: 2.5, d: 4.5, h: 1.5 },
  { x: -70, z: -155, w: 4, d: 6, h: 2 },
  { x: -110, z: -148, w: 2.5, d: 4.5, h: 1.5 },
  // Seg 3
  { x: -145, z: -180, w: 4, d: 6, h: 2 },
  { x: -155, z: -220, w: 2.5, d: 4.5, h: 1.5 },
  { x: -148, z: -260, w: 2.5, d: 4.5, h: 1.5 },
  // Seg 4
  { x: -120, z: -295, w: 4, d: 6, h: 2 },
  { x: -70, z: -305, w: 2.5, d: 4.5, h: 1.5 },
  { x: -30, z: -298, w: 2.5, d: 4.5, h: 1.5 },
];
for (const v of vehicleCollisions) {
  platformData.push({ x: v.x - v.w/2, y: 0, z: v.z - v.d/2, w: v.w, h: v.h, d: v.d });
}

// Sandbag barricades
function createSandbagWall(x, z, rot, length) {
  const g = new THREE.Group();
  const rows = 3;
  for (let row = 0; row < rows; row++) {
    for (let i = 0; i < length; i++) {
      const bagGeo = new THREE.BoxGeometry(0.8, 0.3, 0.4);
      const bag = new THREE.Mesh(bagGeo, row % 2 === 0 ? sandbagMat : sandbagDkMat);
      const offset = row % 2 === 0 ? 0 : 0.4;
      bag.position.set(i * 0.75 - (length * 0.375) + offset, row * 0.28, 0);
      bag.rotation.y = (rand()-0.5) * 0.1;
      bag.castShadow = true;
      g.add(bag);
    }
  }
  g.position.set(x, 0.15, z);
  g.rotation.y = rot;
  scene.add(g);
}

// Seg 1 sandbags
createSandbagWall(-5, -15, 0.2, 6);
createSandbagWall(7, -60, -0.1, 5);
createSandbagWall(-3, -100, 0, 4);
// Seg 2 sandbags (along x at z=-150)
createSandbagWall(-40, -148, 1.5, 5);
createSandbagWall(-90, -152, 1.5, 6);
// Seg 3 sandbags (along z at x=-150)
createSandbagWall(-148, -200, 0.2, 5);
createSandbagWall(-152, -250, 0, 4);
// Seg 4 sandbags (along x at z=-300)
createSandbagWall(-100, -298, 1.5, 6);
createSandbagWall(-50, -302, 1.5, 5);

// Collision for sandbag walls
const sandbagCollisions = [
  { x: -5, z: -15, w: 4.5, d: 1, h: 1 },
  { x: 7, z: -60, w: 3.75, d: 1, h: 1 },
  { x: -3, z: -100, w: 3, d: 1, h: 1 },
  { x: -40, z: -148, w: 1, d: 3.75, h: 1 },
  { x: -90, z: -152, w: 1, d: 4.5, h: 1 },
  { x: -148, z: -200, w: 3.75, d: 1, h: 1 },
  { x: -152, z: -250, w: 3, d: 1, h: 1 },
  { x: -100, z: -298, w: 1, d: 4.5, h: 1 },
  { x: -50, z: -302, w: 1, d: 3.75, h: 1 },
];
for (const s of sandbagCollisions) {
  platformData.push({ x: s.x - s.w/2, y: 0, z: s.z - s.d/2, w: s.w, h: s.h, d: s.d });
}

// --- SECRET ROOM (hidden alcove off the main path) ---
// Located at x:-28, z:-95 — tucked behind a building, requires going off-path
// Hidden behind the west wall of segment 3, requires noticing a gap
const SECRET_ROOM = { x: -170, z: -230, radius: 3.5 };
const SR = SECRET_ROOM;
const secretRoomMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
const secretGlowMat = new THREE.MeshLambertMaterial({ color: 0x44ff66, emissive: 0x22ff44, emissiveIntensity: 0.5 });

// Room structure (recessed into the wall, narrow entrance)
// Back wall
const srBackGeo = new THREE.BoxGeometry(5, 3.5, 0.5);
const srBack = new THREE.Mesh(srBackGeo, secretRoomMat);
srBack.position.set(SR.x, 1.75, SR.z - 2.5);
scene.add(srBack);
// Side walls
for (const sx of [-2.5, 2.5]) {
  const srSideGeo = new THREE.BoxGeometry(0.5, 3.5, 5);
  const srSide = new THREE.Mesh(srSideGeo, secretRoomMat);
  srSide.position.set(SR.x + sx, 1.75, SR.z);
  scene.add(srSide);
}
// Ceiling (low — feels like crawling into a bunker)
const srCeilGeo = new THREE.BoxGeometry(5.5, 0.5, 5.5);
const srCeil = new THREE.Mesh(srCeilGeo, secretRoomMat);
srCeil.position.set(SR.x, 3.5, SR.z);
scene.add(srCeil);
// Floor
const srFloorGeo = new THREE.BoxGeometry(5, 0.1, 5);
const srFloor = new THREE.Mesh(srFloorGeo, new THREE.MeshLambertMaterial({ color: 0x1a1a12 }));
srFloor.position.set(SR.x, 0.05, SR.z);
scene.add(srFloor);
// Front wall with narrow entrance gap (2 units wide)
for (const fx of [-2, 2]) {
  const frontGeo = new THREE.BoxGeometry(1.5, 3.5, 0.5);
  const front = new THREE.Mesh(frontGeo, secretRoomMat);
  front.position.set(SR.x + fx, 1.75, SR.z + 2.5);
  scene.add(front);
}

// Glowing artifact inside (alien tech)
const artifactGeo = new THREE.TorusGeometry(0.4, 0.06, 6, 8);
const artifact = new THREE.Mesh(artifactGeo, secretGlowMat);
artifact.position.set(SR.x, 2, SR.z - 2.2);
scene.add(artifact);
const artifactInner = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), secretGlowMat);
artifactInner.position.set(SR.x, 2, SR.z - 2.2);
scene.add(artifactInner);
// Artifact light (only visible once inside)
const artifactLight = new THREE.PointLight(0x44ff66, 1, 6);
artifactLight.position.set(SR.x, 2, SR.z);
scene.add(artifactLight);

// --- THE CLUE: green glow splotch on the nearby corridor wall ---
// This is on the INSIDE of the corridor wall at seg 3, visible to the player
// Just a faint green splash that says "something's behind here"
const clueGlowMat = new THREE.MeshBasicMaterial({ color: 0x22ff44, transparent: true, opacity: 0.15 });
// Glow splotch on wall
const clueGeo = new THREE.PlaneGeometry(2, 1.5);
const clue = new THREE.Mesh(clueGeo, clueGlowMat);
clue.position.set(-150 - CORRIDOR_HALF + 0.2, 1.5, SR.z); // on inner face of west wall
clue.rotation.y = Math.PI / 2; // face into corridor
scene.add(clue);
// Small green point light to catch the eye
const clueLight = new THREE.PointLight(0x22ff44, 0.4, 8);
clueLight.position.set(-150 - CORRIDOR_HALF + 1, 1.5, SR.z);
scene.add(clueLight);
// Tiny crack of green light at floor level (gap in the wall)
const crackGeo = new THREE.BoxGeometry(0.1, 0.3, 1.5);
const crack = new THREE.Mesh(crackGeo, new THREE.MeshBasicMaterial({ color: 0x33ff55, transparent: true, opacity: 0.25 }));
crack.position.set(-150 - CORRIDOR_HALF + 0.1, 0.15, SR.z);
scene.add(crack);
