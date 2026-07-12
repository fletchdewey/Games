// --- GROUND (cracked asphalt) ---
const groundGeo = new THREE.PlaneGeometry(800, 800);
const ground = new THREE.Mesh(groundGeo, asphaltMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// --- LEVEL LAYOUT (L-shaped path with 90° turns) ---
// Seg 1: straight -Z from (0,5) to (0,-150)
// Seg 2: left -X from (0,-150) to (-150,-150)  
// Seg 3: right -Z from (-150,-150) to (-150,-300)
// Seg 4: left +X from (-150,-300) to (0,-300)
// King + Helo at end: (0, -300)
const LEVEL_LENGTH = 600; // total path length
const CORRIDOR_HALF = 15; // half-width of corridors
const SHIP_POS = new THREE.Vector3(0, 0, -300);

// Path segments for collision/clamping
const PATH_SEGS = [
  { x1: -CORRIDOR_HALF, z1: -150, x2: CORRIDOR_HALF, z2: 10 },           // seg 1: straight
  { x1: -150 - CORRIDOR_HALF, z1: -150 - CORRIDOR_HALF, x2: CORRIDOR_HALF, z2: -150 + CORRIDOR_HALF }, // seg 2: left
  { x1: -150 - CORRIDOR_HALF, z1: -300, x2: -150 + CORRIDOR_HALF, z2: -150 + CORRIDOR_HALF },         // seg 3: down
  { x1: -150 - CORRIDOR_HALF, z1: -300 - CORRIDOR_HALF, x2: CORRIDOR_HALF, z2: -300 + CORRIDOR_HALF }, // seg 4: right
  { x1: -175, z1: -234, x2: -165, z2: -226 }, // secret room alcove
];

function isInCorridor(x, z) {
  for (const s of PATH_SEGS) {
    if (x >= s.x1 && x <= s.x2 && z >= s.z1 && z <= s.z2) return true;
  }
  return false;
}

// Rubble & cover
const platformData = [];
const platformMeshes = [];
function addPlatform(x, y, z, w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mats = [concreteMat, concreteDkMat, rubbleMat];
  const mesh = new THREE.Mesh(geo, mats[Math.floor(Math.random() * 3)]);
  mesh.position.set(x, y, z);
  mesh.rotation.y = Math.random() * 0.3 - 0.15;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  platformMeshes.push(mesh);
  platformData.push({ x: x-w/2, y: y-h/2, z: z-d/2, w, h, d, mesh });
  // Rebar sticking out
  if (h > 1.5 && Math.random() > 0.5) {
    const rebarGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.5 + Math.random(), 4);
    const rebar = new THREE.Mesh(rebarGeo, rebarMat);
    rebar.position.set(x + (Math.random()-0.5)*w*0.5, y + h/2 + 0.5, z + (Math.random()-0.5)*d*0.3);
    rebar.rotation.x = (Math.random()-0.5) * 0.5;
    rebar.rotation.z = (Math.random()-0.5) * 0.5;
    scene.add(rebar);
  }
}

// Seeded random
const rng = (seed) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };
const rand = rng(42);

// Rubble piles and cover along all corridor segments
function addRubbleAlongSeg(axis, fixedCoord, start, end, step) {
  const inc = start < end ? step : -step;
  for (let t = start; (inc > 0 ? t < end : t > end); t += inc) {
    const count = 1 + Math.floor(rand() * 2);
    for (let i = 0; i < count; i++) {
      const offset = (rand() - 0.5) * 24;
      const w = 2 + rand() * 3;
      const h = 1 + rand() * 2;
      const d = 2 + rand() * 2;
      if (axis === 'z') {
        addPlatform(fixedCoord + offset, h / 2, t + rand() * 6, w, h, d);
      } else {
        addPlatform(t + rand() * 6, h / 2, fixedCoord + offset, w, h, d);
      }
    }
  }
}
addRubbleAlongSeg('z', 0, -20, -140, 12);
addRubbleAlongSeg('x', -150, -10, -140, 12);
addRubbleAlongSeg('z', -150, -160, -290, 12);
addRubbleAlongSeg('x', -300, -140, -10, 12);

