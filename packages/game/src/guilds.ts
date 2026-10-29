export const GUILD_MEMBER_LIMIT = 30;
export const GUILD_NAME_MIN = 3;
export const GUILD_NAME_MAX = 32;
export const GUILD_DESCRIPTION_MAX = 160;

/** Shared allowlist: clients select an ID, never an arbitrary image URL. */
export const GUILD_EMBLEMS = [
  {
    id: "ember-dragon",
    name: "Dragon de braise",
    image: "/art/guilds/ember-dragon.webp",
    isNew: true,
  },
  {
    id: "moon-wolf",
    name: "Loup lunaire",
    image: "/art/guilds/moon-wolf.webp",
    isNew: true,
  },
  {
    id: "sun-phoenix",
    name: "Phénix solaire",
    image: "/art/guilds/sun-phoenix.webp",
    isNew: true,
  },
  {
    id: "abyss-kraken",
    name: "Kraken des abysses",
    image: "/art/guilds/abyss-kraken.webp",
    isNew: true,
  },
  {
    id: "sylve",
    name: "Écu de la Sylve",
    image: "/art/ui/guardian-emblem.webp",
    isNew: false,
  },
  {
    id: "nature",
    name: "Cœur de Nature",
    image: "/art/factions/nature-icon.webp",
    isNew: false,
  },
  {
    id: "order",
    name: "Sceau de l’Ordre",
    image: "/art/factions/order-icon.webp",
    isNew: false,
  },
  {
    id: "chaos",
    name: "Sceau du Chaos",
    image: "/art/factions/chaos-icon.webp",
    isNew: false,
  },
  {
    id: "arena",
    name: "Lames de l’arène",
    image: "/art/ui/arena-swords.webp",
    isNew: false,
  },
  {
    id: "sanctuary",
    name: "Cristal du sanctuaire",
    image: "/art/ui/sanctuary-crystal.webp",
    isNew: false,
  },
  {
    id: "soulbind",
    name: "Liens d’âme",
    image: "/art/ui/soulbind-links.webp",
    isNew: false,
  },
  {
    id: "victory",
    name: "Couronne des vainqueurs",
    image: "/art/results/victory.webp",
    isNew: false,
  },
  {
    id: "dragon",
    name: "Dragon d’ambre",
    image: "/art/characters/dragon.webp",
    isNew: false,
  },
  {
    id: "wolf",
    name: "Loup des failles",
    image: "/art/characters/evolutions/wolf-rare.webp",
    isNew: false,
  },
  {
    id: "owl",
    name: "Prêtresse de l’aurore",
    image: "/art/characters/owl.webp",
    isNew: false,
  },
  {
    id: "stag",
    name: "Pèlerine du serment",
    image: "/art/characters/stag.webp",
    isNew: false,
  },
] as const;

export type GuildEmblemId = (typeof GUILD_EMBLEMS)[number]["id"];

export function guildEmblem(id: string) {
  return GUILD_EMBLEMS.find((emblem) => emblem.id === id) ?? GUILD_EMBLEMS[4];
}

export function guildNameKey(name: string) {
  return name
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("fr-FR");
}
