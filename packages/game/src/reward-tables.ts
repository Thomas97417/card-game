import reference from "./data/mighty-party-chests.json";
import { leagueAt } from "./leagues";

export type RewardRange = readonly number[];
type RewardTable = Record<string, (number[] | null)[]>;
export type RewardTableId =
  | "rare"
  | "bigRare"
  | "epic"
  | "legendary"
  | "wins"
  | "demigods"
  | "gods";

/** Our 31 ascending divisions map to wiki leagues 30…1, GM. */
export function rewardLeague(trophies: number) {
  const index = leagueAt(trophies).index;
  return index === 30 ? "GM" : String(30 - index);
}

export function rewardRow(tableId: RewardTableId, trophies: number) {
  const table: RewardTable = reference[tableId];
  const league = rewardLeague(trophies);
  // The wiki omits some early leagues. Use its earliest documented row.
  const first = Math.max(
    ...Object.keys(table)
      .filter((key) => key !== "GM")
      .map(Number),
  );
  return table[
    league === "GM" ? league : String(Math.min(Number(league), first))
  ]!;
}

export function rollReward(range: RewardRange, random: () => number) {
  const min = range[0]!;
  const max = range[1] ?? min;
  return min + Math.floor(random() * (max - min + 1));
}
