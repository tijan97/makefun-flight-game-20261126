// Sky Courier: Ridge Run — tuning constants and the three-sortie mission list.
// Units: feet for altitude and distance, knots for speed, degrees for heading.

export const VIEW = { width: 1280, height: 720, horizonY: 400 };

export const PLANE = {
  maxSpeed: 220,      // knots at full throttle
  minSpeed: 55,       // below this the wing stops flying
  cruiseSpeed: 150,
  climbRate: 42,      // ft per second at full climb
  turnRate: 26,       // degrees per second at full bank
  bankMax: 38,        // degrees of visual bank
  fuelBurn: 0.35,     // percent per second at full throttle
  fuelRingBonus: 6,   // percent refuel per ring flown
};

export const WORLD = {
  groundBase: 0,      // valley floor altitude in feet
  hillHeight: 260,    // rolling hill amplitude
  ridgeHeight: 1500,  // mountain ridge amplitude
  ridgeStart: 26000,  // distance where the ridge mission begins
  runwayWidth: 48,
  runwayLength: 900,
};

// One sortie per mission stage. Each sortie departs from the strip the last
// one landed on, flies its rings, and lands at the next strip.
export const MISSIONS = [
  {
    name: 'SORTIE 1 — RING RUN',
    brief: 'Take off from Home Strip, fly all 6 rings over Pinefield Valley, then land on Pinefield Strip.',
    rings: 6,
    ringAlt: 900,
    runwayZ: 9500,
    runwayName: 'PINEFIELD STRIP',
    terrain: 'valley',
  },
  {
    name: 'SORTIE 2 — RIVER DELIVERY',
    brief: 'Take off from Pinefield Strip, follow the river, thread 5 rings, and set down at Lakeside Strip.',
    rings: 5,
    ringAlt: 700,
    runwayZ: 19500,
    runwayName: 'LAKESIDE STRIP',
    terrain: 'river',
  },
  {
    name: 'SORTIE 3 — RIDGE CROSSING',
    brief: 'Take off from Lakeside Strip, cross the Highpass ridge through 8 rings, then land at Highpass Strip.',
    rings: 8,
    ringAlt: 1600,
    runwayZ: 32000,
    runwayName: 'HIGHPASS STRIP',
    terrain: 'ridge',
  },
];

export const SCORES = {
  ring: 100,
  landing: 250,
  smoothLanding: 150,
  tourComplete: 1000,
};

export const COLORS = {
  skyTop: '#2f6fb2',
  skyMid: '#7fb2dd',
  skyHorizon: '#ffd9a0',
  groundNear: '#4d7a3a',
  groundFar: '#6f9a52',
  fieldA: '#5d8a42',
  fieldB: '#7fae56',
  fieldC: '#c2a55a',
  forest: '#2f5d2a',
  river: '#3f8fd2',
  runway: '#3a3f46',
  runwayLine: '#f5f0dc',
  ring: '#ffd23f',
  ringGlow: '#ff9d00',
  hud: '#7df9ff',
  hudAmber: '#ffb347',
  hudRed: '#ff5a5a',
  panel: 'rgba(8, 20, 36, 0.8)',
};
