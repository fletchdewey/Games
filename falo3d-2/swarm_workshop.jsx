// falo3d-2/swarm_workshop.jsx
// The Swarm workshop — for working out how it moves.
//
// Like the Puppet Master's, this drives the REAL model and the REAL brain out
// of /src/bosses/, so a number settled on here is a number to change in one
// place rather than in a copy that drifts.
//
// Right now there is one thing to look at: it FLOATS. No walk cycle, because
// there is no skeleton to walk with. The drift, the bob, the lean and the
// trailing lower motes are all separate sliders so each can be judged on its
// own — turn the lag to 0 and it stops reading as floating at all, which is
// the quickest way to see what that one is doing.

import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { createSwarm, disposeSwarm, SWARM } from "/src/bosses/swarm.js";
import { initSwarm, updateSwarm, damageSwarm, forceSwarmAttack, FX }
  from "/src/bosses/swarm_ai.js";

const ACCENT = "#ff44cc";

const MASS_PARAMS = [
  { k: "hoverY", label: "hover height", min: 0, max: 1.5, step: 0.05, unit: "u" },
  { k: "bobHeight", label: "bob height", min: 0, max: 0.6, step: 0.01, unit: "u" },
  { k: "bobRate", label: "bob rate", min: 0.2, max: 5, step: 0.1 },
  { k: "driftSpeed", label: "drift speed", min: 0.005, max: 0.12, step: 0.005, unit: "u/f" },
  { k: "keepAway", label: "keeps its distance", min: 1, max: 12, step: 0.5, unit: "u" },
  { k: "leanInto", label: "lean into travel", min: 0, max: 2, step: 0.05 },
  { k: "turnRate", label: "turn rate", min: 0.01, max: 0.3, step: 0.01 },
];

const MOTE_PARAMS = [
  { k: "swirl", label: "mote swirl", min: 0, max: 0.4, step: 0.01, unit: "u" },
  { k: "swirlRate", label: "swirl rate", min: 0.1, max: 4, step: 0.1 },
  { k: "lag", label: "lower-mote lag", min: 0, max: 2, step: 0.05 },
  { k: "lagSpring", label: "catch-up speed", min: 0.01, max: 0.5, step: 0.01 },
];

const DEATH_PARAMS = [
  { k: "frenzyFrames", label: "frenzy time", min: 10, max: 300, step: 5, unit: "f" },
  { k: "frenzySpeed", label: "frenzy speed", min: 0.05, max: 0.8, step: 0.01, unit: "u/f" },
  { k: "frenzyTurn", label: "frenzy wildness", min: 0.02, max: 0.8, step: 0.02 },
  { k: "frenzyPull", label: "pull to centre", min: 0, max: 0.06, step: 0.002 },
  { k: "fallFrames", label: "fall time", min: 10, max: 200, step: 5, unit: "f" },
  { k: "fallGravity", label: "gravity", min: 0.0005, max: 0.012, step: 0.0005 },
  { k: "vanishFrames", label: "vanish time", min: 10, max: 200, step: 5, unit: "f" },
];

const HURT_PARAMS = [
  { k: "hp", label: "hits to kill", min: 1, max: 60, step: 1 },
  { k: "scatterSpeed", label: "scatter force", min: 0.05, max: 1, step: 0.01, unit: "u/f" },
  { k: "scatterSpread", label: "scatter spread", min: 0, max: 2, step: 0.05 },
  { k: "scatterDrag", label: "scatter drag", min: 0.8, max: 0.99, step: 0.005 },
  { k: "scatterFrames", label: "flying apart", min: 4, max: 90, step: 1, unit: "f" },
  { k: "hangFrames", label: "held apart", min: 0, max: 120, step: 2, unit: "f" },
  { k: "reformFrames", label: "pulling together", min: 10, max: 180, step: 2, unit: "f" },
];

const ATTACK_PARAMS = [
  { k: "attackers", label: "how many come out", min: 1, max: 8, step: 1 },
  { k: "attackCooldown", label: "between attacks", min: 20, max: 300, step: 5, unit: "f" },
  { k: "attackRange", label: "attack range", min: 3, max: 20, step: 0.5, unit: "u" },
  { k: "windFrames", label: "pull-back (the tell)", min: 2, max: 90, step: 1, unit: "f" },
  { k: "windPull", label: "pull-back distance", min: 0, max: 2, step: 0.05, unit: "u" },
  { k: "flySpeed", label: "fly speed", min: 0.05, max: 0.6, step: 0.01, unit: "u/f" },
  { k: "flySteer", label: "homing", min: 0, max: 0.2, step: 0.005 },
  { k: "hitRadius", label: "hit radius", min: 0.2, max: 2, step: 0.05, unit: "u" },
  { k: "returnSpeed", label: "return speed", min: 0.02, max: 0.5, step: 0.01 },
  { k: "damage", label: "damage", min: 1, max: 25, step: 1 },
];

export default function SwarmWorkshop() {
  const mountRef = useRef(null);
  const [fx, setFx] = useState({ ...FX });
  const [count, setCount] = useState(SWARM.count);
  const [playing, setPlaying] = useState(true);
  const [chasing, setChasing] = useState(true);
  const [stats, setStats] = useState(null);
  const [outCount, setOutCount] = useState(0);
  const [phase, setPhase] = useState("held");
  const [hp, setHp] = useState(FX.hp);
  const [lastShot, setLastShot] = useState(null);

  const api = useRef({});
  const fxRef = useRef(fx);
  const playRef = useRef(playing);
  const chaseRef = useRef(chasing);
  useEffect(() => { fxRef.current = fx; Object.assign(FX, fx); }, [fx]);
  useEffect(() => { playRef.current = playing; }, [playing]);
  useEffect(() => { chaseRef.current = chasing; }, [chasing]);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    // Lit like the station it fights in, not like a dark gallery. The swarm's
    // motes are nearly black on purpose — against the white floors and walls
    // of the real rooms that reads as a dark cloud, but on a dark stage it
    // disappears, and tuning it there would be tuning the wrong thing.
    scene.background = new THREE.Color(0x3a3f4a);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(5, 9, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xccd8ff, 0.35);
    fill.position.set(-6, 4, -5);
    scene.add(fill);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 48),
      new THREE.MeshLambertMaterial({ color: 0xd8dce2 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    scene.add(new THREE.GridHelper(32, 32, 0x9aa2ae, 0xc2c8d0));

    // Something to drift at. r128 has no CapsuleGeometry.
    const target = new THREE.Group();
    const dummyMat = new THREE.MeshLambertMaterial({ color: 0x44667f });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.1, 10), dummyMat);
    torso.position.y = 0.85;
    target.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), dummyMat);
    head.position.y = 1.55;
    target.add(head);
    target.position.set(0, 0, 7);
    scene.add(target);

    let boss = null;
    function spawn(n) {
      if (boss) {
        scene.remove(boss);
        disposeSwarm(boss);
      }
      boss = createSwarm(n);
      initSwarm(boss);
      // Reachable from the console. Checking a death sequence by screenshot
      // means catching a stage that lasts a second — being able to sample
      // the phase directly is the difference between verifying it and
      // assuming it.
      if (typeof window !== "undefined") window.__swarm = boss;
      boss.position.set(0, FX.hoverY, -3);
      scene.add(boss);
      const geo = boss.userData.geo;
      const tris = (geo.index ? geo.index.count : geo.getAttribute("position").count) / 3;
      setStats({
        motes: boss.userData.motes.length,
        draws: boss.userData.meshes.length,
        tris: Math.round(tris * boss.userData.motes.length),
      });
      return boss;
    }
    spawn(count);
    // A shot lands somewhere on the body, not at its centre — the scatter
    // blows outward from the impact, so where it hits is visible in the burst.
    api.current = {
      respawn: (n) => spawn(n),
      shoot: (amount) => {
        const a = Math.random() * Math.PI * 2;
        const at = new THREE.Vector3(
          boss.position.x + Math.cos(a) * 0.4,
          0.6 + Math.random() * 1.5,
          boss.position.z + Math.sin(a) * 0.4);
        const landed = damageSwarm(boss, amount ?? 1, at);
        setLastShot(landed ? (amount > 1 ? "killed" : "hit") : "no body there");
      },
      kill: () => api.current.shoot(boss.userData.hp),
      attack: () => {
        setLastShot(forceSwarmAttack(boss) ? "attack launched"
                                           : "can't — in pieces or already out");
      },
      get boss() { return boss; },
    };

    // ── Orbit ──────────────────────────────────────────────
    let yaw = 0.5, pitch = 0.28, dist = 12;
    const focus = new THREE.Vector3(0, 1.2, 0);
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
      pitch = Math.max(0.05, Math.min(1.4, pitch - (e.clientY - lastY) * 0.005));
      lastX = e.clientX; lastY = e.clientY;
    });
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      dist = Math.max(4, Math.min(30, dist + e.deltaY * 0.01));
    }, { passive: false });

    function resize() {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let last = performance.now(), raf = 0, hitFlash = 0, tick = 0;
    function frame() {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (playRef.current && boss) {
        if (chaseRef.current) {
          const t = now / 1000;
          target.position.set(Math.cos(t * 0.3) * 6.5, 0, Math.sin(t * 0.3) * 6.5);
        }
        updateSwarm(boss, target.position.clone().setY(1.2), Math.min(dt * 60, 3));

        // The game reads currentAttack and turns it into damage. Here it just
        // flashes the dummy, so a landed hit is visible rather than inferred.
        if (boss.userData.currentAttack) {
          boss.userData.currentAttack = null;
          hitFlash = 0.18;
        }
        if (hitFlash > 0) {
          hitFlash -= dt;
          dummyMat.color.setHex(hitFlash > 0 ? 0xff6b5e : 0x44667f);
        }
        // Every 6th frame: a setState per frame re-renders the whole panel
        // sixty times a second for a number that changes twice an attack.
        if (++tick % 6 === 0) {
          setOutCount(boss.userData.motes.filter((m) => m.state !== "home").length);
          setPhase(boss.userData.phase);
          setHp(boss.userData.hp);
        }
      }

      if (boss) {
        focus.x += (boss.position.x - focus.x) * Math.min(1, dt * 2.5);
        focus.z += (boss.position.z - focus.z) * Math.min(1, dt * 2.5);
      }
      camera.position.set(
        focus.x + Math.sin(yaw) * Math.cos(pitch) * dist,
        Math.sin(pitch) * dist + 1.4,
        focus.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      camera.lookAt(focus.x, 1.2, focus.z);
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
    background: "rgba(255,255,255,0.025)", border: "1px solid #241e2c",
    borderRadius: 8, padding: "12px 14px", marginBottom: 10,
  };
  const h3 = {
    margin: "0 0 10px", fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
    color: "#9a8aaa", fontWeight: 600,
  };
  const btn = (on) => ({
    background: on ? ACCENT : "rgba(255,255,255,0.06)",
    color: on ? "#1a0614" : "#bab", border: "1px solid #2e2636", borderRadius: 5,
    padding: "7px 0", fontSize: 11, cursor: "pointer", letterSpacing: 1,
    textTransform: "uppercase", fontWeight: on ? 700 : 400, width: "100%",
  });

  const Slider = ({ spec, value, onChange }) => (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11,
                    color: "#9a8aaa", marginBottom: 3 }}>
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

  const setFxK = (k, v) => setFx((p) => ({ ...p, [k]: v }));

  return (
    <div style={{ minHeight: "100vh", background: "#0a0812", color: "#eae6f0",
                  padding: "22px 26px", boxSizing: "border-box" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 19, letterSpacing: 4,
                     textTransform: "uppercase", fontWeight: 700 }}>
          Falo 3D-2 — Swarm Workshop
        </h1>
        <div style={{ fontSize: 11, color: "#776a85", marginTop: 5, lineHeight: 1.6 }}>
          Running the real model and brain out of <code>/src/bosses/</code>.
          It floats — there is no skeleton to walk with. Drag to orbit, scroll to zoom.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 330px", gap: 18,
                    alignItems: "start" }}>
        <div style={{ position: "relative", background: "#0c0a12",
                      border: "1px solid #241e2c", borderRadius: 10,
                      overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 12, left: 12, zIndex: 2,
                        fontSize: 11, background: "rgba(0,0,0,0.55)",
                        padding: "8px 12px", borderRadius: 6, color: "#bab",
                        lineHeight: 1.8, minWidth: 150 }}>
            <div style={{ color: phase === "held" ? "#44ff88" : "#ffb347",
                          textTransform: "uppercase", letterSpacing: 2,
                          fontWeight: 700 }}>
              {phase === "held" ? "can be hurt" : phase}
            </div>
            <div>hits left <span style={{ color: "#ddd" }}>{hp}</span></div>
            <div>out of the body <span style={{
              color: outCount ? ACCENT : "#665a70", fontWeight: 700 }}>{outCount}</span></div>
            {lastShot && (
              <div style={{ color: lastShot === "hit" ? "#44ff88" : "#ff6b5e" }}>
                last shot: {lastShot}
              </div>
            )}
          </div>
          <div ref={mountRef} style={{ width: "100%", height: "72vh", minHeight: 420 }} />
        </div>

        <div>
          <div style={panel}>
            <h3 style={h3}>Playback</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <button onClick={() => setPlaying((v) => !v)} style={btn(!playing)}>
                {playing ? "Playing" : "Paused"}
              </button>
              <button onClick={() => setChasing((v) => !v)} style={btn(chasing)}>
                {chasing ? "Target moves" : "Target still"}
              </button>
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>The float</h3>
            {MASS_PARAMS.map((s) =>
              <Slider key={s.k} spec={s} value={fx[s.k]} onChange={setFxK} />)}
            <div style={{ fontSize: 10, color: "#776a85", marginTop: 4, lineHeight: 1.6 }}>
              The bob is set from the hover height every frame, never added to
              it — the Puppet Master's pilot climbed off the map doing that.
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>The motes</h3>
            {MOTE_PARAMS.map((s) =>
              <Slider key={s.k} spec={s} value={fx[s.k]} onChange={setFxK} />)}
            <div style={{ fontSize: 10, color: "#776a85", marginTop: 4, lineHeight: 1.6 }}>
              Lag is the one that sells it: the lower motes trail, so the head
              arrives first and the legs stream after. Drop it to 0 and the
              whole thing stops reading as floating.
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>Make it do things</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
                          marginBottom: 10 }}>
              <button onClick={() => api.current.shoot()} style={btn(false)}>Hit</button>
              <button onClick={() => api.current.attack()} style={btn(false)}>Attack</button>
              <button onClick={() => api.current.kill()} style={btn(false)}>Kill</button>
              <button onClick={() => api.current.respawn(count)} style={btn(false)}>Reset</button>
            </div>
            {HURT_PARAMS.map((s2) =>
              <Slider key={s2.k} spec={s2} value={fx[s2.k]} onChange={setFxK} />)}
            <div style={{ fontSize: 10, color: "#776a85", marginTop: 4, lineHeight: 1.6 }}>
              Hit it twice fast: the second does nothing, because there's no
              body there to hit. It can't attack while it's in pieces either,
              so a hit buys you a breather and costs you the follow-up. HP is
              a count of HITS — you only ever land one per scatter.
            </div>
            <div style={{ fontSize: 10, color: "#776a85", marginTop: 7, lineHeight: 1.6 }}>
              Death runs in three stages — <b style={{ color: "#ddd" }}>frenzy</b>,
              <b style={{ color: "#ddd" }}> fall</b>, <b style={{ color: "#ddd" }}>vanish</b> —
              and the stage shows in the readout as it goes.
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>The death</h3>
            {DEATH_PARAMS.map((s2) =>
              <Slider key={s2.k} spec={s2} value={fx[s2.k]} onChange={setFxK} />)}
            <div style={{ fontSize: 10, color: "#776a85", marginTop: 4, lineHeight: 1.6 }}>
              The pull to centre is what keeps the frenzy a churning cloud. At
              0 they scatter off in straight lines and the whole thing just
              empties out of frame.
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>The attack</h3>
            {ATTACK_PARAMS.map((s2) =>
              <Slider key={s2.k} spec={s2} value={fx[s2.k]} onChange={setFxK} />)}
            <div style={{ fontSize: 10, color: "#776a85", marginTop: 4, lineHeight: 1.6 }}>
              The pair that goes out is drawn from the GLOWING motes — they're
              the only ones bright enough to follow across a room, and an
              attack you can't see coming is just damage. The timer doesn't
              restart until both are home, so the count above never exceeds
              the number set here.
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>How many</h3>
            <Slider spec={{ k: "count", label: "motes", min: 40, max: 600, step: 20 }}
              value={count} onChange={(_k, v) => setCount(v)} />
            <button onClick={() => api.current.respawn(count)} style={btn(false)}>
              Rebuild
            </button>
            {stats && (
              <div style={{ fontSize: 11, lineHeight: 1.9, color: "#9a8aaa", marginTop: 10 }}>
                <div>motes <span style={{ color: "#ddd" }}>{stats.motes}</span></div>
                <div>draw calls <span style={{ color: "#44ff88" }}>{stats.draws}</span>
                  <span style={{ color: "#554a60" }}> · the old build was 82</span></div>
                <div>triangles <span style={{ color: "#ddd" }}>{stats.tris}</span></div>
              </div>
            )}
          </div>

          <div style={panel}>
            <h3 style={h3}>Values for swarm_ai.js</h3>
            <pre style={{ margin: 0, fontSize: 10, lineHeight: 1.7, color: "#8a7a9a",
                          fontFamily: "ui-monospace, Menlo, monospace",
                          whiteSpace: "pre-wrap" }}>
{`export const FX = {
${[...MASS_PARAMS, ...MOTE_PARAMS, ...ATTACK_PARAMS, ...HURT_PARAMS, ...DEATH_PARAMS].map((s) => `  ${s.k}: ${fx[s.k]},`).join("\n")}
};`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
