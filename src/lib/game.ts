import { differenceInCalendarDays, format, isAfter, isBefore, subDays } from "date-fns";
import type { Assignment, Game, Signup, Team } from "./types";

export const SIGNUP_WINDOW_DAYS = 7;

export type SignupState = "not-open" | "open" | "full" | "closed";

export function signupOpensAt(game: Game): Date {
  return subDays(new Date(game.kickoff_at), SIGNUP_WINDOW_DAYS);
}

/** Mirrors `signups_open()` + the capacity check in the database policy. */
export function signupState(game: Game, signupCount: number, now = new Date()): SignupState {
  const kickoff = new Date(game.kickoff_at);
  if (game.status !== "scheduled" || !isBefore(now, kickoff)) return "closed";
  if (isBefore(now, signupOpensAt(game))) return "not-open";
  if (signupCount >= game.max_per_team * 2) return "full";
  return "open";
}

export function teamName(game: Game, team: Team, captainName?: string): string {
  const named = team === "home" ? game.home_name : game.away_name;
  if (named) return named;
  if (captainName) return `Team ${captainName.split(" ")[0]}`;
  return team === "home" ? "Home" : "Away";
}

export function captainTeam(game: Game, userId: string | undefined): Team | null {
  if (!userId) return null;
  if (game.home_captain_id === userId) return "home";
  if (game.away_captain_id === userId) return "away";
  return null;
}

export function kickoffLabel(game: Game): string {
  return format(new Date(game.kickoff_at), "EEE MMM d · h:mm a");
}

export function daysUntil(game: Game, now = new Date()): number {
  return differenceInCalendarDays(new Date(game.kickoff_at), now);
}

export function isUpcoming(game: Game, now = new Date()): boolean {
  return game.status === "scheduled" && isAfter(new Date(game.kickoff_at), now);
}

/** Mirrors `draft_turn()`: home picks first, then alternate, skipping a full team. */
export function draftTurn(game: Game, signups: Signup[], assignments: Assignment[]): Team | null {
  const taken = new Set(assignments.map((a) => a.player_id));
  const captains = new Set([game.home_captain_id, game.away_captain_id]);
  const pool = signups.filter((s) => !taken.has(s.player_id) && !captains.has(s.player_id));
  const homeN = assignments.filter((a) => a.team === "home").length;
  const awayN = assignments.filter((a) => a.team === "away").length;
  const homeFull = homeN >= game.max_per_team;
  const awayFull = awayN >= game.max_per_team;
  if (pool.length === 0 || (homeFull && awayFull)) return null;

  const picks = assignments.filter((a) => a.pick_number > 0).length;
  let turn: Team = picks % 2 === 0 ? "home" : "away";
  if (turn === "home" && homeFull) turn = "away";
  else if (turn === "away" && awayFull) turn = "home";
  return turn;
}
