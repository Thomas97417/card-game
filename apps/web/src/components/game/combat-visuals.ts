import type { GameEvent } from "@sylve/game";
import { COMBAT_TIMING } from "./combat-timing";

export interface CombatActor {
  player: number;
  cardId: string;
  row?: number;
  depth?: number;
}

export function combatActorKey(actor: CombatActor) {
  return JSON.stringify([
    actor.player, actor.cardId,
    actor.cardId === "hero" ? -1 : actor.row ?? -1,
    actor.cardId === "hero" ? -1 : actor.depth ?? -1,
  ]);
}

const sealActivations = {
  "Rune de blocage": { kind: "rune", stat: "block" },
  "Rune de vie": { kind: "rune", stat: "health" },
  "Rune de puissance": { kind: "rune", stat: "attack" },
  "Pentagramme de vie": { kind: "pentagram", stat: "health" },
  "Pentagramme de puissance": { kind: "pentagram", stat: "attack" },
} as const;

export function sealActivation(event: GameEvent) {
  if (event.type !== "ability" || !event.unit || (event.amount ?? 0) <= 0)
    return undefined;
  return sealActivations[event.ability as keyof typeof sealActivations];
}

/** A reinforcement's position belongs to the new unit, not its caster. */
export function abilitySource(event: GameEvent | null): CombatActor | null {
  if (!event?.ability) return null;
  if (event.type === "hero_ability")
    return { player: event.player, cardId: "hero", row: -1, depth: -1 };
  if (event.type === "summon")
    return event.source ? { ...event.source, player: event.player } : null;
  if (
    event.type !== "ability" || !event.cardId || sealActivation(event) ||
    ["Poison", "Fin de l’entrave", "Fin du bonus temporaire"].includes(event.ability)
  ) return null;
  if (event.cardId !== "hero" &&
    (event.row === undefined || event.depth === undefined || event.row < 0 || event.depth < 0))
    return null;
  return {
    player: event.player, cardId: event.cardId,
    row: event.row ?? -1, depth: event.depth ?? -1,
  };
}

export function abilityOrigins(events: readonly GameEvent[]) {
  const origins = new Map<string, GameEvent>();
  for (const event of events) {
    const source = abilitySource(event);
    if (!source) continue;
    const key = combatActorKey(source);
    const previous = origins.get(key);
    if (!previous || ["Immunité", "Bouclier mental"].includes(previous.ability ?? ""))
      origins.set(key, event);
  }
  return [...origins.values()];
}

/** Playback, damage labels and visual timelines share the same impact clock. */
export function combatFrameTiming(events: readonly GameEvent[]) {
  const duration = Math.max(0, ...events.map((event) => {
    switch (event.type) {
      case "attack": return COMBAT_TIMING.attack;
      case "ability": return COMBAT_TIMING.ability;
      case "hero_ability": return COMBAT_TIMING.heroAbility;
      case "summon": return COMBAT_TIMING.summon;
      case "death": return COMBAT_TIMING.death;
      case "withdraw": return COMBAT_TIMING.withdraw;
      default: return 0;
    }
  }));
  const first = events[0];
  const impact = first?.type === "summon" ? 0
    : first?.type === "attack" ? COMBAT_TIMING.impact
    : first?.type === "ability" ? COMBAT_TIMING.abilityImpact : duration;
  return { duration, impact };
}
