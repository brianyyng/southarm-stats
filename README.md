# Southarm Stats

Mobile-first stat tracker for the weekly Southarm drop-in soccer match: sign-ups, waitlist, captain drafts, lineups and the all-time player table.

Built with Vite, React, TypeScript, Tailwind and Supabase.

## Run it

```bash
npm install
npm run dev
```

Opens on http://localhost:5180. Without Supabase keys the app runs in **demo mode**: sample players and games stored in your browser. On the sign-in page you can jump in as a captain or a regular player, and "Reset demo" in the footer starts over.

## Connect Supabase

1. In the Supabase SQL editor, run `supabase/migrations/0001_init.sql`, then optionally `supabase/seed.sql` for sample games.
2. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
3. For Google sign-in, enable the Google provider under Authentication → Providers and add your site URL to the redirect allow list.
4. Make yourself an admin: `update profiles set is_admin = true where id = '<your user id>';`

Admins manage games, captains, scores and per-game stats from the Supabase table editor for now.

## How the rules are enforced

All rules live in the database (row level security and RPCs), not just the UI:

- Players can sign up only during the 7 days before kickoff, up to `max_per_team × 2`.
- Only that week's two captains can draft. Home picks first, then picks alternate and a full team (15) is skipped. A captain can undo their own pick while it is still the most recent one.
- A captain who signed up is placed on their own team automatically.
- Captains arrange only their own team's formation and lineup. Changing formation sends everyone to the bench.
- Anyone signed in can add a new player to a game's waitlist; only the person who added an entry can remove it.

## Deploy

`vercel.json` rewrites every path to `index.html` so client-side routes work. Set the two `VITE_SUPABASE_*` variables in the host's environment settings.
