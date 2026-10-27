import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DECK, createGame, playerView, summon, useHeroAbility, validateDeck,
  type CardAbility, type GameEvent, type GameView, type HeroAbilityId,
} from "@sylve/game";
import { DuelArena } from "./duel-arena";
import { useCombatPlayback } from "./use-combat-playback";
import { COMBAT_TIMING } from "./combat-timing";

afterEach(() => vi.useRealTimers());
type View = GameView & { events: GameEvent[] };

function Playback({ view }: { view: View }) {
  const { display, event, events } = useCombatPlayback(view);
  if (!display) return null;
  return <DuelArena
    mine={display.players[display.me]!} enemy={display.players[1 - display.me]!}
    me={display.me} selected={null} selectedUnit={null} hovered={null}
    canSummon={false} combatEvent={event} combatEvents={events}
    onPlace={() => {}} onInspectUnit={() => {}} onInspectHero={() => {}} onInspectField={() => {}}
  />;
}
function fresh() {
  const cards = validateDeck(DEFAULT_DECK);
  const state = createGame([
    { userId: "alice", name: "Alice", cards, heroLevel: 21 },
    { userId: "bob", name: "Bob", cards, heroLevel: 21 },
  ], 0, () => 0.25, { field: false });
  state.activePlayer = 0;
  return state;
}

describe("visible ability casters", () => {
  it.each(["alice", "bob"])("hits every Storm target at once, with concurrent hero rays, for %s", (viewer) => {
    vi.useFakeTimers();
    const state = fresh();
    state.turn = 3;
    state.players[0]!.heroLevel = 1;
    state.players[1]!.board = [0, 1, 2].map((row) => ({
      cardId: DEFAULT_DECK[0]!, row, depth: 0, hp: 10,
    }));
    const initial: View = { ...playerView(state, viewer), events: [] };
    const transition = useHeroAbility(state, 0, "storm", 0, 3, 1, () => 0.25);
    const confirmed = { ...playerView(transition.state, viewer), events: transition.events };
    const { container, rerender } = render(<Playback view={initial} />);
    rerender(<Playback view={confirmed} />);
    const side = viewer === "alice" ? "enemy" : "own";
    const health = () => [...container.querySelectorAll(`.board-half.${side} .stat-badge.health strong`)]
      .map((node) => Number(node.textContent));
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.heroAbility));
    expect(container.querySelectorAll(".ability-trail line")).toHaveLength(3);
    expect(container.querySelectorAll(".ability-origin")).toHaveLength(1);
    expect(container.querySelectorAll(`.board-half.${side} .taking-hit`)).toHaveLength(3);
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.abilityImpact - 1));
    expect(health()).toEqual([10, 10, 10]);
    expect(container.querySelectorAll(".damage-float")).toHaveLength(0);
    act(() => vi.advanceTimersByTime(1));
    expect(health()).toEqual([7, 7, 7]);
    expect(container.querySelectorAll(".damage-float")).toHaveLength(3);
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.ability - COMBAT_TIMING.abilityImpact));
    expect(container.querySelector(".ability-origin")).toBeNull();
    expect(container.querySelectorAll(".damage-float")).toHaveLength(3);
    act(() => vi.runAllTimers());
    expect(container.querySelector(".damage-float")).toBeNull();
    rerender(<Playback view={{ ...confirmed }} />);
    act(() => vi.runAllTimers());
    expect(container.querySelector(".ability-origin")).toBeNull();
  });

  it.each(["damage", "attack", "health", "heal"] as const)(
    "shows a card's %s impacts together without rays", (effect) => {
      vi.useFakeTimers();
      const state = fresh();
      const caster = state.players[0]!.cards.find((card) => card.id === "wisp:common")!;
      const target = effect === "heal" ? 0 : 1;
      caster.abilities = [{
        id: "wave", name: "Vague sylvestre", description: "Affecte tout le camp.",
        unlockLevel: 1, active: true, trigger: "deploy", effect,
        target: effect === "heal" ? "all_allies" : "all_enemies",
        value: effect === "attack" || effect === "health" ? -2 : 2,
      }];
      state.players[target]!.board = [1, 2].map((row) => ({
        cardId: DEFAULT_DECK[0]!, row, depth: 0, hp: effect === "heal" ? 5 : 10,
      }));
      const initial: View = { ...playerView(state, "alice"), events: [] };
      const transition = summon(state, 0, caster.id, 0, 2, 1, 1, () => 0.25);
      const { container, rerender } = render(<Playback view={initial} />);
      rerender(<Playback view={{ ...playerView(transition.state, "alice"), events: transition.events }} />);
      act(() => vi.advanceTimersByTime(COMBAT_TIMING.summon));
      expect(container.querySelectorAll(".ability-origin")).toHaveLength(1);
      expect(container.querySelectorAll(".ability-casting")).toHaveLength(1);
      expect(container.querySelector(".ability-trail")).toBeNull();
      act(() => vi.advanceTimersByTime(COMBAT_TIMING.abilityImpact - 1));
      expect(container.querySelector(".damage-float")).toBeNull();
      act(() => vi.advanceTimersByTime(1));
      expect(container.querySelectorAll(".damage-float")).toHaveLength(2);
      if (effect === "attack" || effect === "health")
        expect(container.querySelectorAll(".stat-loss-glow")).toHaveLength(2);
      expect(container.querySelector(".ability-trail")).toBeNull();
      act(() => vi.runAllTimers());
    },
  );

  it("finishes one complete area hit before a second skill with the same display name", () => {
    vi.useFakeTimers();
    const state = fresh();
    const caster = state.players[0]!.cards.find((card) => card.id === "wisp:common")!;
    caster.abilities = [2, 3].map((value, index): CardAbility => ({
      id: `wave-${index}`, name: "Vague", description: "Inflige des dégâts.",
      unlockLevel: 1, active: true, effect: "damage", trigger: "deploy", target: "all_enemies", value,
    }));
    state.players[1]!.board = [1, 2].map((row) => ({
      cardId: DEFAULT_DECK[0]!, row, depth: 0, hp: 10,
    }));
    const initial: View = { ...playerView(state, "alice"), events: [] };
    const transition = summon(state, 0, caster.id, 0, 2, 1, 1, () => 0.25);
    const { container, rerender } = render(<Playback view={initial} />);
    const health = () => [...container.querySelectorAll(".board-half.enemy .stat-badge.health strong")]
      .map((node) => Number(node.textContent));
    rerender(<Playback view={{ ...playerView(transition.state, "alice"), events: transition.events }} />);
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.summon));
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.abilityImpact));
    expect(health()).toEqual([8, 8]);
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.ability - COMBAT_TIMING.abilityImpact));
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.abilityImpact));
    expect(health()).toEqual([5, 5]);
    expect(container.querySelectorAll(".damage-float")).toHaveLength(4);
    act(() => vi.runAllTimers());
  });

  it("removes every victim of a lethal area hit together and keeps their damage readable", () => {
    vi.useFakeTimers();
    const state = fresh();
    state.turn = 3;
    state.players[0]!.heroLevel = 1;
    state.players[1]!.board = [0, 1, 2].map((row) => ({
      cardId: DEFAULT_DECK[0]!, row, depth: 0, hp: 2,
    }));
    const initial: View = { ...playerView(state, "alice"), events: [] };
    const transition = useHeroAbility(state, 0, "storm", 0, 3, 1, () => 0.25);
    const { container, rerender } = render(<Playback view={initial} />);
    rerender(<Playback view={{ ...playerView(transition.state, "alice"), events: transition.events }} />);
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.heroAbility));
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.abilityImpact));
    expect(container.querySelectorAll(".damage-float")).toHaveLength(3);
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.ability - COMBAT_TIMING.abilityImpact));
    expect(container.querySelectorAll(".board-half.enemy .dying")).toHaveLength(3);
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.death));
    expect(container.querySelector(".board-half.enemy .board-unit")).toBeNull();
    expect(container.querySelectorAll(".damage-float")).toHaveLength(3);
    act(() => vi.runAllTimers());
  });

  it("keeps blocked and immune targets in the same hero impact", () => {
    vi.useFakeTimers();
    const state = fresh();
    state.turn = 3;
    state.players[0]!.heroLevel = 1;
    state.players[1]!.board = [
      { cardId: DEFAULT_DECK[0]!, row: 0, depth: 0, hp: 10, shield: true },
      { cardId: DEFAULT_DECK[0]!, row: 1, depth: 0, hp: 10, immune: true },
      { cardId: DEFAULT_DECK[0]!, row: 2, depth: 0, hp: 10 },
    ];
    const initial: View = { ...playerView(state, "alice"), events: [] };
    const transition = useHeroAbility(state, 0, "storm", 0, 3, 1, () => 0.25);
    const { container, rerender } = render(<Playback view={initial} />);
    rerender(<Playback view={{ ...playerView(transition.state, "alice"), events: transition.events }} />);
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.heroAbility));
    expect(container.querySelectorAll(".ability-trail line")).toHaveLength(3);
    expect(container.querySelector(".ability-origin")?.getAttribute("aria-label"))
      .toBe("Alice utilise Tempête de feuilles");
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.abilityImpact));
    expect(container.querySelectorAll(".damage-float")).toHaveLength(3);
    expect([...container.querySelectorAll(".board-half.enemy .stat-badge.health strong")]
      .map((node) => Number(node.textContent))).toEqual([10, 10, 7]);
    act(() => vi.runAllTimers());
  });

  it.each([
    ["storm", 0], ["call_to_arms", 1], ["heavenly_power", 2], ["sudden_death", 3],
  ] as [HeroAbilityId, number][])("animates the hero before %s takes effect for both viewers", (id, uses) => {
    vi.useFakeTimers();
    const state = fresh();
    state.turn = 21;
    state.players[0]!.heroAbilityUses = uses;
    for (const owner of state.players)
      owner.board = [{ cardId: owner.cards[0]!.id, row: 1, depth: 0, hp: 10 }];
    const transition = useHeroAbility(state, 0, id, uses, state.turn, 1, () => 0.25);
    for (const viewer of ["alice", "bob"]) {
      const initial: View = { ...playerView(state, viewer), events: [] };
      const confirmed = { ...playerView(transition.state, viewer), events: transition.events };
      const { container, rerender, unmount } = render(<Playback view={initial} />);
      rerender(<Playback view={confirmed} />);
      act(() => vi.advanceTimersByTime(0));
      const side = viewer === "alice" ? "own" : "enemy";
      expect(container.querySelector(`.hero-slot.${side} .ability-casting`)).toBeTruthy();
      expect(container.querySelector(`.hero-slot.${side === "own" ? "enemy" : "own"} .ability-casting`)).toBeNull();
      const origin = container.querySelector(".ability-origin")!;
      expect(origin.getAttribute("aria-label")).toBe(`Alice utilise ${transition.events[0]!.ability}`);
      expect(origin.getAttribute("data-card-id")).toBe("hero");
      expect(container.querySelector(".damage-float")).toBeNull();
      act(() => vi.advanceTimersByTime(COMBAT_TIMING.heroAbility - 1));
      expect(container.querySelector(`.hero-slot.${side} .ability-casting`)).toBeTruthy();
      act(() => vi.runAllTimers());
      expect(container.querySelector(".ability-origin")).toBeNull();
      expect(container.querySelector(".ability-casting")).toBeNull();
      rerender(<Playback view={{ ...confirmed }} />);
      act(() => vi.runAllTimers());
      expect(container.querySelector(".ability-origin")).toBeNull();
      unmount();
    }
  });

  it.each(["alice", "bob"])("identifies the exact casting copy without a ray for %s", (viewer) => {
    vi.useFakeTimers();
    const state = fresh();
    const caster = state.players[0]!.cards.find((card) => card.id === "wisp:common")!;
    caster.abilities = [{ id: "origin-test", name: "Trait sylvestre", description: "Inflige 2 dégâts.",
      unlockLevel: 1, active: true, trigger: "deploy", effect: "damage", target: "all_enemies", value: 2 }];
    state.players[0]!.board = [{ cardId: caster.id, row: 3, depth: 2, hp: caster.health }];
    state.players[1]!.board = [{ cardId: DEFAULT_DECK[0]!, row: 1, depth: 0, hp: 10 }];
    const initial: View = { ...playerView(state, viewer), events: [] };
    const transition = summon(state, 0, caster.id, 0, 2, 1, 1, () => 0.25);
    const confirmed = { ...playerView(transition.state, viewer), events: transition.events };
    const { container, rerender } = render(<Playback view={initial} />);
    rerender(<Playback view={confirmed} />);
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.summon));
    const casting = container.querySelectorAll(".board-unit.ability-casting");
    expect(casting).toHaveLength(1);
    const cell = casting[0]!.closest(".projected-cell")!.querySelector(".board-cell")!;
    expect(cell.getAttribute("data-row")).toBe("0");
    expect(cell.getAttribute("data-depth")).toBe("2");
    expect(container.querySelector(".ability-origin")!.getAttribute("aria-label")).toBe(`${caster.name} utilise Trait sylvestre`);
    expect(container.querySelector(".ability-trail")).toBeNull();
    expect(container.querySelector(".damage-float")).toBeNull();
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.abilityImpact));
    expect(container.querySelector(".damage-float")).toBeTruthy();
    act(() => vi.runAllTimers());
    expect(container.querySelector(".ability-casting")).toBeNull();
  });

  it("attributes a reinforcement to its summoner instead of the new unit", () => {
    vi.useFakeTimers();
    const state = fresh();
    const cards = validateDeck(["captain:common", ...DEFAULT_DECK.slice(1)]);
    state.players[0]!.cards = cards;
    state.players[0]!.hand = cards.map((card) => card.id);
    const initial: View = { ...playerView(state, "alice"), events: [] };
    const transition = summon(state, 0, cards[0]!.id, 1, 0, 1, 1, () => 0.25);
    const reinforcement = transition.events.find((event) => event.type === "summon" && event.ability)!;
    expect(reinforcement.source).toEqual({ cardId: "captain:common", row: 1, depth: 0 });
    const { container, rerender } = render(<Playback view={initial} />);
    rerender(<Playback view={{ ...playerView(transition.state, "alice"), events: transition.events }} />);
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.summon));
    expect(container.querySelector(".ability-origin")!.getAttribute("data-card-id")).toBe("captain:common");
    const casting = container.querySelector(".board-unit.ability-casting")!;
    expect(casting.querySelector(".unit-name")!.textContent).toBe(cards[0]!.name);
    expect(container.querySelectorAll(".board-unit")).toHaveLength(2);
    expect(container.querySelector(".ability-trail")).toBeNull();
    act(() => vi.runAllTimers());
  });
});
