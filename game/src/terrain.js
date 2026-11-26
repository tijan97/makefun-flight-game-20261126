// Procedural terrain for the valley: rolling hills, a meandering river,
// patchwork fields, forest belts, far mountain ridges and the airstrips.
// All of it is seeded, so the same seed always builds the same valley.

import { makeNoise1D, makeNoise2D, clamp, lerp } from './rng.js';
import { WORLD, MISSIONS } from './config.js';

// Every airstrip's centreline distance: the ground is flattened around each
// one so takeoffs and landings are fair and the strip sits on level ground.
const STRIP_Z = [0, ...MISSIONS.map((m) => m.runwayZ)];

export class Terrain {
  constructor(seed = 20261126) {
    this.seed = seed;
    this.hillNoise = makeNoise2D(seed);
    this.ridgeNoise = makeNoise1D(seed + 7);
    this.fieldNoise = makeNoise2D(seed + 31);
    this.riverNoise = makeNoise1D(seed + 55);
    this.cloudNoise = makeNoise1D(seed + 91);
  }

  // River centreline x at distance z: a slow meander down the valley.
  riverX(z) {
    return this.riverNoise(z * 0.00012) * 700 + Math.sin(z * 0.00021) * 260;
  }

  // Ground height in feet at world (x, z). The valley floor is gentle, the
  // edges rise into hills, and past the ridge line the mountains take over.
  // The ground is then flattened around each airstrip, along the whole
  // length of the strip, so the runway itself is level ground.
  groundHeight(x, z) {
    let h = this.rawGroundHeight(x, z);
    for (const sz of STRIP_Z) {
      const z1 = sz + WORLD.runwayLength;
      const dz = z < sz ? sz - z : z > z1 ? z - z1 : 0;
      if (dz < 800 && Math.abs(x) < 300) {
        const w = (1 - dz / 800) * (1 - Math.abs(x) / 300);
        h = lerp(h, this.rawGroundHeight(0, sz), Math.min(1, w));
      }
    }
    return Math.max(0, h);
  }

  rawGroundHeight(x, z) {
    const hills = this.hillNoise(x * 0.004, z * 0.004) * WORLD.hillHeight;
    const edge = clamp((Math.abs(x) - 900) / 900, 0, 1);
    let h = WORLD.groundBase + hills * (0.35 + edge * 0.65) + edge * edge * 420;
    if (z > WORLD.ridgeStart) {
      const t = clamp((z - WORLD.ridgeStart) / 5000, 0, 1);
      const ridge = this.ridgeNoise(x * 0.002 + z * 0.0004) * WORLD.ridgeHeight;
      h += t * (500 + Math.max(0, ridge));
    }
    return Math.max(0, h);
  }

  // Which field colour a ground cell gets: patchwork by cell and noise.
  fieldShade(cx, cz) {
    const n = this.fieldNoise(cx * 0.11, cz * 0.11);
    if (n > 0.55) return 2; // hay gold
    if (n > 0.05) return 0; // green
    if (n > -0.35) return 1; // lighter green
    return 3; // forest
  }

  // Cloud puffs: fixed world slots, each with a lateral offset and height.
  clouds() {
    const list = [];
    for (let i = 0; i < 18; i++) {
      const z = 1500 + i * 2200 + this.cloudNoise(i * 1.7) * 600;
      const x = this.cloudNoise(i * 3.1 + 40) * 2400;
      const y = 2400 + this.cloudNoise(i * 2.3 + 80) * 700;
      const s = 60 + Math.abs(this.cloudNoise(i * 4.7)) * 100;
      list.push({ x, y, z, s });
    }
    return list;
  }

  // Project a world point into screen space from the plane's eye.
  // eye: {x, y, z, heading}; returns {sx, sy, scale} or null behind camera.
  project(wx, wy, wz, eye) {
    const dz = wz - eye.z;
    if (dz < 40) return null;
    const dx = wx - eye.x;
    // Rotate by heading so the view turns with the plane.
    const rad = (eye.heading * Math.PI) / 180;
    const fwd = dx * Math.sin(rad) + dz * Math.cos(rad);
    const side = dx * Math.cos(rad) - dz * Math.sin(rad);
    if (fwd < 40) return null;
    const focal = 620;
    const sx = 640 + (side / fwd) * focal;
    const sy = 400 - ((wy - eye.y) / fwd) * focal;
    return { sx, sy, scale: focal / fwd };
  }

  horizonOffset(eye) {
    // The horizon line tips with bank and pitch, like a real attitude view.
    return eye.pitch * 2.2;
  }
}

// Interpolate a colour stop list for the sky gradient.
export function skyGradient(ctx, horizonY) {
  const g = ctx.createLinearGradient(0, 0, 0, horizonY + 120);
  g.addColorStop(0, '#24507e');
  g.addColorStop(0.45, '#4f8ac2');
  g.addColorStop(0.8, '#9cc6e4');
  g.addColorStop(1, '#ffd9a0');
  return g;
}

export { clamp, lerp };
