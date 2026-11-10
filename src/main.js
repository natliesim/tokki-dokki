// Sky Hopper: bounce from cloud to cloud and climb as high as you can.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

const GRAVITY = 0.35;
const JUMP = -10.5;
const SPRING_JUMP = -17;
const MOVE_ACCEL = 0.6;
const MAX_SPEED = 6;
const FRICTION = 0.88;
const PLATFORM_W = 64;
const PLATFORM_H = 14;

const keys = { left: false, right: false };
let touchDir = 0;
let state;
let best = Number(safeGet('skyHopperBest')) || 0;

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

function rand(min, max) { return Math.random() * (max - min) + min; }

function makePlatform(y, height) {
  // Harder platform types appear as you climb.
  const difficulty = Math.min(height / 5000, 1);
  const r = Math.random();
  let type = 'normal';
  if (r < 0.15 * difficulty + 0.05) type = 'moving';
  else if (r < 0.3 * difficulty + 0.08) type = 'fragile';
  return {
    x: rand(0, W - PLATFORM_W),
    y,
    type,
    vx: type === 'moving' ? rand(1, 2.2) * (Math.random() < 0.5 ? -1 : 1) : 0,
    broken: false,
    spring: type === 'normal' && Math.random() < 0.07,
  };
}

function reset() {
  const platforms = [];
  // A safe starting platform under the player.
  platforms.push({ x: W / 2 - PLATFORM_W / 2, y: H - 40, type: 'normal', vx: 0, broken: false, spring: false });
  let y = H - 40;
  while (y > -H) {
    y -= rand(50, 85);
    platforms.push(makePlatform(y, 0));
  }
  state = {
    player: { x: W / 2 - 16, y: H - 80, w: 32, h: 32, vx: 0, vy: JUMP, face: 1, squash: 0 },
    platforms,
    climbed: 0,
    score: 0,
    over: false,
    started: false,
  };
}

function update() {
  const p = state.player;
  if (!state.started || state.over) return;

  // Horizontal movement.
  const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) || touchDir;
  if (dir) { p.vx += dir * MOVE_ACCEL; p.face = dir; }
  else p.vx *= FRICTION;
  p.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, p.vx));
  p.x += p.vx;
  // Wrap around the screen edges.
  if (p.x + p.w < 0) p.x = W;
  if (p.x > W) p.x = -p.w;

  // Vertical movement.
  const prevBottom = p.y + p.h;
  p.vy += GRAVITY;
  p.y += p.vy;
  p.squash *= 0.85;

  // Land on platforms only while falling.
  if (p.vy > 0) {
    for (const pl of state.platforms) {
      if (pl.broken) continue;
      const bottom = p.y + p.h;
      const overlapsX = p.x + p.w - 6 > pl.x && p.x + 6 < pl.x + PLATFORM_W;
      if (overlapsX && prevBottom <= pl.y && bottom >= pl.y) {
        if (pl.type === 'fragile') { pl.broken = true; continue; }
        p.y = pl.y - p.h;
        p.vy = pl.spring ? SPRING_JUMP : JUMP;
        p.squash = 1;
        break;
      }
    }
  }

  // Move platforms.
  for (const pl of state.platforms) {
    if (pl.type === 'moving') {
      pl.x += pl.vx;
      if (pl.x < 0 || pl.x + PLATFORM_W > W) pl.vx *= -1;
    }
    if (pl.broken) pl.y += 6;
  }

  // Scroll the world up when the player climbs past the middle.
  const line = H * 0.4;
  if (p.y < line) {
    const dy = line - p.y;
    p.y = line;
    state.climbed += dy;
    for (const pl of state.platforms) pl.y += dy;
  }
  state.score = Math.floor(state.climbed / 10);

  // Remove platforms that fell off the bottom and add new ones on top.
  state.platforms = state.platforms.filter((pl) => pl.y < H + 40);
  let topY = Math.min(...state.platforms.map((pl) => pl.y));
  const gapMax = 85 + Math.min(state.climbed / 200, 45);
  while (topY > -40) {
    topY -= rand(50, gapMax);
    state.platforms.push(makePlatform(topY, state.climbed));
  }

  if (p.y > H) {
    state.over = true;
    if (state.score > best) { best = state.score; safeSet('skyHopperBest', String(best)); }
  }
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  const shift = Math.min(state.climbed / 20000, 1);
  g.addColorStop(0, `hsl(${215 - shift * 40}, 70%, ${70 - shift * 45}%)`);
  g.addColorStop(1, `hsl(${200 - shift * 30}, 75%, ${88 - shift * 50}%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawPlatform(pl) {
  const colors = { normal: '#ffffff', moving: '#ffd56b', fragile: '#c9a27e' };
  ctx.save();
  ctx.globalAlpha = pl.broken ? 0.5 : 1;
  ctx.fillStyle = colors[pl.type];
  ctx.beginPath();
  ctx.roundRect(pl.x, pl.y, PLATFORM_W, PLATFORM_H, 7);
  ctx.fill();
  if (pl.type === 'fragile') {
    ctx.strokeStyle = '#7a5a3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pl.x + 20, pl.y + 2);
    ctx.lineTo(pl.x + 28, pl.y + 8);
    ctx.lineTo(pl.x + 36, pl.y + 3);
    ctx.stroke();
  }
  if (pl.spring) {
    ctx.fillStyle = '#ff5d73';
    ctx.fillRect(pl.x + PLATFORM_W / 2 - 7, pl.y - 8, 14, 8);
  }
  ctx.restore();
}

function drawPlayer() {
  const p = state.player;
  const sx = 1 + p.squash * 0.25;
  const sy = 1 - p.squash * 0.25;
  const cx = p.x + p.w / 2;
  const by = p.y + p.h;
  ctx.save();
  ctx.translate(cx, by);
  ctx.scale(sx, sy);
  // Body: a round green blob.
  ctx.fillStyle = '#5bd47a';
  ctx.beginPath();
  ctx.ellipse(0, -p.h / 2, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eyes look in the direction of travel.
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-6 + p.face * 3, -p.h / 2 - 4, 5, 0, Math.PI * 2);
  ctx.arc(6 + p.face * 3, -p.h / 2 - 4, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d2433';
  ctx.beginPath();
  ctx.arc(-6 + p.face * 5, -p.h / 2 - 4, 2.2, 0, Math.PI * 2);
  ctx.arc(6 + p.face * 5, -p.h / 2 - 4, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawText(text, y, size, color = '#1d2433') {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(text, W / 2, y);
}

function draw() {
  drawBackground();
  state.platforms.forEach(drawPlatform);
  drawPlayer();

  ctx.fillStyle = '#1d2433';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${state.score}`, 12, 28);
  ctx.textAlign = 'right';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(`Best ${best}`, W - 12, 26);

  if (!state.started) {
    drawText('Sky Hopper', H / 2 - 40, 40);
    drawText('← → or A / D to move', H / 2, 18);
    drawText('Tap left / right side on touch', H / 2 + 26, 16);
    drawText('Press Space or tap to start', H / 2 + 70, 18);
  } else if (state.over) {
    ctx.fillStyle = 'rgba(29, 36, 51, 0.6)';
    ctx.fillRect(0, 0, W, H);
    drawText('Game over', H / 2 - 30, 40, '#fff');
    drawText(`Score ${state.score}   Best ${best}`, H / 2 + 10, 20, '#fff');
    drawText('Space or tap to play again', H / 2 + 50, 18, '#fff');
  }
}

function startOrRestart() {
  if (state.over) reset();
  state.started = true;
}

addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
  if (e.key === ' ') { e.preventDefault(); startOrRestart(); }
});
addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
});

function touchToDir(e) {
  const t = e.touches[0];
  if (!t) return 0;
  const rect = canvas.getBoundingClientRect();
  return t.clientX - rect.left < rect.width / 2 ? -1 : 1;
}
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (!state.started || state.over) startOrRestart();
  touchDir = touchToDir(e);
}, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); touchDir = touchToDir(e); }, { passive: false });
canvas.addEventListener('touchend', (e) => { touchDir = touchToDir(e); });
canvas.addEventListener('mousedown', () => { if (!state.started || state.over) startOrRestart(); });

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

reset();
loop();
