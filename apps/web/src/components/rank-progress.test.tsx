import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RankBadge, RankProvider, RankUpDialog } from "./rank-progress";
import { GameHeader } from "./game-header";

const mocks = vi.hoisted(() => ({
  authenticated: true,
  pathname: "/decks",
  progress: undefined as Record<string, unknown> | undefined,
  user: { name: "Aëlys" },
  hero: { heroId: "sylve" },
  query: vi.fn(),
  ensure: vi.fn(),
  acknowledge: vi.fn(),
}));
vi.mock("@/hooks/use-game-auth", () => ({ useGameAuth: () => ({ isAuthenticated: mocks.authenticated }) }));
vi.mock("convex/react", () => ({
  useQuery: (query: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(query);
    mocks.query(name, args);
    if (args === "skip") return undefined;
    if (name === "auth:getCurrentUser") return mocks.user;
    if (name === "collection:hero") return mocks.hero;
    return mocks.progress;
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
  mocks.user = { name: "Aëlys" };
  mocks.hero = { heroId: "sylve" };
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
    expect(screen.queryByText("Progression du compte")).toBeNull();
    expect(screen.queryByText("Améliore tes cartes et aide tes amis pour gagner de l’expérience.")).toBeNull();
    expect(screen.queryByText(/Chaque aide quotidienne envoyée rapporte/)).toBeNull();
    mocks.authenticated = false;
    rerender(<RankProvider><RankBadge /></RankProvider>);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.query).toHaveBeenLastCalledWith("collection:rank", "skip");
  });

  it("shows the profile on the left of the hub header and keeps other page headers free of the rank button", () => {
    mocks.progress = { ...progress(), pending: null };
    const { rerender } = render(<RankProvider><GameHeader /></RankProvider>);
    expect(screen.queryByRole("button", { name: /Voir la progression/ })).toBeNull();
    rerender(<RankProvider><GameHeader className="hub-hud" showBack={false}><RankBadge /></GameHeader></RankProvider>);
    const profile = screen.getByRole("button", { name: /Aëlys · Rang 6, 0 sur 50 XP/ });
    const header = profile.closest("header")!;
    expect(header.classList.contains("hub-hud")).toBe(true);
    expect(header.firstElementChild).toBe(profile);
    expect(screen.getByRole("img", { name: "Gardien de la Sylve" }).getAttribute("src")).toBe("/art/heroes/hero-sylve.webp");
  });

  it("refreshes the portrait and player name without resetting XP when the active hero changes", () => {
    mocks.progress = { ...progress(), earned: 10, pending: null };
    const { rerender } = render(<RankProvider><RankBadge /></RankProvider>);
    mocks.hero = { heroId: "moon" };
    mocks.user = { name: "Léa" };
    rerender(<RankProvider><RankBadge /></RankProvider>);
    expect(screen.getByRole("button", { name: /Léa · Rang 6, 10 sur 50 XP/ })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Souveraine Carmin" }).getAttribute("src")).toBe("/art/heroes/hero-moon.webp");
    expect(screen.queryByRole("img", { name: "Gardien de la Sylve" })).toBeNull();
    expect(screen.getByText("10 / 50 XP")).toBeTruthy();
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
