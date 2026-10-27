import type { GameEvent } from "@sylve/game";

const protections = new Set(["Immunité", "Bouclier mental"]);
const fieldEffects = new Set([
  "Rune de vie", "Rune de puissance", "Pentagramme de vie", "Pentagramme de puissance",
  "Poison", "Fin de l’entrave", "Fin du bonus temporaire", "Vitalité de formation",
]);

function effectSource(event: GameEvent) {
  if (event.type !== "ability" || !event.cardId || !event.ability) return null;
  if (
    fieldEffects.has(event.ability) && event.player === event.targetPlayer &&
    event.cardId === event.targetCardId && event.row === event.targetRow && event.depth === event.targetDepth
  ) return JSON.stringify(["field", event.player, event.ability]);
  return JSON.stringify([event.player, event.cardId, event.row ?? -1, event.depth ?? -1]);
}

/** Older server responses have no batch ID: recover a cast from its caster and
 * distinct targets within one effect phase. A repeated target starts a new cast. */
function inferAbilityEnds(events: GameEvent[]) {
  const ends = new Map<number, number>();
  const claimed = new Set<number>();
  const sources = events.map(effectSource);
  for (let start = 0; start < events.length; start++) {
    const first = events[start]!;
    const source = sources[start];
    if (!source || first.abilityBatch !== undefined || claimed.has(start)) continue;
    let phaseEnd = start + 1;
    while (events[phaseEnd]?.type === "ability") phaseEnd++;
    const name = protections.has(first.ability!)
      ? events.slice(start, phaseEnd).find((event, offset) =>
          sources[start + offset] === source && event.abilityBatch === undefined &&
          !protections.has(event.ability!),
        )?.ability ?? first.ability
      : first.ability;
    const targets = new Map<string, boolean>();
    let previousTarget: string | undefined;
    let end = start;
    for (let index = start; index < phaseEnd; index++) {
      const event = events[index]!;
      if (sources[index] !== source) continue;
      if (event.abilityBatch !== undefined || claimed.has(index)) break;
      const protectedTarget = protections.has(event.ability!);
      if (event.ability !== name && !protectedTarget) continue;
      const target = JSON.stringify([
        event.targetPlayer ?? event.player, event.targetCardId ?? "hero",
        event.targetRow ?? -1, event.targetDepth ?? -1,
      ]);
      if (targets.has(target) &&
        (targets.get(target) || protectedTarget || previousTarget !== target)) break;
      targets.set(target, !protectedTarget);
      previousTarget = target;
      claimed.add(index);
      end = index;
    }
    ends.set(start, end);
  }
  return ends;
}

/** Keep a cast's impacts together, including reactions interleaved by the engine. */
export function combatFrames(events: GameEvent[]): GameEvent[][] {
  const batchEnds = new Map<number, number>();
  events.forEach((event, index) => {
    if (event.abilityBatch !== undefined) batchEnds.set(event.abilityBatch, index);
  });
  const inferredEnds = inferAbilityEnds(events);
  const frames: GameEvent[][] = [];
  for (let start = 0; start < events.length;) {
    let end = start;
    for (let index = start; index <= end; index++) {
      const batch = events[index]!.abilityBatch;
      end = Math.max(end, batch !== undefined
        ? batchEnds.get(batch)!
        : inferredEnds.get(index) ?? index);
    }
    // Victims of the same area hit disappear together after their death animation.
    if (events[start]!.type === "death")
      while (events[end + 1]?.type === "death") end++;
    frames.push(events.slice(start, end + 1));
    start = end + 1;
  }
  return frames;
}
