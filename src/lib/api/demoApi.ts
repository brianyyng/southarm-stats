// Demo mode: the whole backend simulated in localStorage, following the same
// rules as the database policies and RPCs. Used when Supabase keys aren't set.
import { addDays, setHours, setMinutes, startOfDay } from "date-fns";
import { captainTeam, draftTurn, signupState } from "../game";
import type { Assignment, Game, PlayerStatLine, Position, Profile, Signup, WaitlistEntry } from "../types";
import type { Api } from "./types";

interface Account {
  email: string;
  password: string;
  userId: string;
}

interface Stat {
  game_id: string;
  player_id: string;
  goals: number;
  assists: number;
  potm: boolean;
  dotm: boolean;
}

interface DemoState {
  version: 1;
  currentUserId: string | null;
  accounts: Account[];
  profiles: Profile[];
  games: Game[];
  signups: Signup[];
  waitlist: WaitlistEntry[];
  assignments: Assignment[];
  stats: Stat[];
}

const KEY = "southarm-demo-v1";

export const DEMO_IDS = { homeCaptain: "p-01", awayCaptain: "p-02", regular: "p-07" };

const NAMES: [string, Position][] = [
  ["Marco Ferreira", "MID"], ["Daniel Okafor", "DEF"], ["Kenji Watanabe", "FWD"], ["Liam Gallagher", "GK"],
  ["Mateo Rojas", "FWD"], ["Arjun Sandhu", "MID"], ["Jordan Price", "DEF"], ["Samuel Mensah", "MID"],
  ["Tomás Silva", "DEF"], ["Ethan Choi", "FWD"], ["Oliver Brandt", "DEF"], ["Hassan Karimi", "MID"],
  ["Ryan Desjardins", "GK"], ["Nikola Petrović", "DEF"], ["Gabriel Nunes", "FWD"], ["Kwame Asante", "MID"],
  ["Lucas Moreau", "MID"], ["Aiden Murphy", "DEF"], ["Diego Herrera", "FWD"], ["Jun Park", "MID"],
  ["Felix Wagner", "DEF"], ["Ibrahim Diallo", "FWD"], ["Connor Walsh", "MID"], ["Rafael Costa", "DEF"],
  ["Noah Bergström", "GK"], ["Amir Haddad", "MID"], ["Callum Reid", "FWD"], ["Viktor Novak", "DEF"],
  ["Andrés Molina", "MID"], ["Sean Fitzgerald", "DEF"], ["Yusuf Demir", "FWD"], ["Patrick Lam", "MID"],
  ["Elijah Brooks", "DEF"], ["Ming Zhao", "MID"],
];

// Small deterministic PRNG so the sample stats are stable across reloads.
function prng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function seed(): DemoState {
  const rand = prng(42);
  const profiles: Profile[] = NAMES.map(([full_name, position], i) => ({
    id: `p-${String(i + 1).padStart(2, "0")}`,
    full_name,
    position,
    headshot_url: null,
  }));
  const ids = profiles.map((p) => p.id);
  const sunday = (offsetWeeks: number) => {
    const today = startOfDay(new Date());
    const daysToSunday = (7 - today.getDay()) % 7 || 7;
    return setMinutes(setHours(addDays(today, daysToSunday + offsetWeeks * 7), 10), 0).toISOString();
  };

  const games: Game[] = [];
  const signups: Signup[] = [];
  const stats: Stat[] = [];
  const results: [number, number][] = [[3, 2], [2, 2], [4, 1], [1, 3]];

  for (let w = -4; w <= 3; w++) {
    const id = `g${w + 5}`;
    const past = w < 0;
    const homeCap = past ? ids[(w + 4) * 3 % ids.length] : w === 0 ? DEMO_IDS.homeCaptain : null;
    const awayCap = past ? ids[((w + 4) * 3 + 5) % ids.length] : w === 0 ? DEMO_IDS.awayCaptain : null;
    const [hs, as] = past ? results[w + 4] : [null, null];
    games.push({
      id,
      kickoff_at: sunday(w),
      location: "Southarm Park · Field 2",
      status: past ? "completed" : "scheduled",
      home_captain_id: homeCap,
      away_captain_id: awayCap,
      home_name: null,
      away_name: null,
      home_score: hs,
      away_score: as,
      home_formation: "4-3-3",
      away_formation: "4-4-2",
      max_per_team: 15,
    });

    if (past) {
      // ~26 players per past game, goals/assists spread among the outfielders.
      const played = [...ids].sort(() => rand() - 0.5).slice(0, 26);
      for (const pid of played) signups.push({ game_id: id, player_id: pid, created_at: sunday(w - 1) });
      const total = (hs ?? 0) + (as ?? 0);
      const line = new Map<string, Stat>();
      const get = (pid: string) =>
        line.get(pid) ?? line.set(pid, { game_id: id, player_id: pid, goals: 0, assists: 0, potm: false, dotm: false }).get(pid)!;
      const attackers = played.filter((pid) => profiles.find((p) => p.id === pid)?.position !== "GK");
      for (let g = 0; g < total; g++) {
        get(attackers[Math.floor(rand() * attackers.length)]).goals++;
        if (rand() > 0.3) get(attackers[Math.floor(rand() * attackers.length)]).assists++;
      }
      get(attackers[Math.floor(rand() * attackers.length)]).potm = true;
      const defenders = played.filter((pid) => ["DEF", "GK"].includes(profiles.find((p) => p.id === pid)!.position!));
      get(defenders[Math.floor(rand() * defenders.length)]).dotm = true;
      stats.push(...line.values());
    }
  }

  // This week's game: signups are open and 22 players are in, captains included.
  const next = games.find((g) => g.status === "scheduled")!;
  const nextIn = [DEMO_IDS.homeCaptain, DEMO_IDS.awayCaptain, ...ids.filter((id) => !Object.values(DEMO_IDS).includes(id)).slice(0, 20)];
  nextIn.forEach((pid, i) =>
    signups.push({ game_id: next.id, player_id: pid, created_at: new Date(Date.now() - (30 - i) * 3600_000).toISOString() }),
  );

  return {
    version: 1,
    currentUserId: null,
    accounts: [],
    profiles,
    games,
    signups,
    waitlist: [
      {
        id: "w1",
        game_id: next.id,
        player_name: "Chris Tanaka",
        referred_by: "Marco Ferreira",
        added_by: DEMO_IDS.homeCaptain,
        created_at: new Date().toISOString(),
      },
    ],
    assignments: [],
    stats,
  };
}

function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch {
    // fall through to a fresh seed
  }
  return seed();
}

export function resetDemo() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  window.location.reload();
}

export function createDemoApi(): Api {
  let state = load();
  const authListeners = new Set<(id: string | null) => void>();
  const changeListeners = new Set<() => void>();

  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // storage unavailable: keep the in-memory state
    }
    changeListeners.forEach((cb) => cb());
  };

  // Keep two open tabs (e.g. both captains drafting) in sync.
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    const prevUser = state.currentUserId;
    state = load();
    changeListeners.forEach((cb) => cb());
    if (state.currentUserId !== prevUser) authListeners.forEach((cb) => cb(state.currentUserId));
  });

  const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120));
  const me = () => {
    if (!state.currentUserId) throw new Error("Sign in first");
    return state.currentUserId;
  };
  const gameById = (id: string) => {
    const g = state.games.find((x) => x.id === id);
    if (!g) throw new Error("Game not found");
    return g;
  };
  const setUser = (id: string | null) => {
    state.currentUserId = id;
    save();
    authListeners.forEach((cb) => cb(id));
  };
  const newProfile = (fullName: string): Profile => {
    const p = { id: `u-${crypto.randomUUID()}`, full_name: fullName, position: null, headshot_url: null };
    state.profiles.push(p);
    return p;
  };
  const myTeamOrThrow = (gameId: string) => {
    const team = captainTeam(gameById(gameId), me());
    if (!team) throw new Error("Only this week's captains can do that");
    return team;
  };
  const ensureCaptains = (game: Game) => {
    for (const [cap, team] of [[game.home_captain_id, "home"], [game.away_captain_id, "away"]] as const) {
      if (!cap) continue;
      const signedUp = state.signups.some((s) => s.game_id === game.id && s.player_id === cap);
      const placed = state.assignments.some((a) => a.game_id === game.id && a.player_id === cap);
      if (signedUp && !placed) state.assignments.push({ game_id: game.id, player_id: cap, team, pick_number: 0, slot: null });
    }
  };

  return {
    mode: "demo",

    currentUserId: () => delay(state.currentUserId),
    onAuthChange(cb) {
      authListeners.add(cb);
      return () => authListeners.delete(cb);
    },
    async signInWithPassword(email, password) {
      await delay(null);
      const acct = state.accounts.find((a) => a.email === email.toLowerCase() && a.password === password);
      if (!acct) throw new Error("Invalid email or password");
      setUser(acct.userId);
    },
    async signUpWithPassword(email, password, fullName) {
      await delay(null);
      if (state.accounts.some((a) => a.email === email.toLowerCase())) throw new Error("That email already has an account");
      const p = newProfile(fullName);
      state.accounts.push({ email: email.toLowerCase(), password, userId: p.id });
      setUser(p.id);
      return { needsConfirmation: false };
    },
    async signInWithGoogle() {
      await delay(null);
      setUser(newProfile("").id);
    },
    async signOut() {
      setUser(null);
    },

    getProfile: (id) => delay(state.profiles.find((p) => p.id === id) ?? null),
    listProfiles: () => delay([...state.profiles]),
    async updateProfile(id, patch) {
      const p = state.profiles.find((x) => x.id === id);
      if (!p || id !== me()) throw new Error("You can only edit your own profile");
      Object.assign(p, patch);
      save();
      return delay({ ...p });
    },
    uploadHeadshot: (_userId, file) =>
      new Promise((resolve, reject) => {
        // Downscale so the data URL fits comfortably in localStorage.
        const img = new Image();
        img.onload = () => {
          const size = 256;
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = size;
          const s = Math.min(img.width, img.height);
          canvas.getContext("2d")!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
          URL.revokeObjectURL(img.src);
        };
        img.onerror = () => reject(new Error("Couldn't read that image"));
        img.src = URL.createObjectURL(file);
      }),

    listGames: () =>
      delay(
        [...state.games]
          .sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at))
          .map((g) => ({
            ...g,
            signup_ids: state.signups.filter((s) => s.game_id === g.id).map((s) => s.player_id),
          })),
      ),
    getGameDetail: (gameId) =>
      delay({
        game: { ...gameById(gameId) },
        signups: state.signups.filter((s) => s.game_id === gameId),
        waitlist: state.currentUserId ? state.waitlist.filter((w) => w.game_id === gameId) : [],
        assignments: state.assignments
          .filter((a) => a.game_id === gameId)
          .sort((a, b) => a.pick_number - b.pick_number)
          .map((a) => ({ ...a })),
      }),
    async signUpForGame(gameId, userId) {
      if (userId !== me()) throw new Error("You can only sign yourself up");
      const game = gameById(gameId);
      const count = state.signups.filter((s) => s.game_id === gameId).length;
      if (signupState(game, count) !== "open") throw new Error("Sign-ups for this game aren't open, or it's already full.");
      if (!state.signups.some((s) => s.game_id === gameId && s.player_id === userId)) {
        state.signups.push({ game_id: gameId, player_id: userId, created_at: new Date().toISOString() });
      }
      save();
    },
    async withdrawFromGame(gameId, userId) {
      if (userId !== me()) throw new Error("You can only withdraw yourself");
      state.signups = state.signups.filter((s) => !(s.game_id === gameId && s.player_id === userId));
      state.assignments = state.assignments.filter((a) => !(a.game_id === gameId && a.player_id === userId));
      save();
    },
    async addToWaitlist(gameId, playerName, referredBy, userId) {
      if (!playerName.trim()) throw new Error("Enter the new player's name");
      state.waitlist.push({
        id: crypto.randomUUID(),
        game_id: gameId,
        player_name: playerName.trim(),
        referred_by: referredBy.trim(),
        added_by: userId,
        created_at: new Date().toISOString(),
      });
      save();
    },
    async removeFromWaitlist(entryId) {
      const entry = state.waitlist.find((w) => w.id === entryId);
      if (entry?.added_by !== me()) throw new Error("Only the person who added them can remove this entry");
      state.waitlist = state.waitlist.filter((w) => w.id !== entryId);
      save();
    },
    watchGame(_gameId, cb) {
      changeListeners.add(cb);
      return () => changeListeners.delete(cb);
    },

    async startDraft(gameId) {
      myTeamOrThrow(gameId);
      ensureCaptains(gameById(gameId));
      save();
    },
    async draftPick(gameId, playerId) {
      const team = myTeamOrThrow(gameId);
      const game = gameById(gameId);
      if (new Date() >= new Date(game.kickoff_at)) throw new Error("The draft is closed");
      ensureCaptains(game);
      const signups = state.signups.filter((s) => s.game_id === gameId);
      const assignments = state.assignments.filter((a) => a.game_id === gameId);
      if (draftTurn(game, signups, assignments) !== team) throw new Error("It's not your pick");
      if (playerId === game.home_captain_id || playerId === game.away_captain_id) throw new Error("Captains can't be drafted");
      if (!signups.some((s) => s.player_id === playerId)) throw new Error("That player isn't signed up");
      if (assignments.some((a) => a.player_id === playerId)) throw new Error("Already drafted");
      const next = Math.max(0, ...assignments.map((a) => a.pick_number)) + 1;
      state.assignments.push({ game_id: gameId, player_id: playerId, team, pick_number: next, slot: null });
      save();
    },
    async undoPick(gameId) {
      const team = myTeamOrThrow(gameId);
      const last = state.assignments
        .filter((a) => a.game_id === gameId && a.pick_number > 0)
        .sort((a, b) => b.pick_number - a.pick_number)[0];
      if (!last || last.team !== team) throw new Error("You can only undo your own most recent pick");
      state.assignments = state.assignments.filter((a) => a !== last);
      save();
    },
    async setFormation(gameId, formation) {
      const team = myTeamOrThrow(gameId);
      const game = gameById(gameId);
      if (team === "home") game.home_formation = formation;
      else game.away_formation = formation;
      state.assignments.forEach((a) => {
        if (a.game_id === gameId && a.team === team) a.slot = null;
      });
      save();
    },
    async assignSlot(gameId, playerId, slot) {
      const team = myTeamOrThrow(gameId);
      const moving = state.assignments.find((a) => a.game_id === gameId && a.player_id === playerId);
      if (!moving || moving.team !== team) throw new Error("You can only arrange your own team");
      if (slot) {
        const occupant = state.assignments.find((a) => a.game_id === gameId && a.team === team && a.slot === slot);
        if (occupant && occupant !== moving) occupant.slot = moving.slot;
      }
      moving.slot = slot;
      save();
    },

    async playerStats() {
      const lines: PlayerStatLine[] = state.profiles
        .filter((p) => p.full_name)
        .map((p) => {
          const mine = state.stats.filter((s) => s.player_id === p.id);
          const played = state.signups.filter(
            (s) => s.player_id === p.id && state.games.find((g) => g.id === s.game_id)?.status === "completed",
          ).length;
          return {
            player_id: p.id,
            full_name: p.full_name,
            position: p.position,
            headshot_url: p.headshot_url,
            games_played: played,
            goals: mine.reduce((n, s) => n + s.goals, 0),
            assists: mine.reduce((n, s) => n + s.assists, 0),
            potm: mine.filter((s) => s.potm).length,
            dotm: mine.filter((s) => s.dotm).length,
          };
        });
      return delay(lines);
    },
  };
}

/** Demo-only shortcut to sign in as one of the sample players. */
export function demoSignInAs(userId: string) {
  const state = load();
  state.currentUserId = userId;
  localStorage.setItem(KEY, JSON.stringify(state));
  window.location.assign("/");
}
