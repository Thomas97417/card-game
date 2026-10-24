/** Chest categories are independent of the rarity of the card inside. */
export const CHEST_TYPES = [
  "common",
  "rare",
  "bigRare",
  "epic",
  "legendary",
] as const;
export type ChestType = (typeof CHEST_TYPES)[number];

/** Exact pool counts from the wiki, rather than its rounded percentages. */
export function chestPoolForLeague(index: number): Record<ChestType, number> {
  const counts =
    index < 10
      ? [109, 28, 9, 0, 0]
      : index === 10
        ? [0, 56, 10, 3, 0]
        : [0, 56, 10, 3, 1];
  return Object.fromEntries(
    CHEST_TYPES.map((type, i) => [type, counts[i]!]),
  ) as Record<ChestType, number>;
}
