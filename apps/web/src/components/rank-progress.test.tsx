import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RankBadge, RankProvider, RankUpDialog } from "./rank-progress";

const mocks = vi.hoisted(() => ({
  authenticated: true,
  pathname: "/decks",
  progress: undefined as Record<string, unknown> | undefined,
  query: vi.fn(),
  ensure: vi.fn(),
  acknowledge: vi.fn(),
}));
vi.mock("@/hooks/use-game-auth", () => ({ useGameAuth: () => ({ isAuthenticated: mocks.authenticated }) }));
vi.mock("convex/react", () => ({
  useQuery: (query: Parameters<typeof getFunctionName>[0], args: unknown) => {
    mocks.query(getFunctionName(query), args);
    return args === "skip" ? undefined : mocks.progress;
  },
  useMutation: (mutation: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(mutation) === "collection:ensureRank" ? mocks.ensure : mocks.acknowledge,
}));
vi.mock("@tanstack/react-router", () => ({ useRouterState: () => mocks.pathname, Link: "a" }));

function progress() {
  return {
    ownerId: "alice", rank: 6, experience: 150, earned: 0, required: 50,
    friends: 5, mineLevel: 2, emeralds: 3,
    nextFriends: { rank: 10, friends: 7 },
    pending: { fromRank: 5, toRank: 6, emeralds: 3 },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticated = true;
  mocks.pathname = "/decks";
  mocks.progress = progress();
  mocks.ensure.mockResolvedValue(undefined);
  mocks.acknowledge.mockResolvedValue(undefined);
});

describe("account rank panels", () => {
  it("automatically announces a promotion with mine, friend, soulbind and credited emerald benefits", async () => {
    render(<RankProvider><RankBadge /></RankProvider>);
    expect(await screen.findByRole("dialog", { name: "Rang supérieur !" })).toBeTruthy();
    expect(screen.getByText("Émeraudes ajoutées à ton solde")).toBeTruthy();
    expect(screen.getByText(/rang requis atteint/)).toBeTruthy();
    expect(screen.getByText("Mine d’or · niveau")).toBeTruthy();
    expect(screen.getByText("Mine d’émeraudes · niveau")).toBeTruthy();
    expect(screen.getByText("Places d’amis")).toBeTruthy();
    expect(mocks.ensure).toHaveBeenCalledWith({ expectedOwnerId: "alice" });
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    await waitFor(() => expect(mocks.acknowledge).toHaveBeenCalledWith({ throughRank: 6, expectedOwnerId: "alice" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("totals multiple ranks in one panel and retains keyboard dismissal", async () => {
    const close = vi.fn();
    render(<RankUpDialog fromRank={1} toRank={5} emeralds={14} onClose={close} />);
    expect(screen.getByText("Du rang 1 au rang 5 : 4 rangs franchis !")).toBeTruthy();
    expect(screen.getByText("14")).toBeTruthy();
    expect(screen.queryByText(/rang requis atteint/)).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Rang supérieur !" })));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("prevents repeated acknowledgments, retains the panel on failure and retries", async () => {
    let reject!: (error: Error) => void;
    mocks.acknowledge.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    render(<RankProvider><span>Atelier</span></RankProvider>);
    const button = screen.getByRole("button", { name: "Continuer" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.acknowledge).toHaveBeenCalledTimes(1);
    expect(button.hasAttribute("disabled")).toBe(true);
    await act(async () => reject(new Error("network")));
    expect(screen.getByRole("alert").textContent).toContain("déjà créditées");
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.acknowledge).toHaveBeenCalledTimes(2);
  });

  it("waits until a battle ends and keeps unseen progress across navigation", () => {
    mocks.pathname = "/game/match-1";
    const { rerender } = render(<RankProvider><span>Partie</span></RankProvider>);
    expect(screen.queryByRole("dialog")).toBeNull();
    mocks.pathname = "/practice";
    rerender(<RankProvider><span>Partie</span></RankProvider>);
    expect(screen.queryByRole("dialog")).toBeNull();
    mocks.pathname = "/hub";
    rerender(<RankProvider><span>Refuge</span></RankProvider>);
    expect(screen.getByRole("dialog", { name: "Rang supérieur !" })).toBeTruthy();
  });

  it("shows progress and next rewards from the header, and skips private data when signed out", async () => {
    mocks.progress = { ...progress(), pending: null };
    const { rerender } = render(<RankProvider><RankBadge /></RankProvider>);
    fireEvent.click(screen.getByRole("button", { name: /Rang 6, 0 sur 50 XP/ }));
    expect(await screen.findByRole("dialog", { name: "Ton rang" })).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Expérience de rang" }).getAttribute("max")).toBe("50");
    expect(screen.getByText("7 places d’amis au rang 10.")).toBeTruthy();
    mocks.authenticated = false;
    rerender(<RankProvider><RankBadge /></RankProvider>);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.query).toHaveBeenLastCalledWith("collection:rank", "skip");
  });

  it("does not hide another account's promotion after the previous account dismissed the same rank", async () => {
    const { rerender } = render(<RankProvider><RankBadge /></RankProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    mocks.progress = { ...progress(), ownerId: "bob" };
    rerender(<RankProvider><RankBadge /></RankProvider>);
    expect(screen.getByRole("dialog", { name: "Rang supérieur !" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    await waitFor(() => expect(mocks.acknowledge).toHaveBeenLastCalledWith({ throughRank: 6, expectedOwnerId: "bob" }));
  });
});
