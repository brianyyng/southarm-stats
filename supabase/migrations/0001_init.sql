-- Southarm Stats: initial schema
-- Run in the Supabase SQL editor (or `supabase db push`).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text not null default '',
  position     text check (position in ('GK', 'DEF', 'MID', 'FWD')),
  headshot_url text,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Create a profile row whenever someone signs up (email or Google).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, headshot_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- Games
-- ---------------------------------------------------------------------------
create table public.games (
  id               uuid primary key default gen_random_uuid(),
  kickoff_at       timestamptz not null,
  location         text not null default 'Southarm Park',
  status           text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  home_captain_id  uuid references public.profiles (id),
  away_captain_id  uuid references public.profiles (id),
  home_name        text,
  away_name        text,
  home_score       int,
  away_score       int,
  home_formation   text not null default '4-3-3',
  away_formation   text not null default '4-3-3',
  max_per_team     int not null default 15,
  created_at       timestamptz not null default now()
);

create index games_kickoff_idx on public.games (kickoff_at);

-- Players may only sign up during the 7 days before kickoff.
create function public.signups_open(g public.games) returns boolean
language sql stable as $$
  select g.status = 'scheduled'
     and now() >= g.kickoff_at - interval '7 days'
     and now() < g.kickoff_at;
$$;

-- ---------------------------------------------------------------------------
-- Signups, waitlist, teams, stats
-- ---------------------------------------------------------------------------
create table public.game_signups (
  game_id    uuid not null references public.games (id) on delete cascade,
  player_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (game_id, player_id)
);

create table public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.games (id) on delete cascade,
  player_name text not null check (length(trim(player_name)) > 0),
  referred_by text not null default '',
  added_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create table public.team_assignments (
  game_id     uuid not null,
  player_id   uuid not null,
  team        text not null check (team in ('home', 'away')),
  pick_number int not null,          -- 0 = captain, 1.. = draft order
  slot        text,                  -- formation slot id, null = bench
  primary key (game_id, player_id),
  foreign key (game_id, player_id) references public.game_signups (game_id, player_id) on delete cascade
);

create unique index team_assignments_slot_idx
  on public.team_assignments (game_id, team, slot) where slot is not null;

create table public.player_game_stats (
  game_id   uuid not null references public.games (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  goals     int not null default 0,
  assists   int not null default 0,
  potm      boolean not null default false,
  dotm      boolean not null default false,
  primary key (game_id, player_id)
);

-- Leaderboard: every player who has signed up for or played a game.
create view public.player_stats with (security_invoker = on) as
select
  p.id as player_id,
  p.full_name,
  p.position,
  p.headshot_url,
  count(distinct s.game_id) filter (where g.status = 'completed') as games_played,
  coalesce(sum(st.goals), 0)::int                                as goals,
  coalesce(sum(st.assists), 0)::int                              as assists,
  count(*) filter (where st.potm)::int                           as potm,
  count(*) filter (where st.dotm)::int                           as dotm
from public.profiles p
left join public.game_signups s on s.player_id = p.id
left join public.games g on g.id = s.game_id
left join public.player_game_stats st on st.player_id = p.id and st.game_id = s.game_id
where p.full_name <> ''
group by p.id;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.games             enable row level security;
alter table public.game_signups      enable row level security;
alter table public.waitlist          enable row level security;
alter table public.team_assignments  enable row level security;
alter table public.player_game_stats enable row level security;

-- Public reads (stats site is viewable without signing in), except the waitlist.
create policy "profiles readable"    on public.profiles          for select using (true);
create policy "games readable"       on public.games             for select using (true);
create policy "signups readable"     on public.game_signups      for select using (true);
create policy "teams readable"       on public.team_assignments  for select using (true);
create policy "stats readable"       on public.player_game_stats for select using (true);
create policy "waitlist readable"    on public.waitlist          for select to authenticated using (true);

create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and is_admin = (select is_admin from public.profiles where id = auth.uid()));

create policy "admins manage games" on public.games for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "admins manage stats" on public.player_game_stats for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "sign self up" on public.game_signups for insert to authenticated
  with check (
    player_id = auth.uid()
    and exists (
      select 1 from public.games g
      where g.id = game_id
        and public.signups_open(g)
        and (select count(*) from public.game_signups s where s.game_id = g.id) < g.max_per_team * 2
    )
  );

create policy "withdraw self" on public.game_signups for delete to authenticated
  using (
    (player_id = auth.uid()
      and exists (select 1 from public.games g where g.id = game_id and now() < g.kickoff_at))
    or public.is_admin()
  );

create policy "add to waitlist" on public.waitlist for insert to authenticated
  with check (added_by = auth.uid());

create policy "remove own waitlist entry" on public.waitlist for delete to authenticated
  using (added_by = auth.uid() or public.is_admin());

-- team_assignments are written only through the captain RPCs below.

-- ---------------------------------------------------------------------------
-- Captain RPCs (security definer: they enforce captain + draft rules)
-- ---------------------------------------------------------------------------
create function public.captain_team(p_game uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when home_captain_id = auth.uid() then 'home'
    when away_captain_id = auth.uid() then 'away'
  end
  from public.games where id = p_game;
$$;

-- Puts any signed-up captains on their own team.
create function public.start_draft(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g public.games;
begin
  select * into g from public.games where id = p_game;
  if public.captain_team(p_game) is null then
    raise exception 'Only this week''s captains can run the draft';
  end if;

  insert into public.team_assignments (game_id, player_id, team, pick_number)
  select p_game, s.player_id, case when s.player_id = g.home_captain_id then 'home' else 'away' end, 0
  from public.game_signups s
  where s.game_id = p_game and s.player_id in (g.home_captain_id, g.away_captain_id)
  on conflict do nothing;
end;
$$;

-- Whose pick is it? Home picks first, then alternate; a full team is skipped.
create function public.draft_turn(p_game uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  g public.games;
  picks int;
  home_n int;
  away_n int;
  pool int;
  turn text;
begin
  select * into g from public.games where id = p_game;
  select count(*) filter (where pick_number > 0),
         count(*) filter (where team = 'home'),
         count(*) filter (where team = 'away')
    into picks, home_n, away_n
  from public.team_assignments where game_id = p_game;

  select count(*) into pool from public.game_signups s
  where s.game_id = p_game
    and s.player_id not in (select player_id from public.team_assignments where game_id = p_game)
    and s.player_id is distinct from g.home_captain_id
    and s.player_id is distinct from g.away_captain_id;

  if pool = 0 or (home_n >= g.max_per_team and away_n >= g.max_per_team) then
    return null;
  end if;

  turn := case when picks % 2 = 0 then 'home' else 'away' end;
  if turn = 'home' and home_n >= g.max_per_team then
    turn := 'away';
  elsif turn = 'away' and away_n >= g.max_per_team then
    turn := 'home';
  end if;
  return turn;
end;
$$;

create function public.draft_pick(p_game uuid, p_player uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g public.games;
  my_team text := public.captain_team(p_game);
  next_pick int;
begin
  select * into g from public.games where id = p_game;
  if my_team is null then raise exception 'Only this week''s captains can draft'; end if;
  if now() >= g.kickoff_at then raise exception 'The draft is closed'; end if;

  perform public.start_draft(p_game);

  if public.draft_turn(p_game) is distinct from my_team then
    raise exception 'It is not your pick';
  end if;
  if p_player in (g.home_captain_id, g.away_captain_id) then
    raise exception 'Captains cannot be drafted';
  end if;
  if not exists (select 1 from public.game_signups where game_id = p_game and player_id = p_player) then
    raise exception 'That player is not signed up';
  end if;

  select coalesce(max(pick_number), 0) + 1 into next_pick
  from public.team_assignments where game_id = p_game;

  insert into public.team_assignments (game_id, player_id, team, pick_number)
  values (p_game, p_player, my_team, next_pick);
end;
$$;

-- A captain can take back their pick if it was the most recent one.
create function public.undo_pick(p_game uuid) returns void
language plpgsql security definer set search_path = public as $$
declare last_row public.team_assignments;
begin
  select * into last_row from public.team_assignments
  where game_id = p_game and pick_number > 0
  order by pick_number desc limit 1;

  if last_row is null or last_row.team is distinct from public.captain_team(p_game) then
    raise exception 'You can only undo your own most recent pick';
  end if;

  delete from public.team_assignments where game_id = p_game and player_id = last_row.player_id;
end;
$$;

create function public.set_formation(p_game uuid, p_formation text) returns void
language plpgsql security definer set search_path = public as $$
declare my_team text := public.captain_team(p_game);
begin
  if my_team is null then raise exception 'Only captains can set a formation'; end if;
  if my_team = 'home' then
    update public.games set home_formation = p_formation where id = p_game;
  else
    update public.games set away_formation = p_formation where id = p_game;
  end if;
  -- Slots belong to a formation; send everyone to the bench when it changes.
  update public.team_assignments set slot = null where game_id = p_game and team = my_team;
end;
$$;

-- Move a player into a slot (null = bench). Whoever held the slot swaps places.
create function public.assign_slot(p_game uuid, p_player uuid, p_slot text) returns void
language plpgsql security definer set search_path = public as $$
declare
  my_team text := public.captain_team(p_game);
  moving public.team_assignments;
begin
  select * into moving from public.team_assignments where game_id = p_game and player_id = p_player;
  if my_team is null or moving.team is distinct from my_team then
    raise exception 'You can only arrange your own team';
  end if;

  -- Free the mover's old slot first so the unique (team, slot) index never clashes.
  update public.team_assignments set slot = null where game_id = p_game and player_id = p_player;
  if p_slot is not null then
    update public.team_assignments set slot = moving.slot
    where game_id = p_game and team = my_team and slot = p_slot;
  end if;
  update public.team_assignments set slot = p_slot where game_id = p_game and player_id = p_player;
end;
$$;

grant execute on function public.start_draft, public.draft_turn, public.draft_pick, public.undo_pick,
  public.set_formation, public.assign_slot to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime + storage
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.game_signups, public.waitlist, public.team_assignments, public.games;

insert into storage.buckets (id, name, public) values ('headshots', 'headshots', true)
on conflict (id) do nothing;

create policy "headshots public read" on storage.objects for select
  using (bucket_id = 'headshots');
create policy "upload own headshot" on storage.objects for insert to authenticated
  with check (bucket_id = 'headshots' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "replace own headshot" on storage.objects for update to authenticated
  using (bucket_id = 'headshots' and (storage.foldername(name))[1] = auth.uid()::text);
