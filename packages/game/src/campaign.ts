import { availableRarities, DEFAULT_DECK, resolveCard, variantCard, type CardRarity, type HeroId } from "./index";
import { computerDeckForLeague } from "./practice";

export const CAMPAIGN_STAGES_PER_REGION = 10;
export const CAMPAIGN_REGIONS = [
  {
    id: 1, name: "La Bourgade de Clairval", shortName: "Clairval",
    description: "Au pied des remparts de Clairval, les ruelles pavées et les jardins accueillent les premières épreuves de ton alliance. Rejoins la grande place et affronte la garde du bourg.",
    boss: "Le Capitaine de Clairval", heroId: "sylve", color: "#e0c58b",
    position: { x: 15, y: 58 }, arena: "/art/campaign/arena-1-clairval.webp",
  },
  {
    id: 2, name: "Les Rivages d’azur", shortName: "Rivages d’azur",
    description: "Au-delà des ponts de pierre, la mer dévoile des sanctuaires oubliés. Traverse les falaises et leurs sentinelles.",
    boss: "La Sentinelle des marées", heroId: "moon", color: "#8cdbdc",
    position: { x: 52, y: 72 }, arena: "/art/campaign/arena-2.webp",
  },
  {
    id: 3, name: "Les Cimes de givre", shortName: "Cimes de givre",
    description: "Le vent porte les secrets d’un royaume de glace. Fraie-toi un chemin jusqu’au sommet du sanctuaire.",
    boss: "Le Souverain du givre", heroId: "winter", color: "#bcd6ff",
    position: { x: 66, y: 26 }, arena: "/art/campaign/arena-3.webp",
  },
  {
    id: 4, name: "Les Terres de braise", shortName: "Terres de braise",
    description: "Les pierres brûlent encore du souffle des anciens. Au cœur du volcan t’attend l’ultime gardien.",
    boss: "Le Gardien des braises", heroId: "flame", color: "#f1b387",
    position: { x: 87, y: 49 }, arena: "/art/campaign/arena-4.webp",
  },
] as const satisfies readonly {
  id: number; name: string; shortName: string; description: string; boss: string;
  heroId: HeroId; color: string; position: { x: number; y: number }; arena: string;
}[];

export const CAMPAIGN_TOTAL_STAGES = CAMPAIGN_REGIONS.length * CAMPAIGN_STAGES_PER_REGION;

export function campaignStage(region: number, stage: number) {
  if (!Number.isSafeInteger(region) || !Number.isSafeInteger(stage) ||
    region < 1 || region > CAMPAIGN_REGIONS.length || stage < 1 || stage > CAMPAIGN_STAGES_PER_REGION) return null;
  const index = (region - 1) * CAMPAIGN_STAGES_PER_REGION + stage - 1;
  return { region: CAMPAIGN_REGIONS[region - 1]!, stage, index, label: `${region}-${stage}`,
    boss: stage === CAMPAIGN_STAGES_PER_REGION };
}

export function campaignStageReward(region: number, stage: number) {
  const encounter = campaignStage(region, stage);
  if (!encounter) throw new Error("Étape d’aventure introuvable.");
  return {
    gold: 60 + encounter.index * 15 + (encounter.boss ? region * 150 : 0),
    emeralds: encounter.boss ? region * 150 : stage === 5 ? region * 50 : 0,
    chest: encounter.boss ? "epic" as const : null,
  };
}

/** Fixed regional difficulty: improving the player's deck makes earlier fights easier. */
export function campaignOpponent(region: number, stage: number, size: number, random: () => number) {
  const encounter = campaignStage(region, stage);
  if (!encounter) throw new Error("Étape d’aventure introuvable.");
  const level = Math.min(26, 1 + Math.floor(encounter.index / 3) + (encounter.boss ? 1 : 0));
  const rarity: CardRarity = region >= 4 ? "epic" : region >= 2 ? "rare" : "common";
  // Seed the existing balanced melee/ranged builder with the desired level and rarity.
  const reference = Array.from({ length: size }, () => ({ ...resolveCard(DEFAULT_DECK[0]!), level, rarity }));
  const cards = computerDeckForLeague(Math.min(6000, encounter.index * 160), reference, random)
    .map((card) => variantCard(card.baseId ?? card.id.split(":")[0]!,
      availableRarities(card.baseId ?? card.id.split(":")[0]!).includes(rarity) ? rarity : card.rarity!, level));
  return { cards, level, heroId: encounter.region.heroId,
    name: encounter.boss ? encounter.region.boss : `Sentinelle · ${encounter.label}` };
}
