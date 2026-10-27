import { describe, expect, it } from "vitest";
import type { GameEvent } from "@sylve/game";
import { combatFrames } from "./combat-frames";

function effect(seq: number, targetRow: number, extra: Partial<GameEvent> = {}): GameEvent {
  return {
    seq, type: "ability", player: 0, cardId: "wisp:common", row: 0, depth: 2,
    ability: "Vague sylvestre", targetPlayer: 1, targetCardId: "guardian:common",
    targetRow, targetDepth: 0, amount: -3, hp: 7, ...extra,
  };
}

describe("combat frames from saved event streams", () => {
  it("keeps consecutive casts separate when targets repeat and batch metadata is missing", () => {
    const events = [effect(1, 0), effect(2, 1), effect(3, 2), effect(4, 0), effect(5, 1), effect(6, 2)];
    expect(combatFrames(events).map((frame) => frame.map((event) => event.seq)))
      .toEqual([[1, 2, 3], [4, 5, 6]]);
  });

  it("includes shielded and immune targets in the same unbatched area spell", () => {
    const events = [
      effect(1, 0, { ability: "Bouclier mental", amount: 0 }),
      effect(2, 1, { ability: "Immunité", amount: 0 }),
      effect(3, 2),
    ];
    expect(combatFrames(events)).toEqual([events]);
  });

  it("keeps the engine order when a reaction is interleaved between targets", () => {
    const events = [effect(1, 0), effect(2, 0, {
      player: 1, cardId: "turtle:common", row: 3, depth: 0,
      ability: "Riposte", targetPlayer: 0, targetCardId: "wisp:common", targetRow: 0, targetDepth: 2,
    }), effect(3, 1)];
    expect(combatFrames(events)).toEqual([events]);
  });

  it("does not combine separate copies of a caster", () => {
    const events = [effect(1, 0), effect(2, 1, { row: 1 })];
    expect(combatFrames(events)).toEqual([[events[0]], [events[1]]]);
  });

  it("does not combine effects across an ordinary attack", () => {
    const attack: GameEvent = { seq: 2, type: "attack", player: 0, damage: 3 };
    const events = [effect(1, 0), attack, effect(3, 1)];
    expect(combatFrames(events)).toEqual(events.map((event) => [event]));
  });

  it("respects explicit activation IDs even when labels and caster coordinates match", () => {
    const events = [
      effect(1, 0, { abilityBatch: 1 }), effect(2, 1, { abilityBatch: 1 }),
      effect(3, 2, { abilityBatch: 3 }),
    ];
    expect(combatFrames(events)).toEqual([events.slice(0, 2), events.slice(2)]);
  });
});
