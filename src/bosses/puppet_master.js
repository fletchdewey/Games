// src/bosses/puppet_master.js
// BOSS: The Puppet Master — a tiny gleeful alien piloting a headless
// brute body through glowing nerve tendrils.
//
// FLETCHER'S GUIDE:
// This file builds the boss's 3D model (the Lego build). Its brain lives
// next door in puppet_master_ai.js. The gameplay twist: there are TWO
// targets — the big BODY and the tiny PILOT tucked in the neck cavity.
// Dumping bullets into the body barely works; the smart play is to wait
// for the body to stumble (or die) and then shoot the little pilot.
//
// The geometry here is ported straight from the Boss Workshop
// (falo3d-2/boss_workshop.jsx → buildPuppetMaster). The only additions
// are the things the AI needs to drive it: a tendril light, references to
// the pilot's head/arms, and a "hitPart" tag on every mesh so the game
// can tell whether a bullet struck the body or the pilot.

import * as THREE from 'three';
import { PALETTE } from '../shared/materials.js';

export function createPuppetMaster() {
  const g = new THREE.Group();

  // The boss owns its materials (not the shared cache) so hit-flashes and
  // phase glows only affect this one boss.
  const sk = new THREE.MeshLambertMaterial({ color: PALETTE.skinBoss });
  const bn = new THREE.MeshLambertMaterial({ color: PALETTE.bone });
  const gl = new THREE.MeshBasicMaterial({ color: PALETTE.glowGreen });
  const ey = new THREE.MeshBasicMaterial({ color: PALETTE.eyeRed });
  const pilotSk = new THREE.MeshLambertMaterial({ color: 0x3a4a3a });
  const stumpMat = new THREE.MeshLambertMaterial({ color: 0x4a2020 });

  // --- Big headless body ---
  const tG = new THREE.SphereGeometry(0.8, 7, 6); tG.scale(1.1, 1.2, 0.9);
  const torso = new THREE.Mesh(tG, sk);
  torso.position.y = 1.0; torso.rotation.x = 0.3; torso.castShadow = true;
  g.add(torso);

  // --- Neck stump (ragged, open — the head is gone) ---
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.15, 6), stumpMat);
  stump.position.set(0, 1.85, 0.2);
  g.add(stump);

  // --- Tiny pilot sitting in the neck cavity ---
  const pilot = new THREE.Group();
  pilot.position.set(0, 2.0, 0.2);
  g.add(pilot);

  const pbG = new THREE.SphereGeometry(0.15, 6, 5); pbG.scale(1, 1.2, 0.9);
  pilot.add(new THREE.Mesh(pbG, pilotSk));

  const phG = new THREE.SphereGeometry(0.14, 6, 5); phG.scale(1, 0.9, 1.1);
  const pilotHead = new THREE.Mesh(phG, pilotSk);
  pilotHead.position.y = 0.22;
  pilot.add(pilotHead);

  // Beady gleeful eyes
  for (const ex of [-0.06, 0.06]) {
    const pe = new THREE.Mesh(new THREE.SphereGeometry(0.035, 4, 4), ey);
    pe.position.set(ex, 0.24, 0.12);
    pilot.add(pe);
  }

  // A little grin (half-torus flipped over)
  const grin = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 4, 8, Math.PI), ey);
  grin.position.set(0, 0.17, 0.13); grin.rotation.x = Math.PI;
  pilot.add(grin);

  // Tiny arms reaching forward (holding the "reins")
  const pilotArms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.18, 4), pilotSk);
    arm.position.set(side * 0.12, 0.05, 0.12);
    arm.rotation.z = side * 0.8; arm.rotation.x = -0.5;
    pilot.add(arm);
    pilotArms.push(arm);
  }

  // --- Nerve tendrils from pilot down into the body (the puppet strings) ---
  const tendrils = [];
  const tendrilAnchors = [
    { x: -0.08, z: 0.05 }, { x: 0.08, z: 0.05 },
    { x: 0, z: -0.08 }, { x: -0.05, z: 0.1 }, { x: 0.05, z: 0.1 },
  ];
  for (const ta of tendrilAnchors) {
    const segs = [];
    for (let s = 0; s < 4; s++) {
      const tM = new THREE.Mesh(new THREE.SphereGeometry(0.015, 4, 4), gl);
      tM.position.set(ta.x, 1.85 - s * 0.25, 0.2 + ta.z);
      g.add(tM);
      segs.push({ mesh: tM, baseX: ta.x, baseZ: 0.2 + ta.z, seg: s });
    }
    tendrils.push(segs);
  }
  // Green glow the AI brightens in phase 2 and kills when the body dies.
  const tendrilLight = new THREE.PointLight(PALETTE.glowGreen, 1.0, 4);
  tendrilLight.position.set(0, 1.5, 0.2);
  g.add(tendrilLight);

  // --- Body arms (big, limp-looking but functional) ---
  const arms = [];
  for (const side of [-1, 1]) {
    const sp = new THREE.Group(); sp.position.set(side * 0.8, 1.3, 0.1); g.add(sp);
    sp.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5), sk));

    const uG = new THREE.CylinderGeometry(0.13, 0.1, 0.75, 6); uG.translate(0, -0.38, 0);
    const u = new THREE.Mesh(uG, sk); u.rotation.z = side * 0.35; sp.add(u);

    const ep = new THREE.Group(); ep.position.y = -0.75; u.add(ep);
    ep.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 5, 5), sk));

    const fG = new THREE.CylinderGeometry(0.1, 0.14, 0.7, 6); fG.translate(0, -0.35, 0);
    const fore = new THREE.Mesh(fG, sk); fore.rotation.x = -0.4; ep.add(fore);

    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.14, 5, 5), sk);
    fist.position.set(0, -0.7, 0.1); ep.add(fist);

    // `upper` is what the AI's walk cycle swings.
    arms.push({ shoulderPivot: sp, elbowPivot: ep, upper: u, side });
  }

  // --- Legs (parent-child chain so the joints stay connected) ---
  const legs = [];
  for (const lx of [-0.3, 0.3]) {
    const hip = new THREE.Group(); hip.position.set(lx, 0.2, -0.05); g.add(hip);

    const uG = new THREE.CylinderGeometry(0.12, 0.09, 0.5, 5); uG.translate(0, -0.25, 0);
    const upper = new THREE.Mesh(uG, sk); upper.rotation.x = 0.25; hip.add(upper);

    const knee = new THREE.Group(); knee.position.y = -0.5; upper.add(knee);
    knee.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 5, 5), sk));

    const lG = new THREE.CylinderGeometry(0.08, 0.06, 0.5, 5); lG.translate(0, -0.25, 0);
    const lower = new THREE.Mesh(lG, sk); lower.rotation.x = -0.4; knee.add(lower);

    const fg = new THREE.Group(); fg.position.y = -0.5; lower.add(fg);
    const foot = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), bn);
    foot.position.y = -0.09; foot.rotation.x = -0.5; fg.add(foot);

    legs.push({ hip, upper, lower, baseUpper: 0.25, baseLower: -0.4 });
  }

  // Tag every mesh so the game can tell what a bullet hit. Tag the whole
  // tree as 'body' first, then override the pilot subtree to 'pilot'.
  g.traverse((o) => { if (o.isMesh) o.userData.hitPart = 'body'; });
  pilot.traverse((o) => { if (o.isMesh) o.userData.hitPart = 'pilot'; });

  // Everything the AI (puppet_master_ai.js) reaches for lives here.
  g.userData = {
    type: 'puppet_master',
    legs, arms, tendrils, tendrilLight,
    pilotGroup: pilot, pilotHead, pilotArms,
    bodyHitbox: g,
  };

  return g;
}
