import clsx from "clsx";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Wordmark } from "../components/Layout";
import { Avatar, ErrorNote } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { DEMO_IDS, demoSignInAs } from "../lib/api/demoApi";
import { useProfiles } from "../lib/hooks";

export default function SignInPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { userId, needsProfile } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/";

  useEffect(() => {
    if (userId) navigate(needsProfile ? "/profile" : from, { replace: true });
  }, [userId, needsProfile, from, navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        await api.signInWithPassword(email, password);
      } else {
        const { needsConfirmation } = await api.signUpWithPassword(email, password, name);
        if (needsConfirmation) setNotice(`Check ${email} for a confirmation link, then come back to finish your profile.`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    try {
      await api.signInWithGoogle();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-[max(env(safe-area-inset-top),16px)]">
      <div className="py-3"><Wordmark /></div>

      <div className="mt-8 animate-rise">
        <div className="label">Weekly drop-in · Southarm</div>
        <h1 className="mt-1 font-display text-[56px] font-black uppercase leading-[0.85]">
          {mode === "signin" ? <>Back on<br /><span className="text-volt">the pitch</span></> : <>Pull on<br /><span className="text-volt">the boots</span></>}
        </h1>
      </div>

      <button onClick={google} className="btn mt-8 w-full bg-chalk text-ink normal-case">
        <GoogleMark /> <span className="font-sans text-base font-semibold">Continue with Google</span>
      </button>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-white/10" />
        <span className="label">or with email</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <div className="mb-4 grid grid-cols-2 rounded-xl bg-white/[0.05] p-1">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(null); }}
            className={clsx("min-h-10 rounded-lg font-display text-lg font-extrabold uppercase transition", mode === m ? "bg-turf-2 text-chalk" : "text-muted")}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      {notice ? (
        <div className="card p-4 text-sm">{notice}</div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <Field label="Full name">
              <input className="input" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          )}
          <Field label="Email">
            <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <input
              className="input"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <ErrorNote message={error} />}
          <button className="btn-volt w-full text-xl" disabled={busy}>
            {busy ? "One sec…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
      )}

      {api.mode === "demo" && <DemoPicker />}

      <Link to="/" className="label mt-8 text-center hover:text-chalk">← Back to the scores</Link>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function DemoPicker() {
  const { byId } = useProfiles();
  const choices = [
    { id: DEMO_IDS.homeCaptain, role: "Captain this week" },
    { id: DEMO_IDS.awayCaptain, role: "Other captain" },
    { id: DEMO_IDS.regular, role: "Regular player" },
  ];
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-volt/40 p-4">
      <div className="label text-volt">Demo mode</div>
      <p className="mt-1 text-sm text-muted">No Supabase keys set, so this runs on sample data. Jump in as:</p>
      <div className="mt-3 space-y-2">
        {choices.map((c) => (
          <button key={c.id} onClick={() => demoSignInAs(c.id)} className="flex w-full items-center gap-3 rounded-xl bg-white/[0.05] px-3 py-2 text-left hover:bg-white/[0.08]">
            <Avatar profile={byId.get(c.id)} size={32} />
            <span className="flex-1 text-sm font-semibold">{byId.get(c.id)?.full_name}</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{c.role}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
