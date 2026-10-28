import clsx from "clsx";
import { format } from "date-fns";
import { Check, ChevronRight, MapPin } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { daysUntil, kickoffLabel, signupOpensAt, signupState, teamName } from "../lib/game";
import type { GameListItem, PlayerStatLine, Profile } from "../lib/types";
import { Avatar, PositionTag, Skeleton, toast } from "./ui";

/** Matchday numbers count every game ever played, oldest first. */
export function matchday(games: GameListItem[], game: GameListItem) {
  return games.findIndex((g) => g.id === game.id) + 1;
}

export function ScoreCarousel({ games, profiles }: { games: GameListItem[] | null; profiles: Map<string, Profile> }) {
  const results = (games ?? []).filter((g) => g.status === "completed").reverse();
  return (
    <section aria-label="Recent results" className="-mx-4 mb-2">
      <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-3 pt-1">
        {!games && [0, 1, 2].map((i) => <Skeleton key={i} className="h-[104px] w-[78%] shrink-0 sm:w-72" />)}
        {games && results.length === 0 && (
          <div className="card w-full p-4 text-sm text-muted">Results will show up here after the first match.</div>
        )}
        {results.map((g, i) => {
          const home = teamName(g, "home", profiles.get(g.home_captain_id ?? "")?.full_name);
          const away = teamName(g, "away", profiles.get(g.away_captain_id ?? "")?.full_name);
          const hs = g.home_score ?? 0;
          const as = g.away_score ?? 0;
          return (
            <Link
              key={g.id}
              to={`/games/${g.id}`}
              className="card group relative w-[78%] shrink-0 snap-start overflow-hidden p-3.5 animate-rise sm:w-72"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="label">MD {matchday(games!, g)} · {format(new Date(g.kickoff_at), "MMM d")}</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-chalk/80">FT</span>
              </div>
              <div className="mt-2.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <span className={clsx("truncate text-[15px] font-semibold", hs > as ? "text-chalk" : "text-chalk/60")}>{home}</span>
                <span className="font-display text-[34px] font-black leading-none tabular-nums tracking-tight">
                  <span className={hs >= as ? "text-volt" : ""}>{hs}</span>
                  <span className="mx-1.5 text-muted/60">–</span>
                  <span className={as >= hs ? "text-volt" : ""}>{as}</span>
                </span>
                <span className={clsx("truncate text-right text-[15px] font-semibold", as > hs ? "text-chalk" : "text-chalk/60")}>
                  {away}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function NextGameBanner({
  game,
  allGames,
  onChange,
}: {
  game: GameListItem;
  allGames: GameListItem[];
  onChange: () => void;
}) {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const count = game.signup_ids.length;
  const capacity = game.max_per_team * 2;
  const state = signupState(game, count);
  const imIn = !!userId && game.signup_ids.includes(userId);
  const days = daysUntil(game);

  async function signUp() {
    if (!userId) return navigate("/signin", { state: { from: `/games/${game.id}` } });
    setBusy(true);
    try {
      await api.signUpForGame(game.id, userId);
      toast("You're in. See you on the pitch.");
      onChange();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-3xl bg-volt p-5 text-ink animate-rise">
      {/* Chalk centre-circle, cropped off the right edge. */}
      <svg className="pointer-events-none absolute -right-16 -top-10 h-64 w-64 text-ink/10" viewBox="0 0 200 200" aria-hidden>
        <circle cx="100" cy="100" r="70" fill="none" stroke="currentColor" strokeWidth="6" />
        <circle cx="100" cy="100" r="6" fill="currentColor" />
        <line x1="0" y1="100" x2="200" y2="100" stroke="currentColor" strokeWidth="6" />
      </svg>
      <div className="relative">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/70">
          Next up · Matchday {matchday(allGames, game)}
        </div>
        <h2 className="mt-1 font-display text-[44px] font-black uppercase leading-[0.9]">
          {days <= 0 ? "Today" : days === 1 ? "Tomorrow" : format(new Date(game.kickoff_at), "EEEE")}
          <span className="block text-ink/55">{format(new Date(game.kickoff_at), "MMM d · h:mm a")}</span>
        </h2>
        <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-ink/75">
          <MapPin size={14} /> {game.location}
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex justify-between font-mono text-[11px] font-semibold uppercase tracking-wider">
            <span>{count} signed up</span>
            <span>{Math.max(capacity - count, 0)} spots left</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink/15">
            <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${Math.min(100, (count / capacity) * 100)}%` }} />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          {imIn ? (
            <Link to={`/games/${game.id}`} className="btn flex-1 bg-ink text-volt">
              <Check size={20} strokeWidth={3} /> You're in
            </Link>
          ) : state === "open" ? (
            <button onClick={signUp} disabled={busy} className="btn flex-1 bg-ink text-volt">
              {busy ? "Signing up…" : "Sign up for this week"}
            </button>
          ) : (
            <div className="btn flex-1 cursor-default bg-ink/10 text-ink/70">
              {state === "not-open"
                ? `Sign-ups open ${format(signupOpensAt(game), "EEE MMM d")}`
                : state === "full"
                  ? "Full · join the waitlist"
                  : "Sign-ups closed"}
            </div>
          )}
          <Link to={`/games/${game.id}`} className="btn border-2 border-ink/80 px-3" aria-label="Game details">
            <ChevronRight size={22} strokeWidth={3} />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function ScheduleList({ games, allGames }: { games: GameListItem[]; allGames: GameListItem[] }) {
  const { userId } = useAuth();
  if (games.length === 0) return <div className="card p-4 text-sm text-muted">No games scheduled yet.</div>;
  return (
    <ul className="card divide-y divide-white/[0.06] overflow-hidden">
      {games.map((g) => {
        const date = new Date(g.kickoff_at);
        const state = signupState(g, g.signup_ids.length);
        const imIn = !!userId && g.signup_ids.includes(userId);
        const done = g.status === "completed";
        return (
          <li key={g.id}>
            <Link to={`/games/${g.id}`} className="flex items-center gap-4 px-4 py-3.5 transition hover:bg-white/[0.03] active:bg-white/[0.05]">
              <div className="w-11 text-center">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted">{format(date, "MMM")}</div>
                <div className="font-display text-3xl font-black leading-none">{format(date, "d")}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">
                  Matchday {matchday(allGames, g)}
                  {done && (
                    <span className="ml-2 font-display text-lg font-black text-volt">
                      {g.home_score}–{g.away_score}
                    </span>
                  )}
                </div>
                <div className="truncate text-sm text-muted">{kickoffLabel(g)}</div>
              </div>
              {!done &&
                (imIn ? (
                  <Chip tone="volt">
                    <Check size={12} strokeWidth={3} /> In
                  </Chip>
                ) : state === "open" ? (
                  <Chip tone="volt-outline">Open</Chip>
                ) : state === "full" ? (
                  <Chip>Full</Chip>
                ) : state === "not-open" ? (
                  <Chip>Opens {format(signupOpensAt(g), "MMM d")}</Chip>
                ) : null)}
              <ChevronRight size={18} className="shrink-0 text-muted" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Chip({ children, tone }: { children: ReactNode; tone?: "volt" | "volt-outline" }) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider",
        tone === "volt" && "bg-volt text-ink",
        tone === "volt-outline" && "border border-volt/60 text-volt",
        !tone && "bg-white/[0.07] text-muted",
      )}
    >
      {children}
    </span>
  );
}

const HIGHLIGHTS: { key: keyof Pick<PlayerStatLine, "goals" | "assists" | "potm" | "dotm">; label: string; unit: string }[] = [
  { key: "goals", label: "Golden Boot", unit: "goals" },
  { key: "assists", label: "Playmaker", unit: "assists" },
  { key: "potm", label: "Player of the Match", unit: "awards" },
  { key: "dotm", label: "Defender of the Match", unit: "awards" },
];

export function StatHighlights({ stats }: { stats: PlayerStatLine[] | null }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {HIGHLIGHTS.map(({ key, label, unit }, i) => {
        const leader = stats ? [...stats].sort((a, b) => b[key] - a[key])[0] : null;
        if (!stats) return <Skeleton key={key} className="h-[150px]" />;
        return (
          <Link
            to={`/stats?sort=${key}`}
            key={key}
            className="card flex flex-col p-3.5 animate-rise"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <span className="label leading-tight">{label}</span>
            {leader && leader[key] > 0 ? (
              <>
                <div className="mt-3 flex items-center gap-2.5">
                  <Avatar profile={leader} size={38} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold leading-tight">{leader.full_name}</div>
                    <PositionTag position={leader.position} />
                  </div>
                </div>
                <div className="mt-auto pt-3 font-display text-4xl font-black leading-none text-volt">
                  {leader[key]}
                  <span className="ml-1.5 font-mono text-[11px] font-normal uppercase tracking-wider text-muted">{unit}</span>
                </div>
              </>
            ) : (
              <div className="mt-3 text-sm text-muted">Up for grabs</div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

