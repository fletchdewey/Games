// shared/behavior.js
// Behavior specification for aliens and bosses.
//
// WHY THIS FILE EXISTS (Fletcher):
// Every alien needs to do four things: MOVE, ATTACK, TAKE DAMAGE, and DIE.
// But HOW they do each one is different. A Crawler pounces. A Spire spits.
// A Brute charges.
//
// This file defines the SHAPE of a behavior — what questions every alien
// must answer — without answering them. Each alien file fills in its own
// answers. This is like a form template: the form has the same blanks
// (name, address, phone) but every person fills them in differently.
//
// In programming, this pattern is called an INTERFACE. It's a contract:
// "if you want to be an alien in this game, you must provide these things."
//
// This matters because the game loop doesn't need to know if it's updating
// a Crawler or a Brute. It just calls alien.behavior.move(alien, dt) and
// trusts that each alien defined what "move" means for itself.
// That's called POLYMORPHISM — same function call, different behavior
// depending on who's answering.

/**
 * Creates a behavior spec with sensible defaults.
 * Each alien overrides what's unique about it.
 * 
 * @param {object} overrides - Alien-specific behavior config
 * @returns {object} Complete behavior spec
 */
export function createBehaviorSpec(overrides = {}) {
  return {
    // === IDENTITY ===
    type: 'unknown',         // 'crawler', 'floater', 'brute', 'spire'
    isBoss: false,

    // === STATS ===
    health: 3,
    speed: 0.03,
    patrolRange: 5,          // how far it wanders from spawn

    // === MOVEMENT ===
    // 'patrol' = walk back and forth
    // 'hover'  = float in place (floater)
    // 'charge' = rush toward player when in range
    movementType: 'patrol',
    canStrafe: false,         // sidestep while facing player?

    // === ATTACK ===
    attackType: 'melee',      // 'melee', 'ranged', 'pounce', 'area'
    attackRange: 2,           // distance to trigger attack
    attackDamage: 1,
    attackCooldown: 90,       // frames between attacks
    projectileSpeed: 0,       // 0 = melee, >0 = ranged

    // === ANIMATION ===
    walkSpeed: 4,             // leg cycle speed multiplier
    walkAmplitude: 0.2,       // how much legs swing

    // === DEATH ===
    deathType: 'collapse',    // 'collapse', 'explode', 'scatter', 'split'

    // === HOOKS ===
    // These get filled in per-alien. The game loop calls them.
    // They start as no-ops so nothing crashes if you forget one.
    onSpawn: null,            // called when alien enters the scene
    onUpdate: null,           // called every frame
    onHit: null,              // called when alien takes damage
    onDeath: null,            // called when health reaches 0
    onAttack: null,           // called when alien attacks

    ...overrides,
  };
}
