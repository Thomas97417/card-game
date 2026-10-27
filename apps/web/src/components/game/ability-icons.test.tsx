import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGame,
  playerView,
  summon,
  validateDeck,
  variantCard,
  type GameEvent,
} from "@sylve/game";
import { CardAbilityIcons, UnitEffectIcons } from "./ability-icons";
import { DuelArena } from "./duel-arena";
import { useCombatPlayback } from "./use-combat-playback";
import { COMBAT_TIMING } from "./combat-timing";

afterEach(() => vi.useRealTimers());

describe("icônes des capacités et états", () => {
  it("shows each ability's illustration and keeps its unlock state in sync with the level", () => {
    const { container, rerender } = render(
      <CardAbilityIcons card={variantCard("guardian", "common", 3)} />,
    );
    expect(
      screen.getByRole("img", { name: /Blocage · Active · niveau 1/ }),
    ).toBeTruthy();
    const locked = screen.getByRole("img", {
      name: /Alliance de l’Ordre · Verrouillée · niveau 11/,
    });
    expect(locked.classList.contains("is-locked")).toBe(true);
    expect(locked.querySelector("img")?.getAttribute("src")).toBe(
      "/art/abilities/order-alliance.webp",
    );
    rerender(<CardAbilityIcons card={variantCard("guardian", "common", 11)} />);
    expect(container.querySelector(".is-locked")).toBeNull();
    expect(
      screen.getByRole("img", {
        name: /Alliance de l’Ordre · Active · niveau 11/,
      }),
    ).toBeTruthy();
  });

  it("removes a consumed shield from the board instead of redisplaying the card's original passive", () => {
    const card = variantCard("lynx", "common");
    const unit = {
      cardId: card.id,
      card,
      row: 0,
      depth: 0,
      hp: 2,
      shield: true,
    };
    const view = (shield: boolean) => (
      <>
        <CardAbilityIcons card={card} onBoard showLocked={false} />
        <UnitEffectIcons unit={{ ...unit, shield }} cards={[card]} />
      </>
    );
    const { container, rerender } = render(view(true));
    expect(
      container.querySelectorAll('[data-effect="mental-shield"]'),
    ).toHaveLength(1);
    rerender(view(false));
    expect(container.querySelector('[data-effect="mental-shield"]')).toBeNull();
  });

  it("shows granted effects and their live values even when the receiving card has no such ability", () => {
    const card = variantCard("fox", "common");
    const unit = {
      cardId: card.id,
      card: { ...card, attack: 9, health: 4 },
      row: 0,
      depth: 2,
      hp: 4,
      attack: 9,
      maxHp: 4,
      block: 2,
      spikes: 3,
      regeneration: 4,
      vampirism: 5,
    };
    const { container, rerender } = render(
      <UnitEffectIcons unit={unit} cards={[card]} />,
    );
    expect(screen.getByRole("img", { name: /Blocage 2\./ })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Épines 3\./ })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Régénération 4\./ })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Vampirisme 5\./ })).toBeTruthy();
    expect(
      screen.getByRole("img", {
        name: /2 autres états : Puissance \+5, Vitalité \+3/,
      }),
    ).toBeTruthy();
    rerender(
      <UnitEffectIcons
        unit={{ ...unit, block: 0, spikes: 0, regeneration: 0, vampirism: 0 }}
        cards={[card]}
      />,
    );
    expect(container.querySelector('[data-effect="power"]')?.textContent).toBe(
      "+5",
    );
    expect(
      container.querySelector('[data-effect="vitality"]')?.textContent,
    ).toBe("+3");
  });

  it("explains weakened, temporary and blocked states in the live unit's detail panel", () => {
    const card = variantCard("guardian", "common");
    const unit = {
      cardId: card.id,
      card: { ...card, attack: 2 },
      row: 0,
      depth: 1,
      hp: 8,
      attack: 2,
      temporaryAttack: 1,
    };
    const { container } = render(
      <UnitEffectIcons unit={unit} cards={[card]} blocked detailed />,
    );
    expect(screen.getByRole("region", { name: "États actuels" })).toBeTruthy();
    expect(screen.getByText("Affaiblissement -1")).toBeTruthy();
    expect(screen.getByText("Bonus temporaire +1")).toBeTruthy();
    expect(screen.getByText("Attaque bloquée")).toBeTruthy();
    expect(
      container.querySelector('img[src="/art/abilities/blocked.webp"]'),
    ).toBeTruthy();
    expect(screen.getByText(/expire après l’assaut/)).toBeTruthy();
  });

  it("keeps inherent piercing and double-attack abilities visible on the board", () => {
    const { container, rerender } = render(
      <CardAbilityIcons
        card={variantCard("fox", "common", 6)}
        onBoard
        showLocked={false}
      />,
    );
    expect(container.querySelector('[data-effect="piercing"]')).toBeTruthy();
    expect(container.querySelector('[data-effect="power"]')).toBeNull();
    rerender(
      <CardAbilityIcons
        card={variantCard("vampire", "legendary")}
        onBoard
        showLocked={false}
      />,
    );
    expect(
      container.querySelector('[data-effect="double-strike"]'),
    ).toBeTruthy();
  });

  it("plays the illustrated ability impact before the following attack and preserves its floating effect", () => {
    vi.useFakeTimers();
    const cards = validateDeck([
      "guardian:common",
      "mushroom:common",
      "wisp:common",
      "fox:common",
    ]);
    const state = createGame(
      [
        { userId: "a", name: "A", cards },
        { userId: "b", name: "B", cards },
      ],
      0,
      () => 0.25,
      { field: false },
    );
    state.players[0]!.board = [
      { cardId: "guardian:common", row: 0, depth: 0, hp: 8 },
    ];
    const initial = { ...playerView(state, "a"), events: [] as GameEvent[] };
    const transition = summon(
      state,
      0,
      "mushroom:common",
      1,
      2,
      1,
      1,
      () => 0.25,
    );
    const confirmed = {
      ...playerView(transition.state, "a"),
      events: transition.events,
    };
    function Playback({ data }: { data: typeof initial }) {
      const { display, event, events } = useCombatPlayback(data);
      return (
        display && (
          <DuelArena
            mine={display.players[0]!}
            enemy={display.players[1]!}
            me={0}
            selected={null}
            selectedUnit={null}
            hovered={null}
            canSummon={false}
            combatEvent={event}
            combatEvents={events}
            onPlace={() => {}}
            onInspectUnit={() => {}}
            onInspectHero={() => {}}
            onInspectField={() => {}}
          />
        )
      );
    }
    const { container, rerender } = render(<Playback data={initial} />);
    rerender(<Playback data={confirmed} />);
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.summon));
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.abilityImpact - 1));
    expect(container.querySelector(".damage-float")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelector(".damage-float .ability-icon")).toBeNull();
    expect(container.querySelector(".damage-float")?.textContent).toBe("+1");
    act(() =>
      vi.advanceTimersByTime(
        COMBAT_TIMING.ability - COMBAT_TIMING.abilityImpact,
      ),
    );
    expect(container.querySelector(".damage-float")?.textContent).toBe("+1");
    act(() => vi.runAllTimers());
  });
});
