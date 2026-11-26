// Deterministic screenshot scenes: ?shot=takeoff|cruise|ring|landing (with an
// optional &seed=) stages the game mid-flight so a still frame already shows
// the plane, the terrain, a ring or a runway, and the live HUD. The scenes are
// the game's own code running — the autopilot keeps flying from the staged
// state, exactly as it does behind the title screen.

export function shotName() {
  const q = new URLSearchParams(window.location.search);
  return q.get('shot');
}

export function shotSeed() {
  const q = new URLSearchParams(window.location.search);
  const s = parseInt(q.get('seed') || '20261126', 10);
  return Number.isFinite(s) ? s : 20261126;
}

// Stage the state for a named shot. Returns true when a scene was applied.
export function applyShot(state, name) {
  const p = state.plane;
  const c = state.course;
  const t = state.terrain;
  if (name === 'takeoff') {
    // Rolling down Home Strip, nose up, runway ahead.
    const r = c.departure;
    p.reset(0, r.ground + 6, r.z + 80);
    p.throttle = 1;
    p.speed = 55;
    p.pitch = 7;
    p.onGround = true;
    state.mode = 'attract';
    return true;
  }
  if (name === 'cruise') {
    // Level cruise over the river valley, first ring glowing ahead.
    p.reset(60, 1150, 1800);
    p.throttle = 0.72;
    p.speed = 152;
    p.pitch = 0;
    p.onGround = false;
    state.mode = 'attract';
    return true;
  }
  if (name === 'ring') {
    // Banked in on the first ring, close enough to fill the frame.
    const ring = c.rings[0];
    if (!ring) return false;
    p.reset(ring.x - 70, ring.y - 50, ring.z - 450);
    p.throttle = 0.8;
    p.speed = 168;
    p.bank = 20;
    p.pitch = 1;
    p.onGround = false;
    state.mode = 'attract';
    return true;
  }
  if (name === 'landing') {
    // Final approach to Pinefield Strip: gear down, runway centred ahead.
    const r = c.runway;
    for (const ring of c.rings) ring.passed = true;
    c.passed = c.rings.length;
    p.reset(24, r.ground + 260, r.z - 700);
    p.throttle = 0.42;
    p.speed = 112;
    p.pitch = -4;
    p.onGround = false;
    state.mode = 'attract';
    return true;
  }
  return false;
}
