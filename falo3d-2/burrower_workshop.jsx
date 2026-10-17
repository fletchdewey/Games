// falo3d-2/burrower_workshop.jsx
// The Burrower workshop.
//
// Drives the real model out of /src/bosses/burrower.js. There are no
// mechanics yet — this is for settling the SHAPE, which is the thing a
// gallery thumbnail can't show you. The whole body comes from one curve, so
// every slider here re-derives it: lengthen the span and the head, the mouth,
// the glow patches and the hole all move with it.
//
// The grey box on the floor is a 1.8-unit stand-in for the player, and the
// line across the top is the station's 4-unit ceiling. Both are here because
// "big" only means something against what it has to fit next to and under.

import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { createBurrower, SHAPE, bodyY, bodyR, bodyX }
  from "/src/bosses/burrower.js";

const ACCENT = "#ff6644";

const SHAPE_PARAMS = [
  { k: "span", label: "length", min: 3, max: 30, step: 0.5, unit: "u" },
  { k: "rise", label: "arch height", min: 0.5, max: 6, step: 0.1, unit: "u" },
  { k: "thick", label: "body thickness", min: 0.15, max: 1.6, step: 0.02, unit: "u" },
  { k: "segments", label: "segments", min: 8, max: 80, step: 1 },
  { k: "headLift", label: "head rears up", min: 0, max: 1.2, step: 0.05 },
  { k: "liftStart", label: "rears from", min: 0.4, max: 0.95, step: 0.01 },
  { k: "taperEnd", label: "stops tapering at", min: 0.5, max: 1, step: 0.01 },
];

const HEAD_PARAMS = [
  { k: "mouth", label: "mouth size", min: 0.2, max: 1.4, step: 0.02 },
  { k: "outerTeeth", label: "outer teeth", min: 0, max: 40, step: 1 },
  { k: "innerTeeth", label: "inner teeth", min: 0, max: 40, step: 1 },
];

export default function BurrowerWorkshop() {
  const mountRef = useRef(null);
  const [shape, setShape] = useState({ ...SHAPE });
  const [stats, setStats] = useState(null);
  const [undulate, setUndulate] = useState(true);
  const api = useRef({});
  const undRef = useRef(undulate);
  useEffect(() => { undRef.current = undulate; }, [undulate]);
  useEffect(() => { if (api.current.rebuild) api.current.rebuild(shape); }, [shape]);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    // The station's own rooms: white floor, cool light.
    scene.background = new THREE.Color(0x3a3f4a);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(8, 12, 7); scene.add(key);
    const fill = new THREE.DirectionalLight(0xccd8ff, 0.35);
    fill.position.set(-7, 5, -6); scene.add(fill);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 56),
      new THREE.MeshLambertMaterial({ color: 0xd8dce2 }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    scene.add(new THREE.GridHelper(60, 60, 0x9aa2ae, 0xc2c8d0));

    // A person, for scale. 1.8 tall, standing off to one side.
    const man = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x5a6472 }));
    man.position.set(0, 0.9, 5);
    scene.add(man);

    // The station ceiling. The real rooms are 4 units, and that is the hard
    // limit on how tall this thing can get.
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshBasicMaterial({ color: 0xff6644, transparent: true,
                                    opacity: 0.08, side: THREE.DoubleSide }));
    ceiling.rotation.x = -Math.PI / 2;
    ceiling.position.y = 4;
    scene.add(ceiling);

    let boss = null;
    function rebuild(s) {
      if (boss) {
        scene.remove(boss);
        boss.traverse((o) => {
          if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
        });
      }
      boss = createBurrower({ ...s, segments: Math.round(s.segments),
        outerTeeth: Math.round(s.outerTeeth), innerTeeth: Math.round(s.innerTeeth) });
      scene.add(boss);
      if (typeof window !== "undefined") window.__burrower = boss;

      let meshes = 0;
      boss.traverse((o) => { if (o.isMesh) meshes++; });
      // Measure the WORM, not the group. A box around everything includes
      // the debris scattered three units around the hole, which reported a
      // 16-unit "length" for an 11-unit body — and these numbers are what
      // the size decisions get made from.
      const box = new THREE.Box3();
      for (const seg of boss.userData.segments) box.expandByObject(seg.mesh);
      for (const tooth of boss.userData.teeth) box.expandByObject(tooth);
      const size = box.getSize(new THREE.Vector3());
      setStats({
        meshes,
        length: size.x, height: box.max.y,
        clearance: 4 - box.max.y,
        overCeiling: box.max.y > 4,
        headY: boss.userData.head.y,
      });
      return boss;
    }
    rebuild(SHAPE);
    api.current = { rebuild };

    // ── Orbit ──────────────────────────────────────────────
    let yaw = 0.5, pitch = 0.25, dist = 20;
    let dragging = false, lastX = 0, lastY = 0;
    const el = renderer.domElement;
    el.addEventListener("pointerdown", (e) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointerup", (e) => {
      dragging = false; el.releasePointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      yaw -= (e.clientX - lastX) * 0.007;
      pitch = Math.max(0.03, Math.min(1.4, pitch - (e.clientY - lastY) * 0.005));
      lastX = e.clientX; lastY = e.clientY;
    });
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      dist = Math.max(5, Math.min(70, dist + e.deltaY * 0.02));
    }, { passive: false });

    function resize() {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize); ro.observe(mount);

    let last = performance.now(), raf = 0;
    function frame() {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      last = now;

      // Placeholder motion: a wave running down the body. Not a mechanic,
      // just enough to see the shape as something alive.
      if (boss && undRef.current) {
        const t = now / 1000;
        for (const s of boss.userData.segments) {
          s.mesh.position.y = s.baseY + Math.sin(t * 2 - s.t * 7) * 0.09;
          s.mesh.position.z = Math.cos(t * 1.4 - s.t * 5) * 0.07;
        }
      } else if (boss) {
        for (const s of boss.userData.segments) {
          s.mesh.position.y = s.baseY;
          s.mesh.position.z = 0;
        }
      }

      camera.position.set(
        Math.sin(yaw) * Math.cos(pitch) * dist,
        Math.sin(pitch) * dist + 2,
        Math.cos(yaw) * Math.cos(pitch) * dist);
      camera.lookAt(0, 1.4, 0);
      renderer.render(scene, camera);
    }
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  const panel = {
    background: "rgba(255,255,255,0.025)", border: "1px solid #2a241f",
    borderRadius: 8, padding: "12px 14px", marginBottom: 10,
  };
  const h3 = {
    margin: "0 0 10px", fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
    color: "#a08a7a", fontWeight: 600,
  };
  const Slider = ({ spec, value, onChange }) => (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11,
                    color: "#a08a7a", marginBottom: 3 }}>
        <span>{spec.label}</span>
        <span style={{ color: "#ddd" }}>
          {value}{spec.unit ? ` ${spec.unit}` : ""}
        </span>
      </div>
      <input type="range" min={spec.min} max={spec.max} step={spec.step} value={value}
        onChange={(e) => onChange(spec.k, parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: ACCENT, height: 3 }} />
    </div>
  );
  const set = (k, v) => setShape((p) => ({ ...p, [k]: v }));

  return (
    <div style={{ minHeight: "100vh", background: "#120e0c", color: "#f0e8e2",
                  padding: "22px 26px", boxSizing: "border-box" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 19, letterSpacing: 4,
                     textTransform: "uppercase", fontWeight: 700 }}>
          Falo 3D-2 — Burrower Workshop
        </h1>
        <div style={{ fontSize: 11, color: "#80706a", marginTop: 5, lineHeight: 1.6 }}>
          Shape only — no mechanics yet. The body is one curve, so every slider
          re-derives the whole worm. Grey box is a 1.8m person; the orange plane
          is the station's 4-unit ceiling. Drag to orbit, scroll to zoom.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 330px", gap: 18,
                    alignItems: "start" }}>
        <div style={{ position: "relative", background: "#171210",
                      border: "1px solid #2a241f", borderRadius: 10,
                      overflow: "hidden" }}>
          <div ref={mountRef} style={{ width: "100%", height: "72vh", minHeight: 420 }} />
          {stats && (
            <div style={{ position: "absolute", top: 12, left: 12, fontSize: 11,
                          background: "rgba(0,0,0,0.55)", padding: "9px 12px",
                          borderRadius: 6, lineHeight: 1.8, color: "#bbb" }}>
              <div>length <span style={{ color: "#ddd" }}>{stats.length.toFixed(1)}u</span>
                <span style={{ color: "#6a5c54" }}> · person is 0.5 wide</span></div>
              <div>peak <span style={{ color: stats.overCeiling ? "#ff6b5e" : "#ddd" }}>
                {stats.height.toFixed(2)}u</span>
                <span style={{ color: stats.clearance < 0.5 ? "#ffb347" : "#6a5c54" }}>
                  {" "}· {stats.clearance.toFixed(2)}u under the ceiling</span></div>
              <div>head at <span style={{ color: "#ddd" }}>{stats.headY.toFixed(2)}u</span></div>
              <div>meshes <span style={{ color: "#ddd" }}>{stats.meshes}</span></div>
              {stats.overCeiling && (
                <div style={{ color: "#ff6b5e", fontWeight: 700 }}>
                  THROUGH THE CEILING
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <div style={panel}>
            <h3 style={h3}>Motion</h3>
            <button onClick={() => setUndulate((v) => !v)} style={{
              width: "100%", background: undulate ? ACCENT : "rgba(255,255,255,0.06)",
              color: undulate ? "#180d08" : "#bbb", border: "1px solid #332a24",
              borderRadius: 5, padding: "7px 0", fontSize: 11, cursor: "pointer",
              letterSpacing: 1, textTransform: "uppercase",
              fontWeight: undulate ? 700 : 400 }}>
              {undulate ? "Undulating" : "Still"}
            </button>
            <div style={{ fontSize: 10, color: "#80706a", marginTop: 7, lineHeight: 1.6 }}>
              Placeholder — a wave running down the body, not a mechanic.
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>The body</h3>
            {SHAPE_PARAMS.map((s) =>
              <Slider key={s.k} spec={s} value={shape[s.k]} onChange={set} />)}
            <div style={{ fontSize: 10, color: "#80706a", marginTop: 4, lineHeight: 1.6 }}>
              "Head rears up" at 0 gives a plain arch with both ends in the
              floor — and then the worm has no front for the mouth to be on.
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>The head</h3>
            {HEAD_PARAMS.map((s) =>
              <Slider key={s.k} spec={s} value={shape[s.k]} onChange={set} />)}
          </div>

          <div style={panel}>
            <h3 style={h3}>Values for burrower.js</h3>
            <pre style={{ margin: 0, fontSize: 10, lineHeight: 1.7, color: "#938177",
                          fontFamily: "ui-monospace, Menlo, monospace",
                          whiteSpace: "pre-wrap" }}>
{`export const SHAPE = {
${[...SHAPE_PARAMS, ...HEAD_PARAMS].map((s) => `  ${s.k}: ${shape[s.k]},`).join("\n")}
};`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
