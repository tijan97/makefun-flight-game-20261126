// Seeded random numbers and smooth value noise, so the valley, river and
// ridges look the same every flight and every screenshot.

// Mulberry32: a small deterministic PRNG.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 1D smooth noise from a seeded table: value noise with cosine interpolation.
export function makeNoise1D(seed, size = 256) {
  const rng = makeRng(seed);
  const table = new Float32Array(size);
  for (let i = 0; i < size; i++) table[i] = rng() * 2 - 1;
  return function noise(x) {
    const xi = Math.floor(x);
    const xf = x - xi;
    const a = table[((xi % size) + size) % size];
    const b = table[(((xi + 1) % size) + size) % size];
    const u = (1 - Math.cos(xf * Math.PI)) / 2;
    return a + (b - a) * u;
  };
}

// 2D smooth noise built from the same table, hashed per cell.
export function makeNoise2D(seed) {
  const n1 = makeNoise1D(seed);
  const n2 = makeNoise1D(seed + 101);
  return function noise(x, z) {
    return (n1(x * 0.7 + z * 0.31) + n2(z * 0.7 - x * 0.23)) / 2;
  };
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
