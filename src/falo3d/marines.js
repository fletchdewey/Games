// --- MARINES (AI SQUAD) ---
let marines = [];
const MARINE_CLASSES = [
  { name: 'ALPHA',   role: 'ASSAULT',  fireRate: 1.0, spread: 1.0, color: 0xccaa22 },
  { name: 'BRAVO',   role: 'RECON',    fireRate: 0.6, spread: 0.8, color: 0x44ccff },
  { name: 'CHARLIE', role: 'DEMO',     fireRate: 1.8, spread: 1.2, color: 0xff6622 },
  { name: 'DELTA',   role: 'MARKSMAN', fireRate: 2.2, spread: 0.5, color: 0xaa44ff },
];

function createMarineMesh(bandColor) {
  if (bandColor === undefined) bandColor = 0x6a5a3a;
  const group = new THREE.Group();

  // --- Boots ---
  for (const lx of [-0.18, 0.18]) {
    const bootGeo = new THREE.BoxGeometry(0.2, 0.28, 0.3);
    const boot = new THREE.Mesh(bootGeo, marineBootMat);
    boot.position.set(lx, 0.14, 0.02);
    boot.castShadow = true;
    group.add(boot);
  }

  // --- Legs (pants) ---
  for (const lx of [-0.18, 0.18]) {
    const legGeo = new THREE.BoxGeometry(0.22, 0.55, 0.22);
    const leg = new THREE.Mesh(legGeo, marineFatiguesDkMat);
    leg.position.set(lx, 0.55, 0);
    leg.castShadow = true;
    group.add(leg);
    const kneePadGeo = new THREE.BoxGeometry(0.18, 0.12, 0.08);
    const kneePad = new THREE.Mesh(kneePadGeo, marineBootMat);
    kneePad.position.set(lx, 0.45, 0.14);
    group.add(kneePad);
  }

  // --- Belt & pouches ---
  const beltGeo = new THREE.BoxGeometry(0.55, 0.1, 0.3);
  const belt = new THREE.Mesh(beltGeo, marineBootMat);
  belt.position.set(0, 0.85, 0);
  group.add(belt);
  for (const px of [-0.22, 0.22]) {
    const pouchGeo = new THREE.BoxGeometry(0.1, 0.12, 0.1);
    const pouch = new THREE.Mesh(pouchGeo, marineFatiguesDkMat);
    pouch.position.set(px, 0.82, 0.16);
    group.add(pouch);
  }

  // --- Torso ---
  const torsoGeo = new THREE.BoxGeometry(0.55, 0.6, 0.32);
  const torso = new THREE.Mesh(torsoGeo, marineFatiguesMat);
  torso.position.set(0, 1.2, 0);
  torso.castShadow = true;
  group.add(torso);

  // --- Plate carrier vest ---
  const vestGeo = new THREE.BoxGeometry(0.52, 0.45, 0.36);
  const vest = new THREE.Mesh(vestGeo, marineVestMat);
  vest.position.set(0, 1.25, 0);
  group.add(vest);
  const plateGeo = new THREE.BoxGeometry(0.3, 0.3, 0.06);
  const plate = new THREE.Mesh(plateGeo, new THREE.MeshLambertMaterial({ color: 0x6a6a5a }));
  plate.position.set(0, 1.28, 0.2);
  group.add(plate);
  for (const sx of [-0.32, 0.32]) {
    const padGeo = new THREE.BoxGeometry(0.15, 0.08, 0.25);
    const pad = new THREE.Mesh(padGeo, marineVestMat);
    pad.position.set(sx, 1.45, 0);
    group.add(pad);
  }
  for (let mx = -0.12; mx <= 0.12; mx += 0.12) {
    const magGeo = new THREE.BoxGeometry(0.06, 0.12, 0.06);
    const mag = new THREE.Mesh(magGeo, marineFatiguesDkMat);
    mag.position.set(mx, 1.08, 0.2);
    group.add(mag);
  }

  // --- Arms ---
  for (const side of [-1, 1]) {
    const upperGeo = new THREE.BoxGeometry(0.18, 0.35, 0.18);
    const upper = new THREE.Mesh(upperGeo, marineFatiguesMat);
    upper.position.set(side * 0.38, 1.3, 0);
    upper.castShadow = true;
    group.add(upper);
    const cuffGeo = new THREE.BoxGeometry(0.19, 0.06, 0.19);
    const cuff = new THREE.Mesh(cuffGeo, marineFatiguesDkMat);
    cuff.position.set(side * 0.38, 1.14, 0);
    group.add(cuff);
    const foreGeo = new THREE.BoxGeometry(0.15, 0.3, 0.15);
    const fore = new THREE.Mesh(foreGeo, marineSkinMat);
    fore.position.set(side * 0.38, 0.97, 0.05);
    group.add(fore);
    const handGeo = new THREE.BoxGeometry(0.13, 0.1, 0.15);
    const hand = new THREE.Mesh(handGeo, marineFatiguesDkMat);
    hand.position.set(side * 0.38, 0.8, 0.1);
    group.add(hand);
  }

  // --- Neck ---
  const neckGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.12, 6);
  const neck = new THREE.Mesh(neckGeo, marineSkinMat);
  neck.position.set(0, 1.56, 0);
  group.add(neck);

  // --- Head ---
  const headGeo = new THREE.BoxGeometry(0.32, 0.34, 0.32);
  const head = new THREE.Mesh(headGeo, marineSkinMat);
  head.position.set(0, 1.8, 0);
  head.castShadow = true;
  group.add(head);
  const jawGeo = new THREE.BoxGeometry(0.28, 0.08, 0.2);
  const jaw = new THREE.Mesh(jawGeo, marineSkinDkMat);
  jaw.position.set(0, 1.64, 0.04);
  group.add(jaw);
  for (const ex of [-0.08, 0.08]) {
    const eyeGeo = new THREE.BoxGeometry(0.06, 0.04, 0.02);
    const ew = new THREE.Mesh(eyeGeo, new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
    ew.position.set(ex, 1.82, 0.17);
    group.add(ew);
    const pupilGeo = new THREE.BoxGeometry(0.03, 0.04, 0.02);
    const pupil = new THREE.Mesh(pupilGeo, new THREE.MeshLambertMaterial({ color: 0x222222 }));
    pupil.position.set(ex, 1.82, 0.18);
    group.add(pupil);
  }
  const noseGeo = new THREE.BoxGeometry(0.06, 0.08, 0.06);
  const nose = new THREE.Mesh(noseGeo, marineSkinDkMat);
  nose.position.set(0, 1.78, 0.17);
  group.add(nose);

  // --- Helmet ---
  const helmetGeo = new THREE.SphereGeometry(0.25, 6, 5);
  helmetGeo.scale(1.05, 0.85, 1.1);
  const helmet = new THREE.Mesh(helmetGeo, marineHelmetMat);
  helmet.position.set(0, 1.93, -0.01);
  helmet.castShadow = true;
  group.add(helmet);
  const rimGeo = new THREE.BoxGeometry(0.35, 0.04, 0.12);
  const rim = new THREE.Mesh(rimGeo, marineHelmetMat);
  rim.position.set(0, 1.86, 0.15);
  group.add(rim);
  // Helmet band — colored by class
  const classBandMat = new THREE.MeshLambertMaterial({ color: bandColor, emissive: bandColor, emissiveIntensity: 0.15 });
  const bandGeo = new THREE.BoxGeometry(0.38, 0.05, 0.38);
  const band = new THREE.Mesh(bandGeo, classBandMat);
  band.position.set(0, 1.9, 0);
  group.add(band);
  const nvgGeo = new THREE.BoxGeometry(0.08, 0.06, 0.06);
  const nvg = new THREE.Mesh(nvgGeo, marineBootMat);
  nvg.position.set(0, 2.0, 0.16);
  group.add(nvg);

  // --- Rifle ---
  const stockGeo = new THREE.BoxGeometry(0.06, 0.08, 0.25);
  const stock = new THREE.Mesh(stockGeo, marineBootMat);
  stock.position.set(0.28, 1.15, -0.12);
  group.add(stock);
  const gunBodyGeo = new THREE.BoxGeometry(0.06, 0.1, 0.6);
  const gunBody = new THREE.Mesh(gunBodyGeo, marineGunMat);
  gunBody.position.set(0.28, 1.18, 0.2);
  group.add(gunBody);
  const barrelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 5);
  barrelGeo.rotateX(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, marineGunMat);
  barrel.position.set(0.28, 1.19, 0.65);
  group.add(barrel);
  const magGeo2 = new THREE.BoxGeometry(0.05, 0.15, 0.06);
  const mag2 = new THREE.Mesh(magGeo2, marineBootMat);
  mag2.position.set(0.28, 1.05, 0.22);
  group.add(mag2);

  // Muzzle flash (toggled on shoot)
  const muzzleGeo = new THREE.SphereGeometry(0.12, 4, 4);
  const muzzle = new THREE.Mesh(muzzleGeo, marineMuzzleMat);
  muzzle.position.set(0.28, 1.19, 0.85);
  muzzle.visible = false;
  muzzle.name = 'muzzleFlash';
  group.add(muzzle);

  // --- Backpack & radio ---
  const packGeo = new THREE.BoxGeometry(0.3, 0.3, 0.15);
  const pack = new THREE.Mesh(packGeo, marineFatiguesDkMat);
  pack.position.set(0, 1.25, -0.24);
  group.add(pack);
  const antennaGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.6, 3);
  const antenna = new THREE.Mesh(antennaGeo, marineBootMat);
  antenna.position.set(-0.1, 1.65, -0.3);
  antenna.rotation.x = -0.15;
  group.add(antenna);

  return group;
}

function spawnMarines() {
  for (const m of marines) scene.remove(m.mesh);
  marines = [];
  const spreadOffsets = [
    { x: -6, z: 1 },
    { x: 6, z: 1 },
    { x: -3, z: -4 },
    { x: 3, z: -4 },
  ];
  const startPositions = [
    { x: -2.5, z: 3 }, { x: 2.5, z: 3 },
    { x: -1.5, z: 6 }, { x: 1.5, z: 6 },
  ];
  for (let i = 0; i < 4; i++) {
    const mc = MARINE_CLASSES[i];
    const mesh = createMarineMesh(mc.color);
    mesh.position.set(startPositions[i].x, 0, startPositions[i].z);
    scene.add(mesh);
    marines.push({
      mesh, name: mc.name, role: mc.role,
      classFireRate: mc.fireRate, classSpread: mc.spread,
      health: diff.marineHealth, maxHealth: diff.marineHealth, alive: true,
      shootTimer: 30 + Math.floor(Math.random() * 60),
      target: null, muzzleTimer: 0, flinchTimer: 0,
      state: 'follow',
      spreadOffset: spreadOffsets[i],
      coverTarget: null,
      scoutZ: 0,
      downedTimer: 0,
      reviveTarget: null,
      reviveProgress: 0,
      calloutTimer: 0,
      calloutText: '',
    });
  }
}
spawnMarines();
