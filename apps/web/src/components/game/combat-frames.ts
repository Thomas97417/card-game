import type { GameEvent } from "@sylve/game";

/** Keep a cast's impacts together, including reactions interleaved by the engine. */
export function combatFrames(events: GameEvent[]): GameEvent[][] {
  const batchEnds = new Map<number, number>();
  events.forEach((event, index) => {
    if (event.abilityBatch !== undefined) batchEnds.set(event.abilityBatch, index);
  });
  const frames: GameEvent[][] = [];
  for (let start = 0; start < events.length;) {
    let end = start;
    for (let index = start; index <= end; index++) {
      const batch = events[index]!.abilityBatch;
      if (batch !== undefined) end = Math.max(end, batchEnds.get(batch)!);
    }
    // Victims of the same area hit disappear together after their death animation.
    if (events[start]!.type === "death")
      while (events[end + 1]?.type === "death") end++;
    frames.push(events.slice(start, end + 1));
    start = end + 1;
  }
  return frames;
}
