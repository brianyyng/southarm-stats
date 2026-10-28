export type Position = "GK" | "DEF" | "MID" | "FWD";
export type Team = "home" | "away";

export const POSITIONS: { value: Position; label: string }[] = [
  { value: "GK", label: "Goalkeeper" },
  { value: "DEF", label: "Defender" },
  { value: "MID", label: "Midfielder" },
  { value: "FWD", label: "Forward" },
];

export interface Profile {
  id: string;
  full_name: string;
  position: Position | null;
  headshot_url: string | null;
}

export interface Game {
  id: string;
  kickoff_at: string;
  location: string;
  status: "scheduled" | "completed" | "cancelled";
  home_captain_id: string | null;
  away_captain_id: string | null;
  home_name: string | null;
  away_name: string | null;
  home_score: number | null;
  away_score: number | null;
  home_formation: string;
  away_formation: string;
  max_per_team: number;
}

export interface GameListItem extends Game {
  /** Ids of everyone signed up for the game. */
  signup_ids: string[];
}

export interface Signup {
  game_id: string;
  player_id: string;
  created_at: string;
}

export interface WaitlistEntry {
  id: string;
  game_id: string;
  player_name: string;
  referred_by: string;
  added_by: string | null;
  created_at: string;
}

export interface Assignment {
  game_id: string;
  player_id: string;
  team: Team;
  pick_number: number;
  slot: string | null;
}

export interface PlayerStatLine {
  player_id: string;
  full_name: string;
  position: Position | null;
  headshot_url: string | null;
  games_played: number;
  goals: number;
  assists: number;
  potm: number;
  dotm: number;
}
