import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { leagueProgress } from "@sylve/game/leagues";
import { LeaguePanel, LeagueResult } from "./league-progress";

describe("le parcours des ligues", () => {
  it("fills the compact header background within the current division and resets on promotion", () => {
    const { rerender } = render(
      <LeaguePanel progress={leagueProgress(375)} compact />,
    );
    const progress = screen.getByRole("progressbar", {
      name: "Progression vers Fer II",
    });
    expect(progress.getAttribute("aria-valuenow")).toBe("175");
    expect(progress.getAttribute("aria-valuemax")).toBe("200");
    expect(progress.firstElementChild?.getAttribute("style")).toContain("87.5%");
    rerender(<LeaguePanel progress={leagueProgress(400)} compact />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "0",
    );
    rerender(<LeaguePanel progress={leagueProgress(6100)} compact />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe(
      "Ligue maximale atteinte",
    );
    expect(
      screen.getByRole("progressbar").firstElementChild?.getAttribute("style"),
    ).toContain("100%");
  });

  it("shows the remaining trophies, all league thresholds and deck unlocks", async () => {
    render(<LeaguePanel progress={leagueProgress(175)} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "175",
    );
    expect(screen.getByText("25 trophées avant Fer III")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: /Ta ligue : Fer IV, 175 trophées/ }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText("La voie des gardiens")).toBeTruthy();
    expect(dialog.getByText("5 cartes dans le deck")).toBeTruthy();
    expect(dialog.getByText("8 cartes dans le deck")).toBeTruthy();
    expect(dialog.getByText("Challenger I")).toBeTruthy();
    expect(dialog.getByText("2 %")).toBeTruthy();
    expect(
      dialog
        .getByRole("list", { name: "Parcours des ligues" })
        .querySelector('[aria-current="step"]')?.textContent,
    ).toContain("Fer IV");
  });

  it("shows a promotion and the newly unlocked slot after a threshold win", () => {
    render(
      <LeagueResult
        reward={{ trophies: 25, trophiesTotal: 200, previousTrophies: 175 }}
      />,
    );
    expect(screen.getByText("Promotion : Fer III !")).toBeTruthy();
    expect(
      screen.getByText(
        "Nouvel emplacement débloqué : ton deck peut contenir 5 cartes !",
      ),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("img", { name: "Fer III" })
        .querySelector("img")
        ?.getAttribute("src"),
    ).toBe("/art/leagues/iron.webp");
  });

  it("announces trophy loss and demotion without chaining earned deck slots", () => {
    render(
      <LeagueResult
        reward={{
          trophies: -15,
          previousTrophies: 200,
          trophiesTotal: 185,
          deckCapacity: 5,
          deckSlotsGained: 0,
        }}
      />,
    );
    expect(screen.getByText("Rétrogradation : Fer IV")).toBeTruthy();
    expect(
      screen.getByText(/−15 trophées · 185 trophées au total/),
    ).toBeTruthy();
    expect(
      screen.getByText("Tes emplacements de deck restent débloqués."),
    ).toBeTruthy();
  });

  it("does not announce a second slot unlock when recovering a previously reached league", () => {
    render(
      <LeagueResult
        reward={{
          trophies: 25,
          previousTrophies: 185,
          trophiesTotal: 210,
          deckCapacity: 5,
          deckSlotsGained: 0,
        }}
      />,
    );
    expect(screen.getByText("Promotion : Fer III !")).toBeTruthy();
    expect(screen.queryByText(/Nouvel emplacement débloqué/)).toBeNull();
  });

  it("explains the zero trophy floor on defeat", () => {
    render(
      <LeagueResult
        reward={{ trophies: 0, previousTrophies: 0, trophiesTotal: 0 }}
      />,
    );
    expect(screen.getByText("Aucun trophée perdu")).toBeTruthy();
    expect(screen.getByText("Tu es déjà à zéro trophée.")).toBeTruthy();
  });

  it("continues earning trophies in the final league without promising another promotion", () => {
    render(<LeaguePanel progress={leagueProgress(6100)} />);
    expect(screen.getByText("Le sommet des gardiens")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "200",
    );
    expect(
      screen.getByText("Les 8 emplacements de deck sont débloqués"),
    ).toBeTruthy();
  });
});
