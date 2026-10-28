import type { GameEvent } from "@sylve/game";
import { eventIconKind } from "./ability-icons";
import { combatFrameTiming, type CombatActor } from "./combat-visuals";
import { audioProfileForId, cardAudioProfile, namedAudioElement, type AudioElement, type CardAudioProfile } from "./combat-audio-profile";

export type CombatSound = "swing" | "shot" | "strike" | "shield" | "magic" | "heal" | "poison" | "freeze" | "summon" | "death" | "hero" | "victory" | "defeat"
  | "heavy-swing" | "claw-swing" | "hammer-hit" | "hit-blunt" | "hit-arrow" | "bard-cast" | "beast-arrival" | "arrival-metal" | "summon-heavy"
  | `${"cast" | "hit"}-${Exclude<AudioElement, "physical">}`;
export interface CombatAudioCue { sound: CombatSound; at: number; pan: number; gain: number; seed: number; pitch?: number }

export const silentAbilityEnds = new Set(["Fin de l’entrave", "Fin du bonus temporaire", "Fin du gel"]);

export function abilitySound(event: GameEvent, profile?: CardAudioProfile): CombatSound {
  const icon = eventIconKind(event);
  if (["mental-shield", "block", "immunity", "evasion"].includes(icon ?? "")) return "shield";
  if (["heal", "regeneration", "life-rune", "vitality"].includes(icon ?? "") && (event.amount ?? 0) > 0) return "heal";
  if (icon === "poison") return "poison";
  if (icon === "freeze" || ["Gel", "Toucher de givre"].includes(event.ability ?? "")) return "freeze";
  if (icon === "vampirism" || icon === "weaken") return "hit-shadow";
  const element = namedAudioElement(event.ability ?? "") ?? profile?.element;
  if (element && element !== "physical") return `${(event.amount ?? 0) < 0 ? "hit" : "cast"}-${element}`;
  if (profile && (event.amount ?? 0) < 0) return attackSounds(profile).hit;
  return "magic";
}

function attackSounds(profile: CardAudioProfile): { prepare: CombatSound; hit: CombatSound; accent?: CombatSound } {
  const element = profile.element === "physical" ? undefined : profile.element;
  if (profile.mode !== "melee" && profile.role !== "bow") {
    return {
      prepare: profile.role === "bard" ? "bard-cast" : `cast-${element ?? "arcane"}`,
      hit: `hit-${element ?? "arcane"}`,
    };
  }
  const prepare = profile.mode === "ranged" ? "shot"
    : ["heavy", "hammer", "plant"].includes(profile.role) ? "heavy-swing"
    : profile.role === "claw" ? "claw-swing" : "swing";
  const hit = profile.mode === "ranged" ? "hit-arrow"
    : profile.role === "hammer" ? "hammer-hit"
    : ["heavy", "plant", "claw"].includes(profile.role) ? "hit-blunt" : "strike";
  return { prepare, hit, ...(element ? { accent: `hit-${element}` as CombatSound } : {}) };
}

function arrivalSound(profile: CardAudioProfile): CombatSound | null {
  if (profile.role === "claw") return "beast-arrival";
  if (profile.role === "bard") return "bard-cast";
  if (profile.element !== "physical") return `cast-${profile.element}`;
  return profile.role === "bow" ? null : "arrival-metal";
}

/** One sound per type and side for a simultaneous area hit, to keep the mix clear. */
export function combatAudioCues(events: readonly GameEvent[], viewer: number, profileFor: (actor: CombatActor) => CardAudioProfile | undefined = () => undefined) {
  const { impact } = combatFrameTiming(events);
  const cues = new Map<string, CombatAudioCue>();
  const add = (event: GameEvent, sound: CombatSound, at: number, player: number, gain = 1, pitch = 1) => {
    const pan = player === viewer ? -0.55 : 0.55;
    const key = `${sound}:${at}:${pan}`;
    if (!cues.has(key)) cues.set(key, { sound, at, pan, gain, seed: event.seq, ...(pitch !== 1 ? { pitch } : {}) });
  };
  for (const event of events) {
    const actor = { player: event.player, cardId: event.cardId ?? "hero", row: event.row, depth: event.depth };
    const profile = profileFor(actor) ?? (event.type === "summon" && event.unit?.definition
      ? cardAudioProfile(event.unit.definition) : audioProfileForId(actor.cardId));
    const pitch = profile.role === "dragon" ? 0.84 : profile.role === "spirit" ? 1.12 : profile.role === "priest" ? 1.06 : 1;
    if (event.type === "attack") {
      const sounds = attackSounds(profile);
      add(event, sounds.prepare, 0, event.player, 0.65, pitch);
      const target = event.targetPlayer ?? 1 - event.player;
      add(event, event.damage === 0 ? "shield" : sounds.hit, impact, target, 0.85, event.damage === 0 ? 1 : pitch);
      if (sounds.accent && event.damage !== 0) add(event, sounds.accent, impact, target, 0.42);
    } else if (event.type === "hero_ability") {
      const element = namedAudioElement(event.ability ?? "") ?? profile.element;
      add(event, element === "physical" ? "hero" : `cast-${element}`, 0, event.player, 0.75, pitch);
    } else if (event.type === "ability") {
      if (silentAbilityEnds.has(event.ability ?? "")) continue;
      // Placing a mark is audible at the cast; it has no victim to hit.
      add(event, abilitySound(event, profile), (event.runes || event.pentagrams) && !event.unit ? 0 : impact, event.targetPlayer ?? event.player, 0.65);
    } else if (event.type === "summon") {
      add(event, ["heavy", "plant", "building", "turret"].includes(profile.role) ? "summon-heavy" : "summon", 0, event.player, 0.85);
      const accent = arrivalSound(profile);
      if (accent) add(event, accent, 45, event.player, 0.35, pitch);
      if (profile.role === "claw" && profile.element !== "physical") add(event, `cast-${profile.element}`, 70, event.player, 0.2);
    } else if (event.type === "death" || event.type === "withdraw") {
      add(event, "death", 0, event.player, 0.65);
    }
  }
  return [...cues.values()];
}
