// The heads-up display: altitude, speed and heading on lit instruments, a
// compass strip, an artificial horizon, fuel and throttle gauges, the score
// and the mission brief — plus the title, pause and game-over screens.

import { COLORS } from './config.js';

function panel(ctx, x, y, w, h, r = 10) {
  ctx.fillStyle = COLORS.panel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(125, 249, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function label(ctx, text, x, y, size = 11, color = '#9fd8e8') {
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

function bigValue(ctx, text, x, y, size = 30, color = COLORS.hud) {
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

// Compass strip: tick marks and cardinal letters around the current heading.
// Only +/-75 degrees are shown, so the letters never crowd each other.
export function drawCompass(ctx, heading, cx, y, width = 400) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - width / 2, y - 18, width, 36);
  ctx.clip();
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  for (let d = -55; d <= 55; d += 5) {
    let deg = (Math.round(heading) + d + 360) % 360;
    const px = cx + (d / 55) * (width / 2);
    const major = deg % 45 === 0;
    const mid = deg % 15 === 0;
    ctx.strokeStyle = major ? COLORS.hud : 'rgba(159, 216, 232, 0.5)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(px, y + (major ? -12 : -7));
    ctx.lineTo(px, y + 2);
    ctx.stroke();
    if (major) {
      ctx.fillStyle = COLORS.hud;
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(dirs[Math.round(deg / 45) % 8], px, y + 16);
    } else if (mid) {
      ctx.fillStyle = '#9fd8e8';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(deg).padStart(3, '0'), px, y + 15);
    }
  }
  ctx.restore();
  // Centre lubber line.
  ctx.fillStyle = COLORS.hudAmber;
  ctx.beginPath();
  ctx.moveTo(cx - 6, y - 18);
  ctx.lineTo(cx + 6, y - 18);
  ctx.lineTo(cx, y - 8);
  ctx.closePath();
  ctx.fill();
}

// Artificial horizon: a small dial that tips with bank and pitch.
export function drawHorizon(ctx, x, y, r, bank, pitch) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate((-bank * Math.PI) / 180);
  const off = pitch * 1.6;
  ctx.fillStyle = '#3f7ec2';
  ctx.fillRect(-r, -r + off - r, r * 2, r * 2);
  ctx.fillStyle = '#8a6b3f';
  ctx.fillRect(-r, off, r * 2, r * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, off);
  ctx.lineTo(r, off);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = COLORS.hud;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  // Fixed wings marker.
  ctx.fillStyle = COLORS.hudAmber;
  ctx.beginPath();
  ctx.moveTo(x - 4, y);
  ctx.lineTo(x + 4, y);
  ctx.lineTo(x, y + 6);
  ctx.closePath();
  ctx.fill();
}

export function drawHud(ctx, s) {
  const p = s.plane;
  const m = s.course.mission();

  // Top-left instrument cluster.
  panel(ctx, 16, 14, 300, 96);
  label(ctx, 'ALTITUDE  FT', 30, 34);
  bigValue(ctx, String(Math.round(p.y)).padStart(5, '0'), 30, 68);
  label(ctx, 'SPEED  KT', 178, 34);
  const spdColor = p.speed < 60 ? COLORS.hudRed : COLORS.hud;
  bigValue(ctx, String(Math.round(p.speed)).padStart(3, '0'), 178, 68, 30, spdColor);

  // Heading + compass, top centre.
  panel(ctx, 440, 14, 400, 96);
  label(ctx, 'HEADING', 456, 34);
  bigValue(ctx, String(Math.round(((p.heading % 360) + 360) % 360)).padStart(3, '0') + '°', 456, 68);
  drawCompass(ctx, p.heading, 660, 78, 300);

  // Score, rings and mission, top right.
  panel(ctx, 964, 14, 300, 96);
  label(ctx, 'SCORE', 978, 34);
  bigValue(ctx, String(s.score), 978, 68, 30, COLORS.hudAmber);
  label(ctx, `RINGS  ${s.course.passed}/${m.rings}   ${m.runwayName}`, 1080, 34, 11, '#9fd8e8');
  label(ctx, m.name, 1080, 56, 11, '#e8f6ff');
  label(ctx, s.message, 1080, 80, 12, COLORS.hudAmber);

  // Artificial horizon, bottom left.
  panel(ctx, 16, 600, 150, 104);
  label(ctx, 'ATTITUDE', 30, 620);
  drawHorizon(ctx, 91, 656, 34, p.bank, p.pitch);

  // Fuel + throttle, bottom right.
  panel(ctx, 964, 600, 300, 104);
  label(ctx, 'FUEL', 978, 620);
  const fuelW = 150;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(978, 630, fuelW, 14);
  ctx.fillStyle = p.fuel < 25 ? COLORS.hudRed : p.fuel < 50 ? COLORS.hudAmber : '#4ade80';
  ctx.fillRect(978, 630, fuelW * (p.fuel / 100), 14);
  label(ctx, `${Math.round(p.fuel)}%${p.engineOut ? ' — ENGINE OUT' : ''}`, 1140, 644, 12, p.fuel < 25 ? COLORS.hudRed : '#e8f6ff');
  label(ctx, 'THROTTLE', 978, 672);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(978, 680, fuelW, 14);
  ctx.fillStyle = COLORS.hud;
  ctx.fillRect(978, 680, fuelW * p.throttle, 14);
  label(ctx, `${Math.round(p.throttle * 100)}%`, 1140, 694, 12, '#e8f6ff');

  // Centre flash message (ring scored, warning, landing).
  if (s.flash && s.flashT > 0) {
    ctx.font = '700 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = s.flashColor;
    ctx.shadowColor = s.flashColor;
    ctx.shadowBlur = 16;
    ctx.fillText(s.flash, 640, 170);
    ctx.shadowBlur = 0;
  }

  // Low-altitude warning.
  const ground = s.terrain.groundHeight(p.x, p.z);
  if (p.y - ground < 180 && p.y - ground > 0 && s.mode === 'playing') {
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.hudRed;
    ctx.fillText('⚠ PULL UP — TERRAIN', 640, 210);
  }

  // Controls hint, bottom centre.
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(232, 246, 255, 0.75)';
  ctx.fillText('← → / A D steer   ↑ ↓ / W S climb & descend   SHIFT throttle   SPACE brake   P pause   M mute', 640, 706);
}

export function drawTitle(ctx, s) {
  ctx.fillStyle = 'rgba(6, 14, 28, 0.55)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = '700 64px system-ui, sans-serif';
  ctx.shadowColor = '#ff9d00';
  ctx.shadowBlur = 24;
  ctx.fillText('SKY COURIER', 640, 190);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#7df9ff';
  ctx.font = '700 40px system-ui, sans-serif';
  ctx.fillText('— RIDGE RUN —', 640, 244);
  ctx.fillStyle = '#e8f6ff';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('Fly the mail plane through the rings and land on the mountain strips.', 640, 300);
  ctx.fillText('Three sorties. One valley. Don\'t run out of fuel over the ridge.', 640, 332);
  ctx.fillStyle = '#9fd8e8';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('Arrows / WASD — steer & climb      SHIFT — throttle      SPACE — brake', 640, 400);
  ctx.fillText('Mouse — hold to steer toward the cursor      P — pause      M — mute', 640, 428);
  ctx.fillStyle = '#ffd23f';
  ctx.font = '700 26px system-ui, sans-serif';
  const blink = Math.sin(s.time * 4) > -0.2;
  if (blink) ctx.fillText('PRESS ENTER OR CLICK TO FLY', 640, 500);
  ctx.fillStyle = '#9fd8e8';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('SORTIE 1 Ring Run  ·  SORTIE 2 River Delivery  ·  SORTIE 3 Ridge Crossing', 640, 560);
}

export function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(6, 14, 28, 0.6)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8f6ff';
  ctx.font = '700 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', 640, 340);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Press P to keep flying', 640, 384);
}

export function drawGameOver(ctx, s) {
  ctx.fillStyle = 'rgba(20, 6, 6, 0.6)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a5a';
  ctx.font = '700 52px system-ui, sans-serif';
  ctx.fillText(s.crashReason || 'CRASHED', 640, 300);
  ctx.fillStyle = '#e8f6ff';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText(`Score ${s.score}   ·   Rings ${s.course.passed}   ·   Distance ${Math.round(s.plane.z / 100) / 10} km`, 640, 356);
  ctx.fillStyle = '#ffd23f';
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.fillText('PRESS R TO FLY AGAIN', 640, 420);
}

export function drawTourComplete(ctx, s) {
  ctx.fillStyle = 'rgba(6, 20, 10, 0.55)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#4ade80';
  ctx.font = '700 52px system-ui, sans-serif';
  ctx.fillText('TOUR COMPLETE!', 640, 300);
  ctx.fillStyle = '#e8f6ff';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('All three sorties flown. The valley mail is delivered.', 640, 352);
  ctx.fillText(`Final score ${s.score}   ·   Rings ${s.course.passed}`, 640, 388);
  ctx.fillStyle = '#ffd23f';
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.fillText('PRESS R TO FLY THE TOUR AGAIN', 640, 440);
}
