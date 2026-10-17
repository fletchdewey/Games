import { useState, useEffect, useRef } from "react";
import * as THREE from "three";

// WATCHER WORKSHOP
//
// A tuning bench for the one alien, rather than a display card. The point is
// to settle the numbers HERE — with the camera in your hands and the attack
// cycle scrubbable — and only then bake them into src/aliens/watcher.js.
//
// Everything on the right panel maps to a real constant. The readout at the
// bottom prints them in the shape they'll take in the game file.
//
// Note: buildWatcher lives here now, not in spire_candidates.jsx. The loader
// transpiles one entry file, so cross-importing another .jsx wouldn't resolve
// in the browser. This copy is the canonical one — the candidates page was a
// chooser and can be retired.

const PAL = {
  bone: 0xc8b8a0, armor: 0x2a2a38, armorLt: 0x3a3a4a,
  mech: 0x4a5058, glowCyan: 0x44ccff, eye: 0xff2222,
};

const M = (c) => new THREE.MeshLambertMaterial({ color: c });
const G = (c) => new THREE.MeshBasicMaterial({ color: c });

function spike(mat, r, len, seg = 4) {
  const geo = new THREE.ConeGeometry(r, len, seg);
  geo.translate(0, len / 2, 0);
  return new THREE.Mesh(geo, mat);
}

function legChain({ upperLen, lowerLen, upperR, lowerR, mat, boneMat,
                    upperTilt = 0, lowerTilt = 0, lowerSplay = 0, footSize = 0 }) {
  const hip = new THREE.Group();
  const ug = new THREE.CylinderGeometry(upperR, upperR * 0.8, upperLen, 5);
  ug.translate(0, -upperLen / 2, 0);
  const upper = new THREE.Mesh(ug, mat);
  upper.rotation.x = upperTilt;
  hip.add(upper);

  const knee = new THREE.Group();
  knee.position.y = -upperLen;
  upper.add(knee);
  knee.add(new THREE.Mesh(new THREE.SphereGeometry(upperR * 1.15, 5, 4), mat));

  const lg = new THREE.CylinderGeometry(upperR * 0.8, lowerR, lowerLen, 5);
  lg.translate(0, -lowerLen / 2, 0);
  const lower = new THREE.Mesh(lg, mat);
  lower.rotation.x = lowerTilt;
  lower.rotation.z = lowerSplay;
  knee.add(lower);

  const foot = new THREE.Group();
  foot.position.y = -lowerLen;
  lower.add(foot);
  if (footSize) {
    const f = spike(boneMat, footSize, footSize * 3);
    f.rotation.x = 2.2;
    foot.add(f);
  }
  return { hip, upper, knee, lower, foot };
}


// ─── THE MODEL ──────────────────────────────────────────────
// Parameterised so the panel can drive the structural numbers. Anything the
// sliders change without a rebuild is handled in the animation instead.
export function buildWatcher(P) {
  const g = new THREE.Group();
  const mech = M(PAL.mech), ar = M(PAL.armor), arLt = M(PAL.armorLt), gl = G(PAL.glowCyan);
  // Separate instance: the eye flashes and dies on its own, the hull vents don't.
  const eyeGlow = G(PAL.glowCyan);
  const R = P.eyeRadius;
  const hubY = P.hubHeight;
  const eyeY = hubY - 0.28;

  // Everything that collapses on death lives under `body`. The eyeball shards
  // stay parented to the root, so when the body sinks they stay on the floor
  // instead of being dragged underneath it.
  const body = new THREE.Group();
  g.add(body);

  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.32, 7, 5), ar);
  hub.scale.set(1.25, 0.62, 1.25);
  hub.position.y = hubY;
  body.add(hub);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 0.2, 7), arLt);
  collar.position.y = hubY - 0.14;
  body.add(collar);

  // Heat vents — flare with charge.
  const vents = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.16), arLt);
    slot.position.set(Math.cos(a) * 0.33, hubY + 0.02, Math.sin(a) * 0.33);
    slot.rotation.y = -a;
    body.add(slot);
    const lit = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.1), gl);
    lit.position.set(Math.cos(a) * 0.36, hubY + 0.02, Math.sin(a) * 0.36);
    lit.rotation.y = -a;
    body.add(lit);
    vents.push(lit);
  }

  const eyePivot = new THREE.Group();
  eyePivot.position.set(0, eyeY, 0);
  body.add(eyePivot);

  const ball = new THREE.Mesh(new THREE.SphereGeometry(R, 9, 8), M(0xd8d0c0));
  eyePivot.add(ball);

  const irisOuter = new THREE.Mesh(new THREE.TorusGeometry(R * 0.58, R * 0.13, 4, 12), eyeGlow);
  irisOuter.position.z = R * 0.74;
  eyePivot.add(irisOuter);
  const irisInner = new THREE.Mesh(new THREE.TorusGeometry(R * 0.34, R * 0.1, 4, 10), eyeGlow);
  irisInner.position.z = R * 0.87;
  eyePivot.add(irisInner);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(R * 0.45, 7, 7), eyeGlow);
  lens.position.z = R * 0.68;
  lens.scale.set(1, 1, 0.45);
  eyePivot.add(lens);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(R * 0.22, 6, 6), G(0x001018));
  pupil.position.z = R * 0.95;
  pupil.scale.set(1, 1, 0.4);
  eyePivot.add(pupil);

  const brow = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.16, 9, 5, 0, Math.PI * 2, 0, 1.0), ar);
  brow.position.y = 0.02;
  eyePivot.add(brow);

  // Shutter petals. Outer group picks the radial slot, inner group swings.
  const shutters = [];
  for (let i = 0; i < P.shutterCount; i++) {
    const outer = new THREE.Group();
    outer.rotation.z = (i / P.shutterCount) * Math.PI * 2;
    eyePivot.add(outer);
    const inner = new THREE.Group();
    outer.add(inner);
    inner.add(new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.18, 8, 4, 0, Math.PI * 2, 0,
        // Fewer petals have to be wider to still seal the lens.
        0.52 + 0.9 / P.shutterCount), arLt));
    inner.rotation.x = Math.PI / 2 - SHUT_CLOSED;   // born sealed
    shutters.push(inner);
  }

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 4), mech);
    cable.position.set(Math.cos(a) * 0.23, hubY - 0.12, Math.sin(a) * 0.23);
    cable.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
    body.add(cable);
  }

  // The beam: built ONCE, never rebuilt. Aimed with a rotation, ranged with
  // scale.y. This is the whole reason a sustained beam is cheap.
  const beamGeo = new THREE.CylinderGeometry(0.045, 0.1, 1, 6, 1, true);
  beamGeo.translate(0, 0.5, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
    color: 0x88eeff, transparent: true, opacity: 0.75, side: THREE.DoubleSide,
  }));
  beam.rotation.x = Math.PI * 0.5;
  beam.position.z = R * 0.8;
  beam.visible = false;
  eyePivot.add(beam);

  const flare = new THREE.Mesh(new THREE.SphereGeometry(R * 0.52, 6, 6), G(0xaaf4ff));
  flare.position.z = R * 1.05;
  flare.visible = false;
  eyePivot.add(flare);
  const impact = new THREE.Mesh(new THREE.SphereGeometry(R * 0.45, 6, 6), G(0xaaf4ff));
  impact.visible = false;
  eyePivot.add(impact);

  // Each leg hangs off a stepPivot that carries NO radial rotation. The hip
  // inside it is turned to face outward (so the splay goes the right way), but
  // the stride is driven on the stepPivot, whose X axis is the MODEL's X axis
  // — identical for all three legs. That is what makes them step along the way
  // it's facing instead of each paddling outward on its own radius.
  const legs = [];
  const legBaseY = hubY - 0.02;
  for (let i = 0; i < 3; i++) {
    // Offset by 30 deg so the three legs land at front-right, front-left and
    // dead astern. On the un-offset 0/120/240 ring one leg sits in the
    // front-left quadrant and its thigh hangs straight across the eye.
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const leg = legChain({
      upperLen: P.legLength * 0.47, lowerLen: P.legLength * 0.53,
      upperR: 0.055, lowerR: 0.03, mat: mech, boneMat: ar,
      upperTilt: 0, lowerTilt: 0.1, lowerSplay: -1.0, footSize: 0.05,
    });
    // Hips must sit OUTSIDE the hub (radius 0.40) or the thighs emerge through
    // the dome and read as climbing over its head, and the knees swing across
    // the eyeball. A visible mount nub carries each one out to the rim.
    const stepPivot = new THREE.Group();
    stepPivot.position.set(Math.cos(a) * LEG_MOUNT_R, legBaseY, Math.sin(a) * LEG_MOUNT_R);
    leg.hip.position.set(0, 0, 0);
    leg.hip.rotation.y = -a;
    leg.hip.rotation.z = 1.0;
    stepPivot.add(leg.hip);
    body.add(stepPivot);

    // Shoulder mount, bridging the hub out to the hip so the leg attaches to
    // something instead of floating beside the dome.
    const mount = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), arLt);
    mount.position.set(Math.cos(a) * LEG_MOUNT_R, legBaseY, Math.sin(a) * LEG_MOUNT_R);
    body.add(mount);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, LEG_MOUNT_R - 0.18, 5), ar);
    arm.position.set(Math.cos(a) * (LEG_MOUNT_R - 0.09) * 0.55, legBaseY + 0.02,
                     Math.sin(a) * (LEG_MOUNT_R - 0.09) * 0.55);
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = -a;
    body.add(arm);
    legs.push({ ...leg, stepPivot, angle: a, baseY: legBaseY,
                baseSplay: 1.0, baseUpperTilt: 0, baseLowerTilt: 0.1 });
  }

  // ── Eyeball shards, for the burst. Built once and parked; the death
  // animation places them from a closed-form trajectory so scrubbing works.
  const shards = [];
  for (let i = 0; i < 14; i++) {
    const sh = new THREE.Mesh(
      new THREE.TetrahedronGeometry(R * (0.14 + (i % 3) * 0.05)),
      i % 4 === 0 ? gl : M(0xb8ae9e));
    sh.visible = false;
    // Deterministic spread — golden angle so they don't clump.
    const th = i * 2.399963, y = 1 - (i / 13) * 1.7;
    const rr = Math.sqrt(Math.max(0, 1 - y * y));
    sh.userData.dir = new THREE.Vector3(Math.cos(th) * rr, y * 0.8 + 0.5, Math.sin(th) * rr)
      .normalize();
    sh.userData.speed = 0.8 + (i % 5) * 0.22;
    sh.userData.spin = new THREE.Vector3(i * 0.7 % 3, i * 1.3 % 3, i * 0.4 % 3);
    g.add(sh);
    shards.push(sh);
  }

  // Hit zones. The lids are armour (two shots); the eye behind them is the
  // weak point (one shot). Because the lids only open to fire, the one-shot
  // window exists exactly while it is dangerous.
  for (const m of [ball, lens, pupil, irisOuter, irisInner]) m.userData.hitPart = 'eye';
  for (const s2 of shutters) s2.traverse((o) => { if (o.isMesh) o.userData.hitPart = 'lid'; });
  g.traverse((o) => { if (o.isMesh && !o.userData.hitPart) o.userData.hitPart = 'armor'; });

  // Every material this model owns, for the fade-out at the end of death.
  const mats = [];
  g.traverse((o) => { if (o.isMesh && !mats.includes(o.material)) mats.push(o.material); });

  g.userData = { legs, eyePivot, lens, pupil, irisOuter, irisInner, ball,
                 shutters, vents, beam, flare, impact, hub, shards, mats,
                 body, eyeLocalY: eyeY };
  return g;
}


// ─── THE ATTACK CYCLE ───────────────────────────────────────
// Returns which phase it's in, so the UI can show it and the eventual AI can
// mirror the same structure as a state machine.
const PHASES = ["scan", "open", "charge", "fire", "seal"];

// Each mode is its own loop so you can sit in one and study it.
export const MODES = {
  attack: { label: "Attack cycle", dur: (P) =>
    P.scanTime + P.openTime + P.chargeTime + P.fireTime + P.sealTime },
  walk:   { label: "Walk",  dur: () => 2.0 },
  alert:  { label: "Alert", dur: () => 1.6 },
  hurt:   { label: "Hurt",  dur: () => 1.8 },
  death:  { label: "Death", dur: () => DEATH_DUR, hold: true },
};

function phaseAt(p, P) {
  const total = MODES.attack.dur(P);
  let t = p * total;
  const durs = [P.scanTime, P.openTime, P.chargeTime, P.fireTime, P.sealTime];
  for (let i = 0; i < durs.length; i++) {
    if (t < durs[i]) return { phase: PHASES[i], f: durs[i] > 0 ? t / durs[i] : 1 };
    t -= durs[i];
  }
  return { phase: "seal", f: 1 };
}

// A shutter petal is a sphere cap pointing along its own +Y. To seal the lens
// it has to point along +Z instead, so every petal carries a base quarter-turn
// and "opening" means swinging BACK from there. delta is the angle each petal
// sits off the forward axis: small = overlapping over the lens, large = swung
// aside. Without the quarter-turn the petals just stack on top of the eye,
// hidden under the brow, and the lens is never covered at all.
const SHUT_CLOSED = 0.3;   // rad off the forward axis when sealed

// How far out the legs mount. The hub's own radius is 0.40, so anything less
// than that buries the hip inside the dome.
const LEG_MOUNT_R = 0.50;

// Death, in seconds. The 3s on the floor before it vanishes is deliberate —
// at 1 HP this plays on every kill, so you want a beat to see the wreck.
const D_STRUCK = 0.3, D_BURST = 0.55, D_COLLAPSE = 1.3, D_HOLD = 4.3, DEATH_DUR = 4.8;

// Scale the lens WITHOUT losing its flatten — it's a disc, not a ball, and
// setScalar silently inflates it into one that engulfs the iris and pupil.
function setLens(d, k) { d.lens.scale.set(k, k, 0.45); }

function setShutters(d, open, P, jitter = 0) {
  const delta = SHUT_CLOSED + open * P.shutterOpen;
  d.shutters.forEach((s, i) => {
    s.rotation.x = Math.PI / 2 - delta - (jitter ? Math.sin(jitter + i) * 0.02 : 0);
  });
}

// Put every driven channel back to neutral. Without this, switching out of
// Death leaves the legs buckled and the lens dark.
export function resetPose(model, P) {
  const d = model.userData;
  model.rotation.set(0, 0, 0);
  model.position.y = 0;
  d.body.position.set(0, 0, 0);
  d.body.rotation.set(0, 0, 0);
  d.eyePivot.rotation.set(0, 0, 0);
  d.eyePivot.position.set(0, P.hubHeight - 0.28, 0);
  d.legs.forEach((leg) => {
    leg.upper.rotation.x = leg.baseUpperTilt;
    leg.lower.rotation.x = leg.baseLowerTilt;
    leg.hip.rotation.z = leg.baseSplay;
    leg.lower.rotation.z = -1.0;
    leg.stepPivot.rotation.set(0, 0, 0);
    leg.stepPivot.position.y = leg.baseY;
  });
  d.shards.forEach((sh) => { sh.visible = false; });
  [d.ball, d.lens, d.pupil, d.irisOuter, d.irisInner].forEach((m) => { m.visible = true; });
  d.mats.forEach((m) => { m.opacity = 1; m.transparent = m.userData.wasTransparent || false; });
  setShutters(d, 0, P);
  d.lens.material.color.setHex(PAL.glowCyan);
  d.irisOuter.material.color.setHex(PAL.glowCyan);
  d.lens.scale.set(1, 1, 0.45);
  d.beam.visible = d.flare.visible = d.impact.visible = false;
  d.vents.forEach((v) => { v.scale.setScalar(1); v.material.color.setHex(PAL.glowCyan); });
  d.hub.material.color.setHex(PAL.armor);
}

// A 3-legged wave gait: one foot lifts at a time while the other two carry,
// which is what a tripod actually has to do. A 2- or 4-leg alternating cycle
// looks wrong here — there's no symmetric pair to swap with.
function tripodWalk(d, model, t) {
  d.legs.forEach((leg, i) => {
    const ph = (t + i / 3) % 1;                 // staggered thirds
    const lift = ph < 0.33 ? Math.sin((ph / 0.33) * Math.PI) : 0;
    // Foot swings forward while it's in the air, then drives back while it
    // carries. Driven on the stepPivot, so all three legs stride along the
    // model's +Z — i.e. the way it's facing — regardless of where they sit
    // around the ring.
    const stride = -Math.cos(ph * Math.PI * 2) * 0.3;
    leg.stepPivot.rotation.x = stride;
    leg.stepPivot.position.y = leg.baseY + lift * 0.14;
    leg.lower.rotation.x = leg.baseLowerTilt + lift * 0.3;
  });
  // Body lurches toward whichever pair is carrying — the tripod tell.
  const a = t * Math.PI * 2;
  model.position.y = Math.sin(a * 3) * 0.045;
  model.rotation.z = Math.cos(a) * 0.05;
  model.rotation.x = Math.sin(a) * 0.03;
}

/**
 * @param mode   key of MODES
 * @param t      0..1 progress through that mode's loop
 * @param target world-space point to look at / shoot at, or null
 * @returns the sub-phase label, for the UI
 */
export function animateWatcher(model, time, t, P, mode, target) {
  const d = model.userData;

  // ── DEATH ──  The one you'll see most: at 1 HP every kill plays this.
  // Lids fly open, the eyeball bursts, the legs give out, and the wreck lies
  // there for three seconds before it goes.
  if (mode === "death") {
    const sec = t * DEATH_DUR;
    const eyeParts = [d.ball, d.lens, d.pupil, d.irisOuter, d.irisInner];

    d.beam.visible = d.flare.visible = d.impact.visible = false;

    if (sec < D_STRUCK) {
      // 1. Hit registers: lids snap wide, the lens goes white and swells.
      const f = sec / D_STRUCK;
      setShutters(d, f * 1.35, P);
      d.lens.material.color.setRGB(1, 1, 1);
      setLens(d, 1 + f * 1.1);
      d.eyePivot.rotation.x = -f * 0.4;
      return "struck";
    }

    // 2. BURST. The eyeball hands off to the shards — and not a moment before,
    // or it blinks out of existence with nothing there yet.
    const bt = sec - D_BURST;                 // seconds since the burst
    eyeParts.forEach((m) => { m.visible = bt < 0; });
    const drop = d.eyeLocalY - 0.06;                  // fall height to the floor
    d.shards.forEach((sh) => {
      if (bt < 0) { sh.visible = false; return; }
      sh.visible = true;
      const u = sh.userData;
      // Closed-form trajectory, so scrubbing the timeline stays correct.
      // Each shard FREEZES at its own landing time — solve 3.2t^2 - vy*t - drop
      // for t and clamp there, or it keeps sliding outward for the whole
      // three-second hold and ends up metres from the wreck.
      const vy = u.dir.y * u.speed;
      const land = (vy + Math.sqrt(vy * vy + 12.8 * drop)) / 6.4;
      const te = Math.min(bt, land);
      sh.position.set(
        u.dir.x * u.speed * te,
        d.eyeLocalY + vy * te - 3.2 * te * te,
        u.dir.z * u.speed * te);
      const spin = Math.min(te, land);
      sh.rotation.set(u.spin.x * spin * 4, u.spin.y * spin * 4, u.spin.z * spin * 4);
    });

    if (sec < D_BURST) {
      const f = (sec - D_STRUCK) / (D_BURST - D_STRUCK);
      setShutters(d, 1.35 - f * 0.2, P);
      return "burst";
    }

    // 3. Legs give out — they splay flat and the hub sinks onto the floor.
    const c = Math.min(1, (sec - D_BURST) / (D_COLLAPSE - D_BURST));
    const e = 1 - Math.pow(1 - c, 2.2);        // drops fast, settles slow
    d.legs.forEach((leg, i) => {
      // Splay to roughly horizontal and no further — past ~90 deg the thigh
      // swings back UP and the corpse looks like it's reaching, not collapsed.
      leg.hip.rotation.z = leg.baseSplay + e * (0.55 + i * 0.07);
      // Straighten the shin out of its standing crouch so the leg lies flat.
      leg.lower.rotation.z = -1.0 * (1 - e * 0.85);
      leg.lower.rotation.x = leg.baseLowerTilt + e * (0.5 + i * 0.1);
      leg.stepPivot.rotation.x = e * (0.22 - i * 0.18);
      leg.stepPivot.position.y = leg.baseY;
    });
    d.body.position.y = -e * (P.hubHeight - 0.42);
    d.body.rotation.z = e * 0.2;
    d.body.rotation.x = e * 0.1;
    setShutters(d, 1.15 - e * 1.15, P);        // lids sag shut over the socket
    d.vents.forEach((v) => v.scale.setScalar(1 - e));

    if (sec < D_COLLAPSE) return "collapsing";

    // 4. Lie there. Then fade out and go.
    if (sec < D_HOLD) return "wreck";
    const f = Math.min(1, (sec - D_HOLD) / (DEATH_DUR - D_HOLD));
    d.mats.forEach((m) => {
      if (m.userData.wasTransparent === undefined) m.userData.wasTransparent = m.transparent;
      m.transparent = true;
      m.opacity = 1 - f;
    });
    return f >= 1 ? "gone" : "fading";
  }

  // ── HURT ──  Lids fly open for a beat, then clamp shut again.
  // Two of these kills it, so this is the "that one landed" tell.
  if (mode === "hurt") {
    const openFor = 1.0 / MODES.hurt.dur();     // ~1s of the 1.8s loop
    const lid = t < 0.12 ? t / 0.12                      // snap open
              : t < openFor ? 1                          // hold open, exposed
              : Math.max(0, 1 - (t - openFor) / 0.25);   // clamp shut
    setShutters(d, lid, P);
    const f = Math.sin(Math.min(1, t / 0.3) * Math.PI);
    d.lens.material.color.setRGB(1, 0.45 + 0.55 * (1 - f), 0.45 + 0.55 * (1 - f));
    setLens(d, 1 + f * 0.35);
    model.position.y = Math.sin(t * Math.PI * 7) * 0.05 * (1 - t);
    model.rotation.z = Math.sin(t * Math.PI * 6) * 0.06 * (1 - t);
    d.legs.forEach((leg) => {
      leg.stepPivot.rotation.x = f * 0.1;
      leg.lower.rotation.x = leg.baseLowerTilt - f * 0.15;
    });
    return t < openFor ? "exposed" : "sealing";
  }

  // ── WALK ──
  if (mode === "walk") {
    tripodWalk(d, model, t);
    model.rotation.y = P.walkHeading;        // legs stride along this
    setShutters(d, 0, P);
    d.eyePivot.rotation.y = Math.sin(time * 0.9) * P.scanSweep * 0.5;
    d.beam.visible = d.flare.visible = d.impact.visible = false;
    return "walking";
  }

  // ── ALERT ──  The beat where it notices you. Cheap, and it sells a lot.
  if (mode === "alert") {
    const f = Math.min(1, t / 0.35);
    if (target) d.eyePivot.lookAt(target);
    // Lids draw fully back — this is the reveal, and it's also the moment the
    // one-shot weak point becomes available.
    setShutters(d, f * (1 + Math.sin(time * 22) * 0.04), P);
    setLens(d, 1 + f * 0.25);
    d.vents.forEach((v) => v.scale.setScalar(1 + f * 0.8));
    d.legs.forEach((leg) => {
      leg.upper.rotation.x = leg.baseUpperTilt - f * 0.14;    // tenses, crouches
      leg.lower.rotation.x = leg.baseLowerTilt + f * 0.1;
    });
    model.position.y = -f * 0.06;
    d.beam.visible = d.flare.visible = d.impact.visible = false;
    return "alert";
  }

  // ── ATTACK CYCLE ──
  const { phase, f } = phaseAt(t, P);
  d.legs.forEach((leg, i) => {
    const c = Math.sin(time * 1.8 + (i / 3) * Math.PI * 2);
    leg.upper.rotation.x = leg.baseUpperTilt + c * 0.1;
    leg.lower.rotation.x = leg.baseLowerTilt - Math.abs(c) * 0.06;
  });
  model.position.y = Math.sin(time * 1.1) * 0.03;

  // Range gate: it simply won't fire at something beyond its reach.
  // Measured on the ground plane, the way the other aliens' AI does it
  // (they all zero out y first) — otherwise the aim point being at chest
  // height makes a target at exactly max range read as 12.06 and miss out.
  const flat = target ? Math.hypot(target.x, target.z) : P.beamRange;
  const range = Math.min(flat, P.beamRange);
  const inRange = !target || flat <= P.beamRange;

  let open = 0, charge = 0, firing = false;
  if (phase === "scan") {
    d.eyePivot.rotation.y = Math.sin(time * 0.9) * P.scanSweep;
    d.eyePivot.rotation.x = Math.sin(time * 0.6) * (P.scanSweep * 0.27);
  } else {
    // Once committed it holds dead still — the stillness IS the tell.
    if (target && P.trackWhileFiring) d.eyePivot.lookAt(target);
    else if (target && phase !== "fire") d.eyePivot.lookAt(target);
    else { d.eyePivot.rotation.y *= 0.85; d.eyePivot.rotation.x *= 0.85; }

    if (phase === "open") open = f;
    else if (phase === "charge") { open = 1; charge = f; }
    else if (phase === "fire") { open = 1; charge = 1; firing = inRange; }
    else { open = 1 - f; }
  }

  setShutters(d, open, P, firing ? time * 40 : 0);

  const heat = charge * (0.7 + Math.sin(time * 18) * 0.3);
  d.lens.scale.set(1 + heat * 0.3, 1 + heat * 0.3, 0.45);
  d.irisOuter.rotation.z = time * (1 + charge * P.spinRate);
  d.irisInner.rotation.z = -time * (1.4 + charge * P.spinRate * 1.3);
  d.irisInner.scale.setScalar(1 - charge * 0.3);
  d.vents.forEach((v, i) =>
    v.scale.setScalar(1 + charge * 1.6 + Math.sin(time * 6 + i) * 0.15));

  d.beam.visible = firing;
  d.flare.visible = firing;
  d.impact.visible = firing;
  // Collapse the beam when idle. Hiding it is NOT enough: Box3 counts
  // invisible meshes, so a stretched-but-hidden 12-unit beam would blow out
  // any bounds-based camera framing long after the shot ended.
  if (!firing) { d.beam.scale.set(1, 0.001, 1); d.impact.position.z = 0; }
  if (firing) {
    const j = 1 + Math.sin(time * 50) * P.beamJitter;
    const len = Math.max(0.2, range - P.eyeRadius * 0.8);
    d.beam.scale.set(j * (P.beamRadius / 0.1), len, j * (P.beamRadius / 0.1));
    d.flare.scale.setScalar(0.9 + Math.sin(time * 45) * 0.25);
    d.impact.position.z = P.eyeRadius * 0.8 + len;
    d.impact.scale.setScalar(1.1 + Math.sin(time * 38) * 0.35);
  }
  return phase === "fire" && !inRange ? "out of range" : phase;
}


// ─── PARAMETERS ─────────────────────────────────────────────
// `rebuild: true` means changing it reconstructs the model.
export const PARAMS = [
  { k: "scanTime",    label: "Scan / idle",      min: 0.5, max: 6, step: 0.1, unit: "s" },
  { k: "openTime",    label: "Shutters open",    min: 0.1, max: 2, step: 0.05, unit: "s" },
  { k: "chargeTime",  label: "Charge",           min: 0.1, max: 3, step: 0.05, unit: "s" },
  { k: "fireTime",    label: "Beam duration",    min: 0.1, max: 3, step: 0.05, unit: "s" },
  { k: "sealTime",    label: "Shutters seal",    min: 0.1, max: 2, step: 0.05, unit: "s" },
  { k: "beamRange",   label: "Beam range",       min: 2,   max: 16, step: 0.5, unit: "u" },
  { k: "beamRadius",  label: "Beam thickness",   min: 0.02, max: 0.3, step: 0.01, unit: "" },
  { k: "beamJitter",  label: "Beam jitter",      min: 0,   max: 0.3, step: 0.01, unit: "" },
  { k: "shutterOpen", label: "Shutter travel",   min: 0.4, max: 2.0, step: 0.05, unit: "rad" },
  { k: "spinRate",    label: "Iris spin-up",     min: 0,   max: 20, step: 0.5, unit: "" },
  { k: "scanSweep",   label: "Scan sweep",       min: 0,   max: 1.6, step: 0.05, unit: "rad" },
  { k: "walkHeading", label: "Walk heading",     min: -3.1, max: 3.1, step: 0.05, unit: "rad" },
  { k: "targetDist",  label: "Target distance",  min: 1.5, max: 18, step: 0.5, unit: "u" },
  { k: "targetAngle", label: "Target bearing",   min: -3.1, max: 3.1, step: 0.05, unit: "rad" },
  { k: "eyeRadius",   label: "Eye size",         min: 0.2, max: 0.7, step: 0.01, unit: "", rebuild: true },
  { k: "hubHeight",   label: "Hub height",       min: 0.8, max: 2.6, step: 0.05, unit: "u", rebuild: true },
  { k: "legLength",   label: "Leg length",       min: 0.8, max: 3.0, step: 0.05, unit: "u", rebuild: true },
  { k: "shutterCount", label: "Shutter petals",  min: 2,   max: 6, step: 1, unit: "", rebuild: true },
];

export const DEFAULTS = {
  scanTime: 2.5, openTime: 0.9, chargeTime: 0.8, fireTime: 0.45, sealTime: 0.35,
  beamRange: 12, beamRadius: 0.1, beamJitter: 0.06, shutterOpen: 1.15,
  spinRate: 7, scanSweep: 0.75, targetDist: 7, targetAngle: 0, walkHeading: 0,
  eyeRadius: 0.38, hubHeight: 1.54, legLength: 1.8, shutterCount: 4,
  trackWhileFiring: false,
};

// Level constraints, so the panel can warn instead of you finding out in-game.
const DOOR_W = 2.5, DOOR_H = 3.0, CEILING = 4.0;


function Stage({ paramsRef, buildKey, onStats, onPhase, paused, scrub, modeRef, onError }) {
  const mountRef = useRef(null);
  const stateRef = useRef({ az: 0.6, el: 0.25, dist: 5.2, drag: null, t: 0, cycle: 0 });

  useEffect(() => {
    try {
    const mount = mountRef.current;
    const w = mount.clientWidth, h = mount.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);

    scene.add(new THREE.AmbientLight(0x334455, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 0.95);
    key.position.set(3, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x445566, 0.35);
    fill.position.set(-2, 1, -2);
    scene.add(fill);

    // Floor grid + a doorway outline for scale reference.
    const grid = new THREE.GridHelper(8, 16, 0x2a2a3a, 0x1a1a26);
    scene.add(grid);
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(DOOR_W, DOOR_H, 0.08)),
      new THREE.LineBasicMaterial({ color: 0x335544 }));
    frame.position.set(0, DOOR_H / 2, -1.8);
    scene.add(frame);

    // Stand-in for the player, so you can watch the eye track and see the
    // beam actually terminate on something at a real distance.
    const target = new THREE.Group();
    // Cylinder, not CapsuleGeometry — capsules didn't land in three until
    // well after r128, which is the build this project pins.
    const dummy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 1.7, 8),
      new THREE.MeshLambertMaterial({ color: 0x44ff88, transparent: true, opacity: 0.45 }));
    dummy.position.y = 0.85;
    target.add(dummy);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.46, 20),
      new THREE.MeshBasicMaterial({ color: 0x44ff88, transparent: true, opacity: 0.5 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    target.add(ring);
    scene.add(target);

    let model = null;
    const dispose = (m) => m && m.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });

    const rebuild = () => {
      if (model) { scene.remove(model); dispose(model); }
      model = buildWatcher(paramsRef.current);
      scene.add(model);

      let meshes = 0, tris = 0;
      model.traverse((o) => {
        if (!o.isMesh) return;
        meshes++;
        const i = o.geometry.index;
        tris += (i ? i.count : o.geometry.attributes.position.count) / 3;
      });
      const b = new THREE.Box3().setFromObject(model);
      onStats({
        meshes, tris,
        w: b.max.x - b.min.x, h: b.max.y - b.min.y, d: b.max.z - b.min.z,
      });
    };
    rebuild();
    stateRef.current.rebuild = rebuild;

    // --- Orbit: drag to turn, wheel to zoom. (OrbitControls is an addon and
    // isn't in the core r128 build this project loads from the CDN.)
    const st = stateRef.current;
    const down = (e) => { st.drag = { x: e.clientX, y: e.clientY }; };
    const move = (e) => {
      if (!st.drag) return;
      st.az -= (e.clientX - st.drag.x) * 0.008;
      st.el = Math.max(-0.6, Math.min(1.3, st.el + (e.clientY - st.drag.y) * 0.006));
      st.drag = { x: e.clientX, y: e.clientY };
    };
    const up = () => { st.drag = null; };
    const wheel = (e) => {
      e.preventDefault();
      st.dist = Math.max(1.5, Math.min(16, st.dist + e.deltaY * 0.004));
    };
    renderer.domElement.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("wheel", wheel, { passive: false });

    let raf;
    let lastPhase = "", lastMode = "attack";
    const tgtVec = new THREE.Vector3();
    const loop = () => {
      const P = paramsRef.current;
      const mode = modeRef.current;
      st.t += 0.016;

      if (mode !== lastMode) {          // clean slate between modes
        resetPose(model, P);
        lastMode = mode;
        st.cycle = 0;
        scrub.current = 0;
      }

      const total = MODES[mode].dur(P);
      if (!paused.current) {
        const next = st.cycle + 0.016 / total;
        // Death plays once and holds, rather than looping the corpse.
        st.cycle = MODES[mode].hold ? Math.min(1, next) : next % 1;
        scrub.current = st.cycle;
      } else {
        st.cycle = scrub.current;
      }

      // Target sits on the floor at the chosen bearing and distance.
      target.position.set(
        Math.sin(P.targetAngle) * P.targetDist, 0, Math.cos(P.targetAngle) * P.targetDist);
      target.visible = mode === "attack" || mode === "alert";
      // Aim point is chest height, expressed relative to the eye.
      tgtVec.set(target.position.x, 1.2, target.position.z);

      const ph = animateWatcher(model, st.t, st.cycle, P, mode, tgtVec);
      if (ph !== lastPhase) { lastPhase = ph; onPhase(ph); }

      const focus = P.hubHeight - 0.2;
      camera.position.set(
        Math.sin(st.az) * Math.cos(st.el) * st.dist,
        focus + Math.sin(st.el) * st.dist,
        Math.cos(st.az) * Math.cos(st.el) * st.dist);
      camera.lookAt(0, focus, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    const onResize = () => {
      const nw = mount.clientWidth, nh = mount.clientHeight;
      renderer.setSize(nw, nh);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("wheel", wheel);
      dispose(model);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    } catch (err) {
      // A throw inside this effect leaves a blank black panel with nothing to
      // go on. Surface it on the page instead — the console isn't always open.
      onError(err && (err.stack || err.message) || String(err));
    }
  }, []);

  // Structural changes rebuild the model in place — the renderer keeps running.
  useEffect(() => { stateRef.current.rebuild && stateRef.current.rebuild(); }, [buildKey]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%", cursor: "grab" }} />;
}


function Slider({ spec, value, onChange }) {
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11,
                    color: "#8a8aa0", marginBottom: 3 }}>
        <span>{spec.label}{spec.rebuild &&
          <span style={{ color: "#5a6a7a" }}> ·rebuild</span>}</span>
        <span style={{ color: "#44ccff", fontVariantNumeric: "tabular-nums" }}>
          {value}{spec.unit}
        </span>
      </div>
      <input type="range" min={spec.min} max={spec.max} step={spec.step} value={value}
        onChange={(e) => onChange(spec.k, parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "#44ccff", height: 3 }} />
    </div>
  );
}


export default function WatcherWorkshop() {
  const [params, setParams] = useState(DEFAULTS);
  const [stats, setStats] = useState(null);
  const [phase, setPhase] = useState("scan");
  const [isPaused, setIsPaused] = useState(false);
  const [scrubVal, setScrubVal] = useState(0);

  const [mode, setMode] = useState("attack");
  const [stageError, setStageError] = useState(null);
  const paramsRef = useRef(params);
  const paused = useRef(false);
  const scrub = useRef(0);
  const modeRef = useRef("attack");
  const [buildKey, setBuildKey] = useState(0);

  paramsRef.current = params;
  paused.current = isPaused;
  modeRef.current = mode;

  const set = (k, v) => {
    setParams((p) => ({ ...p, [k]: v }));
    const spec = PARAMS.find((s) => s.k === k);
    if (spec.rebuild) setBuildKey((n) => n + 1);
  };

  const total = PARAMS.slice(0, 5).reduce((s, p) => s + params[p.k], 0);
  const fitsDoor = stats && stats.w <= DOOR_W && stats.h <= DOOR_H;

  const panel = { background: "rgba(255,255,255,0.025)", border: "1px solid #1e1e2c",
                  borderRadius: 8, padding: "12px 14px", marginBottom: 12 };
  const h3 = { fontSize: 10, letterSpacing: 2, textTransform: "uppercase",
               color: "#667", margin: "0 0 10px" };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a12", color: "#e8e8f0",
                  fontFamily: "ui-sans-serif, system-ui, sans-serif", padding: "20px 22px 40px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 14 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: 4,
                     textTransform: "uppercase" }}>Watcher Workshop</h1>
        <span style={{ fontSize: 12, color: "#667" }}>
          drag to orbit · scroll to zoom · 1 HP / 15 dmg glass cannon
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 310px", gap: 16 }}>
        {/* Stage */}
        <div style={{ background: "#07070e", border: "1px solid #1e1e2c", borderRadius: 10,
                      height: 620, position: "relative", overflow: "hidden" }}>
          <Stage paramsRef={paramsRef} buildKey={buildKey} paused={paused} scrub={scrub}
                 modeRef={modeRef} onStats={setStats} onPhase={setPhase}
                 onError={setStageError} />
          {stageError && (
            <pre style={{ position: "absolute", inset: 16, margin: 0, overflow: "auto",
                          background: "#1a0e12", border: "1px solid #512", borderRadius: 8,
                          padding: 16, color: "#fbb", fontSize: 12, lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                          fontFamily: "ui-monospace, Menlo, monospace" }}>
              <strong style={{ color: "#f44" }}>Stage failed to start</strong>
              {"\n\n" + stageError}
            </pre>
          )}
          <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6 }}>
            {(mode === "attack" ? PHASES : [phase]).map((p) => (
              <div key={p} style={{
                fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase",
                padding: "4px 9px", borderRadius: 4,
                background: phase === p ? "#44ccff" : "rgba(0,0,0,0.55)",
                color: phase === p ? "#04131a" : "#667",
                fontWeight: phase === p ? 700 : 400,
              }}>{p}</div>
            ))}
          </div>
          <div style={{ position: "absolute", bottom: 12, left: 12, fontSize: 11,
                        color: "#556", background: "rgba(0,0,0,0.5)", padding: "4px 9px",
                        borderRadius: 4 }}>
            doorway outline shown at {DOOR_W}×{DOOR_H} · ceiling {CEILING}
          </div>
        </div>

        {/* Panel */}
        <div>
          <div style={panel}>
            <h3 style={h3}>State</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {Object.entries(MODES).map(([k, m]) => (
                <button key={k} onClick={() => { setMode(k); setIsPaused(false); scrub.current = 0; }}
                  style={{
                    background: mode === k ? "#44ccff" : "rgba(255,255,255,0.06)",
                    color: mode === k ? "#04131a" : "#aab",
                    border: "1px solid #2a2a3a", borderRadius: 5, padding: "7px 0",
                    fontSize: 11, cursor: "pointer", letterSpacing: 1,
                    textTransform: "uppercase", fontWeight: mode === k ? 700 : 400,
                    gridColumn: k === "death" ? "span 2" : "auto",
                  }}>{m.label}</button>
              ))}
            </div>
            {mode === "hurt" && (
              <div style={{ fontSize: 10, color: "#ffaa22", marginTop: 8, lineHeight: 1.5 }}>
                Heads up: at 1 HP this never plays in-game. One shot kills, so it
                goes straight to Death.
              </div>
            )}
            {mode === "death" && (
              <div style={{ fontSize: 10, color: "#667", marginTop: 8, lineHeight: 1.5 }}>
                The most-seen animation on this alien — at 1 HP every kill is this.
              </div>
            )}
          </div>

          <div style={panel}>
            <h3 style={h3}>Playback</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button onClick={() => setIsPaused((v) => !v)} style={{
                flex: 1, background: isPaused ? "#44ccff" : "rgba(255,255,255,0.06)",
                color: isPaused ? "#04131a" : "#aab", border: "1px solid #2a2a3a",
                borderRadius: 5, padding: "7px 0", fontSize: 11, cursor: "pointer",
                letterSpacing: 1, textTransform: "uppercase", fontWeight: 600,
              }}>{isPaused ? "Paused" : "Playing"}</button>
              <button onClick={() => { setParams(DEFAULTS); setBuildKey((n) => n + 1); }}
                style={{ flex: 1, background: "rgba(255,255,255,0.06)", color: "#aab",
                         border: "1px solid #2a2a3a", borderRadius: 5, padding: "7px 0",
                         fontSize: 11, cursor: "pointer", letterSpacing: 1,
                         textTransform: "uppercase" }}>Reset</button>
            </div>
            <input type="range" min={0} max={1} step={0.001} value={scrubVal}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setScrubVal(v); scrub.current = v; setIsPaused(true);
              }}
              style={{ width: "100%", accentColor: "#44ccff", height: 3 }} />
            <div style={{ fontSize: 10, color: "#556", marginTop: 4 }}>
              scrub the cycle · full loop {total.toFixed(2)}s
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>Timing</h3>
            {PARAMS.slice(0, 5).map((s) =>
              <Slider key={s.k} spec={s} value={params[s.k]} onChange={set} />)}
          </div>

          <div style={panel}>
            <h3 style={h3}>Beam</h3>
            {PARAMS.slice(5, 8).map((s) =>
              <Slider key={s.k} spec={s} value={params[s.k]} onChange={set} />)}
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11,
                            color: "#8a8aa0", marginTop: 4, cursor: "pointer" }}>
              <input type="checkbox" checked={params.trackWhileFiring}
                onChange={(e) => set("trackWhileFiring", e.target.checked)}
                style={{ accentColor: "#44ccff" }} />
              Beam tracks you while firing
            </label>
            <div style={{ fontSize: 10, color: "#556", marginTop: 5, lineHeight: 1.5 }}>
              Off = it locks aim when the beam starts, so strafing beats it.
              On = it sweeps onto you and only cover saves you. This is the single
              biggest call on how the Watcher plays.
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>Motion</h3>
            {PARAMS.slice(8, 12).map((s) =>
              <Slider key={s.k} spec={s} value={params[s.k]} onChange={set} />)}
            <div style={{ fontSize: 10, color: "#556", marginTop: 5, lineHeight: 1.5 }}>
              Walk heading turns it on the spot — the legs should stride along
              whichever way it faces, never sideways.
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>Hit zones</h3>
            <div style={{ fontSize: 11, lineHeight: 1.9, color: "#8a8aa0" }}>
              <div><span style={{ color: "#ffaa22" }}>lid</span> — 2 shots to kill
                <span style={{ color: "#445" }}> · shutter petals</span></div>
              <div><span style={{ color: "#ff4466" }}>eye</span> — 1 shot to kill
                <span style={{ color: "#445" }}> · ball, lens, iris, pupil</span></div>
              <div><span style={{ color: "#667" }}>armor</span> — no damage
                <span style={{ color: "#445" }}> · hub, legs, cables</span></div>
            </div>
            <div style={{ fontSize: 10, color: "#556", marginTop: 7, lineHeight: 1.5 }}>
              The lids only open to fire, so the one-shot window exists exactly
              while it's dangerous. Meshes are tagged <code>userData.hitPart</code>,
              the same way the Puppet Master's parts are.
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>Target dummy</h3>
            {PARAMS.slice(12, 14).map((s) =>
              <Slider key={s.k} spec={s} value={params[s.k]} onChange={set} />)}
            <div style={{ fontSize: 10, marginTop: 5, lineHeight: 1.5,
                          color: params.targetDist > params.beamRange ? "#ffaa22" : "#556" }}>
              {params.targetDist > params.beamRange
                ? `Out of range (${params.targetDist} > ${params.beamRange}) — it charges but won't fire.`
                : `In range. Beam will reach ${params.targetDist}u of its ${params.beamRange}u.`}
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>Build</h3>
            {PARAMS.slice(14).map((s) =>
              <Slider key={s.k} spec={s} value={params[s.k]} onChange={set} />)}
          </div>

          {stats && (
            <div style={panel}>
              <h3 style={h3}>Cost &amp; fit</h3>
              <div style={{ fontSize: 11, lineHeight: 1.9, color: "#8a8aa0" }}>
                <div>meshes <span style={{ color: stats.meshes > 60 ? "#ffaa22" : "#44ff88" }}>
                  {stats.meshes}</span>
                  <span style={{ color: "#445" }}> · crawler 52 · brute 72</span></div>
                <div>triangles <span style={{ color: "#aab" }}>{stats.tris}</span></div>
                <div>size <span style={{ color: "#aab" }}>
                  {stats.w.toFixed(2)} × {stats.h.toFixed(2)} × {stats.d.toFixed(2)}</span></div>
                <div>doorway <span style={{ color: fitsDoor ? "#44ff88" : "#ff4466" }}>
                  {fitsDoor ? "fits" : "TOO BIG"}</span>
                  <span style={{ color: "#445" }}> · {DOOR_W} × {DOOR_H}</span></div>
              </div>
            </div>
          )}

          <div style={panel}>
            <h3 style={h3}>Values for watcher.js</h3>
            <pre style={{ margin: 0, fontSize: 10, lineHeight: 1.65, color: "#7a8a9a",
                          fontFamily: "ui-monospace, Menlo, monospace", whiteSpace: "pre-wrap" }}>
{`SCAN_FRAMES   = ${Math.round(params.scanTime * 60)}
OPEN_FRAMES   = ${Math.round(params.openTime * 60)}
CHARGE_FRAMES = ${Math.round(params.chargeTime * 60)}
FIRE_FRAMES   = ${Math.round(params.fireTime * 60)}
SEAL_FRAMES   = ${Math.round(params.sealTime * 60)}
BEAM_RANGE    = ${params.beamRange}
BEAM_RADIUS   = ${params.beamRadius}
SHUTTER_OPEN  = ${params.shutterOpen}
EYE_RADIUS    = ${params.eyeRadius}`}
            </pre>
            <div style={{ fontSize: 10, color: "#556", marginTop: 8, lineHeight: 1.6 }}>
              Tell me the numbers you land on and I'll bake them in. Reaction window
              is open+charge = <span style={{ color: "#44ccff" }}>
              {(params.openTime + params.chargeTime).toFixed(2)}s</span> between the
              shutters cracking and the beam landing.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
