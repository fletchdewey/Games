// ============================================================
//  FALO 3D - First Person Shooter by Fletcher Dewey
//  fletcherdewey.com
// ============================================================

// --- SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1008);
scene.fog = new THREE.FogExp2(0x1a1008, 0.005);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});


const ambientLight = new THREE.AmbientLight(0x331808, 0.8);
scene.add(ambientLight);

// Dim reddish sun through smoke
const sunLight = new THREE.DirectionalLight(0xff6622, 0.6);
sunLight.position.set(50, 80, 30);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 1024;
sunLight.shadow.mapSize.height = 1024;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 500;
sunLight.shadow.camera.left = -200;
sunLight.shadow.camera.right = 200;
sunLight.shadow.camera.top = 200;
sunLight.shadow.camera.bottom = -200;
scene.add(sunLight);

// --- GAME STATE ---
let gameState = 'title';

// --- DIFFICULTY ---
const DIFF_PRESETS = {
  easy:      { playerHealth: 150, playerAmmo: 50, damagePerHit: 5,  alienHealth: 2, alienFireMult: 1.5, alienSpeedMult: 0.7, alienCountMult: 0.7, bossHealth: 25, bossShootRate: 25, marineHealth: 80, marineSpread: 0.15, bleedOutTimer: 450 },
  normal:    { playerHealth: 100, playerAmmo: 30, damagePerHit: 8,  alienHealth: 3, alienFireMult: 1.0, alienSpeedMult: 1.0, alienCountMult: 1.0, bossHealth: 40, bossShootRate: 18, marineHealth: 60, marineSpread: 0.25, bleedOutTimer: 300 },
  hard:      { playerHealth: 75,  playerAmmo: 20, damagePerHit: 12, alienHealth: 5, alienFireMult: 0.7, alienSpeedMult: 1.3, alienCountMult: 1.3, bossHealth: 60, bossShootRate: 12, marineHealth: 40, marineSpread: 0.35, bleedOutTimer: 200 },
  nightmare: { playerHealth: 50,  playerAmmo: 15, damagePerHit: 16, alienHealth: 7, alienFireMult: 0.5, alienSpeedMult: 1.6, alienCountMult: 1.8, bossHealth: 80, bossShootRate: 8,  marineHealth: 25, marineSpread: 0.50, bleedOutTimer: 120 },
};
let diff = { ...DIFF_PRESETS.normal };
let currentDiffKey = 'normal';
const DIFF_ORDER = ['easy', 'normal', 'hard', 'nightmare'];
let unlockedLevel = parseInt(localStorage.getItem('falo3d-unlocked') || '0');

// --- CHARACTER CLASSES ---
const CHAR_PRESETS = {
  assault:  { name: 'ASSAULT',     speedMult: 1.0, damageMult: 1.0, fireRate: 8,  color: '#ccaa22' },
  recon:    { name: 'RECON',       speedMult: 1.4, damageMult: 0.7, fireRate: 5,  color: '#44ccff' },
  demo:     { name: 'DEMOLITIONS', speedMult: 0.75, damageMult: 2.2, fireRate: 16, color: '#ff6622' },
  marksman: { name: 'MARKSMAN',    speedMult: 1.0, damageMult: 3.0, fireRate: 22, color: '#aa44ff' },
};
let charClass = { ...CHAR_PRESETS.assault };
