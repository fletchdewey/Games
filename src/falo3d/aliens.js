let aliens = [];
function spawnAliens() {
  aliens = [];
  const positions = [];
  const countScale = (base) => Math.max(1, Math.ceil(base * diff.alienCountMult));
  // Seg 1: along z, centered at x=0
  for (let z = -15; z > -140; z -= 15) {
    const count = countScale(1 + Math.floor(rand() * 2));
    for (let i = 0; i < count; i++) {
      positions.push({ x: (rand() - 0.5) * 24, z: z + rand() * 8 });
    }
  }
  // Seg 2: along x, centered at z=-150
  for (let x = -10; x > -140; x -= 15) {
    const count = countScale(1 + Math.floor(rand() * 2));
    for (let i = 0; i < count; i++) {
      positions.push({ x: x + rand() * 8, z: -150 + (rand() - 0.5) * 20 });
    }
  }
  // Seg 3: along z, centered at x=-150
  for (let z = -160; z > -290; z -= 15) {
    const count = countScale(1 + Math.floor(rand() * 2));
    for (let i = 0; i < count; i++) {
      positions.push({ x: -150 + (rand() - 0.5) * 24, z: z + rand() * 8 });
    }
  }
  // Seg 4: along x, centered at z=-300
  for (let x = -140; x < -10; x += 15) {
    const count = countScale(1 + Math.floor(rand() * 2));
    for (let i = 0; i < count; i++) {
      positions.push({ x: x + rand() * 8, z: -300 + (rand() - 0.5) * 20 });
    }
  }

  for (const pos of positions) {
    const group = new THREE.Group();

    // --- Torso (hunched, organic shape) ---
    const torsoGeo = new THREE.SphereGeometry(0.55, 6, 5);
    torsoGeo.scale(1, 1.3, 0.85);
    const torso = new THREE.Mesh(torsoGeo, alienSkinMat);
    torso.position.y = 0.9;
    torso.rotation.x = 0.3; // hunched forward
    torso.castShadow = true;
    group.add(torso);

    // Spine ridges
    for (let s = 0; s < 4; s++) {
      const ridgeGeo = new THREE.ConeGeometry(0.08, 0.25, 4);
      const ridge = new THREE.Mesh(ridgeGeo, alienBoneMat);
      ridge.position.set(0, 0.7 + s * 0.25, -0.35);
      ridge.rotation.x = -0.5;
      group.add(ridge);
    }

    // --- Head (elongated skull) ---
    const skullGeo = new THREE.SphereGeometry(0.35, 6, 5);
    skullGeo.scale(0.8, 0.9, 1.5); // long front-to-back
    const skull = new THREE.Mesh(skullGeo, alienLightMat);
    skull.position.set(0, 1.7, 0.2);
    skull.rotation.x = 0.15;
    skull.castShadow = true;
    group.add(skull);

    // Brow ridge
    const browGeo = new THREE.BoxGeometry(0.6, 0.1, 0.25);
    const brow = new THREE.Mesh(browGeo, alienBoneMat);
    brow.position.set(0, 1.78, 0.45);
    group.add(brow);

    // Eyes (glowing, inset)
    for (const ex of [-0.18, 0.18]) {
      const eyeSocketGeo = new THREE.SphereGeometry(0.1, 5, 5);
      const eyeSocket = new THREE.Mesh(eyeSocketGeo, alienMat);
      eyeSocket.position.set(ex, 1.72, 0.5);
      group.add(eyeSocket);

      const eyeGeo = new THREE.SphereGeometry(0.065, 5, 5);
      const eye = new THREE.Mesh(eyeGeo, alienEyeMat);
      eye.position.set(ex, 1.72, 0.55);
      group.add(eye);
    }

    // Third eye (center, smaller)
    const thirdEyeGeo = new THREE.SphereGeometry(0.04, 4, 4);
    const thirdEye = new THREE.Mesh(thirdEyeGeo, alienEyeMat);
    thirdEye.position.set(0, 1.85, 0.48);
    group.add(thirdEye);

    // Mandibles / jaw
    for (const mx of [-0.15, 0.15]) {
      const mandGeo = new THREE.ConeGeometry(0.04, 0.3, 4);
      const mand = new THREE.Mesh(mandGeo, alienBoneMat);
      mand.position.set(mx, 1.5, 0.5);
      mand.rotation.x = 0.4;
      mand.rotation.z = mx > 0 ? -0.3 : 0.3;
      group.add(mand);
    }

    // Teeth row
    for (let t = -0.1; t <= 0.1; t += 0.066) {
      const toothGeo = new THREE.ConeGeometry(0.02, 0.08, 3);
      const tooth = new THREE.Mesh(toothGeo, alienTeethMat);
      tooth.position.set(t, 1.52, 0.52);
      tooth.rotation.x = Math.PI;
      group.add(tooth);
    }

    // --- Arms (long, thin, clawed) ---
    for (const side of [-1, 1]) {
      // Upper arm
      const upperGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.7, 5);
      const upper = new THREE.Mesh(upperGeo, alienSkinMat);
      upper.position.set(side * 0.6, 1.0, 0.1);
      upper.rotation.z = side * 0.4;
      upper.rotation.x = -0.3;
      upper.castShadow = true;
      group.add(upper);

      // Forearm
      const foreGeo = new THREE.CylinderGeometry(0.06, 0.04, 0.65, 5);
      const fore = new THREE.Mesh(foreGeo, alienSkinMat);
      fore.position.set(side * 0.85, 0.55, 0.25);
      fore.rotation.z = side * 0.2;
      fore.rotation.x = -0.5;
      group.add(fore);

      // Claws (3 fingers)
      for (let c = -1; c <= 1; c++) {
        const clawGeo = new THREE.ConeGeometry(0.02, 0.2, 3);
        const claw = new THREE.Mesh(clawGeo, alienTeethMat);
        claw.position.set(side * 0.9 + c * 0.04, 0.2, 0.35);
        claw.rotation.x = -0.8;
        group.add(claw);
      }
    }

    // --- Legs (digitigrade / reverse-knee) ---
    for (const lx of [-0.25, 0.25]) {
      // Thigh
      const thighGeo = new THREE.CylinderGeometry(0.12, 0.09, 0.5, 5);
      const thigh = new THREE.Mesh(thighGeo, alienSkinMat);
      thigh.position.set(lx, 0.2, -0.05);
      thigh.rotation.x = 0.3;
      thigh.castShadow = true;
      group.add(thigh);

      // Shin (angled forward — digitigrade)
      const shinGeo = new THREE.CylinderGeometry(0.07, 0.05, 0.55, 5);
      const shin = new THREE.Mesh(shinGeo, alienSkinMat);
      shin.position.set(lx, -0.25, 0.12);
      shin.rotation.x = -0.4;
      group.add(shin);

      // Foot / talons
      const footGeo = new THREE.ConeGeometry(0.06, 0.2, 4);
      const foot = new THREE.Mesh(footGeo, alienBoneMat);
      foot.position.set(lx, -0.55, 0.2);
      foot.rotation.x = -1.2;
      group.add(foot);
    }

    // --- Glowing patches (bioluminescent) ---
    const patchPositions = [
      { x: 0, y: 1.1, z: 0.5 },
      { x: -0.3, y: 0.8, z: 0.3 },
      { x: 0.3, y: 0.8, z: 0.3 },
    ];
    for (const pp of patchPositions) {
      const patchGeo = new THREE.SphereGeometry(0.06, 4, 4);
      const patch = new THREE.Mesh(patchGeo, alienGlowMat);
      patch.position.set(pp.x, pp.y, pp.z);
      group.add(patch);
    }

    // --- Tail ---
    let tailX = 0, tailY = 0.5, tailZ = -0.4;
    for (let seg = 0; seg < 5; seg++) {
      const r = 0.08 - seg * 0.012;
      const segGeo = new THREE.SphereGeometry(Math.max(0.02, r), 4, 4);
      const segMesh = new THREE.Mesh(segGeo, alienSkinMat);
      tailZ -= 0.18;
      tailY -= 0.06;
      segMesh.position.set(tailX, tailY, tailZ);
      group.add(segMesh);
    }
    // Tail spike
    const spikeGeo = new THREE.ConeGeometry(0.03, 0.15, 3);
    const spike = new THREE.Mesh(spikeGeo, alienBoneMat);
    spike.position.set(0, tailY - 0.05, tailZ - 0.12);
    spike.rotation.x = 1.3;
    group.add(spike);

    // --- King's Guard: seg 4 aliens get battle-worn armor ---
    const isElite = pos.z < -280;
    if (isElite) {
      group.scale.setScalar(1.15);

      // --- Materials for damage details ---
      const dentMat = new THREE.MeshLambertMaterial({ color: 0x1a1a28 });
      const scratchMat = new THREE.MeshLambertMaterial({ color: 0x4a4a58 });
      const rivetMat = new THREE.MeshLambertMaterial({ color: 0x5a5a6a });
      const scarMat = new THREE.MeshBasicMaterial({ color: 0x1a0a0a });

      // --- Curved breastplate (sphere section, not a box) ---
      const breastGeo = new THREE.SphereGeometry(0.55, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.45);
      breastGeo.scale(0.7, 0.9, 0.4);
      const breast = new THREE.Mesh(breastGeo, bossArmorMat);
      breast.position.set(0, 0.85, 0.38);
      breast.rotation.x = -0.2;
      group.add(breast);

      // Breastplate lower rim (gives it a lip/edge)
      const rimGeo = new THREE.TorusGeometry(0.32, 0.025, 4, 8, Math.PI);
      const rim = new THREE.Mesh(rimGeo, bossArmorLtMat);
      rim.position.set(0, 0.68, 0.4);
      rim.rotation.x = 0.1;
      group.add(rim);

      // Rivets along breastplate edges
      for (const rv of [
        { x: -0.28, y: 1.05 }, { x: 0.28, y: 1.05 },
        { x: -0.25, y: 0.85 }, { x: 0.25, y: 0.85 },
        { x: -0.2, y: 0.7 }, { x: 0.2, y: 0.7 },
      ]) {
        const rvGeo = new THREE.SphereGeometry(0.02, 4, 4);
        const rivet = new THREE.Mesh(rvGeo, rivetMat);
        rivet.position.set(rv.x, rv.y, 0.48);
        group.add(rivet);
      }

      // Bullet dents on breastplate (dark craters)
      for (const dt of [
        { x: 0.1, y: 0.95, s: 0.04 },
        { x: -0.15, y: 0.82, s: 0.035 },
        { x: 0.05, y: 0.75, s: 0.03 },
        { x: -0.08, y: 1.0, s: 0.025 },
      ]) {
        const dentGeo = new THREE.SphereGeometry(dt.s, 4, 4, 0, Math.PI * 2, 0, Math.PI * 0.5);
        const dent = new THREE.Mesh(dentGeo, dentMat);
        dent.position.set(dt.x, dt.y, 0.47);
        dent.rotation.x = -Math.PI * 0.5;
        group.add(dent);
      }

      // Scratches across breastplate
      for (const sc of [
        { x: -0.05, y: 0.9, r: 0.4, w: 0.22 },
        { x: 0.12, y: 0.78, r: -0.3, w: 0.18 },
      ]) {
        const scrGeo = new THREE.BoxGeometry(sc.w, 0.012, 0.01);
        const scratch = new THREE.Mesh(scrGeo, scratchMat);
        scratch.position.set(sc.x, sc.y, 0.5);
        scratch.rotation.z = sc.r;
        group.add(scratch);
      }

      // --- Shoulder pads with battle damage ---
      for (const sx of [-0.55, 0.55]) {
        const side = sx > 0 ? 1 : -1;

        // Main pad (flattened sphere)
        const padGeo = new THREE.SphereGeometry(0.17, 6, 5);
        padGeo.scale(1.3, 0.7, 1);
        const pad = new THREE.Mesh(padGeo, bossArmorLtMat);
        pad.position.set(sx, 1.3, 0.1);
        group.add(pad);

        // Shoulder spike
        const spkGeo = new THREE.ConeGeometry(0.03, 0.2, 4);
        const spk = new THREE.Mesh(spkGeo, alienBoneMat);
        spk.position.set(sx * 1.1, 1.45, 0.1);
        spk.rotation.z = side * 0.4;
        group.add(spk);

        // Edge chips (dark wedges where armor got chipped away)
        const chipGeo = new THREE.BoxGeometry(0.06, 0.04, 0.08);
        const chip = new THREE.Mesh(chipGeo, dentMat);
        chip.position.set(sx + side * 0.15, 1.28, 0.15);
        chip.rotation.z = side * 0.6;
        group.add(chip);

        // Scratch across pad
        const pScrGeo = new THREE.BoxGeometry(0.14, 0.01, 0.01);
        const pScr = new THREE.Mesh(pScrGeo, scratchMat);
        pScr.position.set(sx, 1.32, 0.2);
        pScr.rotation.z = side * 0.5;
        group.add(pScr);

        // Dent on pad
        const pDentGeo = new THREE.SphereGeometry(0.025, 4, 4, 0, Math.PI * 2, 0, Math.PI * 0.5);
        const pDent = new THREE.Mesh(pDentGeo, dentMat);
        pDent.position.set(sx - side * 0.05, 1.33, 0.18);
        pDent.rotation.x = -Math.PI * 0.5;
        group.add(pDent);
      }

      // --- Armored brow ridge (with crack) ---
      const browArmorGeo = new THREE.BoxGeometry(0.5, 0.08, 0.2);
      const browArmor = new THREE.Mesh(browArmorGeo, bossArmorMat);
      browArmor.position.set(0, 1.82, 0.48);
      group.add(browArmor);

      // Crack across brow armor
      const crackGeo = new THREE.BoxGeometry(0.2, 0.015, 0.06);
      const crack = new THREE.Mesh(crackGeo, dentMat);
      crack.position.set(0.08, 1.83, 0.52);
      crack.rotation.z = 0.25;
      group.add(crack);

      // --- Battle scars on skin ---
      for (let sc = 0; sc < 3; sc++) {
        const scarGeo = new THREE.BoxGeometry(0.3 + Math.random() * 0.2, 0.025, 0.04);
        const scar = new THREE.Mesh(scarGeo, scarMat);
        scar.position.set(
          (Math.random() - 0.5) * 0.5,
          0.7 + Math.random() * 0.6,
          0.42
        );
        scar.rotation.z = (Math.random() - 0.5) * 0.8;
        group.add(scar);
      }

      // Head scar (across the skull)
      const headScarGeo = new THREE.BoxGeometry(0.35, 0.02, 0.04);
      const headScar = new THREE.Mesh(headScarGeo, scarMat);
      headScar.position.set(0, 1.75, 0.52);
      headScar.rotation.z = 0.3;
      group.add(headScar);

      // --- Thigh armor with dents ---
      for (const lx of [-0.25, 0.25]) {
        const tArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.15, 0.12), bossArmorLtMat);
        tArm.position.set(lx, 0.3, 0.08);
        group.add(tArm);

        // Dent on thigh plate
        const tDentGeo = new THREE.SphereGeometry(0.02, 4, 4, 0, Math.PI * 2, 0, Math.PI * 0.5);
        const tDent = new THREE.Mesh(tDentGeo, dentMat);
        tDent.position.set(lx + 0.03, 0.32, 0.15);
        tDent.rotation.x = -Math.PI * 0.5;
        group.add(tDent);
      }

      // --- Forearm guard plates ---
      for (const sx of [-0.85, 0.85]) {
        const guardGeo = new THREE.BoxGeometry(0.08, 0.2, 0.06);
        const guard = new THREE.Mesh(guardGeo, bossArmorLtMat);
        guard.position.set(sx, 0.55, 0.3);
        group.add(guard);
      }

      // Red glow patches (battle-heated, like the boss)
      for (const gp of [{ x: 0, y: 1.05, z: 0.5 }, { x: -0.3, y: 0.85, z: 0.35 }, { x: 0.3, y: 0.85, z: 0.35 }]) {
        const patchGeo = new THREE.SphereGeometry(0.05, 4, 4);
        const patch = new THREE.Mesh(patchGeo, bossGlowMat);
        patch.position.set(gp.x, gp.y, gp.z);
        group.add(patch);
      }
    }

    group.position.set(pos.x, 1, pos.z);
    scene.add(group);

    aliens.push({
      mesh: group,
      health: isElite ? diff.alienHealth + 2 : diff.alienHealth,
      alive: true,
      startX: pos.x,
      dir: rand() > 0.5 ? 1 : -1,
      speed: (0.02 + rand() * 0.02) * diff.alienSpeedMult,
      range: 4 + rand() * 5,
      shootTimer: Math.floor((60 + Math.floor(rand() * 120)) * diff.alienFireMult),
    });
  }
}
spawnAliens();

// --- KING ALIEN (BOSS) ---
let bossAlien = null;
const BOSS_SCALE = 2.8;

function createBossAlien() {
  const group = new THREE.Group();

  // --- Massive torso ---
  const torsoGeo = new THREE.SphereGeometry(0.7, 7, 6);
  torsoGeo.scale(1.2, 1.5, 1);
  const torso = new THREE.Mesh(torsoGeo, bossSkinMat);
  torso.position.y = 1;
  torso.rotation.x = 0.25;
  torso.castShadow = true;
  group.add(torso);

  // Armored chest plates
  const chestGeo = new THREE.BoxGeometry(1.2, 0.8, 0.4);
  const chest = new THREE.Mesh(chestGeo, bossArmorMat);
  chest.position.set(0, 1.1, 0.4);
  group.add(chest);
  const ribGeo = new THREE.BoxGeometry(1.3, 0.15, 0.3);
  for (let ry = 0.7; ry < 1.4; ry += 0.25) {
    const rib = new THREE.Mesh(ribGeo, bossArmorLtMat);
    rib.position.set(0, ry, 0.45);
    group.add(rib);
  }

  // Spine ridges
  for (let s = 0; s < 6; s++) {
    const ridgeGeo = new THREE.ConeGeometry(0.12, 0.5, 4);
    const ridge = new THREE.Mesh(ridgeGeo, alienBoneMat);
    ridge.position.set(0, 0.5 + s * 0.3, -0.5);
    ridge.rotation.x = -0.5;
    group.add(ridge);
  }

  // --- Massive skull ---
  const skullGeo = new THREE.SphereGeometry(0.5, 7, 6);
  skullGeo.scale(0.9, 1, 1.6);
  const skull = new THREE.Mesh(skullGeo, alienLightMat);
  skull.position.set(0, 2.1, 0.2);
  skull.castShadow = true;
  group.add(skull);

  // Armored brow plate
  const browGeo = new THREE.BoxGeometry(1, 0.15, 0.4);
  const brow = new THREE.Mesh(browGeo, bossArmorMat);
  brow.position.set(0, 2.25, 0.5);
  group.add(brow);

  // --- CROWN HORNS ---
  for (const hp of [{ x:-0.35, a:-0.4, big:true },{ x:0.35, a:0.4, big:true },{ x:-0.2, a:-0.2 },{ x:0.2, a:0.2 }]) {
    const l = hp.big ? 1.2 : 0.7;
    const hGeo = new THREE.ConeGeometry(hp.big ? 0.08 : 0.05, l, 5);
    const horn = new THREE.Mesh(hGeo, bossCrownMat);
    horn.position.set(hp.x, 2.5 + (hp.big ? 0.3 : 0.1), 0.1);
    horn.rotation.set(-0.3, 0, hp.a);
    horn.castShadow = true;
    group.add(horn);
  }
  const crownGeo = new THREE.ConeGeometry(0.06, 0.9, 5);
  const crown = new THREE.Mesh(crownGeo, bossCrownMat);
  crown.position.set(0, 2.9, 0.05);
  crown.rotation.x = -0.15;
  group.add(crown);

  // --- Four glowing eyes ---
  for (const ep of [{x:-0.25,y:2.15},{x:0.25,y:2.15},{x:-0.12,y:2.3},{x:0.12,y:2.3}]) {
    const sockGeo = new THREE.SphereGeometry(0.1, 5, 5);
    const sock = new THREE.Mesh(sockGeo, bossArmorMat);
    sock.position.set(ep.x, ep.y, 0.55);
    group.add(sock);
    const eyeGeo = new THREE.SphereGeometry(0.07, 5, 5);
    const eye = new THREE.Mesh(eyeGeo, bossEyeMat);
    eye.position.set(ep.x, ep.y, 0.62);
    group.add(eye);
  }
  const eyeLight = new THREE.PointLight(0xff0000, 2, 8);
  eyeLight.position.set(0, 2.2, 0.8);
  group.add(eyeLight);

  // Mandibles + teeth
  for (const mx of [-0.25, 0.25]) {
    const mandGeo = new THREE.ConeGeometry(0.06, 0.6, 4);
    const mand = new THREE.Mesh(mandGeo, alienBoneMat);
    mand.position.set(mx, 1.8, 0.6);
    mand.rotation.x = 0.5;
    mand.rotation.z = mx > 0 ? -0.35 : 0.35;
    group.add(mand);
  }
  for (let t = -0.18; t <= 0.18; t += 0.06) {
    const tGeo = new THREE.ConeGeometry(0.03, 0.14, 3);
    const tooth = new THREE.Mesh(tGeo, alienTeethMat);
    tooth.position.set(t, 1.82, 0.6);
    tooth.rotation.x = Math.PI;
    group.add(tooth);
  }

  // --- Arms with shoulder armor ---
  for (const side of [-1, 1]) {
    const padGeo = new THREE.SphereGeometry(0.25, 5, 5);
    padGeo.scale(1.2, 0.8, 1);
    const pad = new THREE.Mesh(padGeo, bossArmorMat);
    pad.position.set(side * 0.8, 1.5, 0.1);
    group.add(pad);
    const sPikeGeo = new THREE.ConeGeometry(0.04, 0.35, 4);
    const sPike = new THREE.Mesh(sPikeGeo, bossCrownMat);
    sPike.position.set(side * 0.95, 1.7, 0.1);
    sPike.rotation.z = side * 0.5;
    group.add(sPike);
    const upperGeo = new THREE.CylinderGeometry(0.12, 0.09, 0.8, 6);
    const upper = new THREE.Mesh(upperGeo, bossSkinMat);
    upper.position.set(side * 0.8, 1.1, 0.1);
    upper.rotation.z = side * 0.35;
    upper.castShadow = true;
    group.add(upper);
    const foreGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.7, 5);
    const fore = new THREE.Mesh(foreGeo, bossSkinMat);
    fore.position.set(side * 1, 0.55, 0.25);
    group.add(fore);
    for (let c = -1.5; c <= 1.5; c++) {
      const clawGeo = new THREE.ConeGeometry(0.025, 0.35, 3);
      const claw = new THREE.Mesh(clawGeo, alienTeethMat);
      claw.position.set(side * 1.05 + c * 0.04, 0.15, 0.35);
      claw.rotation.x = -0.7;
      group.add(claw);
    }
  }

  // --- Legs ---
  for (const lx of [-0.35, 0.35]) {
    const tArmGeo = new THREE.BoxGeometry(0.3, 0.3, 0.2);
    const tArm = new THREE.Mesh(tArmGeo, bossArmorLtMat);
    tArm.position.set(lx, 0.35, 0.1);
    group.add(tArm);
    const thighGeo = new THREE.CylinderGeometry(0.15, 0.11, 0.6, 6);
    const thigh = new THREE.Mesh(thighGeo, bossSkinMat);
    thigh.position.set(lx, 0.2, -0.05);
    thigh.rotation.x = 0.3;
    group.add(thigh);
    const shinGeo = new THREE.CylinderGeometry(0.09, 0.07, 0.6, 5);
    const shin = new THREE.Mesh(shinGeo, bossSkinMat);
    shin.position.set(lx, -0.3, 0.12);
    shin.rotation.x = -0.4;
    group.add(shin);
    const footGeo = new THREE.ConeGeometry(0.1, 0.3, 4);
    const foot = new THREE.Mesh(footGeo, bossArmorMat);
    foot.position.set(lx, -0.6, 0.2);
    foot.rotation.x = -1.2;
    group.add(foot);
  }

  // --- Red glow patches ---
  for (const pp of [{x:0,y:1.3,z:0.55},{x:-0.4,y:0.9,z:0.35},{x:0.4,y:0.9,z:0.35},{x:0,y:0.6,z:0.3},{x:-0.6,y:1.2,z:0.15},{x:0.6,y:1.2,z:0.15}]) {
    const pGeo = new THREE.SphereGeometry(0.08, 4, 4);
    const p = new THREE.Mesh(pGeo, bossGlowMat);
    p.position.set(pp.x, pp.y, pp.z);
    group.add(p);
  }

  // --- Armored tail ---
  let tailY = 0.5, tailZ = -0.5;
  for (let seg = 0; seg < 8; seg++) {
    const r = 0.12 - seg * 0.012;
    const sgGeo = new THREE.SphereGeometry(Math.max(0.03, r), 5, 5);
    const sgMesh = new THREE.Mesh(sgGeo, bossSkinMat);
    tailZ -= 0.22; tailY -= 0.04;
    sgMesh.position.set(0, tailY, tailZ);
    group.add(sgMesh);
    if (seg % 2 === 0) {
      const aGeo = new THREE.BoxGeometry(r*2.5, r*1.5, r*2);
      const a = new THREE.Mesh(aGeo, bossArmorLtMat);
      a.position.set(0, tailY + r*0.5, tailZ);
      group.add(a);
    }
  }
  for (const sx of [-0.06, 0.06]) {
    const spGeo = new THREE.ConeGeometry(0.04, 0.3, 3);
    const sp = new THREE.Mesh(spGeo, bossCrownMat);
    sp.position.set(sx, tailY - 0.05, tailZ - 0.2);
    sp.rotation.x = 1.3;
    sp.rotation.z = sx > 0 ? 0.2 : -0.2;
    group.add(sp);
  }

  // Aura light
  const auraLight = new THREE.PointLight(0xff2244, 3, 20);
  auraLight.position.set(0, 1.5, 0);
  auraLight.name = 'bossAura';
  group.add(auraLight);

  group.scale.setScalar(BOSS_SCALE);
  return group;
}

function spawnBossAlien() {
  if (bossAlien) scene.remove(bossAlien.mesh);
  const mesh = createBossAlien();
  const bossZ = -300; // end of seg 4, guarding the helicopter
  mesh.position.set(-20, BOSS_SCALE, bossZ);
  scene.add(mesh);
  bossAlien = {
    mesh, health: diff.bossHealth, maxHealth: diff.bossHealth, alive: true,
    startX: -20, dir: 1, speed: 0.06, range: 12,
    shootTimer: 20, shootRate: diff.bossShootRate, isBoss: true,
  };
  aliens.push(bossAlien);
}
spawnBossAlien();
