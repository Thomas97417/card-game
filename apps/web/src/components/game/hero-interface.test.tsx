import type { ReactNode } from "react";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DECK,
  createGame,
  playerView,
  useHeroAbility,
  validateDeck,
} from "@sylve/game";
import { DuelScreen } from "./duel-screen";
import { HeroAbilityStack } from "./hero-ability-stack";
import { HeroPowerList } from "./hero-power-list";
import { useCombatPlayback } from "./use-combat-playback";
import { COMBAT_TIMING } from "./combat-timing";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
afterEach(() => vi.useRealTimers());
function fixture(level = 21, turn = 13, uses = 0) {
  const cards = validateDeck(DEFAULT_DECK);
  const state = createGame(
    [
      { userId: "alice", name: "Alice", cards, heroLevel: level },
      { userId: "bob", name: "Bob", cards, heroLevel: 1 },
    ],
    Date.now(),
    () => 0.25,
    { field: false },
  );
  state.activePlayer = 0;
  state.turn = turn;
  state.players[0]!.heroAbilityUses = uses;
  return state;
}
function callbacks() {
  return {
    onPlayCard: vi.fn().mockResolvedValue(undefined),
    onWithdrawCard: vi.fn().mockResolvedValue(undefined),
    onEndTurn: vi.fn().mockResolvedValue(undefined),
    onSurrender: vi.fn().mockResolvedValue(undefined),
    onHeroAbility: vi.fn().mockResolvedValue(undefined),
  };
}
describe("interface des héros", () => {
  it.each([1, 2, 3, 4])(
    "offers Storm only from the second personal turn at global turn %i",
    async (turn) => {
      const state = fixture(1, turn);
      const actions = callbacks();
      render(
        <DuelScreen
          data={{ ...playerView(state, "alice"), events: [] }}
          {...actions}
          practice
        />,
      );
      const button = screen.getByRole("button", {
        name: /^Utiliser Tempête/,
      });
      expect(button.hasAttribute("disabled")).toBe(turn < 3);
      expect(button.textContent).toContain(turn < 3 ? "Ton tour 2" : "Prêt");
      fireEvent.click(button);
      if (turn < 3) {
        expect(actions.onHeroAbility).not.toHaveBeenCalled();
      } else {
        await waitFor(() =>
          expect(actions.onHeroAbility).toHaveBeenCalledWith("storm", 0, turn),
        );
      }
    },
  );
  it("shows all four personal unlock turns in the hero's power descriptions", () => {
    render(<HeroPowerList level={21} />);
    for (const turn of [2, 3, 7, 11]) {
      expect(screen.getByText(`À partir de ton tour ${turn}`)).toBeTruthy();
    }
  });
  it("offers only the first stacked spell and sends its turn and use count without deploying", async () => {
    const state = fixture(),
      actions = callbacks();
    render(
      <DuelScreen
        data={{ ...playerView(state, "alice"), events: [] }}
        {...actions}
        practice
      />,
    );
    const pile = screen.getByRole("complementary", {
      name: "Pouvoirs du héros",
    });
    expect(
      within(pile).queryByRole("button", { name: /^Utiliser Appel/ }),
    ).toBeNull();
    fireEvent.click(
      within(pile).getByRole("button", { name: /^Utiliser Tempête/ }),
    );
    await waitFor(() =>
      expect(actions.onHeroAbility).toHaveBeenCalledWith("storm", 0, 13),
    );
    expect(actions.onPlayCard).not.toHaveBeenCalled();
    expect(actions.onEndTurn).not.toHaveBeenCalled();
  });
  it("removes level-locked powers from the pile after the only unlocked power is spent", () => {
    const state = fixture(1, 13, 1);
    const actions = callbacks();
    render(
      <DuelScreen
        data={{ ...playerView(state, "alice"), events: [] }}
        {...actions}
        practice
      />,
    );
    expect(
      screen.queryByRole("complementary", { name: "Pouvoirs du héros" }),
    ).toBeNull();
    expect(screen.queryByText("Pouvoir utilisé")).toBeNull();
    expect(screen.queryByText("Appel des éclaireurs")).toBeNull();
    expect(actions.onHeroAbility).not.toHaveBeenCalled();
  });
  it.each(["turn", "opponent", "deployed"])(
    "locks a spell for %s and explains its unlock",
    (reason) => {
      const state = fixture(
        21,
        reason === "turn" ? 3 : 13,
        reason === "turn" ? 1 : 0,
      );
      if (reason === "opponent") state.activePlayer = 1;
      if (reason === "deployed") state.hasSummoned = true;
      const actions = callbacks();
      render(
        <DuelScreen
          data={{ ...playerView(state, "alice"), events: [] }}
          {...actions}
          practice
        />,
      );
      const button = within(
        screen.getByRole("complementary", { name: "Pouvoirs du héros" }),
      ).getByRole("button", { name: /^Utiliser / });
      expect(button.hasAttribute("disabled")).toBe(true);
      fireEvent.click(button);
      expect(actions.onHeroAbility).not.toHaveBeenCalled();
      if (reason === "turn") expect(button.textContent).toContain("Ton tour 3");
    },
  );
  it.each(["alice", "bob"])(
    "shows only unlocked powers and their spent state in %s's widened panel",
    async (name) => {
      const state = fixture(11, 13, 1);
      state.players[1]!.heroAbilityUses = 1;
      const view = playerView(state, "alice");
      render(
        <DuelScreen data={{ ...view, events: [] }} {...callbacks()} practice />,
      );
      const player = view.players[name === "alice" ? 0 : 1]!;
      fireEvent.click(
        await screen.findByRole("button", {
          name: `Voir ${player.name}, ${player.heroHp} PV`,
        }),
      );
      const dialog = within(await screen.findByRole("dialog"));
      const powers = within(
        dialog.getByRole("list", { name: "Capacités du héros" }),
      );
      expect(powers.getAllByRole("listitem")).toHaveLength(
        name === "alice" ? 2 : 1,
      );
      expect(powers.getByText("Utilisé")).toBeTruthy();
      expect(powers.queryByText("Élan de la Sylve")).toBeNull();
      expect(powers.queryByText("Dernier souffle")).toBeNull();
      if (name === "bob")
        expect(powers.queryByText("Appel des éclaireurs")).toBeNull();
      expect(dialog.queryByText("TON HÉROS")).toBeNull();
      expect(dialog.queryByText("HÉROS ADVERSE")).toBeNull();
      expect(
        screen.getByRole("dialog").classList.contains("hero-details-dialog"),
      ).toBe(true);
    },
  );
  it("updates the top of the pile after a cast and exposes full power details", async () => {
    const state = fixture();
    const data = playerView(state, "alice");
    const onUse = vi.fn(),
      onInspect = vi.fn();
    const { rerender } = render(
      <HeroAbilityStack
        player={data.players[0]!}
        turn={13}
        canUse
        onUse={onUse}
        onInspect={onInspect}
      />,
    );
    const next = playerView(
      useHeroAbility(state, 0, "storm", 0, 13, Date.now(), () => 0.25).state,
      "alice",
    );
    rerender(
      <HeroAbilityStack
        player={next.players[0]!}
        turn={13}
        canUse
        onUse={onUse}
        onInspect={onInspect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Utiliser Appel/ }));
    expect(onUse).toHaveBeenCalledWith("call_to_arms", 1);
    fireEvent.click(
      screen.getByRole("button", { name: "Voir les pouvoirs du héros" }),
    );
    expect(onInspect).toHaveBeenCalledOnce();
  });
  it("plays a hero cast before its damage and commits the spent spell without replaying on reload", () => {
    vi.useFakeTimers();
    const state = fixture(1, 3);
    const card = state.players[1]!.cards[0]!;
    state.players[1]!.board.push({ cardId: card.id, row: 0, depth: 0, hp: 10 });
    const initial = {
      ...playerView(state, "alice"),
      events: [] as ReturnType<typeof useHeroAbility>["events"],
    };
    const transition = useHeroAbility(
      state,
      0,
      "storm",
      0,
      3,
      Date.now(),
      () => 0.25,
    );
    const confirmed = {
      ...playerView(transition.state, "alice"),
      events: transition.events,
    };
    const { result, rerender, unmount } = renderHook(
      ({ view }) => useCombatPlayback(view),
      { initialProps: { view: initial } },
    );
    rerender({ view: confirmed });
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.ability));
    expect(result.current.display!.players[0]!.heroAbilityUses).toBe(1);
    expect(result.current.display!.players[1]!.board[0]!.hp).toBe(10);
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.abilityImpact));
    expect(result.current.display!.players[1]!.board[0]!.hp).toBe(7);
    act(() => vi.runAllTimers());
    expect(result.current.display).toEqual(confirmed);
    unmount();
    const remounted = renderHook(() => useCombatPlayback(confirmed));
    expect(remounted.result.current.playing).toBe(false);
    expect(remounted.result.current.display).toEqual(confirmed);
  });
});
