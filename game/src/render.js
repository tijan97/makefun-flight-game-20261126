// The chase-view scene: sky, sun, far ridges, clouds, patchwork fields, the
// winding river, the airstrip, and the glowing target rings — all projected
// from the plane's eye, with the horizon tipping as the plane banks.

import { COLORS } from './config.js';
import { skyGradient } from './terrain.js';
import { drawPlane } from './plane.js';
import { clamp, lerp } from './rng.js';

const FIELD_COLORS = ['#5d8a42', '#7fae56', '#c2a55a', '#2f5d2a'];
const RIDGE_COLORS = ['#6d87a8', '#546e8f'];

export function renderScene(ctx, s) {
  const t = s.terrain;
  const p = s.plane;
  const W = 1280;
  const H = 720;
  const horizonY = 400 + t.horizonOffset(p);
  const eye = { x: p.x, y: p.y + 30, z: p.z, heading: p.heading, pitch: p.pitch };

  ctx.save();
  // The world tips gently with the bank; the HUD stays level.
  ctx.translate(640, horizonY);
  ctx.rotate((p.bank * 0.35 * Math.PI) / 180);
  ctx.translate(-640, -horizonY);

  // Sky.
  ctx.fillStyle = skyGradient(ctx, horizonY);
  ctx.fillRect(-200, -200, W + 400, horizonY + 200);

  // Sun with a warm glow, kept clear of the HUD panels.
  const sunX = 902 - p.heading * 2;
  const sunY = 96;
  const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 120);
  glow.addColorStop(0, 'rgba(255, 236, 180, 0.95)');
  glow.addColorStop(0.35, 'rgba(255, 214, 130, 0.55)');
  glow.addColorStop(1, 'rgba(255, 214, 130, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 130, sunY - 130, 260, 260);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
  ctx.fill();

  // Far mountain ridges, two parallax layers sliding with the heading.
  drawRidge(ctx, t, p.heading, horizonY, 0, 190, RIDGE_COLORS[0]);
  drawRidge(ctx, t, p.heading, horizonY, 1, 110, RIDGE_COLORS[1]);

  // Clouds.
  for (const c of s.clouds) {
    const pr = t.project(c.x, c.y, p.z + 1200 + ((c.z - p.z) % 9000 + 9000) % 9000, eye);
    if (!pr) continue;
    const w = c.s * pr.scale * 1.4;
    if (w < 4) continue;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.ellipse(pr.sx, pr.sy, w, w * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(pr.sx - w * 0.4, pr.sy + w * 0.08, w * 0.55, w * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground base.
  const groundGrad = ctx.createLinearGradient(0, horizonY, 0, H + 200);
  groundGrad.addColorStop(0, '#7ba05c');
  groundGrad.addColorStop(0.4, '#567c3e');
  groundGrad.addColorStop(1, '#3c5c2b');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(-200, horizonY, W + 400, H + 200 - horizonY);

  // Patchwork fields: a perspective grid of coloured ground cells.
  drawFields(ctx, t, eye, horizonY);
  // The river, winding down the valley.
  drawRiver(ctx, t, eye, horizonY);
  // The airstrips, when they are ahead: the departure strip first, then the
  // arrival strip the sortie lands on.
  drawRunway(ctx, t, eye, s.course.departure, horizonY);
  drawRunway(ctx, t, eye, s.course.runway, horizonY);

  // Haze toward the horizon so far ground melts into the sky.
  const haze = ctx.createLinearGradient(0, horizonY, 0, horizonY + 260);
  haze.addColorStop(0, 'rgba(190, 215, 235, 0.55)');
  haze.addColorStop(1, 'rgba(190, 215, 235, 0)');
  ctx.fillStyle = haze;
  ctx.fillRect(-200, horizonY, W + 400, 260);

  // Target rings, nearest last so near rings draw over far ones. A ring almost
  // at the camera is skipped: its projection explodes and reads as a blob.
  const rings = [...s.course.rings].sort((a, b) => b.z - a.z);
  for (const ring of rings) {
    if (ring.z <= p.z + 130 || ring.z > p.z + 5200) continue;
    drawRing(ctx, t, eye, ring, ring === s.course.nextTarget(s.plane));
  }

  ctx.restore();

  // The Kestrel, centre frame, banking with the pilot's input.
  drawPlane(ctx, 640, 478, p.bank, p.throttle, p.propAngle, s.time);
}

function drawRidge(ctx, t, heading, horizonY, layer, amp, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-200, horizonY + 2);
  const off = heading * (layer === 0 ? 9 : 16) + layer * 500;
  for (let sx = -200; sx <= 1480; sx += 40) {
    const n = t.ridgeNoise((sx + off) * 0.004 + layer * 13);
    const y = horizonY - (n * 0.5 + 0.5) * amp - layer * 30;
    ctx.lineTo(sx, y);
  }
  ctx.lineTo(1480, horizonY + 2);
  ctx.closePath();
  ctx.fill();
}

function drawFields(ctx, t, eye, horizonY) {
  const cell = 420;
  const z0 = Math.floor((eye.z + 150) / cell) * cell;
  for (let rz = z0; rz < eye.z + 4600; rz += cell) {
    for (let cx = -1800; cx <= 1800; cx += cell) {
      const gy = t.groundHeight(cx + cell / 2, rz + cell / 2);
      const a = t.project(cx, gy, rz, eye);
      const b = t.project(cx + cell, gy, rz, eye);
      const c = t.project(cx + cell, gy, rz + cell, eye);
      const d = t.project(cx, gy, rz + cell, eye);
      if (!a || !b || !c || !d) continue;
      if (Math.max(a.sy, b.sy, c.sy, d.sy) < horizonY) continue;
      const shade = t.fieldShade(Math.round(cx / cell), Math.round(rz / cell));
      ctx.fillStyle = FIELD_COLORS[shade];
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.lineTo(c.sx, c.sy);
      ctx.lineTo(d.sx, d.sy);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function drawRiver(ctx, t, eye, horizonY) {
  const left = [];
  const right = [];
  for (let rz = eye.z + 120; rz < eye.z + 4600; rz += 160) {
    const cx = t.riverX(rz);
    const gy = t.groundHeight(cx, rz) + 4;
    const a = t.project(cx - 95, gy, rz, eye);
    const b = t.project(cx + 95, gy, rz, eye);
    if (!a || !b) continue;
    left.push([a.sx, a.sy]);
    right.push([b.sx, b.sy]);
  }
  if (left.length < 3) return;
  ctx.fillStyle = COLORS.river;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (const pt of left) ctx.lineTo(pt[0], pt[1]);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawRunway(ctx, t, eye, runway, horizonY) {
  if (!runway) return;
  const z0 = runway.z;
  const z1 = runway.z + 900;
  if (z1 < eye.z + 40 || z0 > eye.z + 5200) return;
  const w = 24;
  const gy = runway.ground + 2;
  // The near edge stays 120 units ahead of the eye: a corner at the 40-unit
  // clip can fall behind the camera when the heading rotates it, and one
  // null corner would drop the whole strip.
  const zNear = Math.max(z0, eye.z + 120);
  const a = t.project(runway.x - w, gy, zNear, eye);
  const b = t.project(runway.x + w, gy, zNear, eye);
  const c = t.project(runway.x + w, gy, z1, eye);
  const d = t.project(runway.x - w, gy, z1, eye);
  if (!a || !b || !c || !d) return;
  ctx.fillStyle = COLORS.runway;
  ctx.beginPath();
  ctx.moveTo(a.sx, a.sy);
  ctx.lineTo(b.sx, b.sy);
  ctx.lineTo(c.sx, c.sy);
  ctx.lineTo(d.sx, d.sy);
  ctx.closePath();
  ctx.fill();
  // Centreline dashes.
  ctx.fillStyle = COLORS.runwayLine;
  for (let rz = Math.max(z0 + 60, eye.z + 60); rz < z1 - 40; rz += 120) {
    const p1 = t.project(runway.x - 2, gy + 1, rz, eye);
    const p2 = t.project(runway.x + 2, gy + 1, rz, eye);
    const p3 = t.project(runway.x + 2, gy + 1, rz + 55, eye);
    const p4 = t.project(runway.x - 2, gy + 1, rz + 55, eye);
    if (!p1 || !p2 || !p3 || !p4) continue;
    ctx.beginPath();
    ctx.moveTo(p1.sx, p1.sy);
    ctx.lineTo(p2.sx, p2.sy);
    ctx.lineTo(p3.sx, p3.sy);
    ctx.lineTo(p4.sx, p4.sy);
    ctx.closePath();
    ctx.fill();
  }
  // Amber edge lights so the strip reads from far out.
  ctx.fillStyle = '#ffb347';
  for (let rz = Math.max(z0 + 40, eye.z + 80); rz < z1 - 20; rz += 150) {
    for (const side of [-w, w]) {
      const pl = t.project(runway.x + side, gy + 1, rz, eye);
      if (!pl) continue;
      ctx.beginPath();
      ctx.arc(pl.sx, pl.sy, Math.max(2, 3.5 * pl.scale), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Strip name board floating beside the threshold, clear of the plane.
  const sign = t.project(runway.x - 90, gy + 90, z0, eye);
  if (sign && sign.sy > 40 && sign.sy < horizonY + 60) {
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(8, 20, 36, 0.7)';
    const tw = ctx.measureText(runway.name).width + 18;
    ctx.fillRect(sign.sx - tw / 2, sign.sy - 18, tw, 24);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(runway.name, sign.sx, sign.sy);
  }
}

function drawRing(ctx, t, eye, ring, isNext) {
  const pr = t.project(ring.x, ring.y, ring.z, eye);
  if (!pr) return;
  const r = Math.min(300, Math.max(3, ring.r * pr.scale));
  const dist = Math.max(0, Math.round((ring.z - eye.z) / 3.28));
  ctx.save();
  ctx.translate(pr.sx, pr.sy);
  const glow = isNext ? 26 : 12;
  ctx.shadowColor = COLORS.ringGlow;
  ctx.shadowBlur = glow;
  ctx.strokeStyle = ring.passed ? '#4ade80' : COLORS.ring;
  ctx.lineWidth = Math.max(3, r * 0.09);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = Math.max(1.5, r * 0.03);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  // Chevron pointing through the hoop.
  ctx.fillStyle = ring.passed ? '#4ade80' : COLORS.ring;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.28);
  ctx.lineTo(r * 0.22, r * 0.12);
  ctx.lineTo(-r * 0.22, r * 0.12);
  ctx.closePath();
  ctx.fill();
  if (isNext && r > 14) {
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${dist} ft`, 0, -r - 10);
  }
  ctx.restore();
}

export { clamp, lerp };
