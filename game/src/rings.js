// Target rings and airstrips: the course of each sortie, the ring-pass check
// and the landing judgement. A ring is a glowing hoop in the sky; a strip is
// a runway the pilot must set down on gently and slowly.

import { MISSIONS, WORLD, SCORES } from './config.js';
import { makeRng, clamp } from './rng.js';

export class Course {
  constructor(terrain, seed = 20261126) {
    this.terrain = terrain;
    this.rng = makeRng(seed);
    this.missionIndex = 0;
    this.rings = [];
    this.passed = 0;
    this.missed = 0;
    this.runway = null;
    this.buildMission(0, 0);
  }

  mission() {
    return MISSIONS[this.missionIndex];
  }

  // Lay out the rings for a sortie, spread between the departure strip and
  // the arrival strip, so the pilot always flies forward to the next goal.
  buildMission(index, startZ) {
    this.missionIndex = index;
    const m = MISSIONS[index];
    this.rings = [];
    this.passed = 0;
    this.missed = 0;
    const departName = index === 0 ? 'HOME STRIP' : MISSIONS[index - 1].runwayName;
    this.departure = {
      z: startZ,
      x: 0,
      name: departName,
      ground: this.terrain.groundHeight(0, startZ),
    };
    const ringStart = startZ + WORLD.runwayLength + 900;
    const span = m.runwayZ - ringStart - 1200;
    for (let i = 0; i < m.rings; i++) {
      const t = (i + 0.7) / (m.rings + 0.6);
      const z = ringStart + t * span;
      const x = this.terrain.riverX(z) * 0.35 + (this.rng() * 2 - 1) * 420;
      const ground = this.terrain.groundHeight(x, z);
      const y = Math.max(m.ringAlt, ground + 420 + this.rng() * 260);
      this.rings.push({ x, y, z, r: 130, passed: false, missed: false });
    }
    const rz = m.runwayZ;
    this.runway = {
      z: rz,
      x: 0,
      name: m.runwayName,
      ground: this.terrain.groundHeight(0, rz),
    };
    return m;
  }

  // The next thing the pilot should fly to: the nearest unflown ring, else the
  // strip — with the strip's ground level so the autopilot can fly a glide path.
  nextTarget(plane) {
    for (const ring of this.rings) {
      if (!ring.passed && !ring.missed) return ring;
    }
    return {
      x: this.runway.x,
      y: this.runway.ground + 60,
      z: this.runway.z + 1200, // a steering point past the strip's far end
      touchdownZ: this.runway.z + 450, // the touchdown point, mid-strip
      r: 60,
      runway: true,
      ground: this.runway.ground,
    };
  }

  // Call each frame with the plane's previous and current z: a ring is judged
  // the moment the plane crosses its plane.
  checkCrossings(plane, prevZ) {
    const events = [];
    for (const ring of this.rings) {
      if (ring.passed || ring.missed) continue;
      if (prevZ < ring.z && plane.z >= ring.z) {
        const dx = plane.x - ring.x;
        const dy = plane.y - ring.y;
        const dist = Math.hypot(dx, dy);
        if (dist < ring.r) {
          ring.passed = true;
          this.passed++;
          events.push({ type: 'ring', ring });
        } else {
          ring.missed = true;
          this.missed++;
          events.push({ type: 'miss', ring });
        }
      }
    }
    return events;
  }

  get ringsLeft() {
    return this.rings.filter((r) => !r.passed && !r.missed).length;
  }

  get allRingsDone() {
    return this.ringsLeft === 0;
  }

  // Landing judgement as the plane crosses the strip. Returns 'landed',
  // 'too-fast', 'too-hard', or null when not over the strip. A climbing
  // plane never lands: taking off over the strip is not a landing.
  checkLanding(plane, prevZ) {
    const r = this.runway;
    const z0 = r.z;
    const z1 = r.z + WORLD.runwayLength;
    if (prevZ < z0 || plane.z < z0 || plane.z > z1) return null;
    if (plane.y > r.ground + 90) return null;
    if (Math.abs(plane.x - r.x) > WORLD.runwayWidth / 2 + 14) return null;
    if (plane.verticalSpeed > 2) return null;
    if (plane.speed > 135) return 'too-fast';
    if (plane.verticalSpeed < -11) return 'too-hard';
    return 'landed';
  }

  // Move on to the next sortie after a landing. Returns the new mission or null.
  // The next sortie departs from the strip just landed on.
  advance(plane) {
    if (this.missionIndex + 1 >= MISSIONS.length) return null;
    const next = this.buildMission(this.missionIndex + 1, this.runway.z);
    return next;
  }
}

export { SCORES, clamp };
