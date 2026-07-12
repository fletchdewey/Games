// shared/geometry.js
// Reusable geometry builders for alien body parts.
//
// WHY THIS FILE EXISTS (Fletcher):
// The Crawler, Brute, Spire, and most bosses all have legs.
// Without this file, we'd copy-paste the same leg-building code
// into every alien file. Then when we find a bug in how knees
// connect, we'd have to fix it in 8 places.
//
// Instead, we write buildLegChain() ONCE and every alien calls it.
// This is like having a Lego Technic leg piece that snaps into
// any model — you don't rebuild the leg mechanism every time.

import * as THREE from 'three';

/**
 * Builds a two-segment leg as a parent-child hierarchy.
 * 
 * The key insight here: each piece is a CHILD of the piece above it.
 * When you rotate the upper leg, the knee, lower leg, and foot all
 * follow automatically — just like a real joint. If we positioned
 * them independently (like v1 did), they'd disconnect during animation.
 * 
 * Returns an object with references to each joint so the animation
 * system can rotate them during walk cycles.
 */
export function buildLegChain({
  upperLen,
  lowerLen,
  upperR,
  lowerR,
  footSize = null,
  skinMat,
  boneMat,
  upperTilt = 0,
  lowerTilt = 0,
}) {
  // Hip is the root — everything hangs from here
  const hip = new THREE.Group();

  // Upper leg: geometry is offset so it hangs DOWN from the hip
  const upperGeo = new THREE.CylinderGeometry(upperR, upperR * 0.75, upperLen, 5);
  upperGeo.translate(0, -upperLen / 2, 0);
  const upper = new THREE.Mesh(upperGeo, skinMat);
  upper.rotation.x = upperTilt;
  hip.add(upper);

  // Knee joint: positioned at the END of the upper leg
  // Because it's a child of `upper`, it moves when upper rotates
  const knee = new THREE.Group();
  knee.position.y = -upperLen;
  upper.add(knee);

  // Visible joint ball so the knee looks connected
  const jointGeo = new THREE.SphereGeometry(upperR * 1.1, 5, 5);
  const joint = new THREE.Mesh(jointGeo, skinMat);
  knee.add(joint);

  // Lower leg: hangs from the knee
  const lowerGeo = new THREE.CylinderGeometry(upperR * 0.75, lowerR, lowerLen, 5);
  lowerGeo.translate(0, -lowerLen / 2, 0);
  const lower = new THREE.Mesh(lowerGeo, skinMat);
  lower.rotation.x = lowerTilt;
  knee.add(lower);

  // Foot group at the end of the lower leg
  const footGroup = new THREE.Group();
  footGroup.position.y = -lowerLen;
  lower.add(footGroup);

  // Ankle ball
  const footJointGeo = new THREE.SphereGeometry(lowerR * 1.2, 4, 4);
  const footJoint = new THREE.Mesh(footJointGeo, skinMat);
  footGroup.add(footJoint);

  // Optional talon/claw foot
  if (footSize) {
    const footGeo = new THREE.ConeGeometry(footSize, footSize * 2.5, 4);
    footGeo.translate(0, -footSize * 1.2, 0);
    const foot = new THREE.Mesh(footGeo, boneMat);
    foot.rotation.x = -0.5;
    footGroup.add(foot);
  }

  return { hip, upper, knee, lower, footGroup };
}

/**
 * Builds a two-segment arm chain (shoulder → elbow → forearm).
 * Same parent-child principle as legs.
 */
export function buildArmChain({
  shoulderR,
  upperLen,
  upperR,
  foreLen,
  foreR,
  skinMat,
  side, // -1 for left, 1 for right
}) {
  const shoulderPivot = new THREE.Group();

  // Shoulder ball
  const shoulderGeo = new THREE.SphereGeometry(shoulderR, 6, 5);
  const shoulder = new THREE.Mesh(shoulderGeo, skinMat);
  shoulderPivot.add(shoulder);

  // Upper arm
  const upperGeo = new THREE.CylinderGeometry(upperR, upperR * 0.8, upperLen, 6);
  upperGeo.translate(0, -upperLen / 2, 0);
  const upper = new THREE.Mesh(upperGeo, skinMat);
  upper.rotation.z = side * 0.25;
  shoulderPivot.add(upper);

  // Elbow
  const elbowPivot = new THREE.Group();
  elbowPivot.position.y = -upperLen;
  upper.add(elbowPivot);

  const elbowGeo = new THREE.SphereGeometry(upperR * 0.9, 5, 5);
  const elbow = new THREE.Mesh(elbowGeo, skinMat);
  elbowPivot.add(elbow);

  // Forearm
  const foreGeo = new THREE.CylinderGeometry(upperR * 0.8, foreR, foreLen, 6);
  foreGeo.translate(0, -foreLen / 2, 0);
  const fore = new THREE.Mesh(foreGeo, skinMat);
  fore.rotation.x = -0.3;
  elbowPivot.add(fore);

  return { shoulderPivot, elbowPivot, upper, fore, side };
}
