// --- EXTRACTION PHASE ---
let bossDeathChain = 0;
let bossDeathPos = null;
let extractionTimer = 0;
let extractionActive = false;
const EXTRACTION_DURATION = 1200; // 20 seconds at 60fps
let heloGunnerTimer = 0;
let heloMuzzleFlashTimer = 0;

function showDiffScreen() {
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('win-screen').classList.add('hidden');
  document.getElementById('death-screen').classList.add('hidden');
  document.getElementById('diff-screen').classList.remove('hidden');
  document.querySelectorAll('.diff-card').forEach(card => {
    const idx = DIFF_ORDER.indexOf(card.dataset.diff);
    card.classList.toggle('diff-locked', idx > unlockedLevel);
  });
}

function startGame() {
  initAudio();
  playStartupChime();
  document.getElementById('diff-screen').classList.add('hidden');
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('win-screen').classList.add('hidden');
  document.getElementById('death-screen').classList.add('hidden');
  document.getElementById('pause-screen').classList.add('hidden');
  document.getElementById('controls-menu').classList.add('hidden');
  document.getElementById('settings-menu').classList.add('hidden');
  document.getElementById('char-menu').classList.add('hidden');
  renderer.domElement.requestPointerLock();

  playerPos.set(0, 1.6, 5);
  player.health = diff.playerHealth;
  player.ammo = diff.playerAmmo;
  player.vy = 0;
  player.onGround = true;
  player.yaw = 0;
  player.pitch = 0;
  player.invincible = 0;
  player.crouching = false;
  player.crouchLerp = 0;
  secretRoomFound = false;
  secretRoomMessageTimer = 0;
  bigHeadMode = false;
  godModeMessageTimer = 0;
  bossDeathChain = 0;
  bossDeathPos = null;
  extractionTimer = 0;
  extractionActive = false;
  heloGunnerTimer = 0;
  heloMuzzleFlashTimer = 0;
  document.getElementById('extraction-hud').style.display = 'none';

  // Clear old
  for (const b of bullets) {
    scene.remove(b.mesh);
    for (const seg of b.trailMeshes) { scene.remove(seg); seg.material.dispose(); }
  }
  bullets = [];
  for (const d of ammoDrops) scene.remove(d.mesh);
  ammoDrops = [];
  for (const d of healthDrops) scene.remove(d.mesh);
  healthDrops = [];
  for (const p of particles) { scene.remove(p.mesh); }
  particles = [];
  for (const g of gibs) { scene.remove(g.mesh); }
  gibs = [];
  for (const a of aliens) scene.remove(a.mesh);

  spawnAliens();
  spawnBossAlien();
  spawnMarines();
  gameState = 'playing';
}

document.getElementById('start-btn').addEventListener('click', showDiffScreen);
document.getElementById('restart-win').addEventListener('click', showDiffScreen);
document.getElementById('restart-death').addEventListener('click', showDiffScreen);

// Difficulty card selection
document.querySelectorAll('.diff-card').forEach(card => {
  card.addEventListener('click', () => {
    const level = card.dataset.diff;
    currentDiffKey = level;
    diff = { ...DIFF_PRESETS[level] };
    startGame();
  });
});

function resumeGame() {
  if (gameState !== 'paused') return;
  document.getElementById('pause-screen').classList.add('hidden');
  renderer.domElement.requestPointerLock();
  gameState = 'playing';
}
document.getElementById('resume-btn').addEventListener('click', resumeGame);

// --- MENU NAVIGATION ---
document.getElementById('btn-controls').addEventListener('click', () => {
  document.getElementById('controls-menu').classList.remove('hidden');
});
document.getElementById('back-controls').addEventListener('click', () => {
  document.getElementById('controls-menu').classList.add('hidden');
});
document.getElementById('btn-settings').addEventListener('click', () => {
  document.getElementById('settings-menu').classList.remove('hidden');
});
document.getElementById('back-settings').addEventListener('click', () => {
  document.getElementById('settings-menu').classList.add('hidden');
});
// Pause menu also opens controls/settings
document.getElementById('pause-controls').addEventListener('click', () => {
  document.getElementById('controls-menu').classList.remove('hidden');
});
document.getElementById('pause-settings').addEventListener('click', () => {
  document.getElementById('settings-menu').classList.remove('hidden');
});

// Character menu
document.getElementById('btn-character').addEventListener('click', () => {
  document.getElementById('char-menu').classList.remove('hidden');
});
document.getElementById('char-back').addEventListener('click', () => {
  document.getElementById('char-menu').classList.add('hidden');
});
// Card selection
document.querySelectorAll('.char-card').forEach(card => {
  card.addEventListener('click', () => {
    const key = card.dataset.char;
    charClass = { ...CHAR_PRESETS[key] };
    document.getElementById('char-current').textContent = 'CLASS: ' + charClass.name;
    // Update selection highlight
    document.querySelectorAll('.char-card').forEach(c => {
      c.classList.remove('char-selected');
      c.style.borderColor = '#1a1a1a';
    });
    card.classList.add('char-selected');
    card.style.borderColor = charClass.color;
  });
});


// --- COLLISION HELPERS ---
const _box = new THREE.Box3();
const _pBox = new THREE.Box3();
const playerSize = new THREE.Vector3(0.6, 1.6, 0.6);

function getPlayerBox() {
  _pBox.setFromCenterAndSize(
    new THREE.Vector3(playerPos.x, playerPos.y - 0.2, playerPos.z),
    playerSize
  );
  return _pBox;
}

function checkPlatformCollision(pos, halfW, halfH, halfD) {
  for (const p of platformData) {
    if (pos.x + halfW > p.x && pos.x - halfW < p.x + p.w &&
        pos.y - halfH < p.y + p.h && pos.y + halfH > p.y &&
        pos.z + halfD > p.z && pos.z - halfD < p.z + p.d) {
      return p;
    }
  }
  return null;
}

// --- MAIN LOOP ---
const clock = new THREE.Clock();
let screenShake = 0;

function update() {
  if (gameState !== 'playing') return;
  pollGamepad();
  const dt = Math.min(clock.getDelta(), 0.05);

  // --- Gamepad camera aim (right stick) ---
  if (gamepad.rightX !== 0 || gamepad.rightY !== 0) {
    const aimSens = settings.stickSens;
    player.yaw -= gamepad.rightX * aimSens;
    player.pitch -= gamepad.rightY * aimSens;
    player.pitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, player.pitch));
  }

  // --- Player movement ---
  const forward = new THREE.Vector3(0, 0, -1);
  forward.applyAxisAngle(new THREE.Vector3(0,1,0), player.yaw);
  const right = new THREE.Vector3(-forward.z, 0, forward.x);

  moveDir.set(0, 0, 0);
  // WASD = camera-relative movement
  if (keys['KeyW']) moveDir.add(forward);
  if (keys['KeyS']) moveDir.sub(forward);
  if (keys['KeyA']) moveDir.sub(right);
  if (keys['KeyD']) moveDir.add(right);
  // Arrow keys = fixed world directions (like the 2D version)
  if (keys['ArrowUp']) moveDir.z -= 1;    // forward into the level
  if (keys['ArrowDown']) moveDir.z += 1;   // back toward start
  if (keys['ArrowLeft']) moveDir.x -= 1;   // left
  if (keys['ArrowRight']) moveDir.x += 1;  // right
  // Left stick = camera-relative (like WASD)
  const stickY = gamepad.invertY ? gamepad.leftY : -gamepad.leftY;
  if (stickY !== 0) moveDir.add(forward.clone().multiplyScalar(stickY));
  if (gamepad.leftX !== 0) moveDir.add(right.clone().multiplyScalar(gamepad.leftX));
  if (moveDir.length() > 0) moveDir.normalize();

  // --- Crouch ---
  player.crouching = keys['KeyC'] || gamepad.crouch;
  const crouchTarget = player.crouching ? 1 : 0;
  player.crouchLerp += (crouchTarget - player.crouchLerp) * 0.15; // smooth transition
  const standHeight = 1.6;
  const crouchHeight = 0.8;
  const playerHeight = standHeight - player.crouchLerp * (standHeight - crouchHeight);
  const crouchSpeedMult = 1 - player.crouchLerp * 0.5; // 50% slower when crouched
  const collisionHalfH = player.crouching ? 0.4 : 0.7;

  const speed = 10 * crouchSpeedMult * charClass.speedMult;
  const newX = playerPos.x + moveDir.x * speed * dt;
  const newZ = playerPos.z + moveDir.z * speed * dt;

  // X movement
  playerPos.x = newX;
  const colX = checkPlatformCollision(playerPos, 0.3, collisionHalfH, 0.3);
  if (colX) playerPos.x -= moveDir.x * speed * dt;

  // Z movement
  playerPos.z = newZ;
  const colZ = checkPlatformCollision(playerPos, 0.3, collisionHalfH, 0.3);
  if (colZ) playerPos.z -= moveDir.z * speed * dt;

  // Clamp to corridor path
  if (!isInCorridor(playerPos.x, playerPos.z)) {
    // Push back into nearest corridor segment
    let bestDist = Infinity, bestX = playerPos.x, bestZ = playerPos.z;
    for (const s of PATH_SEGS) {
      const cx = Math.max(s.x1, Math.min(s.x2, playerPos.x));
      const cz = Math.max(s.z1, Math.min(s.z2, playerPos.z));
      const d = (cx - playerPos.x)**2 + (cz - playerPos.z)**2;
      if (d < bestDist) { bestDist = d; bestX = cx; bestZ = cz; }
    }
    playerPos.x = bestX;
    playerPos.z = bestZ;
  }

  // Gravity
  player.vy -= 20 * dt;
  playerPos.y += player.vy * dt;
  player.onGround = false;

  // Ground
  if (playerPos.y <= playerHeight) {
    playerPos.y = playerHeight;
    player.vy = 0;
    player.onGround = true;
  }

  // Platform landing
  if (player.vy < 0) {
    for (const p of platformData) {
      const top = p.y + p.h;
      if (playerPos.x + 0.3 > p.x && playerPos.x - 0.3 < p.x + p.w &&
          playerPos.z + 0.3 > p.z && playerPos.z - 0.3 < p.z + p.d &&
          playerPos.y - collisionHalfH < top + 0.3 && playerPos.y - collisionHalfH > top - 0.5) {
        playerPos.y = top + playerHeight;
        player.vy = 0;
        player.onGround = true;
        break;
      }
    }
  }

  // Footsteps
  if (player.onGround && moveDir.length() > 0) playFootstep();

  // Jump (can't jump while crouching)
  if ((keys['Space'] || keys['KeyW']) && false) {} // space is shoot only
  if (keys['KeyR'] && player.onGround && !player.crouching) {
    player.vy = 8;
    player.onGround = false;
  }
  // Also jump with Shift
  if (keys['ShiftLeft'] && player.onGround && !player.crouching) {
    player.vy = 8;
    player.onGround = false;
  }
  // Gamepad A button = jump
  if (gamepad.jump && player.onGround && !player.crouching) {
    player.vy = 8;
    player.onGround = false;
  }

  // Camera
  camera.position.copy(playerPos);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;

  // Screen shake (respects settings)
  if (screenShake > 0) {
    const shakeMult = settings.screenShakeLevel === 'off' ? 0 : settings.screenShakeLevel === 'reduced' ? 0.3 : 1;
    camera.position.x += (Math.random() - 0.5) * screenShake * 0.05 * shakeMult;
    camera.position.y += (Math.random() - 0.5) * screenShake * 0.05 * shakeMult;
    screenShake *= 0.85;
    if (screenShake < 0.3) screenShake = 0;
  }

  // --- Shooting ---
  if (player.shootCooldown > 0) player.shootCooldown--;
  if ((mouseDown || keys['Space'] || gamepad.shoot) && player.shootCooldown <= 0 && player.ammo > 0) {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));
    const origin = playerPos.clone().add(dir.clone().multiplyScalar(0.5));
    shootBullet(origin, dir, 'player');
    player.ammo--;
    player.shootCooldown = charClass.fireRate;
    screenShake = Math.max(screenShake, 2);
    playGunshot('player');
  }

  // Invincibility
  if (player.invincible > 0) player.invincible--;

  // --- Aliens ---
  const time = Date.now() * 0.001;
  for (const a of aliens) {
    if (!a.alive) continue;
    // Patrol (only block entering new collision — allow escaping bad spawns)
    const prevX = a.mesh.position.x;
    const wasInsideX = checkPlatformCollision(a.mesh.position, 0.5, 0.5, 0.5);
    a.mesh.position.x += a.dir * a.speed;
    if (Math.abs(a.mesh.position.x - a.startX) > a.range) a.dir *= -1;
    if (!wasInsideX && checkPlatformCollision(a.mesh.position, 0.5, 0.5, 0.5)) {
      a.mesh.position.x = prevX;
      a.dir *= -1;
    }

    if (a.isBoss) {
      // Boss: aggressive bob, pulsing aura
      a.mesh.position.y = BOSS_SCALE + Math.sin(time * 1.5) * 0.2;
      a.mesh.rotation.z = Math.sin(time * 0.8) * 0.06;
      const aura = a.mesh.getObjectByName('bossAura');
      if (aura) aura.intensity = 2 + Math.sin(time * 4) * 1.5;

      // Boss charges toward player when close
      const bDx = playerPos.x - a.mesh.position.x;
      const bDz = playerPos.z - a.mesh.position.z;
      const bDist = Math.sqrt(bDx*bDx + bDz*bDz);
      if (bDist < 30 && bDist > 8) {
        const prevBZ = a.mesh.position.z;
        const wasInsideZ = checkPlatformCollision(a.mesh.position, 0.5, 0.5, 0.5);
        a.mesh.position.z += (bDz / bDist) * 0.04;
        if (!wasInsideZ && checkPlatformCollision(a.mesh.position, 0.5, 0.5, 0.5)) {
          a.mesh.position.z = prevBZ;
        }
      }
    } else {
      // Normal alien idle animation
      const phase = time + a.startX;
      a.mesh.position.y = 1 + Math.sin(phase * 2) * 0.05;
      a.mesh.rotation.z = Math.sin(phase * 1.3) * 0.04;
    }

    // Face player
    const dx = playerPos.x - a.mesh.position.x;
    const dz = playerPos.z - a.mesh.position.z;
    a.mesh.rotation.y = Math.atan2(dx, dz);

    // Shoot
    a.shootTimer--;
    const dist = Math.sqrt(dx*dx + dz*dz);
    const shootRange = a.isBoss ? 60 : 50;
    if (a.shootTimer <= 0 && dist < shootRange) {
      const dir = new THREE.Vector3(dx, playerPos.y - a.mesh.position.y - (a.isBoss ? 1 : 0.5), dz).normalize();
      const origin = a.mesh.position.clone();
      origin.y += a.isBoss ? BOSS_SCALE * 1.5 : 1.5;

      if (a.isBoss) {
        // Boss fires a 3-round burst spread
        for (let burst = -1; burst <= 1; burst++) {
          const spreadDir = dir.clone();
          spreadDir.x += burst * 0.08;
          spreadDir.normalize();
          shootBullet(origin.clone(), spreadDir, 'alien');
        }
        playGunshot('alien');
        a.shootTimer = a.shootRate;
      } else {
        shootBullet(origin, dir, 'alien');
        playGunshot('alien');
        a.shootTimer = Math.floor((80 + Math.floor(Math.random() * 80)) * diff.alienFireMult);
      }
    }
  }

  // Boss health bar
  const bossBarWrap = document.getElementById('boss-bar-wrap');
  const bossFill = document.getElementById('boss-fill');
  if (bossAlien && bossAlien.alive) {
    const bDist = playerPos.distanceTo(bossAlien.mesh.position);
    if (bDist < 50) {
      bossBarWrap.style.display = 'block';
      bossFill.style.width = Math.max(0, (bossAlien.health / bossAlien.maxHealth) * 100) + '%';
    } else {
      bossBarWrap.style.display = 'none';
    }
  } else {
    bossBarWrap.style.display = 'none';
  }

  // --- Marines AI ---
  // Build list of alive aliens + claimed targets for split targeting
  const aliveAliens = aliens.filter(a => a.alive);
  const claimedTargets = new Set();

  for (let mi = 0; mi < marines.length; mi++) {
    const m = marines[mi];
    if (!m.alive) continue;
    const mPos = m.mesh.position;
    const hpRatio = Math.max(0.1, m.health / m.maxHealth);

    // --- CALLOUT TIMER ---
    if (m.calloutTimer > 0) m.calloutTimer--;

    // --- DOWNED STATE (bleed out on the ground) ---
    if (m.state === 'downed') {
      m.downedTimer--;
      // Lie on ground
      m.mesh.rotation.x = Math.PI / 2 * 0.8;
      m.mesh.rotation.z = 0.3;
      mPos.y = Math.max(0, 0.15 + Math.sin(Date.now() * 0.005) * 0.03);
      // Pulse red
      if (m.downedTimer % 30 < 15) {
        spawnParticles(mPos.clone().add(new THREE.Vector3(0, 0.3, 0)), 0x8a1a1a, 1);
      }
      // Bleed out — actually die
      if (m.downedTimer <= 0) {
        m.alive = false;
        spawnGoreExplosion(mPos.clone().add(new THREE.Vector3(0, 0.3, 0)));
        spawnParticles(mPos.clone().add(new THREE.Vector3(0, 0.5, 0)), 0x5a5a4a, 10);
        playExplosion();
        scene.remove(m.mesh);
        screenShake = Math.max(screenShake, 6);
        // Callout
        if (m.calloutTimer <= 0) { m.calloutText = m.name + ' IS GONE'; m.calloutTimer = 120; }
      }
      continue; // skip all other logic when downed
    }

    // --- STATE TRANSITIONS ---
    const toPlayer = new THREE.Vector3(playerPos.x - mPos.x, 0, playerPos.z - mPos.z);
    const playerDist = toPlayer.length();
    const baseSpd = 0.06;
    const moveSpd = baseSpd * hpRatio;

    // Check for downed teammates to revive
    const downedFriend = marines.find(other => other !== m && other.alive && other.state === 'downed' &&
      mPos.distanceTo(other.mesh.position) < 25);

    // Decide state
    if (m.state !== 'reviving') {
      if (downedFriend && m.health > 20) {
        m.state = 'reviving';
        m.reviveTarget = downedFriend;
        m.reviveProgress = 0;
        if (m.calloutTimer <= 0) { m.calloutText = 'REVIVING ' + downedFriend.name; m.calloutTimer = 90; }
      } else if (m.health < 20 && m.state !== 'cover') {
        // Low health — find cover
        m.state = 'cover';
        let bestPlatform = null, bestDist = 999;
        for (const p of platformData) {
          const px = p.x + p.w / 2, pz = p.z + p.d / 2;
          const d = Math.sqrt((mPos.x - px) ** 2 + (mPos.z - pz) ** 2);
          if (d < bestDist && p.h > 0.8) { bestDist = d; bestPlatform = p; }
        }
        m.coverTarget = bestPlatform;
        if (m.calloutTimer <= 0) { m.calloutText = 'TAKING COVER'; m.calloutTimer = 90; }
      } else if (m.health > 30 && aliveAliens.length > 0 && m.state === 'follow' && Math.random() < 0.002) {
        // Occasionally scout ahead
        m.state = 'scout';
        m.scoutZ = playerPos.z - 15 - Math.random() * 10;
        if (m.calloutTimer <= 0) { m.calloutText = 'MOVING UP'; m.calloutTimer = 90; }
      } else if (m.state === 'cover' && m.health > 30) {
        m.state = 'follow';
      } else if (m.state === 'scout' && (mPos.z < m.scoutZ || playerDist > 25)) {
        m.state = 'follow'; // return to squad if too far or reached scout point
      } else if (m.state !== 'scout' && m.state !== 'cover') {
        m.state = 'follow';
      }
    }

    // --- MOVEMENT BY STATE ---
    const prevMX = mPos.x, prevMZ = mPos.z;
    if (m.state === 'follow') {
      // Spread formation — each marine targets a unique offset from the player
      const targetX = playerPos.x + m.spreadOffset.x;
      const targetZ = playerPos.z + m.spreadOffset.z;
      const dx = targetX - mPos.x;
      const dz = targetZ - mPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 2) {
        mPos.x += (dx / dist) * moveSpd;
        mPos.z += (dz / dist) * moveSpd;
      }
      // Don't fall too far behind
      if (playerDist > 20) {
        toPlayer.normalize();
        mPos.x += toPlayer.x * moveSpd * 2;
        mPos.z += toPlayer.z * moveSpd * 2;
      }

    } else if (m.state === 'cover') {
      // Move to nearest rubble
      if (m.coverTarget) {
        const cx = m.coverTarget.x + m.coverTarget.w / 2;
        const cz = m.coverTarget.z + m.coverTarget.d / 2 + 1; // hide behind
        const dx = cx - mPos.x;
        const dz = cz - mPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 1) {
          mPos.x += (dx / dist) * moveSpd * 0.8;
          mPos.z += (dz / dist) * moveSpd * 0.8;
        }
        // Crouch behind cover
        m.mesh.scale.y = 0.7;
      }
      // Come out of cover if health recovers (which it won't, but state transitions handle it)

    } else if (m.state === 'scout') {
      // Sprint ahead of player
      const sprintSpd = moveSpd * 2.5;
      if (mPos.z > m.scoutZ) {
        mPos.z -= sprintSpd;
        // Drift toward center of street
        mPos.x += (0 - mPos.x) * 0.02;
      }
      // Hold position once at scout point
      // (state transitions back to follow when player catches up)

    } else if (m.state === 'reviving') {
      // Move to downed friend
      if (m.reviveTarget && m.reviveTarget.alive && m.reviveTarget.state === 'downed') {
        const friend = m.reviveTarget;
        const dx = friend.mesh.position.x - mPos.x;
        const dz = friend.mesh.position.z - mPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 1.5) {
          mPos.x += (dx / dist) * moveSpd * 1.5;
          mPos.z += (dz / dist) * moveSpd * 1.5;
        } else {
          // In range — reviving
          m.reviveProgress++;
          // Kneel animation
          m.mesh.scale.y = 0.75;
          m.mesh.rotation.x = 0.2;
          // Particles showing healing
          if (m.reviveProgress % 10 === 0) {
            spawnParticles(friend.mesh.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 0x44cc44, 2);
          }
          if (m.reviveProgress >= 120) {
            // Revive complete!
            friend.state = 'follow';
            friend.health = Math.ceil(diff.marineHealth * 0.4); // comes back weak
            friend.downedTimer = 0;
            friend.mesh.rotation.x = 0;
            friend.mesh.rotation.z = 0;
            friend.mesh.scale.y = 1;
            spawnParticles(friend.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 0x44ff44, 10);
            if (m.calloutTimer <= 0) { m.calloutText = friend.name + ' IS UP'; m.calloutTimer = 90; }
            m.state = 'follow';
            m.reviveTarget = null;
            m.reviveProgress = 0;
          }
        }
      } else {
        // Target died or no longer downed
        m.state = 'follow';
        m.reviveTarget = null;
        m.reviveProgress = 0;
      }
    }

    // Collision check — revert if marine walked into a platform
    const marineHalf = 0.3;
    const mCollision = checkPlatformCollision(mPos, marineHalf, 0.8, marineHalf);
    if (mCollision) {
      mPos.x = prevMX;
      mPos.z = prevMZ;
    }

    // Reset scale if not in cover/revive
    if (m.state !== 'cover' && m.state !== 'reviving') {
      m.mesh.scale.y = 1;
    }

    // --- SPLIT TARGET SELECTION ---
    // Each marine picks a different alien (unclaimed first, then nearest)
    let targetAlien = null;
    let targetDist = 999;
    for (const a of aliveAliens) {
      const d = mPos.distanceTo(a.mesh.position);
      if (d < targetDist && !claimedTargets.has(a)) {
        targetDist = d;
        targetAlien = a;
      }
    }
    // If all aliens claimed, fall back to nearest
    if (!targetAlien) {
      for (const a of aliveAliens) {
        const d = mPos.distanceTo(a.mesh.position);
        if (d < targetDist) { targetDist = d; targetAlien = a; }
      }
    }
    if (targetAlien) claimedTargets.add(targetAlien);
    m.target = targetAlien;

    // --- FACE TARGET ---
    if (targetAlien && targetDist < 40) {
      const dx = targetAlien.mesh.position.x - mPos.x;
      const dz = targetAlien.mesh.position.z - mPos.z;
      m.mesh.rotation.y = Math.atan2(dx, dz);
      // Callout contacts
      if (m.calloutTimer <= 0 && targetDist < 20 && Math.random() < 0.005) {
        const dir = dx > 2 ? 'RIGHT' : dx < -2 ? 'LEFT' : 'AHEAD';
        m.calloutText = 'HOSTILE ' + dir + '!';
        m.calloutTimer = 120;
      }
    } else {
      const dx = playerPos.x - mPos.x;
      const dz = playerPos.z - mPos.z;
      m.mesh.rotation.y = Math.atan2(dx, dz);
    }

    // --- SHOOTING (skip if reviving or downed) ---
    if (m.state !== 'reviving' && m.state !== 'downed') {
      m.shootTimer--;
      const muzzle = m.mesh.getObjectByName('muzzleFlash');
      if (m.muzzleTimer > 0) {
        m.muzzleTimer--;
        if (m.muzzleTimer <= 0 && muzzle) muzzle.visible = false;
      }

      const shootRange = m.state === 'cover' ? 25 : 35;
      if (targetAlien && targetDist < shootRange && m.shootTimer <= 0) {
        const tgt = targetAlien.mesh.position.clone().add(new THREE.Vector3(0, targetAlien.isBoss ? 3 : 1, 0));
        const dir = tgt.sub(mPos.clone().add(new THREE.Vector3(0, 1.2, 0))).normalize();
        // Inaccuracy
        const spread = (diff.marineSpread * m.classSpread) + (1 - hpRatio) * 0.3;
        dir.x += (Math.random() - 0.5) * spread;
        dir.y += (Math.random() - 0.5) * spread * 0.6;
        dir.z += (Math.random() - 0.5) * spread;
        dir.normalize();
        // Panic fire
        if (Math.random() > hpRatio * 0.7 + 0.3) {
          dir.x += (Math.random() - 0.5) * 0.5;
          dir.z += (Math.random() - 0.5) * 0.5;
          dir.normalize();
        }
        const origin = mPos.clone().add(new THREE.Vector3(0, 1.2, 0));
        origin.add(dir.clone().multiplyScalar(0.8));
        shootBullet(origin, dir, 'marine');
        playGunshot('marine');
        const baseRate = Math.round((25 + Math.floor(Math.random() * 35)) * m.classFireRate);
        m.shootTimer = Math.round(baseRate / hpRatio);
        if (muzzle) { muzzle.visible = true; m.muzzleTimer = 3; }
      }
    }

    // --- DAMAGE VISUALS ---
    let yOffset = 0;
    if (m.flinchTimer > 0) {
      m.flinchTimer--;
      if (m.state !== 'downed') m.mesh.rotation.x = Math.sin(m.flinchTimer * 0.8) * 0.15;
      yOffset += Math.sin(m.flinchTimer * 1.5) * 0.02;
    } else if (m.state !== 'downed' && m.state !== 'reviving' && m.state !== 'cover') {
      m.mesh.rotation.x = 0;
    }

    if (m.health < 25 && m.health > 0 && m.state !== 'downed') {
      const limp = Math.sin(Date.now() * 0.01 + mPos.x) * 0.08;
      if (m.state !== 'cover') m.mesh.rotation.z = limp;
      yOffset += Math.abs(limp) * 0.3;
    }

    // Slight bob when following
    if (m.state === 'follow' || m.state === 'scout') {
      yOffset += Math.sin(Date.now() * 0.008 + mPos.x) * 0.04;
    }

    if (m.state !== 'downed') {
      mPos.y = Math.max(0, yOffset);
    }
  }

  // --- Bullets ---
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.mesh.position.add(b.vel);
    b.life--;

    // Orient bullet along velocity
    const ahead = b.mesh.position.clone().add(b.vel);
    b.mesh.lookAt(ahead);

    // Spawn trail segment
    if (b.life % 3 === 0 && b.trailMeshes.length < b.cfg.trailLength) {
      const seg = new THREE.Mesh(trailSegGeo, b.trailMat.clone());
      seg.position.copy(b.mesh.position);
      const scale = b.cfg.radius * 1.5;
      seg.scale.setScalar(scale);
      scene.add(seg);
      b.trailMeshes.push(seg);
    }

    // Fade and shrink trail
    for (let ti = b.trailMeshes.length - 1; ti >= 0; ti--) {
      const seg = b.trailMeshes[ti];
      seg.material.opacity *= 0.88;
      seg.scale.multiplyScalar(0.92);
      if (seg.material.opacity < 0.02) {
        scene.remove(seg);
        seg.material.dispose();
        b.trailMeshes.splice(ti, 1);
      }
    }

    // Cleanup helper
    function removeBullet() {
      scene.remove(b.mesh);
      for (const seg of b.trailMeshes) { scene.remove(seg); seg.material.dispose(); }
      bullets.splice(i, 1);
    }

    if (b.life <= 0 || b.mesh.position.y < 0) {
      removeBullet();
      continue;
    }

    // Platform hit
    const platHit = checkPlatformCollision(b.mesh.position, 0.1, 0.1, 0.1);
    if (platHit) {
      const pColor = b.owner === 'marine' ? 0x88ff44 : b.owner === 'player' ? 0xffdd33 : 0xff3333;
      spawnParticles(b.mesh.position, pColor, 4);
      playImpact();
      removeBullet();
      continue;
    }

    // Player or marine bullet vs alien
    if (b.owner === 'player' || b.owner === 'marine') {
      for (const a of aliens) {
        if (!a.alive) continue;
        const hitY = a.isBoss ? BOSS_SCALE * 1.2 : 1;
        const hitRadius = a.isBoss ? 3.5 : 1.2;
        const d = b.mesh.position.distanceTo(a.mesh.position.clone().add(new THREE.Vector3(0, hitY, 0)));
        if (d < hitRadius) {
          a.health -= (b.owner === 'player') ? charClass.damageMult : 1;
          spawnParticles(b.mesh.position, 0x44ff66, 4);
          // Blood on hit
          spawnParticles(b.mesh.position, 0x8a1a1a, 4);
          spawnParticles(b.mesh.position, 0xaa2222, 3);
          playImpact();
          if (b.owner === 'player') screenShake = Math.max(screenShake, 5);
          if (a.health <= 0) {
            a.alive = false;
            if (a.isBoss) {
              // Start chain explosion — don't remove mesh yet
              bossDeathChain = 1;
              bossDeathPos = a.mesh.position.clone();
              a.alive = false;
              screenShake = 25;
              playExplosion();
            } else {
              spawnGoreExplosion(a.mesh.position);
              playExplosion();
              if (b.owner === 'player') screenShake = 14;
            }
            spawnParticles(a.mesh.position.clone().add(new THREE.Vector3(0,1,0)), 0x3a3a4a, 8);
            if (!a.isBoss) {
              spawnAmmoDrop(a.mesh.position);
              if (Math.random() < 0.1) spawnHealthDrop(a.mesh.position);
              scene.remove(a.mesh);
            }
          }
          removeBullet();
          break;
        }
      }
    }

    // Alien bullet vs player
    if (b.owner === 'alien' && player.invincible <= 0) {
      if (b.mesh.position.distanceTo(playerPos) < 1.0) {
        player.health -= diff.damagePerHit;
        player.invincible = 20;
        screenShake = 8;
        playImpact();
        spawnParticles(b.mesh.position, 0xff3333, 6);
        damageFlash.style.background = 'rgba(255,0,0,0.3)';
        setTimeout(() => { damageFlash.style.background = 'rgba(255,0,0,0)'; }, 150);
        removeBullet();
        if (player.health <= 0) {
          gameState = 'dead';
          document.exitPointerLock();
          document.getElementById('death-screen').classList.remove('hidden');
        }
      }
    }

    // Alien bullet vs marines
    if (b.owner === 'alien') {
      for (const m of marines) {
        if (!m.alive) continue;
        // Skip downed marines but hits speed up bleed-out
        if (m.state === 'downed') {
          const d = b.mesh.position.distanceTo(m.mesh.position.clone().add(new THREE.Vector3(0,0.3,0)));
          if (d < 1.2) {
            m.downedTimer -= 60; // lose a second of bleed-out time
            spawnParticles(b.mesh.position, 0x8a1a1a, 4);
            playImpact();
            removeBullet();
            break;
          }
          continue;
        }
        const d = b.mesh.position.distanceTo(m.mesh.position.clone().add(new THREE.Vector3(0,1,0)));
        if (d < 1.2) {
          m.health -= 15;
          m.flinchTimer = 12; // stagger animation
          spawnParticles(b.mesh.position, 0x4a5a3a, 5);
          spawnParticles(b.mesh.position, 0x8a1a1a, 3); // blood
          playImpact();
          if (m.health <= 0) {
            m.health = 0;
            m.state = 'downed';
            m.downedTimer = diff.bleedOutTimer; // revive before death
            spawnParticles(b.mesh.position, 0x8a1a1a, 8);
            screenShake = Math.max(screenShake, 4);
            if (m.calloutTimer <= 0) { m.calloutText = m.name + ' IS DOWN!'; m.calloutTimer = 120; }
          }
          removeBullet();
          break;
        }
      }
    }
  }

  // --- Ammo drops ---
  for (let i = ammoDrops.length - 1; i >= 0; i--) {
    const d = ammoDrops[i];
    d.mesh.rotation.y += 0.04;
    d.mesh.rotation.z = Math.sin(Date.now() * 0.004 + i * 2) * 0.2;
    d.mesh.position.y = 0.5 + Math.sin(Date.now() * 0.003 + i) * 0.2;
    if (playerPos.distanceTo(d.mesh.position) < 1.5) {
      player.ammo += d.amount;
      spawnParticles(d.mesh.position, 0xffdd33, 6);
      spawnParticles(d.mesh.position, 0xff6622, 3);
      scene.remove(d.mesh);
      ammoDrops.splice(i, 1);
    }
  }

  // --- Health drops ---
  for (let i = healthDrops.length - 1; i >= 0; i--) {
    const d = healthDrops[i];
    d.mesh.rotation.y += 0.03;
    d.mesh.position.y = 0.5 + Math.sin(Date.now() * 0.003 + i * 3) * 0.15;
    if (playerPos.distanceTo(d.mesh.position) < 1.5) {
      player.health = Math.min(player.health + d.amount, diff.playerHealth);
      spawnParticles(d.mesh.position, 0x44ff66, 6);
      spawnParticles(d.mesh.position, 0x22dd44, 3);
      scene.remove(d.mesh);
      healthDrops.splice(i, 1);
    }
  }

  // --- Particles ---
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.mesh.position.add(p.vel);
    p.vel.y -= 0.008;
    p.life--;
    const scale = p.life / 40;
    p.mesh.scale.setScalar(Math.max(0.01, scale));
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }

  // --- Gibs (gore chunks) ---
  for (let i = gibs.length - 1; i >= 0; i--) {
    const g = gibs[i];
    g.mesh.position.add(g.vel);
    g.vel.y -= 0.012; // gravity
    g.mesh.rotation.x += g.rotVel.x;
    g.mesh.rotation.y += g.rotVel.y;
    g.mesh.rotation.z += g.rotVel.z;
    // Bounce off ground
    if (g.mesh.position.y < 0.08 && g.vel.y < 0) {
      g.mesh.position.y = 0.08;
      g.vel.y *= -0.3; // lose energy
      g.vel.x *= 0.7;
      g.vel.z *= 0.7;
      g.rotVel.multiplyScalar(0.5);
      g.bounced = true;
    }
    // Slow down on ground
    if (g.bounced && g.mesh.position.y < 0.15) {
      g.vel.x *= 0.92;
      g.vel.z *= 0.92;
    }
    g.life--;
    // Fade out near end
    if (g.life < 20) {
      const s = g.life / 20;
      g.mesh.scale.setScalar(Math.max(0.01, s));
    }
    if (g.life <= 0) {
      scene.remove(g.mesh);
      gibs.splice(i, 1);
    }
  }

  // --- Fire & smoke animation + light culling ---
  const t = Date.now() * 0.001;
  const MAX_ACTIVE_LIGHTS = 10;
  const LIGHT_CULL_DIST = 55;

  // Cull: disable all, then enable closest
  for (const fl of allFireLights) fl.visible = false;
  // Sort by distance to player (only every few frames — cache sort index)
  if (!allFireLights._sortFrame || allFireLights._sortFrame++ > 5) {
    allFireLights._sortFrame = 0;
    allFireLights._sorted = allFireLights
      .map((fl, i) => ({ i, d: (fl.position.x - playerPos.x) ** 2 + (fl.position.z - playerPos.z) ** 2 }))
      .sort((a, b) => a.d - b.d);
  }
  const sorted = allFireLights._sorted || [];
  for (let si = 0; si < Math.min(MAX_ACTIVE_LIGHTS, sorted.length); si++) {
    const fl = allFireLights[sorted[si].i];
    if (sorted[si].d > LIGHT_CULL_DIST * LIGHT_CULL_DIST) break;
    fl.visible = true;
    // Animate intensity only for visible lights
    fl.intensity = 1.2 + Math.sin(t * 3 + sorted[si].i * 2) * 0.6 + Math.sin(t * 7 + sorted[si].i) * 0.3;
  }
  for (const sp of smokeParticles) {
    sp.mesh.position.y = sp.baseY + Math.sin(t * sp.speed + sp.baseX) * 2;
    sp.mesh.position.x = sp.baseX + Math.sin(t * 0.3 + sp.baseY) * 1.5;
    sp.mesh.material.opacity = 0.15 + Math.sin(t * 0.5 + sp.baseY) * 0.1;
  }
  for (const e of embers) {
    e.mesh.position.y = e.baseY + Math.sin(t * e.speed * 10 + e.mesh.position.x) * 3;
    e.mesh.position.x += e.drift;
    if (e.mesh.position.x > 40) e.mesh.position.x = -40;
    if (e.mesh.position.x < -40) e.mesh.position.x = 40;
  }

  // --- Helicopter animation ---
  // Main rotor spin
  mainRotorGroup.rotation.y += 0.35;
  // Tail rotor spin
  tailRotorGroup.children.forEach(c => { if (c !== tailRotorHub) c.rotation.z += 0.05; });
  tailRotorGroup.rotation.z += 0.5;
  // Idle hover bob
  shipGroup.position.y = 2 + Math.sin(Date.now() * 0.002) * 0.15;
  shipGroup.rotation.z = Math.sin(Date.now() * 0.0015) * 0.02;
  // Beacon (green flash)
  beacon.intensity = Math.sin(Date.now() * 0.008) > 0.7 ? 3 : 0.2;
  // Anti-collision (red flash, offset timing)
  antiCol.intensity = Math.sin(Date.now() * 0.006 + 1) > 0.8 ? 2 : 0;
  // Rotor wash glow
  washLight.intensity = 1.2 + Math.sin(Date.now() * 0.01) * 0.3;

  // --- Crew Chief wave animation ---
  const waveArm = shipGroup.getObjectByName('waveArm');
  if (waveArm) {
    const playerDist = playerPos.distanceTo(SHIP_POS);
    if (playerDist < 50) {
      // Wave faster as player gets closer
      const waveSpeed = 0.006 + (1 - playerDist / 50) * 0.008;
      waveArm.rotation.z = Math.sin(Date.now() * waveSpeed) * 1.2 - 0.5;
    } else {
      waveArm.rotation.z = 0;
    }
  }

  // --- Door gunner covering fire ---
  heloGunnerTimer--;
  const heloMuzzleFlash = shipGroup.getObjectByName('heloMuzzle');
  if (heloMuzzleFlashTimer > 0) {
    heloMuzzleFlashTimer--;
    if (heloMuzzleFlashTimer <= 0 && heloMuzzleFlash) heloMuzzleFlash.visible = false;
  }
  const heloDist = playerPos.distanceTo(SHIP_POS);
  if (heloDist < 50 && heloGunnerTimer <= 0) {
    // Find nearest alive alien to the helo
    let nearestAlien = null;
    let nearestDist = 45;
    for (const a of aliens) {
      if (!a.alive) continue;
      const d = a.mesh.position.distanceTo(SHIP_POS);
      if (d < nearestDist) { nearestDist = d; nearestAlien = a; }
    }
    if (nearestAlien) {
      // World position of the minigun muzzle
      const muzzleWorld = new THREE.Vector3(-1.5, -0.5, -2.3);
      shipGroup.localToWorld(muzzleWorld);
      const tgtPos = nearestAlien.mesh.position.clone().add(new THREE.Vector3(0, nearestAlien.isBoss ? 3 : 1, 0));
      const dir = tgtPos.sub(muzzleWorld).normalize();
      // Slight inaccuracy
      dir.x += (Math.random() - 0.5) * 0.15;
      dir.y += (Math.random() - 0.5) * 0.1;
      dir.z += (Math.random() - 0.5) * 0.15;
      dir.normalize();
      shootBullet(muzzleWorld, dir, 'marine');
      playGunshot('marine');
      heloGunnerTimer = 12;
      if (heloMuzzleFlash) { heloMuzzleFlash.visible = true; heloMuzzleFlashTimer = 3; }
    }
  }

  // --- Outpost Marines (only engage when player is near the LZ) ---
  const playerAtLZ = heloDist < 50;
  for (const om of outpostMarines) {
    if (!om.alive) continue;
    om.shootTimer--;
    const omMuzzle = om.mesh.getObjectByName('muzzleFlash');
    if (om.muzzleTimer > 0) {
      om.muzzleTimer--;
      if (om.muzzleTimer <= 0 && omMuzzle) omMuzzle.visible = false;
    }
    if (!playerAtLZ) { om.mesh.rotation.y = om.pos.rot; continue; }
    // Find nearest alien within range
    let omTarget = null;
    let omTargetDist = 40;
    for (const a of aliens) {
      if (!a.alive) continue;
      const d = a.mesh.position.distanceTo(om.mesh.position);
      if (d < omTargetDist) { omTargetDist = d; omTarget = a; }
    }
    if (omTarget) {
      // Face target
      const odx = omTarget.mesh.position.x - om.mesh.position.x;
      const odz = omTarget.mesh.position.z - om.mesh.position.z;
      om.mesh.rotation.y = Math.atan2(odx, odz);
      // Shoot
      if (om.shootTimer <= 0) {
        const tgt = omTarget.mesh.position.clone().add(new THREE.Vector3(0, omTarget.isBoss ? 3 : 1, 0));
        const origin = om.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        const dir = tgt.sub(origin).normalize();
        dir.x += (Math.random() - 0.5) * 0.2;
        dir.y += (Math.random() - 0.5) * 0.1;
        dir.z += (Math.random() - 0.5) * 0.2;
        dir.normalize();
        origin.add(dir.clone().multiplyScalar(0.8));
        shootBullet(origin, dir, 'marine');
        playGunshot('marine');
        om.shootTimer = 20 + Math.floor(Math.random() * 20);
        if (omMuzzle) { omMuzzle.visible = true; om.muzzleTimer = 3; }
      }
    } else {
      om.mesh.rotation.y = om.pos.rot;
    }
  }

  // --- General pointing animation ---
  const genDist = playerPos.distanceTo(generalGroup.position);
  if (genDist < 30) {
    const gdx = playerPos.x - generalGroup.position.x;
    const gdz = playerPos.z - generalGroup.position.z;
    generalGroup.rotation.y = Math.atan2(gdx, gdz);
  }
  const genPointArm = generalGroup.getObjectByName('pointArm');
  if (genPointArm) {
    genPointArm.rotation.z = -1.2 + Math.sin(Date.now() * 0.003) * 0.15;
  }

  // --- Boss death chain explosion ---
  if (bossDeathChain > 0 && bossDeathPos) {
    bossDeathChain++;
    // Explosion every 12 frames, 10 total over ~2 seconds
    if (bossDeathChain % 12 === 0 && bossDeathChain < 130) {
      const radius = (bossDeathChain / 12) * 2.5;
      const angle = Math.random() * Math.PI * 2;
      const offset = new THREE.Vector3(Math.cos(angle) * radius, Math.random() * 4, Math.sin(angle) * radius);
      const blastPos = bossDeathPos.clone().add(offset);
      spawnGoreExplosion(blastPos);
      spawnParticles(blastPos, 0xff2244, 8);
      spawnParticles(blastPos, 0xaa6622, 5);
      playExplosion();
      screenShake = Math.max(screenShake, 10 + bossDeathChain * 0.1);
    }
    // Shake the boss mesh while it dies
    if (bossAlien && bossAlien.mesh.parent) {
      bossAlien.mesh.position.x += (Math.random() - 0.5) * 0.3;
      bossAlien.mesh.position.z += (Math.random() - 0.5) * 0.3;
      bossAlien.mesh.rotation.y += (Math.random() - 0.5) * 0.1;
    }
    // Final blast at frame 130 — remove boss, kill nearby aliens, start extraction
    if (bossDeathChain >= 130) {
      // Massive final detonation
      for (let g = 0; g < 8; g++) {
        const offset = new THREE.Vector3((Math.random()-0.5)*8, Math.random()*5, (Math.random()-0.5)*8);
        spawnGoreExplosion(bossDeathPos.clone().add(offset));
      }
      spawnParticles(bossDeathPos.clone().add(new THREE.Vector3(0,4,0)), 0xff2244, 30);
      spawnParticles(bossDeathPos.clone().add(new THREE.Vector3(0,2,0)), 0xffaa22, 20);
      playExplosion();
      screenShake = 35;
      // Remove boss mesh
      if (bossAlien && bossAlien.mesh.parent) scene.remove(bossAlien.mesh);
      // Kill nearby aliens in the blast radius
      for (const a of aliens) {
        if (!a.alive || a.isBoss) continue;
        if (a.mesh.position.distanceTo(bossDeathPos) < 20) {
          a.alive = false;
          spawnGoreExplosion(a.mesh.position);
          scene.remove(a.mesh);
        }
      }
      // Drop ammo where boss died
      spawnAmmoDrop(bossDeathPos);
      spawnAmmoDrop(bossDeathPos.clone().add(new THREE.Vector3(2,0,0)));
      spawnAmmoDrop(bossDeathPos.clone().add(new THREE.Vector3(-2,0,0)));
      // Start extraction phase
      extractionActive = true;
      extractionTimer = EXTRACTION_DURATION;
      document.getElementById('extraction-hud').style.display = 'block';
      // Spawn reinforcement aliens behind the player
      const spawnPoints = [
        { x: -120, z: -300 }, { x: -100, z: -295 }, { x: -80, z: -305 },
        { x: -60, z: -298 }, { x: -140, z: -302 }, { x: -110, z: -308 },
        { x: -90, z: -294 }, { x: -70, z: -300 },
      ];
      for (const sp of spawnPoints) {
        const rGroup = new THREE.Group();
        // Reuse the alien visual from the first alive alien as template dimensions
        const rGeo = new THREE.SphereGeometry(0.55, 6, 5);
        rGeo.scale(1, 1.3, 0.85);
        const rTorso = new THREE.Mesh(rGeo, alienSkinMat);
        rTorso.position.y = 0.9;
        rGroup.add(rTorso);
        const rSkull = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 5), alienLightMat);
        rSkull.position.set(0, 1.7, 0.2);
        rGroup.add(rSkull);
        for (const ex of [-0.18, 0.18]) {
          const rEye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 5, 5), alienEyeMat);
          rEye.position.set(ex, 1.72, 0.55);
          rGroup.add(rEye);
        }
        rGroup.position.set(sp.x, 1, sp.z);
        scene.add(rGroup);
        aliens.push({
          mesh: rGroup, health: diff.alienHealth, alive: true,
          startX: sp.x, dir: Math.random() > 0.5 ? 1 : -1,
          speed: 0.03 * diff.alienSpeedMult, range: 6,
          shootTimer: Math.floor(30 * diff.alienFireMult),
        });
      }
      bossDeathChain = 0;
      bossDeathPos = null;
    }
  }

  // --- Extraction countdown ---
  if (extractionActive) {
    extractionTimer--;
    const secs = Math.ceil(extractionTimer / 60);
    const pct = (extractionTimer / EXTRACTION_DURATION) * 100;
    document.getElementById('extraction-timer').textContent = secs;
    document.getElementById('extraction-bar').style.width = pct + '%';
    // Flash red when low
    if (secs <= 5) {
      document.getElementById('extraction-timer').style.color = extractionTimer % 30 < 15 ? '#ff2233' : '#ff8844';
    }
    if (extractionTimer <= 0) {
      player.health = 0;
      gameState = 'dead';
      document.exitPointerLock();
      document.getElementById('extraction-hud').style.display = 'none';
      document.getElementById('death-screen').classList.remove('hidden');
    }
  }

  // --- Win condition (boss must be dead, extraction phase must be active) ---
  if (playerPos.distanceTo(SHIP_POS) < 6) {
    if (extractionActive) {
      gameState = 'won';
      document.exitPointerLock();
      document.getElementById('extraction-hud').style.display = 'none';
      document.getElementById('win-screen').classList.remove('hidden');
      const beatIdx = DIFF_ORDER.indexOf(currentDiffKey);
      if (beatIdx >= 0 && beatIdx + 1 > unlockedLevel) {
        unlockedLevel = beatIdx + 1;
        localStorage.setItem('falo3d-unlocked', unlockedLevel);
      }
    }
  }

  // === EASTER EGGS ===

  // GOD MODE (Konami code activated on title screen)
  if (godMode) {
    player.health = diff.playerHealth;
    player.ammo = Math.max(player.ammo, 99);
  }
  if (godModeMessageTimer > 0) godModeMessageTimer--;

  // BIG HEAD MODE (hold LB + RB simultaneously)
  const lbHeld = gamepad.lockedIndex >= 0 && navigator.getGamepads()[gamepad.lockedIndex] &&
    navigator.getGamepads()[gamepad.lockedIndex].buttons[4] &&
    navigator.getGamepads()[gamepad.lockedIndex].buttons[4].pressed;
  const rbHeld = gamepad.lockedIndex >= 0 && navigator.getGamepads()[gamepad.lockedIndex] &&
    navigator.getGamepads()[gamepad.lockedIndex].buttons[5] &&
    navigator.getGamepads()[gamepad.lockedIndex].buttons[5].pressed;
  const bothBumpers = lbHeld && rbHeld;

  if (bothBumpers && !bigHeadPrevState) {
    bigHeadMode = !bigHeadMode;
    // Apply to all alive aliens
    for (const a of aliens) {
      if (!a.alive) continue;
      // The head is the 2nd child in the alien group (skull)
      // Scale the top portion of the mesh
      a.mesh.traverse(child => {
        if (child.isMesh && child.position.y > 1.5) {
          child.scale.setScalar(bigHeadMode ? 3 : 1);
        }
      });
    }
  }
  bigHeadPrevState = bothBumpers;

  // SECRET ROOM detection
  if (!secretRoomFound) {
    const dx = playerPos.x - SECRET_ROOM.x;
    const dz = playerPos.z - SECRET_ROOM.z;
    if (Math.sqrt(dx*dx + dz*dz) < SECRET_ROOM.radius) {
      secretRoomFound = true;
      secretRoomMessageTimer = 360; // 6 seconds
      // Reward: full health + bonus ammo
      player.health = diff.playerHealth;
      player.ammo += 50;
      // Sparkle effect
      for (let i = 0; i < 20; i++) {
        spawnParticles(
          new THREE.Vector3(SECRET_ROOM.x + (Math.random()-0.5)*4, 1 + Math.random()*2, SECRET_ROOM.z + (Math.random()-0.5)*4),
          0x44ff66, 2
        );
      }
      // Sound
      if (soundEnabled) {
        const t = audioCtx.currentTime;
        [523, 659, 784, 1047].forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const g = audioCtx.createGain();
          g.gain.setValueAtTime(0.1, t + i * 0.15);
          g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.4);
          osc.connect(g); g.connect(audioCtx.destination);
          osc.start(t + i * 0.15); osc.stop(t + i * 0.15 + 0.45);
        });
      }
    }
  }
  if (secretRoomMessageTimer > 0) secretRoomMessageTimer--;

  updateHUD();
}

function animate() {
  requestAnimationFrame(animate);
  // Poll gamepad even on menu screens
  pollGamepad();
  if (gameState !== 'playing' && (gamepad.start || gamepad.shoot || gamepad.jump)) {
    if (!gamepad._menuPressed) {
      gamepad._menuPressed = true;
      if (gameState === 'paused') {
        resumeGame();
      } else if (!document.getElementById('diff-screen').classList.contains('hidden')) {
        // On diff screen — ignore gamepad, must pick a card
      } else {
        showDiffScreen();
      }
    }
  } else {
    gamepad._menuPressed = false;
  }
  update();
  renderer.render(scene, camera);
}

// === SOUND MIXER PANEL ===
const mixerDefs = [
  { id: 'player-rifle', title: 'PLAYER RIFLE', cat: 'weapon',
    params: [
      { key:'filterFreq', label:'Filter', min:500, max:5000, step:50 },
      { key:'filterQ', label:'Q', min:0.1, max:3, step:0.1 },
      { key:'bassFreq', label:'Bass Hz', min:40, max:250, step:5 },
      { key:'bassVol', label:'Bass', min:0.05, max:0.6, step:0.05 },
      { key:'noiseVol', label:'Noise', min:0.05, max:0.5, step:0.05 },
      { key:'duration', label:'Dur', min:0.04, max:0.25, step:0.01 },
    ], playFn: () => playGunshot('player') },
  { id: 'marine-rifle', title: 'MARINE RIFLE', cat: 'weapon',
    params: [
      { key:'filterFreq', label:'Filter', min:800, max:6000, step:50 },
      { key:'filterQ', label:'Q', min:0.1, max:3, step:0.1 },
      { key:'bassFreq', label:'Bass Hz', min:40, max:250, step:5 },
      { key:'bassVol', label:'Bass', min:0.05, max:0.5, step:0.05 },
      { key:'noiseVol', label:'Noise', min:0.05, max:0.4, step:0.05 },
      { key:'duration', label:'Dur', min:0.03, max:0.2, step:0.01 },
    ], playFn: () => playGunshot('marine') },
  { id: 'alien-weapon', title: 'ALIEN WEAPON', cat: 'weapon',
    params: [
      { key:'filterFreq', label:'Filter', min:200, max:3000, step:50 },
      { key:'filterQ', label:'Q', min:0.1, max:3, step:0.1 },
      { key:'bassFreq', label:'Bass Hz', min:20, max:150, step:5 },
      { key:'bassVol', label:'Bass', min:0.05, max:0.5, step:0.05 },
      { key:'noiseVol', label:'Noise', min:0.05, max:0.4, step:0.05 },
      { key:'duration', label:'Dur', min:0.05, max:0.3, step:0.01 },
    ], playFn: () => playGunshot('alien') },
  { id: 'explosion', title: 'EXPLOSION', cat: 'weapon',
    params: [
      { key:'filterStart', label:'Filt Hi', min:500, max:5000, step:100 },
      { key:'filterEnd', label:'Filt Lo', min:30, max:500, step:10 },
      { key:'subFreq', label:'Sub Hz', min:30, max:150, step:5 },
      { key:'subVol', label:'Sub', min:0.1, max:0.8, step:0.05 },
      { key:'noiseVol', label:'Noise', min:0.1, max:0.7, step:0.05 },
      { key:'crackDensity', label:'Crack', min:0.01, max:0.15, step:0.01 },
      { key:'crackVol', label:'Crk Vol', min:0.05, max:0.5, step:0.05 },
      { key:'duration', label:'Dur', min:0.2, max:0.8, step:0.05 },
    ], playFn: playExplosion },
  { id: 'impact', title: 'BULLET IMPACT', cat: 'impact',
    params: [
      { key:'startFreq', label:'Start', min:200, max:1200, step:50 },
      { key:'endFreq', label:'End', min:30, max:200, step:10 },
      { key:'vol', label:'Tone', min:0.05, max:0.4, step:0.05 },
      { key:'noiseVol', label:'Noise', min:0.02, max:0.2, step:0.02 },
      { key:'duration', label:'Dur', min:0.02, max:0.12, step:0.01 },
    ], playFn: playImpact },
  { id: 'footstep', title: 'FOOTSTEP', cat: 'move',
    params: [
      { key:'thudFreq', label:'Thud Hz', min:30, max:120, step:5 },
      { key:'thudVol', label:'Thud', min:0.02, max:0.2, step:0.02 },
      { key:'gritFreq', label:'Grit Hz', min:400, max:2000, step:50 },
      { key:'gritVol', label:'Grit', min:0.02, max:0.15, step:0.01 },
      { key:'gritDuration', label:'Grit Ln', min:0.02, max:0.1, step:0.01 },
      { key:'duration', label:'Dur', min:0.03, max:0.15, step:0.01 },
    ], playFn: playFootstep },
  { id: 'fire', title: 'AMBIENT FIRE', cat: 'ambient',
    params: [
      { key:'density', label:'Crackle', min:0.01, max:0.1, step:0.005 },
      { key:'popVol', label:'Pop', min:0.1, max:0.8, step:0.05 },
      { key:'rumble', label:'Rumble', min:0.01, max:0.1, step:0.005 },
      { key:'filterFreq', label:'Filter', min:1000, max:8000, step:200 },
      { key:'vol', label:'Vol', min:0.02, max:0.2, step:0.01 },
    ] },
  { id: 'helo', title: 'HELICOPTER', cat: 'ambient',
    params: [
      { key:'freq', label:'Thump', min:20, max:80, step:5 },
      { key:'thumpVol', label:'Vol', min:0.02, max:0.15, step:0.01 },
      { key:'whooshFreq', label:'Whoosh', min:100, max:600, step:25 },
      { key:'whooshVol', label:'Wsh Vol', min:0.01, max:0.1, step:0.01 },
      { key:'interval', label:'Rate ms', min:30, max:150, step:5 },
    ] },
];

function buildMixer() {
  const panel = document.getElementById('sound-panel');
  let html = `<div class="sp-header">
    <span class="sp-title">SOUND MIXER</span>
    <span style="color:#555;font-size:10px;letter-spacing:1px">M TO CLOSE</span>
  </div>`;

  for (const def of mixerDefs) {
    html += `<div class="sp-group ${def.cat}"><div class="sp-group-title">${def.title}</div>`;
    for (const p of def.params) {
      const val = soundCfg[def.id][p.key];
      html += `<div class="sp-row">
        <span class="sp-label">${p.label}</span>
        <input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${val}"
          data-sid="${def.id}" data-key="${p.key}">
        <span class="sp-val" id="spv-${def.id}-${p.key}">${val}</span>
      </div>`;
    }
    if (def.playFn) {
      html += `<button class="sp-play" data-sid="${def.id}">▶ PREVIEW</button>`;
    }
    html += '</div>';
  }

  html += `<div class="sp-export">
    <div class="sp-export-title">EXPORT</div>
    <div class="sp-export-btns">
      <button class="sp-export-btn" id="sp-gen">GENERATE JSON</button>
      <button class="sp-export-btn" id="sp-copy">COPY</button>
    </div>
    <textarea id="sp-json" readonly spellcheck="false" placeholder="Click GENERATE JSON..."></textarea>
  </div>`;

  panel.innerHTML = html;

  // Slider events
  panel.querySelectorAll('input[type="range"]').forEach(input => {
    input.addEventListener('input', () => {
      const sid = input.dataset.sid;
      const key = input.dataset.key;
      const val = parseFloat(input.value);
      soundCfg[sid][key] = val;
      document.getElementById(`spv-${sid}-${key}`).textContent = val;
      const json = document.getElementById('sp-json');
      if (json.value) json.value = JSON.stringify(soundCfg, null, 2);
    });
  });

  // Preview buttons
  panel.querySelectorAll('.sp-play').forEach(btn => {
    btn.addEventListener('click', () => {
      initAudio();
      const def = mixerDefs.find(d => d.id === btn.dataset.sid);
      if (def && def.playFn) def.playFn();
    });
  });

  // Export
  document.getElementById('sp-gen').addEventListener('click', () => {
    document.getElementById('sp-json').value = JSON.stringify(soundCfg, null, 2);
  });
  document.getElementById('sp-copy').addEventListener('click', () => {
    const ta = document.getElementById('sp-json');
    if (!ta.value) ta.value = JSON.stringify(soundCfg, null, 2);
    navigator.clipboard.writeText(ta.value).then(() => {
      const btn = document.getElementById('sp-copy');
      btn.textContent = 'COPIED';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'COPY'; btn.classList.remove('copied'); }, 1500);
    });
  });
}
buildMixer();

// Toggle with M key
let mixerOpen = false;
window.addEventListener('keydown', e => {
  if (e.code === 'KeyM' && gameState === 'playing') {
    mixerOpen = !mixerOpen;
    document.getElementById('sound-panel').classList.toggle('open', mixerOpen);
    if (mixerOpen) {
      document.exitPointerLock();
    } else {
      renderer.domElement.requestPointerLock();
    }
  }
});

animate();
