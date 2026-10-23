import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { leagueProgress } from "@sylve/game/leagues";
import { LeaguePanel, LeagueVictory } from "./league-progress";

describe("le parcours des ligues", () => {
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
      <LeagueVictory
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
