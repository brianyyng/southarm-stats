import { createClient, type PostgrestError } from "@supabase/supabase-js";
import type { Assignment, Game, GameListItem, PlayerStatLine, Profile, Signup, WaitlistEntry } from "../types";
import type { Api } from "./types";

function check<T>(res: { data: T; error: PostgrestError | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export function createSupabaseApi(url: string, anonKey: string): Api {
  const sb = createClient(url, anonKey);
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const { error } = await sb.rpc(fn, args);
    if (error) throw new Error(error.message);
  };

  return {
    mode: "supabase",

    async currentUserId() {
      const { data } = await sb.auth.getSession();
      return data.session?.user.id ?? null;
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => cb(session?.user.id ?? null));
      return () => data.subscription.unsubscribe();
    },
    async signInWithPassword(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    },
    async signUpWithPassword(email, password, fullName) {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/profile` },
      });
      if (error) throw new Error(error.message);
      return { needsConfirmation: !data.session };
    },
    async signInWithGoogle() {
      const { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw new Error(error.message);
    },
    async signOut() {
      await sb.auth.signOut();
    },

    async getProfile(id) {
      return check(await sb.from("profiles").select("id, full_name, position, headshot_url").eq("id", id).maybeSingle()) as Profile | null;
    },
    async listProfiles() {
      return check(await sb.from("profiles").select("id, full_name, position, headshot_url")) as Profile[];
    },
    async updateProfile(id, patch) {
      return check(
        await sb.from("profiles").update(patch).eq("id", id).select("id, full_name, position, headshot_url").single(),
      ) as Profile;
    },
    async uploadHeadshot(userId, file) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/headshot-${Date.now()}.${ext}`;
      const { error } = await sb.storage.from("headshots").upload(path, file, { upsert: true });
      if (error) throw new Error(error.message);
      return sb.storage.from("headshots").getPublicUrl(path).data.publicUrl;
    },

    async listGames() {
      const rows = check(
        await sb.from("games").select("*, game_signups(player_id)").neq("status", "cancelled").order("kickoff_at"),
      ) as (Game & { game_signups: { player_id: string }[] })[];
      return rows.map(({ game_signups, ...g }): GameListItem => ({ ...g, signup_ids: game_signups.map((s) => s.player_id) }));
    },
    async getGameDetail(gameId) {
      const [game, signups, waitlist, assignments] = await Promise.all([
        sb.from("games").select("*").eq("id", gameId).single(),
        sb.from("game_signups").select("*").eq("game_id", gameId).order("created_at"),
        sb.from("waitlist").select("*").eq("game_id", gameId).order("created_at"),
        sb.from("team_assignments").select("*").eq("game_id", gameId).order("pick_number"),
      ]);
      return {
        game: check(game) as Game,
        signups: check(signups) as Signup[],
        // Signed-out visitors can't read the waitlist; show it as empty rather than failing.
        waitlist: (waitlist.data ?? []) as WaitlistEntry[],
        assignments: check(assignments) as Assignment[],
      };
    },
    async signUpForGame(gameId, userId) {
      const { error } = await sb.from("game_signups").insert({ game_id: gameId, player_id: userId });
      if (error) {
        throw new Error(
          error.code === "42501" ? "Sign-ups for this game aren't open, or it's already full." : error.message,
        );
      }
    },
    async withdrawFromGame(gameId, userId) {
      check(await sb.from("game_signups").delete().eq("game_id", gameId).eq("player_id", userId));
    },
    async addToWaitlist(gameId, playerName, referredBy, userId) {
      check(
        await sb
          .from("waitlist")
          .insert({ game_id: gameId, player_name: playerName, referred_by: referredBy, added_by: userId }),
      );
    },
    async removeFromWaitlist(entryId) {
      check(await sb.from("waitlist").delete().eq("id", entryId));
    },
    watchGame(gameId, cb) {
      const channel = sb.channel(`game-${gameId}`);
      for (const table of ["game_signups", "waitlist", "team_assignments"]) {
        channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `game_id=eq.${gameId}` }, cb);
      }
      channel.on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, cb);
      channel.subscribe();
      return () => {
        sb.removeChannel(channel);
      };
    },

    startDraft: (gameId) => rpc("start_draft", { p_game: gameId }),
    draftPick: (gameId, playerId) => rpc("draft_pick", { p_game: gameId, p_player: playerId }),
    undoPick: (gameId) => rpc("undo_pick", { p_game: gameId }),
    setFormation: (gameId, formation) => rpc("set_formation", { p_game: gameId, p_formation: formation }),
    assignSlot: (gameId, playerId, slot) => rpc("assign_slot", { p_game: gameId, p_player: playerId, p_slot: slot }),

    async playerStats() {
      return check(await sb.from("player_stats").select("*")) as PlayerStatLine[];
    },
  };
}
