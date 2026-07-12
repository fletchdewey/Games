// src/player/controller.js
// First-person camera controller — the player's eyes and legs.
//
// FLETCHER'S GUIDE:
// In every FPS game, YOU are the camera. When you move the mouse,
// the camera rotates. When you press W, the camera moves forward.
// There's no character model — you ARE the viewpoint.
//
// Think of it like Breath of the Wild's first-person mode
// (when you use the Sheikah Slate camera). Your two thumbsticks
// control two things:
//   - Left stick = WASD = move your body (position)
//   - Right stick = mouse = turn your head (rotation)
//
// This file handles both of those, plus:
//   - Pointer Lock: traps the mouse cursor so it doesn't fly
//     off the edge of the screen. Click the game to lock,
//     press Escape to unlock.
//   - Gravity: pulls you down if you're in the air.
//   - Jump: spacebar launches you upward, gravity brings you back.
//
// The controller doesn't know about walls, aliens, or bullets.
// It just knows how to move a camera around. Other systems
// handle everything else.

import * as THREE from 'three';

// ─── SETUP ──────────────────────────────────────────────────────
//
// Call this ONCE to create the controller. Pass in the camera
// and the canvas element (for pointer lock).
//
// Returns a controller object that you pass to updateController()
// every frame.

export function createController(camera, domElement) {
  const ctrl = {
    // The camera we're moving around
    camera,
    domElement,

    // Position in the world (client starts at origin)
    position: new THREE.Vector3(0, 1.6, 0),  // 1.6 = eye height

    // Rotation — stored as two angles, not a quaternion.
    // Yaw = left/right (like shaking your head "no")
    // Pitch = up/down (like nodding "yes")
    yaw: 0,
    pitch: 0,

    // Movement
    velocity: new THREE.Vector3(),
    speed: 5,              // units per second
    jumpForce: 6,          // upward kick when you press space
    gravity: -15,          // pulls you down
    onGround: true,        // are your feet on the floor?
    groundY: 1.6,          // where "the floor" is (eye height)

    // Input state — which keys are currently held down
    keys: {
      forward: false,      // W
      backward: false,     // S
      left: false,         // A
      right: false,        // D
      jump: false,         // Space
    },

    // Mouse sensitivity
    sensitivity: 0.002,

    // Pointer lock state
    locked: false,

    // Shooting
    shootRequested: false,

    // Cleanup function (call when done)
    dispose: null,
  };

  // ─── INPUT LISTENERS ────────────────────────────────────────

  function onKeyDown(e) {
    switch (e.code) {
      case 'KeyW':      ctrl.keys.forward  = true; break;
      case 'KeyS':      ctrl.keys.backward = true; break;
      case 'KeyA':      ctrl.keys.left     = true; break;
      case 'KeyD':      ctrl.keys.right    = true; break;
      case 'Space':     ctrl.keys.jump     = true; e.preventDefault(); break;
    }
  }

  function onKeyUp(e) {
    switch (e.code) {
      case 'KeyW':      ctrl.keys.forward  = false; break;
      case 'KeyS':      ctrl.keys.backward = false; break;
      case 'KeyA':      ctrl.keys.left     = false; break;
      case 'KeyD':      ctrl.keys.right    = false; break;
      case 'Space':     ctrl.keys.jump     = false; break;
    }
  }

  function onMouseMove(e) {
    if (!ctrl.locked) return;

    // movementX/Y = how many pixels the mouse moved this frame.
    // Multiply by sensitivity to get radians of rotation.
    ctrl.yaw   -= e.movementX * ctrl.sensitivity;
    ctrl.pitch -= e.movementY * ctrl.sensitivity;

    // Clamp pitch so you can't look past straight up/down.
    // Without this, the view flips upside down — very disorienting.
    ctrl.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, ctrl.pitch));
  }

  // Pointer Lock: traps the cursor inside the game window.
  // Click to lock. When locked, click to shoot.
  function onMouseDown(e) {
    if (e.button !== 0) return; // left click only
    if (!ctrl.locked) {
      domElement.requestPointerLock();
    } else {
      ctrl.shootRequested = true;
    }
  }

  function onLockChange() {
    ctrl.locked = document.pointerLockElement === domElement;
  }

  // Wire up all the listeners
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousemove', onMouseMove);
  domElement.addEventListener('mousedown', onMouseDown);
  document.addEventListener('pointerlockchange', onLockChange);

  // Cleanup function — call this when the game shuts down
  ctrl.dispose = () => {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('mousemove', onMouseMove);
    domElement.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('pointerlockchange', onLockChange);
    if (ctrl.locked) document.exitPointerLock();
  };

  return ctrl;
}


// ─── UPDATE ─────────────────────────────────────────────────────
//
// Called every frame. Reads the input state, moves the camera.
//
// dt = delta time in seconds (usually ~0.016 for 60fps).
// Multiplying movement by dt ensures the game runs at the same
// speed regardless of framerate. Without it, faster computers
// would move faster — unfair!

export function updateController(ctrl, dt) {
  // ─── BUILD MOVEMENT DIRECTION ───────────────────────────────
  //
  // WASD gives us a direction in "camera space" — forward means
  // wherever the camera is pointing, not world-north.
  //
  // We build a direction vector from the key states, then rotate
  // it by the camera's yaw so "forward" always means "the way
  // you're looking."

  const moveDir = new THREE.Vector3();

  if (ctrl.keys.forward)  moveDir.z -= 1;
  if (ctrl.keys.backward) moveDir.z += 1;
  if (ctrl.keys.left)     moveDir.x -= 1;
  if (ctrl.keys.right)    moveDir.x += 1;

  // Normalize so diagonal movement isn't faster than straight.
  // Without this, pressing W+D makes you move at 1.41x speed.
  if (moveDir.lengthSq() > 0) moveDir.normalize();

  // Rotate movement by yaw (but not pitch — you don't want
  // looking up to make you fly upward when pressing W)
  moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), ctrl.yaw);

  // Apply movement speed
  ctrl.velocity.x = moveDir.x * ctrl.speed;
  ctrl.velocity.z = moveDir.z * ctrl.speed;

  // ─── JUMP + GRAVITY ─────────────────────────────────────────

  if (ctrl.keys.jump && ctrl.onGround) {
    ctrl.velocity.y = ctrl.jumpForce;
    ctrl.onGround = false;
  }

  // Gravity always pulls down (unless on the ground)
  if (!ctrl.onGround) {
    ctrl.velocity.y += ctrl.gravity * dt;
  }

  // ─── APPLY VELOCITY ─────────────────────────────────────────

  ctrl.position.x += ctrl.velocity.x * dt;
  ctrl.position.y += ctrl.velocity.y * dt;
  ctrl.position.z += ctrl.velocity.z * dt;

  // Floor collision — simple version (flat floor)
  if (ctrl.position.y <= ctrl.groundY) {
    ctrl.position.y = ctrl.groundY;
    ctrl.velocity.y = 0;
    ctrl.onGround = true;
  }

  // ─── UPDATE CAMERA ──────────────────────────────────────────
  //
  // The camera's rotation uses Euler angles in YXZ order.
  // Y = yaw (left/right), X = pitch (up/down).
  // YXZ order means: first yaw, then pitch on top of that.
  // This prevents "gimbal lock" — a bug where the camera
  // gets stuck when looking straight up.

  ctrl.camera.position.copy(ctrl.position);
  ctrl.camera.rotation.order = 'YXZ';
  ctrl.camera.rotation.y = ctrl.yaw;
  ctrl.camera.rotation.x = ctrl.pitch;
}
