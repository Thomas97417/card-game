/** Chest categories are independent of the rarity of the card inside. */
export const CHEST_TYPES = [
  "common",
  "rare",
  "bigRare",
  "epic",
  "legendary",
] as const;
export type ChestType = (typeof CHEST_TYPES)[number];

/** Bump when changing pool weights or league availability, to replace saved pools. */
export const CHEST_POOL_VERSION = 1;

/**
 * CW browser drop rates, expressed as integer weights (tenths of a percent).
 * The wiki's rounded rates do not sum to 100; normalizing preserves their ratios.
 * Our common chest represents Wooden Chest in CW leagues 30–26.
 */
export function chestPoolForLeague(index: number): Record<ChestType, number> {
  const counts =
    index < 4
      ? [1000, 0, 0, 0, 0]
      : index === 4
        ? [962, 0, 38, 0, 0]
        : index < 10
          ? [750, 195, 38, 0, 0]
          : index < 20
            ? [750, 212, 38, 12, 0]
            : [752, 200, 38, 12, 3];
  return Object.fromEntries(
    CHEST_TYPES.map((type, i) => [type, counts[i]!]),
  ) as Record<ChestType, number>;
}
