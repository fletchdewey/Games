let bullets = [];

// Bullet configs per owner
const bulletCfg = {
  player: {
    color: 0xffcc22, glowColor: 0xffaa00, trailColor: 0xff8800,
    length: 0.6, radius: 0.035, speed: 1.4, lightIntensity: 1.5, lightDist: 6,
    trailLength: 8, trailOpacity: 0.4,
  },
  marine: {
    color: 0x66ff44, glowColor: 0x44dd22, trailColor: 0x33aa11,
    length: 0.5, radius: 0.03, speed: 1.3, lightIntensity: 1, lightDist: 5,
    trailLength: 5, trailOpacity: 0.35,
  },
  alien: {
    color: 0xff2244, glowColor: 0xff0033, trailColor: 0xcc0022,
    length: 0.4, radius: 0.05, speed: 0.55, lightIntensity: 1.2, lightDist: 5,
    trailLength: 6, trailOpacity: 0.5,
  },
};

function createBulletMesh(owner) {
  const cfg = bulletCfg[owner];
  const group = new THREE.Group();

  // Bullet body (elongated cylinder + cone tip)
  const bodyGeo = new THREE.CylinderGeometry(cfg.radius, cfg.radius, cfg.length, 4);
  bodyGeo.rotateX(Math.PI / 2);
  const bodyMat = new THREE.MeshBasicMaterial({ color: cfg.color });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  // Hot glowing tip
  const tipGeo = new THREE.ConeGeometry(cfg.radius * 1.2, cfg.length * 0.35, 4);
  tipGeo.rotateX(-Math.PI / 2);
  const tipMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const tip = new THREE.Mesh(tipGeo, tipMat);
  tip.position.z = -cfg.length * 0.45;
  group.add(tip);

  // Glow sphere (no point light — use emissive glow mesh instead)
  const glowGeo = new THREE.SphereGeometry(cfg.radius * 3, 4, 4);
  const glowMat = new THREE.MeshBasicMaterial({
    color: cfg.glowColor, transparent: true, opacity: 0.25
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  group.add(glow);

  // Alien bullets get extra energy ring
  if (owner === 'alien') {
    const ringGeo = new THREE.TorusGeometry(cfg.radius * 2.5, cfg.radius * 0.5, 3, 6);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff4466, transparent: true, opacity: 0.3
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    group.add(ring);
  }

  return group;
}

function shootBullet(origin, direction, owner) {
  const cfg = bulletCfg[owner];
  const mesh = createBulletMesh(owner);
  mesh.position.copy(origin);

  // Orient bullet in direction of travel
  const target = origin.clone().add(direction);
  mesh.lookAt(target);

  scene.add(mesh);

  // Trail segments (positions history)
  const trail = [];
  const trailMeshes = [];
  const trailMat = new THREE.MeshBasicMaterial({
    color: cfg.trailColor, transparent: true, opacity: cfg.trailOpacity
  });

  bullets.push({
    mesh, trail, trailMeshes, trailMat,
    vel: direction.clone().multiplyScalar(cfg.speed),
    owner,
    life: 120,
    cfg,
  });
}

// Trail segment geometry (reused)
const trailSegGeo = new THREE.SphereGeometry(1, 3, 3);

// --- AMMO DROPS (bomb shaped) ---
let ammoDrops = [];
const bombMat = new THREE.MeshLambertMaterial({ color: 0x3a3a2a });
const bombNoseMat = new THREE.MeshLambertMaterial({ color: 0xcc4422, emissive: 0xaa2200, emissiveIntensity: 0.3 });
const bombFinMat = new THREE.MeshLambertMaterial({ color: 0x4a4a3a });
const bombBandMat = new THREE.MeshLambertMaterial({ color: 0xccaa22, emissive: 0xaa8800, emissiveIntensity: 0.3 });

function createBombMesh() {
  const group = new THREE.Group();
  // Body cylinder
  const bodyGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.8, 6);
  bodyGeo.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, bombMat);
  group.add(body);
  // Nose cone
  const noseGeo = new THREE.ConeGeometry(0.18, 0.3, 6);
  noseGeo.rotateX(-Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo, bombNoseMat);
  nose.position.z = -0.55;
  group.add(nose);
  // Rear cap
  const rearGeo = new THREE.SphereGeometry(0.17, 5, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  rearGeo.rotateX(Math.PI / 2);
  const rear = new THREE.Mesh(rearGeo, bombMat);
  rear.position.z = 0.4;
  group.add(rear);
  // Yellow band (warning stripe)
  const bandGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.08, 6);
  bandGeo.rotateX(Math.PI / 2);
  const band = new THREE.Mesh(bandGeo, bombBandMat);
  band.position.z = -0.15;
  group.add(band);
  const band2 = new THREE.Mesh(bandGeo, bombBandMat);
  band2.position.z = 0.15;
  group.add(band2);
  // Tail fins (4x)
  for (let i = 0; i < 4; i++) {
    const finGeo = new THREE.BoxGeometry(0.02, 0.25, 0.2);
    const fin = new THREE.Mesh(finGeo, bombFinMat);
    fin.position.z = 0.35;
    const finHolder = new THREE.Group();
    finHolder.add(fin);
    finHolder.rotation.z = (i / 4) * Math.PI * 2;
    group.add(finHolder);
  }
  return group;
}

function spawnAmmoDrop(pos) {
  const mesh = createBombMesh();
  mesh.position.copy(pos);
  mesh.position.y = 0.4;
  scene.add(mesh);
  ammoDrops.push({ mesh, amount: 5 });
}

// --- HEALTH DROPS (medkit shaped) ---
let healthDrops = [];
const medkitMat = new THREE.MeshLambertMaterial({ color: 0x3a4a3a });
const medkitCrossMat = new THREE.MeshLambertMaterial({ color: 0x44ff66, emissive: 0x22dd44, emissiveIntensity: 0.5 });
const medkitLidMat = new THREE.MeshLambertMaterial({ color: 0x4a5a4a });

function createMedkitMesh() {
  const group = new THREE.Group();
  // Box body
  const bodyGeo = new THREE.BoxGeometry(0.45, 0.25, 0.35);
  const body = new THREE.Mesh(bodyGeo, medkitMat);
  group.add(body);
  // Lid (slightly wider)
  const lidGeo = new THREE.BoxGeometry(0.48, 0.06, 0.38);
  const lid = new THREE.Mesh(lidGeo, medkitLidMat);
  lid.position.y = 0.15;
  group.add(lid);
  // Cross (vertical bar + horizontal bar on top of lid)
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.22), medkitCrossMat);
  crossV.position.y = 0.19;
  group.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.06), medkitCrossMat);
  crossH.position.y = 0.19;
  group.add(crossH);
  // Handle
  const handleGeo = new THREE.BoxGeometry(0.16, 0.06, 0.03);
  const handle = new THREE.Mesh(handleGeo, medkitLidMat);
  handle.position.y = 0.22;
  group.add(handle);
  return group;
}

function spawnHealthDrop(pos) {
  const mesh = createMedkitMesh();
  mesh.position.copy(pos);
  mesh.position.y = 0.4;
  scene.add(mesh);
  healthDrops.push({ mesh, amount: 15 });
}

