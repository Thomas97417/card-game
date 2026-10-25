import legacy from "./legacy/upgrade-costs.json";
import {
  canonicalVariantId,
  type CardRarity,
  upgradeExperience,
} from "./cards";

export interface CollectionRecord {
  variantId: string;
  level: number;
  copies: number;
  soulbinds?: number[];
}
function legacyRefund(entry: CollectionRecord, from: number) {
  const rarity = (entry.variantId.split(":")[1] ?? "common") as CardRarity;
  let copies = 0,
    gold = 0;
  for (let level = from; level < entry.level; level++) {
    const cost = legacy.costs[rarity]?.[level];
    copies += cost?.[0] ?? 0;
    gold += cost?.[1] ?? 0;
  }
  return { copies, gold };
}
/** Versioned once on the server; pure projection also keeps pre-migration reads safe. */
export function catalogueMigration<T extends CollectionRecord>(
  entries: readonly T[],
) {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const id = canonicalVariantId(entry.variantId);
    groups.set(id, [...(groups.get(id) ?? []), entry]);
  }
  let goldRefund = 0,
    experience = 0;
  const cards = [...groups].map(([variantId, records]) => {
    records.sort(
      (a, b) =>
        b.level - a.level ||
        Number(b.variantId === variantId) - Number(a.variantId === variantId),
    );
    const keeper = records[0]!;
    let copies = 0;
    const links = new Set<number>();
    for (const entry of records) {
      const refund = legacyRefund(entry, entry === keeper ? 26 : 1);
      goldRefund += refund.gold;
      copies += entry.copies + refund.copies + (entry === keeper ? 0 : 1);
      for (const tier of entry.soulbinds ?? []) links.add(tier);
      const rarity = variantId.split(":")[1] as CardRarity;
      for (let level = 1; level < Math.min(entry.level, 26); level++)
        experience += upgradeExperience(level, rarity);
    }
    return {
      keeper,
      merged: records.slice(1),
      variantId,
      level: Math.min(26, keeper.level),
      copies,
      ...(links.size ? { soulbinds: [...links].sort((a, b) => a - b) } : {}),
    };
  });
  return { cards, goldRefund, experience };
}
