create table if not exists public.confessions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  category text not null default 'Confessions',
  created_at timestamptz not null default now(),
  likes integer not null default 0 check (likes >= 0)
);

alter table public.confessions
  add column if not exists author_id uuid references auth.users(id) on delete cascade;

alter table public.confessions enable row level security;

drop policy if exists "Anyone can read confessions" on public.confessions;
drop policy if exists "Authenticated users can read confessions" on public.confessions;
drop policy if exists "Authenticated users can create confessions" on public.confessions;
drop policy if exists "Authors can delete their confessions" on public.confessions;

create policy "Authenticated users can read confessions"
  on public.confessions
  for select
  to authenticated
  using (true);

create policy "Authenticated users can create confessions"
  on public.confessions
  for insert
  to authenticated
  with check (author_id = (select auth.uid()));

create policy "Authors can delete their confessions"
  on public.confessions
  for delete
  to authenticated
  using (author_id = (select auth.uid()));

revoke all on public.confessions from anon, authenticated;
grant select (id, content, category, created_at, likes) on public.confessions to authenticated;
grant insert (author_id, content, category) on public.confessions to authenticated;
grant delete on public.confessions to authenticated;

create table if not exists public.flappy_scores (
  id uuid primary key default gen_random_uuid(),
  player_name text not null check (char_length(btrim(player_name)) between 1 and 20),
  score integer not null check (score between 0 and 100000),
  created_at timestamptz not null default now()
);

alter table public.flappy_scores enable row level security;

drop policy if exists "Anyone can read Flappy Bird scores" on public.flappy_scores;
drop policy if exists "Anyone can submit a Flappy Bird score" on public.flappy_scores;

create policy "Anyone can read Flappy Bird scores"
  on public.flappy_scores
  for select
  to anon, authenticated
  using (true);

create policy "Anyone can submit a Flappy Bird score"
  on public.flappy_scores
  for insert
  to anon, authenticated
  with check (
    char_length(btrim(player_name)) between 1 and 20
    and score between 0 and 100000
  );

revoke all on public.flappy_scores from public, anon, authenticated;
grant select (id, player_name, score, created_at) on public.flappy_scores to anon, authenticated;
grant insert (player_name, score) on public.flappy_scores to anon, authenticated;
