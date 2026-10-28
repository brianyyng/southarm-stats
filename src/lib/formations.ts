export interface Slot {
  id: string;
  label: string;
  /** Percent from the left touchline. */
  x: number;
  /** Percent from the team's own goal line (0 = keeper, 100 = halfway). */
  y: number;
}

const row = (y: number, labels: string[]): Slot[] =>
  labels.map((label, i) => ({
    id: `${label}-${y}-${i}`,
    label,
    x: ((i + 1) / (labels.length + 1)) * 100,
    y,
  }));

const GK: Slot[] = [{ id: "GK", label: "GK", x: 50, y: 7 }];

export const FORMATIONS: Record<string, Slot[]> = {
  "4-3-3": [...GK, ...row(28, ["LB", "CB", "CB", "RB"]), ...row(55, ["CM", "CM", "CM"]), ...row(82, ["LW", "ST", "RW"])],
  "4-4-2": [...GK, ...row(28, ["LB", "CB", "CB", "RB"]), ...row(55, ["LM", "CM", "CM", "RM"]), ...row(82, ["ST", "ST"])],
  "4-2-3-1": [
    ...GK,
    ...row(26, ["LB", "CB", "CB", "RB"]),
    ...row(45, ["DM", "DM"]),
    ...row(65, ["LAM", "CAM", "RAM"]),
    ...row(86, ["ST"]),
  ],
  "3-5-2": [...GK, ...row(28, ["CB", "CB", "CB"]), ...row(55, ["LWB", "CM", "CM", "CM", "RWB"]), ...row(82, ["ST", "ST"])],
  "3-4-3": [...GK, ...row(28, ["CB", "CB", "CB"]), ...row(55, ["LM", "CM", "CM", "RM"]), ...row(82, ["LW", "ST", "RW"])],
};

export const FORMATION_NAMES = Object.keys(FORMATIONS);

export function slotsFor(formation: string): Slot[] {
  return FORMATIONS[formation] ?? FORMATIONS["4-3-3"];
}
