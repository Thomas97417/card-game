import levels from "./data/hero-levels.json";
import { GameError, type CardDefinition } from "./cards";

/** Adam, wiki revision 23782. Threshold on row N is for N → N+1. */
export const HERO_LEVELS = levels.map((row) => ({
  level: row[0]!,
  nextMight: row[1],
  health: row[2]!,
  storm: row[3]!,
  archerAttack: row[4]!,
  archerHealth: row[5]!,
  attackBonus: row[6]!,
}));
export const MAX_HERO_LEVEL = HERO_LEVELS.length;
export function heroStats(level: number) {
  if (!Number.isInteger(level) || level < 1 || level > MAX_HERO_LEVEL)
    throw new GameError("Ce niveau de héros n’existe pas.");
  return HERO_LEVELS[level - 1]!;
}

export function deckMight(
  cards: readonly Pick<CardDefinition, "id" | "might">[],
) {
  return [...new Map(cards.map((card) => [card.id, card])).values()].reduce(
    (total, card) => total + Math.max(0, card.might ?? 0),
    0,
  );
}
/** +10 per promotion; Sylve starts the hero contribution at zero. */
export const heroMight = (level: number) => (heroStats(level).level - 1) * 10;
export function heroArcherLevel(level: number) {
  heroStats(level);
  return [11, 15, 28, 37, 48, 57].filter((unlock) => level >= unlock).length;
}
export interface HeroRecord {
  level: number;
  peakMight: number;
}
export function heroProgress(
  cards: readonly Pick<CardDefinition, "id" | "might">[],
  saved: HeroRecord = { level: 1, peakMight: 0 },
) {
  const stats = heroStats(saved.level);
  const cardMight = deckMight(cards);
  const might = cardMight + heroMight(saved.level);
  const peakMight = Math.max(saved.peakMight, might);
  const next = saved.level < MAX_HERO_LEVEL ? heroStats(saved.level + 1) : null;
  return {
    ...stats,
    cardMight,
    might,
    peakMight,
    next,
    canUpgrade: stats.nextMight != null && peakMight >= stats.nextMight,
  };
}

/** Practice and computer heroes automatically take all levels their deck permits. */
export function heroLevelForDeck(
  cards: readonly Pick<CardDefinition, "id" | "might">[],
) {
  let level = 1;
  while (
    level < MAX_HERO_LEVEL &&
    heroProgress(cards, { level, peakMight: 0 }).canUpgrade
  )
    level++;
  return level;
}

export type HeroAbilityId =
  | "storm"
  | "call_to_arms"
  | "heavenly_power"
  | "sudden_death";
export interface HeroAbility {
  id: HeroAbilityId;
  name: string;
  description: string;
  unlockLevel: number;
  readyTurn: number;
  value: number;
  uses: number;
  state: "used" | "level" | "turn" | "previous" | "ready";
}
export function heroAbilities(
  level: number,
  uses: number,
  turn: number,
): HeroAbility[] {
  const stats = heroStats(level);
  const archers = heroStats(Math.max(11, level));
  const power = heroStats(Math.max(21, level));
  const ownTurn = Math.ceil(turn / 2);
  const deathIndex = Math.max(0, uses - 3);
  const deathValue = heroStats(Math.max(21, level)).storm * (deathIndex + 1);
  const definitions = [
    {
      id: "storm",
      name: "Tempête de feuilles",
      unlockLevel: 1,
      readyTurn: 1,
      value: stats.storm,
      description: `Inflige ${stats.storm} dégâts à toutes les unités ennemies.`,
    },
    {
      id: "call_to_arms",
      name: "Appel des éclaireurs",
      unlockLevel: 11,
      readyTurn: 3,
      value: 2,
      description: `Invoque jusqu’à 2 éclaireuses de l’Ordre à distance (${archers.archerAttack} ATQ / ${archers.archerHealth} PV) sur des cases libres.`,
    },
    {
      id: "heavenly_power",
      name: "Élan de la Sylve",
      unlockLevel: 21,
      readyTurn: 7,
      value: power.attackBonus,
      description: `Donne +${power.attackBonus} ATQ aux alliés présents jusqu’à la fin de ton tour.`,
    },
    {
      id: "sudden_death",
      name: "Dernier souffle",
      unlockLevel: 21,
      readyTurn: 11 + deathIndex,
      value: deathValue,
      description: `Inflige ${deathValue} dégâts au héros adverse. Une nouvelle carte plus puissante arrive à chacun de tes tours à partir du 11e.`,
    },
  ] as const;
  return definitions.map((ability, index) => ({
    ...ability,
    uses: index === 3 ? Math.max(3, uses) : index,
    state:
      index < Math.min(3, uses)
        ? "used"
        : level < ability.unlockLevel
          ? "level"
          : ownTurn < ability.readyTurn
            ? "turn"
            : index > uses
              ? "previous"
              : "ready",
  }));
}
export function nextHeroAbility(level: number, uses: number, turn: number) {
  return heroAbilities(level, uses, turn)[Math.min(3, uses)]!;
}
