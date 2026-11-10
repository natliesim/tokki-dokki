// Sky Hopper: a doodled bunny hops up the pages of a notebook.

const W = 400;
const H = 600;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const dpr = Math.min(window.devicePixelRatio || 1, 3);
canvas.width = W * dpr;
canvas.height = H * dpr;

// Physics (tuned for 60 steps per second).
const STEP = 1 / 60;
const GRAVITY = 0.35;
const JUMP = -10.5;
const MENU_JUMP = -7.5;
const SPRING_JUMP = -17;
const MOVE_ACCEL = 0.6;
const MAX_SPEED = 6;
const FRICTION = 0.88;
const PLATFORM_W = 64;
const PLATFORM_H = 14;
const START_Y = H - 40;

// Notebook palette.
const PAPER = '#fbf8ef';
const GRID = 'rgba(70, 130, 210, 0.16)';
const PENCIL = '#3a3a48';
const BLUE_PEN = '#2f5bd3';
const RED_PEN = '#e04a4a';
const HIGHLIGHT = 'rgba(255, 222, 40, 0.6)';
const PINK = '#f6a5bf';
const FONT = '"Patrick Hand", "Comic Sans MS", cursive';
const MARGIN_X = 36;

// ---------- small helpers ----------

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } }
function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function easeOutBack(t) { const c = 1.6; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; }

// Seeded random, so each doodle wobbles the same way until the next "boil" frame.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let boil = 0; // changes ~8 times a second for a hand-animated wobble
function pen(seed) { return rng(seed * 7919 + boil * 104729); }
function jit(r, a) { return (r() - 0.5) * 2 * a; }

// ---------- hand-drawn drawing ----------

function sketchLine(x1, y1, x2, y2, r, wob = 1.2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const sx = x1 - ux * 2 * r() + jit(r, wob), sy = y1 - uy * 2 * r() + jit(r, wob);
  const ex = x2 + ux * 2 * r() + jit(r, wob), ey = y2 + uy * 2 * r() + jit(r, wob);
  const mx = (sx + ex) / 2 + jit(r, wob * 1.4), my = (sy + ey) / 2 + jit(r, wob * 1.4);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(mx, my, ex, ey);
  ctx.stroke();
}

function sketchRect(x, y, w, h, r, wob = 1.2) {
  sketchLine(x, y, x + w, y, r, wob);
  sketchLine(x + w, y, x + w, y + h, r, wob);
  sketchLine(x + w, y + h, x, y + h, r, wob);
  sketchLine(x, y + h, x, y, r, wob);
}

function sketchEllipse(cx, cy, rx, ry, r, wob = 0.8, rot = 0) {
  const n = 26;
  const start = r() * Math.PI * 2;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  ctx.beginPath();
  for (let i = 0; i <= n * 1.1; i++) {
    const a = start + (i / n) * Math.PI * 2;
    const px = Math.cos(a) * (rx + jit(r, wob));
    const py = Math.sin(a) * (ry + jit(r, wob));
    const X = cx + px * cos - py * sin;
    const Y = cy + px * sin + py * cos;
    if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
  }
  ctx.stroke();
}

function fillEllipse(cx, cy, rx, ry, color, rot = 0) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}

function hatch(x, y, w, h, r, gap = 5, color = PENCIL) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let i = -h; i < w; i += gap) sketchLine(x + i, y + h, x + i + h, y, r, 0.6);
  ctx.restore();
}

function hand(text, x, y, size, color = PENCIL, align = 'center', rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function star(x, y, size, r, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI + r() * 0.3;
    sketchLine(x - Math.cos(a) * size, y - Math.sin(a) * size, x + Math.cos(a) * size, y + Math.sin(a) * size, r, 0.5);
  }
}

// ---------- sound (generated, no files) ----------

const audio = { ctx: null, muted: safeGet('skyHopperMuted') === '1' };

function ensureAudio() {
  if (!audio.ctx) {
    try { audio.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  }
  if (audio.ctx.state === 'suspended') audio.ctx.resume();
}

function tone({ freq, to, dur, type = 'sine', vol = 0.12, delay = 0 }) {
  if (audio.muted || !audio.ctx) return;
  const t = audio.ctx.currentTime + delay;
  const o = audio.ctx.createOscillator();
  const g = audio.ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(audio.ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function crunch(dur = 0.16, vol = 0.18) {
  if (audio.muted || !audio.ctx) return;
  const ac = audio.ctx;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const g = ac.createGain();
  src.buffer = buf;
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  g.gain.value = vol;
  src.connect(filter).connect(g).connect(ac.destination);
  src.start();
}

const sfx = {
  jump: () => tone({ freq: 320, to: 640, dur: 0.12, type: 'triangle' }),
  spring: () => {
    tone({ freq: 180, to: 950, dur: 0.38, type: 'sine', vol: 0.18 });
    tone({ freq: 360, to: 1300, dur: 0.3, type: 'triangle', vol: 0.05, delay: 0.03 });
  },
  break: () => crunch(),
  over: () => [440, 370, 311, 247].forEach((f, i) => tone({ freq: f, dur: 0.2, type: 'triangle', delay: i * 0.14 })),
  best: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.16, type: 'square', vol: 0.05, delay: 0.65 + i * 0.1 })),
  click: () => tone({ freq: 700, to: 450, dur: 0.06, type: 'square', vol: 0.05 }),
};

function toggleMute() {
  audio.muted = !audio.muted;
  safeSet('skyHopperMuted', audio.muted ? '1' : '0');
  sfx.click();
}

// ---------- game state ----------

const keys = { left: false, right: false };
let pointerDir = 0;
let activePointer = null;
let best = Number(safeGet('skyHopperBest')) || 0;
let state;

function makePlatform(y, climbed) {
  // Trickier platforms show up as you climb.
  const difficulty = Math.min(climbed / 5000, 1);
  const roll = Math.random();
  let type = 'normal';
  if (roll < 0.15 * difficulty + 0.05) type = 'moving';
  else if (roll < 0.3 * difficulty + 0.08) type = 'fragile';
  return {
    x: rand(MARGIN_X - 10, W - PLATFORM_W - 4),
    y,
    type,
    vx: type === 'moving' ? rand(1, 2.2) * (Math.random() < 0.5 ? -1 : 1) : 0,
    spring: type === 'normal' && Math.random() < 0.07,
    springT: 0,
    broken: false,
    fallVy: 0,
    spread: 0,
    seed: (Math.random() * 1e9) | 0,
  };
}

function reset(mode) {
  const platforms = [{
    x: W / 2 - PLATFORM_W / 2, y: START_Y, type: 'normal', vx: 0, spring: false, springT: 0,
    broken: false, fallVy: 0, spread: 0, seed: 1,
  }];
  let y = START_Y;
  while (y > -H) {
    y -= rand(50, 85);
    platforms.push(makePlatform(y, 0));
  }
  state = {
    mode, // 'menu' | 'play' | 'over'
    player: { x: W / 2 - 15, y: START_Y - 30, w: 30, h: 30, vx: 0, vy: 0, face: 1, squash: 0 },
    platforms,
    particles: [],
    climbed: 0,
    score: 0,
    shake: 0,
    overT: 0,
    newBest: false,
    buttons: [],
    time: 0,
    reveal: mode === 'menu' ? 0 : 1,
  };
}

function startGame() {
  ensureAudio();
  sfx.click();
  if (state.mode === 'over') reset('play');
  state.mode = 'play';
}

// ---------- effects ----------

function dust(x, y) {
  for (let i = 0; i < 6; i++) {
    state.particles.push({
      kind: 'dust', x: x + rand(-14, 14), y, vx: rand(-1.5, 1.5), vy: rand(-1.8, -0.4),
      life: 0, max: rand(0.3, 0.5), rot: rand(0, Math.PI), seed: (Math.random() * 1e6) | 0,
    });
  }
}

function boing(x, y) {
  for (let i = 0; i < 5; i++) {
    state.particles.push({
      kind: 'star', x, y, vx: rand(-3, 3), vy: rand(-4, -1),
      life: 0, max: rand(0.5, 0.8), rot: 0, seed: (Math.random() * 1e6) | 0,
    });
  }
  state.particles.push({ kind: 'text', text: 'boing!', x, y: y - 20, vx: 0, vy: -1, life: 0, max: 0.8, rot: rand(-0.2, 0.2), seed: 0 });
  state.shake = 7;
}

// ---------- update ----------

function update() {
  state.time += STEP;
  const p = state.player;

  for (const pt of state.particles) {
    pt.life += STEP;
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.vy += pt.kind === 'text' ? 0 : 0.15;
  }
  state.particles = state.particles.filter((pt) => pt.life < pt.max);
  state.shake *= 0.85;
  if (state.mode !== 'menu') state.reveal = Math.min(1, state.reveal + STEP * 4);

  if (state.mode === 'over') { state.overT += STEP; return; }

  const playing = state.mode === 'play';

  // Steering.
  const dir = playing ? ((keys.right ? 1 : 0) - (keys.left ? 1 : 0) || pointerDir) : 0;
  if (dir) { p.vx += dir * MOVE_ACCEL; p.face = dir; } else p.vx *= FRICTION;
  p.vx = clamp(p.vx, -MAX_SPEED, MAX_SPEED);
  p.x += p.vx;
  if (p.x + p.w < 0) p.x = W;
  if (p.x > W) p.x = -p.w;

  // Falling and landing (only while moving down).
  const prevBottom = p.y + p.h;
  p.vy += GRAVITY;
  p.y += p.vy;
  p.squash *= 0.85;
  if (p.vy > 0) {
    for (const pl of state.platforms) {
      if (pl.broken) continue;
      const overlapsX = p.x + p.w - 6 > pl.x && p.x + 6 < pl.x + PLATFORM_W;
      if (overlapsX && prevBottom <= pl.y && p.y + p.h >= pl.y) {
        if (pl.type === 'fragile') {
          pl.broken = true;
          if (playing) { sfx.break(); state.shake = 3; }
          continue;
        }
        p.y = pl.y - p.h;
        p.squash = 1;
        if (!playing) { p.vy = MENU_JUMP; break; }
        if (pl.spring) {
          p.vy = SPRING_JUMP;
          pl.springT = 1;
          sfx.spring();
          boing(p.x + p.w / 2, pl.y);
        } else {
          p.vy = JUMP;
          sfx.jump();
          dust(p.x + p.w / 2, pl.y);
        }
        break;
      }
    }
  }

  for (const pl of state.platforms) {
    if (pl.type === 'moving' && !pl.broken) {
      pl.x += pl.vx;
      if (pl.x < MARGIN_X - 10 || pl.x + PLATFORM_W > W - 4) pl.vx *= -1;
    }
    if (pl.broken) { pl.fallVy += 0.4; pl.y += pl.fallVy; pl.spread += 0.05; }
    pl.springT *= 0.85;
  }

  // Scroll the page as the bunny climbs.
  const line = H * 0.4;
  if (p.y < line) {
    const dy = line - p.y;
    p.y = line;
    state.climbed += dy;
    for (const pl of state.platforms) pl.y += dy;
    for (const pt of state.particles) pt.y += dy;
  }
  state.score = Math.floor(state.climbed / 10);

  state.platforms = state.platforms.filter((pl) => pl.y < H + 60);
  let topY = Math.min(...state.platforms.map((pl) => pl.y));
  const gapMax = 85 + Math.min(state.climbed / 200, 45);
  while (topY > -40) {
    topY -= rand(50, gapMax);
    state.platforms.push(makePlatform(topY, state.climbed));
  }

  if (p.y > H + 20) {
    state.mode = 'over';
    state.overT = 0;
    state.shake = 10;
    sfx.over();
    if (state.score > best) {
      state.newBest = best > 0;
      best = state.score;
      safeSet('skyHopperBest', String(best));
      if (state.newBest) sfx.best();
    }
  }
}

// ---------- drawing ----------

function scoreToScreenY(score) { return START_Y - (score * 10 - state.climbed); }

function drawPaper() {
  ctx.fillStyle = PAPER;
  ctx.fillRect(-20, -20, W + 40, H + 40);

  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  const g = 22;
  for (let y = (state.climbed % g) - g; y < H + g; y += g) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (let x = g; x < W; x += g) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }

  // Red margin line.
  ctx.strokeStyle = 'rgba(224, 74, 74, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(MARGIN_X, 0); ctx.lineTo(MARGIN_X, H); ctx.stroke();

  // Height notes in the margin every 100 points.
  const lowest = Math.ceil((state.climbed + START_Y - H) / 1000) * 100;
  for (let s = Math.max(100, lowest); scoreToScreenY(s) > -10; s += 100) {
    const y = scoreToScreenY(s);
    const r = pen(s);
    ctx.strokeStyle = 'rgba(224, 74, 74, 0.7)';
    ctx.lineWidth = 1;
    sketchLine(MARGIN_X - 6, y, MARGIN_X + 6, y, r, 0.5);
    hand(String(s), MARGIN_X - 8, y - 8, 12, 'rgba(224, 74, 74, 0.8)', 'right');
  }

  // Dashed line marking your best height.
  if (best > 0 && state.mode !== 'menu') {
    const y = scoreToScreenY(best);
    if (y > -10 && y < H + 10) {
      ctx.save();
      ctx.strokeStyle = 'rgba(224, 74, 74, 0.55)';
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(MARGIN_X, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.restore();
      hand('best', W - 8, y - 10, 15, RED_PEN, 'right');
    }
  }
}

function drawPlatformShape(x, y, w, type, spring, springT, seed) {
  const r = pen(seed);
  const h = PLATFORM_H;
  ctx.lineCap = 'round';

  if (type === 'moving') {
    ctx.fillStyle = HIGHLIGHT;
    ctx.fillRect(x - 3, y - 1, w + 6, h + 2);
  } else {
    ctx.fillStyle = PAPER;
    ctx.fillRect(x, y, w, h);
  }

  if (type === 'fragile') {
    ctx.strokeStyle = '#8a6a4a';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([6, 5]);
    sketchRect(x, y, w, h, r, 0.8);
    ctx.setLineDash([]);
    ctx.lineWidth = 1.4;
    sketchLine(x + w * 0.35, y + 1, x + w * 0.45, y + h * 0.6, r, 0.4);
    sketchLine(x + w * 0.45, y + h * 0.6, x + w * 0.55, y + 2, r, 0.4);
  } else {
    ctx.strokeStyle = PENCIL;
    ctx.lineWidth = 1.8;
    sketchRect(x, y, w, h, r, 1);
    if (type === 'normal') hatch(x + 2, y + h * 0.55, w - 4, h * 0.45, r, 5, 'rgba(58, 58, 72, 0.5)');
    if (type === 'moving') {
      ctx.lineWidth = 1.3;
      const cy = y + h / 2;
      sketchLine(x + w / 2 - 10, cy, x + w / 2 + 10, cy, r, 0.3);
      sketchLine(x + w / 2 - 10, cy, x + w / 2 - 6, cy - 3, r, 0.3);
      sketchLine(x + w / 2 - 10, cy, x + w / 2 - 6, cy + 3, r, 0.3);
      sketchLine(x + w / 2 + 10, cy, x + w / 2 + 6, cy - 3, r, 0.3);
      sketchLine(x + w / 2 + 10, cy, x + w / 2 + 6, cy + 3, r, 0.3);
    }
  }

  if (spring) {
    const sx = x + w / 2;
    const top = y - 12 + springT * 6;
    const coils = 3;
    const ch = (y - top) / (coils * 2);
    ctx.strokeStyle = RED_PEN;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, y);
    for (let i = 1; i <= coils * 2; i++) ctx.lineTo(sx + (i % 2 ? 5 : -5) + jit(r, 0.4), y - i * ch);
    ctx.stroke();
    ctx.lineWidth = 2.4;
    sketchLine(sx - 8, top, sx + 8, top, r, 0.3);
  }
}

function drawPlatform(pl) {
  if (pl.seed !== 1 && state.reveal < 1) {
    ctx.save();
    ctx.globalAlpha = 0.12 + state.reveal * 0.88;
    drawPlatformBody(pl);
    ctx.restore();
    return;
  }
  drawPlatformBody(pl);
}

function drawPlatformBody(pl) {
  if (!pl.broken) {
    drawPlatformShape(pl.x, pl.y, PLATFORM_W, pl.type, pl.spring, pl.springT, pl.seed);
    return;
  }
  // A broken ledge splits in two and tumbles away.
  const half = PLATFORM_W / 2;
  ctx.save();
  ctx.globalAlpha = clamp(1 - pl.fallVy / 12, 0, 1);
  for (const side of [-1, 1]) {
    ctx.save();
    const cx = pl.x + half + side * (half / 2 + pl.spread * 20);
    ctx.translate(cx, pl.y + PLATFORM_H / 2);
    ctx.rotate(side * pl.spread);
    drawPlatformShape(-half / 2, -PLATFORM_H / 2, half, 'fragile', false, 0, pl.seed + side);
    ctx.restore();
  }
  ctx.restore();
}

function drawBunny(p, seed) {
  const r = pen(seed);
  const cx = p.x + p.w / 2;
  const by = p.y + p.h;
  const f = p.face;
  ctx.save();
  ctx.translate(cx, by);
  ctx.scale(1 + p.squash * 0.22, 1 - p.squash * 0.22);
  ctx.strokeStyle = PENCIL;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Ears fan out when rising and fold in when falling.
  const spread = 0.22 + clamp(-p.vy * 0.03, -0.15, 0.3);
  for (const side of [-1, 1]) {
    const ang = -Math.PI / 2 + side * spread + f * 0.06;
    const len = 24;
    const bx = side * 6, byy = -24;
    const ex = bx + Math.cos(ang) * len / 2;
    const ey = byy + Math.sin(ang) * len / 2;
    fillEllipse(ex, ey, len / 2, 6, '#fff', ang);
    fillEllipse(ex, ey, len / 2 - 4, 2.6, PINK, ang);
    sketchEllipse(ex, ey, len / 2, 6, r, 0.5, ang);
  }

  // Cotton tail behind the body.
  fillEllipse(-f * 14, -9, 5.5, 5.5, '#fff');
  sketchEllipse(-f * 14, -9, 5.5, 5.5, r, 0.8);

  // Body.
  fillEllipse(0, -15, 15, 14, '#fff');
  sketchEllipse(0, -15, 15, 14, r, 0.7);

  // Feet.
  for (const side of [-1, 1]) {
    fillEllipse(side * 7, -2, 6, 3.5, '#fff');
    sketchEllipse(side * 7, -2, 6, 3.5, r, 0.4);
  }

  // Face looks the way the bunny is heading.
  const fx = f * 3;
  for (const side of [-1, 1]) {
    fillEllipse(fx + side * 5.5, -18, 2.2, 3, PENCIL);
    fillEllipse(fx + side * 5.5 + 0.8, -19.2, 0.8, 0.8, '#fff');
    ctx.globalAlpha = 0.6;
    fillEllipse(fx + side * 9.5, -12, 3, 2, PINK);
    ctx.globalAlpha = 1;
  }
  fillEllipse(fx, -14.5, 1.6, 1.1, '#e0708f');
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(fx - 2.5, -12.5);
  ctx.quadraticCurveTo(fx - 1.2, -10.8, fx, -12.5);
  ctx.quadraticCurveTo(fx + 1.2, -10.8, fx + 2.5, -12.5);
  ctx.stroke();
  ctx.restore();
}

function drawParticles() {
  for (const pt of state.particles) {
    const t = pt.life / pt.max;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    const r = pen(pt.seed);
    if (pt.kind === 'dust') {
      ctx.strokeStyle = PENCIL;
      ctx.lineWidth = 1.2;
      const l = 4;
      sketchLine(pt.x - Math.cos(pt.rot) * l, pt.y - Math.sin(pt.rot) * l, pt.x + Math.cos(pt.rot) * l, pt.y + Math.sin(pt.rot) * l, r, 0.3);
    } else if (pt.kind === 'star') {
      star(pt.x, pt.y, 5, r, RED_PEN);
    } else if (pt.kind === 'text') {
      hand(pt.text, pt.x, pt.y, 22, RED_PEN, 'center', pt.rot);
    }
    ctx.restore();
  }
}

function button(label, x, y, w, h, action, seed) {
  const r = pen(seed);
  ctx.fillStyle = HIGHLIGHT;
  ctx.fillRect(x + 4, y + h * 0.3, w - 8, h * 0.55);
  ctx.strokeStyle = PENCIL;
  ctx.lineWidth = 2;
  sketchRect(x, y, w, h, r, 1.4);
  hand(label, x + w / 2, y + h / 2 + 1, 28);
  state.buttons.push({ x, y, w, h, action });
}

function drawMuteButton() {
  const x = W - 42, y = 10, w = 32, h = 28;
  const r = pen(77);
  ctx.strokeStyle = PENCIL;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  // Speaker.
  sketchLine(x + 6, y + 11, x + 11, y + 11, r, 0.3);
  sketchLine(x + 11, y + 11, x + 17, y + 5, r, 0.3);
  sketchLine(x + 17, y + 5, x + 17, y + 23, r, 0.3);
  sketchLine(x + 17, y + 23, x + 11, y + 17, r, 0.3);
  sketchLine(x + 11, y + 17, x + 6, y + 17, r, 0.3);
  sketchLine(x + 6, y + 17, x + 6, y + 11, r, 0.3);
  if (audio.muted) {
    ctx.strokeStyle = RED_PEN;
    sketchLine(x + 21, y + 9, x + 29, y + 19, r, 0.4);
    sketchLine(x + 29, y + 9, x + 21, y + 19, r, 0.4);
  } else {
    ctx.beginPath(); ctx.arc(x + 18, y + 14, 6, -0.8, 0.8); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 18, y + 14, 11, -0.8, 0.8); ctx.stroke();
  }
  state.buttons.push({ x: x - 6, y: y - 6, w: w + 12, h: h + 12, action: toggleMute });
}

function drawMenu() {
  const r = pen(3);
  hand('Sky Hopper', W / 2 + 6, 100, 64, BLUE_PEN, 'center', -0.04);
  ctx.strokeStyle = BLUE_PEN;
  ctx.lineWidth = 2.5;
  sketchLine(W / 2 - 110, 136, W / 2 + 120, 128, r, 1.5);
  sketchLine(W / 2 - 96, 141, W / 2 + 100, 134, r, 1.5);
  hand('a doodle bunny hops up the page', W / 2 + 6, 162, 20);

  const rows = [
    ['normal', false, 'solid ledge, safe to land'],
    ['moving', false, 'highlighted ledges slide'],
    ['fragile', false, 'dashed ledges break!'],
    ['normal', true, 'springs go boing'],
  ];
  rows.forEach(([type, spring, text], i) => {
    const y = 194 + i * 32 + (spring ? 6 : 0);
    drawPlatformShape(78, y, 44, type, spring, 0, 10 + i);
    hand(text, 136, y + 7, 19, PENCIL, 'left');
  });

  hand('← → or A / D  ·  tap the sides on a phone', W / 2 + 6, 334, 17, 'rgba(58,58,72,0.85)');
  button('Play', W / 2 - 64, 352, 140, 48, startGame, 5);
}

function drawHud() {
  hand(String(state.score), MARGIN_X + 10, 28, 34, PENCIL, 'left');
  if (best > 0) hand(`best ${best}`, MARGIN_X + 12, 56, 17, RED_PEN, 'left');
}

function drawGameOver() {
  const t = clamp(state.overT / 0.45, 0, 1);
  const slide = (1 - easeOutBack(t)) * H * 0.7;
  const cw = 300, ch = 300;
  const cx = (W - cw) / 2 + 4, cy = 140 + slide;
  const r = pen(9);

  ctx.fillStyle = 'rgba(120, 100, 60, 0.12)';
  ctx.fillRect(0, 0, W, H);

  // A sticky note taped to the page.
  ctx.save();
  ctx.translate(cx + cw / 2, cy + ch / 2);
  ctx.rotate(-0.025);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(-cw / 2 + 5, -ch / 2 + 7, cw, ch);
  ctx.fillStyle = '#fff7c9';
  ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
  ctx.strokeStyle = PENCIL;
  ctx.lineWidth = 1.6;
  sketchRect(-cw / 2, -ch / 2, cw, ch, r, 1.2);
  ctx.fillStyle = 'rgba(210, 200, 170, 0.7)';
  ctx.rotate(0.06);
  ctx.fillRect(-45, -ch / 2 - 12, 90, 24);
  ctx.restore();

  hand('Game over', W / 2 + 4, cy + 52, 50, PENCIL, 'center', -0.03);
  hand('you climbed', W / 2 + 4, cy + 100, 20);
  hand(String(state.score), W / 2 + 4, cy + 142, 60, BLUE_PEN);
  hand(`best: ${best}`, W / 2 + 4, cy + 188, 22, RED_PEN);

  if (state.newBest) {
    const pt = clamp((state.overT - 0.5) / 0.3, 0, 1);
    if (pt > 0) {
      const s = easeOutBack(pt);
      ctx.save();
      ctx.translate(cx + cw - 54, cy + 128);
      ctx.rotate(-0.25);
      ctx.scale(s, s);
      ctx.strokeStyle = RED_PEN;
      ctx.lineWidth = 2.4;
      sketchEllipse(0, 0, 44, 22, pen(21), 1.5);
      hand('NEW BEST!', 0, 1, 20, RED_PEN);
      ctx.restore();
    }
  }

  if (t >= 1) button('Play again', W / 2 - 86, cy + 220, 180, 50, startGame, 6);
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.buttons = [];
  ctx.save();
  if (state.shake > 0.3) ctx.translate(rand(-state.shake, state.shake), rand(-state.shake, state.shake));
  drawPaper();
  state.platforms.forEach(drawPlatform);
  drawParticles();
  drawBunny(state.player, 42);
  ctx.restore();

  if (state.mode === 'menu') drawMenu();
  if (state.mode === 'play') drawHud();
  if (state.mode === 'over') drawGameOver();
  drawMuteButton();
}

// ---------- input ----------

addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
  if (e.key === 'm') { ensureAudio(); toggleMute(); }
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    if (state.mode === 'menu' || (state.mode === 'over' && state.overT > 0.45)) startGame();
  }
});
addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
});

function toGame(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  ensureAudio();
  const pt = toGame(e);
  const hit = state.buttons.find((b) => pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h);
  if (hit) { hit.action(); return; }
  if (state.mode === 'menu') { startGame(); return; }
  if (state.mode === 'play') {
    activePointer = e.pointerId;
    pointerDir = pt.x < W / 2 ? -1 : 1;
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId === activePointer) pointerDir = toGame(e).x < W / 2 ? -1 : 1;
});
for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
  canvas.addEventListener(type, (e) => {
    if (e.pointerId === activePointer) { activePointer = null; pointerDir = 0; }
  });
}

// ---------- main loop ----------

let last = performance.now();
let acc = 0;
function loop(now) {
  acc += Math.min((now - last) / 1000, 0.1);
  last = now;
  while (acc >= STEP) { update(); acc -= STEP; }
  boil = Math.floor(now / 130);
  draw();
  requestAnimationFrame(loop);
}

reset('menu');
document.fonts?.load(`20px ${FONT}`);
requestAnimationFrame(loop);
