import clsx from "clsx";
import { ArrowLeft, Crown, LayoutGrid, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Avatar, ErrorNote, PositionTag, Skeleton, toast } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { captainTeam, draftTurn, teamName } from "../lib/game";
import { useGameDetail, useProfiles } from "../lib/hooks";
import { POSITIONS, type Position, type Profile, type Team } from "../lib/types";

export default function DraftPage() {
  const { id = "" } = useParams();
  const { userId } = useAuth();
  const detail = useGameDetail(id);
  const profiles = useProfiles();
  const [filter, setFilter] = useState<Position | "ALL">("ALL");
  const [pending, setPending] = useState<string | null>(null);

  const game = detail.data?.game;
  const myTeam = game ? captainTeam(game, userId ?? undefined) : null;

  // Captains who signed up go straight onto their own team.
  useEffect(() => {
    if (myTeam && detail.data) {
      const capPlaced = detail.data.assignments.some((a) => a.player_id === userId);
      const capIn = detail.data.signups.some((s) => s.player_id === userId);
      if (capIn && !capPlaced) api.startDraft(id).then(detail.reload).catch(() => {});
    }
  }, [myTeam, detail.data, id, userId, detail.reload]);

  const view = useMemo(() => {
    if (!detail.data) return null;
    const { game, signups, assignments } = detail.data;
    const taken = new Set(assignments.map((a) => a.player_id));
    const captains = new Set([game.home_captain_id, game.away_captain_id]);
    const pool = signups.filter((s) => !taken.has(s.player_id) && !captains.has(s.player_id)).map((s) => s.player_id);
    const squad = (t: Team) => assignments.filter((a) => a.team === t).sort((a, b) => a.pick_number - b.pick_number);
    const lastPick = [...assignments].filter((a) => a.pick_number > 0).sort((a, b) => b.pick_number - a.pick_number)[0];
    return { pool, squad, turn: draftTurn(game, signups, assignments), lastPick };
  }, [detail.data]);

  if (detail.error) return <Layout><ErrorNote message={detail.error} /></Layout>;
  if (!detail.data || !view || !game || !profiles.data) {
    return <Layout><div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-32" /><Skeleton className="h-96" /></div></Layout>;
  }

  const byId = profiles.byId;
  const capName = (t: Team) => byId.get((t === "home" ? game.home_captain_id : game.away_captain_id) ?? "")?.full_name;
  const myTurn = !!myTeam && view.turn === myTeam;
  const pool = view.pool
    .map((pid) => byId.get(pid))
    .filter((p): p is Profile => !!p && (filter === "ALL" || p.position === filter));

  async function pick(playerId: string) {
    setPending(playerId);
    try {
      await api.draftPick(id, playerId);
      detail.reload();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setPending(null);
    }
  }

  async function undo() {
    try {
      await api.undoPick(id);
      detail.reload();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <Layout>
      <div className="space-y-5">
        <header>
          <Link to={`/games/${id}`} className="label inline-flex items-center gap-1 hover:text-chalk">
            <ArrowLeft size={13} /> Game
          </Link>
          <h1 className="mt-2 font-display text-[40px] font-black uppercase leading-[0.9]">The Draft</h1>
        </header>

        {/* Turn banner */}
        <div
          className={clsx(
            "sticky top-[49px] z-20 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-lg",
            myTurn ? "bg-volt text-ink" : "border border-white/10 bg-turf/95 backdrop-blur",
          )}
          aria-live="polite"
        >
          {view.turn ? (
            <span className={clsx("relative flex h-3 w-3", myTurn && "text-ink")}>
              <span className={clsx("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", myTurn ? "bg-ink" : view.turn === "home" ? "bg-volt" : "bg-flare")} />
              <span className={clsx("relative inline-flex h-3 w-3 rounded-full", myTurn ? "bg-ink" : view.turn === "home" ? "bg-volt" : "bg-flare")} />
            </span>
          ) : null}
          <div className="flex-1">
            <div className="font-display text-2xl font-black uppercase leading-none">
              {!view.turn ? "Draft complete" : myTurn ? "You're on the clock" : `${teamName(game, view.turn, capName(view.turn))} picking`}
            </div>
            <div className={clsx("text-sm", myTurn ? "text-ink/70" : "text-muted")}>
              {!view.turn
                ? "Everyone signed up has a team."
                : myTeam
                  ? myTurn ? "Tap a player to add them to your squad." : "Hang tight. The list updates live."
                  : "Only this week's captains can pick."}
            </div>
          </div>
          {myTeam && view.lastPick?.team === myTeam && (
            <button onClick={undo} className={clsx("btn min-h-9 px-2.5 text-sm", myTurn ? "border-2 border-ink/70" : "btn-ghost")} aria-label="Undo my last pick">
              <Undo2 size={16} /> Undo
            </button>
          )}
        </div>

        {/* Squads */}
        <div className="grid grid-cols-2 gap-3">
          {(["home", "away"] as const).map((t) => {
            const squad = view.squad(t);
            return (
              <div key={t} className={clsx("card p-3", myTeam === t && (t === "home" ? "border-volt/40" : "border-flare/40"))}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className={clsx("truncate font-display text-lg font-extrabold uppercase", t === "home" ? "text-volt" : "text-flare")}>
                    {teamName(game, t, capName(t))}
                  </span>
                  <span className="font-mono text-xs text-muted">{squad.length}/{game.max_per_team}</span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {squad.length === 0 && <li className="text-xs text-muted">No picks yet</li>}
                  {squad.map((a) => {
                    const p = byId.get(a.player_id);
                    return (
                      <li key={a.player_id} className="flex items-center gap-2 text-sm animate-rise">
                        <span className="w-4 text-right font-mono text-[10px] text-muted">{a.pick_number || <Crown size={10} className="inline" />}</span>
                        <Avatar profile={p} size={22} />
                        <span className="truncate">{p?.full_name.split(" ")[0]} {p?.full_name.split(" ").slice(1).join(" ").charAt(0)}.</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        {myTeam && view.squad(myTeam).length > 0 && (
          <Link to={`/games/${id}/lineup`} className="btn-ghost w-full">
            <LayoutGrid size={18} /> Set formation & lineup
          </Link>
        )}

        {/* Available players */}
        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <div className="label">Signed up, not yet picked</div>
              <h2 className="font-display text-2xl font-extrabold uppercase leading-none">Available · {view.pool.length}</h2>
            </div>
          </div>
          <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
            {(["ALL", ...POSITIONS.map((p) => p.value)] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  "min-h-9 shrink-0 rounded-full px-3.5 font-mono text-xs font-semibold uppercase tracking-wider transition",
                  filter === f ? "bg-chalk text-ink" : "bg-white/[0.06] text-muted hover:text-chalk",
                )}
              >
                {f === "ALL" ? "All" : f}
              </button>
            ))}
          </div>
          {pool.length === 0 ? (
            <div className="card p-4 text-sm text-muted">{view.pool.length === 0 ? "Nobody left to pick." : "No one available in that position."}</div>
          ) : (
            <ul className="card divide-y divide-white/[0.06] overflow-hidden">
              {pool.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => pick(p.id)}
                    disabled={!myTurn || pending !== null}
                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition enabled:hover:bg-volt/[0.06] enabled:active:bg-volt/10"
                  >
                    <Avatar profile={p} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{p.full_name}</div>
                      <PositionTag position={p.position} />
                    </div>
                    {myTurn && (
                      <span className="rounded-lg bg-volt px-3 py-1.5 font-display text-base font-extrabold uppercase text-ink">
                        {pending === p.id ? "…" : "Pick"}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Layout>
  );
}
