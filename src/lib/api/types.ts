import type { Assignment, Game, GameListItem, PlayerStatLine, Profile, Signup, WaitlistEntry } from "../types";

export interface GameDetail {
  game: Game;
  signups: Signup[];
  waitlist: WaitlistEntry[];
  assignments: Assignment[];
}

export interface Api {
  mode: "supabase" | "demo";

  // auth
  currentUserId(): Promise<string | null>;
  onAuthChange(cb: (userId: string | null) => void): () => void;
  signInWithPassword(email: string, password: string): Promise<void>;
  signUpWithPassword(email: string, password: string, fullName: string): Promise<{ needsConfirmation: boolean }>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;

  // profiles
  getProfile(id: string): Promise<Profile | null>;
  listProfiles(): Promise<Profile[]>;
  updateProfile(id: string, patch: Partial<Omit<Profile, "id">>): Promise<Profile>;
  uploadHeadshot(userId: string, file: File): Promise<string>;

  // games
  listGames(): Promise<GameListItem[]>;
  getGameDetail(gameId: string): Promise<GameDetail>;
  signUpForGame(gameId: string, userId: string): Promise<void>;
  withdrawFromGame(gameId: string, userId: string): Promise<void>;
  addToWaitlist(gameId: string, playerName: string, referredBy: string, userId: string): Promise<void>;
  removeFromWaitlist(entryId: string): Promise<void>;
  /** Calls `cb` whenever anything about the game changes (signups, picks, lineup). */
  watchGame(gameId: string, cb: () => void): () => void;

  // captain tools
  startDraft(gameId: string): Promise<void>;
  draftPick(gameId: string, playerId: string): Promise<void>;
  undoPick(gameId: string): Promise<void>;
  setFormation(gameId: string, formation: string): Promise<void>;
  assignSlot(gameId: string, playerId: string, slot: string | null): Promise<void>;

  // stats
  playerStats(): Promise<PlayerStatLine[]>;
}
