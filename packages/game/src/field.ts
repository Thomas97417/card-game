import { cloneCard, type CardDefinition } from "./cards";
import { ROWS, shuffle, type PlayerState, type Unit } from "./index";

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

/** Both sides receive independent copies of the same randomly arranged field. */
export function populateField(players: PlayerState[], random: () => number) {
  const rows = shuffle(Array.from({ length: ROWS }, (_, row) => row), random);
  const kinds = shuffle(
    Object.keys(FIELD_BUILDINGS) as FieldBuildingKind[],
    random,
  );
  const board = [
    createFieldBuilding(kinds[0]!, rows[0]!, 0),
    createFieldBuilding(kinds[1]!, rows[2]!, 1),
  ];
  for (const player of players) {
    player.board = board.map((unit) => ({
      ...unit,
      definition: cloneCard(unit.definition!),
    }));
    player.runes = [{ row: rows[1]!, depth: 1, health: 3 }];
    player.pentagrams = [{ row: rows[3]!, depth: 1, attack: 2 }];
  }
}
