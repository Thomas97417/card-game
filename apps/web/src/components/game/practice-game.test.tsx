import { useEffect } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DuelData } from "./duel-screen";
import { PracticeGame } from "./practice-game";
import { COMBAT_TIMING } from "./combat-timing";

const mocks = vi.hoisted(() => ({
  activePlayer: 0 as 0 | 1,
  boardReady: true,
  chooseMove: vi.fn(),
  chooseAbility: vi.fn(),
}));

vi.mock("@sylve/game/practice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@sylve/game/practice")>();
  return {
    ...actual,
    createPracticeGame: (...args: Parameters<typeof actual.createPracticeGame>) => {
      const state = actual.createPracticeGame(...args);
      state.activePlayer = mocks.activePlayer;
      return state;
    },
    chooseComputerMove: mocks.chooseMove,
    chooseComputerHeroAbility: mocks.chooseAbility,
  };
});

// Exercise the real practice lifecycle and AI timing around a ready/unready board.
vi.mock("./duel-screen", () => ({
  DuelScreen: ({ data, onPlaybackSettled, onRestart }: {
    data: DuelData;
    onPlaybackSettled: (sequence: number) => void;
    onRestart: () => void;
  }) => {
    useEffect(() => {
      if (mocks.boardReady) onPlaybackSettled(data.sequence);
    }, [data.sequence, onPlaybackSettled, mocks.boardReady]);
    return <>
      <button>Jouer une carte</button>
      <button onClick={onRestart}>Recommencer</button>
    </>;
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.activePlayer = 0;
  mocks.boardReady = true;
  mocks.chooseMove.mockReturnValue(null);
  mocks.chooseAbility.mockReturnValue(undefined);
  vi.stubGlobal("Image", class {
    complete = true;
    src = "";
    onload = null;
    onerror = null;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("présentation de l’entraînement libre", () => {
  it("keeps one intro from hero loading until the training board is available", () => {
    const { rerender, container } = render(<PracticeGame pending />);
    const intro = screen.getByRole("status");
    expect(within(intro).getByText("Entraînement libre")).toBeTruthy();
    expect(within(intro).getByText("Gardien mécanique")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1000));
    rerender(<PracticeGame heroId="thorn" heroLevel={7} />);
    expect(screen.getByRole("status")).toBe(intro);
    expect(within(intro).getByText("Gardien · Niveau 7")).toBeTruthy();
    expect(intro.querySelector(".own img")?.getAttribute("src")).toBe("/art/heroes/hero-thorn.webp");
    expect(container.querySelector(".duel-entry-board")?.hasAttribute("inert")).toBe(true);
    expect(screen.queryByRole("button", { name: "Jouer une carte" })).toBeNull();
    act(() => vi.advanceTimersByTime(999));
    expect(screen.getByRole("status")).toBe(intro);
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Jouer une carte" })).toBeTruthy();
  });

  it("waits for the board and the intro to finish before the local AI can act", () => {
    mocks.activePlayer = 1;
    mocks.boardReady = false;
    const { rerender } = render(<PracticeGame />);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("Préparation de l’entraînement…")).toBeTruthy();
    expect(mocks.chooseAbility).not.toHaveBeenCalled();
    expect(mocks.chooseMove).not.toHaveBeenCalled();
    mocks.boardReady = true;
    rerender(<PracticeGame />);
    act(() => vi.advanceTimersByTime(360));
    expect(screen.queryByRole("status")).toBeNull();
    expect(mocks.chooseMove).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.computerThink));
    expect(mocks.chooseAbility).toHaveBeenCalledOnce();
    expect(mocks.chooseMove).toHaveBeenCalledOnce();
  });

  it("presents each new training round, including a restart", () => {
    const { container } = render(<PracticeGame />);
    const firstIntro = screen.getByRole("status");
    act(() => vi.advanceTimersByTime(2000));
    fireEvent.click(screen.getByRole("button", { name: "Recommencer" }));
    expect(screen.getByRole("status")).not.toBe(firstIntro);
    expect(container.querySelector(".duel-entry-board")?.hasAttribute("inert")).toBe(true);
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Jouer une carte" })).toBeTruthy();
  });

  it("clears presentation timers when leaving during preparation", () => {
    const { unmount } = render(<PracticeGame pending />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
