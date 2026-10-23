import { CATALOG, type CardDefinition } from "./cards";

// Saved pre-ability matches keep their original immutable definitions. Regression
// tests exercise those snapshots independently of the new live card catalogue.
const stats: Record<string, [number, number]> = {
  guardian: [2, 9],
  fox: [5, 3],
  owl: [4, 4],
  stag: [4, 6],
  mushroom: [2, 8],
  dragon: [7, 1],
  turtle: [1, 12],
  wisp: [3, 5],
  wolf: [6, 2],
  knight: [3, 8],
  serpent: [5, 4],
  bear: [4, 7],
};
export function legacyDeck(ids: readonly string[]): CardDefinition[] {
  return ids.map((id) => {
    const c = CATALOG.find((card) => card.id === id)!;
    const [attack, health] = stats[id]!;
    return {
      id,
      name: c.name,
      title: c.title,
      color: c.color,
      kind: c.kind,
      combatType: c.combatType,
      attack,
      health,
    };
  });
}
