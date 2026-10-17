import { useState, useEffect, useRef } from "react";
import * as THREE from "three";

// The real models, out of the game itself. The gallery used to build its own
// copies of these, which is how the Twins card ended up showing an older
// design than the one in src/. There is one model per boss now, and this is
// a view onto it.
import { createPuppetMaster } from "/src/bosses/puppet_master.js";
import { createSwarm, syncSwarm } from "/src/bosses/swarm.js";
import { createTwins } from "/src/bosses/twins.js";
import { createBurrower } from "/src/bosses/burrower.js";

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

// =============================================
// WILD CARDS
// =============================================

// =============================================
// ANIMATION
// =============================================

// A gentle idle, so the cards aren't still photographs.
//
// Deliberately NOT the real behaviour: each boss's actual walk, attack and
// death live in its own workshop, driven by its own AI. Two implementations
// of the same motion is exactly how the models drifted apart in the first
// place, so this does the least it can and leaves the rest alone.
function animateBoss(model, time) {
  const d = model.userData;

  if (d.type === 'puppet_master') {
    d.legs.forEach((leg, i) => {
      const cycle = Math.sin(time * 3.5 + i * Math.PI);
      leg.upper.rotation.x = leg.baseUpper + cycle * 0.2;
      leg.lower.rotation.x = leg.baseLower - Math.abs(cycle) * 0.12;
    });
    d.arms.forEach((arm, i) => {
      arm.upper.rotation.x = Math.sin(time * 2 + i * Math.PI) * 0.2;
    });
    if (d.pilotGroup) d.pilotGroup.rotation.z = Math.sin(time * 3.5) * 0.12;
    if (d.tendrilLight) d.tendrilLight.intensity = 1 + Math.sin(time * 3) * 0.4;
    model.position.y = Math.abs(Math.sin(time * 7)) * 0.02;
    return;
  }

  if (d.type === 'swarm') {
    // Its motes are positions in an array, drawn by instanced meshes, so
    // moving them means writing the buffer back.
    for (const m of d.motes) {
      const ph = m.phase + time * 1.1 * m.spin;
      m.pos.set(m.home.x + Math.sin(ph) * 0.07,
                m.home.y + Math.sin(ph * 1.37 + 1.1) * 0.07,
                m.home.z + Math.cos(ph * 0.83) * 0.07);
    }
    syncSwarm(model);
    if (d.aura) d.aura.intensity = 1.4 + Math.sin(time * 3) * 0.5;
    return;
  }

  if (d.type === 'burrower') {
    for (const seg of d.segments) {
      seg.mesh.position.y = seg.baseY + Math.sin(time * 2 - seg.t * 7) * 0.09;
      seg.mesh.position.z = Math.cos(time * 1.4 - seg.t * 5) * 0.07;
    }
    return;
  }

  if (d.type === 'twins') {
    // Blue is the quick, light one; brown is the heavy. Same split the
    // fight uses, just hand-driven here.
    d.twins.forEach((t) => {
      const fast = t.kind === 'blue';
      const rate = fast ? 6 : 2.6, amp = fast ? 0.26 : 0.15;
      t.legs.forEach((leg, i) => {
        const swing = Math.sin(time * rate + i * Math.PI) * amp;
        leg.upper.rotation.x = leg.baseUpper + swing;
        leg.lower.rotation.x = leg.baseLower - Math.abs(swing) * 0.5;
      });
      t.arms.forEach((arm, i) => {
        arm.upper.rotation.x = Math.sin(time * rate + i * Math.PI + Math.PI) * amp * 0.6;
      });
    });
    model.position.y = Math.abs(Math.sin(time * 7)) * 0.015;
  }
}

// =============================================
// UI
// =============================================

// The four bosses being built. Chimera, Hive Queen, Mech Hybrid, the Mimic
// and the Trojan were candidates that didn't get picked, and their models
// have gone with them — a gallery of things nobody is making is just a place
// to get lost.
const BOSSES = [
  { name: "Puppet Master", desc: "Tiny gleeful alien driving a headless brute body via nerve tendrils. Kill the pilot, the body drops.", build: createPuppetMaster, color: "#44ff88", accent: "#44ff88" },
  { name: "The Swarm", desc: "Not one alien — hundreds of tiny ones forming a humanoid shape. Shoot it and it scatters, then reforms.", build: createSwarm, color: "#ff2244", accent: "#ff2244" },
  { name: "The Twins", desc: "Two aliens that share a life. Kill one, the other revives it. Must damage both simultaneously.", build: createTwins, color: "#ff44cc", accent: "#ff44cc", view: { dist: 9, y: 2.6, look: 1.1 } },
  { name: "Burrower", desc: "Giant worm. Only segments arc above floor. Burrows and re-emerges. You fight it in pieces.", build: createBurrower, color: "#ff2244", accent: "#ff6644", view: { dist: 19, y: 5.5, look: 1.2 } },
];

function BossViewer({ boss, index, onCount }) {
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
    // Each boss can ask for its own framing. One shared camera cannot hold a
    // two-metre humanoid and an eleven-metre worm in the same card.
    const view = boss.view || {};
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 120);
    camera.position.set(0, view.y ?? 1.8, view.dist ?? 6.5);
    camera.lookAt(0, view.look ?? 1.0, 0);

    scene.add(new THREE.AmbientLight(0x222233, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(3, 5, 4); scene.add(dir);
    scene.add(cfg(new THREE.DirectionalLight(0x334455, 0.3), { position: new THREE.Vector3(-3, 2, -2) }));

    const grid = new THREE.Mesh(new THREE.RingGeometry(1.2, 2.8, 32),
      new THREE.MeshBasicMaterial({ color: 0x1a1a28, transparent: true, opacity: 0.3 }));
    grid.rotation.x = -Math.PI * 0.5; grid.position.y = -0.6; scene.add(grid);

    const model = boss.build();

    // Measured, not written down. The badges carried hand-typed counts from
    // the gallery's own old models, and the moment the cards started building
    // the real ones every number on them was wrong.
    //
    // An InstancedMesh is ONE mesh however many copies it draws, which is the
    // honest answer for cost — so the Swarm's hundreds of motes are a handful
    // of draw calls. Instances are reported separately rather than folded in.
    if (onCount) {
      let meshes = 0, instances = 0;
      model.traverse((o) => {
        if (!o.isMesh) return;
        meshes++;
        if (o.isInstancedMesh) instances += o.count;
      });
      onCount({ meshes, instances });
    }
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
  const [count, setCount] = useState(null);
  return (
    <div onClick={onClick} style={{
      background: active ? "rgba(255,34,68,0.06)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${active ? boss.accent : "#1a1a28"}`,
      borderRadius: 10, overflow: "hidden", cursor: "pointer",
      transition: "all 0.25s ease",
      boxShadow: active ? `0 0 25px ${boss.accent}22` : "none",
    }}>
      <div style={{ height: 300, position: "relative" }}>
        <BossViewer boss={boss} index={index} onCount={setCount} />
        <div style={{
          position: "absolute", top: 10, right: 10,
          background: "rgba(0,0,0,0.7)", color: boss.accent,
          fontSize: 10, padding: "3px 8px", borderRadius: 4,
        }}>{count
          ? `${count.meshes} meshes${count.instances
              ? ` · ${count.instances} instances` : ""}`
          : "counting…"}</div>
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
  const [selected, setSelected] = useState(null);
  const bosses = BOSSES;

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

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
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
