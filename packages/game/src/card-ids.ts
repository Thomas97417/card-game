import ids from "./data/card-ids.json";

/** Route validation must not initialize the full combat catalogue. */
export const CARD_VARIANT_IDS: readonly string[] = ids;
const variants = new Set(CARD_VARIANT_IDS);

export function isCardVariantId(value: unknown): value is string {
  return typeof value === "string" && variants.has(value);
}
