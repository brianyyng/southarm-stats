import clsx from "clsx";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ArrowLeft, Check, Crown, LayoutGrid, MapPin, Plus, Shirt, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Avatar, ErrorNote, PositionTag, SectionTitle, Skeleton, toast } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { captainTeam, signupOpensAt, signupState, teamName } from "../lib/game";
import { useGameDetail, useProfiles } from "../lib/hooks";
import type { Game, Profile, Team } from "../lib/types";

export default function GamePage() {
  const { id = "" } = useParams();
  const { userId, profile: me } = useAuth();
  const navigate = useNavigate();
  const detail = useGameDetail(id);
  const profiles = useProfiles();
  const [busy, setBusy] = useState(false);

  // Someone new signed up whose profile we haven't loaded yet.
  const missing = detail.data?.signups.some((s) => profiles.data && !profiles.byId.has(s.player_id));
  useEffect(() => {
    if (missing) profiles.reload();
  }, [missing, profiles.reload]);

  if (detail.error) return <Layout><ErrorNote message={detail.error} /></Layout>;
  if (!detail.data || !profiles.data) {
    return (
      <Layout>
        <div className="space-y-4">
          <Skeleton className="h-28" />
          <div className="grid grid-cols-2 gap-3"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
          <Skeleton className="h-14" />
          <Skeleton className="h-80" />
        </div>
      </Layout>
    );
  }

  const { game, signups, waitlist, assignments } = detail.data;
  const byId = profiles.byId;
  const imIn = !!userId && signups.some((s) => s.player_id === userId);
  const state = signupState(game, signups.length);
  const myCaptaincy = captainTeam(game, userId ?? undefined);
  const teamOf = new Map(assignments.map((a) => [a.player_id, a.team]));
  const capName = (t: Team) => byId.get((t === "home" ? game.home_captain_id : game.away_captain_id) ?? "")?.full_name;
  const completed = game.status === "completed";

  async function toggleSignup() {
    if (!userId) return navigate("/signin", { state: { from: `/games/${id}` } });
    setBusy(true);
    try {
      if (imIn) {
        await api.withdrawFromGame(id, userId);
        toast("You've been taken off the list.");
      } else {
        await api.signUpForGame(id, userId);
        toast("You're in. See you on the pitch.");
      }
      detail.reload();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <header className="animate-rise">
          <Link to="/schedule" className="label inline-flex items-center gap-1 hover:text-chalk">
            <ArrowLeft size={13} /> Schedule
          </Link>
          <h1 className="mt-2 font-display text-[40px] font-black uppercase leading-[0.9]">
            {format(new Date(game.kickoff_at), "EEEE, MMM d")}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span>{format(new Date(game.kickoff_at), "h:mm a")}</span>
            <span className="inline-flex items-center gap-1"><MapPin size={13} />{game.location}</span>
          </div>
        </header>

        {/* Captains */}
        <section className="grid grid-cols-2 gap-3">
          {(["home", "away"] as const).map((t, i) => (
            <CaptainCard
              key={t}
              game={game}
              team={t}
              captain={byId.get((t === "home" ? game.home_captain_id : game.away_captain_id) ?? "")}
              score={completed ? (t === "home" ? game.home_score : game.away_score) : null}
              count={assignments.filter((a) => a.team === t).length}
              delay={i * 80}
            />
          ))}
        </section>

        {/* Captain tools */}
        {myCaptaincy && !completed && (
          <section className="card flex items-center gap-3 border-volt/30 p-3.5">
            <Crown className="shrink-0 text-volt" size={22} />
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-semibold">You're captaining {teamName(game, myCaptaincy, me?.full_name)}</div>
              <div className="text-muted">{imIn ? "Pick your squad from the players signed up." : "Sign up below if you're playing too."}</div>
            </div>
          </section>
        )}
        {(myCaptaincy || assignments.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {myCaptaincy && !completed ? (
              <Link to={`/games/${id}/draft`} className="btn-volt">
                <Shirt size={18} /> Draft now
              </Link>
            ) : null}
            {assignments.length > 0 && (
              <Link to={`/games/${id}/lineup`} className={clsx("btn-ghost", !(myCaptaincy && !completed) && "col-span-2")}>
                <LayoutGrid size={18} /> {myCaptaincy && !completed ? "Lineup" : "View lineups"}
              </Link>
            )}
          </div>
        )}

        {/* Sign-in CTA */}
        {!completed && (
          <section>
            {imIn ? (
              <div className="card flex items-center gap-3 p-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-volt text-ink">
                  <Check strokeWidth={3} size={20} />
                </span>
                <div className="flex-1">
                  <div className="font-display text-xl font-extrabold uppercase leading-none">You're in</div>
                  <div className="text-sm text-muted">Spot {signups.findIndex((s) => s.player_id === userId) + 1} of {game.max_per_team * 2}</div>
                </div>
                {state !== "closed" && (
                  <button onClick={toggleSignup} disabled={busy} className="btn-ghost min-h-9 px-3 text-sm">
                    Withdraw
                  </button>
                )}
              </div>
            ) : (
              <button onClick={toggleSignup} disabled={busy || (!!userId && state !== "open")} className="btn-volt w-full text-xl">
                {!userId
                  ? "Sign in to play"
                  : state === "open"
                    ? busy ? "Signing you in…" : "Mark me in for this game"
                    : state === "not-open"
                      ? `Sign-ups open ${format(signupOpensAt(game), "EEE MMM d")}`
                      : state === "full"
                        ? "Game's full · add to waitlist below"
                        : "Sign-ups closed"}
              </button>
            )}
          </section>
        )}

        {/* Players */}
        <section>
          <SectionTitle
            kicker={completed ? "Played" : "Signed in"}
            title="Players"
            action={<span className="font-display text-2xl font-black text-volt">{signups.length}<span className="text-muted">/{game.max_per_team * 2}</span></span>}
          />
          {signups.length === 0 ? (
            <div className="card p-4 text-sm text-muted">Nobody's in yet. Be the first.</div>
          ) : (
            <ol className="card divide-y divide-white/[0.06] overflow-hidden">
              {signups.map((s, i) => {
                const p = byId.get(s.player_id);
                const team = teamOf.get(s.player_id);
                const isCap = s.player_id === game.home_captain_id || s.player_id === game.away_captain_id;
                return (
                  <li key={s.player_id} className={clsx("flex items-center gap-3 px-3.5 py-2.5", s.player_id === userId && "bg-volt/[0.06]")}>
                    <span className="w-5 text-right font-mono text-xs text-muted">{i + 1}</span>
                    <Avatar profile={p} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate font-semibold">
                        {p?.full_name ?? "Player"}
                        {isCap && <Crown size={13} className="shrink-0 text-volt" aria-label="Captain" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <PositionTag position={p?.position} />
                        <span className="text-xs text-muted">{formatDistanceToNowStrict(new Date(s.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                    {team && <TeamDot team={team} label={teamName(game, team, capName(team))} />}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <Waitlist gameId={id} entries={waitlist} onChange={detail.reload} profiles={byId} />
      </div>
    </Layout>
  );
}

function CaptainCard({
  game,
  team,
  captain,
  score,
  count,
  delay,
}: {
  game: Game;
  team: Team;
  captain: Profile | undefined;
  score: number | null;
  count: number;
  delay: number;
}) {
  const accent = team === "home" ? "volt" : "flare";
  return (
    <div className="card relative overflow-hidden p-3.5 animate-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className={clsx("absolute inset-x-0 top-0 h-1", team === "home" ? "bg-volt" : "bg-flare")} />
      <div className="label flex items-center gap-1"><Crown size={11} /> Captain</div>
      <div className="mt-3 flex flex-col items-center text-center">
        {captain ? <Avatar profile={captain} size={64} ring={accent} /> : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-white/15 font-display text-xl text-muted">?</span>
        )}
        <div className="mt-2.5 line-clamp-2 font-semibold leading-tight">{captain?.full_name ?? "To be announced"}</div>
        <div className="mt-1"><PositionTag position={captain?.position} /></div>
        <div className={clsx("mt-2 font-mono text-[10px] uppercase tracking-widest", team === "home" ? "text-volt" : "text-flare")}>
          {teamName(game, team, captain?.full_name)}
        </div>
      </div>
      {score !== null ? (
        <div className="mt-2 text-center font-display text-5xl font-black leading-none">{score}</div>
      ) : count > 0 ? (
        <div className="mt-1 text-center font-mono text-[11px] text-muted">{count}/{game.max_per_team} drafted</div>
      ) : null}
    </div>
  );
}

export function TeamDot({ team, label }: { team: Team; label: string }) {
  return (
    <span className={clsx("inline-flex max-w-[40%] items-center gap-1.5 truncate font-mono text-[10px] uppercase tracking-wider", team === "home" ? "text-volt" : "text-flare")}>
      <span className={clsx("h-2 w-2 shrink-0 rounded-full", team === "home" ? "bg-volt" : "bg-flare")} />
      <span className="truncate">{label}</span>
    </span>
  );
}

function Waitlist({
  gameId,
  entries,
  onChange,
  profiles,
}: {
  gameId: string;
  entries: { id: string; player_name: string; referred_by: string; added_by: string | null }[];
  onChange: () => void;
  profiles: Map<string, Profile>;
}) {
  const { userId, profile } = useAuth();
  const [name, setName] = useState("");
  const [referrer, setReferrer] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile?.full_name) setReferrer((r) => r || profile.full_name);
  }, [profile?.full_name]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!userId || !name.trim()) return;
    setBusy(true);
    try {
      await api.addToWaitlist(gameId, name, referrer, userId);
      setName("");
      onChange();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await api.removeFromWaitlist(id);
      onChange();
    } catch (err) {
      toast((err as Error).message);
    }
  }

  return (
    <section>
      <SectionTitle kicker="New players" title="Waitlist" action={<span className="font-display text-2xl font-black text-muted">{entries.length}</span>} />
      {!userId ? (
        <div className="card p-4 text-sm text-muted">
          <Link to="/signin" className="text-volt underline underline-offset-2">Sign in</Link> to see and add to the waitlist.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-[1.5rem_1fr_1fr_2rem] gap-2 border-b border-white/[0.06] px-3.5 py-2">
            <span className="label">#</span>
            <span className="label">New player</span>
            <span className="label">Referred by</span>
            <span />
          </div>
          <ol className="divide-y divide-white/[0.06]">
            {entries.map((w, i) => (
              <li key={w.id} className="grid grid-cols-[1.5rem_1fr_1fr_2rem] items-center gap-2 px-3.5 py-2.5 text-sm">
                <span className="font-mono text-xs text-muted">{i + 1}</span>
                <span className="truncate font-semibold">{w.player_name}</span>
                <span className="truncate text-muted">{w.referred_by || profiles.get(w.added_by ?? "")?.full_name || "—"}</span>
                {w.added_by === userId ? (
                  <button onClick={() => remove(w.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-white/5 hover:text-flare" aria-label={`Remove ${w.player_name}`}>
                    <X size={16} />
                  </button>
                ) : <span />}
              </li>
            ))}
          </ol>
          <form onSubmit={add} className="grid grid-cols-[1fr_1fr_auto] gap-2 border-t border-white/[0.06] bg-ink/30 p-2.5">
            <input className="input min-h-10 text-sm" placeholder="Player name" value={name} onChange={(e) => setName(e.target.value)} aria-label="New player name" />
            <input className="input min-h-10 text-sm" placeholder="Referred by" value={referrer} onChange={(e) => setReferrer(e.target.value)} aria-label="Referred by" />
            <button className="btn-volt min-h-10 px-3" disabled={busy || !name.trim()} aria-label="Add to waitlist">
              <Plus size={18} strokeWidth={3} />
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
