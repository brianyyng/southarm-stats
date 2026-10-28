-- Sample games: three past results and the next four Sundays (10:00 Vancouver time).
-- Captains need real accounts: once people have signed up, set them with e.g.
--   update games set home_captain_id = '<uuid>', away_captain_id = '<uuid>' where id = '<game>';
-- and make yourself an admin with:
--   update profiles set is_admin = true where id = '<your uuid>';
with sundays as (
  select ((date_trunc('week', now() at time zone 'America/Vancouver') + interval '6 days 10 hours')
          at time zone 'America/Vancouver') + (n * interval '7 days') as kickoff, n
  from generate_series(-3, 3) as n
)
insert into public.games (kickoff_at, status, home_name, away_name, home_score, away_score)
select kickoff,
       case when n < 0 then 'completed' else 'scheduled' end,
       'Whites', 'Darks',
       case n when -3 then 3 when -2 then 2 when -1 then 4 end,
       case n when -3 then 2 when -2 then 2 when -1 then 1 end
from sundays;
