import { useState, useEffect, useRef, useCallback } from "react";

// MAP EDITOR
//
// Paint the floor of the map on a grid whose cells are sized in the game's own
// world units, so what you draw is literally what gets built.
//
// PERSISTENCE: every change is written to falo3d-2/map_data.json through the
// workshop server, NOT to browser storage. That is deliberate — this file gets
// edited and the page auto-reloads on every save, so in-memory state would be
// destroyed constantly. The map lives in a real file in the repo: it survives
// reloads, a different browser, a cleared cache, and it diffs in git.

// Scale, measured from the game rather than guessed:
//   PLAYER_RADIUS 0.35 (game.js)  → the player is 0.7 units across
//   narrowest corridor is 3 units → 3 cells at 1 unit/cell
//   biggest alien (Brute) is 2.93 across
const PLAYER_D = 0.7;
const SPRITE_D = { Player: 0.7, Floater: 1.89, Crawler: 2.22, Watcher: 2.37, Brute: 2.93 };

// Grid covers the existing map (x -45..26, z -80..7) with room to grow.
const GRID = { x0: -48, x1: 48, z0: -96, z1: 16 };

const key = (x, z) => `${x},${z}`;

// 4-connected components of the painted floor. Each is a sealed box until
// something links it — walls get generated at every floor/empty boundary.
function findRegions(cells) {
  const seen = new Set(), regions = [];
  for (const k of cells) {
    if (seen.has(k)) continue;
    const stack = [k], comp = [];
    seen.add(k);
    while (stack.length) {
      const cur = stack.pop();
      comp.push(cur);
      const [x, z] = cur.split(",").map(Number);
      for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const n = key(x + dx, z + dz);
        if (cells.has(n) && !seen.has(n)) { seen.add(n); stack.push(n); }
      }
    }
    regions.push(comp);
  }
  regions.sort((a, b) => b.length - a.length);
  return regions;
}

// Propose corridors between regions whose nearest cells are within `gap`.
// Routed as an L (x first, then z) through the closest pair, and widened so
// the widest alien can actually fit down it.
function proposeCorridors(cells, gap, width) {
  const regions = findRegions(cells).map((r) => r.map((k) => k.split(",").map(Number)));
  const links = [];
  for (let i = 0; i < regions.length; i++) {
    for (let j = i + 1; j < regions.length; j++) {
      let best = { d: Infinity };
      for (const a of regions[i]) for (const b of regions[j]) {
        const d = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
        if (d < best.d) best = { d, a, b };
      }
      // d counts both endpoints, so the empty gap between them is d-1.
      if (best.d - 1 <= gap) links.push(best);
    }
  }
  const out = new Set();
  const off = -(width >> 1);
  const stamp = (x, z) => {
    for (let i = 0; i < width; i++)
      for (let j = 0; j < width; j++) {
        const cx = x + off + i, cz = z + off + j;
        if (cx >= 0 && cz >= 0 && !cells.has(key(cx, cz))) out.add(key(cx, cz));
      }
  };
  for (const { a, b } of links) {
    const sx = Math.sign(b[0] - a[0]), sz = Math.sign(b[1] - a[1]);
    let x = a[0], z = a[1];
    while (x !== b[0]) { x += sx; stamp(x, z); }
    while (z !== b[1]) { z += sz; stamp(x, z); }
  }
  const after = findRegions(new Set([...cells, ...out])).length;
  return { proposed: out, links: links.length, after };
}

// Pull every region toward the map's centre by (1 - k) of its distance, so
// the LAYOUT is preserved and only the empty space between rooms closes up.
// Rooms step one cell at a time and stop early if they'd come within MIN_SEP
// of a neighbour — that guard is what stops the whole map collapsing into one
// blob, which is what a plain gravity-to-centroid does.
const MIN_SEP = 3;

function tightenRegions(cells, k) {
  let groups = findRegions(cells).map((r) => new Set(r));
  if (groups.length < 2) return { cells: new Set(cells), moved: 0 };
  const all = [...cells].map((s2) => s2.split(",").map(Number));
  const cx = all.reduce((a, c) => a + c[0], 0) / all.length;
  const cz = all.reduce((a, c) => a + c[1], 0) / all.length;

  const centre = (g) => {
    let x = 0, z = 0;
    for (const s2 of g) { const [a, b] = s2.split(",").map(Number); x += a; z += b; }
    return [x / g.size, z / g.size];
  };
  const targets = groups.map((g) => {
    const [gx, gz] = centre(g);
    return [cx + (gx - cx) * k, cz + (gz - cz) * k];
  });

  let moved = 0;
  for (let pass = 0; pass < 300; pass++) {
    let any = false;
    for (let i = 0; i < groups.length; i++) {
      const [gx, gz] = centre(groups[i]);
      const dx = targets[i][0] - gx, dz = targets[i][1] - gz;
      if (Math.abs(dx) < 0.5 && Math.abs(dz) < 0.5) continue;
      const step = Math.abs(dx) >= Math.abs(dz)
        ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
      const cand = new Set();
      let ok = true;
      for (const s2 of groups[i]) {
        const [x, z] = s2.split(",").map(Number);
        const nx = x + step[0], nz = z + step[1];
        if (nx < 0 || nz < 0) { ok = false; break; }
        cand.add(key(nx, nz));
      }
      if (!ok) continue;
      // Keep clear of every other region by MIN_SEP.
      for (let j = 0; j < groups.length && ok; j++) {
        if (j === i) continue;
        for (const s2 of cand) {
          const [x, z] = s2.split(",").map(Number);
          for (let a = -(MIN_SEP - 1); a <= MIN_SEP - 1 && ok; a++)
            for (let b = -(MIN_SEP - 1); b <= MIN_SEP - 1; b++)
              if (groups[j].has(key(x + a, z + b))) { ok = false; break; }
          if (!ok) break;
        }
      }
      if (!ok) continue;
      groups[i] = cand; moved++; any = true;
    }
    if (!any) break;
  }
  const out = new Set();
  for (const g of groups) for (const s2 of g) out.add(s2);
  return { cells: out, moved };
}

export default function MapEditor() {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);

  const [cellSize, setCellSize] = useState(1);
  const [cells, setCells] = useState(() => new Set());
  const [refRooms, setRefRooms] = useState([]);
  const [showRooms, setShowRooms] = useState(true);
  const [mode, setMode] = useState("paint");
  const [status, setStatus] = useState("loading…");
  const [hover, setHover] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [gap, setGap] = useState(4);
  const [corrW, setCorrW] = useState(2);
  const [proposal, setProposal] = useState(null);
  const [tighten, setTighten] = useState(1);
  const [undo, setUndo] = useState(null);   // one level, for bulk operations
  const [rooms, setRooms] = useState([]);   // [{id, name, cells:[[x,z]...]}]
  const rev = useRef(null);                 // file revision we last read/wrote

  // View transform: world units → screen pixels.
  const view = useRef({ scale: 8, ox: 0, oz: 0 });
  const drag = useRef(null);
  const pan = useRef(null);
  const [, forceDraw] = useState(0);
  const redraw = useCallback(() => forceDraw((n) => n + 1), []);

  // ── Load once on boot. This is what makes edits to this file survivable.
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const [m, r] = await Promise.all([
          fetch("/api/map", { cache: "no-store" }).then((x) => x.json()),
          fetch("/api/rooms", { cache: "no-store" }).then((x) => x.json()).catch(() => []),
        ]);
        if (dead) return;
        const painted = new Set((m.cells || []).map(([x, z]) => key(x, z)));
        setCells(painted);
        // Drop any tagged cell that's since been erased, and any room left
        // empty, so stale tags can't accumulate behind the scenes.
        setRooms((m.rooms || [])
          .map((r) => ({ ...r, cells: (r.cells || []).filter(([x, z]) => painted.has(key(x, z))) }))
          .filter((r) => r.cells.length));
        if (m.cellSize) setCellSize(m.cellSize);
        rev.current = m.rev ?? null;
        setRefRooms(Array.isArray(r) ? r : []);
        setStatus((m.cells || []).length ? `loaded ${m.cells.length} cells` : "empty map");
      } catch (err) {
        setStatus(`load failed: ${err.message}`);
      } finally {
        if (!dead) setLoaded(true);
      }
    })();
    return () => { dead = true; };
  }, []);

  // ── Save on every change, debounced. Also flushed on unload, because the
  // workshop reloads this page the instant the .jsx changes on disk.
  const pending = useRef(null);
  useEffect(() => {
    if (!loaded) return;                       // don't save the empty pre-load state over a real map
    const payload = {
      cellSize,
      cells: [...cells].map((k) => k.split(",").map(Number)),
      rooms,
      rev: rev.current,
    };
    pending.current = payload;
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/map", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const j = await res.json();
        if (res.status === 409 && j.current) {
          // Someone else wrote the map — another editor tab, or a script.
          // Take their version rather than stamping ours over the top.
          const fresh = new Set((j.current.cells || []).map(([x, z]) => key(x, z)));
          setCells(fresh);
          setRooms((j.current.rooms || [])
            .map((r) => ({ ...r, cells: (r.cells || []).filter(([x, z]) => fresh.has(key(x, z))) }))
            .filter((r) => r.cells.length));
          if (j.current.cellSize) setCellSize(j.current.cellSize);
          rev.current = j.current.rev ?? null;
          pending.current = null;
          setStatus(`reloaded — the map changed elsewhere`);
          return;
        }
        setStatus(j.error ? `SAVE FAILED: ${j.error}`
                          : `saved ${j.cells} cells · ${new Date().toLocaleTimeString()}`);
        if (!j.error) { pending.current = null; rev.current = j.rev ?? rev.current; }
      } catch (err) {
        setStatus(`SAVE FAILED: ${err.message}`);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [cells, cellSize, rooms, loaded]);

  useEffect(() => {
    const flush = () => {
      if (!pending.current) return;
      // sendBeacon survives the page going away; a normal fetch would be cancelled.
      navigator.sendBeacon?.("/api/map",
        new Blob([JSON.stringify(pending.current)], { type: "application/json" }));
    };
    window.addEventListener("beforeunload", flush);
    return () => { flush(); window.removeEventListener("beforeunload", flush); };
  }, []);

  // ── Changing the cell size must preserve WORLD positions, not cell indices.
  // Reinterpreting the same indices at a new size silently rescales the whole
  // map (and throws half of it outside the grid), which is exactly what
  // happened the first time. Going coarser merges, going finer splits.
  const prevCell = useRef(null);
  useEffect(() => {
    if (!loaded) return;
    const a = prevCell.current;
    prevCell.current = cellSize;
    if (a === null || a === cellSize) return;
    const b = cellSize;
    setCells((prev) => {
      const next = new Set();
      for (const k of prev) {
        const [ix, iz] = k.split(",").map(Number);
        for (let X = Math.floor(ix * a / b); X < Math.ceil((ix + 1) * a / b); X++)
          for (let Z = Math.floor(iz * a / b); Z < Math.ceil((iz + 1) * a / b); Z++)
            next.add(key(X, Z));
      }
      return next;
    });
  }, [cellSize, loaded]);

  // ── Coordinate helpers. The grid grows to contain whatever is painted, so
  // no cell can ever end up stranded outside the editable area.
  let cols = Math.round((GRID.x1 - GRID.x0) / cellSize);
  let rows = Math.round((GRID.z1 - GRID.z0) / cellSize);
  for (const k of cells) {
    const [x, z] = k.split(",").map(Number);
    if (x + 1 > cols) cols = x + 1;
    if (z + 1 > rows) rows = z + 1;
  }

  const screenToCell = (sx, sy) => {
    const v = view.current;
    const wx = (sx - v.ox) / v.scale;
    const wz = (sy - v.oz) / v.scale;
    return { cx: Math.floor((wx - GRID.x0) / cellSize), cz: Math.floor((wz - GRID.z0) / cellSize) };
  };
  const cellToWorld = (cx, cz) => ({ x: GRID.x0 + cx * cellSize, z: GRID.z0 + cz * cellSize });

  // Which region each cell belongs to — drives the per-region tint, so ten
  // sealed boxes look like ten sealed boxes instead of one blue mass.
  const regionOf = (() => {
    const m = new Map();
    findRegions(cells).forEach((r, i) => r.forEach((k) => m.set(k, i)));
    return m;
  })();
  const regionCount = new Set(regionOf.values()).size;

  // Tag lookup. Anything painted but untagged is hallway — which is exactly
  // what the corridor generator leaves behind.
  const roomOf = (() => {
    const m = new Map();
    rooms.forEach((r, i) => r.cells.forEach(([x, z]) => m.set(key(x, z), i)));
    return m;
  })();
  const roomHue = (i) => `hsl(${(i * 37 + 200) % 360} 58% 46%)`;

  // ── Draw
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const v = view.current;
    const w2s = (wx, wz) => [wx * v.scale + v.ox, wz * v.scale + v.oz];
    const px = cellSize * v.scale;

    g.fillStyle = "#07070e";
    g.fillRect(0, 0, W, H);

    // Existing rooms, as a reference to trace over.
    if (showRooms) {
      g.lineWidth = 1;
      for (const r of refRooms) {
        const [sx, sy] = w2s(r.x - r.w / 2, r.z - r.d / 2);
        g.fillStyle = "rgba(68,255,136,0.045)";
        g.fillRect(sx, sy, r.w * v.scale, r.d * v.scale);
        g.strokeStyle = "rgba(68,255,136,0.30)";
        g.strokeRect(sx, sy, r.w * v.scale, r.d * v.scale);
        if (px > 6 && r.w * v.scale > 46) {
          g.fillStyle = "rgba(68,255,136,0.5)";
          g.font = "10px ui-monospace, Menlo, monospace";
          g.fillText(r.id, sx + 4, sy + 12);
        }
      }
    }

    // Painted floor, tinted per region.
    const [gx0, gy0] = w2s(GRID.x0, GRID.z0);
    for (const k of cells) {
      const [cx, cz] = k.split(",").map(Number);
      const ri = roomOf.get(k);
      g.fillStyle = ri === undefined
        ? (rooms.length ? "#5d6675" : "#3b6ea5")      // hallway
        : roomHue(ri);
      g.fillRect(gx0 + cx * px, gy0 + cz * px, px + 0.5, px + 0.5);
    }

    // Room names, centred on each room.
    if (rooms.length && px >= 3) {
      g.textAlign = "center";
      g.textBaseline = "middle";
      rooms.forEach((r, i) => {
        let ax = 0, az = 0;
        for (const [x, z] of r.cells) { ax += x; az += z; }
        ax = ax / r.cells.length + 0.5; az = az / r.cells.length + 0.5;
        const sx = gx0 + ax * px, sy = gy0 + az * px;
        const label = r.name || `Room ${i + 1}`;
        g.font = `700 ${Math.max(10, Math.min(16, px * 1.1))}px ui-sans-serif, system-ui`;
        g.lineWidth = 3;
        g.strokeStyle = "rgba(0,0,0,0.65)";
        g.strokeText(label, sx, sy);
        g.fillStyle = "#ffffff";
        g.fillText(label, sx, sy);
      });
      g.textAlign = "start";
      g.textBaseline = "alphabetic";
    }

    // Proposed corridors, drawn on top so you can judge them before applying.
    if (proposal) {
      g.fillStyle = "rgba(255,170,34,0.85)";
      for (const k of proposal.proposed) {
        const [cx, cz] = k.split(",").map(Number);
        g.fillRect(gx0 + cx * px, gy0 + cz * px, px + 0.5, px + 0.5);
      }
    }

    // Grid lines, but only when they'd be legible — at low zoom they turn the
    // whole canvas into a grey wash.
    if (px >= 4) {
      g.strokeStyle = px >= 10 ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)";
      g.lineWidth = 1;
      g.beginPath();
      for (let c = 0; c <= cols; c++) {
        const x = gx0 + c * px;
        if (x < -2 || x > W + 2) continue;
        g.moveTo(x, Math.max(gy0, 0)); g.lineTo(x, Math.min(gy0 + rows * px, H));
      }
      for (let r = 0; r <= rows; r++) {
        const y = gy0 + r * px;
        if (y < -2 || y > H + 2) continue;
        g.moveTo(Math.max(gx0, 0), y); g.lineTo(Math.min(gx0 + cols * px, W), y);
      }
      g.stroke();
    }

    // World origin + grid border
    g.strokeStyle = "rgba(255,255,255,0.28)";
    g.lineWidth = 1.5;
    g.strokeRect(gx0, gy0, cols * px, rows * px);
    const [ox, oy] = w2s(0, 0);
    g.strokeStyle = "rgba(255,170,34,0.55)";
    g.beginPath();
    g.moveTo(ox - 10, oy); g.lineTo(ox + 10, oy);
    g.moveTo(ox, oy - 10); g.lineTo(ox, oy + 10);
    g.stroke();

    // Rubber band
    if (drag.current && drag.current.moved) {
      const d = drag.current;
      const x0 = Math.min(d.a.cx, d.b.cx), x1 = Math.max(d.a.cx, d.b.cx);
      const z0 = Math.min(d.a.cz, d.b.cz), z1 = Math.max(d.a.cz, d.b.cz);
      g.fillStyle = d.erase ? "rgba(255,68,102,0.28)" : "rgba(68,204,255,0.28)";
      g.strokeStyle = d.erase ? "#ff4466" : "#44ccff";
      g.lineWidth = 1.5;
      g.fillRect(gx0 + x0 * px, gy0 + z0 * px, (x1 - x0 + 1) * px, (z1 - z0 + 1) * px);
      g.strokeRect(gx0 + x0 * px, gy0 + z0 * px, (x1 - x0 + 1) * px, (z1 - z0 + 1) * px);
    } else if (hover && px >= 3) {
      g.strokeStyle = mode === "erase" ? "#ff4466" : "#44ccff";
      g.lineWidth = 1.5;
      g.strokeRect(gx0 + hover.cx * px, gy0 + hover.cz * px, px, px);
    }

    // Scale reference: real sprite footprints at the current zoom, so you can
    // see what actually fits in a cell.
    const legendX = 14, legendY = H - 16;
    g.font = "10px ui-monospace, Menlo, monospace";
    let lx = legendX;
    for (const [name, d] of Object.entries(SPRITE_D)) {
      const r = (d / 2) * v.scale;
      g.beginPath();
      g.arc(lx + r, legendY - r, r, 0, Math.PI * 2);
      g.fillStyle = name === "Player" ? "rgba(255,170,34,0.35)" : "rgba(255,255,255,0.12)";
      g.fill();
      g.strokeStyle = name === "Player" ? "#ffaa22" : "rgba(255,255,255,0.4)";
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = "#8a8aa0";
      g.fillText(name, lx, legendY + 10);
      lx += Math.max(r * 2, g.measureText(name).width) + 14;
    }
  });

  // ── Input
  const onDown = (e) => {
    const cv = canvasRef.current;
    const r = cv.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    if (e.button === 1 || e.button === 2 || e.shiftKey) {
      pan.current = { sx, sy, ox: view.current.ox, oz: view.current.oz };
      return;
    }
    const c = screenToCell(sx, sy);
    drag.current = { a: c, b: c, moved: false, erase: mode === "erase" || e.altKey };
    cv.setPointerCapture(e.pointerId);
    redraw();
  };

  const onMove = (e) => {
    const cv = canvasRef.current;
    const r = cv.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    if (pan.current) {
      view.current.ox = pan.current.ox + (sx - pan.current.sx);
      view.current.oz = pan.current.oz + (sy - pan.current.sy);
      redraw();
      return;
    }
    const c = screenToCell(sx, sy);
    setHover(c);
    if (drag.current) {
      if (c.cx !== drag.current.a.cx || c.cz !== drag.current.a.cz) drag.current.moved = true;
      drag.current.b = c;
    }
    redraw();
  };

  const onUp = () => {
    pan.current = null;
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const x0 = Math.max(0, Math.min(d.a.cx, d.b.cx)), x1 = Math.min(cols - 1, Math.max(d.a.cx, d.b.cx));
    const z0 = Math.max(0, Math.min(d.a.cz, d.b.cz)), z1 = Math.min(rows - 1, Math.max(d.a.cz, d.b.cz));
    if (x1 < x0 || z1 < z0) { redraw(); return; }

    setCells((prev) => {
      const next = new Set(prev);
      // A plain click toggles that one cell; a drag fills the whole window.
      if (!d.moved) {
        const k = key(x0, z0);
        if (d.erase || next.has(k)) next.delete(k); else next.add(k);
        return next;
      }
      for (let x = x0; x <= x1; x++)
        for (let z = z0; z <= z1; z++)
          if (d.erase) next.delete(key(x, z)); else next.add(key(x, z));
      return next;
    });
  };

  const onWheel = (e) => {
    e.preventDefault();
    const cv = canvasRef.current;
    const r = cv.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const v = view.current;
    const k = Math.exp(-e.deltaY * 0.0015);
    const ns = Math.max(1.5, Math.min(40, v.scale * k));
    // Zoom about the cursor rather than the corner.
    v.ox = sx - (sx - v.ox) * (ns / v.scale);
    v.oz = sy - (sy - v.oz) * (ns / v.scale);
    v.scale = ns;
    redraw();
  };

  // Frame the whole painted map. This used to centre on a hardcoded point,
  // which stopped matching the moment Tighten moved anything.
  const fitView = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const v = view.current;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const k of cells) {
      const [ix, iz] = k.split(",").map(Number);
      x0 = Math.min(x0, ix); x1 = Math.max(x1, ix + 1);
      z0 = Math.min(z0, iz); z1 = Math.max(z1, iz + 1);
    }
    if (!Number.isFinite(x0)) {                 // nothing painted — show the grid
      x0 = 0; z0 = 0;
      x1 = (GRID.x1 - GRID.x0) / cellSize; z1 = (GRID.z1 - GRID.z0) / cellSize;
    }
    const wx0 = GRID.x0 + x0 * cellSize, wx1 = GRID.x0 + x1 * cellSize;
    const wz0 = GRID.z0 + z0 * cellSize, wz1 = GRID.z0 + z1 * cellSize;
    const pad = 28;
    v.scale = Math.max(0.5, Math.min(
      (cv.clientWidth - pad * 2) / Math.max(1, wx1 - wx0),
      (cv.clientHeight - pad * 2) / Math.max(1, wz1 - wz0)));
    v.ox = cv.clientWidth / 2 - ((wx0 + wx1) / 2) * v.scale;
    v.oz = cv.clientHeight / 2 - ((wz0 + wz1) / 2) * v.scale;
    redraw();
  }, [cells, cellSize, redraw]);

  // Fit once the map has loaded, and whenever F is pressed.
  const didFit = useRef(false);
  useEffect(() => {
    if (!loaded || didFit.current) return;
    didFit.current = true;
    fitView();
  }, [loaded, fitView]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "f" || e.key === "F") {
        if (document.activeElement?.tagName === "INPUT") return;   // not while naming
        fitView();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fitView]);

  // ── Stats
  const area = cells.size * cellSize * cellSize;
  let bounds = null;
  if (cells.size) {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const k of cells) {
      const [cx, cz] = k.split(",").map(Number);
      x0 = Math.min(x0, cx); x1 = Math.max(x1, cx);
      z0 = Math.min(z0, cz); z1 = Math.max(z1, cz);
    }
    const a = cellToWorld(x0, z0), b = cellToWorld(x1 + 1, z1 + 1);
    bounds = `x ${a.x} … ${b.x}   z ${a.z} … ${b.z}`;
  }

  const btn = (on) => ({
    flex: 1, background: on ? "#44ccff" : "rgba(255,255,255,0.06)",
    color: on ? "#04131a" : "#aab", border: "1px solid #2a2a3a", borderRadius: 5,
    padding: "7px 0", fontSize: 11, cursor: "pointer", letterSpacing: 1,
    textTransform: "uppercase", fontWeight: on ? 700 : 400,
  });
  const panel = { background: "rgba(255,255,255,0.025)", border: "1px solid #1e1e2c",
                  borderRadius: 8, padding: "12px 14px", marginBottom: 12 };
  const h3 = { fontSize: 10, letterSpacing: 2, textTransform: "uppercase",
               color: "#667", margin: "0 0 10px" };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a12", color: "#e8e8f0",
                  fontFamily: "ui-sans-serif, system-ui, sans-serif", padding: "18px 20px 30px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: 4,
                     textTransform: "uppercase" }}>Map Editor</h1>
        <span style={{ fontSize: 12, color: "#667" }}>
          click a cell · drag a window · shift-drag or middle-drag to pan · scroll to zoom
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11,
                       color: status.startsWith("SAVE FAILED") ? "#ff4466" : "#44ff88" }}>
          {status}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 270px", gap: 14 }}>
        <div ref={wrapRef} style={{ background: "#07070e", border: "1px solid #1e1e2c",
                                    borderRadius: 10, height: "82vh", overflow: "hidden" }}>
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "100%", display: "block",
                     cursor: mode === "erase" ? "crosshair" : "cell", touchAction: "none" }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={() => { setHover(null); redraw(); }}
            onWheel={onWheel}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>

        <div>
          <div style={panel}>
            <h3 style={h3}>View</h3>
            <button style={{ ...btn(false), width: "100%", color: "#44ccff" }}
              onClick={fitView}>Fit whole map</button>
            <div style={{ fontSize: 10, color: "#556", marginTop: 6, lineHeight: 1.5 }}>
              Or press <b>F</b>. Scroll zooms about the cursor, shift-drag pans.
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>Tool</h3>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <button style={btn(mode === "paint")} onClick={() => setMode("paint")}>Paint</button>
              <button style={btn(mode === "erase")} onClick={() => setMode("erase")}>Erase</button>
            </div>
            <div style={{ fontSize: 10, color: "#556", lineHeight: 1.55 }}>
              Hold <b>alt</b> to erase without switching mode. A single click toggles
              one cell; dragging fills the whole window you draw.
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>Scale</h3>
            <div style={{ display: "flex", justifyContent: "space-between",
                          fontSize: 11, color: "#8a8aa0", marginBottom: 3 }}>
              <span>Cell size</span>
              <span style={{ color: "#44ccff" }}>{cellSize} u</span>
            </div>
            <input type="range" min={0.5} max={4} step={0.5} value={cellSize}
              onChange={(e) => setCellSize(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "#44ccff", height: 3 }} />
            <div style={{ fontSize: 10, color: "#556", marginTop: 7, lineHeight: 1.6 }}>
              Player is <b>{PLAYER_D}u</b> across, the Brute <b>{SPRITE_D.Brute}u</b>,
              and the tightest corridor in the current map is <b>3u</b>.
              At {cellSize}u a corridor is {(3 / cellSize).toFixed(cellSize === 1 ? 0 : 1)} cells
              wide and a Brute spans {(SPRITE_D.Brute / cellSize).toFixed(1)}.
              Footprints are drawn to scale at the bottom of the canvas.
            </div>
          </div>

          <div style={panel}>
            <h3 style={h3}>Reference</h3>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11,
                            color: "#8a8aa0", cursor: "pointer" }}>
              <input type="checkbox" checked={showRooms}
                onChange={(e) => setShowRooms(e.target.checked)}
                style={{ accentColor: "#44ff88" }} />
              Show the {refRooms.length} existing rooms
            </label>
            <div style={{ fontSize: 10, color: "#556", marginTop: 7, lineHeight: 1.55 }}>
              Read live from <code>src/map/layout.js</code> — trace over them or
              ignore them entirely.
            </div>
          </div>

          {rooms.length > 0 && (
            <div style={panel}>
              <h3 style={h3}>Rooms — type a name</h3>
              <div style={{ maxHeight: 260, overflowY: "auto", marginRight: -4, paddingRight: 4 }}>
                {rooms.map((r, i) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center",
                                           gap: 7, marginBottom: 6 }}>
                    <div style={{ width: 11, height: 11, borderRadius: 3, flexShrink: 0,
                                  background: roomHue(i) }} />
                    <input
                      value={r.name}
                      placeholder={`Room ${i + 1}`}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRooms((prev) => prev.map((q, j) =>
                          j === i ? { ...q, name: v } : q));
                      }}
                      style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.05)",
                               border: "1px solid #2a2a3a", borderRadius: 4, color: "#e8e8f0",
                               padding: "5px 7px", fontSize: 12,
                               fontFamily: "inherit" }} />
                    <span style={{ fontSize: 10, color: "#556", width: 46, textAlign: "right",
                                   flexShrink: 0 }}>
                      {(r.cells.length * cellSize * cellSize).toFixed(0)}u²
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: "#556", marginTop: 8, lineHeight: 1.55 }}>
                Names show on the map and on the walkthrough HUD at{" "}
                <code>localhost:8006</code>. Saved with the map. Grey cells are
                hallway — anything painted that isn't part of a room.
              </div>
            </div>
          )}

          <div style={panel}>
            <h3 style={h3}>Tighten</h3>
            <div style={{ display: "flex", justifyContent: "space-between",
                          fontSize: 11, color: "#8a8aa0", marginBottom: 3 }}>
              <span>Spacing</span>
              <span style={{ color: "#44ccff" }}>
                {tighten === 1 ? "unchanged" : `${Math.round(tighten * 100)}%`}
              </span>
            </div>
            <input type="range" min={0.2} max={1} step={0.05} value={tighten}
              onChange={(e) => setTighten(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "#44ccff", height: 3 }} />
            <div style={{ fontSize: 10, color: "#556", marginTop: 5, lineHeight: 1.55 }}>
              Pulls each room toward the centre along its own bearing, so the
              layout holds and only the dead space closes. Rooms stop {MIN_SEP} cells
              ({MIN_SEP * cellSize}u) apart — far enough to still read as rooms
              joined by halls rather than one blob.
            </div>
            <button
              disabled={tighten === 1 || regionCount < 2}
              style={{ ...btn(false), width: "100%", marginTop: 9,
                       color: tighten === 1 || regionCount < 2 ? "#445" : "#44ccff" }}
              onClick={() => {
                setUndo(new Set(cells));
                const r = tightenRegions(cells, tighten);
                setCells(r.cells);
                setProposal(null);
                setTighten(1);
              }}>
              {regionCount < 2 ? "connect last — tighten needs separate rooms"
                               : "Tighten rooms"}
            </button>
            {undo && (
              <button style={{ ...btn(false), width: "100%", marginTop: 6, color: "#ffaa22" }}
                onClick={() => { setCells(new Set(undo)); setUndo(null); setProposal(null); }}>
                Undo last change
              </button>
            )}
          </div>

          <div style={panel}>
            <h3 style={h3}>Connect</h3>
            <div style={{ display: "flex", justifyContent: "space-between",
                          fontSize: 11, color: "#8a8aa0", marginBottom: 3 }}>
              <span>Max gap to bridge</span>
              <span style={{ color: "#44ccff" }}>{gap} cells · {(gap * cellSize).toFixed(0)}u</span>
            </div>
            <input type="range" min={1} max={60} step={1} value={gap}
              onChange={(e) => { setGap(+e.target.value); setProposal(null); }}
              style={{ width: "100%", accentColor: "#44ccff", height: 3 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11,
                          color: "#8a8aa0", margin: "8px 0 3px" }}>
              <span>Corridor width</span>
              <span style={{ color: corrW * cellSize >= 2.93 ? "#44ff88" : "#ffaa22" }}>
                {corrW} cells · {(corrW * cellSize).toFixed(0)}u
              </span>
            </div>
            <input type="range" min={1} max={4} step={1} value={corrW}
              onChange={(e) => { setCorrW(+e.target.value); setProposal(null); }}
              style={{ width: "100%", accentColor: "#44ccff", height: 3 }} />
            <div style={{ fontSize: 10, color: corrW * cellSize >= 2.93 ? "#556" : "#ffaa22",
                          marginTop: 5, lineHeight: 1.5 }}>
              {corrW * cellSize >= 2.93
                ? `${(corrW * cellSize).toFixed(0)}u wide — the Brute (2.93u) fits.`
                : `${(corrW * cellSize).toFixed(0)}u is narrower than the Brute (2.93u); it would not fit through.`}
            </div>

            {!proposal ? (
              <button style={{ ...btn(false), width: "100%", marginTop: 10, color: "#44ccff" }}
                onClick={() => setProposal(proposeCorridors(cells, gap, corrW))}>
                Propose corridors
              </button>
            ) : (
              <>
                <div style={{ fontSize: 11, lineHeight: 1.8, color: "#8a8aa0", marginTop: 10 }}>
                  <div><span style={{ color: "#ffaa22" }}>{proposal.links} corridors</span>
                    {" "}· {proposal.proposed.size} cells</div>
                  <div>regions <span style={{ color: "#aab" }}>{regionCount}</span> →{" "}
                    <span style={{ color: proposal.after === 1 ? "#44ff88" : "#ffaa22" }}>
                      {proposal.after}</span></div>
                  {proposal.after > 1 && (
                    <div style={{ color: "#ffaa22", fontSize: 10, lineHeight: 1.5 }}>
                      Still split — raise the gap, or link the rest by hand.
                    </div>)}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button style={{ ...btn(true) }}
                    onClick={() => {
                      setUndo(new Set(cells));
                      setCells((prev) => new Set([...prev, ...proposal.proposed]));
                      setProposal(null);
                    }}>Apply</button>
                  <button style={btn(false)} onClick={() => setProposal(null)}>Discard</button>
                </div>
              </>
            )}
          </div>

          <div style={panel}>
            <h3 style={h3}>Floor</h3>
            <div style={{ fontSize: 11, lineHeight: 1.9, color: "#8a8aa0" }}>
              <div>cells <span style={{ color: "#aab" }}>{cells.size}</span></div>
              <div>regions <span style={{ color: regionCount > 1 ? "#ffaa22" : "#44ff88" }}>
                {regionCount}</span>
                {regionCount > 1 && <span style={{ color: "#445" }}> · each one sealed</span>}</div>
              <div>area <span style={{ color: "#aab" }}>{area.toFixed(1)} u²</span></div>
              <div>grid <span style={{ color: "#aab" }}>{cols} × {rows}</span>
                <span style={{ color: "#445" }}> · {GRID.x1 - GRID.x0} × {GRID.z1 - GRID.z0}u</span></div>
              {bounds && <div style={{ color: "#667", fontSize: 10 }}>{bounds}</div>}
            </div>
            <button
              onClick={() => { if (cells.size) { setUndo(new Set(cells)); setCells(new Set()); } }}
              style={{ ...btn(false), width: "100%", marginTop: 10,
                       color: cells.size ? "#ff8899" : "#445" }}>
              Clear all
            </button>
          </div>

          <div style={panel}>
            <h3 style={h3}>Persistence</h3>
            <div style={{ fontSize: 10, color: "#667", lineHeight: 1.65 }}>
              Saved to <code style={{ color: "#8a8aa0" }}>falo3d-2/map_data.json</code> on
              every change, through the workshop server — not browser storage.
              Editing this tool reloads the page, and the map comes straight back.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
