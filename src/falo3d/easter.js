// === EASTER EGGS ===
// Konami Code: up up down down left right left right B A
const konamiSequence = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA'];
let konamiProgress = 0;
let godMode = false;
let godModeMessageTimer = 0;

// Big Head Mode: hold LB + RB
let bigHeadMode = false;
let bigHeadPrevState = false;

// Secret Room state
let secretRoomFound = false;
let secretRoomMessageTimer = 0;
