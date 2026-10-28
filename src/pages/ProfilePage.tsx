import clsx from "clsx";
import { Camera, LogOut } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Avatar, ErrorNote, Skeleton, toast } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { POSITIONS, type Position } from "../lib/types";

export default function ProfilePage() {
  const { userId, profile, loading, needsProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [position, setPosition] = useState<Position | null>(null);
  const [headshot, setHeadshot] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setName(profile.full_name);
    setPosition(profile.position);
    setHeadshot(profile.headshot_url);
  }, [profile]);

  if (!loading && !userId) return <Navigate to="/signin" state={{ from: "/profile" }} replace />;
  if (!profile) return <Layout><Skeleton className="h-96" /></Layout>;

  async function pickFile(file: File | undefined) {
    if (!file || !userId) return;
    if (!file.type.startsWith("image/")) return setError("Choose an image file.");
    if (file.size > 5 * 1024 * 1024) return setError("That photo is over 5 MB. Try a smaller one.");
    setError(null);
    setUploading(true);
    try {
      setHeadshot(await api.uploadHeadshot(userId, file));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!name.trim()) return setError("Add your full name.");
    if (!position) return setError("Pick the position you usually play.");
    setSaving(true);
    setError(null);
    const firstTime = needsProfile;
    try {
      await api.updateProfile(userId, { full_name: name.trim(), position, headshot_url: headshot });
      await refreshProfile();
      toast("Profile saved.");
      if (firstTime) navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <form onSubmit={save} className="space-y-6">
        <div>
          <div className="label">{needsProfile ? "One last step" : "Your player card"}</div>
          <h1 className="font-display text-[40px] font-black uppercase leading-[0.9]">
            {needsProfile ? "Build your profile" : "Profile"}
          </h1>
        </div>

        {/* Player card */}
        <div className="card relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-6 -top-8 font-display text-[160px] font-black leading-none text-white/[0.04]">
            {position ?? "?"}
          </div>
          <div className="relative flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group relative rounded-full"
              aria-label="Upload a headshot"
            >
              <Avatar profile={{ full_name: name, headshot_url: headshot }} size={96} ring="volt" />
              <span className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-volt text-ink">
                <Camera size={16} />
              </span>
              {uploading && <span className="absolute inset-0 flex items-center justify-center rounded-full bg-ink/70 text-xs">Uploading…</span>}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
            <div className="min-w-0">
              <div className="truncate font-display text-3xl font-black uppercase leading-none">{name || "Your name"}</div>
              <div className="mt-1 text-sm text-muted">{POSITIONS.find((p) => p.value === position)?.label ?? "Position"}</div>
            </div>
          </div>
        </div>

        <label className="block">
          <span className="label mb-1.5 block">Full name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
        </label>

        <fieldset>
          <legend className="label mb-1.5">Position</legend>
          <div className="grid grid-cols-2 gap-2">
            {POSITIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPosition(p.value)}
                aria-pressed={position === p.value}
                className={clsx(
                  "flex min-h-14 flex-col items-start justify-center rounded-xl border px-3.5 text-left transition",
                  position === p.value ? "border-volt bg-volt/10" : "border-white/10 hover:border-white/25",
                )}
              >
                <span className={clsx("font-display text-xl font-black", position === p.value && "text-volt")}>{p.value}</span>
                <span className="text-xs text-muted">{p.label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {error && <ErrorNote message={error} />}
        <button className="btn-volt w-full text-xl" disabled={saving || uploading}>
          {saving ? "Saving…" : needsProfile ? "Let's play" : "Save profile"}
        </button>

        {!needsProfile && (
          <button
            type="button"
            onClick={async () => { await api.signOut(); navigate("/"); }}
            className="btn-ghost w-full"
          >
            <LogOut size={18} /> Sign out
          </button>
        )}
      </form>
    </Layout>
  );
}
