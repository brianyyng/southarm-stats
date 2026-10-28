import clsx from "clsx";
import { BarChart3, CalendarDays, Home, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { resetDemo } from "../lib/api/demoApi";
import { Avatar } from "./ui";

const NAV = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/stats", label: "Stats", icon: BarChart3 },
  { to: "/profile", label: "Me", icon: UserRound },
];

export function Wordmark() {
  return (
    <Link to="/" className="flex items-baseline gap-1.5 font-display font-black uppercase leading-none tracking-wide">
      <span className="text-[26px]">Southarm</span>
      <span className="text-[26px] text-volt">Stats</span>
    </Link>
  );
}

function NavBar() {
  return (
    <nav className="sticky top-0 z-30 -mx-4 border-b border-white/[0.06] bg-ink/85 px-4 backdrop-blur-md">
      <ul className="mx-auto flex max-w-2xl">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  "relative flex min-h-12 flex-col items-center justify-center gap-0.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors",
                  isActive ? "text-volt" : "text-muted hover:text-chalk",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} strokeWidth={2.2} />
                  {label}
                  {isActive && <span className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-volt" />}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Header, then an optional hero slot (the score carousel on Home), then the sticky nav. */
export function Layout({ top, children }: { top?: ReactNode; children: ReactNode }) {
  const { userId, profile } = useAuth();
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-16 pt-[max(env(safe-area-inset-top),12px)]">
      <header className="flex items-center justify-between py-3">
        <Wordmark />
        {userId ? (
          <Link to="/profile" aria-label="Your profile">
            <Avatar profile={profile} size={36} />
          </Link>
        ) : (
          <Link to="/signin" className="btn-ghost min-h-9 px-3 text-base">
            Sign in
          </Link>
        )}
      </header>
      {top}
      <NavBar />
      <main className="pt-5">{children}</main>
      {api.mode === "demo" && (
        <footer className="mt-12 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center font-mono text-[11px] text-muted">
          <span>Demo mode · sample data in this browser only</span>
          <button onClick={resetDemo} className="underline underline-offset-2 hover:text-chalk">
            Reset demo
          </button>
        </footer>
      )}
    </div>
  );
}
