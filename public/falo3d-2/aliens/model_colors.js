// src/aliens/model_colors.js
// Remembering what colour something was before we flashed it.
//
// FLETCHER'S GUIDE:
// Getting shot makes an alien flash white, and when the flash is over it has
// to go back to its normal colour. The question is: back to WHAT, exactly?
//
// The old answer was to write the colour down in the alien's own file —
// "plates go back to 0x1e1e2a". That works right up until someone changes the
// model's colour in the Alien Workshop. Nothing errors. The alien just quietly
// changes colour the first time it gets hit, and stays that way, because the
// number in the code and the number in the model stopped agreeing.
//
// So: nobody writes the colour down twice. Before the first flash we ask the
// material what colour it already is and keep a copy on the material itself.
// Recolour the model in the workshop and the flash follows it automatically.

import * as THREE from 'three';

/**
 * Take a copy of a material's colour, once, so it can be put back later.
 * Safe to call repeatedly — the first copy is the one that counts, so a
 * material snapshotted mid-flash can't record white as its "normal".
 */
export function rememberColor(material) {
  if (material && !material.userData.baseColor) {
    material.userData.baseColor = material.color.clone();
    // Opacity goes the same way: the Floater's death fade used to start from
    // a 0.7 written into its own file, which is not what the workshop's bell
    // is actually built at, so the body flashed brighter as it began to die.
    material.userData.baseOpacity = material.opacity;
  }
  return material;
}

/** The same, for a list of meshes — the usual case. */
export function rememberColors(meshes) {
  if (!meshes) return;
  for (const m of meshes) if (m && m.material) rememberColor(m.material);
}

/** Put a material back to the colour it was built with. */
export function restoreColor(material) {
  const base = material && material.userData.baseColor;
  if (base) material.color.copy(base);
}

/**
 * A material's original colour as plain r/g/b in 0..1, for the flashes that
 * interpolate toward white by hand instead of just setting a colour.
 * Falls back to the live colour if nobody snapshotted it.
 */
const SCRATCH = new THREE.Color();
export function baseColorRGB(material) {
  return (material && material.userData.baseColor) || SCRATCH.copy(material.color);
}

/** A material's original opacity, for fades that start from "however solid
 *  this already was" rather than from a number typed in somewhere else. */
export function baseOpacity(material) {
  if (!material) return 1;
  const o = material.userData.baseOpacity;
  return o === undefined ? material.opacity : o;
}
