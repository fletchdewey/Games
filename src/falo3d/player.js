// --- PLAYER STATE ---
const player = {
  health: 100,
  ammo: 30,
  y: 1.6,
  vy: 0,
  onGround: true,
  shootCooldown: 0,
  invincible: 0,
  yaw: 0,
  pitch: 0,
  crouching: false,
  crouchLerp: 0, // smooth transition 0=standing 1=crouched
};
const playerPos = new THREE.Vector3(0, 1.6, 5);
const moveDir = new THREE.Vector3();


// --- INPUT ---
const keys = {};
let mouseDown = false;
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup', e => {
  keys[e.code] = false;
  // Toggle stick Y invert
  if (e.code === 'KeyI') {
    gamepad.invertY = !gamepad.invertY;
  }
  // Konami Code detection (works on title screen)
  if (gameState === 'title') {
    if (e.code === konamiSequence[konamiProgress]) {
      konamiProgress++;
      if (konamiProgress >= konamiSequence.length) {
        godMode = true;
        konamiProgress = 0;
        godModeMessageTimer = 300;
        // Play a special sound
        if (audioCtx || initAudio()) {
          const t = (audioCtx || { currentTime: 0 }).currentTime;
          if (audioCtx) {
            // Victory jingle: ascending notes
            [0, 0.12, 0.24, 0.36, 0.6].forEach((delay, i) => {
              const osc = audioCtx.createOscillator();
              osc.type = 'sine';
              osc.frequency.value = [330, 392, 494, 587, 784][i];
              const g = audioCtx.createGain();
              g.gain.setValueAtTime(0.15, t + delay);
              g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.3);
              osc.connect(g); g.connect(audioCtx.destination);
              osc.start(t + delay); osc.stop(t + delay + 0.35);
            });
          }
        }
      }
    } else {
      konamiProgress = e.code === konamiSequence[0] ? 1 : 0;
    }
  }
});
window.addEventListener('mousedown', () => { mouseDown = true; });
window.addEventListener('mouseup', () => { mouseDown = false; });

let isLocked = false;
document.addEventListener('pointerlockchange', () => {
  isLocked = document.pointerLockElement === renderer.domElement;
  // If pointer lock exits during gameplay, pause
  if (!isLocked && gameState === 'playing') {
    gameState = 'paused';
    document.getElementById('pause-screen').classList.remove('hidden');
  }
});
document.addEventListener('mousemove', e => {
  if (!isLocked || gameState !== 'playing') return;
  player.yaw -= e.movementX * 0.002;
  player.pitch -= e.movementY * 0.002;
  player.pitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, player.pitch));
});

// --- GAMEPAD ---
const gamepad = {
  leftX: 0, leftY: 0,   // left stick: movement
  rightX: 0, rightY: 0, // right stick: camera aim
  shoot: false,          // right trigger (RT)
  jump: false,           // A button
  crouch: false,         // B button or LB
  start: false,          // start/menu button
  deadzone: 0.2,
  lockedIndex: -1,       // lock to first real controller found
  invertY: false,        // press I to toggle if stick-up goes wrong way
};

function pollGamepad() {
  const gps = navigator.getGamepads();
  if (!gps) return;

  // If we have a locked controller, verify it's still connected
  if (gamepad.lockedIndex >= 0) {
    const gp = gps[gamepad.lockedIndex];
    if (!gp || !gp.connected) {
      gamepad.lockedIndex = -1; // lost it, search again
    }
  }

  // Find a real controller (skip ghost devices with no buttons/axes)
  let gp = null;
  if (gamepad.lockedIndex >= 0) {
    gp = gps[gamepad.lockedIndex];
  } else {
    for (let i = 0; i < gps.length; i++) {
      const candidate = gps[i];
      if (!candidate || !candidate.connected) continue;
      if (!candidate.axes || candidate.axes.length < 4) continue;
      if (!candidate.buttons || candidate.buttons.length < 8) continue;
      // Looks like a real controller
      gamepad.lockedIndex = i;
      gp = candidate;
      break;
    }
  }

  if (!gp) {
    // No controller — zero everything
    gamepad.leftX = gamepad.leftY = gamepad.rightX = gamepad.rightY = 0;
    gamepad.shoot = gamepad.jump = gamepad.crouch = gamepad.start = false;
    return;
  }

  // Apply deadzone
  const dz = gamepad.deadzone;
  const applyDZ = (v) => Math.abs(v) < dz ? 0 : v;

  gamepad.leftX = applyDZ(gp.axes[0] || 0);
  gamepad.leftY = applyDZ(gp.axes[1] || 0);
  gamepad.rightX = applyDZ(gp.axes[2] || 0);
  gamepad.rightY = applyDZ(gp.axes[3] || 0);

  // RT = button 7 (Xbox)
  gamepad.shoot = (gp.buttons[7] && gp.buttons[7].value > 0.3);
  // A = button 0
  gamepad.jump = (gp.buttons[0] && gp.buttons[0].pressed);
  // B = button 1, LB = button 4 — crouch
  gamepad.crouch = (gp.buttons[1] && gp.buttons[1].pressed) || (gp.buttons[4] && gp.buttons[4].pressed);
  // Start = button 9 (Xbox menu), or button 8
  gamepad.start = (gp.buttons[9] && gp.buttons[9].pressed) || (gp.buttons[8] && gp.buttons[8].pressed);
}
