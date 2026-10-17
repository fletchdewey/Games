import { useState, useEffect, useRef } from "react";
import * as THREE from "three";

const PAL = {
  skin1: 0x2a3a2a,
  skin2: 0x3b2040,
  skin3: 0x1a2a3a,
  skin4: 0x3a2a1a,
  bone: 0xc8b8a0,
  glow1: 0x44ff88,
  glow2: 0xff44cc,
  glow3: 0x44ccff,
  glow4: 0xffaa22,
  eye: 0xff2222,
  armor: 0x2a2a38,
};

// Build a leg as a parent-child chain so joints always connect
//
// upperTilt / lowerTilt bend the joint fore-and-aft (rotation.x) — that axis is
// left free for the walk cycle to drive. lowerSplay bends the knee sideways
// (rotation.z) instead, which is what lets a leg go UP and out to a raised knee
// and then drop a shin back down — the spider arch. Defaults to 0, so legs that
// don't ask for it hang exactly as before.
function buildLegChain({ upperLen, lowerLen, upperR, lowerR, footSize, skinMat, boneMat, upperTilt, lowerTilt, lowerSplay }) {
  const hip = new THREE.Group();

  const upperGeo = new THREE.CylinderGeometry(upperR, upperR * 0.75, upperLen, 5);
  upperGeo.translate(0, -upperLen / 2, 0);
  const upper = new THREE.Mesh(upperGeo, skinMat);
  upper.rotation.x = upperTilt || 0;
  hip.add(upper);

  const knee = new THREE.Group();
  knee.position.y = -upperLen;
  upper.add(knee);

  const jointGeo = new THREE.SphereGeometry(upperR * 1.1, 5, 5);
  const joint = new THREE.Mesh(jointGeo, skinMat);
  knee.add(joint);

  const lowerGeo = new THREE.CylinderGeometry(upperR * 0.75, lowerR, lowerLen, 5);
  lowerGeo.translate(0, -lowerLen / 2, 0);
  const lower = new THREE.Mesh(lowerGeo, skinMat);
  lower.rotation.x = lowerTilt || 0;
  lower.rotation.z = lowerSplay || 0;
  knee.add(lower);

  const footGroup = new THREE.Group();
  footGroup.position.y = -lowerLen;
  lower.add(footGroup);

  const footJointGeo = new THREE.SphereGeometry(lowerR * 1.2, 4, 4);
  const footJoint = new THREE.Mesh(footJointGeo, skinMat);
  footGroup.add(footJoint);

  if (footSize) {
    const footGeo = new THREE.ConeGeometry(footSize, footSize * 2.5, 4);
    footGeo.translate(0, -footSize * 1.2, 0);
    const foot = new THREE.Mesh(footGeo, boneMat);
    foot.rotation.x = -0.5;
    footGroup.add(foot);
  }

  return { hip, upper, knee, lower, footGroup };
}

// Silhouette target: LOW, WIDE, and spiky, with knees arching above the shell.
// That has to read instantly against the other three — Floater is a round
// hoverer, Brute is bulk, Spire is tall and thin. So the Crawler owns "low and
// wide". Three masses (head → cephalothorax → abdomen) keep it from going back
// to a blob, and the legs are thick enough to survive at distance.
// A cone whose origin sits at its BASE rather than its middle, so you can drop
// it on the surface it sprouts from and only worry about aiming it.
// A bare ConeGeometry is centred, which buries half the spike in the body.
function buildSpike(mat, radius, length, segments = 4) {
  const geo = new THREE.ConeGeometry(radius, length, segments);
  geo.translate(0, length / 2, 0);
  return new THREE.Mesh(geo, mat);
}

function buildCrawler() {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshLambertMaterial({ color: PAL.skin1 });
  const boneMat = new THREE.MeshLambertMaterial({ color: PAL.bone });
  const glowMat = new THREE.MeshBasicMaterial({ color: PAL.glow1 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: PAL.eye });
  const armorMat = new THREE.MeshLambertMaterial({ color: PAL.armor });

  // --- Cephalothorax (front mass, where the legs mount) ---
  const bodyGeo = new THREE.SphereGeometry(0.5, 7, 5);
  bodyGeo.scale(1.15, 0.52, 1.1);
  const body = new THREE.Mesh(bodyGeo, skinMat);
  body.position.set(0, 0.42, 0.15);
  body.castShadow = true;
  g.add(body);

  // --- Abdomen (rear mass) — pinched waist breaks the single-blob outline ---
  const abdoGeo = new THREE.SphereGeometry(0.42, 7, 5);
  abdoGeo.scale(1.05, 0.62, 1.2);
  const abdomen = new THREE.Mesh(abdoGeo, skinMat);
  abdomen.position.set(0, 0.44, -0.78);
  abdomen.castShadow = true;
  g.add(abdomen);

  // --- Head (front wedge) — gives the eyes somewhere to live and points the
  //     whole shape in its facing direction ---
  const headGeo = new THREE.SphereGeometry(0.22, 6, 5);
  headGeo.scale(1.0, 0.7, 1.1);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, 0.38, 0.85);
  g.add(head);

  // --- Dorsal plates — a raised ridge, not flat scales, so the top edge of the
  //     silhouette is a sawtooth instead of a dome ---
  const plates = [];
  for (let i = 0; i < 3; i++) {
    const plateGeo = new THREE.SphereGeometry(0.34 - i * 0.06, 5, 4);
    plateGeo.scale(1.05, 0.42, 0.7);
    const plate = new THREE.Mesh(plateGeo, armorMat);
    plate.position.set(0, 0.62 + i * 0.03, 0.45 - i * 0.3);
    plate.rotation.x = -0.12;
    g.add(plate);
    plates.push(plate);
  }

  // --- Abdomen spikes — swept back, the clearest distance read on the model ---
  for (const s of [
    { x: -0.3, y: 0.58, z: -0.6, tilt: 0.5 },
    { x: 0.3, y: 0.58, z: -0.6, tilt: 0.5 },
    { x: -0.17, y: 0.64, z: -0.95, tilt: 0.9 },
    { x: 0.17, y: 0.64, z: -0.95, tilt: 0.9 },
  ]) {
    const spikeGeo = new THREE.ConeGeometry(0.06, 0.42, 4);
    spikeGeo.translate(0, 0.21, 0);
    const spike = new THREE.Mesh(spikeGeo, boneMat);
    spike.position.set(s.x, s.y, s.z);
    spike.rotation.x = s.tilt;   // lean back over the abdomen
    spike.rotation.z = s.x * 0.8;
    g.add(spike);
  }

  // --- Legs (6: 3 per side) ---
  // hip.rotation.z of ~2.2rad swings the thigh past horizontal so it rises
  // outward to a knee ABOVE the shell (y≈0.77 vs a 0.68 shell top); lowerSplay
  // then cranks the shin back to near-vertical so it drops to the floor. That
  // up-and-over arch is the spider read. Legs are also ~2x thicker than before
  // — they're the dominant shape now, and hairline cylinders disappeared.
  const legAngles = [-0.8, 0, 0.8];
  const legs = [];
  const HIP_SPLAY = 2.2;
  const SHIN_ANGLE = 0.12;   // world-space lean of the shin, slightly outward

  for (const side of [-1, 1]) {
    for (let li = 0; li < legAngles.length; li++) {
      const angle = legAngles[li];
      const leg = buildLegChain({
        upperLen: 0.6, lowerLen: 0.95,
        upperR: 0.075, lowerR: 0.035,
        footSize: 0.05, skinMat, boneMat,
        upperTilt: 0.05,
        lowerTilt: 0.15,
        // Cancel the hip splay, then lean the shin back out a touch.
        lowerSplay: -side * (HIP_SPLAY - SHIN_ANGLE),
      });
      leg.hip.position.set(side * 0.42, 0.42, angle * 0.42);
      leg.hip.rotation.z = side * HIP_SPLAY;
      leg.hip.rotation.y = angle * 0.3;
      g.add(leg.hip);
      legs.push({ ...leg, side, index: li, baseUpperTilt: 0.05, baseLowerTilt: 0.15 });
    }
  }

  // --- Mandibles — two-part claws with a visible gap, flanking the head ---
  for (const side of [-1, 1]) {
    const upperGeo = new THREE.ConeGeometry(0.075, 0.46, 4);
    upperGeo.translate(0, 0.23, 0);
    const upperClaw = new THREE.Mesh(upperGeo, boneMat);
    upperClaw.position.set(side * 0.2, 0.42, 0.88);
    upperClaw.rotation.x = Math.PI * 0.5 - 0.3;
    upperClaw.rotation.z = side * -0.25;
    g.add(upperClaw);

    const lowerGeo = new THREE.ConeGeometry(0.055, 0.34, 4);
    lowerGeo.translate(0, 0.17, 0);
    const lowerClaw = new THREE.Mesh(lowerGeo, boneMat);
    lowerClaw.position.set(side * 0.22, 0.22, 0.86);
    lowerClaw.rotation.x = Math.PI * 0.5 + 0.25;
    lowerClaw.rotation.z = side * -0.3;
    g.add(lowerClaw);
  }

  // --- Eyes — clustered on the head, biggest pair in front ---
  for (const ep of [
    { x: -0.11, y: 0.46, z: 1.0, r: 0.05 },
    { x: 0.11, y: 0.46, z: 1.0, r: 0.05 },
    { x: 0, y: 0.52, z: 0.96, r: 0.035 },
    { x: -0.16, y: 0.5, z: 0.88, r: 0.03 },
    { x: 0.16, y: 0.5, z: 0.88, r: 0.03 },
  ]) {
    const eGeo = new THREE.SphereGeometry(ep.r, 4, 4);
    const eye = new THREE.Mesh(eGeo, eyeMat);
    eye.position.set(ep.x, ep.y, ep.z);
    g.add(eye);
  }

  // --- Glow nodes — moved onto the abdomen so the lit dots sit on the mass
  //     furthest from the eyes, reading front-to-back ---
  const glowMeshes = [];
  for (const p of [
    { x: -0.19, y: 0.67, z: -0.72 },
    { x: 0.19, y: 0.67, z: -0.72 },
    { x: 0, y: 0.68, z: -1.0 },
  ]) {
    const gGeo = new THREE.SphereGeometry(0.06, 4, 4);
    const gMesh = new THREE.Mesh(gGeo, glowMat);
    gMesh.position.set(p.x, p.y, p.z);
    g.add(gMesh);
    glowMeshes.push(gMesh);
  }

  g.userData.legs = legs;
  g.userData.plates = plates;
  g.userData.glowMeshes = glowMeshes;
  g.userData.walkType = "crawler";
  return g;
}

function buildFloater() {
  const g = new THREE.Group();
  // Thinner than before: at 0.7 the bell swallowed the core and the "glowing
  // brain" rendered as the darkest part of the model.
  const skinMat = new THREE.MeshLambertMaterial({ color: PAL.skin2, transparent: true, opacity: 0.56 });
  const coreMat = new THREE.MeshBasicMaterial({ color: PAL.glow2 });
  const tentMat = new THREE.MeshLambertMaterial({ color: PAL.skin2 });
  const foldMat = new THREE.MeshLambertMaterial({ color: 0x4a2850 });

  // Dome geometry, kept as named constants so the veins and the collar can be
  // placed ON the surface rather than guessed at.
  //   a point at polar angle th sits at radius R*sin(th), y DOME_Y + RY*cos(th)
  const DOME_R = 0.6, DOME_SY = 0.9, DOME_Y = 1.0, RY = DOME_R * DOME_SY;
  const DOME_TH = Math.PI * 0.66;          // was 0.6pi — reach further down
  const domeGeo = new THREE.SphereGeometry(DOME_R, 10, 7, 0, Math.PI * 2, 0, DOME_TH);
  domeGeo.scale(1, DOME_SY, 1);
  const dome = new THREE.Mesh(domeGeo, skinMat);
  dome.position.y = DOME_Y;
  g.add(dome);

  // Collar closing the gap between the dome's rim and the skirt. The bell used
  // to stop at y 0.83 with the skirt down at 0.65, so the head visibly floated
  // free of the body with daylight between them.
  const rimY = DOME_Y + RY * Math.cos(DOME_TH);
  const rimR = DOME_R * Math.sin(DOME_TH);
  const collarGeo = new THREE.CylinderGeometry(rimR, 0.55, Math.max(0.04, rimY - 0.65), 10, 1, true);
  const collar = new THREE.Mesh(collarGeo, skinMat);
  collar.position.y = (rimY + 0.65) / 2;
  g.add(collar);

  // Veins. Thin, and spread over the whole head instead of four fat half-tori
  // stacked above the crown poking out through the surface. Latitude rings sit
  // exactly on the dome's own curve; meridians run over the crown and down the
  // sides. Kept at 0.012-0.016 tube so the core still reads through them.
  const folds = [];
  const vein = (mesh) => {
    mesh.userData.base = mesh.scale.clone();   // the pulse multiplies this
    g.add(mesh);
    folds.push(mesh);
  };
  // Short, uneven arcs. Full-length rings on a regular lat/long spacing came
  // out looking like a birdcage — what sells a vein is that it wanders, stops,
  // and doesn't line up with its neighbours.
  const VEIN_IN = 0.90;          // inside the shell, not sitting on it
  for (const [th, arc, start, tube] of [
    [0.88, 1.8, 0.40, 0.016],
    [1.16, 1.4, 3.10, 0.013],
    [1.44, 2.2, 1.60, 0.014],
    [1.72, 1.2, 4.60, 0.011],
  ]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(DOME_R * Math.sin(th) * VEIN_IN, tube, 4, 12, arc), foldMat);
    ring.position.y = DOME_Y + RY * Math.cos(th);
    ring.rotation.x = -Math.PI * 0.5;
    ring.rotation.z = start;
    vein(ring);
  }
  // Meridians deliberately do NOT all begin at the crown — converging on the
  // pole is exactly what made it look like a globe.
  // `from` is how far past the crown each arc begins — pushed up so they all
  // start low on the bell rather than reaching over the top.
  // Meridians are PERFECT CIRCLES sized to the dome's smallest semi-axis
  // (the squashed vertical one). A circle that fits inside that fits inside
  // the ellipsoid at any orientation, so it can never break the surface.
  // Scaling y and then rotating 90deg about Z does NOT work — three applies
  // scale before rotation, so the squash lands on the wrong axis and the arc
  // bulges straight through the shell.
  const MERID_R = DOME_R * DOME_SY * VEIN_IN;
  for (const [rotY, arc, from, tube] of [
    [0.30, 1.05, 1.05, 0.015],
    [1.70, 0.85, 1.35, 0.012],
    [3.00, 1.15, 0.95, 0.014],
    [4.40, 0.70, 1.50, 0.011],
    [5.30, 0.95, 1.20, 0.013],
  ]) {
    const m2 = new THREE.Mesh(
      new THREE.TorusGeometry(MERID_R, tube, 4, 12, arc), foldMat);
    m2.position.y = DOME_Y;
    m2.rotation.z = Math.PI * 0.5 + from;    // how far below the crown it starts
    m2.rotation.y = rotY;
    vein(m2);
  }

  const coreGeo = new THREE.SphereGeometry(0.24, 7, 7);
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.y = 1.0;
  g.add(core);

  const coreLight = new THREE.PointLight(0xff44cc, 1.5, 5);
  coreLight.position.set(0, 1.0, 0);
  g.add(coreLight);

  const skirtGeo = new THREE.TorusGeometry(0.55, 0.06, 5, 10);
  const skirt = new THREE.Mesh(skirtGeo, tentMat);
  skirt.position.y = 0.65;
  skirt.rotation.x = Math.PI * 0.5;
  g.add(skirt);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const eGeo = new THREE.SphereGeometry(0.06, 5, 5);
    const eye = new THREE.Mesh(eGeo, new THREE.MeshBasicMaterial({ color: 0xff66aa }));
    eye.position.set(Math.cos(a) * 0.5, 0.75, Math.sin(a) * 0.5);
    g.add(eye);
  }

  const tentacles = [];
  for (let t = 0; t < 6; t++) {
    const a = (t / 6) * Math.PI * 2;
    const baseX = Math.cos(a) * 0.4;
    const baseZ = Math.sin(a) * 0.4;
    const segs = [];
    for (let seg = 0; seg < 5; seg++) {
      const r = 0.04 - seg * 0.006;
      const segGeo = new THREE.SphereGeometry(Math.max(0.01, r), 4, 4);
      const segMesh = new THREE.Mesh(segGeo, tentMat);
      segMesh.position.set(baseX, 0.5 - seg * 0.2, baseZ);
      g.add(segMesh);
      segs.push({ mesh: segMesh, baseX, baseZ, seg });
    }
    const tipGeo = new THREE.SphereGeometry(0.025, 4, 4);
    const tip = new THREE.Mesh(tipGeo, coreMat);
    tip.position.set(baseX, 0.5 - 5 * 0.2, baseZ);
    g.add(tip);
    segs.push({ mesh: tip, baseX, baseZ, seg: 5 });
    tentacles.push(segs);
  }

  g.userData.walkType = "floater";
  g.userData.dome = dome;
  g.userData.core = core;
  g.userData.coreLight = coreLight;
  g.userData.folds = folds;
  g.userData.tentacles = tentacles;
  return g;
}

function buildBrute() {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshLambertMaterial({ color: PAL.skin3 });
  const boneMat = new THREE.MeshLambertMaterial({ color: PAL.bone });
  const armorMat = new THREE.MeshLambertMaterial({ color: PAL.armor });
  const glowMat = new THREE.MeshBasicMaterial({ color: PAL.glow3 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: PAL.eye });

  const torsoGeo = new THREE.SphereGeometry(0.7, 7, 6);
  torsoGeo.scale(1.1, 1.0, 0.9);
  const torso = new THREE.Mesh(torsoGeo, skinMat);
  torso.position.y = 0.8;
  torso.rotation.x = 0.4;
  torso.castShadow = true;
  g.add(torso);

  // Spine plates following the curve of the hunched back
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    // Arc from lower back up and over the hunch
    const angle = -0.4 + t * 1.2;
    const radius = 0.75;
    const curveY = 0.8 + Math.sin(angle) * radius * 0.6;
    const curveZ = -0.1 - Math.cos(angle) * radius * 0.55;
    const plateGeo = new THREE.BoxGeometry(0.45 - i * 0.06, 0.1, 0.3 - i * 0.03);
    const plate = new THREE.Mesh(plateGeo, armorMat);
    plate.position.set(0, curveY, curveZ);
    // Tangent to the curve so each plate lies flush
    plate.rotation.x = angle - 0.2;
    g.add(plate);
  }

  // Head
  const headGeo = new THREE.SphereGeometry(0.25, 6, 5);
  headGeo.scale(0.9, 0.8, 1.1);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, 1.45, 0.35);
  g.add(head);

  const browGeo = new THREE.BoxGeometry(0.45, 0.08, 0.2);
  const brow = new THREE.Mesh(browGeo, armorMat);
  brow.position.set(0, 1.52, 0.48);
  g.add(brow);

  for (const ex of [-0.1, 0.1]) {
    const sockGeo = new THREE.SphereGeometry(0.06, 4, 4);
    const sock = new THREE.Mesh(sockGeo, new THREE.MeshLambertMaterial({ color: 0x0a0a15 }));
    sock.position.set(ex, 1.45, 0.52);
    g.add(sock);
    const eGeo = new THREE.SphereGeometry(0.035, 4, 4);
    const eye = new THREE.Mesh(eGeo, eyeMat);
    eye.position.set(ex, 1.45, 0.56);
    g.add(eye);
  }

  const jawGeo = new THREE.SphereGeometry(0.18, 5, 4);
  jawGeo.scale(1.2, 0.6, 1);
  const jaw = new THREE.Mesh(jawGeo, skinMat);
  jaw.position.set(0, 1.32, 0.45);
  g.add(jaw);

  for (const tx of [-0.12, 0.12]) {
    const tuskGeo = new THREE.ConeGeometry(0.03, 0.2, 4);
    const tusk = new THREE.Mesh(tuskGeo, boneMat);
    tusk.position.set(tx, 1.38, 0.55);
    tusk.rotation.x = -0.3;
    g.add(tusk);
  }

  // Arms — hierarchical chain
  const arms = [];
  for (const side of [-1, 1]) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 0.65, 1.1, 0.1);
    g.add(shoulderPivot);

    const shoulderGeo = new THREE.SphereGeometry(0.25, 6, 5);
    const shoulder = new THREE.Mesh(shoulderGeo, skinMat);
    shoulderPivot.add(shoulder);

    // Spiked pauldron capping the shoulder. Child of the pivot, so it swings
    // with the arm instead of shearing through it.
    const pauldronGeo = new THREE.SphereGeometry(0.33, 6, 5);
    pauldronGeo.scale(1.05, 0.85, 1.05);
    const pauldron = new THREE.Mesh(pauldronGeo, armorMat);
    pauldron.position.set(side * 0.06, 0.08, 0);
    shoulderPivot.add(pauldron);

    for (const p of [
      { x: 0.16, y: 0.24, z: 0.04, rz: 0.45, rx: -0.25, len: 0.34 },
      { x: 0.27, y: 0.1, z: -0.1, rz: 1.0, rx: 0.2, len: 0.3 },
      { x: 0.08, y: 0.24, z: -0.2, rz: 0.2, rx: 0.6, len: 0.26 },
    ]) {
      const spike = buildSpike(boneMat, 0.05, p.len);
      spike.position.set(side * p.x, p.y, p.z);
      spike.rotation.z = side * p.rz;
      spike.rotation.x = p.rx;
      shoulderPivot.add(spike);
    }

    const upperGeo = new THREE.CylinderGeometry(0.16, 0.13, 0.8, 6);
    upperGeo.translate(0, -0.4, 0);
    const upper = new THREE.Mesh(upperGeo, skinMat);
    upper.rotation.z = side * 0.2;
    shoulderPivot.add(upper);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(side * 0.08, -0.8, 0.05);
    upper.add(elbowPivot);

    const elbowGeo = new THREE.SphereGeometry(0.13, 5, 5);
    const elbow = new THREE.Mesh(elbowGeo, skinMat);
    elbowPivot.add(elbow);

    const foreGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.9, 6);
    foreGeo.translate(0, -0.45, 0);
    const fore = new THREE.Mesh(foreGeo, skinMat);
    fore.rotation.x = -0.3;
    elbowPivot.add(fore);

    // Elbow spike — points back up the arm, so it leads on the wind-up.
    const elbowSpike = buildSpike(boneMat, 0.06, 0.3);
    elbowSpike.position.set(0, 0.04, -0.12);
    elbowSpike.rotation.x = 2.5;
    elbowPivot.add(elbowSpike);

    // Armoured bracer with a row of outward spikes. Parented to the forearm so
    // it tracks the arm's own tilt.
    const bracerGeo = new THREE.CylinderGeometry(0.21, 0.23, 0.3, 6);
    const bracer = new THREE.Mesh(bracerGeo, armorMat);
    bracer.position.y = -0.52;
    fore.add(bracer);

    for (const by of [-0.3, -0.52, -0.74]) {
      const spike = buildSpike(boneMat, 0.055, 0.28);
      spike.position.set(side * 0.17, by, 0);
      spike.rotation.z = -side * 1.35;   // out from the outer edge of the arm
      spike.rotation.x = -0.15;
      fore.add(spike);
    }

    const fistGeo = new THREE.SphereGeometry(0.2, 5, 5);
    const fist = new THREE.Mesh(fistGeo, skinMat);
    fist.position.set(0, -0.9, 0.15);
    elbowPivot.add(fist);

    // Knuckle spikes, scaled up from the old 0.025-radius slivers — these are
    // the business end of the fist slam and need to read on impact.
    for (let k = -1; k <= 1; k++) {
      const spike = buildSpike(boneMat, 0.055, 0.26);
      spike.position.set(k * 0.1, -0.98, 0.26);
      spike.rotation.x = 2.1;            // forward and slightly down
      spike.rotation.z = k * 0.25;
      elbowPivot.add(spike);
    }

    arms.push({ shoulderPivot, elbowPivot, side });
  }

  // Legs — connected chain
  const legs = [];
  for (const lx of [-0.3, 0.3]) {
    const side = lx > 0 ? 1 : -1;
    const leg = buildLegChain({
      upperLen: 0.4, lowerLen: 0.35,
      upperR: 0.14, lowerR: 0.12,
      footSize: null, skinMat, boneMat,
      upperTilt: 0.2, lowerTilt: -0.4,
    });
    leg.hip.position.set(lx, 0.15, -0.05);
    g.add(leg.hip);

    const footGeo = new THREE.BoxGeometry(0.24, 0.1, 0.3);
    const foot = new THREE.Mesh(footGeo, armorMat);
    leg.footGroup.add(foot);

    // Toe claws, so all that weight lands on something.
    for (const tx of [-1, 0, 1]) {
      const claw = buildSpike(boneMat, 0.04, 0.16);
      claw.position.set(tx * 0.08, -0.02, 0.15);
      claw.rotation.x = 1.9;
      leg.footGroup.add(claw);
    }

    // Hip armour with a backswept spur — fills the bare gap between the torso
    // and the knee, which was the plainest stretch of the whole model.
    const hipGeo = new THREE.SphereGeometry(0.24, 5, 4);
    hipGeo.scale(1.1, 0.95, 1.0);
    const hipArmor = new THREE.Mesh(hipGeo, armorMat);
    hipArmor.position.set(side * 0.04, -0.06, 0);
    leg.hip.add(hipArmor);

    const spur = buildSpike(boneMat, 0.055, 0.26);
    spur.position.set(side * 0.18, -0.02, -0.08);
    spur.rotation.z = -side * 1.1;
    spur.rotation.x = -0.5;
    leg.hip.add(spur);

    legs.push({ ...leg, side, baseUpperTilt: 0.2, baseLowerTilt: -0.4 });
  }

  for (const side of [-1, 1]) {
    const gGeo = new THREE.SphereGeometry(0.06, 4, 4);
    const gMesh = new THREE.Mesh(gGeo, glowMat);
    gMesh.position.set(side * 0.7, 1.3, 0.1);
    g.add(gMesh);
  }
  const cgGeo = new THREE.SphereGeometry(0.08, 4, 4);
  const cg = new THREE.Mesh(cgGeo, glowMat);
  cg.position.set(0, 0.9, 0.6);
  g.add(cg);

  g.userData.walkType = "brute";
  g.userData.legs = legs;
  g.userData.arms = arms;
  return g;
}

// ─── WATCHER ────────────────────────────────────────────────
// Replaces the Spire as the roster's ranged attacker. Ported from
// falo3d-2/watcher_workshop.jsx — tune it THERE (sliders, state scrubber,
// hit zones) and copy the numbers into W below.
//
// The eye is the silhouette, the telegraph AND the weak point all at once:
// armoured lids seal it at rest and only iris open to fire, so the one-shot
// window exists exactly while it's dangerous.
const W = {
  scanTime: 2.5, openTime: 0.9, chargeTime: 0.8, fireTime: 0.45, sealTime: 0.35,
  beamRange: 12, shutterOpen: 1.15, shutClosed: 0.3, spinRate: 7, scanSweep: 0.75,
  eyeRadius: 0.38, hubHeight: 1.54, legLength: 1.8, shutterCount: 4, legMountR: 0.50,
};

function buildWatcher() {
  const g = new THREE.Group();
  const mech = new THREE.MeshLambertMaterial({ color: 0x4a5058 });
  const ar = new THREE.MeshLambertMaterial({ color: PAL.armor });
  const arLt = new THREE.MeshLambertMaterial({ color: 0x3a3a4a });
  const gl = new THREE.MeshBasicMaterial({ color: PAL.glow3 });
  // Separate instance so the eye can flash and die without repainting the
  // hull vents, which share the same colour.
  const eyeGlow = new THREE.MeshBasicMaterial({ color: PAL.glow3 });

  const R = W.eyeRadius, hubY = W.hubHeight, eyeY = hubY - 0.28;

  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.32, 7, 5), ar);
  hub.scale.set(1.25, 0.62, 1.25);
  hub.position.y = hubY;
  g.add(hub);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 0.2, 7), arLt);
  collar.position.y = hubY - 0.14;
  g.add(collar);

  const vents = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.16), arLt);
    slot.position.set(Math.cos(a) * 0.33, hubY + 0.02, Math.sin(a) * 0.33);
    slot.rotation.y = -a;
    g.add(slot);
    const lit = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.1), gl);
    lit.position.set(Math.cos(a) * 0.36, hubY + 0.02, Math.sin(a) * 0.36);
    lit.rotation.y = -a;
    g.add(lit);
    vents.push(lit);
  }

  const eyePivot = new THREE.Group();
  eyePivot.position.set(0, eyeY, 0);
  g.add(eyePivot);

  const ball = new THREE.Mesh(new THREE.SphereGeometry(R, 9, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8d0c0 }));
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
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(R * 0.22, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0x001018 }));
  pupil.position.z = R * 0.95;
  pupil.scale.set(1, 1, 0.4);
  eyePivot.add(pupil);
  const brow = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.16, 9, 5, 0, Math.PI * 2, 0, 1.0), ar);
  brow.position.y = 0.02;
  eyePivot.add(brow);

  // Shutter petals. A petal cap points along its own +Y, so it carries a base
  // quarter-turn to face +Z; "open" swings back from there. Without that they
  // just stack on top of the eye and never cover the lens at all.
  const shutters = [];
  for (let i = 0; i < W.shutterCount; i++) {
    const outer = new THREE.Group();
    outer.rotation.z = (i / W.shutterCount) * Math.PI * 2;
    eyePivot.add(outer);
    const inner = new THREE.Group();
    outer.add(inner);
    inner.add(new THREE.Mesh(new THREE.SphereGeometry(
      R * 1.18, 8, 4, 0, Math.PI * 2, 0, 0.52 + 0.9 / W.shutterCount), arLt));
    inner.rotation.x = Math.PI / 2 - W.shutClosed;
    shutters.push(inner);
  }

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 4), mech);
    cable.position.set(Math.cos(a) * 0.23, hubY - 0.12, Math.sin(a) * 0.23);
    cable.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
    g.add(cable);
  }

  // Beam: built once and reused. Aimed by rotation, ranged by scale.y — which
  // is why a sustained beam costs less than the projectile system it replaces.
  const beamGeo = new THREE.CylinderGeometry(0.045, 0.1, 1, 6, 1, true);
  beamGeo.translate(0, 0.5, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
    color: 0x88eeff, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
  beam.rotation.x = Math.PI * 0.5;
  beam.position.z = R * 0.8;
  beam.visible = false;
  eyePivot.add(beam);
  const flare = new THREE.Mesh(new THREE.SphereGeometry(R * 0.52, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xaaf4ff }));
  flare.position.z = R * 1.05;
  flare.visible = false;
  eyePivot.add(flare);
  const impact = new THREE.Mesh(new THREE.SphereGeometry(R * 0.45, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xaaf4ff }));
  impact.visible = false;
  eyePivot.add(impact);

  // Legs mount OUTSIDE the hub (radius 0.40) on visible shoulder nubs, and the
  // ring is offset 30deg so they sit front-right, front-left and dead astern.
  // Inboard mounts put a thigh through the dome and a knee across the eye.
  const legs = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const leg = buildLegChain({
      upperLen: W.legLength * 0.47, lowerLen: W.legLength * 0.53,
      upperR: 0.055, lowerR: 0.03, skinMat: mech, boneMat: ar,
      upperTilt: 0, lowerTilt: 0.1, lowerSplay: -1.0, footSize: 0.05,
    });
    leg.hip.position.set(Math.cos(a) * W.legMountR, hubY - 0.02, Math.sin(a) * W.legMountR);
    leg.hip.rotation.y = -a;
    leg.hip.rotation.z = 1.0;
    g.add(leg.hip);
    legs.push(leg);

    const mount = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), arLt);
    mount.position.copy(leg.hip.position);
    g.add(mount);
    const strut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.075, W.legMountR - 0.18, 5), ar);
    strut.position.set(Math.cos(a) * (W.legMountR - 0.09) * 0.55, hubY,
                       Math.sin(a) * (W.legMountR - 0.09) * 0.55);
    strut.rotation.z = Math.PI / 2;
    strut.rotation.y = -a;
    g.add(strut);
  }

  // Hit zones — lid takes two shots, the exposed eye dies in one.
  for (const m of [ball, lens, pupil, irisOuter, irisInner]) m.userData.hitPart = 'eye';
  for (const sh of shutters) sh.traverse((o) => { if (o.isMesh) o.userData.hitPart = 'lid'; });
  g.traverse((o) => { if (o.isMesh && !o.userData.hitPart) o.userData.hitPart = 'armor'; });

  g.userData = { walkType: "watcher", legs, eyePivot, lens, pupil, irisOuter,
                 irisInner, ball, shutters, vents, beam, flare, impact };
  return g;
}


function animateModel(model, time) {
  const d = model.userData;

  if (d.walkType === "floater") {
    // Brain pulse
    const pulse = 1 + Math.sin(time * 4) * 0.08;
    const fastPulse = 1 + Math.sin(time * 7) * 0.04;
    if (d.dome) d.dome.scale.set(pulse, 0.9 * pulse, pulse);
    if (d.core) {
      d.core.scale.setScalar(fastPulse * 1.1);
      d.core.material.color.setHSL(0.88, 1, 0.5 + Math.sin(time * 6) * 0.15);
    }
    if (d.coreLight) d.coreLight.intensity = 1.5 + Math.sin(time * 6) * 0.8;
    if (d.folds) {
      d.folds.forEach((fold, i) => {
        // Pulse RELATIVE to each vein's own resting scale — the meridians are
        // squashed to match the dome, and a flat scale.set would iron them out.
        const b = fold.userData.base;
        const p = 1 + Math.sin(time * 4 + i * 0.8) * 0.05;
        fold.scale.set(b.x * p, b.y * p, b.z);
      });
    }
    if (d.tentacles) {
      d.tentacles.forEach((segs, ti) => {
        segs.forEach((s) => {
          const sway = Math.sin(time * 2.5 + s.seg * 0.9 + ti * 1.1) * 0.1 * (s.seg + 1);
          s.mesh.position.x = s.baseX + sway;
          s.mesh.position.z = s.baseZ + Math.cos(time * 2 + ti) * 0.04 * s.seg;
        });
      });
    }
    model.position.y = Math.sin(time * 1.5) * 0.1;
    return;
  }

  // Walk cycle for legged types
  if (d.legs) {
    const speed = d.walkType === "crawler" ? 12 : d.walkType === "brute" ? 3 : 4;
    const amp = d.walkType === "crawler" ? 0.15 : d.walkType === "brute" ? 0.2 : 0.25;

    d.legs.forEach((leg, i) => {
      const phase = (i / d.legs.length) * Math.PI * 2;
      const cycle = Math.sin(time * speed + phase);

      leg.upper.rotation.x = (leg.baseUpperTilt || 0) + cycle * amp;
      leg.lower.rotation.x = (leg.baseLowerTilt || 0) - Math.abs(cycle) * amp * 0.6;
    });

    const bob = Math.abs(Math.sin(time * speed * 2)) * 0.025;
    model.position.y = bob;
    model.rotation.z = Math.sin(time * speed) * 0.015;
  }

  // Brute arm swing
  if (d.walkType === "brute" && d.arms) {
    d.arms.forEach((arm) => {
      const swing = Math.sin(time * 3 + (arm.side > 0 ? Math.PI : 0));
      arm.shoulderPivot.rotation.x = swing * 0.2;
      arm.elbowPivot.rotation.x = -0.3 + Math.abs(swing) * 0.15;
    });
  }

  // Watcher: the full attack cycle, since standing still is most of what it
  // does and the cycle is the whole design. Tuned in the Watcher Workshop
  // (falo3d-2/watcher_workshop.jsx) — that file stays the place to change it.
  if (d.walkType === "watcher") {
    const CYCLE = W.scanTime + W.openTime + W.chargeTime + W.fireTime + W.sealTime;
    let k = (time % CYCLE), open = 0, charge = 0, firing = false;
    if (k < W.scanTime) {
      d.eyePivot.rotation.y = Math.sin(time * 0.9) * W.scanSweep;
      d.eyePivot.rotation.x = Math.sin(time * 0.6) * W.scanSweep * 0.27;
    } else {
      d.eyePivot.rotation.y *= 0.85;
      d.eyePivot.rotation.x *= 0.85;
      k -= W.scanTime;
      if (k < W.openTime) open = k / W.openTime;
      else if ((k -= W.openTime) < W.chargeTime) { open = 1; charge = k / W.chargeTime; }
      else if ((k -= W.chargeTime) < W.fireTime) { open = 1; charge = 1; firing = true; }
      else { open = 1 - (k - W.fireTime) / W.sealTime; }
    }

    const delta = W.shutClosed + open * W.shutterOpen;
    d.shutters.forEach((sh) => { sh.rotation.x = Math.PI / 2 - delta; });

    const heat = charge * (0.7 + Math.sin(time * 18) * 0.3);
    d.lens.scale.set(1 + heat * 0.3, 1 + heat * 0.3, 0.45);
    d.irisOuter.rotation.z = time * (1 + charge * W.spinRate);
    d.irisInner.rotation.z = -time * (1.4 + charge * W.spinRate * 1.3);
    d.irisInner.scale.setScalar(1 - charge * 0.3);
    d.vents.forEach((v, i) =>
      v.scale.setScalar(1 + charge * 1.6 + Math.sin(time * 6 + i) * 0.15));

    d.legs.forEach((leg, i) => {
      const c = Math.sin(time * 1.8 + (i / 3) * Math.PI * 2);
      leg.upper.rotation.x = c * 0.1;
      leg.lower.rotation.x = 0.1 - Math.abs(c) * 0.06;
    });
    model.position.y = Math.sin(time * 1.1) * 0.03;

    d.beam.visible = d.flare.visible = d.impact.visible = firing;
    // Collapse the beam when idle. Hiding it is NOT enough: Box3 counts
  // invisible meshes, so a stretched-but-hidden 12-unit beam would blow out
  // any bounds-based camera framing long after the shot ended.
  if (!firing) { d.beam.scale.set(1, 0.001, 1); d.impact.position.z = 0; }
  if (firing) {
      const j = 1 + Math.sin(time * 50) * 0.06;
      const len = W.beamRange - W.eyeRadius * 0.8;
      d.beam.scale.set(j, len, j);
      d.flare.scale.setScalar(0.9 + Math.sin(time * 45) * 0.25);
      d.impact.position.z = W.eyeRadius * 0.8 + len;
      d.impact.scale.setScalar(1.1 + Math.sin(time * 38) * 0.35);
    }
  }
}

const ALIENS = [
  { name: "Crawler", desc: "Low-profile spider-crab. Fast flanker. Raised knees, swept-back spikes, mandibles up front.", build: buildCrawler, meshCount: "~52", color: "#44ff88" },
  { name: "Floater", desc: "Psychic jellyfish-brain. Hovers, fires mind blasts. Veined bell sealed to the body, lit core, trailing motes.", build: buildFloater, meshCount: "~53", color: "#ff44cc" },
  { name: "Brute", desc: "Gorilla-rhino tank. Spiked plate armor, nose horn, bracered fists. Charges, then slams.", build: buildBrute, meshCount: "~72", color: "#44ccff" },
  { name: "Watcher", desc: "Armoured eye on a tripod. Shutters iris open, the lens spins up, then it holds a beam on you. 1 HP / 15 dmg glass cannon.", build: buildWatcher, meshCount: "~52", color: "#44ccff" },
];

function AlienViewer({ alien, index }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 50);
    camera.position.set(0, 1.2, 4.5);
    camera.lookAt(0, 0.6, 0);

    scene.add(new THREE.AmbientLight(0x334455, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(3, 5, 4);
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0x445566, 0.3);
    fill.position.set(-2, 1, -2);
    scene.add(fill);

    const gridGeo = new THREE.RingGeometry(0.8, 1.8, 24);
    const gridMat = new THREE.MeshBasicMaterial({ color: 0x222233, transparent: true, opacity: 0.3 });
    const grid = new THREE.Mesh(gridGeo, gridMat);
    grid.rotation.x = -Math.PI * 0.5;
    grid.position.y = -0.5;
    scene.add(grid);

    const model = alien.build();
    scene.add(model);

    let time = index * 1.5;
    function animate() {
      time += 0.016;
      model.rotation.y = time * 0.5;
      animateModel(model, time);
      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
    };
  }, [alien, index]);

  return <canvas ref={canvasRef} width={400} height={400} style={{ width: "100%", height: "100%", display: "block" }} />;
}

export default function AlienWorkshop() {
  const [selected, setSelected] = useState(null);
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #0a0a12 0%, #12121f 50%, #0a0a12 100%)",
      padding: "24px 16px", fontFamily: "'Courier New', monospace", color: "#c8c8d8",
    }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#e8e8f0", margin: 0, letterSpacing: 4, textTransform: "uppercase" }}>
          Falo 3D-2 — Alien Workshop
        </h1>
        <p style={{ fontSize: 13, color: "#667", margin: "8px 0 0" }}>
          Legged aliens walk, floater pulses. Click to highlight.
        </p>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 16, maxWidth: 1100, margin: "0 auto",
      }}>
        {ALIENS.map((alien, i) => {
          const active = selected === i;
          return (
            <div key={alien.name} onClick={() => setSelected(active ? null : i)} style={{
              background: active ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${active ? alien.color : "#222233"}`,
              borderRadius: 10, overflow: "hidden", cursor: "pointer",
              transition: "all 0.25s ease",
              boxShadow: active ? `0 0 20px ${alien.color}22, inset 0 0 30px ${alien.color}08` : "none",
            }}>
              <div style={{ height: 260, position: "relative" }}>
                <AlienViewer alien={alien} index={i} />
                <div style={{
                  position: "absolute", top: 10, right: 10,
                  background: "rgba(0,0,0,0.6)", color: alien.color,
                  fontSize: 10, padding: "3px 8px", borderRadius: 4,
                }}>
                  {alien.meshCount} meshes
                </div>
              </div>
              <div style={{ padding: "12px 16px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: alien.color, boxShadow: `0 0 8px ${alien.color}`,
                  }} />
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e8e8f0", margin: 0, letterSpacing: 2, textTransform: "uppercase" }}>
                    {alien.name}
                  </h2>
                </div>
                <p style={{ fontSize: 12, lineHeight: 1.5, color: "#889", margin: 0 }}>{alien.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{
        maxWidth: 1100, margin: "24px auto 0", padding: "16px 20px",
        background: "rgba(255,255,255,0.02)", border: "1px solid #1a1a2a", borderRadius: 8,
        fontSize: 12, lineHeight: 1.7, color: "#667",
      }}>
        <strong style={{ color: "#99a" }}>What changed:</strong>{" "}
        Legs use parent-child groups (upper → knee joint ball → lower → foot) so joints always connect no matter how they animate.
        Floater brain dome pulses by scaling + core color/intensity flicker. Brute spine plates follow a parametric arc matching the torso hunch.
        Watcher runs its full attack cycle: shutters iris open, lens spins up, beam fires, shutters seal.
      </div>
    </div>
  );
}
