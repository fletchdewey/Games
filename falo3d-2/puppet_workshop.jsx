// falo3d-2/puppet_workshop.jsx
// The Puppet Master workshop — for working on how it gets hurt and how it dies.
//
// Unlike the alien and boss workshops, this one does NOT rebuild the model or
// the behaviour locally. It imports the real thing:
//
//   /src/bosses/puppet_master.js      the model
//   /src/bosses/puppet_master_ai.js   the brain, the hit flash, the deaths
//
// So what you see here is what happens in the game, and a number you settle on
// is a number to change in one place. The workshop server maps /src/ to the
// game source for exactly this.
//
// The fight has three chapters and you can drop into any of them:
//   CONTROLLED      the pilot drives the body. Charges and slams.
//   MALFUNCTIONING  the shell is failing, the pilot peeks out. Weak point open.
//   EJECTED         the body is dead, the pilot is loose and running.

import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { createPuppetMaster } from "/src/bosses/puppet_master.js";
import {
  initPuppetMaster, updatePuppetMaster, damagePuppetMaster,
  stepPuppetMasterFx, FX,
} from "/src/bosses/puppet_master_ai.js";

const ACCENT = "#44ff88";

// The FX object in puppet_master_ai.js, laid out for sliders. Everything is in
// frames or radians, the units the file itself uses — no conversion to hide a
// mismatch behind.
const FX_PARAMS = [
  { k: "flashBodyFrames", label: "body hit flash", min: 0, max: 20, step: 1, unit: "f" },
  { k: "flashPilotFrames", label: "pilot hit flash", min: 0, max: 20, step: 1, unit: "f" },
  { k: "collapseFrames", label: "collapse time", min: 10, max: 180, step: 1, unit: "f" },
  { k: "collapsePitch", label: "collapse pitch", min: 0, max: 2.2, step: 0.05, unit: "rad" },
  { k: "collapseSink", label: "collapse sink", min: 0, max: 1, step: 0.02, unit: "u" },
  { k: "collapseBuckle", label: "knees buckle", min: 0, max: 2, step: 0.05, unit: "rad" },
  { k: "ejectFrames", label: "eject time", min: 6, max: 90, step: 1, unit: "f" },
  { k: "ejectArc", label: "eject arc", min: 0, max: 2.5, step: 0.05, unit: "u" },
  { k: "ejectSpin", label: "eject tumble", min: 0, max: 8, step: 0.1, unit: "rad" },
  { k: "pilotDeathFrames", label: "pilot death", min: 10, max: 180, step: 1, unit: "f" },
  { k: "pilotLeash", label: "pilot leash", min: 2, max: 16, step: 0.5, unit: "u" },
  { k: "pilotGroundY", label: "pilot height", min: 0.2, max: 2, step: 0.05, unit: "u" },
  { k: "pilotBob", label: "run bounce", min: 0, max: 0.3, step: 0.01, unit: "u" },
  { k: "pilotBobRate", label: "run rate", min: 2, max: 20, step: 0.5 },
  { k: "pilotArmsUp", label: "arms up splay", min: 0, max: 1.4, step: 0.05, unit: "rad" },
  { k: "pilotArmSway", label: "arm sway", min: 0, max: 0.6, step: 0.02, unit: "rad" },
  { k: "bloodCount", label: "blood per hit", min: 0, max: 30, step: 1 },
  { k: "bloodSpeed", label: "blood spray", min: 0.01, max: 0.25, step: 0.005 },
  { k: "bloodGravity", label: "blood fall", min: 0.001, max: 0.03, step: 0.001 },
  { k: "bloodLife", label: "blood lasts", min: 5, max: 180, step: 1, unit: "f" },
  { k: "bloodSize", label: "blood size", min: 0.01, max: 0.2, step: 0.005, unit: "u" },
];

const FIGHT_PARAMS = [
  { k: "bodyHpMax", label: "body HP", min: 1, max: 100, step: 1 },
  { k: "pilotHpMax", label: "pilot HP", min: 1, max: 40, step: 1 },
  { k: "speed", label: "body speed", min: 0.005, max: 0.15, step: 0.005, unit: "u/f" },
  { k: "pilotSpeed", label: "pilot speed", min: 0.01, max: 0.3, step: 0.01, unit: "u/f" },
  { k: "attackRange", label: "attack range", min: 1, max: 8, step: 0.25, unit: "u" },
  { k: "attackDamage", label: "slam damage", min: 1, max: 25, step: 1 },
  { k: "attackCooldown", label: "slam cooldown", min: 10, max: 180, step: 5, unit: "f" },
];

const PHASES = {
  controlled: { label: "Controlled", note: "Pilot driving. Charges and slams. Shell takes the damage." },
  malfunctioning: { label: "Malfunctioning", note: "Shell failing. Pilot peeks out — the weak point is open." },
  ejected: { label: "Ejected", note: "Body down. Pilot loose and running for its life." },
};

export default function PuppetWorkshop() {
  const mountRef = useRef(null);
  const [fx, setFx] = useState({ ...FX });
  const [fight, setFight] = useState({
    bodyHpMax: 30, pilotHpMax: 8, speed: 0.04, pilotSpeed: 0.08,
    attackRange: 3, attackDamage: 3, attackCooldown: 60,
  });
  const [playing, setPlaying] = useState(true);
  const [chasing, setChasing] = useState(true);
  const [readout, setReadout] = useState(null);
  const [stats, setStats] = useState(null);

  // The live scene, kept out of React state — it changes every frame.
  const api = useRef({});
  const fxRef = useRef(fx);
  const fightRef = useRef(fight);
  const playRef = useRef(playing);
  const chaseRef = useRef(chasing);
  useEffect(() => { fxRef.current = fx; Object.assign(FX, fx); }, [fx]);
  useEffect(() => { fightRef.current = fight; }, [fight]);
  useEffect(() => { playRef.current = playing; }, [playing]);
  useEffect(() => { chaseRef.current = chasing; }, [chasing]);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0c14);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x66708a, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(5, 9, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x4488cc, 0.4);
    rim.position.set(-6, 3, -5);
    scene.add(rim);

    // The leash ring, so you can see what is holding the pilot in. Nothing
    // in the game draws this — it is only here to make the bound visible.
    const leashRing = new THREE.Mesh(
      new THREE.RingGeometry(0.97, 1, 64),
      new THREE.MeshBasicMaterial({ color: 0x44ff88, transparent: true,
                                    opacity: 0.3, side: THREE.DoubleSide }));
    leashRing.rotation.x = -Math.PI / 2;
    leashRing.position.y = 0.02;
    leashRing.visible = false;
    scene.add(leashRing);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 48),
      new THREE.MeshLambertMaterial({ color: 0x20242e }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    scene.add(new THREE.GridHelper(28, 28, 0x2c3340, 0x1a1e26));

    // Something for it to fight. The AI needs a position to chase and hit,
    // and watching it walk at a target is most of how the motion reads.
    // r128 has no CapsuleGeometry — that arrives several releases later, and
    // the game is pinned to r128. A cylinder and a sphere do the same job.
    const target = new THREE.Group();
    const dummyMat = new THREE.MeshLambertMaterial({ color: 0x44667f });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.1, 10), dummyMat);
    torso.position.y = 0.85;
    target.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), dummyMat);
    head.position.y = 1.55;
    target.add(head);
    target.position.set(0, 0, 6);
    scene.add(target);

    let boss = null;
    function spawn() {
      if (boss) {
        scene.remove(boss);
        if (boss.userData.pilotGroup && boss.userData.pilotGroup.parent === scene) {
          scene.remove(boss.userData.pilotGroup);
        }
        // The blood lives in the scene, not on the boss, so respawning
        // without this leaves a dead Points object behind every time.
        if (boss.userData.blood) {
          scene.remove(boss.userData.blood.points);
          boss.userData.blood.points.geometry.dispose();
          boss.userData.blood.points.material.dispose();
        }
      }
      boss = createPuppetMaster();
      initPuppetMaster(boss);
      const f = fightRef.current;
      Object.assign(boss.userData, {
        bodyHpMax: f.bodyHpMax, bodyHp: f.bodyHpMax,
        pilotHpMax: f.pilotHpMax, pilotHp: f.pilotHpMax,
        speed: f.speed, pilotSpeed: f.pilotSpeed,
        attackRange: f.attackRange, attackDamage: f.attackDamage,
        attackCooldown: f.attackCooldown,
      });
      boss.position.set(0, 0, -2);
      scene.add(boss);

      let meshes = 0, tris = 0;
      boss.traverse((o) => {
        if (!o.isMesh) return;
        meshes++;
        const pos = o.geometry.getAttribute("position");
        tris += (o.geometry.index ? o.geometry.index.count : pos.count) / 3;
      });
      const box = new THREE.Box3().setFromObject(boss);
      const size = box.getSize(new THREE.Vector3());
      setStats({ meshes, tris: Math.round(tris), w: size.x, h: size.y, d: size.z });
      return boss;
    }
    spawn();

    // Drive it straight into a phase, the way the fight would arrive there.
    function forcePhase(phase) {
      const d = boss.userData;
      if (phase === "controlled") { spawn(); return; }
      spawn();
      const b = boss.userData;
      if (phase === "malfunctioning") {
        b.bodyHp = Math.max(1, Math.floor(b.bodyHpMax * 0.4));
        b.phase = "malfunctioning";
        b.pilotExposed = true;
      } else if (phase === "ejected") {
        b.bodyHp = 0;
        b.phase = "ejected";
        b.pilotExposed = true;
        // The same two calls the brain makes when the shell gives out.
        b.bodyCollapsing = true;
        b.bodyCollapseFrame = 0;
        for (const strand of b.tendrils) for (const seg of strand) seg.mesh.visible = false;
        b.tendrilLight.intensity = 0;
      }
      void d;
    }

    // In the game the impact point comes from the raycast that found the hit.
    // Here there is no bullet, so pick a plausible point on the surface —
    // spawning every burst from the middle of the model would make the spray
    // look nothing like it does in play, which is the thing being tuned.
    const impact = (part) => {
      const p = new THREE.Vector3();
      if (part === "pilot") {
        boss.userData.pilotGroup.getWorldPosition(p);
        return p.add(new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.15,
                                       (Math.random() - 0.5) * 0.2));
      }
      const a = Math.random() * Math.PI * 2;
      return p.set(boss.position.x + Math.cos(a) * 0.75,
                   0.75 + Math.random() * 1.0,
                   boss.position.z + Math.sin(a) * 0.75);
    };

    api.current = {
      respawn: spawn,
      phase: forcePhase,
      hit: (part, amount) => damagePuppetMaster(boss, amount, part, impact(part)),
      killBody: () => {
        damagePuppetMaster(boss, boss.userData.bodyHp, "body", impact("body"));
      },
      killPilot: () => {
        const b = boss.userData;
        b.pilotExposed = true;
        damagePuppetMaster(boss, b.pilotHp, "pilot", impact("pilot"));
      },
      get boss() { return boss; },
    };

    // ── Orbit ──────────────────────────────────────────────
    let yaw = 0.6, pitch = 0.38, dist = 13;
    // The orbit centre follows the boss. It chases the target all over the
    // floor, and a camera pinned to the origin loses it within seconds.
    const focus = new THREE.Vector3(0, 1.2, 0);
    let dragging = false, lastX = 0, lastY = 0;
    const el = renderer.domElement;
    el.addEventListener("pointerdown", (e) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY; el.setPointerCapture(e.pointerId);
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
      dist = Math.max(4, Math.min(26, dist + e.deltaY * 0.01));
    }, { passive: false });

    function resize() {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      // Not setSize(w, h, false): skipping the style update leaves the canvas
      // sized in device pixels with no CSS size, so on a retina display it
      // renders at twice its box and you see the top-left quarter of the scene.
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // ── Loop ───────────────────────────────────────────────
    // The same flash step the game runs, so a hit looks the same here.
    function stepFlash(group, part) {
      const n = group.userData.flashFrames || 0;
      if (n > 0) {
        group.userData.flashFrames = n - 1;
        group.userData._flashing = true;
        group.traverse((o) => {
          if (o.isMesh && o.material.emissive && o.userData.hitPart === part) {
            o.material.emissive.setScalar(0.7);
          }
        });
      } else if (group.userData._flashing) {
        group.userData._flashing = false;
        group.traverse((o) => {
          if (o.isMesh && o.material.emissive && o.userData.hitPart === part) {
            o.material.emissive.setScalar(0);
          }
        });
      }
    }

    // The game reads boss.userData.currentAttack each frame and turns it into
    // damage or a flying object. Do the same here, or the pilot's throws are
    // queued and silently dropped and you never see one.
    const thrown = [];
    function takeAttack() {
      const note = boss.userData.currentAttack;
      if (!note) return;
      boss.userData.currentAttack = null;
      if (note.type === 'pilot_throw' && note.model) {
        note.model.position.copy(note.origin);
        scene.add(note.model);
        thrown.push({
          mesh: note.model,
          dir: new THREE.Vector3().subVectors(note.target, note.origin).normalize(),
          spin: note.spin, life: 4,
        });
      } else if (note.type === 'body_slam') {
        // A ring where the slam landed, so a hit is distinguishable from the
        // same animation pounding empty floor.
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 2.2, 28),
          new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true,
                                        opacity: 0.5, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(note.origin.x, 0.03, note.origin.z);
        scene.add(ring);
        thrown.push({ mesh: ring, dir: null, spin: null, life: 0.5 });
      }
    }
    function stepThrown(dt) {
      for (let i = thrown.length - 1; i >= 0; i--) {
        const t = thrown[i];
        t.life -= dt;
        if (t.dir) t.mesh.position.addScaledVector(t.dir, 6 * dt);
        if (t.spin) {
          t.mesh.rotation.x += t.spin.x * dt;
          t.mesh.rotation.y += t.spin.y * dt;
          t.mesh.rotation.z += t.spin.z * dt;
        }
        if (t.life <= 0) {
          scene.remove(t.mesh);
          t.mesh.traverse((o) => {
            if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
          });
          thrown.splice(i, 1);
        }
      }
    }

    let last = performance.now(), raf = 0, tick = 0;
    function frame() {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (playRef.current && boss) {
        const dtF = Math.min(dt * 60, 3);
        // A target that circles, so you see it turn and track rather than
        // walk one straight line and stand there.
        if (chaseRef.current) {
          const t = now / 1000;
          target.position.set(Math.cos(t * 0.35) * 5.5, 0, Math.sin(t * 0.35) * 5.5 + 1);
        }
        const aim = target.position.clone().setY(1.2);
        updatePuppetMaster(boss, aim, dtF);
        stepPuppetMasterFx(boss, dtF, scene);
        const arena = boss.userData.arena;
        leashRing.visible = !!arena;
        if (arena) {
          // The slider edits FX; push it onto the live arena too, or the
          // bound you see would lag the number you just set.
          arena.r = fxRef.current.pilotLeash;
          leashRing.position.set(arena.x, 0.02, arena.z);
          leashRing.scale.setScalar(arena.r);
        }
        stepFlash(boss, "body");
        if (boss.userData.pilotGroup) stepFlash(boss.userData.pilotGroup, "pilot");
        takeAttack();
        stepThrown(dt);
      }

      if (boss) {
        // Follow whatever is actually the boss right now. Once the pilot
        // bails out it IS the fight, and the wreck it left behind never
        // moves again — keep tracking that and the pilot runs off-screen.
        const subject = boss.userData.pilotDetached
          ? boss.userData.pilotGroup.position : boss.position;
        // Lerped, so the view drifts after it rather than snapping about.
        focus.x += (subject.x - focus.x) * Math.min(1, dt * 2.5);
        focus.z += (subject.z - focus.z) * Math.min(1, dt * 2.5);
      }
      camera.position.set(
        focus.x + Math.sin(yaw) * Math.cos(pitch) * dist,
        Math.sin(pitch) * dist + 1.2,
        focus.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      camera.lookAt(focus.x, 1.2, focus.z);
      renderer.render(scene, camera);

      // Readout at 10Hz — every frame would re-render React 60 times a second.
      if (boss && ++tick % 6 === 0) {
        const d = boss.userData;
        setReadout({
          phase: d.phase, bodyHp: Math.max(0, d.bodyHp), bodyHpMax: d.bodyHpMax,
          pilotHp: Math.max(0, d.pilotHp), pilotHpMax: d.pilotHpMax,
          exposed: !!d.pilotExposed, dead: !!d.isDead,
          collapsing: !!d.bodyCollapsing, ejecting: d.ejectFrame != null,
          pilotDying: d.pilotDeathFrame != null,
          // How far out the loose pilot is. Without this you have to find it
          // on screen to know whether the leash is holding it.
          leashAt: d.arena
            ? Math.hypot(d.pilotGroup.position.x - d.arena.x,
                         d.pilotGroup.position.z - d.arena.z)
            : null,
          leashMax: d.arena ? d.arena.r : null,
          pilotY: d.pilotDetached ? d.pilotGroup.position.y : null,
          // What the body is doing right now — the whole point of the charge
          // is that each stage is readable, so it's worth naming.
          bodyState: d.bodyAttack ? d.bodyAttack.state : null,
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
    background: "rgba(255,255,255,0.025)", border: "1px solid #20242e",
    borderRadius: 8, padding: "12px 14px", marginBottom: 10,
  };
  const h3 = {
    margin: "0 0 10px", fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
    color: "#7a8a9a", fontWeight: 600,
  };
  const btn = (on, span) => ({
    background: on ? ACCENT : "rgba(255,255,255,0.06)",
    color: on ? "#06160d" : "#aab", border: "1px solid #2a2a3a", borderRadius: 5,
    padding: "7px 0", fontSize: 11, cursor: "pointer", letterSpacing: 1,
    textTransform: "uppercase", fontWeight: on ? 700 : 400,
    gridColumn: span ? "span 2" : "auto",
  });

  const Slider = ({ spec, value, onChange }) => (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11,
                    color: "#8a8aa0", marginBottom: 3 }}>
        <span>{spec.label}</span>
        <span style={{ color: "#cdd" }}>
          {value}{spec.unit ? ` ${spec.unit}` : ""}
          {spec.unit === "f" && <span style={{ color: "#556" }}> · {(value / 60).toFixed(2)}s</span>}
        </span>
      </div>
      <input type="range" min={spec.min} max={spec.max} step={spec.step} value={value}
        onChange={(e) => onChange(spec.k, parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: ACCENT, height: 3 }} />
    </div>
  );

  const setFxK = (k, v) => setFx((p) => ({ ...p, [k]: v }));
  const setFightK = (k, v) => {
    setFight((p) => ({ ...p, [k]: v }));
    const b = api.current.boss;
    if (!b) return;
    b.userData[k] = v;
    if (k === "bodyHpMax") b.userData.bodyHp = Math.min(b.userData.bodyHp, v);
    if (k === "pilotHpMax") b.userData.pilotHp = Math.min(b.userData.pilotHp, v);
  };

  const bar = (v, max, col) => (
    <div style={{ height: 6, background: "#1a1e26", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, (v / max) * 100)}%`, height: "100%", background: col }} />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a12", color: "#e8e8f0",
                  padding: "22px 26px", boxSizing: "border-box" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 19, letterSpacing: 4, textTransform: "uppercase",
                     fontWeight: 700 }}>
          Falo 3D-2 — Puppet Master Workshop
        </h1>
        <div style={{ fontSize: 11, color: "#667", marginTop: 5, lineHeight: 1.6 }}>
          Running the real model and the real brain out of <code>/src/bosses/</code>.
          Hurt it, kill it, and drop into any chapter of the fight. Drag to orbit,
          scroll to zoom.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 330px", gap: 18,
                    alignItems: "start" }}>
        <div style={{ position: "relative", background: "#0c0c14",
                      border: "1px solid #20242e", borderRadius: 10, overflow: "hidden" }}>
          <div ref={mountRef} style={{ width: "100%", height: "72vh", minHeight: 420 }} />
          {readout && (
            <div style={{ position: "absolute", top: 12, left: 12, fontSize: 11,
                          background: "rgba(0,0,0,0.55)", padding: "9px 12px",
                          borderRadius: 6, minWidth: 180 }}>
              <div style={{ color: ACCENT, letterSpacing: 2, textTransform: "uppercase",
                            fontWeight: 700, marginBottom: 7 }}>
                {PHASES[readout.phase]?.label || readout.phase}
              </div>
              <div style={{ color: "#8a8aa0", marginBottom: 2 }}>
                body {Math.round(readout.bodyHp)}/{readout.bodyHpMax}
              </div>
              {bar(readout.bodyHp, readout.bodyHpMax, "#44ccff")}
              <div style={{ color: "#8a8aa0", margin: "7px 0 2px" }}>
                pilot {Math.round(readout.pilotHp)}/{readout.pilotHpMax}
                {!readout.exposed && <span style={{ color: "#556" }}> · covered</span>}
              </div>
              {bar(readout.pilotHp, readout.pilotHpMax, readout.exposed ? "#ff4466" : "#3a3a4a")}
              <div style={{ marginTop: 7, color: "#556", fontSize: 10, lineHeight: 1.6 }}>
                {readout.bodyState && readout.bodyState !== "idle" && (
                  <div style={{ color: "#ffb347", textTransform: "uppercase",
                                letterSpacing: 1 }}>{readout.bodyState}</div>
                )}
                {readout.collapsing && <div style={{ color: "#ffaa22" }}>body collapsing</div>}
                {readout.ejecting && <div style={{ color: "#ffaa22" }}>pilot ejecting</div>}
                {readout.pilotDying && <div style={{ color: "#ff4466" }}>pilot dying</div>}
                {readout.dead && !readout.pilotDying && <div style={{ color: "#ff4466" }}>dead</div>}
                {readout.leashAt != null && (
                  <div style={{ color: readout.leashAt >= readout.leashMax - 0.05
                                  ? "#44ff88" : "#556" }}>
                    pilot {readout.leashAt.toFixed(1)} / {readout.leashMax.toFixed(1)}u out
                    {readout.pilotY != null && ` · ${readout.pilotY.toFixed(2)}u up`}
                    {readout.leashAt >= readout.leashMax - 0.05 && " · on the leash"}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <div style={panel}>
            <h3 style={h3}>Chapter</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {Object.entries(PHASES).map(([k, p]) => (
                <button key={k} onClick={() => api.current.phase(k)}
                  style={btn(readout?.phase === k, k === "ejected")}>{p.label}</button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "#667", marginTop: 8, lineHeight: 1.6 }}>
              {PHASES[readout?.phase]?.note}
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>Hurt &amp; kill</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <button onClick={() => api.current.hit("body", 5)} style={btn(false)}>Hit body 5</button>
              <button onClick={() => api.current.hit("pilot", 2)} style={btn(false)}>Hit pilot 2</button>
              <button onClick={() => api.current.killBody()} style={btn(false)}>Kill body</button>
              <button onClick={() => api.current.killPilot()} style={btn(false)}>Kill pilot</button>
              <button onClick={() => api.current.respawn()} style={btn(false, true)}>Respawn</button>
            </div>
            <div style={{ fontSize: 10, color: "#667", marginTop: 8, lineHeight: 1.6 }}>
              The pilot only takes damage while it's exposed — that's the weak-point
              rule, so hitting it in Controlled does nothing. Kill pilot forces it
              open first so you can watch the end without playing the fight through.
            </div>
          </div>

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
            <h3 style={h3}>Hurt &amp; death timing</h3>
            {FX_PARAMS.map((s) => (
              <Slider key={s.k} spec={s} value={fx[s.k]} onChange={setFxK} />
            ))}
            <div style={{ fontSize: 10, color: "#667", marginTop: 4, lineHeight: 1.6 }}>
              These write straight into <code>FX</code> in puppet_master_ai.js, so a
              change here is live on the next death — no rebuild.
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>Fight numbers</h3>
            {FIGHT_PARAMS.map((s) => (
              <Slider key={s.k} spec={s} value={fight[s.k]} onChange={setFightK} />
            ))}
            <div style={{ fontSize: 10, color: "#667", marginTop: 4, lineHeight: 1.6 }}>
              HP changes apply on the next Respawn.
            </div>
          </div>

          {stats && (
            <div style={panel}>
              <h3 style={h3}>Cost</h3>
              <div style={{ fontSize: 11, lineHeight: 1.9, color: "#8a8aa0" }}>
                <div>meshes <span style={{ color: "#cdd" }}>{stats.meshes}</span>
                  <span style={{ color: "#445" }}> · brute 72</span></div>
                <div>triangles <span style={{ color: "#cdd" }}>{stats.tris}</span></div>
                <div>size <span style={{ color: "#cdd" }}>
                  {stats.w.toFixed(2)} × {stats.h.toFixed(2)} × {stats.d.toFixed(2)}</span></div>
              </div>
            </div>
          )}

          <div style={panel}>
            <h3 style={h3}>Values for puppet_master_ai.js</h3>
            <pre style={{ margin: 0, fontSize: 10, lineHeight: 1.7, color: "#7a8a9a",
                          fontFamily: "ui-monospace, Menlo, monospace", whiteSpace: "pre-wrap" }}>
{`export const FX = {
${FX_PARAMS.map((s) => `  ${s.k}: ${fx[s.k]},`).join("\n")}
};`}
            </pre>
            <div style={{ fontSize: 10, color: "#667", marginTop: 8, lineHeight: 1.6 }}>
              Tell me the numbers you land on and I'll bake them in.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
