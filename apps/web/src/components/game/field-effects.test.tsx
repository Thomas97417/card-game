import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DECK,
  createGame,
  endTurn,
  playerView,
  summon,
  validateDeck,
  variantCard,
  type GameEvent,
  type GameView,
} from "@sylve/game";
import { DuelArena } from "./duel-arena";
import { DuelDetailsDialog } from "./duel-details-dialog";
import { groundCell } from "./arena-layout";
import { COMBAT_TIMING } from "./combat-timing";
import { useCombatPlayback } from "./use-combat-playback";

afterEach(() => vi.useRealTimers());

function fresh(cards = validateDeck(DEFAULT_DECK)) {
  const state = createGame([
    { userId: "alice", name: "Alice", cards },
    { userId: "bob", name: "Bob", cards },
  ], 0, () => 0.25, { field: false });
  state.activePlayer = 0;
  return state;
}

function Arena({ view, event = null }: { view: GameView; event?: GameEvent | null }) {
  return (
    <DuelArena
      mine={view.players[0]!}
      enemy={view.players[1]!}
      me={0}
      selected={null}
      selectedUnit={null}
      hovered={null}
      canSummon={false}
      combatEvent={event}
      onPlace={() => {}}
      onInspectUnit={() => {}}
      onInspectHero={() => {}}
      onInspectField={() => {}}
    />
  );
}

type PlaybackView = GameView & { events: GameEvent[] };
function Playback({ view }: { view: PlaybackView }) {
  const { display, event } = useCombatPlayback(view);
  return display && <Arena view={display} event={event} />;
}

function debuffMatch(stat: "health" | "attack", target: number, attack?: number, hp?: number) {
  const state = fresh();
  const source = 1 - target;
  state.activePlayer = source;
  const owner = state.players[source]!;
  const caster = owner.cards.find((card) => card.id === "wisp:common")!;
  caster.abilities = [{
    id: "test-stat-loss", name: stat === "attack" ? "Affaiblissement" : "Flétrissure",
    description: "Diminue les statistiques adverses.", unlockLevel: 1, active: true,
    effect: stat, trigger: "deploy", target: "all_enemies", value: stat === "attack" ? -2 : -3,
  }];
  const victim = state.players[target]!.cards[0]!;
  state.players[target]!.board = [{ cardId: victim.id, row: 1, depth: 1, hp: hp ?? victim.health, attack }];
  const initial = { ...playerView(state, "alice"), events: [] };
  const result = summon(state, source, caster.id, 0, 2, 1, 1, () => 0.25);
  const confirmed = { ...playerView(result.state, "alice"), events: result.events };
  return { initial, confirmed, victim };
}

describe("activation illustrée des sceaux", () => {
  it.each([
    ["rune", "health", "+3PV"],
    ["rune", "attack", "+2puissance"],
    ["pentagram", "health", "+3PV"],
    ["pentagram", "attack", "+2puissance"],
  ] as const)("synchronizes a %s of %s with the stat impact and keeps the glow after the next event", (kind, stat, gain) => {
    vi.useFakeTimers();
    const state = fresh();
    const owner = state.players[0]!;
    const card = owner.cards[0]!;
    const mark = { row: 1, depth: 1, ...(stat === "health" ? { health: 3 } : { attack: 2 }) };
    if (kind === "rune") owner.runes = [mark];
    else {
      owner.pentagrams = [mark];
      owner.board = [{ cardId: card.id, row: 1, depth: 1, hp: card.health }];
      state.activePlayer = 1;
    }
    const initial = { ...playerView(state, "alice"), events: [] };
    const result = kind === "rune"
      ? summon(state, 0, card.id, 1, 1, 1, 1, () => 0.25)
      : endTurn(state, 1, 1, 1, () => 0.25);
    const confirmed = { ...playerView(result.state, "alice"), events: result.events };
    const { container, rerender } = render(<Playback view={initial} />);
    rerender(<Playback view={confirmed} />);
    act(() => vi.advanceTimersByTime(kind === "rune" ? COMBAT_TIMING.summon : 0));
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.abilityImpact - 1));
    expect(container.querySelector(".seal-activation")).toBeNull();
    expect(container.querySelector(`.board-half.own .stat-badge.${stat}`)?.getAttribute("data-stat-change")).toBe("normal");
    act(() => vi.advanceTimersByTime(1));
    const glow = container.querySelector<HTMLElement>(".seal-activation")!;
    expect(container.querySelector(".ability-origin")).toBeNull();
    expect(glow.dataset.sealKind).toBe(kind);
    expect(glow.classList.contains(`seal-activation-${stat}`)).toBe(true);
    expect(glow.style.left).toBe(groundCell(1, 1).bounds.left);
    const number = container.querySelector<HTMLElement>(".seal-gain")!;
    expect(number.textContent).toBe(gain);
    expect(number.style.marginTop).toBe(groundCell(1, 1).aboveUnit.marginTop);
    expect(number.getAttribute("aria-label")).toContain(card.name);
    expect(container.querySelector(`.board-half.own .stat-badge.${stat}`)?.getAttribute("data-stat-change")).toBe("buffed");
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.ability - COMBAT_TIMING.abilityImpact));
    expect(container.querySelectorAll(".seal-activation")).toHaveLength(1);
    expect(container.querySelectorAll(".seal-gain")).toHaveLength(1);
    act(() => vi.runAllTimers());
    expect(container.querySelector(".seal-activation")).toBeNull();
    expect(container.querySelector(".seal-gain")).toBeNull();
    rerender(<Playback view={{ ...confirmed }} />);
    act(() => vi.runAllTimers());
    expect(container.querySelector(".seal-activation")).toBeNull();
    if (kind === "pentagram") {
      const otherTurn = endTurn(result.state, 0, 2, 2, () => 0.25);
      const followingTurn = endTurn(otherTurn.state, 1, 3, 3, () => 0.25);
      rerender(<Playback view={{
        ...playerView(followingTurn.state, "alice"),
        events: [...otherTurn.events, ...followingTurn.events],
      }} />);
      act(() => vi.advanceTimersByTime(COMBAT_TIMING.attack));
      act(() => vi.advanceTimersByTime(COMBAT_TIMING.abilityImpact));
      expect(container.querySelectorAll(".seal-activation")).toHaveLength(1);
      expect(container.querySelector(".seal-gain")?.textContent).toBe(gain);
      act(() => vi.runAllTimers());
    }
  });

  it("does not play an activation when a spell merely creates an empty rune", () => {
    vi.useFakeTimers();
    const view = playerView(fresh(), "alice");
    const { container } = render(<Arena view={view} event={{
      seq: 1, type: "ability", player: 0, ability: "Rune de vie", amount: 3,
      targetPlayer: 0, runes: [{ row: 1, depth: 1, health: 3 }],
    }} />);
    act(() => vi.runAllTimers());
    expect(container.querySelector(".seal-activation")).toBeNull();
    expect(container.querySelector(".seal-gain")).toBeNull();
  });
});

describe("animation des pertes de statistiques", () => {
  it.each([
    ["attack", 1, undefined, "−2puissance"],
    ["attack", 0, 1, "−1puissance"],
    ["health", 0, undefined, "−3PV"],
    ["health", 1, undefined, "−3PV"],
  ] as const)("shows the actual %s loss on player %s at the ability impact", (stat, target, attack, text) => {
    vi.useFakeTimers();
    const { initial, confirmed, victim } = debuffMatch(stat, target, attack);
    const { container, rerender } = render(<Playback view={initial} />);
    rerender(<Playback view={confirmed} />);
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.summon));
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.abilityImpact - 1));
    expect(container.querySelector(".stat-loss-glow")).toBeNull();
    expect(container.querySelector(".stat-loss")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    const cell = groundCell(1, target === 0 ? 1 : 4);
    const glow = container.querySelector<HTMLElement>(".stat-loss-glow")!;
    expect(glow.dataset.stat).toBe(stat);
    expect(glow.dataset.sealKind).toBeUndefined();
    expect(glow.style.left).toBe(cell.bounds.left);
    const number = container.querySelector<HTMLElement>(".stat-loss")!;
    expect(number.textContent).toBe(text);
    expect(number.style.marginTop).toBe(cell.aboveUnit.marginTop);
    expect(number.getAttribute("aria-label")).toContain(victim.name);
    expect(container.querySelector(`.board-half.${target === 0 ? "own" : "enemy"} .stat-badge.${stat}`)?.getAttribute("data-stat-change")).toBe("debuffed");
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.ability - COMBAT_TIMING.abilityImpact));
    expect(container.querySelectorAll(".stat-loss-glow")).toHaveLength(1);
    expect(container.querySelectorAll(".stat-loss")).toHaveLength(1);
    act(() => vi.runAllTimers());
    expect(container.querySelector(".stat-loss-glow")).toBeNull();
    expect(container.querySelector(".stat-loss")).toBeNull();
    rerender(<Playback view={{ ...confirmed }} />);
    act(() => vi.runAllTimers());
    expect(container.querySelector(".stat-loss-glow")).toBeNull();
  });

  it("does not show a fictitious loss when a weakened unit already has zero attack", () => {
    vi.useFakeTimers();
    const { initial, confirmed } = debuffMatch("attack", 1, 0);
    const { container, rerender } = render(<Playback view={initial} />);
    rerender(<Playback view={confirmed} />);
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.summon));
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.abilityImpact));
    expect(container.querySelector(".stat-loss-glow")).toBeNull();
    expect(container.querySelector(".stat-loss")).toBeNull();
    expect(container.querySelector('.damage-float[aria-label*="Affaiblissement"]')).toBeNull();
    act(() => vi.runAllTimers());
  });

  it("keeps a lethal health loss visible above the cell after the unit dies", () => {
    vi.useFakeTimers();
    const { initial, confirmed } = debuffMatch("health", 1, undefined, 3);
    const { container, rerender } = render(<Playback view={initial} />);
    rerender(<Playback view={confirmed} />);
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.summon));
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.abilityImpact));
    expect(container.querySelector(".stat-loss")?.textContent).toBe("−3PV");
    act(() => vi.advanceTimersByTime(
      COMBAT_TIMING.ability - COMBAT_TIMING.abilityImpact + COMBAT_TIMING.attack + COMBAT_TIMING.death,
    ));
    expect(container.querySelector(".board-half.enemy .board-unit")).toBeNull();
    expect(container.querySelector(".stat-loss")?.textContent).toBe("−3PV");
    expect(container.querySelector(".stat-loss-glow")).toBeTruthy();
    act(() => vi.runAllTimers());
    expect(container.querySelector(".stat-loss")).toBeNull();
    expect(container.querySelector(".stat-loss-glow")).toBeNull();
  });
});

describe("couleurs des statistiques en combat", () => {
  it.each([0, 1])("compares player %s's stats with the same level and rarity and restores normal colors", (side) => {
    const cards = validateDeck(DEFAULT_DECK);
    cards[0] = variantCard("guardian", "rare", 6);
    const state = fresh(cards);
    const card = state.players[side]!.cards[0]!;
    state.players[side]!.board = [
      // Still above normal despite being wounded relative to its boosted max.
      { cardId: card.id, row: 1, depth: 1, attack: card.attack + 2, hp: card.health + 1, maxHp: card.health + 3 },
      { cardId: card.id, row: 2, depth: 1, attack: card.attack - 1, hp: card.health - 2 },
      { cardId: card.id, row: 3, depth: 1, hp: card.health },
    ];
    const { container, rerender } = render(<Arena view={playerView(state, "alice")} />);
    const units = container.querySelectorAll(`.board-half.${side === 0 ? "own" : "enemy"} .board-unit`);
    for (const stat of ["attack", "health"]) {
      expect(units[0]!.querySelector(`.stat-badge.${stat}`)?.getAttribute("data-stat-change")).toBe("buffed");
      expect(units[1]!.querySelector(`.stat-badge.${stat}`)?.getAttribute("data-stat-change")).toBe("debuffed");
      expect(units[2]!.querySelector(`.stat-badge.${stat}`)?.getAttribute("data-stat-change")).toBe("normal");
    }
    expect(units[0]!.querySelector(".stat-badge.attack")?.getAttribute("title")).toContain(`valeur normale : ${card.attack}`);
    state.players[side]!.board[0] = { cardId: card.id, row: 1, depth: 1, hp: card.health };
    rerender(<Arena view={playerView(state, "alice")} />);
    expect(units[0]!.querySelectorAll('[data-stat-change="normal"]')).toHaveLength(2);
  });

  it("uses an invoked token's own definition when it is absent from the deck", () => {
    const state = fresh();
    const definition = { ...state.players[0]!.cards[0]!, id: "token-test", attack: 2, health: 4 };
    state.players[0]!.board = [{
      cardId: definition.id, definition, row: 1, depth: 1,
      attack: 3, hp: 7, maxHp: 7,
    }];
    const { container } = render(<Arena view={playerView(state, "alice")} />);
    expect(container.querySelector('.unit-stats .attack[data-stat-change="buffed"]')).toBeTruthy();
    expect(container.querySelector('.unit-stats .health[data-stat-change="buffed"]')).toBeTruthy();
  });

  it("keeps the same baseline in the card detail and colors its boosted maximum health", () => {
    const state = fresh();
    const card = state.players[0]!.cards[0]!;
    state.players[0]!.board = [{
      cardId: card.id, row: 1, depth: 1,
      attack: card.attack - 1, hp: card.health + 1, maxHp: card.health + 3,
    }];
    const view = playerView(state, "alice");
    render(<DuelDetailsDialog
      inspection={{ type: "card", card, source: "board", playerIndex: 0, position: { row: 1, depth: 1 } }}
      view={view} canSummon={false}
      onInspect={() => {}} onClose={() => {}} onSelectCard={() => {}}
    />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(document.querySelector('.card-details-stats .attack[data-stat-change="debuffed"]')).toBeTruthy();
    expect(document.querySelector('.card-details-stats .health[data-stat-change="buffed"]')).toBeTruthy();
    expect(document.querySelector('.stat-limit[data-stat-change="buffed"]')?.textContent).toBe(`/ ${card.health + 3}`);
  });
});
