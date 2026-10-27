import type { ComponentProps } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { leagueProgress } from "@sylve/game/leagues";
import type { PlayLobby } from "./play-lobby";
import { Route } from "@/routes/arena";
import { DuelTransitionProvider } from "@/components/game/duel-transition";
import * as feedback from "@/components/game/shared";

const mocks = vi.hoisted(() => ({
  activity: { status: null, gameId: null, queued: false } as {
    status: "active" | "waiting" | null;
    gameId: string | null;
    queued: boolean;
  },
  game: undefined as
    | { status: "active"; turn: number; sequence: number }
    | undefined,
  query: vi.fn(),
  navigate: vi.fn(),
  createSolo: vi.fn(),
  joinPrivate: vi.fn(),
  mutate: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mocks.query(...args),
  useMutation: (mutation: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(mutation);
    if (name === "games:createSolo") return mocks.createSolo;
    if (name === "games:joinPrivate") return mocks.joinPrivate;
    return mocks.mutate;
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useSearch: () => ({}),
  }),
  useNavigate: () => mocks.navigate,
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { pathname: "/arena" } }),
}));

vi.mock("./play-lobby", () => ({
  PlayLobby: ({
    ready,
    locked,
    onSolo,
    onPublic,
    onPrivate,
    children,
  }: ComponentProps<typeof PlayLobby>) => (
    <main aria-label="Arène">
      <button disabled={!ready || locked} onClick={onSolo}>
        Combat solo
      </button>
      <button disabled={!ready || locked} onClick={onPublic}>
        Duel public
      </button>
      <button onClick={onPrivate}>Défi amical</button>
      {children}
    </main>
  ),
}));

vi.mock("./chest-unlock-dialog", () => ({ ChestUnlockDialog: () => null }));
vi.mock("./chest-reveal-dialog", () => ({ ChestRevealDialog: () => null }));
vi.mock("@/components/emerald-balance", () => ({ useEmeraldBalance: () => 0 }));

const ArenaPage = Route.options.component!;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.activity = { status: null, gameId: null, queued: false };
  mocks.game = undefined;
  mocks.mutate.mockResolvedValue(undefined);
  mocks.createSolo.mockResolvedValue("matched-game");
  mocks.joinPrivate.mockResolvedValue("matched-game");
  mocks.navigate.mockResolvedValue(undefined);
  mocks.query.mockImplementation((query, args) => {
    if (args === "skip") return undefined;
    switch (getFunctionName(query)) {
      case "decks:list":
        return [{ _id: "deck", cardIds: [] }];
      case "games:activity":
        return mocks.activity;
      case "games:get":
        return mocks.game;
      case "chests:list":
        return { serverNow: 1000, chests: [] };
      case "collection:league":
        return leagueProgress(0);
      default:
        return undefined;
    }
  });
});

describe("ouverture directe du duel depuis l’arène", () => {
  it("starts the presentation on the click while the solo request is still pending", async () => {
    let reject!: (error: Error) => void;
    mocks.createSolo.mockReturnValue(
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
    );
    const error = vi
      .spyOn(feedback, "showGameError")
      .mockImplementation(() => {});
    render(
      <DuelTransitionProvider>
        <ArenaPage />
      </DuelTransitionProvider>,
    );
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Combat solo",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "Combat solo" }));
    expect(mocks.createSolo).toHaveBeenCalledOnce();
    expect(screen.getByRole("status").textContent).toContain(
      "Gardien mécanique",
    );
    expect(screen.getByText("Préparation du duel…")).toBeTruthy();
    expect(mocks.navigate).not.toHaveBeenCalled();
    const failure = new Error("Le serveur est indisponible");
    await act(async () => reject(failure));
    expect(screen.queryByRole("status")).toBeNull();
    expect(error).toHaveBeenCalledWith(failure);
    expect(screen.getByRole("main", { name: "Arène" })).toBeTruthy();
    error.mockRestore();
  });

  it.each([
    ["public", "queued"],
    ["private host", "waiting"],
  ] as const)(
    "keeps the %s lobby visible until the live game is ready",
    async (_mode, status) => {
      mocks.activity = {
        status: status === "waiting" ? "waiting" : null,
        gameId: status === "waiting" ? "matched-game" : null,
        queued: status === "queued",
      };
      const { rerender } = render(<ArenaPage />);
      await act(async () => {});
      expect(
        mocks.query.mock.calls.some(
          ([query, args]) =>
            getFunctionName(query) === "games:get" && args === "skip",
        ),
      ).toBe(true);
      expect(mocks.navigate).not.toHaveBeenCalled();

      mocks.activity = {
        status: "active",
        gameId: "matched-game",
        queued: false,
      };
      rerender(<ArenaPage />);
      expect(
        mocks.query.mock.calls.some(
          ([query, args]) =>
            getFunctionName(query) === "games:get" &&
            args?.gameId === "matched-game",
        ),
      ).toBe(true);
      expect(screen.getByRole("main", { hidden: true })).toBeTruthy();
      expect(mocks.navigate).not.toHaveBeenCalled();

      mocks.game = { status: "active", turn: 1, sequence: 0 };
      rerender(<ArenaPage />);
      expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith({
        to: "/game/$gameId",
        params: { gameId: "matched-game" },
      });
      mocks.game = { ...mocks.game, sequence: 1 };
      rerender(<ArenaPage />);
      expect(mocks.navigate).toHaveBeenCalledOnce();
    },
  );

  it("does not navigate immediately after creating a solo match", async () => {
    const { rerender } = render(<ArenaPage />);
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Combat solo",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Combat solo" })),
    );
    expect(mocks.createSolo).toHaveBeenCalledExactlyOnceWith({
      deckId: "deck",
    });
    expect(mocks.navigate).not.toHaveBeenCalled();

    mocks.activity = {
      status: "active",
      gameId: "matched-game",
      queued: false,
    };
    rerender(<ArenaPage />);
    expect(mocks.navigate).not.toHaveBeenCalled();
    mocks.game = { status: "active", turn: 1, sequence: 0 };
    rerender(<ArenaPage />);
    expect(mocks.navigate).toHaveBeenCalledOnce();
  });

  it("also waits for the live query when joining an invitation", async () => {
    const { rerender } = render(<ArenaPage />);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Défi amical" })),
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Code d’invitation" }),
      { target: { value: "ABCDEFGH" } },
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Rejoindre" })),
    );
    expect(mocks.joinPrivate).toHaveBeenCalledExactlyOnceWith({
      code: "ABCDEFGH",
      deckId: "deck",
    });
    expect(mocks.navigate).not.toHaveBeenCalled();

    mocks.activity = {
      status: "active",
      gameId: "matched-game",
      queued: false,
    };
    rerender(<ArenaPage />);
    expect(mocks.navigate).not.toHaveBeenCalled();
    mocks.game = { status: "active", turn: 1, sequence: 0 };
    rerender(<ArenaPage />);
    expect(mocks.navigate).toHaveBeenCalledOnce();
  });
});
