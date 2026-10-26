import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  createGame,
  DEFAULT_DECK,
  playerView,
  validateDeck,
} from "@sylve/game";
import { deckCapacity, leagueAt } from "@sylve/game/leagues";
import { DuelResult } from "./duel-result";
import type { DuelData } from "./duel-screen";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

function result(previous = 775, total = 800, peak = previous): DuelData {
  const state = createGame(
    [
      { userId: "alice", name: "Alice", cards: validateDeck(DEFAULT_DECK) },
      { userId: "bob", name: "Bob", cards: validateDeck(DEFAULT_DECK) },
    ],
    Date.now(),
    () => 0.25,
  );
  state.status = "finished";
  state.winner = 0;
  return {
    ...playerView(state, "alice"),
    events: [],
    mode: "solo",
    trophyChange: {
      trophies: total - previous,
      previousTrophies: previous,
      previousPeakTrophies: peak,
      trophiesTotal: total,
      deckCapacity: deckCapacity(Math.max(peak, total)),
      deckSlotsGained: deckCapacity(Math.max(peak, total)) - deckCapacity(peak),
    },
    reward: { status: "awarded", rarity: "common", victoryWins: 3 },
  };
}

describe("résultat du combat", () => {
  it("celebrates a new league and foregrounds every newly unlocked feature", () => {
    render(<DuelResult data={result()} practice={false} />);
    const dialog = within(screen.getByRole("dialog", { name: "Bronze IV" }));
    expect(dialog.getByText("Nouvelle ligue")).toBeTruthy();
    expect(
      dialog
        .getByRole("img", { name: "Bronze IV" })
        .querySelector("img")
        ?.getAttribute("src"),
    ).toBe("/art/leagues/bronze.webp");
    const unlocks = within(
      dialog.getByRole("region", { name: "Nouveautés débloquées" }),
    );
    expect(unlocks.getAllByRole("listitem")).toHaveLength(3);
    expect(unlocks.getByText("Deck de 6 cartes")).toBeTruthy();
    expect(unlocks.getByText("+1 place de coffre")).toBeTruthy();
    expect(unlocks.getByText("Liens d’âme")).toBeTruthy();
    expect(
      dialog.queryByText(
        /Tes compagnons|LE CERCLE A TRANCHÉ|Il se déverrouille/,
      ),
    ).toBeNull();
  });

  it.each([
    [200, "Deck de 5 cartes"],
    [1600, "Deck de 7 cartes"],
    [2000, "Coffre épique"],
    [2200, "Coffre légendaire"],
    [2400, "Évolutions"],
  ])(
    "presents the real novelty when first reaching %i trophies",
    (total, title) => {
      render(<DuelResult data={result(total - 25, total)} practice={false} />);
      expect(
        screen.getByRole("heading", { name: leagueAt(total).label }),
      ).toBeTruthy();
      expect(
        within(
          screen.getByRole("region", { name: "Nouveautés débloquées" }),
        ).getByText(title),
      ).toBeTruthy();
    },
  );

  it.each([200, 800, 1600, 2000, 2200, 2400])(
    "does not repeat any unlock on recovering the league at %i trophies, even after a remount",
    (total) => {
      const data = result(total - 15, total + 10, total + 100);
      const { unmount } = render(<DuelResult data={data} practice={false} />);
      expect(screen.getByText("Ligue retrouvée")).toBeTruthy();
      expect(
        screen.queryByRole("region", { name: "Nouveautés débloquées" }),
      ).toBeNull();
      unmount();
      render(<DuelResult data={data} practice={false} />);
      expect(
        screen.queryByRole("region", { name: "Nouveautés débloquées" }),
      ).toBeNull();
    },
  );

  it("does not invent unlocks for a legacy result with no historical record", () => {
    const data = result();
    delete data.trophyChange!.previousPeakTrophies;
    data.trophyChange!.deckSlotsGained = 0;
    render(<DuelResult data={data} practice={false} />);
    expect(
      screen.queryByRole("region", { name: "Nouveautés débloquées" }),
    ).toBeNull();
  });

  it("keeps an ordinary victory compact and shows the two distinct chests", () => {
    render(<DuelResult data={result(50, 75)} practice={false} />);
    const dialog = within(screen.getByRole("dialog", { name: "Victoire !" }));
    expect(dialog.getByText("Coffre commun")).toBeTruthy();
    expect(
      dialog.getByLabelText("Coffre de victoires : 3/3, prêt à ouvrir"),
    ).toBeTruthy();
    expect(
      dialog.queryByRole("region", { name: "Nouveautés débloquées" }),
    ).toBeNull();
    expect(
      dialog
        .getByRole("link", { name: "Retour au salon" })
        .getAttribute("href"),
    ).toBe("/arena");
  });

  it("keeps earned trophies and victory chest progress visible when combat chest slots are full", () => {
    const data = result(100, 125);
    data.reward = { status: "lost", victoryWins: 2 };
    render(<DuelResult data={data} practice={false} />);
    expect(screen.getByText("Coffre non reçu")).toBeTruthy();
    expect(screen.getByLabelText("+25 trophées")).toBeTruthy();
    expect(screen.getByLabelText("Coffre de victoires : 2/3")).toBeTruthy();
    expect(screen.queryByText("Prêt à ouvrir")).toBeNull();
  });

  it("retains accessible result controls after Escape and lets practice restart", () => {
    const data = result();
    data.trophyChange = null;
    data.reward = null;
    const onRestart = vi.fn();
    render(<DuelResult data={data} practice onRestart={onRestart} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Victoire !" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Fermer la fenêtre" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Rejouer" }));
    expect(onRestart).toHaveBeenCalledOnce();
  });
});
