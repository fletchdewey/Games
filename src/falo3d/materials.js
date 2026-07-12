// --- MATERIALS ---
const asphaltMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
const concreteMat = new THREE.MeshLambertMaterial({ color: 0x6a6a6a });
const concreteDkMat = new THREE.MeshLambertMaterial({ color: 0x4a4a4a });
const concreteLtMat = new THREE.MeshLambertMaterial({ color: 0x8a8a8a });
const rebarMat = new THREE.MeshLambertMaterial({ color: 0x8a4a2a });
const rubbleMat = new THREE.MeshLambertMaterial({ color: 0x5a5a5a });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x3a5a6a, transparent: true, opacity: 0.4 });
const fireMat = new THREE.MeshBasicMaterial({ color: 0xff6622 });
const fireGlowMat = new THREE.MeshBasicMaterial({ color: 0xffaa33 });
const emberMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
const smokeMat = new THREE.MeshBasicMaterial({ color: 0x2a2020, transparent: true, opacity: 0.3 });
const roadLineMat = new THREE.MeshBasicMaterial({ color: 0x5a5a2a });
const rockMat = new THREE.MeshLambertMaterial({ color: 0x5a5a5a });
const rockDarkMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
const alienMat = new THREE.MeshLambertMaterial({ color: 0x3a3a4a });
const alienLightMat = new THREE.MeshLambertMaterial({ color: 0x5a4a6a });
const alienSkinMat = new THREE.MeshLambertMaterial({ color: 0x4a3a5a });
const alienBoneMat = new THREE.MeshLambertMaterial({ color: 0x6a6a5a });
const alienTeethMat = new THREE.MeshLambertMaterial({ color: 0xccccaa });
const alienEyeMat = new THREE.MeshLambertMaterial({ color: 0xff2200, emissive: 0xff2200, emissiveIntensity: 0.8 });
const alienGlowMat = new THREE.MeshLambertMaterial({ color: 0x44ff66, emissive: 0x22ff44, emissiveIntensity: 0.3 });
// Boss alien materials
const bossArmorMat = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
const bossArmorLtMat = new THREE.MeshLambertMaterial({ color: 0x3a3a4a });
const bossSkinMat = new THREE.MeshLambertMaterial({ color: 0x3a2a4a });
const bossCrownMat = new THREE.MeshLambertMaterial({ color: 0xaa6622, emissive: 0x884411, emissiveIntensity: 0.3 });
const bossEyeMat = new THREE.MeshLambertMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.0 });
const bossGlowMat = new THREE.MeshLambertMaterial({ color: 0xff2244, emissive: 0xff0022, emissiveIntensity: 0.6 });
// Marine materials
const marineFatiguesMat = new THREE.MeshLambertMaterial({ color: 0x4a5a3a }); // olive drab
const marineFatiguesDkMat = new THREE.MeshLambertMaterial({ color: 0x3a4a2a });
const marineSkinMat = new THREE.MeshLambertMaterial({ color: 0xc4956a });
const marineSkinDkMat = new THREE.MeshLambertMaterial({ color: 0xa87d55 });
const marineBootMat = new THREE.MeshLambertMaterial({ color: 0x2a2a22 });
const marineHelmetMat = new THREE.MeshLambertMaterial({ color: 0x5a6a4a });
const marineHelmetBandMat = new THREE.MeshLambertMaterial({ color: 0x6a5a3a });
const marineVestMat = new THREE.MeshLambertMaterial({ color: 0x5a5a4a });
const marineGunMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
const marineMuzzleMat = new THREE.MeshBasicMaterial({ color: 0xffaa33 });
const marineBulletMat = new THREE.MeshBasicMaterial({ color: 0x88ff44 });
const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffdd33 });
const alienBulletMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
const ammoMat = new THREE.MeshLambertMaterial({ color: 0xffdd33, emissive: 0xffaa00, emissiveIntensity: 0.4 });
const shipMat = new THREE.MeshLambertMaterial({ color: 0xaabbcc });
const shipBlueMat = new THREE.MeshLambertMaterial({ color: 0x4488cc, emissive: 0x2244aa, emissiveIntensity: 0.3 });

