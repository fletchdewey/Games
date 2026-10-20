// src/bosses/twins.js
// BOSS: The Twins — two aliens that share a life.
//
// FLETCHER'S GUIDE:
// Drop one and the other walks over and brings it back. So the fight isn't
// about out-damaging them, it's about WHERE you drop one and whether you can
// finish the second before it gets there.
//
// The two are deliberately not alike, because you need to decide which to
// drop first and that choice has to mean something:
//
//   BLUE   small, quick, carries a blaster. Fights you at range. Being fast,
//          it reaches a downed twin sooner — so dropping the brown one first
//          buys you less time than it looks like.
//   BROWN  a quarter again as big, plated at the shoulders, chest and knees,
//          slow and heavy. It closes on you instead of shooting.
//
// The model is ported from the Boss Workshop's buildTwins, where the look was
// worked out. The brain is next door in twins_ai.js.

import * as THREE from 'three';
import { PALETTE } from '../shared/materials.js?v=51cc7f3465';

const COL = {
  blue: 0x2a2a3a,
  brown: 0x3a2a2a,
  armor: 0x1e1e2a,
  armorLt: 0x2e2e3e,
  // They bleed the same green the Burrower does — same station, same thing
  // inside them.
  blood: 0x7ad426,
  pool: 0x4e8f18,
  // What a body turns on its way to coming apart.
  rot: 0x5a6a32,
};

// Specks in the air at once. One burst is a whole body, and there are two
// bodies, so this has to cover both going off together with room to spare.
export const BLOOD_MAX = 320;
export const BLOOD_PARKED = -999;
export const POOL_MAX = 8;

// The leg chain's reach, so the toes touch the floor. Everything above the
// hips is placed relative to this rather than to the ground — the model used
// to hang its legs off y 0.3 under a torso whose underside was at 0.45, which
// put the feet half a unit through the floor.
const HIP_Y = 0.9;
const TORSO_Y = HIP_Y + 0.55;

// An alien blaster: organic body, bone barrel, lit muzzle, vents along the
// top so it reads as something that gets hot. Built facing +Z.
// Everything in here is marked kit: when a twin bursts, the flesh goes and
// the hardware stays, and a blaster that left its barrel behind in the blood
// would not read as a weapon on the floor.
function buildBlaster(boneMat, glowMat) {
  const b = new THREE.Group();
  const bodyGeo = new THREE.SphereGeometry(0.1, 6, 5);
  bodyGeo.scale(0.8, 0.85, 1.5);
  b.add(new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: COL.armorLt })));

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.3, 6), boneMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.2;
  b.add(barrel);

  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), glowMat);
  muzzle.position.z = 0.35;
  b.add(muzzle);
  for (const vz of [-0.02, 0.06, 0.14]) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.04), glowMat);
    v.position.set(0, 0.07, vz);
    b.add(v);
  }
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.06),
    new THREE.MeshLambertMaterial({ color: COL.armor }));
  grip.position.set(0, -0.08, -0.06);
  b.add(grip);
  b.traverse((o) => { if (o.isMesh) o.userData.kit = true; });
  return { group: b, muzzle };
}

// `armBulk` and `armLen` thicken and lengthen the arms on top of the twin's
// overall scale, so the brown one can be heavier in the arms specifically
// rather than just being a bigger copy. `hands` is what sits at the end of
// them — before this there was nothing there at all and the forearms simply
// stopped.
function buildTwin({ skin, scale = 1, armored = false, blaster = false,
                     armBulk = 1, armLen = 1, hands = 'small' }) {
  const twin = new THREE.Group();
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const boneMat = new THREE.MeshLambertMaterial({ color: PALETTE.bone });
  const eyeMat = new THREE.MeshBasicMaterial({ color: PALETTE.eyeRed });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff2244 });
  const plateMat = new THREE.MeshLambertMaterial({ color: COL.armorLt });

  // Built facing +Z. The AI turns the whole twin, so nothing here needs to
  // know which way it's pointing — that was the source of every backwards
  // limb in the workshop version.
  const tG = new THREE.SphereGeometry(0.5, 7, 6); tG.scale(1, 1.1, 0.85);
  const torso = new THREE.Mesh(tG, skinMat);
  torso.position.y = TORSO_Y; torso.rotation.x = 0.2;
  twin.add(torso);

  if (armored) {
    // Child of the torso, so it leans with the body. The torso's squash is
    // baked into its GEOMETRY, not its scale, so this doesn't inherit it.
    const chestGeo = new THREE.SphereGeometry(0.32, 7, 6);
    chestGeo.scale(1.25, 1.35, 0.6);
    const chest = new THREE.Mesh(chestGeo, plateMat);
    chest.position.set(0, 0.04, 0.26);
    torso.add(chest);
  }

  const hG = new THREE.SphereGeometry(0.28, 6, 5); hG.scale(0.85, 0.9, 1.2);
  const head = new THREE.Mesh(hG, skinMat);
  head.position.set(0, TORSO_Y + 0.65, 0.15);
  twin.add(head);

  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.18),
    new THREE.MeshLambertMaterial({ color: COL.armor }));
  brow.position.set(0, TORSO_Y + 0.72, 0.35);
  twin.add(brow);

  const eyes = [];
  for (const ex of [-0.12, 0.12]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), eyeMat);
    e.position.set(ex, TORSO_Y + 0.65, 0.4);
    twin.add(e);
    eyes.push(e);
  }
  for (const mx of [-0.1, 0.1]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.2, 4), boneMat);
    m.position.set(mx, TORSO_Y + 0.45, 0.4);
    m.rotation.x = 0.4;
    m.rotation.z = mx > 0 ? -0.3 : 0.3;
    twin.add(m);
  }

  const arms = [];
  let muzzle = null;
  for (const side of [-1, 1]) {
    const sp = new THREE.Group(); sp.position.set(side * 0.5, TORSO_Y + 0.3, 0);
    twin.add(sp);
    sp.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 5, 5), skinMat));

    if (armored) {
      const pGeo = new THREE.SphereGeometry(0.2, 6, 5);
      pGeo.scale(1.05, 0.8, 1.05);
      const pauldron = new THREE.Mesh(pGeo, plateMat);
      pauldron.position.set(side * 0.05, 0.04, 0);
      sp.add(pauldron);
    }

    // Every length below is derived, so thickening or lengthening the arms
    // moves the elbow, the hand and the gun along with them.
    const UL = 0.55 * armLen, FL = 0.5 * armLen;
    const uG = new THREE.CylinderGeometry(0.07 * armBulk, 0.06 * armBulk, UL, 5);
    uG.translate(0, -UL / 2, 0);
    const u = new THREE.Mesh(uG, skinMat); u.rotation.z = side * 0.35; sp.add(u);

    const ep = new THREE.Group(); ep.position.y = -UL; u.add(ep);
    ep.add(new THREE.Mesh(new THREE.SphereGeometry(0.06 * armBulk, 5, 4), skinMat));

    const fG = new THREE.CylinderGeometry(0.06 * armBulk, 0.045 * armBulk, FL, 5);
    fG.translate(0, -FL / 2, 0);
    const fore = new THREE.Mesh(fG, skinMat);
    fore.rotation.x = -0.3;
    ep.add(fore);

    if (hands === 'fists') {
      // A heavy fist with knuckle spikes, which is what it brings down on
      // you — the smash had nothing at the end of the arm to land with.
      //
      // Plated, not skin: it matches the shoulders, chest and knees, so the
      // armour reads as one set rather than a grey patch here and there.
      const fist = new THREE.Mesh(
        new THREE.SphereGeometry(0.15 * armBulk, 6, 5), plateMat);
      fist.position.y = -FL - 0.04;
      fore.add(fist);
      for (let k = -1; k <= 1; k++) {
        const spikeGeo = new THREE.ConeGeometry(0.035 * armBulk, 0.16 * armBulk, 4);
        spikeGeo.translate(0, 0.08 * armBulk, 0);
        const spike = new THREE.Mesh(spikeGeo, boneMat);
        spike.position.set(k * 0.075 * armBulk, -FL - 0.1, 0.07 * armBulk);
        spike.rotation.x = Math.PI * 0.62;      // out over the knuckles
        fore.add(spike);
      }
      // Darker than the fist, or the two greys merge into one blob and the
      // wrist disappears.
      const plate = new THREE.Mesh(
        new THREE.SphereGeometry(0.13 * armBulk, 6, 5),
        new THREE.MeshLambertMaterial({ color: COL.armor }));
      plate.scale.set(1, 0.55, 1);
      plate.position.set(0, -FL + 0.05, 0);
      fore.add(plate);
    } else {
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07 * armBulk, 5, 4), skinMat);
      hand.position.y = -FL - 0.02;
      fore.add(hand);
    }

    if (blaster && side === 1) {
      const gun = buildBlaster(boneMat, glowMat);
      gun.group.position.set(0, -FL, 0.08);
      gun.group.rotation.x = 0.3;
      fore.add(gun.group);
      muzzle = gun.muzzle;
    }
    arms.push({ shoulderPivot: sp, elbowPivot: ep, upper: u, fore, side });
  }

  const legs = [];
  for (const lx of [-0.2, 0.2]) {
    const hip = new THREE.Group(); hip.position.set(lx, HIP_Y, 0); twin.add(hip);
    const uG = new THREE.CylinderGeometry(0.08, 0.06, 0.45, 5); uG.translate(0, -0.23, 0);
    const upper = new THREE.Mesh(uG, skinMat); upper.rotation.x = -0.2; hip.add(upper);

    const knee = new THREE.Group(); knee.position.y = -0.45; upper.add(knee);
    knee.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 4), skinMat));
    if (armored) {
      const kGeo = new THREE.SphereGeometry(0.1, 6, 5);
      kGeo.scale(1.1, 0.95, 1.05);
      const cap = new THREE.Mesh(kGeo, plateMat);
      cap.position.set(0, 0, 0.03);
      knee.add(cap);
    }

    const lG = new THREE.CylinderGeometry(0.05, 0.04, 0.4, 5); lG.translate(0, -0.2, 0);
    const lower = new THREE.Mesh(lG, skinMat); lower.rotation.x = 0.35; knee.add(lower);

    const fg = new THREE.Group(); fg.position.y = -0.4; lower.add(fg);
    const foot = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), boneMat);
    foot.rotation.x = 0.5;
    fg.add(foot);

    legs.push({ hip, upper, lower, baseUpper: -0.2, baseLower: 0.35 });
  }

  twin.scale.setScalar(scale);
  // ── What is meat and what is kit ──────────────────────────
  // Sorted by material rather than by hand at each of thirty-odd creation
  // sites, so adding a part to the model can't quietly forget to say which
  // it is. Skin, bone and eyes are the creature; plating and the blaster are
  // what it was carrying, and what is still there afterwards.
  const flesh = [], kit = [];
  twin.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.kit) { kit.push(o); return; }
    if (o.material === skinMat || o.material === eyeMat || o.material === boneMat) {
      flesh.push(o);
    } else {
      kit.push(o);
    }
  });

  // eyeMat and skinMat are each made fresh per twin rather than shared, so
  // the death can put ONE of them out without the other going dark too.
  return { group: twin, arms, legs, eyes, eyeMat, muzzle, skinMat, scale,
           flesh, kit };
}

export function createTwins() {
  const g = new THREE.Group();

  const blue = buildTwin({ skin: COL.blue, blaster: true, hands: 'small' });
  // Heavier in the arms than a 1.25 copy would be: 1.4x thicker and 1.18x
  // longer on top of that, because the arms are its weapon.
  const brown = buildTwin({ skin: COL.brown, scale: 1.25, armored: true,
                            armBulk: 1.4, armLen: 1.18, hands: 'fists' });
  blue.kind = 'blue';
  brown.kind = 'brown';

  // Stood apart here, not only by the AI. initTwins moves them to their
  // fighting positions, but anything that just builds the model — the boss
  // gallery, a screenshot, a future spawn preview — got both of them on the
  // same spot, merged into one creature.
  blue.group.position.set(-1.6, 0, 0);
  brown.group.position.set(1.6, 0, 0);

  g.add(blue.group);
  g.add(brown.group);

  // ── Blood ─────────────────────────────────────────────────
  // One Points object for both twins, as a ring buffer — the same shape as
  // the Burrower's, for the same reasons: one draw call, nothing allocated
  // when a body goes, and spent specks parked far below the floor rather
  // than removed. Culling off, because the parked ones would otherwise drag
  // the bounding sphere down with them.
  const bloodPos = new Float32Array(BLOOD_MAX * 3);
  for (let i = 0; i < BLOOD_MAX; i++) bloodPos[i * 3 + 1] = BLOOD_PARKED;
  const bloodGeo = new THREE.BufferGeometry();
  bloodGeo.setAttribute('position', new THREE.BufferAttribute(bloodPos, 3));
  const bloodPoints = new THREE.Points(bloodGeo, new THREE.PointsMaterial({
    color: COL.blood, size: 0.13, sizeAttenuation: true,
    transparent: true, opacity: 0.95, depthWrite: false,
  }));
  bloodPoints.frustumCulled = false;
  g.add(bloodPoints);
  const blood = { points: bloodPoints, pos: bloodPos,
                  vel: new Float32Array(BLOOD_MAX * 3),
                  life: new Float32Array(BLOOD_MAX), next: 0 };

  // What's left on the floor underneath. Each at its own height so two
  // overlapping discs can't z-fight.
  const pools = [];
  for (let i = 0; i < POOL_MAX; i++) {
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(1, 14),
      new THREE.MeshBasicMaterial({ color: COL.pool,
                                    transparent: true, opacity: 0.9 }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.03 + i * 0.0015;
    pool.visible = false;
    g.add(pool);
    pools.push(pool);
  }

  // Tagged for the game's hit detection. Each twin's meshes carry its own
  // name, so a bullet knows which of the two it struck.
  blue.group.traverse((o) => { if (o.isMesh) o.userData.hitPart = 'blue'; });
  brown.group.traverse((o) => { if (o.isMesh) o.userData.hitPart = 'brown'; });

  g.userData = { type: 'twins', blue, brown, twins: [blue, brown],
                 blood, pools, nextPool: 0, debris: [], rotColor: COL.rot };
  return g;
}
