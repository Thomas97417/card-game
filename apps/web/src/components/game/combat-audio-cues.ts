import type { GameEvent } from "@sylve/game";
import { eventIconKind } from "./ability-icons";
import { combatFrameTiming, type CombatActor } from "./combat-visuals";

export type CombatSound = "swing" | "shot" | "strike" | "shield" | "magic" | "heal" | "poison" | "freeze" | "summon" | "death" | "hero" | "victory" | "defeat";
export interface CombatAudioCue { sound: CombatSound; at: number; pan: number; gain: number; seed: number }

export const silentAbilityEnds = new Set(["Fin de l’entrave", "Fin du bonus temporaire", "Fin du gel"]);

export function abilitySound(event: GameEvent): CombatSound {
  const icon = eventIconKind(event);
  if (["mental-shield", "block", "immunity", "evasion"].includes(icon ?? "")) return "shield";
  if (["heal", "regeneration", "life-rune", "vitality"].includes(icon ?? "") && (event.amount ?? 0) > 0) return "heal";
  if (icon === "poison") return "poison";
  if (icon === "freeze") return "freeze";
  return "magic";
}

/** One sound per type and side for a simultaneous area hit, to keep the mix clear. */
export function combatAudioCues(events: readonly GameEvent[], viewer: number, ranged: (actor: CombatActor) => boolean) {
  const { impact } = combatFrameTiming(events);
  const cues = new Map<string, CombatAudioCue>();
  const add = (event: GameEvent, sound: CombatSound, at: number, player: number, gain = 1) => {
    const pan = player === viewer ? -0.55 : 0.55;
    const key = `${sound}:${at}:${pan}`;
    if (!cues.has(key)) cues.set(key, { sound, at, pan, gain, seed: event.seq });
  };
  for (const event of events) {
    if (event.type === "attack") {
      add(event, ranged({ player: event.player, cardId: event.cardId ?? "hero", row: event.row, depth: event.depth }) ? "shot" : "swing", 0, event.player, 0.65);
      add(event, event.damage === 0 ? "shield" : "strike", impact, event.targetPlayer ?? 1 - event.player);
    } else if (event.type === "hero_ability") {
      add(event, "hero", 0, event.player, 0.8);
    } else if (event.type === "ability") {
      if (silentAbilityEnds.has(event.ability ?? "")) continue;
      // Placing a mark is audible at the cast; it has no victim to hit.
      add(event, abilitySound(event), (event.runes || event.pentagrams) && !event.unit ? 0 : impact, event.targetPlayer ?? event.player, 0.7);
    } else if (event.type === "summon") {
      add(event, "summon", 0, event.player, 0.75);
    } else if (event.type === "death" || event.type === "withdraw") {
      add(event, "death", 0, event.player, 0.65);
    }
  }
  return [...cues.values()];
}
