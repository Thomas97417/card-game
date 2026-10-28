import type { ComponentProps, ReactNode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexQueryClient, convexQuery } from "@convex-dev/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ConvexReactClient } from "convex/react";
import { getFunctionName } from "convex/server";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
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
  deckSize: 4,
  query: vi.fn(),
  navigate: vi.fn(),
  createSolo: vi.fn(),
  enqueue: vi.fn(),
  joinPrivate: vi.fn(),
  mutate: vi.fn(),
  lobby: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mocks.query(...args),
  useMutation: (mutation: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(mutation);
    if (name === "games:createSolo") return mocks.createSolo;
    if (name === "matchmaking:enqueue") return mocks.enqueue;
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
  DeckCompletionNotice: () => <p>Complète ton deck avant le combat.</p>,
  PlayLobby: (props: ComponentProps<typeof PlayLobby>) => {
    mocks.lobby(props);
    return (
      <main aria-label="Arène" aria-busy={!props.ready}>
        <div aria-label="Deck">{props.deckSize}</div>
        <div aria-label="Coffres">
          {props.chests.map((chest) => chest._id).join(",")}
        </div>
        <div aria-label="Horloge">{props.now}</div>
        <div aria-label="Trophées">{props.league?.trophies}</div>
        <button disabled={!props.ready || props.locked} onClick={props.onSolo}>
          Combat solo
        </button>
        <button disabled={!props.ready || props.locked} onClick={props.onPublic}>
          Duel public
        </button>
        <button onClick={props.onPrivate}>Défi amical</button>
        {props.children}
      </main>
    );
  },
}));

vi.mock("./chest-unlock-dialog", () => ({ ChestUnlockDialog: () => null }));
vi.mock("./chest-reveal-dialog", () => ({ ChestRevealDialog: () => null }));
vi.mock("@/components/emerald-balance", () => ({ useEmeraldBalance: () => 0 }));

const ArenaPage = Route.options.component!;
const retainedQueries = [
  api.decks.list,
  api.games.activity,
  api.collection.hero,
  api.chests.list,
  api.collection.league,
];
let client: QueryClient;
let bridge: ConvexQueryClient;
let values: Map<string, unknown>;
let listeners: Map<string, Set<() => void>>;
let pending: Map<string, ((value: unknown) => void)[]>;
let request: ReturnType<typeof vi.fn>;

function push(query: Parameters<typeof getFunctionName>[0], value: unknown) {
  const name = getFunctionName(query);
  values.set(name, value);
  for (const resolve of pending.get(name) ?? []) resolve(value);
  pending.delete(name);
  for (const callback of listeners.get(name) ?? []) callback();
}
function syncFixtures() {
  for (const query of retainedQueries) push(query, mocks.query(query));
}
function view(show = true) {
  return (
    <QueryClientProvider client={client}>
      {show ? <ArenaPage /> : <div>Village</div>}
    </QueryClientProvider>
  );
}
function renderArena(children: ReactNode) {
  syncFixtures();
  const result = render(children, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  return {
    ...result,
    rerender: (children: ReactNode) => act(() => {
      syncFixtures();
      result.rerender(children);
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.activity = { status: null, gameId: null, queued: false };
  mocks.game = undefined;
  mocks.deckSize = 4;
  mocks.mutate.mockResolvedValue(undefined);
  mocks.createSolo.mockResolvedValue("matched-game");
  mocks.enqueue.mockResolvedValue(undefined);
  mocks.joinPrivate.mockResolvedValue("matched-game");
  mocks.navigate.mockResolvedValue(undefined);
  mocks.query.mockImplementation((query, args) => {
    if (args === "skip") return undefined;
    switch (getFunctionName(query)) {
      case "decks:list":
        return [
          {
            _id: "deck",
            cardIds: Array.from(
              { length: mocks.deckSize },
              (_, index) => `card-${index}`,
            ),
          },
        ];
      case "games:activity":
        return mocks.activity;
      case "games:get":
        return mocks.game;
      case "collection:hero":
        return { heroId: "sylve", level: 1 };
      case "chests:list":
        return { serverNow: 1000, chests: [] };
      case "collection:league":
        return leagueProgress(0);
      default:
        return undefined;
    }
  });
  values = new Map();
  listeners = new Map();
  pending = new Map();
  request = vi.fn((query: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(query);
    if (values.has(name)) return Promise.resolve(values.get(name));
    return new Promise((resolve) => {
      pending.set(name, [...(pending.get(name) ?? []), resolve]);
    });
  });
  const convex = {
    query: request,
    watchQuery: (query: Parameters<typeof getFunctionName>[0]) => {
      const name = getFunctionName(query);
      return {
        localQueryResult: () => values.get(name),
        onUpdate: (callback: () => void) => {
          const callbacks = listeners.get(name) ?? new Set();
          callbacks.add(callback);
          listeners.set(name, callbacks);
          return () => callbacks.delete(callback);
        },
      };
    },
  };
  bridge = new ConvexQueryClient(convex as unknown as ConvexReactClient);
  client = new QueryClient({
    defaultOptions: {
      queries: {
        queryFn: bridge.queryFn(),
        queryKeyHashFn: bridge.hashFn(),
        retry: false,
      },
    },
  });
  bridge.connect(client);
});
afterEach(() => {
  cleanup();
  client.clear();
  bridge.unsubscribe?.();
  vi.useRealTimers();
});

describe("ouverture directe du duel depuis l’arène", () => {
  it.each([0, 3, 5])(
    "does not start a battle or its presentation with a %i-card deck instead of four",
    async (deckSize) => {
      mocks.deckSize = deckSize;
      renderArena(
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
      fireEvent.click(screen.getByRole("button", { name: "Duel public" }));
      fireEvent.click(screen.getByRole("button", { name: "Défi amical" }));
      expect(
        screen.getByText("Complète ton deck avant le combat."),
      ).toBeTruthy();
      expect(
        (
          screen.getByRole("button", {
            name: "Créer une invitation",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      const input = screen.getByRole("textbox", { name: "Code d’invitation" });
      fireEvent.change(input, { target: { value: "ABCDEFGH" } });
      fireEvent.submit(input.closest("form")!);
      expect(mocks.createSolo).not.toHaveBeenCalled();
      expect(mocks.enqueue).not.toHaveBeenCalled();
      expect(mocks.joinPrivate).not.toHaveBeenCalled();
      expect(screen.queryByRole("status")).toBeNull();
    },
  );

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
    renderArena(
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
      const { rerender } = renderArena(<ArenaPage />);
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
    const { rerender } = renderArena(<ArenaPage />);
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
    const { rerender } = renderArena(<ArenaPage />);
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

describe("cache réactif de l’arène", () => {
  it("shows live updates received while away on the first render of the next visit", async () => {
    syncFixtures();
    const { rerender } = render(view());
    await waitFor(() =>
      expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("false"),
    );
    expect(request).toHaveBeenCalledTimes(retainedQueries.length);
    expect(mocks.mutate).not.toHaveBeenCalled();

    rerender(view(false));
    for (const query of retainedQueries)
      expect(listeners.get(getFunctionName(query))?.size).toBe(1);
    act(() => {
      push(api.decks.list, [{
        _id: "updated-deck",
        cardIds: ["fox:common", "bear:common", "owl:common"],
      }]);
      push(api.collection.league, leagueProgress(950));
      push(api.chests.list, {
        serverNow: 2000,
        chests: [{ _id: "new-chest", slot: 0, rarity: "common", unlockAt: 3000 }],
      });
      push(api.games.activity, { status: null, gameId: null, queued: true });
    });
    mocks.lobby.mockClear();
    rerender(view());
    expect(mocks.lobby.mock.calls[0]?.[0]).toMatchObject({
      ready: true,
      deckSize: 3,
      queued: true,
    });
    expect(screen.getByLabelText("Deck").textContent).toBe("3");
    expect(screen.getByLabelText("Trophées").textContent).toBe("950");
    expect(screen.getByLabelText("Coffres").textContent).toBe("new-chest");
    const publicButton = () =>
      screen.getByRole("button", { name: "Duel public" }) as HTMLButtonElement;
    expect(publicButton().disabled).toBe(true);
    expect(request).toHaveBeenCalledTimes(retainedQueries.length);

    act(() => push(api.games.activity, { status: null, gameId: null, queued: false }));
    await waitFor(() => expect(publicButton().disabled).toBe(false));
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("waits for the first server snapshot and initializes an empty account only once", async () => {
    mocks.mutate.mockReturnValue(new Promise(() => {}));
    const { rerender } = render(view());
    expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("true");
    expect(mocks.mutate).not.toHaveBeenCalled();
    await act(async () => {
      for (const query of retainedQueries)
        push(
          query,
          getFunctionName(query) === "decks:list" ? [] : mocks.query(query),
        );
    });
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledOnce());
    expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("true");
    rerender(view());
    expect(mocks.mutate).toHaveBeenCalledOnce();

    act(() => push(api.decks.list, mocks.query(api.decks.list)));
    await waitFor(() =>
      expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("false"),
    );
    // The ensureStarter promise is still pending; live data is enough to render.
    expect(mocks.mutate).toHaveBeenCalledOnce();
  });

  it("includes time away in cached chest countdowns and follows new server timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    for (const query of retainedQueries)
      client.setQueryData(convexQuery(query, {}).queryKey, mocks.query(query));
    const { rerender } = render(view());
    expect(screen.getByLabelText("Horloge").textContent).toBe("1000");
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByLabelText("Horloge").textContent).toBe("3000");
    rerender(view(false));
    act(() => vi.advanceTimersByTime(5000));
    mocks.lobby.mockClear();
    rerender(view());
    expect(mocks.lobby.mock.calls[0]?.[0].now).toBe(8000);
    expect(screen.getByLabelText("Horloge").textContent).toBe("8000");

    act(() => {
      push(api.chests.list, { serverNow: 20_000, chests: [] });
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByLabelText("Horloge").textContent).toBe("20000");
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByLabelText("Horloge").textContent).toBe("21000");
  });
});
