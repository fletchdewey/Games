// --- GORE EXPLOSION ---
const goreColors = [0x8a1a1a, 0xaa2222, 0x6a0a0a, 0x551111, 0x4a3a5a, 0x3a2a4a];
const goreMats = goreColors.map(c => new THREE.MeshLambertMaterial({ color: c }));
const gibGeos = [
  new THREE.SphereGeometry(0.12, 3, 3),
  new THREE.BoxGeometry(0.15, 0.08, 0.1),
  new THREE.CylinderGeometry(0.03, 0.03, 0.25, 3),
  new THREE.SphereGeometry(0.08, 3, 3),
  new THREE.BoxGeometry(0.2, 0.05, 0.12),
];

const MAX_GIBS_MAP = { high: 80, medium: 40, low: 20 };
const MAX_PARTICLES_MAP = { high: 100, medium: 50, low: 25 };
function getMaxGibs() { return MAX_GIBS_MAP[settings.particleLevel] || 80; }
function getMaxParticles() { return MAX_PARTICLES_MAP[settings.particleLevel] || 100; }
let gibs = [];
function spawnGoreExplosion(pos) {
  const count = 12 + Math.floor(Math.random() * 8);
  for (let i = 0; i < count; i++) {
    // Recycle oldest gibs if over limit
    if (gibs.length >= getMaxGibs()) {
      const old = gibs.shift();
      scene.remove(old.mesh);
    }
    const geoIdx = Math.floor(Math.random() * gibGeos.length);
    const matIdx = Math.floor(Math.random() * goreMats.length);
    const mesh = new THREE.Mesh(gibGeos[geoIdx], goreMats[matIdx]);
    mesh.position.copy(pos);
    mesh.position.y += 1;
    mesh.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
    scene.add(mesh);
    gibs.push({
      mesh,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 0.4,
        Math.random() * 0.25 + 0.1,
        (Math.random() - 0.5) * 0.4
      ),
      rotVel: new THREE.Vector3(
        (Math.random()-0.5)*0.3,
        (Math.random()-0.5)*0.3,
        (Math.random()-0.5)*0.3
      ),
      life: 50 + Math.random() * 40,
      bounced: false,
    });
  }
}

// --- PARTICLES ---
let particles = [];
const particleGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
const particleMatCache = {};
function getParticleMat(color) {
  if (!particleMatCache[color]) {
    particleMatCache[color] = new THREE.MeshBasicMaterial({ color });
  }
  return particleMatCache[color];
}
function spawnParticles(pos, color, count) {
  const mat = getParticleMat(color);
  for (let i = 0; i < count; i++) {
    // Recycle oldest if over limit
    if (particles.length >= getMaxParticles()) {
      const old = particles.shift();
      scene.remove(old.mesh);
    }
    const mesh = new THREE.Mesh(particleGeo, mat);
    mesh.position.copy(pos);
    scene.add(mesh);
    particles.push({
      mesh,
      vel: new THREE.Vector3((Math.random()-0.5)*0.3, Math.random()*0.2+0.1, (Math.random()-0.5)*0.3),
      life: 30 + Math.random() * 20,
    });
  }
}
