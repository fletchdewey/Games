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
import { createBurrower, SHAPE } from "/src/bosses/burrower.js";
import { initBurrower, updateBurrower, damageBurrower, forceBurrowerAttack, FX }
  from "/src/bosses/burrower_ai.js";

const ACCENT = "#ff6644";

const SHAPE_PARAMS = [
  { k: "length", label: "length", min: 3, max: 30, step: 0.5, unit: "u" },
  { k: "thick", label: "body thickness", min: 0.15, max: 1.6, step: 0.02, unit: "u" },
  { k: "segments", label: "segments", min: 8, max: 80, step: 1 },
  { k: "taper", label: "tail taper", min: 0, max: 0.9, step: 0.05 },
];

const hurtBtn = {
  flex: 1, background: "rgba(255,255,255,0.06)", color: "#bbb",
  border: "1px solid #332a24", borderRadius: 5, padding: "7px 0",
  fontSize: 11, cursor: "pointer", letterSpacing: 1,
  textTransform: "uppercase",
};

const MOVE_PARAMS = [
  { k: "surfaceSpeed", label: "slither speed", min: 0.01, max: 0.2, step: 0.005, unit: "u/f" },
  { k: "burrowSpeed", label: "burrow speed", min: 0.01, max: 0.3, step: 0.005, unit: "u/f" },
  { k: "turnRate", label: "turn rate", min: 0.005, max: 0.15, step: 0.005 },
  { k: "weaveAmp", label: "weave", min: 0, max: 1.6, step: 0.05, unit: "rad" },
  { k: "weaveRate", label: "weave rate", min: 0.2, max: 5, step: 0.1 },
];

const BURROW_PARAMS = [
  { k: "diveBeyond", label: "dives beyond", min: 3, max: 25, step: 0.5, unit: "u" },
  { k: "diveSpeed", label: "dive speed", min: 0.02, max: 0.3, step: 0.005, unit: "u/f" },
  { k: "holeLip", label: "hole lip", min: 0.4, max: 4, step: 0.1, unit: "u" },
  { k: "minSurfaceFrames", label: "min time up", min: 0, max: 600, step: 10, unit: "f" },
  { k: "maxSurfaceFrames", label: "max time up", min: 60, max: 900, step: 10, unit: "f" },
  { k: "minUnderFrames", label: "min time under", min: 0, max: 600, step: 10, unit: "f" },
];

const HURT_PARAMS = [
  { k: "hp", label: "health", min: 20, max: 500, step: 10 },
  { k: "flinchAfter", label: "grace before it bolts", min: 0, max: 300, step: 10, unit: "f" },
  { k: "bloodCount", label: "blood per hit", min: 0, max: 40, step: 1 },
  { k: "bloodSpeed", label: "blood force", min: 0.01, max: 0.2, step: 0.005, unit: "u/f" },
  { k: "bloodLife", label: "blood life", min: 5, max: 200, step: 5, unit: "f" },
  { k: "bloodSize", label: "blood size", min: 0.02, max: 0.3, step: 0.01 },
  { k: "bloodLift", label: "blood lift", min: 0, max: 3, step: 0.1 },
];

const ATTACK_PARAMS = [
  { k: "ambushRadius", label: "comes up at", min: 1, max: 10, step: 0.2, unit: "u" },
  { k: "tellFrames", label: "warning", min: 0, max: 120, step: 2, unit: "f" },
  { k: "burstUp", label: "launch", min: 0.08, max: 0.4, step: 0.01, unit: "u/f" },
  { k: "airGravity", label: "gravity", min: 0.002, max: 0.02, step: 0.0005 },
  { k: "lungeMax", label: "top lunge speed", min: 0.05, max: 0.4, step: 0.01, unit: "u/f" },
  { k: "lungeSteer", label: "mid-air steer", min: 0, max: 0.2, step: 0.005 },
  { k: "slamRange", label: "slam reach", min: 0.5, max: 6, step: 0.1, unit: "u" },
  { k: "slamDamage", label: "slam damage", min: 0, max: 50, step: 1, unit: "%" },
];

const HEAD_PARAMS = [
  { k: "mouth", label: "mouth size", min: 0.2, max: 1.4, step: 0.02 },
  { k: "outerTeeth", label: "outer teeth", min: 0, max: 40, step: 1 },
  { k: "innerTeeth", label: "inner teeth", min: 0, max: 40, step: 1 },
];

export default function BurrowerWorkshop() {
  const mountRef = useRef(null);
  const [shape, setShape] = useState({ ...SHAPE });
  const [fx, setFx] = useState({ ...FX });
  const [stats, setStats] = useState(null);
  const [read, setRead] = useState(null);
  const [chasing, setChasing] = useState(true);
  const api = useRef({});
  const chaseRef = useRef(chasing);
  const tally = useRef({ hits: 0, damage: 0, angles: [] });
  const queued = useRef([]);
  const [note, setNote] = useState("");
  const lastMode = useRef("surface");
  useEffect(() => { chaseRef.current = chasing; }, [chasing]);
  useEffect(() => { Object.assign(FX, fx); }, [fx]);
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

    // The player it's coming for — 1.8 tall, and it doubles as the scale
    // reference. Walks at 5 u/s, same as the real one.
    const man = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x5a6472 }));
    man.position.set(0, 0.9, 7);
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
          // isMesh misses the blood Points, which would leak a buffer on
          // every rebuild. Anything with a geometry gets disposed.
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
      }
      boss = createBurrower({ ...s, segments: Math.round(s.segments),
        outerTeeth: Math.round(s.outerTeeth), innerTeeth: Math.round(s.innerTeeth) });
      initBurrower(boss, { x: 0, z: -9 });
      scene.add(boss);
      if (typeof window !== "undefined") window.__burrower = boss;

      let meshes = 0;
      boss.traverse((o) => { if (o.isMesh) meshes++; });
      setStats({ meshes, length: s.length, thick: s.thick });
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

    let last = performance.now(), raf = 0, tick = 0;
    function frame() {
      raf = requestAnimationFrame(frame);
      const now = performance.now();

      const dt = Math.min((now - (last || now)) / 1000, 0.05);
      if (boss) {
        // The target walks a circle at the player's real 5 u/s, so "it can't
        // catch you on the surface" is something you can watch rather than
        // take on trust.
        if (chaseRef.current) {
          const tt = now / 1000, R = 9, w = 5 / R;
          man.position.set(Math.cos(tt * w) * R, 0.9, Math.sin(tt * w) * R);
        }
        updateBurrower(boss, man.position.clone().setY(0), Math.min(dt * 60, 3));

        // Button presses are drained here rather than handled in the click,
        // because this is the only place the live boss object is in scope.
        while (queued.current.length) {
          const what = queued.current.shift();
          if (what === "hurt") {
            // A shot lands on a random bit that is actually above ground, the
            // way a bullet would, rather than always on the nose.
            const up = boss.userData.segments.filter((sg) => sg.depth < 0.5);
            const target = up.length
              ? up[Math.floor(Math.random() * up.length)].mesh.position
              : boss.userData.head.position;
            const r = damageBurrower(boss, 10, "body", target);
            setNote(r === "dead" ? "killed"
                  : r === null ? "all the way under — nothing to hit"
                  : "hit — it bolts");
          } else if (what === "attack") {
            setNote(forceBurrowerAttack(boss));
          } else if (what === "kill") {
            // It can't be hurt while buried, so bring it up first.
            boss.userData.surfaceAt = 0;
            damageBurrower(boss, 1e9, "body", boss.userData.head.position);
            setNote("killed");
          }
        }

        // Drain the attack queue the way the game will, so the damage it
        // deals is something you can watch add up rather than guess at.
        const dd = boss.userData;
        while (dd.attacks.length) {
          const a = dd.attacks.shift();
          tally.current.hits++;
          tally.current.damage += a.damage;
        }
        if (dd.mode === "tell" && lastMode.current !== "tell") {
          // Which side of the target it chose, in degrees clockwise from the
          // direction the target is travelling. Spread over many leaps is how
          // you tell it really is coming from all angles.
          const dx = dd.headPos.x - man.position.x;
          const dz = dd.headPos.z - man.position.z;
          tally.current.angles.push(
            Math.round((Math.atan2(dx, dz) * 180 / Math.PI + 360) % 360));
          if (tally.current.angles.length > 8) tally.current.angles.shift();
        }
        lastMode.current = dd.mode;

        if (++tick % 6 === 0) {
          const d = boss.userData;
          setRead({
            mode: d.mode,
            under: Math.round(d.surfaceAt * 100),
            dist: Math.hypot(man.position.x - d.headPos.x,
                             man.position.z - d.headPos.z),
            hp: Math.round(d.hp),
            dead: d.isDead,
            hits: tally.current.hits,
            damage: tally.current.damage,
            angles: tally.current.angles.slice(-5),
          });
        }
      }

      last = now;
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
  const setFxK = (k, v) => setFx((p) => ({ ...p, [k]: v }));

  return (
    <div style={{ minHeight: "100vh", background: "#120e0c", color: "#f0e8e2",
                  padding: "22px 26px", boxSizing: "border-box" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 19, letterSpacing: 4,
                     textTransform: "uppercase", fontWeight: 700 }}>
          Falo 3D-2 — Burrower Workshop
        </h1>
        <div style={{ fontSize: 11, color: "#80706a", marginTop: 5, lineHeight: 1.6 }}>
          It slithers at you on the surface, and goes under the floor when it
          has ground to cover. Only the head is steered — the body rides the
          trail it already took. Grey box is a 1.8m player moving at a real
          5 u/s. Drag to orbit, scroll to zoom.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 330px", gap: 18,
                    alignItems: "start" }}>
        <div style={{ position: "relative", background: "#171210",
                      border: "1px solid #2a241f", borderRadius: 10,
                      overflow: "hidden" }}>
          <div ref={mountRef} style={{ width: "100%", height: "72vh", minHeight: 420 }} />
          {read && (
            <div style={{ position: "absolute", top: 12, left: 12, fontSize: 11,
                          background: "rgba(0,0,0,0.6)", padding: "10px 13px",
                          borderRadius: 6, lineHeight: 1.8, color: "#bbb",
                          minWidth: 180 }}>
              <div style={{ color: read.mode === "surface" ? "#44ff88"
                                 : read.mode === "under" ? "#ffb347" : "#ff8844",
                            textTransform: "uppercase", letterSpacing: 2,
                            fontWeight: 700 }}>{read.mode}</div>
              <div>under <span style={{ color: "#ddd" }}>{read.under}%</span>
                <span style={{ color: "#6a5c54" }}> of its length</span></div>
              <div>range <span style={{ color: "#ddd" }}>{read.dist.toFixed(1)}u</span>
                <span style={{ color: "#6a5c54" }}>
                  {" "}· dives past {fx.diveBeyond}, ambushes at {fx.ambushRadius}</span></div>
              <div>its health <span style={{ color: read.dead ? "#ff4422" : "#ddd" }}>
                {read.hp}</span>
                <span style={{ color: "#6a5c54" }}> of {fx.hp}
                  {read.dead ? " · down" : ""}</span></div>
              <div>leaps landed <span style={{ color: read.hits ? "#ff6644" : "#ddd" }}>
                {read.hits}</span>
                <span style={{ color: "#6a5c54" }}> · {read.damage}% taken</span></div>
              {read.angles.length > 0 && (
                <div style={{ color: "#6a5c54" }}>from{" "}
                  <span style={{ color: "#ddd" }}>{read.angles.join("°, ")}°</span></div>
              )}
              {stats && <div>meshes <span style={{ color: "#ddd" }}>{stats.meshes}</span>
                <span style={{ color: "#6a5c54" }}> · {stats.length}u long</span></div>}
            </div>
          )}
        </div>

        <div>
          <div style={panel}>
            <h3 style={h3}>The target</h3>
            <button onClick={() => setChasing((v) => !v)} style={{
              width: "100%", background: chasing ? ACCENT : "rgba(255,255,255,0.06)",
              color: chasing ? "#180d08" : "#bbb", border: "1px solid #332a24",
              borderRadius: 5, padding: "7px 0", fontSize: 11, cursor: "pointer",
              letterSpacing: 1, textTransform: "uppercase",
              fontWeight: chasing ? 700 : 400 }}>
              {chasing ? "Running (5 u/s)" : "Standing still"}
            </button>
            <div style={{ fontSize: 10, color: "#80706a", marginTop: 7, lineHeight: 1.6 }}>
              It slithers at 3.3 u/s and burrows at 6.3, against your 5. It
              cannot catch you on the surface — which is exactly why it goes
              under. Stand still and it stays up and comes at you.
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>Moving</h3>
            {MOVE_PARAMS.map((s2) =>
              <Slider key={s2.k} spec={s2} value={fx[s2.k]} onChange={setFxK} />)}
            <div style={{ fontSize: 10, color: "#80706a", marginTop: 4, lineHeight: 1.6 }}>
              Only the head is steered. The body sits on the trail it already
              took, so the weave travels down its length on its own.
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>Burrowing</h3>
            {BURROW_PARAMS.map((s2) =>
              <Slider key={s2.k} spec={s2} value={fx[s2.k]} onChange={setFxK} />)}
            <div style={{ fontSize: 10, color: "#80706a", marginTop: 4, lineHeight: 1.6 }}>
              It digs one hole and feeds itself through it, nose first. The
              body replays whatever the head did, a moment later.
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>Getting shot</h3>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => queued.current.push("hurt")}
                style={{ ...hurtBtn, background: ACCENT, color: "#180d08",
                         fontWeight: 700 }}>Hurt</button>
              <button onClick={() => queued.current.push("attack")}
                style={hurtBtn}>Attack</button>
              <button onClick={() => queued.current.push("kill")}
                style={hurtBtn}>Kill</button>
              <button onClick={() => { api.current.rebuild && api.current.rebuild(shape);
                                       tally.current = { hits: 0, damage: 0, angles: [] };
                                       setNote(""); }}
                style={hurtBtn}>Reset</button>
            </div>
            {note && <div style={{ fontSize: 10, color: ACCENT, marginTop: 7,
                                   letterSpacing: 1, textTransform: "uppercase" }}>
              {note}</div>}
            {HURT_PARAMS.map((s2) =>
              <Slider key={s2.k} spec={s2} value={fx[s2.k]} onChange={setFxK} />)}
            <div style={{ fontSize: 10, color: "#80706a", marginTop: 8, lineHeight: 1.6 }}>
              Hurt lands a shot on a random bit of it that is above ground,
              throws blood, and sends it back down a fresh hole — once it has
              been up longer than the grace window, so there is always a
              moment to shoot it. Attack makes it ambush now; from the surface
              it has to dive first, because it can't leap from up there.
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>The ambush</h3>
            {ATTACK_PARAMS.map((s2) =>
              <Slider key={s2.k} spec={s2} value={fx[s2.k]} onChange={setFxK} />)}
            <button
              onClick={() => { tally.current = { hits: 0, damage: 0, angles: [] }; }}
              style={{ width: "100%", background: "rgba(255,255,255,0.06)",
                       color: "#bbb", border: "1px solid #332a24", borderRadius: 5,
                       padding: "6px 0", fontSize: 10, cursor: "pointer",
                       letterSpacing: 1, textTransform: "uppercase",
                       marginTop: 8 }}>Reset the tally</button>
            <div style={{ fontSize: 10, color: "#80706a", marginTop: 8, lineHeight: 1.6 }}>
              Underground it heads for a spot beside the target, not for the
              target, turning at least a quarter circle off its last approach
              each time. The floor cracks and spits for the warning, then it
              erupts and leaps at where the target was when it launched.
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>The body</h3>
            {SHAPE_PARAMS.map((s) =>
              <Slider key={s.k} spec={s} value={shape[s.k]} onChange={set} />)}
            <div style={{ fontSize: 10, color: "#80706a", marginTop: 4, lineHeight: 1.6 }}>
              Changing these rebuilds the worm and puts it back at its start.
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
};
export const FX = {
${[...MOVE_PARAMS, ...BURROW_PARAMS, ...ATTACK_PARAMS, ...HURT_PARAMS].map((s) => `  ${s.k}: ${fx[s.k]},`).join("\n")}
};`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
