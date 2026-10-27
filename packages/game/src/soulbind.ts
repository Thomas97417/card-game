import cw from "./data/cunt-wars.json";
export { rankProgress } from "./ranks";
import {
  cardSource,
  canonicalVariantId,
  GameError,
  type CardRarity,
  type OwnedCard,
} from "./cards";

export const SOULBIND_LEAGUE_INDEX = 4; // CW league 26, starting at 30.
export const EVOLUTION_LEAGUE_INDEX = 12; // CW league 18.
export const SOULBIND_TIERS = [1, 2, 3, 4] as const;
export const SOULBIND_LABELS = ["I", "II", "III", "IV"] as const;
export const SOUL_DUST_PER_CONVERSION = 10;
export const SOUL_DUST_COPIES: Record<CardRarity, number> = {
  common: 50,
  rare: 20,
  epic: 5,
  legendary: 1,
};
const troops: Record<CardRarity, number[]> = {
  common: [0, 5, 10, 20],
  rare: [0, 10, 30, 50],
  epic: [20, 40, 60, 90],
  legendary: [45, 75, 105, 150],
};

export function soulbindDefinitions(variantId: string) {
  const source = cardSource(variantId);
  return source.soulbinds.map((link) => ({
    ...link,
    requirements: link.requirements.map((r) => ({ ...r })),
    cost: cw.soulbindCosts[source.rarity][link.tier - 1]!,
    troops: troops[source.rarity][link.tier - 1]!,
  }));
}
export interface SoulbindProgress {
  rank: number;
  soulDust: number;
  unlocked: boolean;
}

/** Links are independent: CW permits IV before I. Required cards are never spent. */
export function soulbindStatus(
  variantId: string,
  tier: number,
  collection: readonly OwnedCard[],
  progress: SoulbindProgress,
) {
  const definition = soulbindDefinitions(variantId).find(
    (link) => link.tier === tier,
  );
  if (!definition || !Number.isInteger(tier))
    throw new GameError("Ce lien d’âme n’existe pas.");
  const id = canonicalVariantId(variantId);
  const owned = collection.find(
    (entry) => canonicalVariantId(entry.card.id) === id,
  );
  const active = owned?.card.soulbinds?.includes(tier) ?? false;
  const requirements = definition.requirements.map((requirement) => {
    const entry = collection.find(
      (entry) => canonicalVariantId(entry.card.id) === requirement.variantId,
    );
    const level = entry?.card.level ?? 0;
    return {
      ...requirement,
      ownedLevel: level,
      ready: level >= requirement.level,
    };
  });
  const ready =
    !!owned &&
    !active &&
    progress.unlocked &&
    progress.rank >= definition.rank &&
    progress.soulDust >= definition.cost &&
    requirements.every((r) => r.ready);
  return { ...definition, active, ready, requirements };
}
export function requireSoulbind(
  variantId: string,
  tier: number,
  collection: readonly OwnedCard[],
  progress: SoulbindProgress,
) {
  const status = soulbindStatus(variantId, tier, collection, progress);
  if (
    !collection.some(
      (entry) =>
        canonicalVariantId(entry.card.id) === canonicalVariantId(variantId),
    )
  )
    throw new GameError("Cette carte n’est pas encore débloquée.");
  if (status.active) throw new GameError("Ce lien d’âme est déjà actif.");
  if (!progress.unlocked)
    throw new GameError(
      "Les liens d’âme se débloquent à partir de la ligue Bronze IV.",
    );
  if (progress.rank < status.rank)
    throw new GameError(
      `Le rang ${status.rank} est requis pour ce lien d’âme.`,
    );
  if (!status.requirements.every((r) => r.ready))
    throw new GameError(
      "Améliore les compagnons requis pour activer ce lien d’âme.",
    );
  if (progress.soulDust < status.cost)
    throw new GameError("Tu n’as pas assez de poussière d’âme.");
  return status;
}
export function evolutionOptions(variantId: string) {
  return cardSource(variantId).evolutions.map((option) => ({ ...option }));
}
export function dustConversion(rarity: CardRarity, batches: number) {
  if (!Number.isSafeInteger(batches) || batches < 1 || batches > 10000)
    throw new GameError("Choisis un nombre entier de lots entre 1 et 10 000.");
  return {
    copies: SOUL_DUST_COPIES[rarity] * batches,
    soulDust: SOUL_DUST_PER_CONVERSION * batches,
  };
}
