import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGame,
  DEFAULT_DECK,
  playerView,
  validateDeck,
} from "@sylve/game";
import { DuelTransitionProvider, useDuelTransition } from "./duel-transition";
import * as feedback from "./shared";

const mocks = vi.hoisted(() => ({ pathname: "/arena" }));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { pathname: mocks.pathname } }),
}));

let transition: NonNullable<ReturnType<typeof useDuelTransition>>;
function Board() {
  transition = useDuelTransition()!;
  return <main>Le plateau</main>;
}
function App() {
  return (
    <DuelTransitionProvider>
      <Board />
    </DuelTransitionProvider>
  );
}
function match() {
  const cards = validateDeck(DEFAULT_DECK);
  return {
    ...playerView(
      createGame(
        [
          { userId: "alice", name: "Alice", cards, heroLevel: 3 },
          { userId: "bob", name: "Bob", cards, heroLevel: 5 },
        ],
        Date.now(),
        () => 0.25,
      ),
      "alice",
    ),
    mode: "public" as const,
  };
}
async function start() {
  await act(async () =>
    transition.start({ mode: "public", player: { name: "Alice" } }),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
  mocks.pathname = "/arena";
  vi.stubGlobal(
    "Image",
    class {
      complete = true;
      src = "";
      onload = null;
      onerror = null;
    },
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("présentation pendant la préparation du duel", () => {
  it("starts immediately, keeps the opponents visible while searching and indicates the wait", async () => {
    const { container } = render(<App />);
    await start();
    expect(screen.getByRole("status").getAttribute("aria-label")).toContain(
      "Alice contre Adversaire en approche",
    );
    expect(screen.getByText("Recherche d’un adversaire…")).toBeTruthy();
    expect(
      container
        .querySelector(".duel-transition-content")
        ?.hasAttribute("inert"),
    ).toBe(true);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole("status").getAttribute("data-waiting")).toBe(
      "true",
    );
    expect(screen.getByRole("status").getAttribute("data-exiting")).toBe(
      "false",
    );
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe(
      "Recherche d’un adversaire…",
    );
  });

  it("loads the board during the two seconds and keeps the same animation across navigation", async () => {
    const { rerender } = render(<App />);
    await start();
    act(() => vi.advanceTimersByTime(500));
    act(() => transition.match("game", match()));
    const presentation = screen.getByRole("status");
    expect(presentation.getAttribute("aria-label")).toContain(
      "Alice contre Bob",
    );
    mocks.pathname = "/game/game";
    rerender(<App />);
    expect(screen.getByRole("status")).toBe(presentation);
    act(() => transition.boardReady("game"));
    act(() => vi.advanceTimersByTime(1499));
    expect(screen.getByRole("status")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("main")).toBeTruthy();
    expect(window.sessionStorage.getItem("sylve:duel-intro:game")).toBe("seen");
  });

  it("extends the presentation for a slow board and opens only after it is ready", async () => {
    render(<App />);
    await start();
    act(() => transition.match("game", match()));
    act(() => vi.advanceTimersByTime(4500));
    expect(screen.getByText("Chargement du plateau…")).toBeTruthy();
    act(() => transition.boardReady("other-game"));
    expect(screen.getByRole("status").getAttribute("data-exiting")).toBe(
      "false",
    );
    act(() => transition.boardReady("game"));
    expect(screen.getByRole("status").getAttribute("data-exiting")).toBe(
      "true",
    );
    act(() => vi.advanceTimersByTime(359));
    expect(screen.getByRole("status")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("also waits for the arena artwork, including when an image fails to load", async () => {
    const images: { onload: () => void; onerror: () => void }[] = [];
    vi.stubGlobal(
      "Image",
      class {
        complete = false;
        src = "";
        onload = () => {};
        onerror = () => {};
        constructor() {
          images.push(this);
        }
      },
    );
    render(<App />);
    await start();
    act(() => {
      transition.match("game", match());
      transition.boardReady("game");
    });
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByRole("status").getAttribute("data-exiting")).toBe(
      "false",
    );
    await act(async () => {
      images[0]!.onload();
      images[1]!.onload();
      images[2]!.onerror();
    });
    act(() => vi.advanceTimersByTime(360));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("allows cancelling a public search without leaving an overlay or timer", async () => {
    const clears = vi.spyOn(window, "clearTimeout");
    render(<App />);
    await start();
    const cancel = vi.fn().mockResolvedValue(undefined);
    act(() => transition.setCancellation(cancel));
    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Annuler la recherche" }),
      ),
    );
    expect(cancel).toHaveBeenCalledOnce();
    expect(screen.queryByRole("status")).toBeNull();
    expect(clears).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("keeps a matched game if the search cancellation arrives too late", async () => {
    render(<App />);
    await start();
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
      resolve = done;
    });
    act(() => transition.setCancellation(() => promise));
    fireEvent.click(
      screen.getByRole("button", { name: "Annuler la recherche" }),
    );
    act(() => transition.match("game", match()));
    await act(async () => resolve());
    expect(screen.getByRole("status").getAttribute("aria-label")).toContain(
      "Alice contre Bob",
    );
  });

  it("keeps a failed cancellation available to retry", async () => {
    render(<App />);
    await start();
    const error = vi
      .spyOn(feedback, "showGameError")
      .mockImplementation(() => {});
    const failure = new Error("Connexion interrompue");
    act(() => transition.setCancellation(() => Promise.reject(failure)));
    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Annuler la recherche" }),
      ),
    );
    expect(error).toHaveBeenCalledWith(failure);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Annuler la recherche",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("cleans up on a failed launch or when navigating away", async () => {
    const { rerender } = render(<App />);
    await start();
    act(() => transition.cancel());
    expect(screen.queryByRole("status")).toBeNull();
    await start();
    mocks.pathname = "/hub";
    rerender(<App />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
