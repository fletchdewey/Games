// === SOUND SYSTEM ===
let audioCtx = null;
let soundEnabled = false;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  soundEnabled = true;
  startAmbientFire();
  startHelicopterRotor();
}

// Startup chime (Halo-style beep beep beep boop)
function playStartupChime() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const notes = [
    { freq: 500, time: 0, dur: 0.15 },       // beep (500Hz)
    { freq: 500, time: 0.3, dur: 0.15 },     // beep
    { freq: 500, time: 0.6, dur: 0.15 },     // beep
    { freq: 720, time: 0.95, dur: 0.45 },    // boop (720Hz)
  ];
  for (const n of notes) {
    // Main tone
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = n.freq;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, t + n.time);
    gain.gain.linearRampToValueAtTime(0.2, t + n.time + 0.01);
    gain.gain.setValueAtTime(0.2, t + n.time + n.dur * 0.7);
    gain.gain.linearRampToValueAtTime(0, t + n.time + n.dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t + n.time);
    osc.stop(t + n.time + n.dur + 0.01);

    // Harmonic layer (octave above, quiet — adds warmth)
    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = n.freq * 2;
    const gain2 = audioCtx.createGain();
    gain2.gain.setValueAtTime(0, t + n.time);
    gain2.gain.linearRampToValueAtTime(0.04, t + n.time + 0.01);
    gain2.gain.setValueAtTime(0.04, t + n.time + n.dur * 0.5);
    gain2.gain.linearRampToValueAtTime(0, t + n.time + n.dur);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(t + n.time);
    osc2.stop(t + n.time + n.dur + 0.01);

    // Sub tone on the boop only (adds weight)
    if (n.dur > 0.3) {
      const sub = audioCtx.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = n.freq / 2;
      const subGain = audioCtx.createGain();
      subGain.gain.setValueAtTime(0, t + n.time);
      subGain.gain.linearRampToValueAtTime(0.1, t + n.time + 0.02);
      subGain.gain.setValueAtTime(0.1, t + n.time + n.dur * 0.6);
      subGain.gain.linearRampToValueAtTime(0, t + n.time + n.dur);
      sub.connect(subGain);
      subGain.connect(audioCtx.destination);
      sub.start(t + n.time);
      sub.stop(t + n.time + n.dur + 0.01);
    }
  }
}

// Master volume
function masterGain(vol) {
  const g = audioCtx.createGain();
  g.gain.value = vol;
  g.connect(audioCtx.destination);
  return g;
}

// === SOUND CONFIG (editable via mixer) ===
const soundCfg = {
  'player-rifle': { filterFreq: 1800, filterQ: 0.8, bassFreq: 120, bassVol: 0.3, noiseVol: 0.2, duration: 0.18 },
  'marine-rifle': { filterFreq: 2200, filterQ: 1, bassFreq: 100, bassVol: 0.15, noiseVol: 0.25, duration: 0.2 },
  'alien-weapon': { filterFreq: 900, filterQ: 0.5, bassFreq: 60, bassVol: 0.2, noiseVol: 0.05, duration: 0.3 },
  'explosion': { filterStart: 2000, filterEnd: 100, subFreq: 80, subVol: 0.8, noiseVol: 0.7, crackDensity: 0.01, crackVol: 0.5, duration: 0.4 },
  'impact': { startFreq: 550, endFreq: 80, vol: 0.1, noiseVol: 0.2, duration: 0.12, waveform: 'sawtooth' },
  'footstep': { thudFreq: 70, thudVol: 0.2, gritFreq: 800, gritVol: 0.15, gritDuration: 0.05, duration: 0.15 },
  'fire': { density: 0.06, popVol: 0.45, rumble: 0.03, filterFreq: 3000, vol: 0.15 },
  'helo': { freq: 45, thumpVol: 0.15, whooshFreq: 200, whooshVol: 0.1, interval: 60 },
};

// --- GUNSHOTS ---
function playGunshot(type) {
  if (!soundEnabled) return;
  const t = audioCtx.currentTime;
  const cfgKey = type === 'player' ? 'player-rifle' : type === 'marine' ? 'marine-rifle' : 'alien-weapon';
  const cfg = soundCfg[cfgKey];

  const bufSize = Math.round(cfg.duration * audioCtx.sampleRate);
  const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, type === 'alien' ? 0.8 : 1.2);
  }
  const noise = audioCtx.createBufferSource();
  noise.buffer = buf;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = cfg.filterFreq;
  filter.Q.value = cfg.filterQ;

  const osc = audioCtx.createOscillator();
  osc.type = type === 'alien' ? 'sawtooth' : 'sine';
  osc.frequency.setValueAtTime(cfg.bassFreq, t);
  osc.frequency.exponentialRampToValueAtTime(type === 'alien' ? 15 : 20, t + cfg.duration * 0.8);

  const oscGain = audioCtx.createGain();
  oscGain.gain.setValueAtTime(cfg.bassVol, t);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + cfg.duration);

  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(cfg.noiseVol, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + cfg.duration);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(audioCtx.destination);
  osc.connect(oscGain);
  oscGain.connect(audioCtx.destination);

  noise.start(t);
  noise.stop(t + cfg.duration + 0.01);
  osc.start(t);
  osc.stop(t + cfg.duration + 0.01);
}

// --- EXPLOSION ---
function playExplosion() {
  if (!soundEnabled) return;
  const t = audioCtx.currentTime;
  const cfg = soundCfg['explosion'];

  const buf = audioCtx.createBuffer(1, Math.round(cfg.duration * audioCtx.sampleRate), audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random()*2-1) * Math.pow(1-i/data.length, 1.5);
  const noise = audioCtx.createBufferSource();
  noise.buffer = buf;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cfg.filterStart, t);
  filter.frequency.exponentialRampToValueAtTime(cfg.filterEnd, t + cfg.duration * 0.9);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(cfg.noiseVol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + cfg.duration);

  const sub = audioCtx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(cfg.subFreq, t);
  sub.frequency.exponentialRampToValueAtTime(12, t + cfg.duration * 0.8);

  const subGain = audioCtx.createGain();
  subGain.gain.setValueAtTime(cfg.subVol, t);
  subGain.gain.exponentialRampToValueAtTime(0.001, t + cfg.duration * 0.85);

  const crackBuf = audioCtx.createBuffer(1, Math.round(cfg.duration * 0.7 * audioCtx.sampleRate), audioCtx.sampleRate);
  const crackData = crackBuf.getChannelData(0);
  for (let i = 0; i < crackData.length; i++) {
    crackData[i] = Math.random() > (1 - cfg.crackDensity) ? (Math.random()*2-1)*0.8 : (crackData[i-1]||0)*0.99;
  }
  const crackle = audioCtx.createBufferSource();
  crackle.buffer = crackBuf;
  const crackGain = audioCtx.createGain();
  crackGain.gain.setValueAtTime(cfg.crackVol, t);
  crackGain.gain.exponentialRampToValueAtTime(0.001, t + cfg.duration * 0.7);

  noise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
  sub.connect(subGain); subGain.connect(audioCtx.destination);
  crackle.connect(crackGain); crackGain.connect(audioCtx.destination);

  noise.start(t); noise.stop(t + cfg.duration + 0.01);
  sub.start(t); sub.stop(t + cfg.duration + 0.01);
  crackle.start(t); crackle.stop(t + cfg.duration * 0.7 + 0.01);
}

// --- BULLET IMPACT ---
function playImpact() {
  if (!soundEnabled) return;
  const t = audioCtx.currentTime;
  const cfg = soundCfg['impact'];

  const osc = audioCtx.createOscillator();
  osc.type = cfg.waveform;
  osc.frequency.setValueAtTime(cfg.startFreq + Math.random() * 100, t);
  osc.frequency.exponentialRampToValueAtTime(cfg.endFreq, t + cfg.duration);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(cfg.vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + cfg.duration);

  const buf = audioCtx.createBuffer(1, Math.round(cfg.duration * 0.6 * audioCtx.sampleRate), audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random()*2-1)*(1-i/data.length);
  const noise = audioCtx.createBufferSource();
  noise.buffer = buf;
  const nGain = audioCtx.createGain();
  nGain.gain.setValueAtTime(cfg.noiseVol, t);
  nGain.gain.exponentialRampToValueAtTime(0.001, t + cfg.duration * 0.5);

  osc.connect(gain); gain.connect(audioCtx.destination);
  noise.connect(nGain); nGain.connect(audioCtx.destination);
  osc.start(t); osc.stop(t + cfg.duration + 0.01);
  noise.start(t); noise.stop(t + cfg.duration * 0.6 + 0.01);
}

// --- FOOTSTEPS ---
let lastFootstepTime = 0;
function playFootstep() {
  if (!soundEnabled) return;
  const now = Date.now();
  if (now - lastFootstepTime < 280) return;
  lastFootstepTime = now;
  const t = audioCtx.currentTime;
  const cfg = soundCfg['footstep'];

  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(cfg.thudFreq + Math.random() * 20, t);
  osc.frequency.exponentialRampToValueAtTime(20, t + cfg.duration);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(cfg.thudVol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + cfg.duration);

  const buf = audioCtx.createBuffer(1, Math.round(cfg.gritDuration * audioCtx.sampleRate), audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random()*2-1)*(1-i/data.length)*0.3;
  const noise = audioCtx.createBufferSource();
  noise.buffer = buf;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = cfg.gritFreq;
  const nGain = audioCtx.createGain();
  nGain.gain.setValueAtTime(cfg.gritVol, t);
  nGain.gain.exponentialRampToValueAtTime(0.001, t + cfg.gritDuration);

  osc.connect(gain); gain.connect(audioCtx.destination);
  noise.connect(filter); filter.connect(nGain); nGain.connect(audioCtx.destination);
  osc.start(t); osc.stop(t + cfg.duration + 0.01);
  noise.start(t); noise.stop(t + cfg.gritDuration + 0.01);
}

// --- AMBIENT FIRE CRACKLE ---
let fireNoiseSource = null;
function startAmbientFire() {
  if (!audioCtx) return;
  const cfg = soundCfg['fire'];

  const bufLen = audioCtx.sampleRate * 2;
  const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    if (Math.random() > (1 - cfg.density)) data[i] = (Math.random()*2-1) * cfg.popVol;
    else data[i] = (Math.random()*2-1) * 0.02 + Math.sin(i*0.003) * cfg.rumble;
  }

  fireNoiseSource = audioCtx.createBufferSource();
  fireNoiseSource.buffer = buf;
  fireNoiseSource.loop = true;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = cfg.filterFreq;
  filter.Q.value = 0.3;

  const lfo = audioCtx.createOscillator();
  lfo.frequency.value = 0.5;
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 0.02;
  lfo.connect(lfoGain);

  const gain = audioCtx.createGain();
  gain.gain.value = cfg.vol;
  lfoGain.connect(gain.gain);

  fireNoiseSource.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  lfo.start();
  fireNoiseSource.start();
}

// --- HELICOPTER ROTOR ---
let heloInterval = null;
function startHelicopterRotor() {
  if (!audioCtx) return;
  const cfg = soundCfg['helo'];

  function rotorThump() {
    if (!soundEnabled) return;
    const t = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(cfg.freq, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.06);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(cfg.thumpVol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    const buf = audioCtx.createBuffer(1, 1200, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < 1200; i++) data[i] = (Math.random()*2-1)*(1-i/1200);
    const whoosh = audioCtx.createBufferSource();
    whoosh.buffer = buf;
    const wFilter = audioCtx.createBiquadFilter();
    wFilter.type = 'bandpass';
    wFilter.frequency.value = cfg.whooshFreq;
    wFilter.Q.value = 1;
    const wGain = audioCtx.createGain();
    wGain.gain.setValueAtTime(cfg.whooshVol, t);
    wGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain); gain.connect(audioCtx.destination);
    whoosh.connect(wFilter); wFilter.connect(wGain); wGain.connect(audioCtx.destination);
    osc.start(t); osc.stop(t + 0.08);
    whoosh.start(t); whoosh.stop(t + 0.06);
  }

  heloInterval = setInterval(rotorThump, cfg.interval);
}

function stopAmbientSounds() {
  if (fireNoiseSource) { try { fireNoiseSource.stop(); } catch(e){} fireNoiseSource = null; }
  if (heloInterval) { clearInterval(heloInterval); heloInterval = null; }
}
// === END SOUND SYSTEM ===
