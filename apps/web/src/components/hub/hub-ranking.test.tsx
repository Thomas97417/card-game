import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReturnType } from "convex/server";
import { DEFAULT_DECK, resolveCard } from "@sylve/game";
import type { api } from "@my-better-t-app/backend/convex/_generated/api";
import { HubDock } from "./hub-dock";

const { useQuery, retry } = vi.hoisted(() => ({ useQuery: vi.fn(), retry: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQuery }));
vi.mock("convex/react", () => ({
  useQuery: (_query: unknown, args: unknown) =>
    args === "skip" ? undefined : [],
  useMutation: () => vi.fn(),
  useConvexConnectionState: () => ({ isWebSocketConnected: true }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

const players: FunctionReturnType<typeof api.collection.leaderboard> = [
  { ownerId: "alice", name: "Aëlys", trophies: 2860, rank: 1, isCurrentPlayer: false },
  { ownerId: "bob", name: "Sylvar", trophies: 1640, rank: 2, isCurrentPlayer: true },
];
const profile: FunctionReturnType<typeof api.collection.playerProfile> = {
  trophies: 2860,
  peakTrophies: 3200,
  deckCapacity: 8,
  deck: { name: "La garde de l’aube", cards: DEFAULT_DECK.map((id) => resolveCard(id, 5)) },
};

let rankingState: { data: typeof players | undefined; isPending?: boolean; isError?: boolean };
let profileState: { data: typeof profile | undefined; isPending?: boolean; isError?: boolean };

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  useQuery.mockReset();
  retry.mockReset();
  rankingState = { data: players };
  profileState = { data: profile };
  useQuery.mockImplementation(({ queryKey }: { queryKey: [string, Parameters<typeof getFunctionName>[0]] }) => ({
    isPending: false,
    isError: false,
    refetch: retry,
    ...(getFunctionName(queryKey[1]) === "collection:leaderboard" ? rankingState : profileState),
  }));
});
afterEach(() => vi.unstubAllGlobals());

async function openRanking() {
  render(<HubDock />);
  const trigger = screen.getByRole("button", { name: "Classement" });
  await act(async () => fireEvent.click(trigger));
  await waitFor(() => expect(useQuery).toHaveBeenCalled());
  return { trigger, panel: screen.getByRole("region", { name: "Classement mondial" }) };
}

describe("le classement du refuge", () => {
  it("opens above the shortcuts, closes with Escape and restores focus", async () => {
    const { trigger, panel } = await openRanking();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const shortcuts = screen.getByRole("navigation", { name: "Communauté du refuge" });
    expect(panel.compareDocumentPosition(shortcuts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Fermer le classement" }));
    fireEvent.keyDown(panel, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Classement mondial" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("expands one player's deck downwards and allows collapsing it", async () => {
    const { panel } = await openRanking();
    const first = within(panel).getByRole("button", { name: /#1.*Aëlys/ });
    const second = within(panel).getByRole("button", { name: /#2.*Sylvar.*Toi/ });
    expect(first.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("list", { name: "Deck du joueur" })).toBeNull();
    expect(useQuery).toHaveBeenCalledTimes(1);
    fireEvent.click(first);
    expect(first.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Meilleure ligue")).toBeDefined();
    expect(screen.getByRole("list", { name: "Deck du joueur" }).children).toHaveLength(4);
    expect(screen.getAllByText("Niv. 5")).toHaveLength(4);
    expect(first.parentElement?.nextElementSibling?.contains(screen.getByText("La garde de l’aube"))).toBe(true);
    fireEvent.click(second);
    expect(first.getAttribute("aria-expanded")).toBe("false");
    expect(second.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(second);
    await waitFor(() => expect(screen.queryByRole("list", { name: "Deck du joueur" })).toBeNull());
  });

  it("moves between players with the keyboard and keeps the chat and ranking mutually exclusive", async () => {
    const { panel } = await openRanking();
    const first = within(panel).getByRole("button", { name: /#1.*Aëlys/ });
    const second = within(panel).getByRole("button", { name: /#2.*Sylvar/ });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement).toBe(second);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Chat mondial/ })));
    expect(screen.queryByRole("region", { name: "Classement mondial" })).toBeNull();
    expect(screen.getByRole("region", { name: "Chat mondial" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Classement" }));
    expect(screen.queryByRole("region", { name: "Chat mondial" })).toBeNull();
  });

  it("opens each card with the player's exact rarity, level, stats and soulbind bonuses", async () => {
    const rare = resolveCard("fox:rare", 11, [1, 3]);
    const legendary = resolveCard("fox:legendary", 19, [2]);
    profileState = {
      data: { ...profile!, deck: { name: "Les renards", cards: [rare, legendary] } },
    };
    const { panel } = await openRanking();
    fireEvent.click(within(panel).getByRole("button", { name: /#1.*Aëlys/ }));

    for (const card of [rare, legendary]) {
      fireEvent.click(within(panel).getByRole("button", {
        name: new RegExp(`Voir ${card.name}, .*niveau ${card.level}`),
      }));
      const dialog = await screen.findByRole("dialog", { name: card.name });
      const stats = within(dialog).getByRole("region", { name: "Caractéristiques" });
      expect(dialog.getAttribute("data-rarity")).toBe(card.rarity);
      expect(within(stats).getByText(`Niv. ${card.level}`)).toBeDefined();
      expect(within(stats).getByLabelText(`${card.attack} de puissance`)).toBeDefined();
      expect(within(stats).getByLabelText(`${card.health} points de vie`)).toBeDefined();
      for (const ability of card.abilities ?? []) {
        expect(within(dialog).getAllByText(ability.description).length).toBeGreaterThan(0);
      }
      expect(within(dialog).getByRole("tab", { name: /Liens d’âme/ }).textContent).toContain(`${card.soulbinds!.length} / 4 actifs`);
      expect(within(dialog).queryByRole("region", { name: "Progression de la carte" })).toBeNull();
      expect(within(dialog).queryByRole("button", { name: /Améliorer|Ajouter au deck|Activer/ })).toBeNull();
      expect(within(dialog).queryByText("Prochaine amélioration")).toBeNull();
      fireEvent.click(within(dialog).getByRole("button", { name: "Fermer la fenêtre" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    }
  });

  it("closes only the card dialog with Escape and restores focus to the card in the expanded deck", async () => {
    const { panel } = await openRanking();
    const player = within(panel).getByRole("button", { name: /#1.*Aëlys/ });
    fireEvent.click(player);
    const card = within(panel).getByRole("button", { name: /Voir Gardien du rempart, Commune, niveau 5/ });
    expect(card.getAttribute("aria-haspopup")).toBe("dialog");
    card.focus();
    fireEvent.click(card);
    const dialog = await screen.findByRole("dialog", { name: "Gardien du rempart" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("region", { name: "Classement mondial" })).toBe(panel);
    expect(player.getAttribute("aria-expanded")).toBe("true");
    expect(within(panel).getByRole("list", { name: "Deck du joueur" })).toBeDefined();
    await waitFor(() => expect(document.activeElement).toBe(card));
  });

  it("handles a loading, empty or unavailable ranking with a retry action", async () => {
    rankingState = { data: undefined, isPending: true };
    const { panel } = await openRanking();
    expect(within(panel).getByRole("status").textContent).toContain("Chargement");
    rankingState = { data: [] };
    fireEvent.click(screen.getByRole("button", { name: "Classement" }));
    fireEvent.click(screen.getByRole("button", { name: "Classement" }));
    expect(screen.getByText("Le cercle attend ses champions")).toBeDefined();
    rankingState = { data: undefined, isError: true };
    fireEvent.click(screen.getByRole("button", { name: "Classement" }));
    fireEvent.click(screen.getByRole("button", { name: "Classement" }));
    expect(screen.getByRole("alert").textContent).toContain("indisponible");
    fireEvent.click(screen.getByRole("button", { name: /Réessayer/ }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("handles a missing deck or unavailable player without hiding the ranking", async () => {
    profileState = { data: { ...profile!, deck: null } };
    const { panel } = await openRanking();
    fireEvent.click(within(panel).getByRole("button", { name: /#1.*Aëlys/ }));
    expect(screen.getByText("Ce gardien n’a pas encore de deck.")).toBeDefined();
    profileState = { data: undefined, isError: true };
    fireEvent.click(within(panel).getByRole("button", { name: /#2.*Sylvar/ }));
    expect(screen.getByRole("alert").textContent).toContain("profil");
    expect(within(panel).getByRole("button", { name: /#1.*Aëlys/ })).toBeDefined();
  });
});
