import { useState, useEffect, useRef } from "react";
import * as THREE from "three";

const PAL = {
  skin: 0x2a2a32, skinLight: 0x3a3a44, bone: 0xc8b8a0,
  armor: 0x1e1e2a, armorLt: 0x2e2e3e, glow: 0xff2244,
  glowGreen: 0x44ff88, glowPurple: 0xff44cc, glowOrange: 0xffaa22,
  glowCyan: 0x44ccff, eye: 0xff1122, mech: 0x4a5058,
  mechDark: 0x2a2e32, rust: 0x6a4a32, flesh: 0x3a2232,
  crate: 0x5a5040, crateDark: 0x3a3428,
};


// Wrapper for Object.assign that handles readonly Three.js properties
function cfg(obj, props) {
  for (const [k, v] of Object.entries(props)) {
    if (k === 'position') obj.position.copy(v);
    else if (k === 'rotation') obj.rotation.copy(v);
    else obj[k] = v;
  }
  return obj;
}
// =============================================
// ORIGINAL 3
// =============================================

function buildChimera() {
  const g = new THREE.Group();
  const sk = new THREE.MeshLambertMaterial({ color: PAL.skin });
  const bn = new THREE.MeshLambertMaterial({ color: PAL.bone });
  const ar = new THREE.MeshLambertMaterial({ color: PAL.armor });
  const ey = new THREE.MeshBasicMaterial({ color: PAL.eye });
  const gPu = new THREE.MeshBasicMaterial({ color: PAL.glowPurple });
  const gOr = new THREE.MeshBasicMaterial({ color: PAL.glowOrange });

  // Brute torso
  const tGeo = new THREE.SphereGeometry(1.0, 8, 7);
  tGeo.scale(1.2, 1.0, 1.0);
  const torso = new THREE.Mesh(tGeo, sk);
  torso.position.y = 1.2; torso.rotation.x = 0.35;
  g.add(torso);

  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.8-i*0.15, 0.12, 0.5), ar);
    p.position.set(0, 1.0+i*0.35, 0.7-i*0.1); p.rotation.x = -0.2+i*0.15;
    g.add(p);
  }

  // Floater dome
  const domeMat = new THREE.MeshLambertMaterial({ color: PAL.flesh, transparent: true, opacity: 0.6 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6, 0, Math.PI*2, 0, Math.PI*0.55), domeMat);
  dome.position.set(0, 2.35, 0.1); g.add(dome);

  const folds = [];
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.TorusGeometry(0.3-i*0.06, 0.03, 4, 8, Math.PI),
      new THREE.MeshLambertMaterial({ color: 0x4a2850 }));
    f.position.set(0, 2.45+i*0.07, 0.1); f.rotation.x = -Math.PI*0.5; f.rotation.y = i*0.8;
    g.add(f); folds.push(f);
  }

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), gPu);
  core.position.set(0, 2.35, 0.1); g.add(core);
  const coreLight = new THREE.PointLight(0xff44cc, 2, 6);
  coreLight.position.set(0, 2.35, 0.1); g.add(coreLight);

  // Face
  g.add(cfg(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.3), ar), { position: new THREE.Vector3(0, 2.1, 0.55) }));
  for (const ep of [{x:-0.3,y:2.0},{x:0.3,y:2.0},{x:-0.15,y:2.1},{x:0.15,y:2.1},{x:-0.08,y:1.92},{x:0.08,y:1.92}]) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.07,5,5), ar);
    s.position.set(ep.x, ep.y, 0.6); g.add(s);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05,5,5), ey);
    e.position.set(ep.x, ep.y, 0.66); g.add(e);
  }

  // Venom sac
  const sacG = new THREE.SphereGeometry(0.22, 6, 5); sacG.scale(0.8, 1.2, 1);
  const sac = new THREE.Mesh(sacG, new THREE.MeshLambertMaterial({ color: PAL.glowOrange, transparent: true, opacity: 0.5 }));
  sac.position.set(0, 1.65, 0.55); g.add(sac);

  // Crawler legs
  const legs = [];
  for (const side of [-1,1]) {
    for (const angle of [-0.9, 0, 0.9]) {
      const hip = new THREE.Group();
      hip.position.set(side*0.8, 0.6, angle*0.5);
      hip.rotation.z = side*0.9; hip.rotation.y = angle*0.25; g.add(hip);
      const uGeo = new THREE.CylinderGeometry(0.08,0.06,0.9,5); uGeo.translate(0,-0.45,0);
      const upper = new THREE.Mesh(uGeo, sk); upper.rotation.x = 0.3; hip.add(upper);
      const knee = new THREE.Group(); knee.position.y = -0.9; upper.add(knee);
      knee.add(new THREE.Mesh(new THREE.SphereGeometry(0.07,5,5), sk));
      const lGeo = new THREE.CylinderGeometry(0.06,0.035,0.8,5); lGeo.translate(0,-0.4,0);
      const lower = new THREE.Mesh(lGeo, sk); lower.rotation.x = -0.8; knee.add(lower);
      const fGeo = new THREE.ConeGeometry(0.04,0.15,4); fGeo.translate(0,-0.08,0);
      const foot = new THREE.Mesh(fGeo, bn); foot.position.y = -0.8; foot.rotation.x = -0.4; lower.add(foot);
      legs.push({ hip, upper, lower, baseUpper: 0.3, baseLower: -0.8 });
    }
  }

  // Arms
  const arms = [];
  for (const side of [-1,1]) {
    const sp = new THREE.Group(); sp.position.set(side*1.0, 1.6, 0.2); g.add(sp);
    sp.add(new THREE.Mesh(new THREE.SphereGeometry(0.2,6,5), sk));
    const uG = new THREE.CylinderGeometry(0.12,0.1,0.6,6); uG.translate(0,-0.3,0);
    const u = new THREE.Mesh(uG, sk); u.rotation.z = side*0.25; sp.add(u);
    const ep = new THREE.Group(); ep.position.y = -0.6; u.add(ep);
    ep.add(new THREE.Mesh(new THREE.SphereGeometry(0.1,5,5), sk));
    const fG2 = new THREE.CylinderGeometry(0.1,0.13,0.55,6); fG2.translate(0,-0.28,0);
    const fore = new THREE.Mesh(fG2, sk); fore.rotation.x = -0.3; ep.add(fore);
    ep.add(cfg(new THREE.Mesh(new THREE.SphereGeometry(0.13,5,5), sk), { position: new THREE.Vector3(0,-0.55,0.08) }));
    arms.push({ shoulderPivot: sp, elbowPivot: ep, side });
  }

  g.add(new THREE.PointLight(0xff2244, 2.5, 8));
  g.userData = { type:"chimera", legs, arms, dome, core, coreLight, folds, sac };
  return g;
}

function buildHiveQueen() {
  const g = new THREE.Group();
  const sk = new THREE.MeshLambertMaterial({ color: 0x2a2028 });
  const fl = new THREE.MeshLambertMaterial({ color: PAL.flesh });
  const bn = new THREE.MeshLambertMaterial({ color: PAL.bone });
  const ar = new THREE.MeshLambertMaterial({ color: PAL.armor });
  const gl = new THREE.MeshBasicMaterial({ color: PAL.glow });
  const ey = new THREE.MeshBasicMaterial({ color: PAL.eye });
  const sacMat = new THREE.MeshLambertMaterial({ color: 0x442244, transparent: true, opacity: 0.5 });

  // Abdomen
  const abG = new THREE.SphereGeometry(1.2, 8, 7); abG.scale(1.4, 0.7, 1.2);
  const ab = new THREE.Mesh(abG, fl); ab.position.y = 0.3; g.add(ab);

  // Egg sacs
  const sacs = [];
  for (let i = 0; i < 6; i++) {
    const a = (i/6)*Math.PI*2;
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.25+Math.sin(i*2)*0.08, 6, 5), sacMat);
    s.position.set(Math.cos(a)*1.3, 0.15, Math.sin(a)*1.1); g.add(s); sacs.push(s);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.08,4,4), gl);
    inner.position.copy(s.position); g.add(inner);
  }

  // Torso
  const tG = new THREE.SphereGeometry(0.7, 7, 6); tG.scale(1, 1.3, 0.8);
  const torso = new THREE.Mesh(tG, sk); torso.position.y = 1.3; torso.rotation.x = 0.2; g.add(torso);

  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.5-i*0.06, 0.035, 4, 10, Math.PI), ar);
    rib.position.set(0, 1.0+i*0.22, 0.3); rib.rotation.x = -0.1; g.add(rib);
  }

  // Head + crown
  const skull = new THREE.Mesh((() => { const sg = new THREE.SphereGeometry(0.4,7,6); sg.scale(0.85,0.9,1.5); return sg; })(), sk);
  skull.position.set(0, 2.2, 0.15); g.add(skull);
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.4+i*0.08, 4), bn);
    c.position.set((i-2)*0.15, 2.55+Math.abs(i-2)*-0.05, -0.1);
    c.rotation.x = -0.3; c.rotation.z = (i-2)*0.15*0.4; g.add(c);
  }

  for (const ex of [-0.18, 0.18]) {
    g.add(cfg(new THREE.Mesh(new THREE.SphereGeometry(0.1,5,5), ar), { position: new THREE.Vector3(ex, 2.2, 0.5) }));
    g.add(cfg(new THREE.Mesh(new THREE.SphereGeometry(0.07,5,5), ey), { position: new THREE.Vector3(ex, 2.2, 0.56) }));
  }

  // 4 arms
  const arms = [];
  for (const side of [-1,1]) for (let pair = 0; pair < 2; pair++) {
    const sp = new THREE.Group(); sp.position.set(side*0.65, 1.7-pair*0.5, 0.1); g.add(sp);
    sp.add(new THREE.Mesh(new THREE.SphereGeometry(0.12,5,5), sk));
    const uG = new THREE.CylinderGeometry(0.06,0.05,0.7,5); uG.translate(0,-0.35,0);
    const u = new THREE.Mesh(uG, sk); u.rotation.z = side*(0.4+pair*0.2); sp.add(u);
    const ep = new THREE.Group(); ep.position.y = -0.7; u.add(ep);
    ep.add(new THREE.Mesh(new THREE.SphereGeometry(0.055,4,4), sk));
    const fG = new THREE.CylinderGeometry(0.05,0.03,0.6,5); fG.translate(0,-0.3,0);
    ep.add(cfg(new THREE.Mesh(fG, sk), { rotation: new THREE.Euler(-0.4,0,0) }));
    arms.push({ shoulderPivot: sp, elbowPivot: ep, side });
  }

  // Tendrils
  const tendrils = [];
  for (let t = 0; t < 8; t++) {
    const a = (t/8)*Math.PI*2;
    const segs = [];
    for (let s = 0; s < 4; s++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.02, 0.06-s*0.012), 4, 4), fl);
      const bx = Math.cos(a)*(1.0+s*0.3), bz = Math.sin(a)*(0.8+s*0.25);
      m.position.set(bx, -0.1-s*0.1, bz); g.add(m);
      segs.push({ mesh: m, baseX: bx, baseZ: bz, seg: s });
    }
    tendrils.push(segs);
  }

  const aura = new THREE.PointLight(0xff2244, 2, 10); aura.position.set(0,1.5,0); g.add(aura);
  g.userData = { type:"queen", arms, sacs, tendrils, aura };
  return g;
}

function buildMechHybrid() {
  const g = new THREE.Group();
  const sk = new THREE.MeshLambertMaterial({ color: PAL.skin });
  const bn = new THREE.MeshLambertMaterial({ color: PAL.bone });
  const mc = new THREE.MeshLambertMaterial({ color: PAL.mech });
  const md = new THREE.MeshLambertMaterial({ color: PAL.mechDark });
  const ru = new THREE.MeshLambertMaterial({ color: PAL.rust });
  const ey = new THREE.MeshBasicMaterial({ color: PAL.eye });
  const gl = new THREE.MeshBasicMaterial({ color: PAL.glow });
  const gc = new THREE.MeshBasicMaterial({ color: PAL.glowCyan });

  // Torso
  const tG = new THREE.SphereGeometry(0.8, 8, 7); tG.scale(1.1, 1.2, 0.9);
  const torso = new THREE.Mesh(tG, sk); torso.position.y = 1.1; torso.rotation.x = 0.25; g.add(torso);

  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.4), i%2===0? mc : md);
    p.position.set(0.15, 0.7+i*0.28, 0.5); p.rotation.x = -0.15; g.add(p);
  }
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.8,4), ru);
    t.position.set(0.45+i*0.06, 1.1, 0.35); t.rotation.z = 0.15; g.add(t);
  }

  // Head
  const skG = new THREE.SphereGeometry(0.4, 7, 6); skG.scale(0.85, 0.9, 1.3);
  g.add(cfg(new THREE.Mesh(skG, sk), { position: new THREE.Vector3(0, 2.05, 0.2) }));
  const hpG = new THREE.SphereGeometry(0.38, 6, 5, 0, Math.PI); hpG.scale(0.8, 0.85, 1.2);
  const hp = new THREE.Mesh(hpG, mc); hp.position.set(0.05, 2.07, 0.22); hp.rotation.y = -0.3; g.add(hp);

  // Eyes
  g.add(cfg(new THREE.Mesh(new THREE.SphereGeometry(0.055,5,5), ey), { position: new THREE.Vector3(-0.2, 2.0, 0.6) }));
  const mechEye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.04), gc);
  mechEye.position.set(0.2, 2.0, 0.58); g.add(mechEye);
  const scanLight = new THREE.PointLight(0x44ccff, 1.5, 4); scanLight.position.set(0.2, 2.0, 0.7); g.add(scanLight);

  // Organic arm (left)
  const oaPivot = new THREE.Group(); oaPivot.position.set(-0.85, 1.5, 0.1); g.add(oaPivot);
  oaPivot.add(new THREE.Mesh(new THREE.SphereGeometry(0.22,6,5), sk));
  const ouG = new THREE.CylinderGeometry(0.15,0.12,0.8,6); ouG.translate(0,-0.4,0);
  const ou = new THREE.Mesh(ouG, sk); ou.rotation.z = -0.3; oaPivot.add(ou);
  const oElbow = new THREE.Group(); oElbow.position.y = -0.8; ou.add(oElbow);
  oElbow.add(new THREE.Mesh(new THREE.SphereGeometry(0.12,5,5), sk));
  const ofG = new THREE.CylinderGeometry(0.12,0.16,0.8,6); ofG.translate(0,-0.4,0);
  oElbow.add(cfg(new THREE.Mesh(ofG, sk), { rotation: new THREE.Euler(-0.3,0,0) }));
  oElbow.add(cfg(new THREE.Mesh(new THREE.SphereGeometry(0.16,5,5), sk), { position: new THREE.Vector3(0,-0.8,0.12) }));

  // Mech arm (right) — cannon
  const maPivot = new THREE.Group(); maPivot.position.set(0.85, 1.5, 0.1); g.add(maPivot);
  maPivot.add(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.3), mc));
  const muG = new THREE.CylinderGeometry(0.12,0.1,0.7,6); muG.translate(0,-0.35,0);
  const mu = new THREE.Mesh(muG, md); mu.rotation.z = 0.3; maPivot.add(mu);
  const mElbow = new THREE.Group(); mElbow.position.y = -0.7; mu.add(mElbow);
  mElbow.add(new THREE.Mesh(new THREE.BoxGeometry(0.15,0.15,0.15), ru));
  const bG = new THREE.CylinderGeometry(0.1,0.08,1.0,6); bG.translate(0,-0.5,0);
  mElbow.add(cfg(new THREE.Mesh(bG, mc), { rotation: new THREE.Euler(-0.2,0,0) }));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06,5,5), gl);
  tip.position.set(0, -1.0, 0.1); mElbow.add(tip);

  // Legs
  const legs = [];
  for (const lx of [-0.35, 0.35]) {
    const side = lx > 0 ? 1 : -1;
    const hip = new THREE.Group(); hip.position.set(lx, 0.3, -0.05); g.add(hip);
    const mat = side < 0 ? sk : md;
    const uG2 = new THREE.CylinderGeometry(0.12,0.09,0.6,6); uG2.translate(0,-0.3,0);
    const upper = new THREE.Mesh(uG2, mat); upper.rotation.x = 0.3; hip.add(upper);
    const knee = new THREE.Group(); knee.position.y = -0.6; upper.add(knee);
    knee.add(new THREE.Mesh(new THREE.SphereGeometry(0.09,5,5), side < 0 ? sk : ru));
    const lG = new THREE.CylinderGeometry(0.08,0.06,0.6,5); lG.translate(0,-0.3,0);
    const lower = new THREE.Mesh(lG, mat); lower.rotation.x = -0.5; knee.add(lower);
    const fg = new THREE.Group(); fg.position.y = -0.6; lower.add(fg);
    if (side < 0) {
      const fG = new THREE.ConeGeometry(0.06,0.18,4); fG.translate(0,-0.09,0);
      fg.add(cfg(new THREE.Mesh(fG, bn), { rotation: new THREE.Euler(-0.5,0,0) }));
    } else {
      fg.add(new THREE.Mesh(new THREE.BoxGeometry(0.18,0.06,0.22), mc));
    }
    legs.push({ hip, upper, lower, baseUpper: 0.3, baseLower: -0.5, side });
  }

  for (let s = 0; s < 4; s++) {
    const r = new THREE.Mesh(new THREE.ConeGeometry(0.06,0.3,4), bn);
    r.position.set(-0.1, 0.7+s*0.3, -0.45); r.rotation.x = -0.5; g.add(r);
  }

  g.add(new THREE.PointLight(0xff2244, 2, 8));
  g.userData = { type:"mech", legs, orgArmPivot: oaPivot, orgElbow: oElbow, mechArmPivot: maPivot, mechElbow: mElbow, scanLight, tip };
  return g;
}

// =============================================
// WILD CARDS
// =============================================

function buildPuppetMaster() {
  const g = new THREE.Group();
  const sk = new THREE.MeshLambertMaterial({ color: PAL.skin });
  const bn = new THREE.MeshLambertMaterial({ color: PAL.bone });
  const ar = new THREE.MeshLambertMaterial({ color: PAL.armor });
  const gl = new THREE.MeshBasicMaterial({ color: PAL.glowGreen });
  const ey = new THREE.MeshBasicMaterial({ color: PAL.eye });
  const pilotSk = new THREE.MeshLambertMaterial({ color: 0x3a4a3a });

  // Big headless body
  const tG = new THREE.SphereGeometry(0.8, 7, 6); tG.scale(1.1, 1.2, 0.9);
  const torso = new THREE.Mesh(tG, sk); torso.position.y = 1.0; torso.rotation.x = 0.3; g.add(torso);

  // Neck stump (ragged, open)
  const stumpG = new THREE.CylinderGeometry(0.25, 0.2, 0.15, 6);
  const stump = new THREE.Mesh(stumpG, new THREE.MeshLambertMaterial({ color: 0x4a2020 }));
  stump.position.set(0, 1.85, 0.2); g.add(stump);

  // === TINY PILOT sitting in neck cavity ===
  const pilot = new THREE.Group();
  pilot.position.set(0, 2.0, 0.2);
  g.add(pilot);

  // Pilot body (small)
  const pbG = new THREE.SphereGeometry(0.15, 6, 5); pbG.scale(1, 1.2, 0.9);
  pilot.add(new THREE.Mesh(pbG, pilotSk));

  // Pilot head (big relative to its body, comically oversized)
  const phG = new THREE.SphereGeometry(0.14, 6, 5); phG.scale(1, 0.9, 1.1);
  const pilotHead = new THREE.Mesh(phG, pilotSk);
  pilotHead.position.y = 0.22; pilot.add(pilotHead);

  // Pilot eyes (beady, gleeful)
  for (const ex of [-0.06, 0.06]) {
    const pe = new THREE.Mesh(new THREE.SphereGeometry(0.035, 4, 4), ey);
    pe.position.set(ex, 0.24, 0.12); pilot.add(pe);
  }

  // Pilot grin
  const grinG = new THREE.TorusGeometry(0.05, 0.012, 4, 8, Math.PI);
  const grin = new THREE.Mesh(grinG, ey);
  grin.position.set(0, 0.17, 0.13); grin.rotation.x = Math.PI; pilot.add(grin);

  // Pilot tiny arms reaching forward (holding reins)
  for (const side of [-1, 1]) {
    const armG = new THREE.CylinderGeometry(0.02, 0.015, 0.18, 4);
    const arm = new THREE.Mesh(armG, pilotSk);
    arm.position.set(side * 0.12, 0.05, 0.12);
    arm.rotation.z = side * 0.8; arm.rotation.x = -0.5;
    pilot.add(arm);
  }

  // Nerve tendrils from pilot down into body (puppet strings)
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
      g.add(tM); segs.push({ mesh: tM, baseX: ta.x, baseZ: 0.2 + ta.z, seg: s });
    }
    tendrils.push(segs);
  }

  // Body arms (big, limp-looking but functional)
  const arms = [];
  for (const side of [-1, 1]) {
    const sp = new THREE.Group(); sp.position.set(side * 0.8, 1.3, 0.1); g.add(sp);
    sp.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5), sk));
    const uG = new THREE.CylinderGeometry(0.13, 0.1, 0.75, 6); uG.translate(0, -0.38, 0);
    const u = new THREE.Mesh(uG, sk); u.rotation.z = side * 0.35; sp.add(u);
    const ep = new THREE.Group(); ep.position.y = -0.75; u.add(ep);
    ep.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 5, 5), sk));
    const fG = new THREE.CylinderGeometry(0.1, 0.14, 0.7, 6); fG.translate(0, -0.35, 0);
    ep.add(cfg(new THREE.Mesh(fG, sk), { rotation: new THREE.Euler(-0.4, 0, 0) }));
    ep.add(cfg(new THREE.Mesh(new THREE.SphereGeometry(0.14, 5, 5), sk), { position: new THREE.Vector3(0, -0.7, 0.1) }));
    arms.push({ shoulderPivot: sp, elbowPivot: ep, side });
  }

  // Legs
  const legs = [];
  for (const lx of [-0.3, 0.3]) {
    const hip = new THREE.Group(); hip.position.set(lx, 0.2, -0.05); g.add(hip);
    const uG = new THREE.CylinderGeometry(0.12, 0.09, 0.5, 5); uG.translate(0, -0.25, 0);
    const upper = new THREE.Mesh(uG, sk); upper.rotation.x = 0.25; hip.add(upper);
    const knee = new THREE.Group(); knee.position.y = -0.5; upper.add(knee);
    knee.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 5, 5), sk));
    const lG = new THREE.CylinderGeometry(0.08, 0.06, 0.5, 5); lG.translate(0, -0.25, 0);
    const lower = new THREE.Mesh(lG, sk); lower.rotation.x = -0.4; knee.add(lower);
    const fG2 = new THREE.ConeGeometry(0.06, 0.18, 4); fG2.translate(0, -0.09, 0);
    const fg = new THREE.Group(); fg.position.y = -0.5; lower.add(fg);
    fg.add(cfg(new THREE.Mesh(fG2, bn), { rotation: new THREE.Euler(-0.5, 0, 0) }));
    legs.push({ hip, upper, lower, baseUpper: 0.25, baseLower: -0.4 });
  }

  g.userData = { type: "puppet", legs, arms, pilot, tendrils };
  return g;
}

function buildSwarm() {
  const g = new THREE.Group();
  const gl = new THREE.MeshBasicMaterial({ color: PAL.glow });
  const sk = new THREE.MeshLambertMaterial({ color: PAL.skin });
  const ey = new THREE.MeshBasicMaterial({ color: PAL.eye });

  // Humanoid shape made of floating particles
  const particles = [];
  // Define humanoid silhouette as regions
  const regions = [
    // Head
    ...Array.from({ length: 15 }, () => ({
      x: (Math.random() - 0.5) * 0.5, y: 2.0 + (Math.random() - 0.5) * 0.4,
      z: (Math.random() - 0.5) * 0.4, r: 0.04 + Math.random() * 0.03, isEye: false,
    })),
    // Torso
    ...Array.from({ length: 25 }, () => ({
      x: (Math.random() - 0.5) * 0.7, y: 1.0 + Math.random() * 0.8,
      z: (Math.random() - 0.5) * 0.5, r: 0.04 + Math.random() * 0.04, isEye: false,
    })),
    // Left arm
    ...Array.from({ length: 10 }, (_, i) => ({
      x: -0.5 - i * 0.08 + (Math.random() - 0.5) * 0.15,
      y: 1.4 - i * 0.06 + (Math.random() - 0.5) * 0.1,
      z: (Math.random() - 0.5) * 0.2, r: 0.03 + Math.random() * 0.025, isEye: false,
    })),
    // Right arm
    ...Array.from({ length: 10 }, (_, i) => ({
      x: 0.5 + i * 0.08 + (Math.random() - 0.5) * 0.15,
      y: 1.4 - i * 0.06 + (Math.random() - 0.5) * 0.1,
      z: (Math.random() - 0.5) * 0.2, r: 0.03 + Math.random() * 0.025, isEye: false,
    })),
    // Left leg
    ...Array.from({ length: 10 }, (_, i) => ({
      x: -0.2 + (Math.random() - 0.5) * 0.2,
      y: 0.8 - i * 0.1 + (Math.random() - 0.5) * 0.05,
      z: (Math.random() - 0.5) * 0.2, r: 0.035 + Math.random() * 0.03, isEye: false,
    })),
    // Right leg
    ...Array.from({ length: 10 }, (_, i) => ({
      x: 0.2 + (Math.random() - 0.5) * 0.2,
      y: 0.8 - i * 0.1 + (Math.random() - 0.5) * 0.05,
      z: (Math.random() - 0.5) * 0.2, r: 0.035 + Math.random() * 0.03, isEye: false,
    })),
  ];

  // Eyes in the head area
  regions.push({ x: -0.12, y: 2.05, z: 0.2, r: 0.06, isEye: true });
  regions.push({ x: 0.12, y: 2.05, z: 0.2, r: 0.06, isEye: true });

  for (const p of regions) {
    const mat = p.isEye ? ey : (Math.random() > 0.8 ? gl : sk);
    const pGeo = new THREE.SphereGeometry(p.r, 4, 4);
    const mesh = new THREE.Mesh(pGeo, mat);
    mesh.position.set(p.x, p.y, p.z);
    g.add(mesh);
    particles.push({ mesh, baseX: p.x, baseY: p.y, baseZ: p.z, phase: Math.random() * Math.PI * 2 });
  }

  const aura = new THREE.PointLight(0xff2244, 1.5, 6); aura.position.set(0, 1.2, 0); g.add(aura);
  g.userData = { type: "swarm", particles, aura };
  return g;
}

function buildMimic() {
  const g = new THREE.Group();
  const fleshMat = new THREE.MeshLambertMaterial({ color: 0x1a1a22 });
  const corruptMat = new THREE.MeshLambertMaterial({ color: 0x2a1a2a });
  const veinMat = new THREE.MeshBasicMaterial({ color: 0x440022 });
  const ey = new THREE.MeshBasicMaterial({ color: PAL.eye });
  const gl = new THREE.MeshBasicMaterial({ color: PAL.glow });

  // Spartan-shaped silhouette but WRONG — slightly too tall, arms too long, proportions off
  // Helmet shape
  const helmG = new THREE.SphereGeometry(0.35, 7, 6); helmG.scale(0.9, 1.0, 1.1);
  const helm = new THREE.Mesh(helmG, fleshMat);
  helm.position.set(0, 2.1, 0); g.add(helm);

  // Visor (single glowing slit)
  const visorG = new THREE.BoxGeometry(0.4, 0.08, 0.06);
  const visor = new THREE.Mesh(visorG, ey);
  visor.position.set(0, 2.08, 0.35); g.add(visor);

  // Torso — humanoid but lumpy, organic
  const tG = new THREE.CylinderGeometry(0.35, 0.3, 1.0, 7);
  const torso = new THREE.Mesh(tG, fleshMat);
  torso.position.y = 1.4; g.add(torso);

  // Chest piece (mimicking armor)
  const chestG = new THREE.BoxGeometry(0.6, 0.5, 0.25);
  const chest = new THREE.Mesh(chestG, corruptMat);
  chest.position.set(0, 1.5, 0.2); g.add(chest);

  // Veins crawling across surface
  const veins = [];
  for (let i = 0; i < 8; i++) {
    const vG = new THREE.CylinderGeometry(0.015, 0.01, 0.3 + Math.random() * 0.4, 4);
    const vein = new THREE.Mesh(vG, veinMat);
    vein.position.set((Math.random() - 0.5) * 0.5, 1.0 + Math.random() * 1.0, 0.25 + Math.random() * 0.1);
    vein.rotation.z = (Math.random() - 0.5) * 1.5;
    vein.rotation.x = (Math.random() - 0.5) * 0.5;
    g.add(vein); veins.push(vein);
  }

  // Arms — too long, wrong angle
  const arms = [];
  for (const side of [-1, 1]) {
    const sp = new THREE.Group(); sp.position.set(side * 0.4, 1.7, 0); g.add(sp);
    sp.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 5), corruptMat));
    const uG = new THREE.CylinderGeometry(0.08, 0.07, 0.85, 5); uG.translate(0, -0.43, 0);
    const u = new THREE.Mesh(uG, fleshMat); u.rotation.z = side * 0.15; sp.add(u);
    const ep = new THREE.Group(); ep.position.y = -0.85; u.add(ep);
    ep.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 5), fleshMat));
    const fG = new THREE.CylinderGeometry(0.07, 0.05, 0.9, 5); fG.translate(0, -0.45, 0);
    ep.add(cfg(new THREE.Mesh(fG, fleshMat), { rotation: new THREE.Euler(-0.2, 0, 0) }));
    // Fingers that are too long, claw-like
    for (let f = -1; f <= 1; f++) {
      const clG = new THREE.ConeGeometry(0.015, 0.25, 3);
      const claw = new THREE.Mesh(clG, corruptMat);
      claw.position.set(f * 0.03, -0.9, 0.1); claw.rotation.x = -0.4;
      ep.add(claw);
    }
    arms.push({ shoulderPivot: sp, elbowPivot: ep, side });
  }

  // Legs
  const legs = [];
  for (const lx of [-0.18, 0.18]) {
    const hip = new THREE.Group(); hip.position.set(lx, 0.85, 0); g.add(hip);
    const uG = new THREE.CylinderGeometry(0.1, 0.08, 0.6, 5); uG.translate(0, -0.3, 0);
    const upper = new THREE.Mesh(uG, fleshMat); upper.rotation.x = 0.15; hip.add(upper);
    const knee = new THREE.Group(); knee.position.y = -0.6; upper.add(knee);
    knee.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 5, 5), fleshMat));
    const lG = new THREE.CylinderGeometry(0.07, 0.06, 0.6, 5); lG.translate(0, -0.3, 0);
    const lower = new THREE.Mesh(lG, fleshMat); lower.rotation.x = -0.3; knee.add(lower);
    const fG = new THREE.BoxGeometry(0.14, 0.06, 0.2);
    const fg = new THREE.Group(); fg.position.y = -0.6; lower.add(fg);
    fg.add(new THREE.Mesh(fG, corruptMat));
    legs.push({ hip, upper, lower, baseUpper: 0.15, baseLower: -0.3 });
  }

  // Glow patches where the "armor" cracks
  for (const p of [{x:0,y:1.7,z:0.35},{x:-0.2,y:1.3,z:0.3},{x:0.2,y:1.3,z:0.3}]) {
    g.add(cfg(new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), gl), { position: new THREE.Vector3(p.x,p.y,p.z) }));
  }

  g.add(new THREE.PointLight(0xff1122, 1.5, 6));
  g.userData = { type: "mimic", legs, arms, veins, visor };
  return g;
}

function buildBurrower() {
  const g = new THREE.Group();
  const sk = new THREE.MeshLambertMaterial({ color: 0x3a2a2a });
  const bn = new THREE.MeshLambertMaterial({ color: PAL.bone });
  const gl = new THREE.MeshBasicMaterial({ color: PAL.glow });
  const ey = new THREE.MeshBasicMaterial({ color: PAL.eye });
  const floorMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

  // Ground plane with crack
  const groundG = new THREE.RingGeometry(0.3, 2.5, 16);
  const ground = new THREE.Mesh(groundG, floorMat);
  ground.rotation.x = -Math.PI * 0.5; ground.position.y = -0.3; g.add(ground);

  // Worm segments arcing out of ground
  const segments = [];
  const arcPoints = 12;
  for (let i = 0; i < arcPoints; i++) {
    const t = i / (arcPoints - 1);
    const arcY = Math.sin(t * Math.PI) * 1.8 - 0.3;
    const arcX = (t - 0.5) * 3.0;
    const radius = 0.3 - Math.abs(t - 0.5) * 0.2;
    const sG = new THREE.SphereGeometry(radius, 7, 6);
    sG.scale(1, 1, 1.3);
    const seg = new THREE.Mesh(sG, sk);
    seg.position.set(arcX, arcY, 0);
    if (arcY > -0.25) {
      g.add(seg);
      segments.push({ mesh: seg, baseX: arcX, baseY: arcY, t });
    }

    // Ridges on each visible segment
    if (arcY > -0.1 && i % 2 === 0) {
      const rG = new THREE.TorusGeometry(radius + 0.05, 0.025, 4, 8);
      const ridge = new THREE.Mesh(rG, bn);
      ridge.position.set(arcX, arcY, 0);
      ridge.rotation.y = Math.PI * 0.5;
      g.add(ridge);
    }
  }

  // Head — ring of teeth emerging at one end
  const headPos = { x: 1.3, y: 0.1 };
  const mouthG = new THREE.TorusGeometry(0.28, 0.06, 6, 10);
  const mouth = new THREE.Mesh(mouthG, new THREE.MeshLambertMaterial({ color: 0x4a1a1a }));
  mouth.position.set(headPos.x, headPos.y, 0);
  mouth.rotation.y = Math.PI * 0.5;
  mouth.rotation.x = 0.3;
  g.add(mouth);

  // Teeth ring
  for (let t = 0; t < 10; t++) {
    const a = (t / 10) * Math.PI * 2;
    const tG = new THREE.ConeGeometry(0.025, 0.15, 3);
    const tooth = new THREE.Mesh(tG, bn);
    tooth.position.set(headPos.x + 0.15, headPos.y + Math.sin(a) * 0.25, Math.cos(a) * 0.25);
    tooth.rotation.z = -Math.PI * 0.5;
    g.add(tooth);
  }

  // Eyes inside mouth (deep set, glowing)
  for (const ey2 of [0.08, -0.08]) {
    const eG = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 5), ey);
    eG.position.set(headPos.x - 0.05, headPos.y + ey2, ey2);
    g.add(eG);
  }

  // Glow along body
  for (let i = 2; i < arcPoints - 2; i += 2) {
    const t = i / (arcPoints - 1);
    const y = Math.sin(t * Math.PI) * 1.8 - 0.3;
    const x = (t - 0.5) * 3.0;
    if (y > 0) {
      const gM = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), gl);
      gM.position.set(x, y + 0.15, 0.2); g.add(gM);
    }
  }

  // Debris around holes
  for (let i = 0; i < 6; i++) {
    const dG = new THREE.BoxGeometry(0.1 + Math.random() * 0.15, 0.06, 0.1 + Math.random() * 0.1);
    const debris = new THREE.Mesh(dG, floorMat);
    const side = i < 3 ? -1 : 1;
    debris.position.set(side * 1.4 + (Math.random() - 0.5) * 0.4, -0.25, (Math.random() - 0.5) * 0.5);
    debris.rotation.set(Math.random(), Math.random(), Math.random());
    g.add(debris);
  }

  g.add(new THREE.PointLight(0xff2244, 1.5, 8));
  g.userData = { type: "burrower", segments };
  return g;
}

function buildTrojan() {
  const g = new THREE.Group();
  const crateMat = new THREE.MeshLambertMaterial({ color: PAL.crate });
  const crateDk = new THREE.MeshLambertMaterial({ color: PAL.crateDark });
  const sk = new THREE.MeshLambertMaterial({ color: PAL.skin });
  const ey = new THREE.MeshBasicMaterial({ color: PAL.eye });
  const gl = new THREE.MeshBasicMaterial({ color: PAL.glow });

  // Main crate body (partially open, splitting apart)
  // Left panel
  const panelL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, 0.9), crateMat);
  panelL.position.set(-0.55, 0.8, 0); panelL.rotation.z = -0.15; g.add(panelL);

  // Right panel
  const panelR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, 0.9), crateMat);
  panelR.position.set(0.55, 0.8, 0); panelR.rotation.z = 0.15; g.add(panelR);

  // Back panel
  const panelB = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, 0.05), crateDk);
  panelB.position.set(0, 0.8, -0.45); g.add(panelB);

  // Lid (tilted open)
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.95), crateMat);
  lid.position.set(0, 1.5, -0.2); lid.rotation.x = -0.4; g.add(lid);

  // Bottom
  g.add(cfg(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.9), crateDk), { position: new THREE.Vector3(0, 0.15, 0) }));

  // Shipping straps
  for (const sy of [0.5, 1.1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, 0.96), new THREE.MeshLambertMaterial({ color: 0x3a3a2a }));
    strap.position.set(0, sy, 0); g.add(strap);
  }

  // === Alien guts spilling out ===
  // Eyes peeking through crate gaps
  for (const ep of [{x:-0.52,y:1.0,z:0.2},{x:0.52,y:0.9,z:-0.1},{x:0.1,y:1.48,z:0.1}]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 5), ey);
    e.position.set(ep.x, ep.y, ep.z); g.add(e);
  }

  // Flesh bulging through gaps
  for (const fp of [{x:-0.48,y:0.7,z:0.3,r:0.12},{x:0.48,y:0.6,z:-0.2,r:0.1},{x:0,y:1.45,z:0.3,r:0.15}]) {
    const fG = new THREE.SphereGeometry(fp.r, 5, 5);
    const flesh = new THREE.Mesh(fG, sk);
    flesh.position.set(fp.x, fp.y, fp.z); g.add(flesh);
  }

  // Legs folded under (partially visible)
  const legs = [];
  for (const lx of [-0.3, 0.3]) {
    const hip = new THREE.Group(); hip.position.set(lx, 0.1, 0.2); g.add(hip);
    const uG = new THREE.CylinderGeometry(0.08, 0.06, 0.4, 5); uG.translate(0, -0.2, 0);
    const upper = new THREE.Mesh(uG, sk); upper.rotation.x = 0.8; hip.add(upper);
    const knee = new THREE.Group(); knee.position.y = -0.4; upper.add(knee);
    knee.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 4), sk));
    const lG = new THREE.CylinderGeometry(0.06, 0.04, 0.35, 5); lG.translate(0, -0.18, 0);
    const lower = new THREE.Mesh(lG, sk); lower.rotation.x = -1.2; knee.add(lower);
    legs.push({ hip, upper, lower, baseUpper: 0.8, baseLower: -1.2 });
  }

  // Tentacle reaching out from top
  const tentSegs = [];
  for (let s = 0; s < 5; s++) {
    const tG = new THREE.SphereGeometry(0.04 - s * 0.005, 4, 4);
    const tM = new THREE.Mesh(tG, sk);
    tM.position.set(0.15 + s * 0.12, 1.5 + s * 0.05, 0.2 + s * 0.08);
    g.add(tM);
    tentSegs.push({ mesh: tM, baseX: tM.position.x, baseY: tM.position.y, baseZ: tM.position.z, seg: s });
  }

  // Glow from inside
  g.add(cfg(new THREE.Mesh(new THREE.SphereGeometry(0.08, 4, 4), gl), { position: new THREE.Vector3(0, 0.8, 0.3) }));
  g.add(new THREE.PointLight(0xff2244, 1, 3));

  g.userData = { type: "trojan", legs, tentSegs };
  return g;
}

function buildTwins() {
  const g = new THREE.Group();
  const sk1 = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
  const sk2 = new THREE.MeshLambertMaterial({ color: 0x3a2a2a });
  const bn = new THREE.MeshLambertMaterial({ color: PAL.bone });
  const ey = new THREE.MeshBasicMaterial({ color: PAL.eye });
  const gl = new THREE.MeshBasicMaterial({ color: PAL.glow });
  const tethMat = new THREE.MeshBasicMaterial({ color: PAL.glowPurple });

  function buildTwin(skinMat, xOff, facingZ) {
    const twin = new THREE.Group();

    // Torso
    const tG = new THREE.SphereGeometry(0.5, 7, 6); tG.scale(1, 1.1, 0.85);
    const torso = new THREE.Mesh(tG, skinMat);
    torso.position.y = 1.0; torso.rotation.x = facingZ > 0 ? 0.2 : -0.2;
    twin.add(torso);

    // Head
    const hG = new THREE.SphereGeometry(0.28, 6, 5); hG.scale(0.85, 0.9, 1.2);
    const head = new THREE.Mesh(hG, skinMat);
    head.position.set(0, 1.65, facingZ * 0.15); twin.add(head);

    // Brow
    twin.add(cfg(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.18),
      new THREE.MeshLambertMaterial({ color: PAL.armor })),
      { position: new THREE.Vector3(0, 1.72, facingZ * 0.35) }));

    // Eyes
    for (const ex of [-0.12, 0.12]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), ey);
      e.position.set(ex, 1.65, facingZ * 0.4); twin.add(e);
    }

    // Mandibles
    for (const mx of [-0.1, 0.1]) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.2, 4), bn);
      m.position.set(mx, 1.45, facingZ * 0.4);
      m.rotation.x = facingZ > 0 ? 0.4 : -0.4;
      m.rotation.z = mx > 0 ? -0.3 : 0.3; twin.add(m);
    }

    // Arms
    const arms = [];
    for (const side of [-1, 1]) {
      const sp = new THREE.Group(); sp.position.set(side * 0.5, 1.3, 0); twin.add(sp);
      sp.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 5, 5), skinMat));
      const uG = new THREE.CylinderGeometry(0.07, 0.06, 0.55, 5); uG.translate(0, -0.28, 0);
      const u = new THREE.Mesh(uG, skinMat); u.rotation.z = side * 0.35; sp.add(u);
      const ep = new THREE.Group(); ep.position.y = -0.55; u.add(ep);
      ep.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 4), skinMat));
      const fG = new THREE.CylinderGeometry(0.06, 0.04, 0.5, 5); fG.translate(0, -0.25, 0);
      ep.add(cfg(new THREE.Mesh(fG, skinMat), { rotation: new THREE.Euler(-0.3, 0, 0) }));
      arms.push({ shoulderPivot: sp, elbowPivot: ep, side });
    }

    // Legs
    const legs = [];
    for (const lx of [-0.2, 0.2]) {
      const hip = new THREE.Group(); hip.position.set(lx, 0.3, 0); twin.add(hip);
      const uG = new THREE.CylinderGeometry(0.08, 0.06, 0.45, 5); uG.translate(0, -0.23, 0);
      const upper = new THREE.Mesh(uG, skinMat); upper.rotation.x = facingZ > 0 ? 0.2 : -0.2; hip.add(upper);
      const knee = new THREE.Group(); knee.position.y = -0.45; upper.add(knee);
      knee.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 4), skinMat));
      const lG = new THREE.CylinderGeometry(0.05, 0.04, 0.4, 5); lG.translate(0, -0.2, 0);
      const lower = new THREE.Mesh(lG, skinMat); lower.rotation.x = facingZ > 0 ? -0.35 : 0.35; knee.add(lower);
      const fg = new THREE.Group(); fg.position.y = -0.4; lower.add(fg);
      fg.add(cfg(new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), bn),
        { rotation: new THREE.Euler(-0.5, 0, 0) }));
      legs.push({ hip, upper, lower, baseUpper: facingZ > 0 ? 0.2 : -0.2, baseLower: facingZ > 0 ? -0.35 : 0.35 });
    }

    twin.position.x = xOff;
    return { group: twin, arms, legs };
  }

  const twin1 = buildTwin(sk1, -0.6, 1);
  const twin2 = buildTwin(sk2, 0.6, -1);
  g.add(twin1.group);
  g.add(twin2.group);

  // Energy tether between them
  const tether = [];
  for (let s = 0; s < 8; s++) {
    const t = s / 7;
    const x = -0.6 + t * 1.2;
    const tG = new THREE.SphereGeometry(0.04 + Math.sin(t * Math.PI) * 0.03, 4, 4);
    const tM = new THREE.Mesh(tG, tethMat);
    tM.position.set(x, 1.0, 0);
    g.add(tM);
    tether.push({ mesh: tM, baseX: x, t });
  }

  const tetherLight = new THREE.PointLight(0xff44cc, 1.5, 5);
  tetherLight.position.set(0, 1.0, 0); g.add(tetherLight);
  g.add(new THREE.PointLight(0xff2244, 1, 6));

  g.userData = { type: "twins", twin1, twin2, tether, tetherLight };
  return g;
}

// =============================================
// ANIMATION
// =============================================

function animateBoss(model, time) {
  const d = model.userData;

  // Shared walk helper
  function walkLegs(legs, speed, amp) {
    legs.forEach((leg, i) => {
      const phase = (i / legs.length) * Math.PI * 2;
      const cycle = Math.sin(time * speed + phase);
      leg.upper.rotation.x = (leg.baseUpper || 0) + cycle * amp;
      leg.lower.rotation.x = (leg.baseLower || 0) - Math.abs(cycle) * amp * 0.6;
    });
  }
  function swingArms(arms, speed) {
    arms.forEach((arm, i) => {
      const swing = Math.sin(time * speed + (arm.side > 0 ? Math.PI : 0) + i * 0.5);
      arm.shoulderPivot.rotation.x = swing * 0.2;
      arm.elbowPivot.rotation.x = -0.3 + Math.abs(swing) * 0.15;
    });
  }

  if (d.type === "chimera") {
    walkLegs(d.legs, 4, 0.2);
    swingArms(d.arms, 2.5);
    if (d.dome) { const p = 1 + Math.sin(time * 3.5) * 0.06; d.dome.scale.set(p, 0.9 * p, p); }
    if (d.core) d.core.scale.setScalar(1 + Math.sin(time * 6) * 0.08);
    if (d.coreLight) d.coreLight.intensity = 2 + Math.sin(time * 6);
    if (d.sac) { const t = 1 + Math.sin(time * 2.5) * 0.12; d.sac.scale.set(0.8 * t, 1.2 * t, t); }
    model.position.y = Math.abs(Math.sin(time * 8)) * 0.02;
  }

  if (d.type === "queen") {
    swingArms(d.arms, 1.5);
    if (d.sacs) d.sacs.forEach((s, i) => s.scale.setScalar(1 + Math.sin(time * 2 + i) * 0.15));
    if (d.tendrils) d.tendrils.forEach((segs, ti) => segs.forEach(s => {
      s.mesh.position.x = s.baseX + Math.sin(time * 1.8 + s.seg * 0.7 + ti * 0.9) * 0.08 * (s.seg + 1);
      s.mesh.position.z = s.baseZ + Math.cos(time * 1.5 + ti) * 0.04 * s.seg;
    }));
    if (d.aura) d.aura.intensity = 2 + Math.sin(time * 2) * 0.8;
    model.rotation.z = Math.sin(time * 0.8) * 0.02;
  }

  if (d.type === "mech") {
    walkLegs(d.legs, 3, 0.2);
    if (d.orgArmPivot) { d.orgArmPivot.rotation.x = Math.sin(time * 2.5) * 0.2; d.orgElbow.rotation.x = -0.3 + Math.abs(Math.sin(time * 2.5)) * 0.15; }
    if (d.mechArmPivot) { d.mechArmPivot.rotation.x = Math.sin(time * 1.5) * 0.1; d.mechElbow.rotation.x = -0.2 + Math.sin(time * 2) * 0.08; }
    if (d.scanLight) d.scanLight.intensity = 1.5 + Math.sin(time * 8) * 0.5;
    if (d.tip) d.tip.scale.setScalar(1 + Math.sin(time * 5) * 0.2);
    model.position.y = Math.abs(Math.sin(time * 6)) * 0.02;
  }

  if (d.type === "puppet") {
    walkLegs(d.legs, 3.5, 0.2);
    swingArms(d.arms, 2);
    // Pilot bounces and sways
    if (d.pilot) {
      d.pilot.rotation.z = Math.sin(time * 3.5) * 0.15;
      d.pilot.position.y = 2.0 + Math.sin(time * 7) * 0.03;
    }
    // Tendrils pulse
    if (d.tendrils) d.tendrils.forEach((segs, ti) => segs.forEach(s => {
      s.mesh.position.x = s.baseX + Math.sin(time * 3 + s.seg * 0.5 + ti) * 0.03;
      s.mesh.position.z = s.baseZ + Math.cos(time * 2.5 + ti) * 0.02;
    }));
    model.position.y = Math.abs(Math.sin(time * 7)) * 0.02;
  }

  if (d.type === "swarm") {
    if (d.particles) d.particles.forEach(p => {
      const drift = 0.06;
      p.mesh.position.x = p.baseX + Math.sin(time * 2 + p.phase) * drift;
      p.mesh.position.y = p.baseY + Math.cos(time * 2.5 + p.phase * 1.3) * drift;
      p.mesh.position.z = p.baseZ + Math.sin(time * 1.8 + p.phase * 0.7) * drift;
    });
    if (d.aura) d.aura.intensity = 1.5 + Math.sin(time * 3) * 0.5;
  }

  if (d.type === "mimic") {
    walkLegs(d.legs, 3, 0.18);
    swingArms(d.arms, 2.5);
    // Veins pulse
    if (d.veins) d.veins.forEach((v, i) => {
      v.scale.x = 1 + Math.sin(time * 4 + i) * 0.3;
    });
    // Visor flicker
    if (d.visor) d.visor.material.color.setHSL(0, 1, 0.4 + Math.sin(time * 8) * 0.1);
    model.position.y = Math.abs(Math.sin(time * 6)) * 0.015;
  }

  if (d.type === "burrower") {
    // Segments undulate
    if (d.segments) d.segments.forEach(s => {
      s.mesh.position.y = s.baseY + Math.sin(time * 2 + s.t * 8) * 0.08;
      s.mesh.position.x = s.baseX + Math.cos(time * 1.5 + s.t * 6) * 0.03;
    });
  }

  if (d.type === "trojan") {
    // Legs twitch
    if (d.legs) d.legs.forEach((leg, i) => {
      const twitch = Math.sin(time * 5 + i * 2) * 0.15;
      leg.upper.rotation.x = leg.baseUpper + twitch;
      leg.lower.rotation.x = leg.baseLower - twitch * 0.5;
    });
    // Tentacle reaches
    if (d.tentSegs) d.tentSegs.forEach(s => {
      s.mesh.position.y = s.baseY + Math.sin(time * 2 + s.seg * 0.8) * 0.05;
      s.mesh.position.x = s.baseX + Math.sin(time * 1.5 + s.seg) * 0.04;
    });
    model.rotation.z = Math.sin(time * 1) * 0.01;
  }

  if (d.type === "twins") {
    walkLegs(d.twin1.legs, 3.5, 0.18);
    walkLegs(d.twin2.legs, 3.5, 0.18);
    swingArms(d.twin1.arms, 2.5);
    swingArms(d.twin2.arms, 2.5);
    // Tether pulses and waves
    if (d.tether) d.tether.forEach(t => {
      t.mesh.position.y = 1.0 + Math.sin(time * 3 + t.t * Math.PI * 2) * 0.12;
      t.mesh.scale.setScalar(1 + Math.sin(time * 5 + t.t * 4) * 0.3);
    });
    if (d.tetherLight) d.tetherLight.intensity = 1.5 + Math.sin(time * 5) * 0.8;
    model.position.y = Math.abs(Math.sin(time * 7)) * 0.015;
  }
}

// =============================================
// UI
// =============================================

const ORIGINALS = [
  { name: "Chimera", desc: "Amalgam of all four types. Multi-phase fight cycling each type's attacks.", build: buildChimera, meshCount: "~85", color: "#ff2244", accent: "#ff44cc" },
  { name: "Hive Queen", desc: "Massive matriarch. Spawns adds. Four arms, egg sacs, tendrils. She IS the room.", build: buildHiveQueen, meshCount: "~90", color: "#ff2244", accent: "#ff6644" },
  { name: "Mech Hybrid", desc: "Alien grafted with stolen human tech. Organic left, cannon right.", build: buildMechHybrid, meshCount: "~80", color: "#ff2244", accent: "#44ccff" },
];

const WILDCARDS = [
  { name: "Puppet Master", desc: "Tiny gleeful alien driving a headless brute body via nerve tendrils. Kill the pilot, the body drops.", build: buildPuppetMaster, meshCount: "~70", color: "#44ff88", accent: "#44ff88" },
  { name: "The Swarm", desc: "Not one alien — hundreds of tiny ones forming a humanoid shape. Shoot it and it scatters, then reforms.", build: buildSwarm, meshCount: "~82", color: "#ff2244", accent: "#ff2244" },
  { name: "The Mimic", desc: "Your own silhouette made of alien flesh. Wrong proportions, too-long arms. Uncanny valley horror.", build: buildMimic, meshCount: "~55", color: "#ff1122", accent: "#440022" },
  { name: "Burrower", desc: "Giant worm. Only segments arc above floor. Burrows and re-emerges. You fight it in pieces.", build: buildBurrower, meshCount: "~60", color: "#ff2244", accent: "#ff6644" },
  { name: "The Trojan", desc: "Looks like a supply crate until eyes peek out and legs unfold. Ambush boss.", build: buildTrojan, meshCount: "~50", color: "#ffaa22", accent: "#ffaa22" },
  { name: "The Twins", desc: "Two aliens tethered by energy. Kill one, the other revives it. Must damage both simultaneously.", build: buildTwins, meshCount: "~75", color: "#ff44cc", accent: "#ff44cc" },
];

function BossViewer({ boss, index }) {
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
    camera.position.set(0, 1.8, 6.5);
    camera.lookAt(0, 1.0, 0);

    scene.add(new THREE.AmbientLight(0x222233, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(3, 5, 4); scene.add(dir);
    scene.add(cfg(new THREE.DirectionalLight(0x334455, 0.3), { position: new THREE.Vector3(-3, 2, -2) }));

    const grid = new THREE.Mesh(new THREE.RingGeometry(1.2, 2.8, 32),
      new THREE.MeshBasicMaterial({ color: 0x1a1a28, transparent: true, opacity: 0.3 }));
    grid.rotation.x = -Math.PI * 0.5; grid.position.y = -0.6; scene.add(grid);

    const model = boss.build();
    scene.add(model);

    let t = index * 2;
    function animate() {
      t += 0.016;
      model.rotation.y = t * 0.35;
      animateBoss(model, t);
      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(animate);
    }
    animate();
    return () => { cancelAnimationFrame(frameRef.current); renderer.dispose(); };
  }, [boss, index]);

  return <canvas ref={canvasRef} width={500} height={500} style={{ width: "100%", height: "100%", display: "block" }} />;
}

function BossCard({ boss, index, active, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: active ? "rgba(255,34,68,0.06)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${active ? boss.accent : "#1a1a28"}`,
      borderRadius: 10, overflow: "hidden", cursor: "pointer",
      transition: "all 0.25s ease",
      boxShadow: active ? `0 0 25px ${boss.accent}22` : "none",
    }}>
      <div style={{ height: 300, position: "relative" }}>
        <BossViewer boss={boss} index={index} />
        <div style={{
          position: "absolute", top: 10, right: 10,
          background: "rgba(0,0,0,0.7)", color: boss.accent,
          fontSize: 10, padding: "3px 8px", borderRadius: 4,
        }}>{boss.meshCount} meshes</div>
      </div>
      <div style={{ padding: "12px 16px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: boss.accent, boxShadow: `0 0 8px ${boss.accent}`,
          }} />
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "#e8e8f0", margin: 0, letterSpacing: 2, textTransform: "uppercase" }}>
            {boss.name}
          </h2>
        </div>
        <p style={{ fontSize: 11, lineHeight: 1.6, color: "#778", margin: 0 }}>{boss.desc}</p>
      </div>
    </div>
  );
}

export default function BossWorkshop() {
  const [tab, setTab] = useState("originals");
  const [selected, setSelected] = useState(null);
  const bosses = tab === "originals" ? ORIGINALS : WILDCARDS;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #0a0610 0%, #120a18 40%, #0a0610 100%)",
      padding: "24px 16px", fontFamily: "'Courier New', monospace", color: "#c8c8d8",
    }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#e8e8f0", margin: 0, letterSpacing: 4, textTransform: "uppercase" }}>
          Falo 3D-2 — Boss Workshop
        </h1>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 }}>
        {[{ id: "originals", label: "Original 3" }, { id: "wildcards", label: "Wild Cards (6)" }].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSelected(null); }} style={{
            background: tab === t.id ? "rgba(255,34,68,0.15)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${tab === t.id ? "#ff2244" : "#222233"}`,
            color: tab === t.id ? "#ff4466" : "#667",
            padding: "8px 20px", borderRadius: 6, cursor: "pointer",
            fontSize: 13, fontFamily: "'Courier New', monospace", fontWeight: 600,
            letterSpacing: 1, textTransform: "uppercase",
            transition: "all 0.2s ease",
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${tab === "originals" ? "320px" : "280px"}, 1fr))`,
        gap: 16, maxWidth: 1200, margin: "0 auto",
      }}>
        {bosses.map((boss, i) => (
          <BossCard key={boss.name} boss={boss} index={i}
            active={selected === i} onClick={() => setSelected(selected === i ? null : i)} />
        ))}
      </div>
    </div>
  );
}
