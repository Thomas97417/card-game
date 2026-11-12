/** Numeric reference: vampire.survivors.wiki, consulted 2026-11-12.
 * Seconds and multipliers are preserved; world distances and enemy balance are Sylve adaptations.
 * No original artwork, prose or game code is included. See docs/cemetery.md.
 */
export const WEAPON_IDS = [
  "whip",
  "wand",
  "knife",
  "axe",
  "cross",
  "bible",
  "fire",
  "garlic",
  "water",
  "rune",
  "lightning",
  "pentagram",
] as const;
export type CemeteryWeaponId = (typeof WEAPON_IDS)[number];
export const PASSIVE_IDS = [
  "spinach",
  "armor",
  "heart",
  "recovery",
  "tome",
  "candle",
  "bracer",
  "binder",
  "duplicator",
  "wings",
  "magnet",
  "clover",
  "crown",
  "mask",
  "skull",
  "revival",
] as const;
export type CemeteryPassiveId = (typeof PASSIVE_IDS)[number];
export const UPGRADE_IDS = [
  "might",
  "armor",
  "health",
  "recovery",
  "cooldown",
  "area",
  "speed",
  "duration",
  "amount",
  "moveSpeed",
  "magnet",
  "luck",
  "growth",
  "greed",
  "curse",
  "revival",
  "shield",
] as const;
export type CemeteryUpgradeId = (typeof UPGRADE_IDS)[number];
export type CemeteryUpgrades = Partial<Record<CemeteryUpgradeId, number>>;
export interface WeaponNumbers {
  damage: number;
  cooldown: number;
  area: number;
  speed: number;
  amount: number;
  pierce: number;
  duration: number;
  interval: number;
  hitDelay: number;
  chance: number;
  knockback: number;
  pool: number;
}
export interface CemeteryWeaponDefinition {
  id: CemeteryWeaponId;
  source: string;
  name: string;
  description: string;
  glyph: string;
  color: number;
  weight: number;
  passive: CemeteryPassiveId;
  evolvedSource: string;
  evolvedName: string;
  evolvedDescription: string;
  base: WeaponNumbers;
  levels: Partial<WeaponNumbers>[];
  evolved: Partial<WeaponNumbers>;
}
const numbers = (
  damage: number,
  cooldown: number,
  extra: Partial<WeaponNumbers> = {},
): WeaponNumbers => ({
  damage,
  cooldown,
  area: 1,
  speed: 1,
  amount: 1,
  pierce: 1,
  duration: 3,
  interval: 0.1,
  hitDelay: 0.5,
  chance: 0,
  knockback: 1,
  pool: 60,
  ...extra,
});
export const CEMETERY_WEAPONS: readonly CemeteryWeaponDefinition[] = [
  {
    id: "whip",
    source: "Whip",
    name: "Ronce cinglante",
    glyph: "vine",
    color: 0x9ecf87,
    weight: 100,
    passive: "heart",
    evolvedSource: "Bloody Tear",
    evolvedName: "Ronce carmin",
    description: "Fouette horizontalement et traverse les ennemis.",
    evolvedDescription:
      "Les coups critiques rendent 8 PV, au plus une fois par seconde.",
    base: numbers(10, 1.35, { pierce: -1, pool: 30 }),
    levels: [
      { amount: 1 },
      { damage: 5 },
      { area: 0.1, damage: 5 },
      { damage: 5 },
      { area: 0.1, damage: 5 },
      { damage: 5 },
      { damage: 5 },
    ],
    evolved: { area: 1.3, chance: 0.1 },
  },
  {
    id: "wand",
    source: "Magic Wand",
    name: "Baguette sylvestre",
    glyph: "wand",
    color: 0x8de4ef,
    weight: 100,
    passive: "tome",
    evolvedSource: "Holy Wand",
    evolvedName: "Sceptre des anciens",
    description: "Vise automatiquement l’ennemi le plus proche.",
    evolvedDescription:
      "Des salves deux fois plus rapides et des projectiles accélérés.",
    base: numbers(10, 1.2),
    levels: [
      { amount: 1 },
      { cooldown: -0.2 },
      { amount: 1 },
      { damage: 10 },
      { amount: 1 },
      { pierce: 1 },
      { damage: 10 },
    ],
    evolved: { cooldown: 0.5, speed: 2 },
  },
  {
    id: "knife",
    source: "Knife",
    name: "Lames du veilleur",
    glyph: "knife",
    color: 0xd3e3e9,
    weight: 100,
    passive: "bracer",
    evolvedSource: "Thousand Edge",
    evolvedName: "Pluie de lames",
    description: "Lance des lames dans la direction du déplacement.",
    evolvedDescription: "Un torrent de lames dans la direction regardée.",
    base: numbers(6.5, 1, { interval: 0.1 }),
    levels: [
      { amount: 1 },
      { amount: 1, damage: 5 },
      { amount: 1, interval: -0.02 },
      { pierce: 1 },
      { amount: 1, interval: -0.02 },
      { amount: 1, damage: 5 },
      { pierce: 1, interval: -0.02 },
    ],
    evolved: { cooldown: 0.35, speed: 1.5, pool: 100 },
  },
  {
    id: "axe",
    source: "Axe",
    name: "Hache funéraire",
    glyph: "axe",
    color: 0xd8ba96,
    weight: 100,
    passive: "candle",
    evolvedSource: "Death Spiral",
    evolvedName: "Spirale funèbre",
    description: "Projette de lourdes haches en cloche au-dessus du héros.",
    evolvedDescription:
      "Neuf faux traversent les hordes dans toutes les directions.",
    base: numbers(20, 4, { pierce: 3, interval: 0.2, pool: 70 }),
    levels: [
      { amount: 1 },
      { damage: 20 },
      { pierce: 2 },
      { amount: 1 },
      { damage: 20 },
      { pierce: 2 },
      { damage: 20 },
    ],
    evolved: {
      damage: 60,
      area: 1.2,
      speed: 0.8,
      amount: 9,
      pierce: 1000,
      interval: 0.05,
      pool: 50,
    },
  },
  {
    id: "cross",
    source: "Cross",
    name: "Sceau du refuge",
    glyph: "cross",
    color: 0xf0d28c,
    weight: 80,
    passive: "clover",
    evolvedSource: "Heaven Sword",
    evolvedName: "Épée des serments",
    description: "Un sceau vise un ennemi puis revient comme un boomerang.",
    evolvedDescription:
      "De grandes épées traversent les ennemis et peuvent infliger des critiques.",
    base: numbers(5, 2, { pierce: -1, pool: 100 }),
    levels: [
      { damage: 10 },
      { area: 0.1, speed: 0.25 },
      { amount: 1 },
      { damage: 10 },
      { area: 0.1, speed: 0.25 },
      { amount: 1 },
      { damage: 10 },
    ],
    evolved: {
      damage: 77,
      area: 1.2,
      speed: 2,
      amount: 1,
      cooldown: 3.3,
      interval: 0.5,
      knockback: 6,
      pool: 20,
      chance: 0.1,
    },
  },
  {
    id: "bible",
    source: "King Bible",
    name: "Grimoire des gardiens",
    glyph: "book",
    color: 0xc1b6ff,
    weight: 80,
    passive: "binder",
    evolvedSource: "Unholy Vespers",
    evolvedName: "Vêpres éternelles",
    description:
      "Des grimoires tournent autour du héros et repoussent les ennemis.",
    evolvedDescription: "Un cercle permanent de grimoires protège le héros.",
    base: numbers(10, 3, {
      duration: 3,
      pierce: -1,
      hitDelay: 1.7,
      interval: 0,
      pool: 50,
    }),
    levels: [
      { amount: 1 },
      { area: 0.25, speed: 0.3 },
      { duration: 0.5, damage: 10 },
      { amount: 1 },
      { area: 0.25, speed: 0.3 },
      { duration: 0.5, damage: 10 },
      { amount: 1 },
    ],
    evolved: {
      damage: 30,
      area: 1.75,
      speed: 1.5,
      amount: 4,
      cooldown: 3,
      duration: 3,
      knockback: 4,
    },
  },
  {
    id: "fire",
    source: "Fire Wand",
    name: "Bâton de braise",
    glyph: "flame",
    color: 0xffa476,
    weight: 80,
    passive: "spinach",
    evolvedSource: "Hellfire",
    evolvedName: "Brasier des profondeurs",
    description:
      "Projette un éventail de boules de feu vers un ennemi aléatoire.",
    evolvedDescription: "D’immenses météores traversent les hordes.",
    base: numbers(20, 3, { speed: 0.75, amount: 3, interval: 0.02, pool: 30 }),
    levels: [
      { damage: 10 },
      { damage: 10, speed: 0.2 },
      { damage: 10 },
      { damage: 10, speed: 0.2 },
      { damage: 10 },
      { damage: 10, speed: 0.2 },
      { damage: 10 },
    ],
    evolved: {
      damage: 100,
      area: 1,
      speed: 1,
      amount: 2,
      interval: 0.2,
      pool: 20,
      pierce: -1,
    },
  },
  {
    id: "garlic",
    source: "Garlic",
    name: "Cercle de sauge",
    glyph: "leaf",
    color: 0xa6d4a0,
    weight: 70,
    passive: "recovery",
    evolvedSource: "Soul Eater",
    evolvedName: "Dévoreur d’âmes",
    description: "Une aura blesse les ennemis proches et augmente leur recul.",
    evolvedDescription:
      "Une aura plus large absorbe des PV et grandit avec les soins.",
    base: numbers(5, 1.3, { pierce: -1, knockback: 0, interval: 0, pool: 50 }),
    levels: [
      { area: 0.4, damage: 2 },
      { cooldown: -0.1, damage: 1 },
      { area: 0.2, damage: 1 },
      { cooldown: -0.1, damage: 2 },
      { area: 0.2, damage: 1 },
      { cooldown: -0.1, damage: 1 },
      { area: 0.2, damage: 2 },
    ],
    evolved: { damage: 20, area: 3, cooldown: 1 },
  },
  {
    id: "water",
    source: "Santa Water",
    name: "Eau de lune",
    glyph: "droplet",
    color: 0x85bae9,
    weight: 100,
    passive: "magnet",
    evolvedSource: "La Borra",
    evolvedName: "Marée lunaire",
    description: "Dépose des zones d’eau enchantée qui blessent les ennemis.",
    evolvedDescription: "Les zones grandissent et se rapprochent du héros.",
    base: numbers(10, 4.5, {
      duration: 2,
      pierce: -1,
      interval: 0.3,
      knockback: 0,
      pool: 20,
    }),
    levels: [
      { amount: 1, area: 0.2 },
      { duration: 0.5, damage: 10 },
      { amount: 1, area: 0.2 },
      { duration: 0.25, damage: 10 },
      { amount: 1, area: 0.2 },
      { duration: 0.25, damage: 5 },
      { area: 0.2, damage: 5 },
    ],
    evolved: {
      damage: 40,
      duration: 4,
      area: 2,
      amount: 4,
      cooldown: 4,
      pool: 30,
    },
  },
  {
    id: "rune",
    source: "Runetracer",
    name: "Éclat runique",
    glyph: "gem",
    color: 0xb798ff,
    weight: 80,
    passive: "armor",
    evolvedSource: "NO FUTURE",
    evolvedName: "Fracture runique",
    description:
      "Un éclat traverse les ennemis et rebondit aux limites du champ.",
    evolvedDescription:
      "Chaque rebond explose ; les coups subis déclenchent une riposte.",
    base: numbers(10, 3, {
      duration: 2.25,
      pierce: -1,
      interval: 0.2,
      pool: 25,
    }),
    levels: [
      { damage: 5, speed: 0.2 },
      { duration: 0.25, damage: 5 },
      { amount: 1 },
      { damage: 5, speed: 0.2 },
      { duration: 0.25, damage: 5 },
      { amount: 1 },
      { duration: 0.5 },
    ],
    evolved: {
      damage: 30,
      area: 1,
      speed: 2.8,
      duration: 3,
      amount: 1,
      cooldown: 1,
      interval: 0,
      pool: 40,
    },
  },
  {
    id: "lightning",
    source: "Lightning Ring",
    name: "Anneau d’orage",
    glyph: "bolt",
    color: 0xe5d5ff,
    weight: 80,
    passive: "duplicator",
    evolvedSource: "Thunder Loop",
    evolvedName: "Foudre jumelle",
    description: "La foudre frappe des ennemis aléatoires.",
    evolvedDescription:
      "Chaque éclair frappe une seconde fois après un court délai.",
    base: numbers(15, 4.5, { amount: 2, pierce: -1, interval: 0.05, pool: 50 }),
    levels: [
      { amount: 1 },
      { area: 1, damage: 10 },
      { amount: 1 },
      { area: 1, damage: 20 },
      { amount: 1 },
      { area: 1, damage: 20 },
      { amount: 1 },
    ],
    evolved: { damage: 65, area: 4, amount: 6, interval: 0, pool: 70 },
  },
  {
    id: "pentagram",
    source: "Pentagram",
    name: "Sceau d’exorcisme",
    glyph: "star",
    color: 0xe9a6f2,
    weight: 60,
    passive: "crown",
    evolvedSource: "Gorgeous Moon",
    evolvedName: "Astre purificateur",
    description:
      "Efface les ennemis alentour, mais risque de détruire leur butin.",
    evolvedDescription:
      "Préserve le butin, génère de l’expérience et l’attire.",
    base: numbers(0, 90, {
      duration: 1,
      pierce: -1,
      chance: 0.1,
      knockback: 0,
      pool: 10,
    }),
    levels: [
      { cooldown: -10 },
      { chance: 0.15 },
      { cooldown: -10 },
      { chance: 0.2 },
      { cooldown: -5 },
      { chance: 0.2 },
      { cooldown: -5 },
    ],
    evolved: { cooldown: 60, chance: 1 },
  },
];
export const CEMETERY_PASSIVES = [
  {
    id: "spinach",
    source: "Spinach",
    name: "Feuille de vigueur",
    glyph: "leaf",
    max: 5,
    weight: 100,
    description: "+10 % de puissance par niveau.",
  },
  {
    id: "armor",
    source: "Armor",
    name: "Cuirasse du veilleur",
    glyph: "shield",
    max: 5,
    weight: 100,
    description: "+1 d’armure par niveau.",
  },
  {
    id: "heart",
    source: "Hollow Heart",
    name: "Cœur ancien",
    glyph: "heart",
    max: 5,
    weight: 90,
    description: "Multiplie les PV maximum par 1,2 par niveau.",
  },
  {
    id: "recovery",
    source: "Pummarola",
    name: "Graine vitale",
    glyph: "sprout",
    max: 5,
    weight: 90,
    description: "+0,2 PV régénéré par seconde et par niveau.",
  },
  {
    id: "tome",
    source: "Empty Tome",
    name: "Grimoire vierge",
    glyph: "book",
    max: 5,
    weight: 50,
    description: "−8 % de délai d’attaque par niveau.",
  },
  {
    id: "candle",
    source: "Candelabrador",
    name: "Chandélabre",
    glyph: "flame",
    max: 5,
    weight: 100,
    description: "+10 % de zone d’attaque par niveau.",
  },
  {
    id: "bracer",
    source: "Bracer",
    name: "Bracelets du veilleur",
    glyph: "wind",
    max: 5,
    weight: 100,
    description: "+10 % de vitesse des projectiles par niveau.",
  },
  {
    id: "binder",
    source: "Spellbinder",
    name: "Liant runique",
    glyph: "hourglass",
    max: 5,
    weight: 100,
    description: "+10 % de durée des effets par niveau.",
  },
  {
    id: "duplicator",
    source: "Duplicator",
    name: "Miroir des échos",
    glyph: "copy",
    max: 2,
    weight: 50,
    description: "+1 projectile par niveau.",
  },
  {
    id: "wings",
    source: "Wings",
    name: "Plumes errantes",
    glyph: "feather",
    max: 5,
    weight: 50,
    description: "+10 % de vitesse de déplacement par niveau.",
  },
  {
    id: "magnet",
    source: "Attractorb",
    name: "Pierre d’attraction",
    glyph: "magnet",
    max: 5,
    weight: 100,
    description:
      "Multiplie le rayon de collecte : ×1,5 / ×1,995 / ×2,494 / ×2,993 / ×3,98.",
  },
  {
    id: "clover",
    source: "Clover",
    name: "Trèfle des brumes",
    glyph: "clover",
    max: 5,
    weight: 100,
    description: "+10 % de chance par niveau.",
  },
  {
    id: "crown",
    source: "Crown",
    name: "Couronne ancienne",
    glyph: "crown",
    max: 5,
    weight: 70,
    description: "+8 % d’expérience par niveau.",
  },
  {
    id: "mask",
    source: "Stone Mask",
    name: "Masque doré",
    glyph: "coins",
    max: 5,
    weight: 70,
    description: "+10 % d’or ramassé par niveau.",
  },
  {
    id: "skull",
    source: "Skull O’Maniac",
    name: "Relique maudite",
    glyph: "skull",
    max: 5,
    weight: 40,
    description:
      "+10 % de vitesse, PV, quantité et fréquence des ennemis par niveau.",
  },
  {
    id: "revival",
    source: "Tirajisú",
    name: "Talisman de retour",
    glyph: "sparkles",
    max: 2,
    weight: 40,
    description: "+1 résurrection avec 50 % des PV par niveau.",
  },
] as const satisfies readonly {
  id: CemeteryPassiveId;
  source: string;
  name: string;
  glyph: string;
  max: number;
  weight: number;
  description: string;
}[];
export const CEMETERY_UPGRADES = [
  {
    id: "might",
    name: "Puissance",
    glyph: "sword",
    max: 5,
    baseCost: 200,
    step: 5,
    unit: "%",
    description: "Dégâts de toutes les armes.",
  },
  {
    id: "armor",
    name: "Armure",
    glyph: "shield",
    max: 3,
    baseCost: 600,
    step: 1,
    unit: "",
    description: "Dégâts absorbés à chaque coup ; minimum 1 dégât.",
  },
  {
    id: "health",
    name: "Vitalité",
    glyph: "heart",
    max: 3,
    baseCost: 200,
    step: 10,
    unit: "%",
    description: "PV maximum multipliés par 1,1 à chaque rang.",
  },
  {
    id: "recovery",
    name: "Régénération",
    glyph: "sprout",
    max: 5,
    baseCost: 200,
    step: 0.1,
    unit: " PV/s",
    description: "Vie restaurée en continu.",
  },
  {
    id: "cooldown",
    name: "Cadence",
    glyph: "timer",
    max: 2,
    baseCost: 900,
    step: -2.5,
    unit: "%",
    description: "Réduit le délai entre les attaques.",
  },
  {
    id: "area",
    name: "Amplitude",
    glyph: "expand",
    max: 2,
    baseCost: 300,
    step: 5,
    unit: "%",
    description: "Zone d’effet des armes.",
  },
  {
    id: "speed",
    name: "Projectiles vifs",
    glyph: "wind",
    max: 2,
    baseCost: 300,
    step: 10,
    unit: "%",
    description: "Vitesse des projectiles.",
  },
  {
    id: "duration",
    name: "Persistance",
    glyph: "hourglass",
    max: 2,
    baseCost: 300,
    step: 15,
    unit: "%",
    description: "Durée des effets persistants.",
  },
  {
    id: "amount",
    name: "Écho des armes",
    glyph: "copy",
    max: 1,
    baseCost: 5000,
    step: 1,
    unit: "",
    description: "Un projectile supplémentaire pour les armes compatibles.",
  },
  {
    id: "moveSpeed",
    name: "Pas légers",
    glyph: "feather",
    max: 2,
    baseCost: 600,
    step: 5,
    unit: "%",
    description: "Vitesse de déplacement du héros.",
  },
  {
    id: "magnet",
    name: "Attraction",
    glyph: "magnet",
    max: 2,
    baseCost: 300,
    step: 25,
    unit: "%",
    description: "Rayon de collecte multiplié par 1,25 à chaque rang.",
  },
  {
    id: "luck",
    name: "Fortune",
    glyph: "clover",
    max: 3,
    baseCost: 600,
    step: 10,
    unit: "%",
    description: "Favorise les butins et un quatrième choix de niveau.",
  },
  {
    id: "growth",
    name: "Apprentissage",
    glyph: "sparkles",
    max: 5,
    baseCost: 900,
    step: 3,
    unit: "%",
    description: "Expérience obtenue.",
  },
  {
    id: "greed",
    name: "Cupidité",
    glyph: "coins",
    max: 5,
    baseCost: 200,
    step: 10,
    unit: "%",
    description: "Or ramassé pendant la partie.",
  },
  {
    id: "curse",
    name: "Malédiction",
    glyph: "skull",
    max: 5,
    baseCost: 1666,
    step: 10,
    unit: "%",
    description: "Des ennemis plus nombreux, plus rapides et plus résistants.",
  },
  {
    id: "revival",
    name: "Second souffle",
    glyph: "sparkles",
    max: 1,
    baseCost: 10000,
    step: 1,
    unit: "",
    description: "Résurrection avec 50 % de vie, une fois par partie.",
  },
  {
    id: "shield",
    name: "Égide du refuge",
    glyph: "shield",
    max: 5,
    baseCost: 600,
    step: 10,
    unit: " points",
    description: "Bouclier : recharge de 10 points/s après 5 s sans dégât.",
  },
] as const satisfies readonly {
  id: CemeteryUpgradeId;
  name: string;
  glyph: string;
  max: number;
  baseCost: number;
  step: number;
  unit: string;
  description: string;
}[];
export function cemeteryWeapon(id: CemeteryWeaponId) {
  return CEMETERY_WEAPONS.find((w) => w.id === id)!;
}
export function cemeteryPassive(id: CemeteryPassiveId) {
  return CEMETERY_PASSIVES.find((p) => p.id === id)!;
}
export function weaponNumbers(
  id: CemeteryWeaponId,
  level: number,
  evolved = false,
): WeaponNumbers {
  const w = cemeteryWeapon(id),
    n = { ...w.base };
  for (const delta of w.levels.slice(0, Math.max(0, Math.min(7, level - 1)))) {
    for (const key of Object.keys(delta) as (keyof WeaponNumbers)[])
      n[key] += delta[key]!;
  }
  return evolved ? { ...n, ...w.evolved } : n;
}
export function upgradeCost(id: CemeteryUpgradeId, currentRank: number) {
  const spec = CEMETERY_UPGRADES.find((u) => u.id === id);
  if (
    !spec ||
    !Number.isSafeInteger(currentRank) ||
    currentRank < 0 ||
    currentRank >= spec.max
  )
    throw new Error("Cette amélioration a atteint son maximum.");
  const gold = spec.baseCost * (currentRank + 1);
  return { gold, emeralds: Math.ceil(gold / 200) };
}
export function upgradeBonus(id: CemeteryUpgradeId, rank: number) {
  const u = CEMETERY_UPGRADES.find((u) => u.id === id)!;
  const value =
    id === "health"
      ? (1.1 ** rank - 1) * 100
      : id === "magnet"
        ? (1.25 ** rank - 1) * 100
        : u.step * rank;
  return `${value > 0 ? "+" : ""}${Number(value.toFixed(2)).toLocaleString("fr-FR")}${u.unit}`;
}
