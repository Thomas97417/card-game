import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DECK,
  combatTypeLabel,
  createGame,
  isDeploymentDepth,
  playerView,
  validateDeck,
} from "@sylve/game";
import { DuelScreen, type DuelData } from "./duel-screen";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

function matchData(): DuelData {
  const state = createGame([
    { userId: "alice", name: "Alice", cards: validateDeck(DEFAULT_DECK) },
    { userId: "bob", name: "Bob", cards: validateDeck(DEFAULT_DECK) },
  ], Date.now(), () => 0.25);
  state.activePlayer = 0;
  for (const [index, id, hp] of [[0, "guardian", 4], [1, "fox", 1]] as const) {
    const player = state.players[index]!;
    player.hand = player.hand.filter((cardId) => cardId !== id);
    player.drawPile = player.drawPile.filter((cardId) => cardId !== id);
    player.board.push({ cardId: id, row: 1, depth: id === "guardian" ? 1 : 2, hp });
  }
  return { ...playerView(state, "alice"), events: [] };
}

function setup(data = matchData()) {
  const actions = {
    onPlayCard: vi.fn().mockResolvedValue(undefined),
    onWithdrawCard: vi.fn().mockResolvedValue(undefined),
    onEndTurn: vi.fn().mockResolvedValue(undefined),
    onSurrender: vi.fn().mockResolvedValue(undefined),
  };
  const result = render(<DuelScreen data={data} {...actions} practice />);
  return { ...result, data, actions };
}

async function openHandCard(data: DuelData) {
  const card = data.players[data.me]!.hand[0]!;
  fireEvent.click(await screen.findByRole("button", {
    name: `${card.name}, ${combatTypeLabel(card)}, ${card.attack} attaque, ${card.health} points de vie, voir les informations`,
  }));
  return { card, dialog: within(await screen.findByRole("dialog")) };
}

describe("inspection pendant un duel", () => {
  it.each(["guardian", "fox"])("inspects %s and preserves its legal deployment zones", async (cardId) => {
    const data = matchData();
    data.players[0]!.board = [];
    data.players[0]!.hand = [data.players[0]!.deck.find((card) => card.id === cardId)!];
    data.players[0]!.handCount = 1;
    const { actions } = setup(data);
    const { card, dialog } = await openHandCard(data);
    expect(dialog.getByRole("heading", { name: card.name })).toBeTruthy();
    expect(dialog.getByText(card.title)).toBeTruthy();
    expect(actions.onPlayCard).not.toHaveBeenCalled();
    fireEvent.click(dialog.getByRole("button", { name: "Choisir une case" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const depth = isDeploymentDepth(card, 0) ? 0 : 2;
    const forbiddenDepth = depth === 0 ? 2 : 0;
    fireEvent.click(screen.getByRole("button", {
      name: new RegExp(`^Ton camp, ligne 1, colonne ${3 - forbiddenDepth}, zone .*vide$`),
    }));
    expect(actions.onPlayCard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", {
      name: new RegExp(`^Ton camp, ligne 1, colonne ${3 - depth}, zone .*vide$`),
    }));
    expect(actions.onPlayCard).toHaveBeenCalledWith(card.id, 0, depth, data.turn);
  });

  it("shows the melee blocker in the card dialog while allowing withdrawal", async () => {
    const data = matchData();
    const player = data.players[0]!;
    const turtle = player.deck.find((card) => card.id === "turtle")!;
    player.hand = player.hand.filter((card) => card.id !== turtle.id);
    player.handCount = player.hand.length;
    player.board.push({ cardId: turtle.id, card: turtle, row: 1, depth: 0, hp: turtle.health });
    setup(data);
    fireEvent.click(await screen.findByRole("button", {
      name: /Gardien de pierre, Corps à corps, puissance 2, 4 PV, bloquée.*voir les informations/,
    }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText("Bloquée : une unité au corps à corps est devant elle sur cette ligne.")).toBeTruthy();
    expect((dialog.getByRole("button", { name: "Retirer du terrain" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it.each(["opponent", "summoned", "finished", "expired"] as const)(
    "allows inspection but prevents summoning when %s", async (reason) => {
      const data = matchData();
      if (reason === "opponent") data.activePlayer = 1;
      if (reason === "summoned") data.hasSummoned = true;
      if (reason === "finished") data.status = "finished";
      if (reason === "expired") data.turnEndsAt = Date.now() - 1;
      const actions = {
        onPlayCard: vi.fn(), onWithdrawCard: vi.fn(),
        onEndTurn: vi.fn(), onSurrender: vi.fn(),
      };
      render(<DuelScreen data={data} {...actions} />);
      const { dialog } = await openHandCard(data);
      const choose = dialog.getByRole("button", { name: "Choisir une case" }) as HTMLButtonElement;
      expect(choose.disabled).toBe(true);
      fireEvent.click(choose);
      expect(actions.onPlayCard).not.toHaveBeenCalled();
    },
  );

  it("shows wounded own creatures and preserves withdrawal", async () => {
    const { data, actions } = setup();
    fireEvent.click(await screen.findByRole("button", {
      name: "Gardien de pierre, Corps à corps, puissance 2, 4 PV, voir les informations",
    }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByLabelText("4 points de vie")).toBeTruthy();
    expect(dialog.getByText("/ 9")).toBeTruthy();
    expect(dialog.getByText("Ligne 2 · Milieu")).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Retirer du terrain" }));
    expect(actions.onWithdrawCard).toHaveBeenCalledWith("guardian", data.turn);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes with Escape without playing or withdrawing a card", async () => {
    const { data, actions } = setup();
    await openHandCard(data);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", code: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(actions.onPlayCard).not.toHaveBeenCalled();
    expect(actions.onWithdrawCard).not.toHaveBeenCalled();
  });

  it("inspects enemy creatures during the opponent's turn without offering withdrawal", async () => {
    const data = matchData();
    data.activePlayer = 1;
    setup(data);
    fireEvent.click(await screen.findByRole("button", {
      name: "Renard des braises, À distance, puissance 5, 1 PV, voir les informations",
    }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByLabelText("1 points de vie")).toBeTruthy();
    expect(dialog.queryByRole("button", { name: "Retirer du terrain" })).toBeNull();
  });

  it.each(["figure", "panel"] as const)("opens the enemy hero's %s, deck and individual cards", async (target) => {
    const { data } = setup();
    fireEvent.click(await screen.findByRole("button", {
      name: target === "figure"
        ? "Voir le héros adverse, Bob, 30 PV"
        : "Voir les caractéristiques et le deck de Bob",
    }));
    let dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByRole("heading", { name: "Bob" })).toBeTruthy();
    expect(dialog.getByText("30 / 30")).toBeTruthy();
    expect(dialog.getByRole("heading", { name: "Deck adverse" })).toBeTruthy();
    expect(dialog.getAllByRole("button", { name: /voir les informations/ })).toHaveLength(8);
    const card = data.players[1]!.deck[0]!;
    fireEvent.click(dialog.getByRole("button", { name: new RegExp(`${card.name},`) }));
    dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole("heading", { name: card.name })).toBeTruthy();
    expect(dialog.queryByRole("button", { name: "Choisir une case" })).toBeNull();
    fireEvent.click(dialog.getByRole("button", { name: "Retour au héros" }));
    expect(dialog.getByRole("heading", { name: "Deck adverse" })).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Fermer la fenêtre" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps displayed HP current and prevents withdrawing a creature that left the board", async () => {
    const { data, actions, rerender } = setup();
    fireEvent.click(await screen.findByRole("button", {
      name: "Gardien de pierre, Corps à corps, puissance 2, 4 PV, voir les informations",
    }));
    await screen.findByRole("dialog");
    const next = structuredClone(data);
    next.players[0]!.board[0]!.hp = 2;
    next.activePlayer = 1;
    rerender(<DuelScreen data={next} {...actions} practice />);
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByLabelText("2 points de vie")).toBeTruthy());
    expect((within(screen.getByRole("dialog")).getByRole("button", { name: "Retirer du terrain" }) as HTMLButtonElement).disabled).toBe(true);
    next.players[0]!.board = [];
    rerender(<DuelScreen data={structuredClone(next)} {...actions} practice />);
    await waitFor(() => expect(within(screen.getByRole("dialog")).queryByRole("button", { name: "Retirer du terrain" })).toBeNull());
    expect(within(screen.getByRole("dialog")).getByText("Cette créature a quitté le terrain.")).toBeTruthy();
  });
});
