import clsx from "clsx";
import { useEffect, useState, type ReactNode } from "react";
import type { Position, Profile } from "../lib/types";

const AVATAR_TONES = ["#1f5c43", "#24485e", "#5a3d2b", "#3f3a63", "#5c2f3a", "#2f5552"];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** Headshot, or a placeholder shirt-tone disc with initials until one is uploaded. */
export function Avatar({
  profile,
  size = 40,
  ring,
}: {
  profile: Pick<Profile, "full_name" | "headshot_url"> | null | undefined;
  size?: number;
  ring?: "volt" | "flare";
}) {
  const name = profile?.full_name ?? "";
  const tone = AVATAR_TONES[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <span
      className={clsx(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-extrabold text-chalk/90",
        ring === "volt" && "ring-2 ring-volt ring-offset-2 ring-offset-ink",
        ring === "flare" && "ring-2 ring-flare ring-offset-2 ring-offset-ink",
      )}
      style={{ width: size, height: size, fontSize: size * 0.38, background: tone }}
      aria-hidden
    >
      {profile?.headshot_url ? (
        <img src={profile.headshot_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <>
          <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full opacity-25">
            <circle cx="20" cy="15" r="7" fill="currentColor" />
            <path d="M6 40c1-9 7-14 14-14s13 5 14 14z" fill="currentColor" />
          </svg>
          <span className="relative">{initials(name)}</span>
        </>
      )}
    </span>
  );
}

const POS_STYLE: Record<Position, string> = {
  GK: "bg-amber-300/15 text-amber-200",
  DEF: "bg-sky-300/15 text-sky-200",
  MID: "bg-emerald-300/15 text-emerald-200",
  FWD: "bg-rose-300/15 text-rose-200",
};

export function PositionTag({ position }: { position: Position | null | undefined }) {
  if (!position) return null;
  return (
    <span className={clsx("rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider", POS_STYLE[position])}>
      {position}
    </span>
  );
}

export function SectionTitle({ kicker, title, action }: { kicker?: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        {kicker && <div className="label mb-0.5">{kicker}</div>}
        <h2 className="font-display text-2xl font-extrabold uppercase leading-none tracking-wide">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-2xl bg-white/[0.06]", className)} />;
}

export function ErrorNote({ message }: { message: string }) {
  return <div className="rounded-xl border border-flare/30 bg-flare/10 px-4 py-3 text-sm text-flare">{message}</div>;
}

// Tiny toast: one message at a time, bottom of the screen above the thumb zone.
let pushToast: (msg: string) => void = () => {};
export const toast = (msg: string) => pushToast(msg);

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    pushToast = (m) => {
      setMsg(m);
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 2800);
    };
    return () => clearTimeout(timer);
  }, []);
  if (!msg) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 pb-[env(safe-area-inset-bottom)]">
      <div className="animate-rise rounded-xl bg-chalk px-4 py-3 text-sm font-semibold text-ink shadow-2xl">{msg}</div>
    </div>
  );
}
