import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { useQuery } from "convex/react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { GameAuthGate } from "./game-auth-gate";
import { GoldProvider } from "./gold-balance";
import { EmeraldProvider } from "./emerald-balance";
import { PlayerHeaderProvider } from "./player-header";

const mocks = vi.hoisted(() => ({
  auth: { isLoading: true, isAuthenticated: false },
  user: undefined as { _id: string } | null | undefined,
  href: "/sanctuary?checkout=test",
  query: vi.fn(),
  ensureWallet: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => mocks.auth,
  useQuery: (...args: unknown[]) => mocks.query(...args),
  useMutation: () => mocks.ensureWallet,
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

function App({ required = true }: { required?: boolean }) {
  return (
    <GameAuthGate required={required}>
      <GoldProvider>
        <EmeraldProvider>
          <PlayerHeaderProvider>
            {required ? <ProtectedPage /> : <div>Entraînement libre</div>}
          </PlayerHeaderProvider>
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
    expect(playerSubscriptions().map(([query]) => getFunctionName(query))).toEqual([
      "collection:gold",
      "collection:diamonds",
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

  it.each([undefined, null])("keeps public pages accessible without a validated session (%s)", (user) => {
    mocks.auth = { isLoading: false, isAuthenticated: true };
    mocks.user = user;
    render(<App required={false} />);
    expect(screen.getByText("Entraînement libre")).toBeTruthy();
    expect(playerSubscriptions()).toHaveLength(0);
    expect(mocks.ensureWallet).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
