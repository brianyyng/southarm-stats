import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import type { Profile } from "../lib/types";

interface AuthValue {
  userId: string | null;
  profile: Profile | null;
  loading: boolean;
  /** Signed in but hasn't finished their profile (name + position). */
  needsProfile: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (id: string | null) => {
    setProfile(id ? await api.getProfile(id) : null);
  }, []);

  useEffect(() => {
    let alive = true;
    api.currentUserId().then(async (id) => {
      if (!alive) return;
      setUserId(id);
      await loadProfile(id);
      if (alive) setLoading(false);
    });
    const off = api.onAuthChange((id) => {
      setUserId(id);
      // Supabase warns against awaiting other calls inside its auth callback.
      setTimeout(() => loadProfile(id), 0);
    });
    return () => {
      alive = false;
      off();
    };
  }, [loadProfile]);

  const value: AuthValue = {
    userId,
    profile,
    loading,
    needsProfile: !!userId && !!profile && (!profile.full_name || !profile.position),
    refreshProfile: () => loadProfile(userId),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
