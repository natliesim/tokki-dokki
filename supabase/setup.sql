-- Tokki Dokki high score board.
-- Paste this whole file into Supabase: SQL Editor -> New query -> Run.

-- Every submitted score.
create table if not exists public.scores (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 1 and 12),
  score integer not null check (score between 1 and 100000),
  created_at timestamptz not null default now()
);

-- Row level security: visitors may read scores and add new ones,
-- but never change or delete existing ones.
alter table public.scores enable row level security;

drop policy if exists "Anyone can read scores" on public.scores;
create policy "Anyone can read scores" on public.scores
  for select to anon, authenticated using (true);

drop policy if exists "Anyone can add a score" on public.scores;
create policy "Anyone can add a score" on public.scores
  for insert to anon, authenticated with check (true);

grant select, insert on public.scores to anon, authenticated;

-- The board: each name's best score, top 10.
create or replace view public.top_scores with (security_invoker = true) as
  select name, max(score) as score
  from public.scores
  group by name
  order by score desc
  limit 10;

grant select on public.top_scores to anon, authenticated;
