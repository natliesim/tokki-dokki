// Shared high score board, stored in a free Supabase database.
// Talks to Supabase's REST API directly with fetch, so no extra library is needed.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const BOARD_SIZE = 10;
export const NAME_MAX = 12;
export const boardEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);

const base = SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1';

async function request(path, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(base + path, {
      ...options,
      signal: ctrl.signal,
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', ...options.headers },
    });
    if (!res.ok) throw new Error(`Scoreboard error ${res.status}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// Top scores, best score per name, highest first.
export async function fetchTopScores() {
  const res = await request(`/top_scores?select=name,score&order=score.desc&limit=${BOARD_SIZE}`);
  const rows = await res.json();
  return rows.map((r) => ({ name: String(r.name), score: Number(r.score) }));
}

export async function submitScore(name, score) {
  await request('/scores', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ name: cleanName(name), score: Math.floor(score) }),
  });
}

export function cleanName(name) {
  return String(name).replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}

// Does this score earn a spot on the board?
export function qualifies(top, score) {
  if (score <= 0) return false;
  return top.length < BOARD_SIZE || score > top[top.length - 1].score;
}
