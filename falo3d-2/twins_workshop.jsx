// falo3d-2/twins_workshop.jsx
// The Twins workshop — for working out the fight.
//
// Drives the real model and brain out of /src/bosses/.
//
// The one mechanic: drop one twin and the other abandons you entirely, walks
// to where it fell, kneels, and brings it back. So the readout here is built
// around the three things that decide the fight — how far the survivor has to
// walk, how long it kneels, and how long the body lasts before it's gone.
//
// Drop one and watch. Then drop the FAR one and watch how much longer you get.

import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { createTwins } from "/src/bosses/twins.js";
import { initTwins, updateTwins, damageTwin, applyTwinSpeeds, FX }
  from "/src/bosses/twins_ai.js";

const BLUE = "#6f8cff";
const BROWN = "#c08a6a";

const FIGHT_PARAMS = [
  { k: "blueHp", label: "blue HP", min: 1, max: 60, step: 1 },
  { k: "blueSpeed", label: "blue speed", min: 0.01, max: 0.2, step: 0.002, unit: "u/f" },
  { k: "blueRange", label: "blue keeps range", min: 2, max: 16, step: 0.5, unit: "u" },
  { k: "blueFireEvery", label: "blue fires every", min: 15, max: 200, step: 5, unit: "f" },
  { k: "blueDamage", label: "bolt damage", min: 1, max: 40, step: 1, unit: "%" },
  { k: "brownHp", label: "brown HP", min: 1, max: 80, step: 1 },
  { k: "brownSpeed", label: "brown speed", min: 0.005, max: 0.2, step: 0.002, unit: "u/f" },
  { k: "brownRange", label: "brown reach", min: 1, max: 6, step: 0.2, unit: "u" },
  { k: "brownSwingEvery", label: "smash cooldown", min: 20, max: 240, step: 5, unit: "f" },
  { k: "brownDamage", label: "smash damage", min: 1, max: 40, step: 1, unit: "%" },
  { k: "smashRaise", label: "arms up (the tell)", min: 4, max: 90, step: 1, unit: "f" },
  { k: "smashDown", label: "swing down", min: 3, max: 40, step: 1, unit: "f" },
  { k: "smashRecover", label: "open afterwards", min: 5, max: 120, step: 1, unit: "f" },
  { k: "smashRange", label: "smash reach", min: 1, max: 7, step: 0.1, unit: "u" },
];

const REVIVE_PARAMS = [
  { k: "fetchSpeed", label: "fetch speed", min: 0.2, max: 2, step: 0.05 },
  { k: "reviveRange", label: "how close to revive", min: 0.5, max: 5, step: 0.1, unit: "u" },
  { k: "reviveFrames", label: "kneeling time", min: 10, max: 400, step: 10, unit: "f" },
  { k: "reviveHpShare", label: "comes back with", min: 0.1, max: 1, step: 0.05 },
  { k: "bleedOutFrames", label: "body lasts", min: 120, max: 1800, step: 30, unit: "f" },
  { k: "downFrames", label: "collapse time", min: 5, max: 90, step: 1, unit: "f" },
];

export default function TwinsWorkshop() {
  const mountRef = useRef(null);
  const [fx, setFx] = useState({ ...FX });
  const [playing, setPlaying] = useState(true);
  const [chasing, setChasing] = useState(true);
  const [read, setRead] = useState(null);

  const api = useRef({});
  const playRef = useRef(playing);
  const chaseRef = useRef(chasing);
  useEffect(() => { Object.assign(FX, fx); if (api.current.sync) api.current.sync(); }, [fx]);
  useEffect(() => { playRef.current = playing; }, [playing]);
  useEffect(() => { chaseRef.current = chasing; }, [chasing]);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    // Lit like the station, which is where this fight happens.
    scene.background = new THREE.Color(0x3a3f4a);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(6, 10, 6); scene.add(key);
    const fill = new THREE.DirectionalLight(0xccd8ff, 0.35);
    fill.position.set(-6, 4, -5); scene.add(fill);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(18, 48),
      new THREE.MeshLambertMaterial({ color: 0xd8dce2 }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    scene.add(new THREE.GridHelper(36, 36, 0x9aa2ae, 0xc2c8d0));

    const target = new THREE.Group();
    const dummyMat = new THREE.MeshLambertMaterial({ color: 0x44667f });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.1, 10), dummyMat);
    torso.position.y = 0.85; target.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), dummyMat);
    head.position.y = 1.55; target.add(head);
    target.position.set(0, 0, 8); scene.add(target);

    // A line from the survivor to the body it's fetching. Nothing in the game
    // draws this — it's here so the WALK, which is the whole mechanic, is
    // something you can see rather than infer.
    const errand = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        [new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: 0xff8844 }));
    errand.frustumCulled = false;
    errand.visible = false;
    scene.add(errand);

    let boss = null;
    function spawn() {
      if (boss) scene.remove(boss);
      boss = createTwins();
      initTwins(boss);
      scene.add(boss);
      if (typeof window !== "undefined") window.__twins = boss;
      return boss;
    }
    spawn();

    const bolts = [];
    api.current = {
      respawn: spawn,
      sync: () => { if (boss) applyTwinSpeeds(boss); },
      hit: (which, amount) => {
        const t = boss.userData.twins.find((x) => x.kind === which);
        return damageTwin(boss, which, amount ?? (t ? t.hp : 1));
      },
      get boss() { return boss; },
    };

    // ── Orbit ──────────────────────────────────────────────
    let yaw = 0.35, pitch = 0.33, dist = 15;
    const focus = new THREE.Vector3();
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
      pitch = Math.max(0.08, Math.min(1.4, pitch - (e.clientY - lastY) * 0.005));
      lastX = e.clientX; lastY = e.clientY;
    });
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      dist = Math.max(5, Math.min(36, dist + e.deltaY * 0.012));
    }, { passive: false });

    function resize() {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize); ro.observe(mount);

    let last = performance.now(), raf = 0, tick = 0, flash = 0;
    function frame() {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (playRef.current && boss) {
        if (chaseRef.current) {
          // The dummy runs at the PLAYER'S speed — 5 u/s, WALK_SPEED in
          // game.js. It used to circle at 1.75 u/s, which meant the brown
          // one always caught it and the chase told you nothing about
          // whether it's actually outrunnable.
          const tt = now / 1000;
          const R = 7, w = 5 / R;          // angular rate for 5 u/s at radius R
          target.position.set(Math.cos(tt * w) * R, 0, Math.sin(tt * w) * R);
        }
        const aim = target.position.clone().setY(1.2);
        updateTwins(boss, aim, Math.min(dt * 60, 3));

        // Turn the brain's attack notes into something visible, the way the
        // game will.
        for (const atk of boss.userData.attacks) {
          if (atk.type === "twin_bolt") {
            const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6),
              new THREE.MeshBasicMaterial({ color: 0xff4466 }));
            m.position.copy(atk.from);
            scene.add(m);
            bolts.push({ mesh: m,
              dir: atk.to.clone().sub(atk.from).normalize(), life: 3 });
          } else if (atk.type === "twin_swing") {
            flash = 0.2;
          }
        }
        boss.userData.attacks.length = 0;

        for (let i = bolts.length - 1; i >= 0; i--) {
          const b = bolts[i];
          b.life -= dt;
          b.mesh.position.addScaledVector(b.dir, 14 * dt);
          if (b.life <= 0 || b.mesh.position.distanceTo(aim) < 0.5) {
            if (b.mesh.position.distanceTo(aim) < 0.5) flash = 0.2;
            scene.remove(b.mesh);
            b.mesh.geometry.dispose(); b.mesh.material.dispose();
            bolts.splice(i, 1);
          }
        }
        if (flash > 0) {
          flash -= dt;
          dummyMat.color.setHex(flash > 0 ? 0xff6b5e : 0x44667f);
        }

        // The errand line.
        const d = boss.userData;
        const downed = d.twins.find((t) => t.state === "down");
        const fetcher = d.twins.find((t) => t.state === "up");
        if (downed && fetcher) {
          const p = errand.geometry.attributes.position;
          p.setXYZ(0, fetcher.group.position.x, 0.08, fetcher.group.position.z);
          p.setXYZ(1, downed.group.position.x, 0.08, downed.group.position.z);
          p.needsUpdate = true;
          errand.visible = true;
        } else {
          errand.visible = false;
        }
      }

      if (boss) {
        const ts = boss.userData.twins;
        focus.x += ((ts[0].group.position.x + ts[1].group.position.x) / 2 - focus.x)
          * Math.min(1, dt * 2);
        focus.z += ((ts[0].group.position.z + ts[1].group.position.z) / 2 - focus.z)
          * Math.min(1, dt * 2);
      }
      camera.position.set(
        focus.x + Math.sin(yaw) * Math.cos(pitch) * dist,
        Math.sin(pitch) * dist + 1.5,
        focus.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      camera.lookAt(focus.x, 1.2, focus.z);
      renderer.render(scene, camera);

      if (boss && ++tick % 6 === 0) {
        const d = boss.userData;
        const downed = d.twins.find((t) => t.state === "down");
        const fetcher = d.twins.find((t) => t.state === "up");
        setRead({
          defeated: d.defeated,
          twins: d.twins.map((t) => ({
            kind: t.kind, hp: Math.max(0, Math.round(t.hp)), hpMax: t.hpMax,
            state: t.state,
            bleed: t.state === "down"
              ? Math.max(0, 1 - t.stateT / FX.bleedOutFrames) : null,
          })),
          smash: d.brown.smash && d.brown.smash.state !== "none"
            ? d.brown.smash.state : null,
          walk: downed && fetcher
            ? fetcher.group.position.distanceTo(downed.group.position) : null,
          kneeling: fetcher && fetcher.reviveT > 0
            ? Math.min(1, fetcher.reviveT / FX.reviveFrames) : null,
        });
      }
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
    background: "rgba(255,255,255,0.025)", border: "1px solid #242833",
    borderRadius: 8, padding: "12px 14px", marginBottom: 10,
  };
  const h3 = {
    margin: "0 0 10px", fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
    color: "#8a94a6", fontWeight: 600,
  };
  const btn = (col) => ({
    background: col || "rgba(255,255,255,0.06)",
    color: col ? "#0b0d12" : "#aab", border: "1px solid #2a2f3a", borderRadius: 5,
    padding: "7px 0", fontSize: 11, cursor: "pointer", letterSpacing: 1,
    textTransform: "uppercase", fontWeight: col ? 700 : 400, width: "100%",
  });

  const Slider = ({ spec, value, onChange }) => (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11,
                    color: "#8a94a6", marginBottom: 3 }}>
        <span>{spec.label}</span>
        <span style={{ color: "#ddd" }}>
          {value}{spec.unit ? ` ${spec.unit}` : ""}
          {spec.unit === "f" && <span style={{ color: "#556" }}> · {(value / 60).toFixed(1)}s</span>}
        </span>
      </div>
      <input type="range" min={spec.min} max={spec.max} step={spec.step} value={value}
        onChange={(e) => onChange(spec.k, parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: BLUE, height: 3 }} />
    </div>
  );
  const setFxK = (k, v) => setFx((p) => ({ ...p, [k]: v }));

  const bar = (v, max, col) => (
    <div style={{ height: 6, background: "#1c2029", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, (v / max) * 100)}%`, height: "100%",
                    background: col }} />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0b0d12", color: "#e8ecf2",
                  padding: "22px 26px", boxSizing: "border-box" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 19, letterSpacing: 4,
                     textTransform: "uppercase", fontWeight: 700 }}>
          Falo 3D-2 — Twins Workshop
        </h1>
        <div style={{ fontSize: 11, color: "#6b7585", marginTop: 5, lineHeight: 1.6 }}>
          Drop one and the other walks to it and brings it back. Try dropping
          the NEAR one, then the FAR one, and watch how much longer the walk
          buys you. Drag to orbit, scroll to zoom.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 330px", gap: 18,
                    alignItems: "start" }}>
        <div style={{ position: "relative", background: "#0e1016",
                      border: "1px solid #242833", borderRadius: 10,
                      overflow: "hidden" }}>
          <div ref={mountRef} style={{ width: "100%", height: "72vh", minHeight: 420 }} />
          {read && (
            <div style={{ position: "absolute", top: 12, left: 12, fontSize: 11,
                          background: "rgba(0,0,0,0.6)", padding: "10px 13px",
                          borderRadius: 6, minWidth: 215, lineHeight: 1.7 }}>
              {read.twins.map((t) => (
                <div key={t.kind} style={{ marginBottom: 8 }}>
                  <div style={{ color: t.kind === "blue" ? BLUE : BROWN,
                                textTransform: "uppercase", letterSpacing: 2,
                                fontWeight: 700 }}>
                    {t.kind} · <span style={{
                      color: t.state === "up" ? "#44ff88"
                           : t.state === "down" ? "#ffb347" : "#ff6b5e" }}>
                      {t.state}</span>
                  </div>
                  <div style={{ color: "#8a94a6" }}>{t.hp}/{t.hpMax}</div>
                  {bar(t.hp, t.hpMax, t.kind === "blue" ? BLUE : BROWN)}
                  {t.bleed != null && (
                    <>
                      <div style={{ color: "#ffb347", marginTop: 3 }}>
                        bleeding out {(t.bleed * 100).toFixed(0)}%
                      </div>
                      {bar(t.bleed, 1, "#ffb347")}
                    </>
                  )}
                </div>
              ))}
              {read.smash && (
                <div style={{ color: "#ffb347", textTransform: "uppercase",
                              letterSpacing: 2, fontWeight: 700 }}>
                  smash · {read.smash}
                </div>
              )}
              {read.walk != null && (
                <div style={{ color: "#ff8844", borderTop: "1px solid #2a2f3a",
                              paddingTop: 6 }}>
                  walking to it · {read.walk.toFixed(1)}u to go
                </div>
              )}
              {read.kneeling != null && (
                <div style={{ color: "#ff8844" }}>
                  reviving {(read.kneeling * 100).toFixed(0)}%
                </div>
              )}
              {read.defeated && (
                <div style={{ color: "#ff6b5e", fontWeight: 700,
                              letterSpacing: 2 }}>BOTH DOWN</div>
              )}
            </div>
          )}
        </div>

        <div>
          <div style={panel}>
            <h3 style={h3}>Drop one</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <button onClick={() => api.current.hit("blue")} style={btn(BLUE)}>
                Drop blue
              </button>
              <button onClick={() => api.current.hit("brown")} style={btn(BROWN)}>
                Drop brown
              </button>
              <button onClick={() => api.current.hit("blue", 4)} style={btn()}>
                Hit blue 4
              </button>
              <button onClick={() => api.current.hit("brown", 4)} style={btn()}>
                Hit brown 4
              </button>
            </div>
            <div style={{ marginTop: 6 }}>
              <button onClick={() => api.current.respawn()} style={btn()}>Reset</button>
            </div>
            <div style={{ fontSize: 10, color: "#6b7585", marginTop: 8, lineHeight: 1.6 }}>
              Drop one and the other stops fighting entirely and goes to it —
              it won't shoot, won't back off, won't look at you. That's the
              window. Drop the second one while it's walking or kneeling and
              the fight ends; let it finish and you're back to two.
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>Playback</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <button onClick={() => setPlaying((v) => !v)} style={btn(playing ? null : BLUE)}>
                {playing ? "Playing" : "Paused"}
              </button>
              <button onClick={() => setChasing((v) => !v)} style={btn(chasing ? BLUE : null)}>
                {chasing ? "Target moves" : "Target still"}
              </button>
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>The revive</h3>
            {REVIVE_PARAMS.map((s) =>
              <Slider key={s.k} spec={s} value={fx[s.k]} onChange={setFxK} />)}
            <div style={{ fontSize: 10, color: "#6b7585", marginTop: 4, lineHeight: 1.6 }}>
              Fetch speed is a multiple of its combat speed. Below 1 it walks
              rather than runs, which is what makes the DISTANCE the fight
              instead of the kneel. "Body lasts" is the other way to win:
              keep the survivor off its twin long enough and it's gone.
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>The two of them</h3>
            <div style={{ fontSize: 10, color: "#6b7585", marginBottom: 9,
                          lineHeight: 1.6 }}>
              You walk at <b style={{ color: "#ddd" }}>0.083 u/f</b> (5 u/s).
              Anything above that outruns you. Damage is in health points and
              you have 100, so the numbers are percentages.
            </div>
            {FIGHT_PARAMS.map((s) =>
              <Slider key={s.k} spec={s} value={fx[s.k]} onChange={setFxK} />)}
          </div>

          <div style={panel}>
            <h3 style={h3}>Values for twins_ai.js</h3>
            <pre style={{ margin: 0, fontSize: 10, lineHeight: 1.7, color: "#7a8494",
                          fontFamily: "ui-monospace, Menlo, monospace",
                          whiteSpace: "pre-wrap" }}>
{`export const FX = {
${[...FIGHT_PARAMS, ...REVIVE_PARAMS].map((s) => `  ${s.k}: ${fx[s.k]},`).join("\n")}
};`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
