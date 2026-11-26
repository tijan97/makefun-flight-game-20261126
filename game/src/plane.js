// The Kestrel mail plane: flight physics and the chase-view drawing.
// The plane is a small single-engine bush plane with a high wing, drawn from
// behind so the pilot sees the tail, the spinning prop and the terrain ahead.

import { PLANE } from './config.js';
import { clamp, lerp } from './rng.js';

export class PlaneState {
  constructor() {
    this.reset(0, 0, 0);
  }

  reset(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.heading = 0;      // degrees, 0 = straight down the valley
    this.pitch = 0;        // degrees, positive climbs
    this.bank = 0;         // degrees, positive banks right
    this.speed = 0;        // knots
    this.throttle = 0;     // 0..1
    this.fuel = 100;       // percent
    this.verticalSpeed = 0;
    this.onGround = true;
    this.engineOut = false;
    this.propAngle = 0;
  }

  // Autopilot target: {x, y} world point to steer toward, or null.
  update(dt, input, target) {
    // Throttle: Shift / W raises it, S / Ctrl lowers it, Space brakes.
    if (input.held('shift')) this.throttle = clamp(this.throttle + dt * 0.5, 0, 1);
    if (input.held('control')) this.throttle = clamp(this.throttle - dt * 0.6, 0, 1);
    if (input.held(' ')) this.throttle = clamp(this.throttle - dt * 1.2, 0, 1);
    if (this.engineOut) this.throttle = 0;

    let rollIn = input.rollInput();
    let pitchIn = input.pitchInput();
    if (target) {
      // Autopilot: steer by the bearing to the target, banking in proportion
      // to the heading error so the turn settles instead of slaloming. The
      // bearing uses the true along-track distance, so a target behind the
      // plane makes it turn around and come back.
      let steerX = target.x;
      let steerZ = target.z;
      if (target.runway) {
        // Steer at the touchdown point from far out, then at a point past
        // the strip's far end once committed on final — so crossing the
        // touchdown point does not swing the nose around mid-landing.
        const toTouch = target.touchdownZ - this.z;
        steerZ = toTouch < 500 ? target.z : target.touchdownZ;
        // Glide path to the strip: high and fast far out, low and slow on
        // final, aiming to touch down at the touchdown point. Only passing
        // the strip's far end reads as an overshoot, and then the plane
        // climbs away for another circuit. The pitch gain is firm near the
        // ground so the flare actually meets the runway instead of floating
        // past it.
        const desiredY =
          toTouch > -450
            ? target.ground + Math.max(-4, Math.min(300, toTouch * 0.05))
            : target.ground + 300;
        pitchIn = clamp((desiredY - this.y) / 120, -0.8, 0.8);
        const thrTarget = toTouch < 2500 && toTouch > -450 ? 0.45 : 0.72;
        this.throttle = clamp(this.throttle + (thrTarget - this.throttle) * dt * 0.8, 0, 1);
      } else {
        const dy = target.y - this.y;
        pitchIn = clamp(dy / 500, -0.8, 0.8);
        this.throttle = clamp(this.throttle + (0.72 - this.throttle) * dt * 0.8, 0, 1);
      }
      const dx = steerX - this.x;
      const dz = steerZ - this.z;
      const bearing = (Math.atan2(dx, dz) * 180) / Math.PI;
      const err = ((bearing - this.heading + 540) % 360) - 180;
      rollIn = clamp(err / 25, -1, 1);
    }

    // Bank follows the roll input, then the heading follows the bank.
    // The autopilot banks gently so demo flights look level and calm.
    const bankCap = target ? PLANE.bankMax * 0.45 : PLANE.bankMax;
    const bankTarget = rollIn * bankCap;
    this.bank = lerp(this.bank, bankTarget, Math.min(1, dt * 3.2));
    const turn = (this.bank / PLANE.bankMax) * PLANE.turnRate * (this.speed / 150 + 0.25);
    this.heading += turn * dt;

    // Pitch follows the pitch input; climbing costs speed.
    const pitchTarget = pitchIn * 14;
    this.pitch = lerp(this.pitch, pitchTarget, Math.min(1, dt * 2.6));

    // Speed chases the throttle's target speed, slower when climbing.
    const speedTarget = this.engineOut ? 70 : 40 + this.throttle * (PLANE.maxSpeed - 40);
    const climbPenalty = Math.max(0, this.pitch) * 1.6;
    this.speed = lerp(this.speed, Math.max(PLANE.minSpeed - 25, speedTarget - climbPenalty), Math.min(1, dt * 0.55));

    // Move through the world.
    const k = (this.speed * 1.68781) / 3.2; // knots -> world units per second
    const rad = (this.heading * Math.PI) / 180;
    this.z += Math.cos(rad) * k * dt;
    this.x += Math.sin(rad) * k * dt;

    // Vertical speed from pitch and speed; a stalled wing sinks.
    let vs = Math.sin((this.pitch * Math.PI) / 180) * this.speed * 1.7;
    if (this.speed < PLANE.minSpeed) vs -= (PLANE.minSpeed - this.speed) * 1.4;
    this.verticalSpeed = vs;
    this.y += vs * dt;

    // Fuel burns with throttle; empty tanks stop the engine.
    if (!this.engineOut) {
      this.fuel -= PLANE.fuelBurn * (0.25 + this.throttle) * dt;
      if (this.fuel <= 0) {
        this.fuel = 0;
        this.engineOut = true;
      }
    }

    this.propAngle += dt * (6 + this.throttle * 26 + this.speed * 0.05);
    if (this.y < 0) this.y = 0;
  }

  get flying() {
    return !this.onGround && this.speed > 5;
  }
}

// Draw the plane from behind, centred at (cx, cy), banked by `bank` degrees.
export function drawPlane(ctx, cx, cy, bank, throttle, propAngle, time) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((bank * Math.PI) / 180);
  ctx.scale(1.15, 1.15);

  // Soft shadow blob under the fuselage.
  ctx.fillStyle = 'rgba(10, 20, 35, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 96, 92, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Main wing (high wing, seen from behind).
  ctx.fillStyle = '#e8b23a';
  ctx.strokeStyle = '#7a5510';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-128, -6);
  ctx.quadraticCurveTo(-70, -22, -18, -12);
  ctx.lineTo(18, -12);
  ctx.quadraticCurveTo(70, -22, 128, -6);
  ctx.quadraticCurveTo(70, 6, 18, 2);
  ctx.lineTo(-18, 2);
  ctx.quadraticCurveTo(-70, 6, -128, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Tailplane.
  ctx.fillStyle = '#d94f2b';
  ctx.beginPath();
  ctx.moveTo(-52, 52);
  ctx.lineTo(52, 52);
  ctx.lineTo(34, 66);
  ctx.lineTo(-34, 66);
  ctx.closePath();
  ctx.fill();

  // Fuselage: a warm cream body with a red cheatline.
  const body = ctx.createLinearGradient(0, -30, 0, 70);
  body.addColorStop(0, '#fdf6e3');
  body.addColorStop(0.55, '#f3e3b8');
  body.addColorStop(1, '#d9b96a');
  ctx.fillStyle = body;
  ctx.strokeStyle = '#8a6d2f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-26, -34);
  ctx.quadraticCurveTo(0, -46, 26, -34);
  ctx.quadraticCurveTo(30, 10, 22, 62);
  ctx.quadraticCurveTo(0, 74, -22, 62);
  ctx.quadraticCurveTo(-30, 10, -26, -34);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Red cheatline and mail star.
  ctx.fillStyle = '#d94f2b';
  ctx.fillRect(-25, 18, 50, 7);
  ctx.fillStyle = '#1f4e79';
  ctx.beginPath();
  ctx.arc(0, -8, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(0, -8, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Vertical fin.
  ctx.fillStyle = '#d94f2b';
  ctx.beginPath();
  ctx.moveTo(-8, -30);
  ctx.lineTo(0, -72);
  ctx.lineTo(10, -30);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#7a1f0e';
  ctx.stroke();

  // Spinning prop: a translucent disc with two blade ghosts.
  ctx.save();
  ctx.translate(0, -6);
  ctx.rotate(propAngle);
  ctx.fillStyle = 'rgba(220, 225, 235, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, 46, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#2b2f36';
  ctx.beginPath();
  ctx.arc(0, -6, 7, 0, Math.PI * 2);
  ctx.fill();

  // Navigation lights, blinking with time.
  const blink = Math.sin(time * 6) > 0;
  if (blink) {
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(-128, -6, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#34d17b';
  ctx.beginPath();
  ctx.arc(128, -6, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
