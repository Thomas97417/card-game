import { baseCardId, getCombatType, resolveCard, type CardDefinition, type CombatType, type HeroId } from "@sylve/game";

export const AUDIO_ROLES = ["blade", "spear", "hammer", "heavy", "claw", "bow", "mage", "priest", "bard", "dragon", "spirit", "plant", "turret", "building"] as const;
export const AUDIO_ELEMENTS = ["physical", "arcane", "light", "shadow", "fire", "water", "nature", "earth", "ice", "storm", "poison"] as const;
export type AudioRole = typeof AUDIO_ROLES[number];
export type AudioElement = typeof AUDIO_ELEMENTS[number];
export interface CardAudioProfile { mode: CombatType; role: AudioRole; element: AudioElement }
type Voice = Pick<CardAudioProfile, "role" | "element">;

// These stable catalogue IDs predate the current artwork: fox is an archer,
// owl a priestess and lynx a knight. Their old animal IDs must not pick the sound.
const families: Record<string, Voice> = {
  guardian: { role: "heavy", element: "earth" },
  fox: { role: "bow", element: "physical" },
  owl: { role: "priest", element: "light" },
  stag: { role: "spear", element: "light" },
  mushroom: { role: "mage", element: "nature" },
  dragon: { role: "dragon", element: "fire" },
  turtle: { role: "heavy", element: "earth" },
  wisp: { role: "spirit", element: "water" },
  wolf: { role: "claw", element: "shadow" },
  knight: { role: "blade", element: "physical" },
  serpent: { role: "mage", element: "poison" },
  bear: { role: "claw", element: "physical" },
  healer: { role: "claw", element: "nature" },
  gnome: { role: "hammer", element: "fire" },
  idol: { role: "plant", element: "nature" },
  enchantress: { role: "mage", element: "arcane" },
  lynx: { role: "blade", element: "physical" },
  bard: { role: "bard", element: "light" },
  tree: { role: "plant", element: "nature" },
  vampire: { role: "claw", element: "shadow" },
  captain: { role: "blade", element: "physical" },
  witch: { role: "mage", element: "shadow" },
  "root-coil": { role: "turret", element: "storm" },
  "life-palace": { role: "building", element: "light" },
};
const evolutions: Record<string, AudioElement> = {
  "dragon:rare": "nature", "dragon:epic": "storm", "dragon:legendary": "fire",
  "bear:rare": "ice", "bear:epic": "storm", "bear:legendary": "storm",
  "wisp:rare": "nature", "serpent:rare": "shadow", "witch:rare": "fire",
};

export function namedAudioElement(name: string): AudioElement | undefined {
  const text = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/givre|glace|gel\b|neige|fjord|hiver/.test(text)) return "ice";
  if (/tonnerre|orage|foudre|\beclairs?\b|tempetes?$/.test(text)) return "storm";
  if (/braise|brasier|flamme|feu\b|explosi/.test(text)) return "fire";
  if (/poison|venin/.test(text)) return "poison";
  if (/ombre|crepuscule|neant|carmin|abysses/.test(text)) return "shadow";
  if (/source|pluie|maree|eau\b/.test(text)) return "water";
  if (/feuille|ronce|racine|fougere|clairiere|floraison/.test(text)) return "nature";
  return undefined;
}

export function cardAudioProfile(card: CardDefinition): CardAudioProfile {
  const family = baseCardId(card);
  const art = card.artId?.split("/").pop()?.replace(/-(common|rare|epic|legendary)$/, "");
  const voice = families[family] ?? (art ? families[art] : undefined);
  const mode = getCombatType(card);
  const token = card.id.startsWith("token");
  const role = card.kind === "archer" ? "bow"
    : card.kind === "tesla" ? "turret"
    : card.kind === "life_palace" ? "building"
    : token && card.kind === "knight" ? "blade"
    : voice?.role ?? (mode === "building" ? "building" : mode === "ranged" ? "mage" : "blade");
  const innate = card.abilities?.some((ability) => ability.active && ability.effect === "freeze") ? "ice" : undefined;
  const element = evolutions[`${family}:${card.rarity}`] ?? namedAudioElement(card.name) ?? innate ?? voice?.element
    ?? (mode === "ranged" ? "arcane" : "physical");
  return { mode, role, element };
}

export function heroAudioProfile(hero: HeroId = "sylve"): CardAudioProfile {
  const elements: Record<HeroId, AudioElement> = {
    sylve: "nature", thorn: "nature", weaver: "poison", void: "ice", north: "ice",
    maestro: "nature", shaman: "nature", winter: "ice", moon: "shadow", shadow: "shadow", flame: "fire",
  };
  return { mode: "ranged", role: hero === "maestro" ? "bard" : "mage", element: elements[hero] };
}

export function audioProfileForId(id: string): CardAudioProfile {
  if (id === "hero") return heroAudioProfile();
  try { return cardAudioProfile(resolveCard(id)); }
  catch { return { mode: "melee", role: "blade", element: "physical" }; }
}

export function audioProfileKey(profile: CardAudioProfile) {
  return `${profile.mode}:${profile.role}:${profile.element}`;
}

export function parseAudioProfile(key?: string): CardAudioProfile | undefined {
  const [mode, role, element] = key?.split(":") ?? [];
  if (!["melee", "ranged", "building"].includes(mode ?? "") ||
    !AUDIO_ROLES.includes(role as AudioRole) || !AUDIO_ELEMENTS.includes(element as AudioElement)) return undefined;
  return { mode: mode as CombatType, role: role as AudioRole, element: element as AudioElement };
}
