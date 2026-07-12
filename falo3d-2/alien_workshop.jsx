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
function buildLegChain({ upperLen, lowerLen, upperR, lowerR, footSize, skinMat, boneMat, upperTilt, lowerTilt }) {
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

function buildCrawler() {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshLambertMaterial({ color: PAL.skin1 });
  const boneMat = new THREE.MeshLambertMaterial({ color: PAL.bone });
  const glowMat = new THREE.MeshBasicMaterial({ color: PAL.glow1 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: PAL.eye });

  const bodyGeo = new THREE.SphereGeometry(0.6, 7, 5);
  bodyGeo.scale(1.2, 0.5, 1.4);
  const body = new THREE.Mesh(bodyGeo, skinMat);
  body.position.y = 0.4;
  body.castShadow = true;
  g.add(body);

  for (let i = 0; i < 3; i++) {
    const plateGeo = new THREE.SphereGeometry(0.35 - i * 0.08, 5, 4);
    plateGeo.scale(1.1, 0.3, 0.8);
    const plate = new THREE.Mesh(plateGeo, new THREE.MeshLambertMaterial({ color: PAL.armor }));
    plate.position.set(0, 0.55 + i * 0.05, -0.3 + i * 0.3);
    g.add(plate);
  }

  const legAngles = [-0.8, 0, 0.8];
  const legs = [];
  for (const side of [-1, 1]) {
    for (let li = 0; li < legAngles.length; li++) {
      const angle = legAngles[li];
      const leg = buildLegChain({
        upperLen: 0.55, lowerLen: 0.5,
        upperR: 0.04, lowerR: 0.02,
        footSize: 0.025, skinMat, boneMat,
        upperTilt: 0.3, lowerTilt: -0.9,
      });
      leg.hip.position.set(side * 0.5, 0.35, angle * 0.45);
      leg.hip.rotation.z = side * 1.0;
      leg.hip.rotation.y = angle * 0.3;
      g.add(leg.hip);
      legs.push({ ...leg, side, index: li, baseUpperTilt: 0.3, baseLowerTilt: -0.9 });
    }
  }

  for (const side of [-1, 1]) {
    const pincerGeo = new THREE.ConeGeometry(0.04, 0.5, 4);
    const pincer = new THREE.Mesh(pincerGeo, boneMat);
    pincer.position.set(side * 0.35, 0.2, 0.8);
    pincer.rotation.x = -0.6;
    pincer.rotation.z = side * -0.4;
    g.add(pincer);
  }

  for (const ep of [
    { x: -0.12, y: 0.55, z: 0.65 }, { x: 0.12, y: 0.55, z: 0.65 },
    { x: 0, y: 0.6, z: 0.7 }, { x: -0.08, y: 0.65, z: 0.6 }, { x: 0.08, y: 0.65, z: 0.6 },
  ]) {
    const eGeo = new THREE.SphereGeometry(0.04, 4, 4);
    const eye = new THREE.Mesh(eGeo, eyeMat);
    eye.position.set(ep.x, ep.y, ep.z);
    g.add(eye);
  }

  for (const p of [{ x: -0.2, z: 0 }, { x: 0.2, z: 0 }, { x: 0, z: -0.4 }]) {
    const gGeo = new THREE.SphereGeometry(0.05, 4, 4);
    const gMesh = new THREE.Mesh(gGeo, glowMat);
    gMesh.position.set(p.x, 0.58, p.z);
    g.add(gMesh);
  }

  g.userData.legs = legs;
  g.userData.walkType = "crawler";
  return g;
}

function buildFloater() {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshLambertMaterial({ color: PAL.skin2, transparent: true, opacity: 0.7 });
  const coreMat = new THREE.MeshBasicMaterial({ color: PAL.glow2 });
  const tentMat = new THREE.MeshLambertMaterial({ color: PAL.skin2 });
  const foldMat = new THREE.MeshLambertMaterial({ color: 0x4a2850 });

  const domeGeo = new THREE.SphereGeometry(0.6, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6);
  domeGeo.scale(1, 0.9, 1);
  const dome = new THREE.Mesh(domeGeo, skinMat);
  dome.position.y = 1.0;
  g.add(dome);

  const folds = [];
  for (let i = 0; i < 4; i++) {
    const ridgeGeo = new THREE.TorusGeometry(0.35 - i * 0.06, 0.035, 4, 8, Math.PI);
    const ridge = new THREE.Mesh(ridgeGeo, foldMat);
    ridge.position.set(0, 1.15 + i * 0.08, 0);
    ridge.rotation.y = i * 0.7;
    ridge.rotation.x = -Math.PI * 0.5;
    g.add(ridge);
    folds.push(ridge);
  }

  const coreGeo = new THREE.SphereGeometry(0.2, 6, 6);
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

    const fistGeo = new THREE.SphereGeometry(0.18, 5, 5);
    const fist = new THREE.Mesh(fistGeo, skinMat);
    fist.position.set(0, -0.9, 0.15);
    elbowPivot.add(fist);

    for (let k = -1; k <= 1; k++) {
      const spikeGeo = new THREE.ConeGeometry(0.025, 0.12, 3);
      const spike = new THREE.Mesh(spikeGeo, boneMat);
      spike.position.set(k * 0.06, -0.95, 0.3);
      spike.rotation.x = -0.5;
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

    const footGeo = new THREE.BoxGeometry(0.2, 0.08, 0.25);
    const foot = new THREE.Mesh(footGeo, armorMat);
    leg.footGroup.add(foot);

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

function buildSpire() {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshLambertMaterial({ color: PAL.skin4 });
  const boneMat = new THREE.MeshLambertMaterial({ color: PAL.bone });
  const glowMat = new THREE.MeshBasicMaterial({ color: PAL.glow4 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x556655 });

  const torsoGeo = new THREE.CylinderGeometry(0.2, 0.15, 1.2, 6);
  const torso = new THREE.Mesh(torsoGeo, skinMat);
  torso.position.y = 0.8;
  torso.castShadow = true;
  g.add(torso);

  // Segmented neck with joint spheres
  for (let s = 0; s < 4; s++) {
    const neckGeo = new THREE.CylinderGeometry(0.08 - s * 0.01, 0.08, 0.18, 5);
    const neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.set(0, 1.5 + s * 0.17, 0.05 + s * 0.06);
    neck.rotation.x = -0.15;
    g.add(neck);
    if (s > 0) {
      const jGeo = new THREE.SphereGeometry(0.065, 4, 4);
      const jMesh = new THREE.Mesh(jGeo, skinMat);
      jMesh.position.set(0, 1.5 + s * 0.17 - 0.09, 0.05 + s * 0.06 - 0.03);
      g.add(jMesh);
    }
  }

  const headGeo = new THREE.ConeGeometry(0.3, 0.25, 3);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, 2.15, 0.3);
  head.rotation.x = Math.PI * 0.5;
  head.rotation.z = Math.PI;
  g.add(head);

  const sacGeo = new THREE.SphereGeometry(0.15, 6, 5);
  sacGeo.scale(0.8, 1.2, 1);
  const sac = new THREE.Mesh(sacGeo, new THREE.MeshLambertMaterial({
    color: PAL.glow4, transparent: true, opacity: 0.6,
  }));
  sac.position.set(0, 1.9, 0.35);
  g.add(sac);

  const sacGlow = new THREE.PointLight(0xffaa22, 1, 3);
  sacGlow.position.set(0, 1.9, 0.35);
  g.add(sacGlow);

  for (const side of [-1, 1]) {
    const eyeGeo = new THREE.SphereGeometry(0.1, 6, 5);
    eyeGeo.scale(0.7, 1, 1);
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side * 0.22, 2.15, 0.35);
    g.add(eye);
  }

  for (const side of [-1, 1]) {
    const upperGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.6, 5);
    const upper = new THREE.Mesh(upperGeo, skinMat);
    upper.position.set(side * 0.3, 1.2, 0.1);
    upper.rotation.z = side * 0.6;
    upper.rotation.x = -0.2;
    g.add(upper);

    const bladeGeo = new THREE.BoxGeometry(0.03, 0.7, 0.12);
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(side * 0.55, 0.65, 0.25);
    blade.rotation.z = side * 0.2;
    blade.rotation.x = -0.4;
    g.add(blade);

    const tipGeo = new THREE.ConeGeometry(0.04, 0.2, 3);
    const tip = new THREE.Mesh(tipGeo, bladeMat);
    tip.position.set(side * 0.6, 0.25, 0.35);
    tip.rotation.x = -0.5;
    tip.rotation.z = side * 0.2;
    g.add(tip);
  }

  // Stilt legs — connected chain
  const legs = [];
  for (const lx of [-0.15, 0.15]) {
    const side = lx > 0 ? 1 : -1;
    const leg = buildLegChain({
      upperLen: 0.55, lowerLen: 0.7,
      upperR: 0.06, lowerR: 0.025,
      footSize: 0.04, skinMat, boneMat,
      upperTilt: 0.35, lowerTilt: -0.7,
    });
    leg.hip.position.set(lx, 0.2, -0.05);
    g.add(leg.hip);
    legs.push({ ...leg, side, baseUpperTilt: 0.35, baseLowerTilt: -0.7 });
  }

  for (let i = 0; i < 5; i++) {
    const quillGeo = new THREE.ConeGeometry(0.02, 0.25 - i * 0.03, 3);
    const quill = new THREE.Mesh(quillGeo, boneMat);
    quill.position.set(0, 0.5 + i * 0.22, -0.2);
    quill.rotation.x = -0.6;
    g.add(quill);
  }

  for (let i = 0; i < 3; i++) {
    const dotGeo = new THREE.SphereGeometry(0.03, 4, 4);
    const dot = new THREE.Mesh(dotGeo, glowMat);
    dot.position.set(0, 1.55 + i * 0.18, 0.15);
    g.add(dot);
  }

  g.userData.walkType = "spire";
  g.userData.legs = legs;
  g.userData.sac = sac;
  g.userData.sacGlow = sacGlow;
  return g;
}

// --- Animation ---
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
        const p = 1 + Math.sin(time * 4 + i * 0.8) * 0.06;
        fold.scale.set(p, p, 1);
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

  // Spire venom sac throb
  if (d.walkType === "spire" && d.sac) {
    const throb = 1 + Math.sin(time * 3) * 0.15;
    d.sac.scale.set(0.8 * throb, 1.2 * throb, throb);
    d.sacGlow.intensity = 1 + Math.sin(time * 3) * 0.5;
  }
}

const ALIENS = [
  { name: "Crawler", desc: "Low-profile spider-crab. Fast flanker. Scurries along walls and floors.", build: buildCrawler, meshCount: "~40", color: "#44ff88" },
  { name: "Floater", desc: "Psychic jellyfish-brain. Hovers, fires mind blasts. Pulsing dome with trailing tendrils.", build: buildFloater, meshCount: "~45", color: "#ff44cc" },
  { name: "Brute", desc: "Gorilla-rhino tank. Charges and pounds with massive fists. Tiny head, huge body.", build: buildBrute, meshCount: "~42", color: "#44ccff" },
  { name: "Spire", desc: "Mantis-sniper. Tall, thin, spits venom from range. Blade arms for melee if close.", build: buildSpire, meshCount: "~40", color: "#ffaa22" },
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
        Spire venom sac throbs. All legged aliens have a walk cycle driven through the joint hierarchy.
      </div>
    </div>
  );
}
