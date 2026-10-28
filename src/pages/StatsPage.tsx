import clsx from "clsx";
import { Search } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Avatar, ErrorNote, PositionTag, SectionTitle, Skeleton } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { usePlayerStats } from "../lib/hooks";
import { POSITIONS, type PlayerStatLine, type Position } from "../lib/types";

type SortKey = "goals" | "assists" | "potm" | "dotm" | "games_played";

const COLUMNS: { key: SortKey; short: string; long: string }[] = [
  { key: "goals", short: "G", long: "Goals" },
  { key: "assists", short: "A", long: "Assists" },
  { key: "potm", short: "POM", long: "Player of the Match" },
  { key: "dotm", short: "DOM", long: "Defender of the Match" },
];

export default function StatsPage() {
  const stats = usePlayerStats();
  const { userId } = useAuth();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<Position | "ALL">("ALL");
  const sort = (COLUMNS.some((c) => c.key === params.get("sort")) ? params.get("sort") : "goals") as SortKey;

  const rows = (stats.data ?? [])
    .filter((p) => (pos === "ALL" || p.position === pos) && p.full_name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b[sort] - a[sort] || b.goals - a.goals || b.assists - a.assists || a.full_name.localeCompare(b.full_name));

  return (
    <Layout>
      <SectionTitle kicker="All-time · drop-in" title="Player Stats" />

      <div className="mb-3 flex gap-2">
        <label className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Find a player" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <select className="input w-auto pr-8" value={pos} onChange={(e) => setPos(e.target.value as Position | "ALL")} aria-label="Position">
          <option value="ALL">All</option>
          {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.value}</option>)}
        </select>
      </div>

      {stats.error && <ErrorNote message={stats.error} />}
      {!stats.data ? (
        <Skeleton className="h-[480px]" />
      ) : (
        <div className="card overflow-hidden">
          <div className="sticky top-[49px] z-10 grid grid-cols-[1.75rem_1fr_repeat(4,2.4rem)] items-center gap-1 border-b border-white/[0.07] bg-turf px-3 py-2 sm:grid-cols-[2rem_1fr_repeat(4,3.5rem)]">
            <span className="label">#</span>
            <span className="label">Player</span>
            {COLUMNS.map((c) => (
              <button
                key={c.key}
                onClick={() => setParams({ sort: c.key }, { replace: true })}
                title={c.long}
                aria-label={`Sort by ${c.long}`}
                className={clsx(
                  "rounded-md py-1 text-center font-mono text-[10px] font-semibold uppercase tracking-wider transition",
                  sort === c.key ? "bg-volt text-ink" : "text-muted hover:text-chalk",
                )}
              >
                {c.short}
              </button>
            ))}
          </div>
          {rows.length === 0 ? (
            <div className="p-4 text-sm text-muted">No players match.</div>
          ) : (
            <ol className="divide-y divide-white/[0.05]">
              {rows.map((p, i) => <Row key={p.player_id} line={p} rank={i + 1} sort={sort} me={p.player_id === userId} />)}
            </ol>
          )}
        </div>
      )}
      <p className="mt-3 text-center font-mono text-[11px] text-muted">G goals · A assists · POM player of the match · DOM defender of the match</p>
    </Layout>
  );
}

function Row({ line, rank, sort, me }: { line: PlayerStatLine; rank: number; sort: SortKey; me: boolean }) {
  return (
    <li
      className={clsx(
        "grid grid-cols-[1.75rem_1fr_repeat(4,2.4rem)] items-center gap-1 px-3 py-2.5 sm:grid-cols-[2rem_1fr_repeat(4,3.5rem)]",
        me && "bg-volt/[0.06]",
      )}
    >
      <span className={clsx("font-display text-lg font-black", rank <= 3 ? "text-volt" : "text-muted")}>{rank}</span>
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar profile={line} size={36} />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold leading-tight">{line.full_name}</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <PositionTag position={line.position} />
            <span className="font-mono text-[10px] text-muted">{line.games_played} GP</span>
          </div>
        </div>
      </div>
      {COLUMNS.map((c) => (
        <span
          key={c.key}
          className={clsx(
            "text-center font-display text-xl font-extrabold tabular-nums",
            sort === c.key ? "text-chalk" : "text-chalk/45",
            line[c.key] === 0 && "text-chalk/20",
          )}
        >
          {line[c.key]}
        </span>
      ))}
    </li>
  );
}
