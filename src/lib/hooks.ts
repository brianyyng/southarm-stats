import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type GameDetail } from "./api";
import type { GameListItem, PlayerStatLine, Profile } from "./types";

export function useAsync<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    load()
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, reload, loading: data === null && error === null };
}

export function useGames() {
  return useAsync<GameListItem[]>(() => api.listGames(), []);
}

export function useProfiles() {
  const res = useAsync<Profile[]>(() => api.listProfiles(), []);
  const byId = useMemo(() => new Map((res.data ?? []).map((p) => [p.id, p])), [res.data]);
  return { ...res, byId };
}

export function usePlayerStats() {
  return useAsync<PlayerStatLine[]>(() => api.playerStats(), []);
}

/** Game detail that stays live: refetches whenever signups, picks or the lineup change. */
export function useGameDetail(gameId: string) {
  const res = useAsync<GameDetail>(() => api.getGameDetail(gameId), [gameId]);
  const { reload } = res;
  useEffect(() => api.watchGame(gameId, reload), [gameId, reload]);
  return res;
}
