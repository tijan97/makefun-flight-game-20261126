// Sky Courier: Ridge Run — bootstrap and the game loop.
// Modes: title (autopilot demo behind the menu), playing, paused, crashed,
// complete. The plane takes off from Pinefield Strip, flies three sorties
// of rings and landings, and the tour ends at Highpass Strip.

import { VIEW, MISSIONS, SCORES, WORLD, PLANE } from './config.js';
import { Terrain } from './terrain.js';
import { PlaneState } from './plane.js';
import { Course } from './rings.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { renderScene } from './render.js';
import { drawHud, drawTitle, drawPaused, drawGameOver, drawTourComplete } from './hud.js';
import { shotName, shotSeed, applyShot } from './shots.js';
import { clamp } from './rng.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const state = {
  terrain: new Terrain(shotSeed()),
  plane: new PlaneState(),
  course: null,
  input: new Input(canvas),
  sounds: new SoundBank(),
  mode: 'title',
  score: 0,
  time: 0,
  flash: '',
  flashColor: '#ffd23f',
  flashT: 0,
  message: 'Fly the rings, then land',
  crashReason: '',
  clouds: [],
  hasFlown: false, // true once the plane has genuinely climbed out this sortie
};
state.course = new Course(state.terrain, shotSeed());
state.clouds = state.terrain.clouds();

const statusEl = document.getElementById('status');

function setFlash(text, color = '#ffd23f') {
  state.flash = text;
  state.flashColor = color;
  state.flashT = 2.2;
  statusEl.textContent = text;
}

function resetFlight() {
  const c = state.course;
  c.buildMission(0, 0);
  const r = c.departure;
  state.plane.reset(0, r.ground + 4, r.z + 100);
  state.plane.onGround = true;
  state.score = 0;
  state.message = 'Fly the rings, then land';
  state.crashReason = '';
  state.flash = '';
  state.flashT = 0;
  state.hasFlown = false;
}

function startPlaying() {
  state.sounds.ensure();
  resetFlight();
  state.mode = 'playing';
  setFlash('SORTIE 1 — RING RUN', '#7df9ff');
}

function crash(reason) {
  state.mode = 'crashed';
  state.crashReason = reason;
  state.sounds.crashSound();
  statusEl.textContent = reason;
}

function landPlane() {
  const p = state.plane;
  const c = state.course;
  const smooth = p.verticalSpeed > -5;
  p.onGround = true;
  p.fuel = 100;
  p.engineOut = false;
  p.throttle = 0;
  state.score += SCORES.landing + (smooth ? SCORES.smoothLanding : 0);
  state.sounds.landingJingle();
  setFlash(
    `LANDED — ${c.runway.name}  +${SCORES.landing + (smooth ? SCORES.smoothLanding : 0)}`,
    '#4ade80',
  );
  const next = c.advance(p);
  state.hasFlown = false;
  if (!next) {
    state.score += SCORES.tourComplete;
    state.mode = 'complete';
    return;
  }
  state.message = next.brief;
  setFlash(`${next.name} — ${next.brief}`, '#7df9ff');
}

function update(dt) {
  const p = state.plane;
  const c = state.course;
  const prevZ = p.z;
  const prevY = p.y;

  if (state.mode === 'title' || state.mode === 'attract') {
    // Autopilot demo flight: chase the next ring, then loop the valley.
    const target = c.nextTarget(p);
    p.update(dt, state.input, target);
    c.checkCrossings(p, prevZ);
    if (p.onGround) {
      // The demo plane rolls on the strip until it is fast and pointed up.
      const ground = state.terrain.groundHeight(p.x, p.z);
      p.y = ground + 4;
      if (p.speed > 80 && target.y > p.y + 150) p.onGround = false;
    }
    if (p.z > c.runway.z + 2200) {
      c.buildMission(0, 0);
      p.reset(60, 1150, 1200);
      p.throttle = 0.72;
      p.speed = 152;
      p.onGround = false;
    }
    keepAboveGround(p);
    return;
  }

  if (state.mode !== 'playing') return;

  p.update(dt, state.input, null);

  // On the ground the plane rolls on the strip; lift off past 80 kt with pull-up.
  if (p.onGround) {
    const ground = state.terrain.groundHeight(p.x, p.z);
    p.y = ground + 4;
    if (p.speed < 30 && p.throttle < 0.05) p.speed = Math.max(0, p.speed - 20 * dt);
    if (p.speed > 80 && state.input.pitchInput() > 0.2) {
      p.onGround = false;
      p.y = ground + 10;
    }
  }

  // Rings crossed this frame.
  for (const ev of c.checkCrossings(p, prevZ)) {
    if (ev.type === 'ring') {
      state.score += SCORES.ring;
      p.fuel = clamp(p.fuel + PLANE.fuelRingBonus, 0, 100);
      state.sounds.ringChime();
      setFlash(`RING!  +${SCORES.ring}`, '#ffd23f');
      state.message =
        c.ringsLeft > 0
          ? `${c.ringsLeft} ring${c.ringsLeft === 1 ? '' : 's'} to go, then land`
          : `All rings done — land on ${c.runway.name}`;
    } else {
      setFlash('RING MISSED', '#ff5a5a');
    }
  }

  // Landing or terrain strike. Contact is y at ground level: a climbing
  // plane just off the strip is not a landing and not a crash.
  const ground = state.terrain.groundHeight(p.x, p.z);
  if (p.y - ground > 200) state.hasFlown = true;
  const overStrip =
    p.z >= c.runway.z - 40 &&
    p.z <= c.runway.z + WORLD.runwayLength &&
    Math.abs(p.x - c.runway.x) <= WORLD.runwayWidth / 2 + 14;
  if (!p.onGround && p.y <= ground + 2) {
    if (overStrip) {
      const verdict = c.checkLanding(p, prevZ);
      if (verdict === 'landed' && state.hasFlown) {
        landPlane();
      } else if (verdict === 'too-fast') {
        crash('TOO FAST — OVERRAN THE STRIP');
      } else if (verdict === 'too-hard') {
        crash('TOO HARD — GEAR COLLAPSED');
      } else {
        // Touching down early on the strip: roll it out.
        p.onGround = true;
        p.y = ground + 4;
      }
    } else {
      crash(p.engineOut ? 'OUT OF FUEL — DITCHED IN THE VALLEY' : 'TERRAIN STRIKE');
    }
  }

  // Keep the plane inside the valley walls.
  if (Math.abs(p.x) > 2600) {
    p.x = Math.sign(p.x) * 2600;
    p.heading = -p.heading * 0.4;
  }
  if (p.y > 4200) {
    p.y = 4200;
    p.pitch = Math.min(p.pitch, 0);
  }
  void prevY;
}

// The attract demo never crashes: nudge it back above the hills.
function keepAboveGround(p) {
  const ground = state.terrain.groundHeight(p.x, p.z);
  if (p.y < ground + 120) p.y = ground + 120;
}

function frame(now) {
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000 || 0.016);
  frame.last = now;
  state.time += dt;
  if (state.flashT > 0) state.flashT -= dt;

  const input = state.input;
  if (input.wasPressed('enter') || input.mouseClicked) {
    state.sounds.ensure();
    if (state.mode === 'title' || state.mode === 'attract') startPlaying();
    else if (state.mode === 'crashed' || state.mode === 'complete') startPlaying();
  }
  if (input.wasPressed('p') && state.mode === 'playing') state.mode = 'paused';
  else if (input.wasPressed('p') && state.mode === 'paused') state.mode = 'playing';
  if (input.wasPressed('r') && (state.mode === 'crashed' || state.mode === 'complete' || state.mode === 'playing')) {
    startPlaying();
  }
  if (input.wasPressed('m')) {
    const muted = state.sounds.toggleMute();
    setFlash(muted ? 'SOUND OFF' : 'SOUND ON', '#7df9ff');
  }

  if (state.mode !== 'paused') update(dt);

  const p = state.plane;
  state.sounds.update(p.throttle, p.speed, !p.onGround && state.mode === 'playing');

  renderScene(ctx, state);
  drawHud(ctx, state);
  if (state.mode === 'title') drawTitle(ctx, state);
  if (state.mode === 'paused') drawPaused(ctx);
  if (state.mode === 'crashed') drawGameOver(ctx, state);
  if (state.mode === 'complete') drawTourComplete(ctx, state);

  input.endFrame();
  requestAnimationFrame(frame);
}

// Stage a screenshot scene when asked, else open on the title demo.
const shot = shotName();
if (shot) {
  applyShot(state, shot);
} else {
  const p = state.plane;
  p.reset(60, 1150, 1200);
  p.throttle = 0.72;
  p.speed = 152;
  p.onGround = false;
}
requestAnimationFrame(frame);
