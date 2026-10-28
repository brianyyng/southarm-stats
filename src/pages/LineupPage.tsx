import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import clsx from "clsx";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Avatar, ErrorNote, PositionTag, Skeleton, toast } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { FORMATION_NAMES, slotsFor, type Slot } from "../lib/formations";
import { captainTeam, teamName } from "../lib/game";
import { useGameDetail, useProfiles } from "../lib/hooks";
import type { Assignment, Profile, Team } from "../lib/types";

const BENCH = "__bench";

// Drop wherever the finger/cursor is; fall back to overlap for near-misses on small slots.
const dropTarget: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

export default function LineupPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const { userId } = useAuth();
  const detail = useGameDetail(id);
  const profiles = useProfiles();
  // Local copy so drags feel instant; resynced whenever the server copy changes.
  const [local, setLocal] = useState<Assignment[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  useEffect(() => {
    setLocal(detail.data?.assignments ?? null);
  }, [detail.data]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // A short press-and-hold starts a drag on touch, so normal swipes still scroll.
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  const game = detail.data?.game;
  const myTeam = game ? captainTeam(game, userId ?? undefined) : null;
  const team: Team = (params.get("team") as Team) ?? myTeam ?? "home";
  const editable = myTeam === team && game?.status === "scheduled";
  const formation = game ? (team === "home" ? game.home_formation : game.away_formation) : "4-3-3";
  const slots = useMemo(() => slotsFor(formation), [formation]);

  if (detail.error) return <Layout><ErrorNote message={detail.error} /></Layout>;
  if (!game || !local || !profiles.data) {
    return <Layout><div className="space-y-4"><Skeleton className="h-20" /><Skeleton className="aspect-[3/4]" /></div></Layout>;
  }

  const byId = profiles.byId;
  const squad = local.filter((a) => a.team === team);
  const bySlot = new Map(squad.filter((a) => a.slot).map((a) => [a.slot!, a]));
  const bench = squad.filter((a) => !a.slot || !slots.some((s) => s.id === a.slot));
  const capName = (t: Team) => byId.get((t === "home" ? game.home_captain_id : game.away_captain_id) ?? "")?.full_name;

  async function move(playerId: string, slot: string | null) {
    if (!editable || !local) return;
    const moving = local.find((a) => a.player_id === playerId);
    if (!moving || moving.slot === slot) return;
    // Same swap rule as the assign_slot RPC.
    setLocal(
      local.map((a) => {
        if (a.player_id === playerId) return { ...a, slot };
        if (slot && a.team === team && a.slot === slot) return { ...a, slot: moving.slot };
        return a;
      }),
    );
    setSelected(null);
    try {
      await api.assignSlot(id, playerId, slot);
    } catch (e) {
      toast((e as Error).message);
      detail.reload();
    }
  }

  function tapPlayer(playerId: string) {
    if (!editable) return;
    if (selected && selected !== playerId) {
      // Tapping a second player swaps them (or sends the pitch player to the bench).
      const target = local!.find((a) => a.player_id === playerId);
      if (target?.slot) return move(selected, target.slot);
      const sel = local!.find((a) => a.player_id === selected);
      if (sel?.slot) return move(playerId, sel.slot);
    }
    setSelected(selected === playerId ? null : playerId);
  }

  function tapSlot(slot: Slot) {
    if (!editable) return;
    const occupant = bySlot.get(slot.id);
    if (selected) return move(selected, slot.id);
    if (occupant) setSelected(occupant.player_id);
  }

  function onDragStart(e: DragStartEvent) {
    setDragging(String(e.active.id));
    setSelected(null);
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    if (!e.over) return;
    const target = String(e.over.id);
    move(String(e.active.id), target === BENCH ? null : target);
  }

  async function changeFormation(f: string) {
    try {
      await api.setFormation(id, f);
      detail.reload();
    } catch (err) {
      toast((err as Error).message);
    }
  }

  return (
    <Layout>
      <div className="space-y-4">
        <header>
          <Link to={`/games/${id}`} className="label inline-flex items-center gap-1 hover:text-chalk">
            <ArrowLeft size={13} /> Game
          </Link>
          <h1 className="mt-2 font-display text-[40px] font-black uppercase leading-[0.9]">Lineup</h1>
        </header>

        {/* Team switch */}
        <div className="grid grid-cols-2 rounded-xl bg-white/[0.05] p-1">
          {(["home", "away"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setParams({ team: t }, { replace: true })}
              className={clsx(
                "min-h-10 truncate rounded-lg px-2 font-display text-lg font-extrabold uppercase transition",
                team === t ? (t === "home" ? "bg-volt text-ink" : "bg-flare text-ink") : "text-muted",
              )}
            >
              {teamName(game, t, capName(t))}
              {myTeam === t && <span className="ml-1 text-xs opacity-70">(you)</span>}
            </button>
          ))}
        </div>

        {/* Formation picker */}
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {FORMATION_NAMES.map((f) => (
            <button
              key={f}
              disabled={!editable && f !== formation}
              onClick={() => f !== formation && changeFormation(f)}
              className={clsx(
                "min-h-9 shrink-0 rounded-full px-3.5 font-mono text-sm font-semibold transition",
                f === formation ? "bg-chalk text-ink" : "bg-white/[0.06] text-muted enabled:hover:text-chalk disabled:opacity-30",
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {editable && (
          <p className="text-sm text-muted">
            Drag players onto the pitch (press and hold on mobile), or tap a player then tap a spot.
          </p>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={dropTarget}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragging(null)}
        >
          <Pitch team={team}>
            {slots.map((slot) => {
              const a = bySlot.get(slot.id);
              return (
                <SlotSpot key={slot.id} slot={slot} editable={editable} highlight={!!selected && !a} onTap={() => tapSlot(slot)}>
                  {a && (
                    <PlayerToken
                      id={a.player_id}
                      profile={byId.get(a.player_id)}
                      team={team}
                      editable={editable}
                      selected={selected === a.player_id}
                      onTap={() => tapPlayer(a.player_id)}
                    />
                  )}
                </SlotSpot>
              );
            })}
          </Pitch>

          <BenchArea editable={editable} active={!!selected && !!local.find((a) => a.player_id === selected)?.slot} onTap={() => selected && move(selected, null)}>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="font-display text-xl font-extrabold uppercase">Bench</span>
              <span className="font-mono text-xs text-muted">{squad.length - bench.length}/11 on the pitch · {squad.length} in squad</span>
            </div>
            {squad.length === 0 ? (
              <p className="text-sm text-muted">No players drafted yet.</p>
            ) : bench.length === 0 ? (
              <p className="text-sm text-muted">Everyone's on the pitch.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {bench.map((a) => (
                  <BenchRow
                    key={a.player_id}
                    id={a.player_id}
                    profile={byId.get(a.player_id)}
                    editable={editable}
                    selected={selected === a.player_id}
                    onTap={() => tapPlayer(a.player_id)}
                  />
                ))}
              </ul>
            )}
          </BenchArea>

          <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
            {dragging ? <TokenFace profile={byId.get(dragging)} team={team} lifted /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </Layout>
  );
}

function Pitch({ team, children }: { team: Team; children: ReactNode }) {
  return (
    <div
      className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-3xl border border-white/10"
      style={{
        background:
          "repeating-linear-gradient(180deg, #1c5a3c 0 12.5%, #19523a 12.5% 25%)",
      }}
    >
      {/* Chalk markings: our half, own goal at the bottom. */}
      <svg viewBox="0 0 300 400" className="absolute inset-0 h-full w-full text-white/35" preserveAspectRatio="none" aria-hidden>
        <g fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="8" y="8" width="284" height="384" rx="2" />
          <line x1="8" y1="8" x2="292" y2="8" />
          <path d="M100 8 a50 50 0 0 0 100 0" />
          <rect x="70" y="322" width="160" height="70" />
          <rect x="115" y="364" width="70" height="28" />
          <path d="M115 322 a40 40 0 0 1 70 0" />
        </g>
        <circle cx="150" cy="342" r="2.5" fill="currentColor" />
      </svg>
      <div className={clsx("absolute inset-x-0 bottom-0 h-1", team === "home" ? "bg-volt" : "bg-flare")} />
      {children}
    </div>
  );
}

function SlotSpot({
  slot,
  editable,
  highlight,
  onTap,
  children,
}: {
  slot: Slot;
  editable: boolean;
  highlight: boolean;
  onTap: () => void;
  children?: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slot.id, disabled: !editable });
  // The drop zone is the inner div: dnd-kit measures an element without its own
  // transform, so it must not be the element doing the centring translate.
  return (
    <div className="absolute w-[68px] -translate-x-1/2 translate-y-1/2" style={{ left: `${slot.x}%`, bottom: `${slot.y}%` }}>
      <div ref={setNodeRef} className="relative flex flex-col items-center">
        {children ?? (
          <button
            type="button"
            onClick={onTap}
            disabled={!editable}
            className={clsx(
              "flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed font-mono text-[10px] font-semibold transition",
              isOver ? "scale-110 border-volt bg-volt/20 text-volt" : highlight ? "border-volt/80 text-volt" : "border-white/40 text-white/70",
            )}
          >
            {slot.label}
          </button>
        )}
        {children && isOver && <span className="pointer-events-none absolute -inset-1 rounded-full ring-2 ring-volt" />}
      </div>
    </div>
  );
}

function TokenFace({ profile, team, selected, lifted }: { profile?: Profile; team: Team; selected?: boolean; lifted?: boolean }) {
  const [first, ...rest] = (profile?.full_name ?? "").split(" ");
  return (
    <div className={clsx("flex w-[68px] flex-col items-center transition", lifted && "scale-110 drop-shadow-2xl")}>
      <span className={clsx("rounded-full", selected && "ring-2 ring-chalk ring-offset-2 ring-offset-[#1c5a3c]")}>
        <Avatar profile={profile} size={46} ring={team === "home" ? "volt" : "flare"} />
      </span>
      <span className="mt-1 max-w-full truncate rounded bg-ink/80 px-1.5 py-0.5 text-[11px] font-semibold leading-tight">
        {rest.length ? `${first[0]}. ${rest[rest.length - 1]}` : first}
      </span>
    </div>
  );
}

function PlayerToken({
  id,
  profile,
  team,
  editable,
  selected,
  onTap,
}: {
  id: string;
  profile?: Profile;
  team: Team;
  editable: boolean;
  selected: boolean;
  onTap: () => void;
}) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id, disabled: !editable });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={onTap}
      className={clsx("touch-manipulation select-none", isDragging && "opacity-30", editable && "cursor-grab")}
      aria-label={profile?.full_name}
    >
      <TokenFace profile={profile} team={team} selected={selected} />
    </button>
  );
}

function BenchArea({ editable, active, onTap, children }: { editable: boolean; active: boolean; onTap: () => void; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: BENCH, disabled: !editable });
  return (
    <section
      ref={setNodeRef}
      onClick={(e) => e.target === e.currentTarget && active && onTap()}
      className={clsx("card p-3.5 transition", (isOver || active) && "border-volt/50 bg-volt/[0.05]")}
    >
      {children}
      {active && (
        <button onClick={onTap} className="btn-ghost mt-2 w-full min-h-9 text-sm">
          Move to bench
        </button>
      )}
    </section>
  );
}

function BenchRow({ id, profile, editable, selected, onTap }: { id: string; profile?: Profile; editable: boolean; selected: boolean; onTap: () => void }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id, disabled: !editable });
  return (
    <li>
      <button
        ref={setNodeRef}
        type="button"
        {...listeners}
        {...attributes}
        onClick={onTap}
        className={clsx(
          "flex w-full select-none items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition",
          selected ? "bg-volt/15 ring-1 ring-volt" : "bg-white/[0.04] hover:bg-white/[0.07]",
          isDragging && "opacity-30",
          editable && "cursor-grab",
        )}
      >
        <Avatar profile={profile} size={32} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{profile?.full_name}</span>
        <PositionTag position={profile?.position} />
      </button>
    </li>
  );
}
