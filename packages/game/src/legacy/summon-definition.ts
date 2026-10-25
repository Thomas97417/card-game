/** Preserve summoned-unit definitions in saved matches created before CW. */
import type { CardAbility, CardDefinition } from "../cards";
import summonProfiles from "./summon-profiles.json";

export function legacyTokenDefinition(
  source: CardDefinition,
  spec: NonNullable<CardAbility["summon"]>,
): CardDefinition {
  const profile = summonProfiles.find((p) => p.kind === spec.kind);
  if (profile) {
    return {
      id: `token-${spec.kind}-${source.id}-${spec.level}`,
      baseId: profile.artId,
      artId: profile.artId,
      name: profile.name,
      title: "Renfort invoqué",
      kind: spec.kind,
      color: source.color,
      attack: spec.attack,
      health: spec.health,
      level: spec.level,
      rarity: "common",
      faction: profile.faction as CardDefinition["faction"],
      gender: profile.gender as CardDefinition["gender"],
      combatType: profile.combatType as CardDefinition["combatType"],
      abilities: profile.skills.map((s): CardAbility => {
        const value = s.values[spec.level - 1]!;
        const effect = s.effect as CardAbility["effect"];
        return {
          id: s.id,
          name:
            effect === "damage"
              ? "Dégâts magiques"
              : effect === "attack"
                ? "Puissance"
                : effect === "heal"
                  ? "Soin"
                  : "Blocage",
          description: s.descriptionFr.replace("{value}", String(value)),
          value,
          effect,
          trigger: s.trigger as CardAbility["trigger"],
          target: s.target as CardAbility["target"],
          unlockLevel: 1,
          active: true,
          ...("scaleBy" in s && s.scaleBy
            ? { scaleBy: s.scaleBy as CardAbility["target"] }
            : {}),
        };
      }),
    };
  }
  const archer = spec.kind === "archer";
  // Scarlet Warrior summons the plain archer subtype; only the support subtype
  // used by Warrioress/Soulblade has the documented Pierce skill schedule.
  const pierce =
    source.sourceHero === "Scarlet Warrior" || source.sourceHero === "Athena"
      ? undefined
      : (source.sourceHero === "Prince"
          ? [
              [2, 2],
              [3, 4],
              [4, 7],
              [5, 13],
              [6, 21],
              [7, 32],
              [8, 46],
              [9, 64],
              [10, 86],
            ]
          : [
              [5, 2],
              [8, 4],
              [11, 7],
              [14, 13],
              [17, 21],
              [20, 32],
              [23, 46],
              [26, 64],
            ]
        )
          .reverse()
          .find(([level]) => spec.level >= level!);
  return {
    id: `token-${spec.kind}-${source.id}-${spec.level}`,
    baseId: archer ? "fox" : "sporeling",
    name: archer ? "Éclaireur des braises" : "Rejeton des spores",
    title: "Renfort invoqué",
    kind: archer ? "archer" : "zombie",
    color: archer ? "#d6844d" : "#9f79a4",
    attack: spec.attack,
    health: spec.health,
    level: spec.level,
    rarity: "common",
    faction: archer ? "order" : "chaos",
    ...(archer ? { gender: "female" as const } : {}),
    combatType: archer ? "ranged" : "melee",
    abilities:
      archer && pierce
        ? [
            {
              id: "pierce",
              name: "Perforation",
              description: `Inflige ${pierce[1]} dégâts aux ennemis de la colonne de la cible.`,
              unlockLevel: source.sourceHero === "Prince" ? 2 : 5,
              active: true,
              effect: "pierce",
              trigger: "passive",
              target: "self",
              value: pierce[1]!,
            },
          ]
        : [],
  };
}
