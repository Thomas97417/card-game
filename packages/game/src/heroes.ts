import levels from "./data/hero-levels.json";
import { GameError, type CardDefinition } from "./cards";
import type { CardAbility } from "./cards";
import {
  heroMinion as heroMinionForPreview,
  alternativeHeroLevels,
  DEFAULT_HERO_ID,
  maxHeroLevel,
  type HeroId,
} from "./hero-roster";
export * from "./hero-roster";

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
export function heroStats(level: number, heroId: HeroId = DEFAULT_HERO_ID) {
  if (!Number.isInteger(level) || level < 1 || level > maxHeroLevel(heroId))
    throw new GameError("Ce niveau de héros n’existe pas.");
  const row = alternativeHeroLevels(heroId)?.[level - 1];
  if (row)
    return {
      level: row.level,
      nextMight: row.nextMight,
      health: row.health,
      storm: row.skills[0]?.[0] ?? 0,
      archerAttack: row.skills[1]?.[0] ?? 0,
      archerHealth: row.skills[1]?.[1] ?? 0,
      attackBonus: row.skills[2]?.[0] ?? 0,
    };
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
export const heroMight = (level: number, heroId: HeroId = DEFAULT_HERO_ID) =>
  (heroStats(level, heroId).level - 1) * 10;
export function heroArcherLevel(level: number) {
  heroStats(level);
  return [11, 15, 28, 37, 48, 57].filter((unlock) => level >= unlock).length;
}
export interface HeroRecord {
  level: number;
  peakMight: number;
  heroId?: HeroId;
}
export function heroProgress(
  cards: readonly Pick<CardDefinition, "id" | "might">[],
  saved: HeroRecord = { level: 1, peakMight: 0 },
) {
  const heroId = saved.heroId ?? DEFAULT_HERO_ID;
  const level = Math.min(saved.level, maxHeroLevel(heroId));
  const stats = heroStats(level, heroId);
  const cardMight = deckMight(cards);
  const might = cardMight + heroMight(level, heroId);
  const peakMight = Math.max(saved.peakMight, might);
  const next =
    level < maxHeroLevel(heroId) ? heroStats(level + 1, heroId) : null;
  return {
    ...stats,
    heroId,
    progressionLevel: saved.level,
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
  heroId: HeroId = DEFAULT_HERO_ID,
) {
  let level = 1;
  while (
    level < maxHeroLevel(heroId) &&
    heroProgress(cards, { level, peakMight: 0, heroId }).canUpgrade
  )
    level++;
  return level;
}

export const HERO_ABILITY_IDS = [
  "storm",
  "call_to_arms",
  "heavenly_power",
  "sudden_death",
  "hero_spikes",
  "purify",
  "wild_rage",
  "deadly_kiss",
  "destruction",
  "call_of_witches",
  "cold_snap",
  "call_of_void",
  "demonic_power",
  "call_of_knights",
  "block_runes",
  "call_of_bards",
  "fragility",
  "natural_protection",
  "explosive_gifts",
  "second_wind",
  "ancient_help",
  "suppression",
  "call_of_shadows",
  "preventive_strike",
  "call_of_ifrit",
  "efreet_power",
] as const;
export type HeroAbilityId = (typeof HERO_ABILITY_IDS)[number];
export type HeroAbilityIcon =
  | "power"
  | "reinforcement"
  | "temporary"
  | "spikes"
  | "silence"
  | "poison"
  | "execution"
  | "freeze"
  | "weaken"
  | "block"
  | "vitality"
  | "vampirism";
export interface HeroAbility {
  id: HeroAbilityId;
  name: string;
  description: string;
  unlockLevel: number;
  readyTurn: number;
  value: number;
  uses: number;
  state: "used" | "level" | "turn" | "previous" | "ready";
  icon: HeroAbilityIcon;
  valueLabel: string;
  effect: CardAbility["effect"];
  target: CardAbility["target"];
  temporary?: boolean;
  minion?: string;
  count?: number;
}
type Power = Omit<HeroAbility, "uses" | "state">;
export function heroAbilities(
  level: number,
  uses: number,
  turn: number,
  heroId: HeroId = DEFAULT_HERO_ID,
): HeroAbility[] {
  const stats = heroStats(level, heroId);
  const preview = (unlock: number) =>
    heroStats(Math.max(unlock, level), heroId);
  const raw = (unlock = 1) =>
    alternativeHeroLevels(heroId)?.[Math.max(unlock, level) - 1]?.skills ?? [];
  const ownTurn = Math.ceil(turn / 2);
  const deathIndex = Math.max(0, uses - 3);
  // Sudden Death remains the documented Sylve adaptation for every family.
  const deathValue =
    heroStats(Math.min(91, Math.max(21, level))).storm * (deathIndex + 1);
  const power = (
    id: HeroAbilityId,
    name: string,
    unlockLevel: number,
    readyTurn: number,
    value: number,
    description: string,
    icon: HeroAbilityIcon,
    effect: CardAbility["effect"],
    target: CardAbility["target"],
    rest: Partial<Power> = {},
  ): Power => ({
    id,
    name,
    unlockLevel,
    readyTurn,
    value,
    description,
    icon,
    effect,
    target,
    valueLabel: `${value} dégâts`,
    ...rest,
  });
  const summons = (
    id: HeroAbilityId,
    name: string,
    unlock: number,
    ready: number,
    kind: string,
    count: number,
    description?: string,
  ): Power => {
    const minion = heroMinionForPreview(heroId, Math.max(level, unlock), kind);
    const plurals: Record<string, string> = {
      knight: "chevaliers du givre",
      rocker: "chantres des clairières",
      witch: "sorcières du crépuscule",
      totem: "totems des racines",
      gift: "présents piégés",
    };
    return power(
      id,
      name,
      unlock,
      ready,
      count,
      description ??
        `Invoque jusqu’à ${count} ${count > 1 ? (plurals[kind] ?? minion.name.toLowerCase()) : minion.name.toLowerCase()} (${minion.attack} ATQ / ${minion.health} PV) sur des cases libres. ${minion.abilities?.map((a) => a.description).join(" ") ?? ""}`,
      "reinforcement",
      "summon",
      "all_allies",
      {
        minion: kind,
        count,
        valueLabel: `${count} renfort${count > 1 ? "s" : ""}`,
      },
    );
  };
  const storm = power(
    "storm",
    "Tempête de feuilles",
    1,
    2,
    stats.storm,
    `Inflige ${stats.storm} dégâts à toutes les unités ennemies.`,
    "power",
    "damage",
    "all_enemies",
  );
  const elan = power(
    "heavenly_power",
    "Élan de la Sylve",
    21,
    7,
    preview(21).attackBonus,
    `Donne +${preview(21).attackBonus} ATQ aux alliés présents jusqu’à la fin de ton tour.`,
    "temporary",
    "attack",
    "all_allies",
    { temporary: true, valueLabel: `+${preview(21).attackBonus} ATQ` },
  );
  const spikes = power(
    "hero_spikes",
    "Armure de ronces",
    1,
    1,
    stats.storm,
    `Le héros renvoie ${stats.storm} dégâts à chaque unité qui l’attaque pendant les deux prochains tours adverses.`,
    "spikes",
    "spikes",
    "ally_hero",
    { valueLabel: `${stats.storm} épines` },
  );
  const silence = power(
    "purify",
    "Souffle purificateur",
    11,
    3,
    0,
    "Réduit au silence toutes les unités ennemies, en respectant les boucliers et l’immunité.",
    "silence",
    "silence",
    "all_enemies",
    { valueLabel: "Silence" },
  );
  const rage = power(
    "wild_rage",
    "Fureur des Racines",
    21,
    7,
    preview(21).attackBonus,
    `Donne +${preview(21).attackBonus} ATQ aux alliés Nature présents jusqu’à la fin de ton tour.`,
    "temporary",
    "attack",
    "nature_allies",
    { temporary: true, valueLabel: `+${preview(21).attackBonus} ATQ` },
  );
  const execution = power(
    "destruction",
    "Sentence du Crépuscule",
    11,
    3,
    0,
    "Exécute les ennemis blessés (PV inférieurs à leur maximum). Les boucliers et l’immunité protègent leurs porteurs.",
    "execution",
    "execute",
    "all_enemies",
    { valueLabel: "Ennemis blessés" },
  );
  const witches = () =>
    summons("call_of_witches", "Cercle des Sorcières", 18, 7, "witch", 4);
  const ranged = power(
    "demonic_power",
    "Puissance du Vide",
    15,
    7,
    preview(15).attackBonus,
    `Donne +${preview(15).attackBonus} ATQ aux alliés à distance présents pour le reste du combat.`,
    "power",
    "attack",
    "ranged_allies",
    { valueLabel: `+${preview(15).attackBonus} ATQ` },
  );
  let definitions: Power[];
  switch (heroId) {
    case "sylve": {
      const archers = heroStats(Math.max(11, level));
      definitions = [
        storm,
        power(
          "call_to_arms",
          "Appel des éclaireurs",
          11,
          3,
          2,
          `Invoque jusqu’à 2 éclaireuses de l’Ordre à distance (${archers.archerAttack} ATQ / ${archers.archerHealth} PV) sur des cases libres.`,
          "reinforcement",
          "summon",
          "all_allies",
          { count: 2, valueLabel: "2 renforts" },
        ),
        elan,
      ];
      break;
    }
    case "north":
      definitions = [
        storm,
        summons("call_of_knights", "Garde du Givre", 11, 3, "knight", 2),
        elan,
      ];
      break;
    case "thorn":
      definitions = [spikes, silence, rage];
      break;
    case "shaman":
      definitions = [
        spikes,
        summons("natural_protection", "Totems des Racines", 11, 3, "totem", 2),
        rage,
      ];
      break;
    case "weaver":
      definitions = [
        power(
          "deadly_kiss",
          "Venin du Crépuscule",
          1,
          1,
          stats.storm,
          `Empoisonne chaque créature ennemie avec ${stats.storm} poison. Les bâtiments sont épargnés.`,
          "poison",
          "poison_enemy",
          "enemy_creatures",
          { valueLabel: `${stats.storm} poison` },
        ),
        execution,
        witches(),
      ];
      break;
    case "moon":
      definitions = [
        summons("ancient_help", "Pacte Carmin", 1, 1, "vampire", 1),
        execution,
        witches(),
      ];
      break;
    case "void":
      definitions = [
        power(
          "cold_snap",
          "Étreinte du Givre",
          1,
          1,
          1,
          "Gèle les ennemis présents : ils ne peuvent pas attaquer pendant leur prochain tour.",
          "freeze",
          "freeze",
          "all_enemies",
          { valueLabel: "Gel · 1 tour" },
        ),
        summons("call_of_void", "Appel du Vide", 4, 3, "demon", 1),
        ranged,
      ];
      break;
    case "shadow":
      definitions = [
        power(
          "suppression",
          "Voile d’Impuissance",
          1,
          1,
          1,
          "Fixe à 1 l’ATQ des ennemis présents pendant leur prochain tour.",
          "weaken",
          "set_attack",
          "all_enemies",
          { valueLabel: "ATQ → 1" },
        ),
        summons("call_of_shadows", "Appel des Ombres", 4, 3, "shadow", 1),
        ranged,
      ];
      break;
    case "flame":
      definitions = [
        power(
          "preventive_strike",
          "Riposte des Braises",
          1,
          1,
          stats.storm,
          `Avant chaque attaque ennemie au prochain tour adverse, inflige ${stats.storm} dégâts à l’attaquant.`,
          "power",
          "damage",
          "ally_hero",
          { valueLabel: `${stats.storm} dégâts` },
        ),
        summons("call_of_ifrit", "Appel des Braises", 4, 3, "ifrit", 1),
        power(
          "efreet_power",
          "Fureur des Braises",
          15,
          7,
          preview(15).attackBonus,
          `Donne +${preview(15).attackBonus} ATQ aux alliés de mêlée présents pour le reste du combat.`,
          "power",
          "attack",
          "melee_allies",
          { valueLabel: `+${preview(15).attackBonus} ATQ` },
        ),
      ];
      break;
    case "winter":
      definitions = [
        summons("explosive_gifts", "Présents piégés", 1, 1, "gift", 2),
        silence,
        power(
          "second_wind",
          "Second souffle",
          21,
          7,
          preview(21).attackBonus,
          `Augmente de ${preview(21).attackBonus} les PV actuels et maximum du héros.`,
          "vitality",
          "health",
          "ally_hero",
          { valueLabel: `+${preview(21).attackBonus} PV` },
        ),
      ];
      break;
    case "maestro": {
      const [count = 4, block = 3] = raw()[0]!;
      definitions = [
        power(
          "block_runes",
          "Accords protecteurs",
          1,
          1,
          block,
          `Place jusqu’à ${count} runes de blocage sur des cases alliées libres. La prochaine unité posée dessus gagne ${block} blocage.`,
          "block",
          "block_rune",
          "all_allies",
          { count, valueLabel: `${count} runes · ${block} blocage` },
        ),
        summons("call_of_bards", "Chœur des Clairières", 11, 3, "rocker", 2),
        power(
          "fragility",
          "Note de Rupture",
          21,
          7,
          1,
          "Fixe à 1 les PV des ennemis à distance et des bâtiments. Les ennemis de mêlée sont épargnés.",
          "vitality",
          "set_health",
          "non_melee_enemies",
          { valueLabel: "PV → 1" },
        ),
      ];
      break;
    }
  }
  const lastUnlock = definitions[2]!.unlockLevel;
  definitions.push(
    power(
      "sudden_death",
      "Dernier souffle",
      lastUnlock,
      11 + deathIndex,
      deathValue,
      `Inflige ${deathValue} dégâts au héros adverse. Une nouvelle carte plus puissante arrive à chacun de tes tours à partir du 11e.`,
      "power",
      "damage",
      "enemy_hero",
    ),
  );
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
export function nextHeroAbility(
  level: number,
  uses: number,
  turn: number,
  heroId: HeroId = DEFAULT_HERO_ID,
) {
  return heroAbilities(level, uses, turn, heroId)[Math.min(3, uses)]!;
}
