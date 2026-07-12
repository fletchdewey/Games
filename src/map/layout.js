// src/map/layout.js
// Room definitions for the space station map.
//
// FLETCHER'S GUIDE:
// This file is like graph paper planning before you build a Lego castle.
// It describes where each room is, how big it is, and what color it is.
// The builder reads this and creates the actual 3D geometry.
//
// COORDINATE SYSTEM:
// - X = left/right (negative = left)
// - Z = forward/back (negative = deeper into the station)
// - Y = up/down (floor at 0, ceiling at 4)
// - All positions are the CENTER of the room's floor
//
// GAME FLOW:
// Loading Bay (start + helicopter extract)
//   → Main corridor splits into 3 paths
//   → Left: Cafeteria → Hospital → Prison → Outpost 3
//            Cafeteria → Outpost 2
//   → Right: Armory → Alien Pods → Outpost 4
//   → Straight: Outpost 1
//   → Clear all 4 Outposts → Locked Door opens
//   → Control Room (boss fight)
//   → Escape Pods (extract) OR backtrack to Loading Bay (helicopter)

export const WALL_HEIGHT = 4;
export const DOOR_WIDTH = 2.5;
export const DOOR_HEIGHT = 3;

export const ROOMS = [
  // === START / EXTRACTION ===
  { id: 'loading_bay', label: 'Loading Bay', pos: [0, 0], size: [20, 14],
    color: 0x1a2a1a, stripe: 0x44aa44, desc: 'Start here. Helicopter extract point.' },

  // === MAIN SPINE ===
  { id: 'corridor1', label: '', pos: [0, -14], size: [4, 14],
    color: 0x1a1a22, stripe: 0x334455, desc: '' },

  // === LEFT BRANCH ===
  { id: 'corridor_cafe', label: '', pos: [-5, -18], size: [6, 3],
    color: 0x1a1a22, stripe: 0x334455, desc: '' },
  { id: 'cafeteria', label: 'Cafeteria', pos: [-16, -25], size: [18, 14],
    color: 0x2a2218, stripe: 0xaa8844, desc: 'Tables, vending machines. Health + ammo.' },
  { id: 'corridor_hosp', label: '', pos: [-16, -35], size: [3, 6],
    color: 0x1a1a22, stripe: 0x334455, desc: '' },
  { id: 'hospital', label: 'Hospital', pos: [-16, -42], size: [12, 8],
    color: 0x1a2a2a, stripe: 0x44aaaa, desc: 'Medbay. Health pickups.' },
  { id: 'corridor_prison', label: '', pos: [-16, -48], size: [3, 4],
    color: 0x1a1a22, stripe: 0x334455, desc: '' },
  { id: 'prison', label: 'Prison', pos: [-16, -54], size: [10, 8],
    color: 0x221a1a, stripe: 0x884444, desc: 'Cells and cages. Tight spaces.' },
  { id: 'corridor_o3', label: '', pos: [-16, -60], size: [3, 4],
    color: 0x1a1a22, stripe: 0x334455, desc: '' },
  { id: 'outpost3', label: 'Outpost 3', pos: [-16, -69], size: [10, 14],
    color: 0x2a2218, stripe: 0xffaa22, desc: 'Spire territory. Long and narrow.' },
  { id: 'corridor_o2', label: '', pos: [-28, -25], size: [6, 3],
    color: 0x1a1a22, stripe: 0x334455, desc: '' },
  { id: 'outpost2', label: 'Outpost 2', pos: [-38, -25], size: [14, 14],
    color: 0x2a1a2a, stripe: 0xff44cc, desc: 'Floater territory. Columns for cover.' },

  // === RIGHT BRANCH ===
  { id: 'corridor_arm', label: '', pos: [5, -18], size: [6, 3],
    color: 0x1a1a22, stripe: 0x334455, desc: '' },
  { id: 'armory', label: 'Armory', pos: [16, -25], size: [12, 10],
    color: 0x1a1a2a, stripe: 0x4466aa, desc: 'Weapon racks. Ammo pickups.' },
  { id: 'corridor_pods', label: '', pos: [16, -33], size: [3, 6],
    color: 0x1a1a22, stripe: 0x334455, desc: '' },
  { id: 'alien_pods', label: 'Alien Pods', pos: [16, -42], size: [14, 12],
    color: 0x1a2218, stripe: 0x66aa44, desc: 'Where they came from. Pods line the walls.' },
  { id: 'corridor_o4', label: '', pos: [16, -50], size: [3, 4],
    color: 0x1a1a22, stripe: 0x334455, desc: '' },
  { id: 'outpost4', label: 'Outpost 4', pos: [18, -59], size: [16, 14],
    color: 0x1a2a3a, stripe: 0x44ccff, desc: 'Brute territory. Wide arena.' },

  // === STRAIGHT AHEAD ===
  { id: 'corridor_o1', label: '', pos: [0, -23], size: [3, 4],
    color: 0x1a1a22, stripe: 0x334455, desc: '' },
  { id: 'outpost1', label: 'Outpost 1', pos: [0, -30], size: [10, 10],
    color: 0x1a2e1a, stripe: 0x44ff88, desc: 'Crawler territory. Tight corridors.' },

  // === LOCKED DOOR + ENDGAME ===
  { id: 'corridor_lock', label: '', pos: [0, -38.5], size: [3, 7],
    color: 0x1a1a22, stripe: 0x334455, desc: '' },
  { id: 'locked_door', label: 'Locked Door', pos: [0, -44], size: [6, 4],
    color: 0x2a1a1a, stripe: 0xff2244, desc: 'Clear all 4 Outposts to open.' },
  { id: 'corridor_ctrl', label: '', pos: [0, -49], size: [3, 6],
    color: 0x1a1a22, stripe: 0x334455, desc: '' },
  { id: 'control_room', label: 'Control Room', pos: [0, -60], size: [18, 16],
    color: 0x2a1a2a, stripe: 0xaa44aa, desc: 'Boss fight. One random boss spawns here.' },
  { id: 'corridor_ep', label: '', pos: [0, -70], size: [3, 4],
    color: 0x1a1a22, stripe: 0x334455, desc: '' },
  { id: 'escape_pods', label: 'Escape Pods', pos: [0, -76], size: [10, 8],
    color: 0x1a2a2a, stripe: 0x44ffaa, desc: 'Secondary extract. Past the boss.' },
];

// Connections: pairs of room IDs with a doorway between them.
// The builder auto-detects shared walls from room AABBs,
// so this list is for reference / future gating logic.
export const CONNECTIONS = [
  ['loading_bay', 'corridor1'],
  ['corridor1', 'corridor_cafe'],
  ['corridor1', 'corridor_arm'],
  ['corridor1', 'corridor_o1'],
  ['corridor_cafe', 'cafeteria'],
  ['cafeteria', 'corridor_hosp'],
  ['cafeteria', 'corridor_o2'],
  ['corridor_hosp', 'hospital'],
  ['hospital', 'corridor_prison'],
  ['corridor_prison', 'prison'],
  ['prison', 'corridor_o3'],
  ['corridor_o3', 'outpost3'],
  ['corridor_o2', 'outpost2'],
  ['corridor_arm', 'armory'],
  ['armory', 'corridor_pods'],
  ['corridor_pods', 'alien_pods'],
  ['alien_pods', 'corridor_o4'],
  ['corridor_o4', 'outpost4'],
  ['corridor_o1', 'outpost1'],
  ['outpost1', 'corridor_lock'],
  ['corridor_lock', 'locked_door'],
  ['locked_door', 'corridor_ctrl'],
  ['corridor_ctrl', 'control_room'],
  ['control_room', 'corridor_ep'],
  ['corridor_ep', 'escape_pods'],
];
