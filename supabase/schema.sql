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
