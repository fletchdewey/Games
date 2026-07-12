const settings = {
  masterVol: 0.8,
  sfxVol: 1.0,
  ambientVol: 0.7,
  stickSens: 0.06,
  particleLevel: 'high', // high=100, medium=60, low=30
  screenShakeLevel: 'full', // full, reduced, off
};

// Slider value displays
function bindSlider(id, valId, fmt, callback) {
  const el = document.getElementById(id);
  const valEl = document.getElementById(valId);
  el.addEventListener('input', () => {
    valEl.textContent = fmt(el.value);
    callback(parseFloat(el.value));
  });
}
bindSlider('setting-master-vol', 'val-master-vol', v => v + '%', v => { settings.masterVol = v / 100; });
bindSlider('setting-sfx-vol', 'val-sfx-vol', v => v + '%', v => { settings.sfxVol = v / 100; });
bindSlider('setting-ambient-vol', 'val-ambient-vol', v => v + '%', v => { settings.ambientVol = v / 100; });
bindSlider('setting-stick-sens', 'val-stick-sens', v => v, v => { settings.stickSens = v / 100; });
bindSlider('setting-deadzone', 'val-deadzone', v => (v / 100).toFixed(2), v => { gamepad.deadzone = v / 100; });

document.getElementById('setting-invert-y').addEventListener('change', (e) => {
  gamepad.invertY = e.target.value === 'yes';
});
document.getElementById('setting-particles').addEventListener('change', (e) => {
  settings.particleLevel = e.target.value;
});
document.getElementById('setting-screenshake').addEventListener('change', (e) => {
  settings.screenShakeLevel = e.target.value;
});

// --- HUD UPDATE ---
const healthFill = document.getElementById('health-fill');
const ammoVal = document.getElementById('ammo-val');
const alienVal = document.getElementById('alien-val');
const shipVal = document.getElementById('ship-val');
const damageFlash = document.getElementById('damage-flash');

function updateHUD() {
  const pct = Math.max(0, (player.health / diff.playerHealth) * 100);
  healthFill.style.width = pct + '%';
  healthFill.style.background = pct > 50 ? '#44cc44' : pct > 25 ? '#ccaa22' : '#cc3333';
  ammoVal.textContent = player.ammo;
  alienVal.textContent = aliens.filter(a => a.alive).length;
  const dist = Math.round(playerPos.distanceTo(SHIP_POS));
  shipVal.textContent = dist;
  // Squad status
  const squadEl = document.getElementById('squad-status');
  let squadHTML = '';
  for (const m of marines) {
    const hpPct = Math.max(0, Math.round(m.health / m.maxHealth * 100));
    let color, status;
    if (!m.alive) {
      color = '#663333'; status = '&#9760; KIA';
    } else if (m.state === 'downed') {
      const bleedSec = Math.ceil(m.downedTimer / 60);
      color = '#ff4444'; status = '&#9888; DOWN (' + bleedSec + 's)';
    } else if (m.state === 'reviving') {
      const pct = Math.round(m.reviveProgress / 120 * 100);
      color = '#44cc44'; status = '&#9829; REVIVING ' + pct + '%';
    } else if (m.state === 'cover') {
      color = '#ccaa22'; status = '&#9632; IN COVER';
    } else if (m.state === 'scout') {
      color = '#4488cc'; status = '&#9654; SCOUTING';
    } else if (hpPct > 75) {
      color = '#88ff44'; status = 'READY';
    } else if (hpPct > 50) {
      color = '#88ff44'; status = 'MINOR WOUNDS';
    } else if (hpPct > 25) {
      color = '#ccaa22'; status = 'WOUNDED';
    } else {
      color = '#cc3333'; status = 'CRITICAL';
    }
    const bar = !m.alive ? '--------' : m.state === 'downed' ? '!!!!!!!!': ('|').repeat(Math.ceil(hpPct / 12.5)) + ('.').repeat(8 - Math.ceil(hpPct / 12.5));
    let line = '<span style="color:' + color + '">' + m.name + ' [' + bar + '] ' + status + '</span>';
    // Callout text (fades)
    if (m.calloutTimer > 60) {
      line += ' <span style="color:#ffffff;font-size:11px;">' + m.calloutText + '</span>';
    }
    squadHTML += line + '<br>';
  }
  squadEl.innerHTML = squadHTML;

  // Easter egg messages
  const easterEl = document.getElementById('easter-msg');
  const easterText = document.getElementById('easter-msg-text');
  const easterSub = document.getElementById('easter-msg-sub');
  if (godModeMessageTimer > 0) {
    easterEl.style.display = 'block';
    easterText.textContent = 'I love you and I\'m very proud of you Fletcher!';
    easterSub.textContent = '— Dad';
    easterText.style.color = '#ffd700';
    easterText.style.textShadow = '0 0 30px rgba(255,215,0,0.6)';
    easterEl.style.opacity = Math.min(1, godModeMessageTimer / 30);
    if (godModeMessageTimer === 299) {
      easterSub.textContent += '  ·  GOD MODE ACTIVATED';
    }
  } else if (secretRoomMessageTimer > 0) {
    easterEl.style.display = 'block';
    easterText.textContent = 'SECRET ROOM FOUND';
    easterSub.textContent = '+50 AMMO  ·  FULL HEALTH  ·  KEEP EXPLORING';
    easterText.style.color = '#44ff66';
    easterText.style.textShadow = '0 0 20px rgba(68,255,102,0.5)';
    easterEl.style.opacity = Math.min(1, secretRoomMessageTimer / 30);
  } else if (bigHeadMode) {
    easterEl.style.display = 'block';
    easterText.textContent = 'BIG HEAD MODE';
    easterSub.textContent = '';
    easterText.style.color = '#ff6622';
    easterText.style.textShadow = '0 0 15px rgba(255,102,34,0.4)';
    easterEl.style.opacity = 0.6;
  } else {
    easterEl.style.display = 'none';
  }

  // God mode indicator (persistent small text)
  if (godMode && godModeMessageTimer <= 0) {
    const gmEl = document.getElementById('ship-dist');
    gmEl.innerHTML = 'HELO: <span id="ship-val">' + Math.round(playerPos.distanceTo(SHIP_POS)) + '</span>m <span style="color:#ffd700;"> ★ GOD MODE</span>';
  }
}
