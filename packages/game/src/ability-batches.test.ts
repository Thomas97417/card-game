import { describe, expect, it } from "vitest";
import {
  DEFAULT_DECK, createGame, summon, useHeroAbility, validateDeck,
  type CardAbility,
} from "./index";

function fresh() {
  const cards = validateDeck(DEFAULT_DECK);
  const state = createGame([
    { userId: "a", name: "A", cards, heroLevel: 1 },
    { userId: "b", name: "B", cards, heroLevel: 1 },
  ], 0, () => 0.25, { field: false });
  state.activePlayer = 0;
  return state;
}

describe("ability animation batches", () => {
  it("keeps a hero's area hit together through immunity and shields without changing damage", () => {
    const state = fresh();
    state.turn = 3;
    state.players[1]!.board = [
      { cardId: DEFAULT_DECK[0]!, row: 0, depth: 0, hp: 10, immune: true },
      { cardId: DEFAULT_DECK[0]!, row: 1, depth: 0, hp: 10, shield: true },
      { cardId: DEFAULT_DECK[0]!, row: 2, depth: 0, hp: 10 },
    ];
    const before = structuredClone(state);
    const result = useHeroAbility(state, 0, "storm", 0, 3, 1, () => 0.25);
    const effects = result.events.filter((event) => event.type === "ability");
    expect(effects.map((event) => event.ability)).toEqual([
      "Immunité", "Bouclier mental", "Tempête de feuilles",
    ]);
    expect(effects[0]!.abilityBatch).toBeDefined();
    expect(new Set(effects.map((event) => event.abilityBatch)).size).toBe(1);
    expect(result.events[0]!.type).toBe("hero_ability");
    expect(result.events[0]!.abilityBatch).toBeUndefined();
    expect(result.state.players[1]!.board.map((unit) => unit.hp)).toEqual([10, 10, 7]);
    expect(state).toEqual(before);
  });

  it("identifies distinct activations even when their caster and display name are the same", () => {
    const state = fresh();
    const caster = state.players[0]!.cards.find((card) => card.id === "wisp:common")!;
    caster.abilities = [2, 3].map((value, index): CardAbility => ({
      id: `wave-${index}`, name: "Vague", description: "Inflige des dégâts.",
      unlockLevel: 1, active: true, effect: "damage", trigger: "deploy", target: "all_enemies", value,
    }));
    state.players[1]!.board = [0, 1].map((row) => ({
      cardId: DEFAULT_DECK[0]!, row, depth: 0, hp: 10,
    }));
    const result = summon(state, 0, caster.id, 3, 2, 1, 1, () => 0.25);
    const effects = result.events.filter((event) => event.ability === "Vague");
    expect(effects.map((event) => event.hp)).toEqual([8, 8, 5, 5]);
    expect(effects[0]!.abilityBatch).toBe(effects[1]!.abilityBatch);
    expect(effects[2]!.abilityBatch).toBe(effects[3]!.abilityBatch);
    expect(effects[0]!.abilityBatch).not.toBe(effects[2]!.abilityBatch);
  });

  it("keeps an area buff's targets in one batch when a curse reacts between them", () => {
    const state = fresh();
    const caster = state.players[0]!.cards.find((card) => card.id === "wisp:common")!;
    caster.abilities = [{
      id: "rally", name: "Ralliement", description: "Accorde de l’attaque.",
      unlockLevel: 1, active: true, effect: "attack", trigger: "deploy", target: "all_allies", value: 2,
    }];
    state.players[0]!.board = [0, 1].map((row) => ({
      cardId: DEFAULT_DECK[0]!, row, depth: 0, hp: 10, attackCurse: 1,
    }));
    const result = summon(state, 0, caster.id, 3, 2, 1, 1, () => 0.25);
    const effects = result.events.filter((event) =>
      event.ability === "Ralliement" || event.ability === "Malédiction",
    );
    expect(effects.map((event) => event.ability)).toEqual([
      "Ralliement", "Malédiction", "Ralliement", "Malédiction",
    ]);
    expect(effects[0]!.abilityBatch).toBeDefined();
    expect(effects[0]!.abilityBatch).toBe(effects[2]!.abilityBatch);
    expect(effects[1]!.abilityBatch).toBeUndefined();
    expect(effects[3]!.abilityBatch).toBeUndefined();
  });
});
