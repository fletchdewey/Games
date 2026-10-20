// src/cutscene/arrival.js
// HOW YOU GOT HERE
//
// FLETCHER'S GUIDE:
// The game used to start with you already standing in the Hangar, which
// never explained why a soldier is alone on an alien station with a rifle.
// This is the thirty seconds before that.
//
// You are in the back of a helicopter with four other men and a pilot.
// There is a ship ahead of you — grey, numbered, running lights on, every
// inch of it built by people — and for about ten seconds you are allowed to
// think it has come to pick you up. Then the plates under its nose slide
// apart, and what is behind them was not built by anybody.
//
// Three things worth knowing about how it is made:
//
//   ONE MODEL, TWO SHOTS. The helicopter's walls are panels rather than a
//   solid box, with a real hole where the door is. That means the same
//   model works from the seat inside it and from a hundred metres off its
//   tail, and the view out of the door is simply the world.
//
//   NOTHING ACTUALLY FLIES. The helicopter sits at the origin the whole
//   time and the world moves past it — the ground's texture scrolls, the
//   clouds stream by, the ship comes to us. It is only in the last few
//   seconds, when the beam takes hold, that the helicopter really moves,
//   and then it moves a very long way very fast.
//
//   THE CAMERA IS A PASSENGER. For the inside shots it is parented to the
//   helicopter, so every shake, tilt and spin of the airframe is already
//   in the shot without a line of code. For the one outside shot it is
//   handed back to the scene and left standing in the air.
//
// Press any key to skip it.

import * as THREE from 'three';
import { buildSoldier } from '../npc/soldier.js?v=b6f95d5579';

// ─── THE CLOCK ──────────────────────────────────────────────
// Every beat of the thing, in seconds. Changing the pace of the cutscene
// means changing these numbers and nothing else.
const BEAT = {
  cabin:  1.0,   // black lifts; you are in the back of the aircraft
  spot:   7.5,   // out of the open door, something on the horizon
  wide:  16.8,   // cut outside — how big it actually is
  wrong: 21.6,   // its belly opens, and the light out of it is wrong
  ray:   24.2,   // the beam
  pull:  25.8,   // taken, far too fast
  tumble:27.3,   // back inside, everything sideways
  white: 29.4,   // over the lip
  dark:  30.6,
  over:  32.2,
}

// ─── WHAT THEY SAY ──────────────────────────────────────────
// Five lines, and the clock above is cut around them rather than the
// other way round — the ship's belly opens while you are still saying you
// do not want to be stuck out here.
//
// `dur` is not a guess. Each line was spoken by the voice it is going to
// be spoken by, at the pitch and rate that voice is given, and timed by
// watching the synthesiser rather than by asking it — its own "finished"
// event does not always arrive. The gaps between lines are then set from
// those numbers: about half a second of air after one man stops and
// before the next starts, which is a conversation. A second and a half,
// which is what this had first, is a tannoy.
//
// `speak` exists for the one line where what is written and what is said
// have to differ — a speech synthesiser reads "?!" as a pause and a
// shrug, and the subtitle wants the "?!".
const SCRIPT = [
  { at: 1.80, dur: 2.20, role: 's1', who: 'SOLDIER', crew: 0,
    text: "I thought I was a goner back there." },
  { at: 4.45, dur: 3.25, role: 's2', who: 'SOLDIER', crew: 2,
    text: "Yeah, we were lucky that this helicopter was still working." },
  { at: 8.90, dur: 5.20, role: 'radio', who: 'RADIO', radio: true,
    text: "Hello? Hello?! This is an emergency. Get towards the military ship immediately.",
    speak: "Hello? Hello! This is an emergency. Get towards the military ship immediately." },
  { at: 14.90, dur: 4.35, role: 's3', who: 'SOLDIER', crew: 1,
    text: "We better get going. I mean, we wouldn't want to be stuck out here." },
  // The last one is yours, which is why it has no name on it here: the
  // game puts the name you typed in on the front of it.
  { at: 19.90, dur: 3.10, role: 'you', who: null,
    text: "Let's get going. I don't want to be stuck out here." },
]
const SKY_TOP  = 0x2e6ca8;
const SKY_HAZE = 0xa89e92;      // the horizon, and the fog, and the smoke in it
// How fast the world goes past, in units a second. The ground, the cloud
// and the fires all move at this one number — they are at different
// distances, so the parallax sorts itself out.
const WORLD_SPEED = 110;

// Where the ship is at the three moments that matter, as offsets from the
// helicopter. It comes in off the port bow — that is the side the door is
// on, which is the only reason you can see any of this from a seat.
// Bearing matters more than distance here. From the seat you are looking
// out through a hole two and a half metres wide, which is about thirty
// degrees of the world — so the ship has to come in within that cone of
// the way the camera faces, or the whole approach happens behind a wall.
// It comes in off the port beam and parks there. Bearing matters more
// than distance: from the seat you are looking out through a hole two and
// a half metres wide, which is about thirty degrees of the world, so a
// ship much forward of abeam spends its whole approach behind a wall.
const SHIP_FAR  = new THREE.Vector3(-6600,  320, -1150);
const SHIP_NEAR = new THREE.Vector3(-1700,  480,  -320);
const SHIP_OVER = new THREE.Vector3( -620,  640,  -190);
// And how it is lying while it does it. Head-on, fourteen hundred metres
// of ship is a dot — all you see is its beam. So it comes in angled at us
// and swings broadside as it slows, and what ends up over the aircraft is
// its whole LENGTH.
const SHIP_YAW_FAR  = Math.PI + 0.55;
const SHIP_YAW_NEAR = Math.PI - 0.30;

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const UP = new THREE.Vector3(0, 1, 0);

/** A canvas, drawn on by the function you pass, handed back as a texture. */
function painted(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Stretch a unit-tall cylinder so it runs from a to b. Used for the beam. */
function spanTo(mesh, a, b, girth) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length() || 0.001;
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, d.clone().normalize());
  mesh.scale.set(girth, len, girth);
}

// ─── WHAT THE WORLD IS MADE OF ──────────────────────────────

/**
 * A city from two thousand feet, and a lot of it alight.
 *
 * Drawn once onto one 512-pixel tile and repeated across the ground, so
 * everything in here has to survive being seen next to a copy of itself:
 * the streets line up across the seam, and the fires are kept to char and
 * glow rather than anything you would recognise twice. The burning you
 * actually read is not in this picture — it is the smoke standing up off
 * it in buildFire(), which is at real places in the world and repeats
 * nowhere.
 */
function cityTexture() {
  return painted(512, 512, (g, w, h) => {
    g.fillStyle = '#26262a';                       // wet asphalt
    g.fillRect(0, 0, w, h);

    const BLOCK = 64;                              // a block, side street to side street
    const roofs = ['#44444a', '#3b3b42', '#4e4b48', '#36383e', '#55514d',
                   '#303238', '#484341'];
    // Blocks, each one packed with buildings, each building with a shadow
    // on the same side — one sun, or none of it reads as height.
    for (let by = 0; by < h; by += BLOCK) {
      for (let bx = 0; bx < w; bx += BLOCK) {
        const r = Math.random();
        if (r < 0.07) {                            // a park
          g.fillStyle = '#2b3a27';
          g.fillRect(bx + 4, by + 4, BLOCK - 8, BLOCK - 8);
          continue;
        }
        if (r < 0.12) {                            // a yard full of nothing
          g.fillStyle = '#35353a';
          g.fillRect(bx + 4, by + 4, BLOCK - 8, BLOCK - 8);
          continue;
        }
        const cols = 2 + ((Math.random() * 2) | 0);
        const cell = (BLOCK - 8) / cols;
        for (let i = 0; i < cols; i++) {
          for (let k = 0; k < cols; k++) {
            if (Math.random() < 0.12) continue;    // a gap, a lot, a ruin
            const x = bx + 4 + i * cell, y = by + 4 + k * cell;
            const ww = cell * (0.72 + Math.random() * 0.26);
            const hh = cell * (0.72 + Math.random() * 0.26);
            const lift = 1 + Math.random() * 4;    // how tall it pretends to be
            g.fillStyle = 'rgba(0,0,0,0.5)';
            g.fillRect(x + lift, y + lift, ww, hh);
            g.fillStyle = roofs[(Math.random() * roofs.length) | 0];
            g.fillRect(x, y, ww, hh);
          }
        }
      }
    }

    // The street grid over the top, so the blocks sit inside it rather
    // than beside it. Avenues are wider and brighter than side streets.
    g.strokeStyle = '#34343a'; g.lineWidth = 4;
    for (let x = 0; x <= w; x += BLOCK) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
      g.beginPath(); g.moveTo(0, x); g.lineTo(w, x); g.stroke();
    }
    g.strokeStyle = '#43434a'; g.lineWidth = 9;
    for (let x = BLOCK * 2; x <= w; x += BLOCK * 4) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
      g.beginPath(); g.moveTo(0, x); g.lineTo(w, x); g.stroke();
    }

    // Burnt out. Soot first, wide and soft, then whatever is still alight
    // in the middle of it. Only a handful: this tile is laid down forty
    // times across the ground, so six fires here is already two hundred
    // and fifty fires out of the door, and the first cut of it — with
    // twenty-six — read as orange spots on a tablecloth rather than as a
    // city with parts of it alight.
    for (let i = 0; i < 6; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const r = 12 + Math.random() * 26;
      const soot = g.createRadialGradient(x, y, 0, x, y, r * 1.9);
      soot.addColorStop(0, 'rgba(14,11,10,0.8)');
      soot.addColorStop(0.5, 'rgba(18,14,12,0.42)');
      soot.addColorStop(1, 'rgba(20,16,14,0)');
      g.fillStyle = soot;
      g.beginPath(); g.arc(x, y, r * 1.9, 0, Math.PI * 2); g.fill();

      const fire = g.createRadialGradient(x, y, 0, x, y, r * 0.55);
      fire.addColorStop(0, 'rgba(255,238,170,0.95)');
      fire.addColorStop(0.35, 'rgba(255,146,38,0.8)');
      fire.addColorStop(1, 'rgba(120,30,8,0)');
      g.fillStyle = fire;
      g.beginPath(); g.arc(x, y, r * 0.55, 0, Math.PI * 2); g.fill();
      // Embers: the block next door catching.
      for (let k = 0; k < 3; k++) {
        g.fillStyle = 'rgba(255,170,60,' + (0.15 + Math.random() * 0.35) + ')';
        g.fillRect(x + (Math.random() - 0.5) * r * 2.4,
                   y + (Math.random() - 0.5) * r * 2.4,
                   2 + Math.random() * 5, 2 + Math.random() * 5);
      }
    }

    // And the river, which is the one thing down there not burning.
    g.strokeStyle = '#2b3a44'; g.lineWidth = 22; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-10, 150);
    for (let x = 0; x <= w + 10; x += 32) g.lineTo(x, 150 + Math.sin(x / 70) * 40);
    g.stroke();
  });
}

/** A soft round blob, used for cloud and for every glow in the thing. */
function puffTexture(r = 255, gg = 255, b = 255) {
  return painted(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(' + r + ',' + gg + ',' + b + ',0.95)');
    grd.addColorStop(0.45, 'rgba(' + r + ',' + gg + ',' + b + ',0.4)');
    grd.addColorStop(1, 'rgba(' + r + ',' + gg + ',' + b + ',0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
}

/** The sky, as one vertical fade with a sun in it. */
function skyTexture() {
  return painted(16, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#1c4a7e');
    grd.addColorStop(0.42, '#4b7ea8');
    grd.addColorStop(0.68, '#95978f');      // where the smoke starts
    grd.addColorStop(1, '#b5a794');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
}

/** Warship plating: panel lines, a stripe of lit windows, rivets. */
function hullTexture() {
  return painted(512, 256, (g, w, h) => {
    g.fillStyle = '#6a7278';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.05) + ')';
      g.fillRect(Math.random() * w, Math.random() * h,
                 20 + Math.random() * 90, 10 + Math.random() * 40);
    }
    g.strokeStyle = 'rgba(30,36,40,0.55)';
    g.lineWidth = 1.5;
    for (let x = 0; x < w; x += 32) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
    }
    for (let y = 0; y < h; y += 42) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }
    // Lit windows, in two rows, most of them on.
    for (const row of [96, 150]) {
      for (let x = 20; x < w - 20; x += 17) {
        g.fillStyle = Math.random() < 0.78 ? '#ffe9b0' : '#2a3036';
        g.fillRect(x, row, 7, 5);
      }
    }
    // Somebody's paint: a number on the bow, a star amidships.
    g.fillStyle = '#d7dde2';
    g.font = 'bold 54px monospace';
    g.fillText('N-7', 26, 72);
    g.font = 'bold 22px monospace';
    g.fillText('ORBITAL GUARD', 128, 66);
    g.save();
    g.translate(360, 190);
    g.fillStyle = '#e6ebef';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const r = i % 2 ? 12 : 30;
      g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath(); g.fill();
    g.restore();
  });
}

/** Bands running the length of the beam, so the light reads as moving. */
function beamTexture() {
  return painted(32, 256, (g, w, h) => {
    g.fillStyle = 'rgba(150,70,220,0.0)';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const y = Math.random() * h;
      g.fillStyle = 'rgba(214,170,255,' + (0.1 + Math.random() * 0.5) + ')';
      g.fillRect(0, y, w, 2 + Math.random() * 9);
    }
  });
}

/**
 * One fire on the ground and the column standing off it.
 *
 * This is what actually sells the city as burning. The ground texture can
 * only ever say where the fire WAS — a flat orange smudge seen from above
 * reads as paint. A column of smoke eight hundred feet high, leaning, that
 * you fly past and that passes behind the aircraft, reads as a fire.
 */
function buildFire(puff) {
  const g = new THREE.Group();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff,
    color: 0xff7a1e, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  const gs = 150 + Math.random() * 180;
  glow.scale.set(gs, gs * 0.5, 1);
  glow.position.y = 10;
  g.add(glow);

  // The column: eight puffs up a leaning line, each one bigger and
  // thinner than the last, and the bottom two lit from underneath.
  const n = 9;
  const lean = 0.5 + Math.random() * 1.0;
  const top = 340 + Math.random() * 460;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff,
      color: f < 0.22 ? 0x7a4026 : 0x3b3734, transparent: true,
      opacity: 0.66 - f * 0.4, depthWrite: false }));
    const sz = 130 + f * (230 + Math.random() * 200);
    m.scale.set(sz, sz, 1);
    m.position.set(lean * f * 240 + (Math.random() - 0.5) * 36,
                   12 + f * top,
                   lean * f * 90 + (Math.random() - 0.5) * 36);
    g.add(m);
  }
  g.userData = { glow, flick: Math.random() * 6.3 };
  return g;
}

// ─── THE AIRCRAFT ───────────────────────────────────────────
// Built around the camera rather than around the model: the cabin is the
// set, and the outside of it is whatever happens to be on the other side
// of the same panels. The nose points down -Z, the open door is the whole
// port side, and the seat you are in is on the starboard bench.

const CAB = {
  x: 1.35,      // half-width of the cabin floor
  floor: -1.15, // the floor, in the aircraft's own space
  roof: 1.15,
  front: -2.4,  // the bulkhead with the cockpit behind it
  back: 3.2,
  doorA: -0.6,  // the open door, as a span along the aircraft
  doorB: 1.9,
};

/** Sat on a bench with a rifle between the knees. `look` turns the head:
 *  0 is straight ahead of him, 1 is as far round as a helmet allows. */
function poseSeated(g, t, lean = 0, look = 0) {
  const d = g.userData;
  d.hips.position.y = 0.92;
  d.hips.rotation.x = 0.06 + lean;
  d.legs.forEach((leg, i) => {
    leg.hip.rotation.x = -1.42;
    leg.hip.rotation.z = (i ? 1 : -1) * 0.14;
    leg.knee.rotation.x = 1.36;
  });
  d.arms.forEach((arm) => {
    arm.shoulder.rotation.x = 0.3;
    arm.shoulder.rotation.z = arm.side * 0.26;
    arm.elbow.rotation.x = -1.15;
  });
  // Nobody sits still in a helicopter. Everyone gets the airframe's shake
  // plus a sway of their own, half a second out of step with the next man.
  d.headPivot.rotation.x = 0.12 + Math.sin(t * 1.3) * 0.04 - Math.abs(look) * 0.1;
  d.headPivot.rotation.y = look * 1.05 + Math.sin(t * 0.7) * 0.12 * (1 - Math.abs(look));
}

/** Thrown about by something much stronger than the aircraft. */
function poseTossed(g, t) {
  const d = g.userData;
  const s = (a, b) => a + Math.sin(t * b + a * 9) * 0.5;
  d.hips.rotation.x = -0.3 + Math.sin(t * 5.1) * 0.3;
  d.legs.forEach((leg, i) => {
    leg.hip.rotation.x = -0.9 + s(i * 0.7, 6.3);
    leg.knee.rotation.x = 0.8 + Math.abs(Math.sin(t * 7 + i)) * 0.6;
  });
  d.arms.forEach((arm, i) => {
    arm.shoulder.rotation.x = -1.9 + Math.sin(t * 6.8 + i * 2) * 0.5;
    arm.shoulder.rotation.z = arm.side * (0.7 + Math.sin(t * 5.4 + i) * 0.4);
    arm.elbow.rotation.x = -0.5 - Math.abs(Math.sin(t * 8 + i)) * 0.8;
  });
  d.headPivot.rotation.x = -0.4 + Math.sin(t * 9) * 0.25;
}

function buildHeli() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0x3f4a3c });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b3229 });
  const grim = new THREE.MeshLambertMaterial({ color: 0x23282a });
  const glass = new THREE.MeshLambertMaterial({
    color: 0x16242c, transparent: true, opacity: 0.55 });

  const panel = (w, h, d, x, y, z, mat = skin) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };

  const L = CAB.back - CAB.front;              // cabin length
  const midZ = (CAB.front + CAB.back) / 2;
  const H = CAB.roof - CAB.floor;

  // Floor, roof, starboard wall, rear wall. Solid boxes, so they are there
  // from both sides — which is the whole trick that lets one model be both
  // the set and the aircraft.
  panel(CAB.x * 2 + 0.3, 0.14, L, 0, CAB.floor - 0.07, midZ, dark);
  panel(CAB.x * 2 + 0.3, 0.14, L, 0, CAB.roof + 0.07, midZ);
  panel(0.14, H, L, CAB.x + 0.07, 0, midZ);
  panel(CAB.x * 2, H, 0.14, 0, 0, CAB.back + 0.07);

  // Port side: the same wall with the door's length missing out of it.
  panel(0.14, H, CAB.doorA - CAB.front, -CAB.x - 0.07, 0,
        (CAB.front + CAB.doorA) / 2);
  panel(0.14, H, CAB.back - CAB.doorB, -CAB.x - 0.07, 0,
        (CAB.doorB + CAB.back) / 2);
  // The door's frame, so the hole reads as a doorway rather than damage.
  for (const dz of [CAB.doorA, CAB.doorB]) {
    panel(0.2, H, 0.1, -CAB.x - 0.06, 0, dz, grim);
  }
  panel(0.2, 0.12, CAB.doorB - CAB.doorA, -CAB.x - 0.06, CAB.roof - 0.06,
        (CAB.doorA + CAB.doorB) / 2, grim);
  // The door itself, slid back and latched open against the aft wall.
  panel(0.09, H - 0.3, 1.0, -CAB.x - 0.16, 0, CAB.back - 0.6, dark);

  // The bulkhead between you and the cockpit, built as four pieces around
  // a gap at head height. The gap is the only reason the pilot exists as
  // far as this cutscene is concerned — a solid wall there and he is a
  // model nobody ever sees.
  const GAPW = 1.5, GAPB = -0.25, GAPT = 0.72, GX = 0.2;
  const bz = CAB.front - 0.06;
  panel(CAB.x + GX - GAPW / 2, H, 0.12, (-CAB.x + GX - GAPW / 2) / 2, 0, bz);
  panel(CAB.x - GX - GAPW / 2, H, 0.12, (CAB.x + GX + GAPW / 2) / 2, 0, bz);
  panel(GAPW, CAB.roof - GAPT, 0.12, GX, (CAB.roof + GAPT) / 2, bz);
  panel(GAPW, GAPB - CAB.floor, 0.12, GX, (GAPB + CAB.floor) / 2, bz);

  // ── Nose, cockpit, tail ──────────────────────────────────
  // The nose is HALF a sphere — the forward half, open at the back, and
  // split again at eye level into a metal bottom and a glass top. A whole
  // sphere here does two things wrong at once: its back fills the cabin,
  // and once you push it clear of the cabin its back is the only thing
  // you can see through the bulkhead gap, so the pilot is sealed in a
  // green egg nobody ever looks into.
  const noseAt = new THREE.Vector3(0, -0.05, CAB.front - 0.1);
  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(1.45, 14, 10, Math.PI, Math.PI,
                             Math.PI * 0.40, Math.PI * 0.60),
    new THREE.MeshLambertMaterial({ color: 0x3f4a3c, side: THREE.DoubleSide }));
  nose.scale.set(1.0, 0.82, 1.5);
  nose.position.copy(noseAt);
  g.add(nose);
  const screen = new THREE.Mesh(
    new THREE.SphereGeometry(1.43, 14, 10, Math.PI, Math.PI, 0, Math.PI * 0.42),
    glass);
  glass.side = THREE.DoubleSide;
  screen.scale.set(1.0, 0.82, 1.5);
  screen.position.copy(noseAt);
  g.add(screen);
  // The cockpit floor, which is a step up from the cabin's.
  panel(2.2, 0.12, 2.0, 0, CAB.floor + 0.22, CAB.front - 1.2, dark);

  panel(0.85, 0.85, 5.6, 0, 0.45, CAB.back + 2.8);          // tail boom
  panel(0.2, 1.9, 1.2, 0, 1.6, CAB.back + 5.2);             // fin
  panel(3.0, 0.14, 0.9, 0, 1.0, CAB.back + 4.7, dark);      // stabiliser

  // Skids.
  for (const sx of [-1.3, 1.3]) {
    panel(0.14, 0.14, 4.6, sx, CAB.floor - 1.0, midZ - 0.2, grim);
    for (const sz of [midZ - 1.5, midZ + 1.2]) {
      const strut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 1.0, 6), grim);
      strut.position.set(sx * 0.82, CAB.floor - 0.52, sz);
      strut.rotation.z = sx * 0.3;
      g.add(strut);
    }
  }

  // ── Rotors ───────────────────────────────────────────────
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.7, 8), grim);
  mast.position.set(0, CAB.roof + 0.45, midZ - 0.4);
  g.add(mast);
  const rotor = new THREE.Group();
  rotor.position.set(0, CAB.roof + 0.8, midZ - 0.4);
  g.add(rotor);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.y = (i / 4) * Math.PI * 2;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 10.5), grim);
    blade.position.z = 5.4;
    arm.add(blade);
    rotor.add(arm);
  }
  // The blur. Four blades at three hundred revolutions a minute are a disc
  // to the eye and a strobe to a frame rate, so there is a disc as well.
  const disc = new THREE.Mesh(new THREE.CircleGeometry(10.6, 36),
    new THREE.MeshBasicMaterial({ color: 0x151a16, transparent: true,
      opacity: 0.17, side: THREE.DoubleSide, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2;
  rotor.add(disc);

  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.5, 1.5, CAB.back + 5.2);
  g.add(tailRotor);
  for (let i = 0; i < 2; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.3), grim);
    b.rotation.z = i * Math.PI / 2;
    tailRotor.add(b);
  }

  // ── Inside: benches, the men, the pilot ──────────────────
  const benchM = new THREE.MeshLambertMaterial({ color: 0x343a30 });
  for (const sx of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, L - 0.6), benchM);
    b.position.set(sx * (CAB.x - 0.33), CAB.floor + 0.45, midZ);
    g.add(b);
    // The backrest stops where the wall stops. Run it the length of the
    // cabin and it crosses the open door at exactly eye height, which
    // turns the way out of this aircraft into a letterbox.
    const spans = sx < 0
      ? [[CAB.front + 0.3, CAB.doorA], [CAB.doorB, CAB.back - 0.3]]
      : [[CAB.front + 0.3, CAB.back - 0.3]];
    for (const [z0, z1] of spans) {
      if (z1 - z0 < 0.2) continue;
      const back = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.7, z1 - z0), benchM);
      back.position.set(sx * (CAB.x - 0.06), CAB.floor + 0.8, (z0 + z1) / 2);
      g.add(back);
    }
  }
  // Crates and a kit bag strapped down the middle, because an empty floor
  // is the one thing that never happens in the back of one of these.
  const kit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 1.3),
    new THREE.MeshLambertMaterial({ color: 0x4a4b38 }));
  kit.position.set(0, CAB.floor + 0.25, CAB.back - 1.0);
  g.add(kit);
  const bag = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x3b3f2e }));
  bag.scale.set(1, 0.7, 1.5);
  bag.position.set(-0.3, CAB.floor + 0.3, CAB.front + 0.8);
  g.add(bag);

  // Four of them, and the one flying it. The seat the camera is in is the
  // gap on the starboard bench; everybody else fills the rest.
  const BENCH_Y = CAB.floor + 0.5 - 0.92;
  const crew = [];
  const seats = [
    [-(CAB.x - 0.33), CAB.front + 0.9,  Math.PI / 2],
    [-(CAB.x - 0.33), CAB.back - 0.9,   Math.PI / 2],
    [  CAB.x - 0.33,  CAB.front + 0.75, -Math.PI / 2],
    [  CAB.x - 0.33,  CAB.back - 0.75,  -Math.PI / 2],
  ];
  for (const [sx, sz, ry] of seats) {
    const s = buildSoldier();
    s.position.set(sx, BENCH_Y, sz);
    s.rotation.y = ry;
    for (const b of s.userData.bindings) b.visible = false;   // not prisoners
    g.add(s);
    crew.push(s);
  }
  const pilot = buildSoldier();
  pilot.position.set(-0.5, CAB.floor + 0.28 - 0.92, CAB.front - 1.1);
  pilot.rotation.y = Math.PI;
  for (const b of pilot.userData.bindings) b.visible = false;
  pilot.userData.rifle.visible = false;         // both hands, please
  g.add(pilot);
  crew.push(pilot);
  // Two seats up front, one of them empty.
  for (const sx of [-0.5, 0.55]) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.6), benchM);
    st.position.set(sx, CAB.floor + 0.28 + 0.2, CAB.front - 0.78);
    g.add(st);
  }

  // The cabin light, which is also the light the beam changes the colour of.
  const lamp = new THREE.PointLight(0xffd9a0, 0.8, 11);
  lamp.position.set(0, CAB.roof - 0.2, midZ);
  g.add(lamp);

  g.userData = { rotor, tailRotor, crew, pilot, lamp, disc };
  return g;
}

// ─── THE SHIP ───────────────────────────────────────────────
// Fourteen hundred metres of grey, numbered hull with its running lights
// on — and nothing on the outside of it that is not a thing people build,
// right up until the plates under its nose come apart.

/** A box with its front end pinched in, which is every warship's bow. */
function wedge(w, h, d, fx, fy) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getZ(i) < 0) { p.setX(i, p.getX(i) * fx); p.setY(i, p.getY(i) * fy); }
  }
  geo.computeVertexNormals();
  return geo;
}

function buildShip() {
  const g = new THREE.Group();
  const hullTex = hullTexture();
  hullTex.repeat.set(2, 1);
  const hullM = new THREE.MeshLambertMaterial({ map: hullTex, color: 0x9aa3a9 });
  const plainM = new THREE.MeshLambertMaterial({ color: 0x6b7378 });
  const darkM = new THREE.MeshLambertMaterial({ color: 0x3c4348 });

  const hull = new THREE.Mesh(wedge(260, 110, 1400, 0.2, 0.42), hullM);
  g.add(hull);
  // A second, narrower slab under it, so the silhouette has a keel rather
  // than being one brick.
  const keel = new THREE.Mesh(wedge(170, 55, 1200, 0.25, 0.5), plainM);
  keel.position.set(0, -70, 60);
  g.add(keel);

  // Superstructure: a block aft of amidships with a smaller one on it, two
  // masts and a dish. Shape is what says military at four kilometres.
  const tower = new THREE.Mesh(new THREE.BoxGeometry(150, 70, 300), hullM);
  tower.position.set(0, 88, 230);
  g.add(tower);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(95, 42, 130), plainM);
  bridge.position.set(0, 140, 140);
  g.add(bridge);
  for (const mz of [60, 330]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(5, 8, 150, 6), darkM);
    mast.position.set(0, 215, mz);
    g.add(mast);
  }
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 7, 14), plainM);
  dish.position.set(0, 175, 330);
  dish.rotation.x = 0.5;
  g.add(dish);

  // Flank sponsons and turrets along the spine.
  for (const sx of [-1, 1]) {
    const spon = new THREE.Mesh(new THREE.BoxGeometry(40, 46, 620), plainM);
    spon.position.set(sx * 140, -10, 150);
    g.add(spon);
  }
  for (const tz of [-430, -230, 420, 560]) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(26, 30, 18, 10), plainM);
    base.position.set(0, 62, tz);
    g.add(base);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 90, 6), darkM);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 70, tz - 48);
    g.add(barrel);
  }

  // Engines: four bells at the stern, lit from inside.
  for (const ex of [-80, -27, 27, 80]) {
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(34, 40, 90, 12), darkM);
    bell.rotation.x = Math.PI / 2;
    bell.position.set(ex, -8, 740);
    g.add(bell);
    const burn = new THREE.Mesh(new THREE.CircleGeometry(33, 14),
      new THREE.MeshBasicMaterial({ color: 0x9fd4ff, transparent: true,
        opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    burn.position.set(ex, -8, 786);
    g.add(burn);
  }

  // Running lights. Red to port, green to starboard, and a white strobe on
  // the mast — the three lights every aircraft and every ship carries, and
  // the whole reason the men in the back relax when they see it.
  const lamp = (c, x, y, z, r = 7) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 6),
      new THREE.MeshBasicMaterial({ color: c }));
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  for (let i = 0; i < 7; i++) {
    const z = -520 + i * 190;
    lamp(0xff3322, -142, 24, z, 6);
    lamp(0x33ff55, 142, 24, z, 6);
  }
  const strobe = lamp(0xffffff, 0, 292, 60, 10);

  // ── The part that is not theirs ──────────────────────────
  // A shallow bay on the underside of the keel, mostly let into it and
  // standing a few metres proud of it, with the plates as its floor.
  //
  // It cannot be flush, because the keel is one solid wedge and a solid
  // wedge has no hole in it — set the throat inside it and the keel's own
  // bottom covers the opening for ever. Set it too big instead and the
  // corners of it come out through the sides of the ship, which is what
  // the first cut did: a purple seam down the flank, visible from four
  // kilometres out, eight seconds before there is supposed to be anything
  // to see.
  const maw = new THREE.Group();
  maw.position.set(0, -84, -60);
  g.add(maw);
  // Dark, with the light deep inside it. A bright box here reads as a
  // purple slab painted on the hull; what you want is a hole with
  // something lit at the bottom of it.
  const throat = new THREE.Mesh(new THREE.BoxGeometry(78, 18, 170),
    new THREE.MeshLambertMaterial({ color: 0x2e0f47 }));
  maw.add(throat);
  const gullet = new THREE.Mesh(new THREE.BoxGeometry(44, 5, 110),
    new THREE.MeshBasicMaterial({ color: 0x9d45ff }));
  gullet.position.y = 5;
  maw.add(gullet);
  const core = new THREE.Mesh(new THREE.PlaneGeometry(70, 160),
    new THREE.MeshBasicMaterial({ map: puffTexture(220, 150, 255),
      transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending,
      depthWrite: false }));
  core.rotation.x = Math.PI / 2;
  core.position.y = -6;
  maw.add(core);
  // Ribs across the opening — grown, not welded.
  const ribM = new THREE.MeshLambertMaterial({ color: 0x3a1a4e });
  for (let i = 0; i < 7; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(32, 5, 5, 10,
      Math.PI), ribM);
    rib.rotation.y = Math.PI / 2;
    rib.rotation.z = Math.PI;
    rib.position.set(0, -7, -66 + i * 22);
    rib.scale.set(1, 0.45, 1);
    maw.add(rib);
  }
  const doorM = new THREE.MeshLambertMaterial({ map: hullTexture(), color: 0x9aa3a9 });
  const doorL = new THREE.Mesh(new THREE.BoxGeometry(42, 7, 180), doorM);
  const doorR = new THREE.Mesh(new THREE.BoxGeometry(42, 7, 180), doorM);
  doorL.position.set(-21, -9, 0);
  doorR.position.set(21, -9, 0);
  maw.add(doorL, doorR);

  g.userData = { doorL, doorR, maw, core, strobe,
                 // Where the beam comes out of, in the ship's own space.
                 belly: new THREE.Vector3(0, -105, -60) };
  return g;
}

// ─── THE WHOLE THING ────────────────────────────────────────

/**
 * Build the cutscene. The game drives it: update(dt) every frame until it
 * returns true, render its own scene and camera, paint blackness() over
 * the top, and play whatever cues() hands back.
 */
export function createArrival() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_HAZE);
  // Thick enough to lose the far edge of the ground in, thin enough that a
  // ship six kilometres out is still a shape rather than a rumour.
  scene.fog = new THREE.FogExp2(SKY_HAZE, 0.00014);

  const camera = new THREE.PerspectiveCamera(
    62, window.innerWidth / Math.max(1, window.innerHeight), 0.1, 30000);

  const amb = new THREE.AmbientLight(0xb2c8de, 0.78);
  scene.add(amb);
  // Behind the camera for the outside shot rather than behind the subject:
  // lit from the far side, the helicopter is a black cut-out.
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.0);
  sun.position.set(900, 950, 700);
  scene.add(sun);

  // ── Sky, ground, weather ─────────────────────────────────
  const sky = new THREE.Mesh(new THREE.SphereGeometry(14000, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide,
      fog: false, depthWrite: false }));
  scene.add(sky);

  const groundTex = cityTexture();
  // One tile every six hundred and fifty units, which puts a city block at
  // about forty across — near enough a block.
  const GROUND_TILE = 46;
  groundTex.repeat.set(GROUND_TILE, GROUND_TILE);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000),
    // Knocked down, because full sun on a city of grey roofs comes back
    // white and the whole thing reads as snow.
    new THREE.MeshLambertMaterial({ map: groundTex, color: 0xa39b90 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -340;
  scene.add(ground);

  // Cloud, as billboards streaming past. This is the only thing in the shot
  // that tells you the aircraft is moving at all.
  const puff = puffTexture();
  const clouds = [];
  for (let i = 0; i < 34; i++) {
    // Dirty rather than white: this is the smoke of the place spread out
    // into a layer, not weather.
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff,
      color: 0xb9ad9e, transparent: true,
      opacity: 0.24 + Math.random() * 0.26, depthWrite: false }));
    const w = 260 + Math.random() * 520;
    s.scale.set(w, w * (0.26 + Math.random() * 0.2), 1);
    s.position.set((Math.random() * 2 - 1) * 1700,
                   -250 + Math.random() * 300,
                   -1900 + Math.random() * 2700);
    scene.add(s);
    clouds.push(s);
  }

  // Fifteen of them, scattered under the flight path. They are what you
  // are flying over, and nobody has said a word about it.
  const fires = [];
  for (let i = 0; i < 15; i++) {
    const f = buildFire(puff);
    f.position.set((Math.random() * 2 - 1) * 2400, -338,
                   -2700 + Math.random() * 3600);
    scene.add(f);
    fires.push(f);
  }

  const heli = buildHeli();
  scene.add(heli);
  const ship = buildShip();
  // Nose swung round towards us: it is not passing, it is coming.
  ship.rotation.y = Math.PI + 0.47;
  ship.position.copy(SHIP_FAR);
  scene.add(ship);

  // ── The beam ─────────────────────────────────────────────
  // Two cones down the same line — a wide soft one and a bright core — plus
  // motes riding up it, which is what makes it read as a current rather
  // than a stick of light.
  const beamTex = beamTexture();
  beamTex.repeat.set(1, 7);
  const beamGeo = new THREE.CylinderGeometry(1, 0.32, 1, 28, 1, true);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
    map: beamTex, color: 0x9b4cff, transparent: true, opacity: 0,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false }));
  // Narrow, and nothing like as bright as it wants to be: two additive
  // cones on top of each other against a blue sky come out WHITE, and a
  // white cone is a searchlight, which is the one thing this is not.
  const core = new THREE.Mesh(beamGeo.clone(), new THREE.MeshBasicMaterial({
    color: 0xc98bff, transparent: true, opacity: 0, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  scene.add(beam, core);

  const motePuff = puffTexture(226, 180, 255);
  const motes = [];
  for (let i = 0; i < 46; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: motePuff,
      transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false }));
    const s = 1.2 + Math.random() * 2.4;
    m.scale.set(s, s, 1);
    m.userData.phase = Math.random();
    m.userData.turn = Math.random() * Math.PI * 2;
    scene.add(m);
    motes.push(m);
  }

  // The light that takes the screen at the end. A plane on the camera, so
  // it is in front of whatever the camera happens to be looking at.
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(60, 60),
    new THREE.MeshBasicMaterial({ color: 0xd9bcff, transparent: true,
      opacity: 0, depthTest: false, depthWrite: false, fog: false }));
  flash.position.z = -1;
  flash.renderOrder = 999;
  camera.add(flash);

  // ── Where the camera looks, inside ───────────────────────
  // Yaw is in the aircraft's own space: 0 is straight at the cockpit,
  // +PI/2 is straight out of the open door.
  const LOOK = [
    // It starts aft and low — at the man beside you and the floor — so
    // that the first thing out of the door is not the ship. Opening on the
    // doorway gives the whole thing away in the first second. After that
    // it goes wherever the talking is, and ends up out of the door.
    { at: 0.0,  yaw: 2.10, pitch: -0.24 },
    { at: 1.5,  yaw: 0.80, pitch: -0.02 },   // the man opposite you
    { at: 4.1,  yaw: 0.80, pitch: -0.02 },
    { at: 4.3,  yaw: -0.10, pitch: 0.00 },   // the man beside you
    { at: 8.0,  yaw: -0.10, pitch: 0.00 },
    { at: 8.4,  yaw: 0.34, pitch:  0.02 },   // forward, at the radio
    { at: 10.6, yaw: 0.34, pitch:  0.02 },
    { at: 11.4, yaw: 1.45, pitch: -0.05 },   // and out of the door, at the
    { at: 14.2, yaw: 1.45, pitch: -0.05 },   // ship she is telling you about
    { at: 14.5, yaw: 2.05, pitch:  0.00 },   // the man aft of the door
    { at: 16.6, yaw: 2.05, pitch:  0.00 },
    // Only reached again when the camera comes back inside for the last
    // seconds, by which time the door is where all the light is.
    { at: 26.8, yaw: 1.35, pitch:  0.02 },
  ];
  function lookNow(time) {
    let i = 0;
    while (i < LOOK.length - 1 && time >= LOOK[i + 1].at) i++;
    const a = LOOK[i], b = LOOK[Math.min(i + 1, LOOK.length - 1)];
    const k = b.at > a.at ? smoothstep(a.at, b.at, time) : 1;
    return { yaw: a.yaw + (b.yaw - a.yaw) * k,
             pitch: a.pitch + (b.pitch - a.pitch) * k };
  }

  const SEAT = new THREE.Vector3(0.78, CAB.floor + 1.32, 0.55);
  const ORIGIN = new THREE.Vector3(0, 0, 0);
  const belly = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const perpA = new THREE.Vector3();
  const perpB = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const aimA = new THREE.Vector3();
  const aimB = new THREE.Vector3();

  // ── Clock, cues, state ───────────────────────────────────
  let t = 0;
  let done = false;
  let fade = 1;
  let held = false;
  let rotorPower = 1;
  // Everything the game has to DO at a given second, in order: sounds to
  // start and lines to say. A cue is an object rather than a name because
  // a line carries its words with it.
  const pending = [];
  const CUES = [
    { at: 0.02, sound: 'rotor-on' },
    { at: BEAT.ray - 0.35, sound: 'ray-on' },
    { at: BEAT.pull, sound: 'grab' },
    { at: BEAT.white, sound: 'swallow' },
    { at: BEAT.dark + 0.3, sound: 'quiet' },
  ];
  for (const L of SCRIPT) {
    if (L.radio) CUES.push({ at: L.at - 0.4, sound: 'radio-on' });
    CUES.push({ at: L.at, line: L });
    if (L.radio) CUES.push({ at: L.at + L.dur + 0.1, sound: 'radio-off' });
  }
  CUES.sort((a, b) => a.at - b.at);
  let cueIdx = 0;

  const at = (a, b, time) => Math.min(1, Math.max(0, (time - a) / (b - a)));
  const ease = (x) => x * x * (3 - 2 * x);

  function update(dt) {
    if (done) return true;
    if (held) dt = 0;
    t += dt;
    while (cueIdx < CUES.length && t >= CUES[cueIdx].at) {
      pending.push(CUES[cueIdx++]);
    }

    const d = heli.userData;
    const grabbed = t >= BEAT.pull;

    // The aircraft holds its heading — it is the ship that comes to us.
    // An earlier cut had the pilot turn towards it, which is what anybody
    // would do and exactly wrong for this: turning towards a thing puts it
    // over the nose, and the only window in this set faces sideways.
    if (!grabbed) {
      heli.rotation.z = Math.sin(t * 0.47) * 0.05;
      heli.rotation.y = Math.sin(t * 0.31) * 0.03;
    }

    // --- The aircraft itself ---
    d.rotor.rotation.y += dt * 30 * rotorPower;
    d.tailRotor.rotation.x += dt * 46 * rotorPower;
    d.disc.material.opacity = 0.17 * rotorPower;
    // The cabin light flickers under the blades, which is most of what
    // sells the inside of a helicopter without a single moving shadow.
    d.lamp.intensity = 0.8 + Math.sin(t * 64) * 0.09 * rotorPower;

    // --- The world going past ---
    const speed = grabbed ? 0 : 1;
    // The ground scrolls at the same speed as everything else, which it
    // did not before: the offset is in TEXTURE TILES, not units, so the
    // old number moved the city along at five units a second while the
    // cloud went past at a hundred and fifty. And it moved it the wrong
    // way — the ground has to run aft while the nose points forward.
    groundTex.offset.y += dt * (WORLD_SPEED / (30000 / GROUND_TILE)) * speed;
    for (const c of clouds) {
      c.position.z += dt * WORLD_SPEED * speed;
      if (c.position.z > 900) {
        c.position.z -= 2900;
        c.position.x = (Math.random() * 2 - 1) * 1700;
      }
    }
    for (const f of fires) {
      f.position.z += dt * WORLD_SPEED * speed;
      if (f.position.z > 1200) {
        f.position.z -= 4100;
        f.position.x = (Math.random() * 2 - 1) * 2400;
      }
      // Fire is never steady. Two sine waves and a little noise is enough.
      const u = f.userData;
      u.glow.material.opacity = 0.55 + Math.sin(t * 6.3 + u.flick) * 0.13
                                     + Math.sin(t * 17 + u.flick) * 0.07
                                     + Math.random() * 0.06;
    }

    // --- The ship's approach ---
    if (t < BEAT.wrong) {
      ship.position.lerpVectors(SHIP_FAR, SHIP_NEAR, ease(at(0.5, BEAT.wrong, t)));
    } else {
      ship.position.lerpVectors(SHIP_NEAR, SHIP_OVER, ease(at(BEAT.wrong, BEAT.pull, t)));
    }
    ship.rotation.y = SHIP_YAW_FAR + (SHIP_YAW_NEAR - SHIP_YAW_FAR) *
                      ease(at(2.0, BEAT.ray, t));
    ship.userData.strobe.visible = (t % 1.4) < 0.12;

    // The plates under its nose. Shut for the first eighteen seconds; from
    // here on, this is a different kind of ship.
    const open = ease(at(BEAT.wrong, BEAT.ray - 0.4, t));
    // Only as far as the hull is wide: slid further they come out of the
    // sides of the ship like a pair of ears.
    ship.userData.doorL.position.x = -21 - open * 22;
    ship.userData.doorR.position.x = 21 + open * 22;
    ship.userData.core.material.opacity = 0.25 + open * 0.75;
    ship.updateMatrixWorld(true);
    belly.copy(ship.userData.belly).applyMatrix4(ship.matrixWorld);

    // --- Taken ---
    if (grabbed) {
      // Up the beam, and the longer it has you the faster it has you.
      const u = at(BEAT.pull, BEAT.white - 0.8, t);
      const k = Math.pow(u, 1.8);
      heli.position.lerpVectors(ORIGIN, belly, k);
      heli.rotation.y += dt * (1.6 + 15 * k);
      heli.rotation.z = Math.sin(t * 4.3) * 0.55 * k;
      heli.rotation.x = -0.1 - 0.4 * k;
      rotorPower = Math.max(0.12, 1 - u * 2.2);
      // Inside, the daylight loses and the beam wins.
      d.lamp.color.setRGB(1 - 0.28 * k, 0.78 - 0.44 * k, 0.6 + 0.4 * k);
      d.lamp.intensity = 0.8 + k * 2.4;
      // And the daylight goes out of the cabin as the beam's light comes
      // in, which is most of what makes the inside of it feel taken.
      amb.intensity = 0.78 * (1 - 0.55 * k);
      sun.intensity = 1.0 * (1 - 0.7 * k);
    }

    // --- The beam ---
    const lit = smoothstep(BEAT.ray - 0.1, BEAT.ray + 0.35, t);
    beam.visible = core.visible = lit > 0.01;
    if (beam.visible) {
      spanTo(beam, heli.position, belly, 74 * (0.4 + lit * 0.6));
      spanTo(core, heli.position, belly, 15 * (0.4 + lit * 0.6));
      beam.material.opacity = 0.3 * lit;
      core.material.opacity = 0.2 * lit;
      beamTex.offset.y += dt * (grabbed ? 2.6 : 1.1);
      // Motes, spiralling up the inside of it.
      axis.subVectors(belly, heli.position);
      const len = axis.length() || 1;
      axis.multiplyScalar(1 / len);
      perpA.set(axis.y, -axis.x, 0).normalize();
      perpB.crossVectors(axis, perpA);
      for (const m of motes) {
        const f = (t * 0.6 + m.userData.phase) % 1;
        const r = (12 + (1 - f) * 26) * lit;
        const a = m.userData.turn + f * 5.5;
        tmp.copy(heli.position).addScaledVector(axis, f * len)
           .addScaledVector(perpA, Math.cos(a) * r)
           .addScaledVector(perpB, Math.sin(a) * r);
        m.position.copy(tmp);
        m.material.opacity = lit * 0.75 * Math.sin(f * Math.PI);
      }
    } else {
      for (const m of motes) m.material.opacity = 0;
    }

    // --- The men ---
    const alarmed = smoothstep(BEAT.spot + 1.2, BEAT.wide, t);
    const saying = speaking();
    for (let i = 0; i < 4; i++) {
      const s = d.crew[i];
      if (t >= BEAT.tumble) { poseTossed(s, t + i); continue; }
      // The two facing the door lean into it; the two with their backs to
      // it turn their heads as far as a helmet lets them.
      const faces = i >= 2;
      poseSeated(s, t + i * 0.7, alarmed * (faces ? 0.22 : 0.1),
                 alarmed * (faces ? -0.1 : 1.0));
      // And whoever is talking moves while he does it. There is no jaw on
      // this model — it is a box — so it is the head that does the work,
      // which is enough at the size he is on screen.
      if (saying && saying.crew === i) {
        const k = Math.min(1, (t - saying.at) * 3);
        s.userData.headPivot.rotation.x += Math.sin(t * 9.5) * 0.05 * k;
        s.userData.headPivot.rotation.y += Math.sin(t * 5.3) * 0.06 * k;
        s.userData.hips.rotation.x += Math.sin(t * 4.1) * 0.02 * k;
      }
    }
    const pilot = d.pilot;
    if (t >= BEAT.tumble) {
      poseTossed(pilot, t + 4);
    } else {
      poseSeated(pilot, t * 0.8, 0.12, 0);
      pilot.userData.arms.forEach((arm) => {
        arm.shoulder.rotation.x = -0.75;
        arm.shoulder.rotation.z = arm.side * 0.18;
        arm.elbow.rotation.x = -0.75;
      });
    }

    // --- The camera ---
    const inside = t < BEAT.wide || t >= BEAT.tumble;
    if (inside) {
      if (camera.parent !== heli) heli.add(camera);
      // Airframe buzz: small, fast, and never quite repeating.
      const buzz = rotorPower * 0.0045;
      const wild = t >= BEAT.tumble ? at(BEAT.tumble, BEAT.tumble + 0.5, t) : 0;
      const lk = lookNow(t);
      camera.position.copy(SEAT);
      camera.position.x += Math.sin(t * 31) * 0.012;
      camera.position.y += Math.sin(t * 27 + 1) * 0.014 + Math.sin(t * 1.7) * 0.02;
      camera.rotation.order = 'YXZ';
      camera.rotation.set(
        lk.pitch + Math.sin(t * 29) * buzz + Math.sin(t * 7.3) * wild * 0.22,
        lk.yaw + Math.sin(t * 23) * buzz + Math.sin(t * 5.1) * wild * 0.3,
        Math.sin(t * 19) * buzz * 1.6 + Math.sin(t * 6.2) * wild * 0.25);
    } else {
      if (camera.parent !== scene) scene.add(camera);
      // Outside, standing in the air off its tail. The dolly in is slow
      // enough to read as the ship closing rather than the camera moving.
      const k = ease(at(BEAT.wide, BEAT.ray, t));
      camera.position.set(25 - k * 9, 5 + k * 4, 38 - k * 12);
      // It starts on the helicopter and ends between the helicopter and
      // the thing above it, which is how the ship gets into the shot
      // without the camera ever appearing to move for the ship's sake.
      // Aimed between the two of them by ANGLE rather than by position:
      // the ship is eight hundred metres off and the helicopter is thirty,
      // so splitting the difference in world space points the camera at
      // empty sky with both of them out at the edges.
      aimA.set(heli.position.x, heli.position.y + 3, heli.position.z - 10)
          .sub(camera.position).normalize();
      aimB.copy(belly).sub(camera.position).normalize();
      const up = ease(at(BEAT.wide, BEAT.ray + 0.5, t));
      aimA.lerp(aimB, up * 0.38).normalize();
      camera.lookAt(tmp.copy(camera.position).addScaledVector(aimA, 200));
    }

    // --- Light, then nothing ---
    const fl = at(BEAT.white, BEAT.white + 0.5, t) *
               (1 - at(BEAT.dark + 0.4, BEAT.over - 0.6, t));
    flash.material.opacity = fl;
    flash.material.color.setRGB(0.85 + fl * 0.15, 0.74 + fl * 0.26, 1);

    fade = t < 1.1 ? 1 - t / 1.1 : at(BEAT.dark, BEAT.dark + 1.1, t);
    if (t >= BEAT.over) done = true;
    return done;
  }

  /** The line being spoken this instant, or null between them. */
  function speaking() {
    for (const L of SCRIPT) {
      if (t >= L.at && t < L.at + L.dur + 0.45) return L;
    }
    return null;
  }

  /**
   * The subtitle as it stands this frame: who is talking, what they are
   * saying, and how far up it is faded. It is on screen whatever the
   * machine's speech does or doesn't manage, so the scene survives a
   * browser with no voices in it at all.
   */
  function line() {
    const L = speaking();
    if (!L) return null;
    const since = t - L.at;
    const left = L.at + L.dur + 0.45 - t;
    return { who: L.who, text: L.text, role: L.role,
             alpha: Math.min(1, since / 0.18, left / 0.35) };
  }

  /** Sound cues that came due since the last frame, handed over once. */
  function cues() {
    if (!pending.length) return null;
    return pending.splice(0, pending.length);
  }

  let cut = false;              // you pressed a key rather than watched it
  function skip() { done = true; cut = true; fade = 1; }
  function blackness() { return fade; }

  /** Jump to a second and stop there — the localhost debug hook only. */
  function seek(sec) {
    t = 0; done = false; held = false; cueIdx = CUES.length;
    while (t < sec && !done) update(1 / 60);
    held = true;
  }

  function dispose() {
    camera.remove(flash);
    scene.traverse((o) => {
      if (o.isMesh || o.isSprite || o.isPoints) {
        if (o.geometry) o.geometry.dispose();
        const m = o.material;
        if (Array.isArray(m)) m.forEach((x) => x && x.dispose());
        else if (m) { if (m.map) m.map.dispose(); m.dispose(); }
      }
    });
  }

  return { scene, camera, update, skip, blackness, cues, line, seek, dispose,
           get at() { return t; },
           get skipped() { return cut; },
           get finished() { return done; } };
}
