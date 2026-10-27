import { cloneCard, type CardDefinition } from "./cards";
import {
  DEPTHS,
  ROWS,
  shuffle,
  type Pentagram,
  type PlayerState,
  type Rune,
  type Unit,
} from "./index";

export type FieldBuildingKind = "spikes" | "dark-tree" | "mossy-rock";

/** Field scenery has its own definitions and never enters a collectible deck. */
export const FIELD_BUILDINGS: Record<FieldBuildingKind, CardDefinition> = {
  spikes: {
    id: "field-spikes",
    name: "Pieux de ronces",
    title: "Les vestiges d’une ancienne défense",
    kind: "field-building",
    combatType: "building",
    color: "#a57c4e",
    attack: 0,
    health: 5,
    abilities: [
      {
        id: "field-spikes",
        name: "Épines",
        description:
          "Renvoie 1 dégât à son attaquant, même si les pieux sont détruits.",
        unlockLevel: 1,
        active: true,
        value: 1,
        effect: "spikes",
        trigger: "passive",
        target: "self",
      },
    ],
  },
  "dark-tree": {
    id: "field-dark-tree",
    name: "Arbre sombre",
    title: "Une racine oubliée qui refuse de mourir",
    kind: "field-building",
    combatType: "building",
    color: "#756080",
    attack: 0,
    health: 7,
    abilities: [
      {
        id: "field-regeneration",
        name: "Régénération",
        description:
          "Récupère 1 PV au début du tour de son côté du terrain, jusqu’à ses PV maximum.",
        unlockLevel: 1,
        active: true,
        value: 1,
        effect: "regeneration",
        trigger: "passive",
        target: "self",
      },
    ],
  },
  "mossy-rock": {
    id: "field-mossy-rock",
    name: "Rocher moussu",
    title: "La mémoire immobile de la forêt",
    kind: "field-building",
    combatType: "building",
    color: "#8c9871",
    attack: 0,
    health: 9,
    abilities: [],
  },
};

export function createFieldBuilding(
  kind: FieldBuildingKind,
  row: number,
  depth: number,
): Unit {
  const definition = cloneCard(FIELD_BUILDINGS[kind]);
  return {
    cardId: definition.id,
    row,
    depth,
    hp: definition.health,
    fieldObject: kind,
    definition,
    ...(kind === "spikes" ? { spikes: 1 } : {}),
    ...(kind === "dark-tree" ? { regeneration: 1 } : {}),
  };
}

interface FieldCounts {
  buildings: number;
  runes: number;
  pentagrams: number;
}

const countOptions: FieldCounts[] = [];
for (let buildings = 0; buildings <= 1; buildings++) {
  for (let runes = 0; runes <= 1; runes++) {
    for (let pentagrams = 0; pentagrams <= 1; pentagrams++) {
      const total = buildings + runes + pentagrams;
      if (total >= 1 && total <= 3)
        countOptions.push({ buildings, runes, pentagrams });
    }
  }
}

// Sampling ordered pairs uniformly gives either player the same chances.
// Permit one extra object of each kind and at most one extra seal in total.
const balancedPairs = countOptions.flatMap((first) =>
  countOptions
    .filter(
      (second) =>
        Math.abs(first.buildings - second.buildings) <= 1 &&
        Math.abs(first.runes - second.runes) <= 1 &&
        Math.abs(first.pentagrams - second.pentagrams) <= 1 &&
        Math.abs(
          first.buildings + first.runes + first.pentagrams -
            second.buildings - second.runes - second.pentagrams,
        ) <= 1 &&
        Math.abs(
          first.runes + first.pentagrams - second.runes - second.pentagrams,
        ) <= 1,
    )
    .map((second) => [first, second] as const),
);

function createField(
  counts: FieldCounts,
  random: () => number,
): { board: Unit[]; runes: Rune[]; pentagrams: Pentagram[] } {
  const rows = shuffle(Array.from({ length: ROWS }, (_, row) => row), random);
  const kinds = shuffle(
    Object.keys(FIELD_BUILDINGS) as FieldBuildingKind[],
    random,
  );
  // At most one obstacle leaves at least three unobstructed lanes.
  const board = kinds.slice(0, counts.buildings).map((kind, index) =>
    createFieldBuilding(kind, rows[index]!, Math.floor(random() * DEPTHS)),
  );
  const cells = shuffle(
    Array.from({ length: ROWS * DEPTHS }, (_, index) => ({
      row: Math.floor(index / DEPTHS),
      depth: index % DEPTHS,
    })).filter(
      (cell) => !board.some(
        (unit) => unit.row === cell.row && unit.depth === cell.depth,
      ),
    ),
    random,
  );
  return {
    board,
    runes: cells.slice(0, counts.runes).map((cell) => ({
      ...cell,
      ...(random() < 0.5 ? { health: 3 } : { attack: 2 }),
    })),
    pentagrams: cells
      .slice(counts.runes, counts.runes + counts.pentagrams)
      .map((cell) => ({
        ...cell,
        ...(random() < 0.5 ? { health: 3 } : { attack: 2 }),
      })),
  };
}

function fieldSignature(player: PlayerState) {
  return [
    ...player.board.map((unit) => `${unit.cardId}:${unit.row}:${unit.depth}`),
    ...(player.runes ?? []).map((rune) => `rune:${rune.row}:${rune.depth}`),
    ...(player.pentagrams ?? []).map((mark) => `pentagram:${mark.row}:${mark.depth}`),
  ].sort().join("|");
}

/** Independent asymmetric fields with small, bounded differences in resources. */
export function populateField(players: PlayerState[], random: () => number) {
  const counts = balancedPairs[Math.floor(random() * balancedPairs.length)]!;
  players.forEach((player, index) => {
    Object.assign(player, createField(counts[index]!, random));
  });
  if (fieldSignature(players[0]!) === fieldSignature(players[1]!)) {
    // A cyclic shift always breaks a mirror: no kind occupies all four rows.
    // No rejection loop, so even a constant random source terminates.
    const second = players[1]!;
    for (const cell of [
      ...second.board,
      ...(second.runes ?? []),
      ...(second.pentagrams ?? []),
    ]) cell.row = (cell.row + 1) % ROWS;
  }
}
