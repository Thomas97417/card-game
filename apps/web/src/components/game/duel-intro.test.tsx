import { useEffect, useState } from "react";
import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import {
  createGame,
  DEFAULT_DECK,
  playerView,
  validateDeck,
} from "@sylve/game";
import type { DuelData } from "@/components/game/duel-screen";
import { COMBAT_TIMING } from "@/components/game/combat-timing";
import { Route } from "@/routes/game.$gameId";
import { DuelTransitionProvider, useDuelTransition } from "./duel-transition";

const mocks = vi.hoisted(() => ({
  gameId: "first-game",
  data: undefined as DuelData | undefined,
  mutate: Object.assign(vi.fn(), { withOptimisticUpdate: () => mocks.mutate }),
  soloTurn: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: () => mocks.data,
  useMutation: (mutation: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(mutation) === "games:soloTurn"
      ? mocks.soloTurn
      : mocks.mutate,
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useParams: () => ({ gameId: mocks.gameId }),
  }),
  Link: () => null,
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { pathname: "/game/first-game" } }),
}));

// Keep the real route, intro and timing; stand in for the interactive board.
vi.mock("@/components/game/duel-screen", () => ({
  DuelScreen: ({
    data,
    onPlaybackSettled,
  }: {
    data: DuelData;
    onPlaybackSettled: (sequence: number) => void;
  }) => {
    useEffect(() => {
      onPlaybackSettled(data.sequence);
    }, [data.sequence, onPlaybackSettled]);
    return <button>Jouer une carte</button>;
  },
}));

const GamePage = Route.options.component!;

function newGame(mode: DuelData["mode"] = "public"): DuelData {
  const cards = validateDeck(DEFAULT_DECK);
  const state = createGame(
    [
      { userId: "alice", name: "Alice", cards, heroLevel: 3 },
      { userId: "bob", name: "Bob", cards, heroLevel: 5 },
    ],
    Date.now(),
    () => 0.25,
  );
  return { ...playerView(state, "alice"), mode, events: [] };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  window.sessionStorage.clear();
  mocks.gameId = "first-game";
  mocks.data = newGame();
  mocks.soloTurn.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("entrée en duel depuis l’arène", () => {
  it("keeps the presentation from the click until the real game is ready without replaying it", async () => {
    vi.stubGlobal(
      "Image",
      class {
        complete = true;
        src = "";
        onload = null;
        onerror = null;
      },
    );
    mocks.data = undefined;
    let begin!: () => void;
    let control!: NonNullable<ReturnType<typeof useDuelTransition>>;
    function Boot() {
      control = useDuelTransition()!;
      const [open, setOpen] = useState(false);
      begin = () => {
        control.start({ mode: "public", player: { name: "Alice" } });
        setOpen(true);
      };
      return open ? <GamePage /> : <div>Arène</div>;
    }
    function App() {
      return (
        <DuelTransitionProvider>
          <Boot />
        </DuelTransitionProvider>
      );
    }
    const { rerender, container } = render(<App />);
    await act(async () => begin());
    expect(container.querySelectorAll(".duel-intro")).toHaveLength(1);
    expect(screen.queryByText(/La forêt s’éveille/)).toBeNull();
    act(() => vi.advanceTimersByTime(1000));
    mocks.data = newGame();
    await act(async () => {
      control.match("first-game", mocks.data!);
      rerender(<App />);
    });
    expect(container.querySelectorAll(".duel-intro")).toHaveLength(1);
    expect(screen.getByRole("status").getAttribute("aria-label")).toContain(
      "Alice contre Bob",
    );
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Jouer une carte" }),
    ).toBeTruthy();
  });

  it.each([
    ["solo", "Duel solo"],
    ["public", "Duel classé"],
    ["private", "Duel amical"],
  ] as const)(
    "presents a %s match for two seconds before enabling the board",
    (mode, label) => {
      mocks.data = newGame(mode);
      const { container } = render(<GamePage />);
      const intro = screen.getByRole("status");
      expect(intro.getAttribute("aria-label")).toContain("Alice contre Bob");
      expect(within(intro).getByText(label)).toBeTruthy();
      expect(within(intro).getByText("Gardien · Niveau 3")).toBeTruthy();
      expect(within(intro).getByText("Gardien · Niveau 5")).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "Jouer une carte" }),
      ).toBeNull();
      expect(
        container.querySelector(".duel-entry-board")?.hasAttribute("inert"),
      ).toBe(true);

      act(() => vi.advanceTimersByTime(1999));
      expect(screen.getByRole("status")).toBeTruthy();
      act(() => vi.advanceTimersByTime(1));
      expect(screen.queryByRole("status")).toBeNull();
      expect(
        screen.getByRole("button", { name: "Jouer une carte" }),
      ).toBeTruthy();
      expect(
        container.querySelector(".duel-entry-board")?.hasAttribute("inert"),
      ).toBe(false);
    },
  );

  it("keeps the local player on the left when joining as the second player", () => {
    mocks.data!.me = 1;
    const { container } = render(<GamePage />);
    expect(
      container.querySelector(".duel-intro-panel.own h2")?.textContent,
    ).toBe("Bob");
    expect(
      container.querySelector(".duel-intro-panel.enemy h2")?.textContent,
    ).toBe("Alice");
  });

  it("waits for match data and does not restart the intro on live updates", () => {
    mocks.data = undefined;
    const { rerender } = render(<GamePage />);
    expect(screen.getByRole("status").textContent).toContain(
      "La forêt s’éveille",
    );
    act(() => vi.advanceTimersByTime(4000));
    mocks.data = newGame();
    rerender(<GamePage />);
    act(() => vi.advanceTimersByTime(1000));
    mocks.data = { ...mocks.data, sequence: 1 };
    rerender(<GamePage />);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("waits until the intro ends before letting the solo opponent think", () => {
    mocks.data = { ...newGame("solo"), activePlayer: 1 };
    render(<GamePage />);
    act(() => vi.advanceTimersByTime(2000));
    expect(mocks.soloTurn).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(COMBAT_TIMING.computerThink));
    expect(mocks.soloTurn).toHaveBeenCalledExactlyOnceWith({
      gameId: "first-game",
      expectedTurn: 1,
      expectedSequence: mocks.data.sequence,
    });
  });

  it("remembers a completed intro and presents the next new match", () => {
    const first = render(<GamePage />);
    act(() => vi.advanceTimersByTime(2000));
    first.unmount();
    const second = render(<GamePage />);
    expect(screen.queryByRole("status")).toBeNull();
    mocks.gameId = "second-game";
    second.rerender(<GamePage />);
    expect(screen.getByRole("status").getAttribute("aria-label")).toContain(
      "Alice contre Bob",
    );
  });

  it.each(["in progress", "finished"])(
    "opens a match already %s directly",
    (status) => {
      mocks.data = {
        ...newGame(),
        ...(status === "finished"
          ? { status: "finished" as const }
          : { turn: 4 }),
      };
      render(<GamePage />);
      expect(screen.queryByRole("status")).toBeNull();
      expect(screen.getByRole("button")).toBeTruthy();
    },
  );

  it("completes even when browser storage is blocked and clears its timer on exit", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Blocked");
    });
    const first = render(<GamePage />);
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole("button")).toBeTruthy();
    first.unmount();
    const second = render(<GamePage />);
    expect(screen.getByRole("status")).toBeTruthy();
    second.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
