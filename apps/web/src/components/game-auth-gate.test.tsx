import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery as useCachedQuery } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { useQuery } from "convex/react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { GameAuthGate } from "./game-auth-gate";
import { GoldProvider } from "./gold-balance";
import { EmeraldProvider } from "./emerald-balance";
import { FriendshipProvider } from "./friendship-balance";
import { PlayerHeaderProvider } from "./player-header";
import { CurrencyGain, CurrencyGainProvider } from "./currency-gain";
import { useMineCollection } from "@/hooks/use-mine-collection";
import type { MineBoard } from "@sylve/game/mines";
import * as feedback from "@/components/game/shared";
import { createNavigationAuth, type NavigationAuth } from "@/lib/navigation-auth";
import { useDeckWorkshopState, useDeckWorkshopStore } from "./decks/deck-workshop-state";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { PLAYER_QUERY_OPTIONS } from "@/hooks/use-player-query-cache";

const mocks = vi.hoisted(() => ({
  auth: { isLoading: true, isAuthenticated: false },
  user: undefined as { _id: string } | null | undefined,
  href: "/sanctuary?checkout=test",
  query: vi.fn(),
  ensureWallet: vi.fn(),
  redirect: vi.fn(),
  collect: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => mocks.auth,
  useQuery: (...args: unknown[]) => mocks.query(...args),
  useMutation: (mutation: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(mutation) === "collection:collectMine"
      ? Object.assign(mocks.collect, {
          withOptimisticUpdate: () => mocks.collect,
        })
      : mocks.ensureWallet,
}));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: () => mocks.href,
  Navigate: (props: unknown) => {
    mocks.redirect(props);
    return null;
  },
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

function ProtectedPage() {
  useQuery(api.sanctuary.latest);
  return <div>Le sanctuaire</div>;
}

function App({ required = true, navigationAuth }: { required?: boolean; navigationAuth?: NavigationAuth }) {
  return (
    <GameAuthGate required={required} navigationAuth={navigationAuth}>
      <GoldProvider>
        <EmeraldProvider>
          <FriendshipProvider>
            <PlayerHeaderProvider>
              {required ? <ProtectedPage /> : <div>Entraînement libre</div>}
            </PlayerHeaderProvider>
          </FriendshipProvider>
        </EmeraldProvider>
      </GoldProvider>
    </GameAuthGate>
  );
}

function playerSubscriptions() {
  return mocks.query.mock.calls.filter(
    ([query, args]) =>
      args !== "skip" && getFunctionName(query) !== "auth:getCurrentUser",
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth = { isLoading: true, isAuthenticated: false };
  mocks.user = undefined;
  mocks.ensureWallet.mockResolvedValue(undefined);
  mocks.query.mockImplementation((query, args) => {
    if (args === "skip") return undefined;
    if (getFunctionName(query) === "auth:getCurrentUser") return mocks.user;
    return undefined;
  });
});

describe("validation de la connexion avant les requêtes du jeu", () => {
  it("retains cached player data across pages, then clears it before another account or signed-out content can read it", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const key = ["convexQuery", "collection:list", {}];
    client.setQueryData(key, { owner: "unknown-previous-owner" });
    const load = vi.fn(async () => ({ owner: mocks.user?._id ?? "anonymous" }));
    const seen: { session: string | undefined; value: string | undefined }[] = [];
    let boundaryVersion = 0;
    function CachedPlayer() {
      const { data } = useCachedQuery({ queryKey: key, queryFn: load, staleTime: Infinity, ...PLAYER_QUERY_OPTIONS });
      seen.push({ session: mocks.user?._id, value: data?.owner });
      return <output aria-label="Cache du joueur">{data?.owner ?? "Chargement"}</output>;
    }
    const view = (workshop = true) => (
      <QueryClientProvider client={client}>
        <GameAuthGate key={boundaryVersion} required queryClient={client}>
          {workshop ? <CachedPlayer /> : <div>Village</div>}
        </GameAuthGate>
      </QueryClientProvider>
    );
    mocks.auth = { isLoading: false, isAuthenticated: true };
    mocks.user = { _id: "first-player" };
    const { rerender, unmount } = render(view());
    await waitFor(() => expect(screen.getByLabelText("Cache du joueur").textContent).toBe("first-player"));
    expect(seen.some(({ value }) => value === "unknown-previous-owner")).toBe(false);
    rerender(view(false));
    rerender(view());
    expect(screen.getByLabelText("Cache du joueur").textContent).toBe("first-player");
    expect(load).toHaveBeenCalledOnce();

    // The owner also survives a boundary remount while the router client remains.
    boundaryVersion++;
    mocks.user = { _id: "second-player" };
    rerender(view());
    await waitFor(() => expect(screen.getByLabelText("Cache du joueur").textContent).toBe("second-player"));
    expect(seen.some(({ session, value }) => session === "second-player" && value === "first-player")).toBe(false);

    mocks.auth = { isLoading: false, isAuthenticated: false };
    mocks.user = null;
    rerender(view());
    expect(client.getQueryData(key)).toBeUndefined();
    expect(screen.queryByLabelText("Cache du joueur")).toBeNull();
    unmount();
    client.clear();
  });

  it("ignores a former player's late query response after switching accounts", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const key = ["convexQuery", "collection:list", {}];
    let resolveFirst!: (value: { owner: string }) => void;
    const load = vi.fn(() => mocks.user?._id === "first-player"
      ? new Promise<{ owner: string }>((resolve) => { resolveFirst = resolve; })
      : Promise.resolve({ owner: "second-player" }));
    function CachedPlayer() {
      const { data } = useCachedQuery({ queryKey: key, queryFn: load, staleTime: Infinity, ...PLAYER_QUERY_OPTIONS });
      return <output aria-label="Cache du joueur">{data?.owner ?? "Chargement"}</output>;
    }
    const view = () => (
      <QueryClientProvider client={client}>
        <GameAuthGate required queryClient={client}><CachedPlayer /></GameAuthGate>
      </QueryClientProvider>
    );
    mocks.auth = { isLoading: false, isAuthenticated: true };
    mocks.user = { _id: "first-player" };
    const { rerender, unmount } = render(view());
    await waitFor(() => expect(load).toHaveBeenCalledOnce());
    mocks.user = { _id: "second-player" };
    rerender(view());
    await waitFor(() => expect(screen.getByLabelText("Cache du joueur").textContent).toBe("second-player"));
    await act(async () => resolveFirst({ owner: "first-player" }));
    expect(client.getQueryData(key)).toEqual({ owner: "second-player" });
    expect(screen.getByLabelText("Cache du joueur").textContent).toBe("second-player");
    unmount();
    client.clear();
  });

  it("retains workshop state across pages and resets it when the player changes or signs out", () => {
    function WorkshopProbe() {
      const draft = useDeckWorkshopState((state) => state.draft);
      const filter = useDeckWorkshopState((state) => state.filter);
      const store = useDeckWorkshopStore();
      return (
        <>
          <button onClick={() => {
            store.getState().syncDeck({ _id: "deck" as Id<"decks">, name: "Mon deck", cardIds: ["fox:rare"] });
            store.getState().selectCombatType("ranged");
          }}>Modifier l’atelier</button>
          <output aria-label="Brouillon">{draft?.name ?? "Aucun"}</output>
          <output aria-label="Filtre">{filter ?? "Toutes"}</output>
        </>
      );
    }
    const view = (workshop: boolean) => (
      <GameAuthGate required={false}>
        {workshop ? <WorkshopProbe /> : <div>Village</div>}
      </GameAuthGate>
    );
    mocks.auth = { isLoading: false, isAuthenticated: true };
    mocks.user = { _id: "first-player" };
    const { rerender } = render(view(true));
    fireEvent.click(screen.getByRole("button", { name: "Modifier l’atelier" }));
    rerender(view(false));
    rerender(view(true));
    expect(screen.getByLabelText("Brouillon").textContent).toBe("Mon deck");
    expect(screen.getByLabelText("Filtre").textContent).toBe("ranged");

    mocks.user = { _id: "second-player" };
    rerender(view(true));
    expect(screen.getByLabelText("Brouillon").textContent).toBe("Aucun");
    expect(screen.getByLabelText("Filtre").textContent).toBe("Toutes");
    fireEvent.click(screen.getByRole("button", { name: "Modifier l’atelier" }));
    mocks.auth = { isLoading: false, isAuthenticated: false };
    mocks.user = null;
    rerender(view(true));
    expect(screen.getByLabelText("Brouillon").textContent).toBe("Aucun");
    expect(screen.getByLabelText("Filtre").textContent).toBe("Toutes");
  });

  it("updates navigation from the validated live session, including expiry with a valid JWT", async () => {
    const navigationAuth = createNavigationAuth();
    const getToken = vi.fn().mockResolvedValue("initial-token");
    await navigationAuth.load(getToken);
    mocks.auth = { isLoading: false, isAuthenticated: true };
    mocks.user = { _id: "player" };
    const { rerender } = render(<App navigationAuth={navigationAuth} />);
    expect(await navigationAuth.load(getToken)).toEqual({ isAuthenticated: true });
    mocks.user = null;
    rerender(<App navigationAuth={navigationAuth} />);
    expect(await navigationAuth.load(getToken)).toEqual({ isAuthenticated: false });
    expect(screen.queryByText("Le sanctuaire")).toBeNull();
    expect(mocks.redirect).toHaveBeenCalled();
    expect(getToken).toHaveBeenCalledOnce();
  });
  it("waits for Convex and the server session before mounting protected content", () => {
    const { rerender } = render(<App />);
    expect(screen.getByRole("status").textContent).toBe("Connexion en cours…");
    expect(playerSubscriptions()).toHaveLength(0);
    expect(mocks.ensureWallet).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();

    mocks.auth = { isLoading: false, isAuthenticated: true };
    rerender(<App />);
    expect(screen.queryByText("Le sanctuaire")).toBeNull();
    expect(playerSubscriptions()).toHaveLength(0);
    expect(mocks.ensureWallet).not.toHaveBeenCalled();

    mocks.user = { _id: "player" };
    rerender(<App />);
    expect(screen.getByText("Le sanctuaire")).toBeTruthy();
    expect(
      playerSubscriptions().map(([query]) => getFunctionName(query)),
    ).toEqual([
      "collection:gold",
      "collection:diamonds",
      "social:balance",
      "collection:league",
      "sanctuary:latest",
    ]);
    expect(mocks.ensureWallet).toHaveBeenCalledOnce();
  });

  it("redirects an expired session even when the Convex JWT is still accepted", () => {
    mocks.auth = { isLoading: false, isAuthenticated: true };
    mocks.user = { _id: "player" };
    const { rerender } = render(<App />);
    expect(screen.getByText("Le sanctuaire")).toBeTruthy();

    mocks.query.mockClear();
    mocks.ensureWallet.mockClear();
    mocks.user = null;
    rerender(<App />);
    expect(screen.queryByText("Le sanctuaire")).toBeNull();
    expect(playerSubscriptions()).toHaveLength(0);
    expect(mocks.ensureWallet).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenLastCalledWith({
      to: "/sign-in",
      search: { returnTo: "/sanctuary?checkout=test" },
      replace: true,
    });
  });

  it("does not subscribe to player data when signed out", () => {
    mocks.auth = { isLoading: false, isAuthenticated: false };
    render(<App />);
    expect(screen.queryByText("Le sanctuaire")).toBeNull();
    expect(playerSubscriptions()).toHaveLength(0);
    expect(mocks.ensureWallet).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledOnce();
  });

  it.each([undefined, null])(
    "keeps public pages accessible without a validated session (%s)",
    (user) => {
      mocks.auth = { isLoading: false, isAuthenticated: true };
      mocks.user = user;
      render(<App required={false} />);
      expect(screen.getByText("Entraînement libre")).toBeTruthy();
      expect(playerSubscriptions()).toHaveLength(0);
      expect(mocks.ensureWallet).not.toHaveBeenCalled();
      expect(mocks.redirect).not.toHaveBeenCalled();
    },
  );

  it.each(["success", "failure"])(
    "discards a collection's late %s after the session expires",
    async (outcome) => {
      const error = vi
        .spyOn(feedback, "showGameError")
        .mockImplementation(() => {});
      let resolve!: (value: {
        kind: "gold";
        amount: number;
        alreadyCollected: boolean;
      }) => void;
      let reject!: (reason: Error) => void;
      const response = new Promise((yes, no) => {
        resolve = yes;
        reject = no;
      });
      mocks.collect.mockReturnValue(response);
      mocks.auth = { isLoading: false, isAuthenticated: true };
      mocks.user = { _id: "player" };
      const board: MineBoard = {
        ownerId: "player",
        serverNow: 0,
        rank: 6, mineLevel: 1,
        mines: {
          gold: { amount: 6, updatedAt: 0, heroLevel: 1, revision: 0 },
          emeralds: { amount: 2, updatedAt: 0, heroLevel: 1, revision: 0 },
        },
      };
      function MineScreen() {
        const { collectResource } = useMineCollection(board);
        return (
          <>
            <button onClick={() => void collectResource("gold")}>
              Récupérer l’or
            </button>
            <CurrencyGain currency="gold">
              <span>or</span>
            </CurrencyGain>
          </>
        );
      }
      function MineApp() {
        return (
          <GameAuthGate required>
            <CurrencyGainProvider>
              <MineScreen />
            </CurrencyGainProvider>
          </GameAuthGate>
        );
      }
      const { rerender } = render(<MineApp />);
      fireEvent.click(screen.getByRole("button", { name: "Récupérer l’or" }));
      expect(
        screen.getByRole("status", { name: "Or récupéré" }).textContent,
      ).toContain("+ 6");
      mocks.user = null;
      rerender(<MineApp />);
      expect(screen.queryByRole("status", { name: "Or récupéré" })).toBeNull();
      expect(mocks.redirect).toHaveBeenCalled();
      await act(async () => {
        if (outcome === "success")
          resolve({ kind: "gold", amount: 7, alreadyCollected: false });
        else reject(new Error("Connecte-toi pour jouer."));
        await response.catch(() => {});
      });
      expect(screen.queryByRole("status", { name: "Or récupéré" })).toBeNull();
      expect(error).not.toHaveBeenCalled();
      error.mockRestore();
    },
  );
});
