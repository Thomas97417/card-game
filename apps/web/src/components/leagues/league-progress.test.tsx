import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { leagueProgress } from "@sylve/game/leagues";
import { LeaguePanel, LeagueResult } from "./league-progress";

describe("le parcours des ligues", () => {
  it("places every guardian at its exact recruitment milestone and preserves emerald prices", async () => {
    render(<LeaguePanel progress={leagueProgress(0)} compact />);
    fireEvent.click(screen.getByRole("button", { name: /Ta ligue : Fer IV/ }));
    const dialog = within(await screen.findByRole("dialog"));
    const milestones = [
      { league: "Fer IV", heroes: ["Gardien de la Sylve", "Gardien du Givre"] },
      { league: "Bronze IV", heroes: ["Chamane des Racines"] },
      { league: "Bronze III", heroes: ["Gardien des Ronces"] },
      { league: "Bronze I", heroes: ["Tisseuse du Crépuscule"] },
      { league: "Argent III", heroes: ["Gardien du Vide"] },
      {
        league: "Or I",
        heroes: ["Maestra des Clairières", "Émissaire des Braises"],
      },
      { league: "Platine III", heroes: ["Artificier des Neiges"] },
      { league: "Platine I", heroes: ["Héraut des Ombres"] },
      { league: "Émeraude III", heroes: ["Souveraine Carmin"] },
    ];
    for (const milestone of milestones) {
      const heroButton = dialog.getByRole("button", {
        name: `Voir ${milestone.heroes[0]} au palier ${milestone.league}`,
      });
      fireEvent.click(heroButton);
      const node = dialog.getByRole("button", {
        name: new RegExp(`^${milestone.league},`),
      });
      expect(node.getAttribute("aria-pressed")).toBe("true");
      expect(document.activeElement).toBe(node);
      const section = within(
        dialog.getByRole("region", { name: "Héros de ce palier" }),
      );
      expect(section.getAllByRole("listitem")).toHaveLength(
        milestone.heroes.length,
      );
      for (const hero of milestone.heroes) {
        expect(section.getByText(hero)).toBeTruthy();
        expect(
          section.getByRole("img", { name: hero }).getAttribute("src"),
        ).toMatch(/^\/art\/heroes\/hero-/);
      }
      expect(
        section.getByText(/Le palier ouvre l’accès à l’achat/),
      ).toBeTruthy();
    }
    fireEvent.click(dialog.getByRole("button", { name: /^Or I,/ }));
    const orHeroes = within(
      dialog.getByRole("region", { name: "Héros de ce palier" }),
    );
    expect(orHeroes.getByText(/^7\s500$/)).toBeTruthy();
    expect(orHeroes.getByText(/^5\s500$/)).toBeTruthy();
    expect(orHeroes.getByText(/Atteins 3\s000 trophées/)).toBeTruthy();
    expect(
      dialog.getByRole("region", { name: "Ta progression" }).textContent,
    ).toContain("Fer IV");
  });

  it("keeps recruitment available through demotion and shows the next hero milestone", async () => {
    render(<LeaguePanel progress={leagueProgress(100, 3000)} compact />);
    fireEvent.click(screen.getByRole("button", { name: /Ta ligue : Fer IV/ }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(
      dialog.getByRole("heading", { name: "Artificier des Neiges" }),
    ).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: /^Or I,/ }));
    const heroes = within(
      dialog.getByRole("region", { name: "Héros de ce palier" }),
    );
    expect(
      heroes.getByText("Recrutement accessible à la Maison des gardiens."),
    ).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: /^Fer IV,/ }));
    const starting = within(
      dialog.getByRole("region", { name: "Héros de ce palier" }),
    );
    expect(starting.getByText("Héros de départ · Gratuit")).toBeTruthy();
    expect(starting.getByText(/^4\s500$/)).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: /^Fer III,/ }));
    expect(
      dialog.queryByRole("region", { name: "Héros de ce palier" }),
    ).toBeNull();
  });
  it("fills the compact header background within the current division and resets on promotion", () => {
    const { rerender } = render(
      <LeaguePanel progress={leagueProgress(375)} compact />,
    );
    const progress = screen.getByRole("progressbar", {
      name: "Progression vers Fer II",
    });
    expect(progress.getAttribute("aria-valuenow")).toBe("175");
    expect(progress.getAttribute("aria-valuemax")).toBe("200");
    expect(progress.firstElementChild?.getAttribute("style")).toContain(
      "87.5%",
    );
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
    expect(dialog.getByText("La ligue des gardiens")).toBeTruthy();
    expect(dialog.getByText("5 cartes dans le deck")).toBeTruthy();
    expect(dialog.getByText("8 cartes dans le deck")).toBeTruthy();
    expect(dialog.getByText("3 emplacements de coffre")).toBeTruthy();
    expect(dialog.getByText("4 emplacements de coffre")).toBeTruthy();
    expect(dialog.getByText("5 emplacements de coffre")).toBeTruthy();
    expect(dialog.getByRole("button", { name: /^Challenger,/ })).toBeTruthy();
    expect(dialog.getByText("100 %")).toBeTruthy();
    expect(
      dialog
        .getByRole("list", { name: "Parcours des ligues" })
        .querySelector('[aria-current="step"]')?.textContent,
    ).toContain("Fer IV");
  });

  it("previews a milestone's rewards and returns to the player's position", async () => {
    render(<LeaguePanel progress={leagueProgress(175)} compact />);
    fireEvent.click(screen.getByRole("button", { name: /Ta ligue : Fer IV/ }));
    const dialog = within(await screen.findByRole("dialog"));
    const details = within(
      dialog.getByRole("region", {
        name: "Détails du palier sélectionné",
      }),
    );
    fireEvent.click(dialog.getByRole("button", { name: /^Or IV,/ }));
    expect(details.getByRole("heading", { name: "Or IV" })).toBeTruthy();
    expect(details.getByText("1,19 %")).toBeTruthy();
    expect(details.getByText("Disponible dès Émeraude IV")).toBeTruthy();
    expect(details.getByText("Deck de 8 cartes")).toBeTruthy();
    expect(
      details.getByText(
        /À débloquer :.*place dans le deck.*emplacement de coffre/,
      ),
    ).toBeTruthy();
    expect(
      dialog.getByRole("region", { name: "Ta progression" }).textContent,
    ).toContain("Fer IV");

    fireEvent.click(dialog.getByRole("button", { name: "Ma position" }));
    expect(details.getByRole("heading", { name: "Fer IV" })).toBeTruthy();
    expect(details.getByText("100 %")).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Fer III 200" }));
    expect(details.getByRole("heading", { name: "Fer III" })).toBeTruthy();

    fireEvent.click(dialog.getByRole("button", { name: "Fermer la fenêtre" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: /Ta ligue : Fer IV/ }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /Ta ligue : Fer IV/ }));
    const reopened = within(await screen.findByRole("dialog"));
    expect(
      within(
        reopened.getByRole("region", {
          name: "Détails du palier sélectionné",
        }),
      ).getByRole("heading", { name: "Fer IV" }),
    ).toBeTruthy();
  });

  it("previews CW card quantities, gold and chest unlock leagues", async () => {
    render(<LeaguePanel progress={leagueProgress(0)} compact />);
    fireEvent.click(screen.getByRole("button", { name: /Ta ligue : Fer IV/ }));
    const dialog = within(await screen.findByRole("dialog"));
    const details = within(
      dialog.getByRole("region", { name: "Détails du palier sélectionné" }),
    );
    expect(
      details.getByText("Commune : 10–11 exemplaires (95 %)"),
    ).toBeTruthy();
    expect(details.getByText("28–47 pièces d’or")).toBeTruthy();
    expect(details.getByText("3 min d’attente")).toBeTruthy();
    expect(details.getByText("Ouverture immédiate : 1 émeraude")).toBeTruthy();
    for (const league of [
      "Bronze IV",
      "Bronze III",
      "Argent II",
      "Émeraude IV",
    ])
      expect(details.getByText(`Disponible dès ${league}`)).toBeTruthy();

    fireEvent.click(dialog.getByRole("button", { name: /^Bronze III,/ }));
    expect(details.getByText("Rare : 23–24 exemplaires (99,5 %)")).toBeTruthy();
    expect(details.getByText("57–82 pièces d’or")).toBeTruthy();
    expect(details.getByText("1 h d’attente")).toBeTruthy();
    expect(
      details.getByText("Ouverture immédiate : 20 émeraudes"),
    ).toBeTruthy();
    expect(details.getByText("3 h d’attente")).toBeTruthy();
    expect(
      details.getByText("Ouverture immédiate : 33 émeraudes"),
    ).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: /^Émeraude IV,/ }));
    expect(
      details.getByText("Légendaire : 3 exemplaires (100 %)"),
    ).toBeTruthy();
    expect(details.getByText("248–321 pièces d’or")).toBeTruthy();
    expect(details.getByText("6 h d’attente")).toBeTruthy();
    expect(
      details.getByText("Ouverture immédiate : 66 émeraudes"),
    ).toBeTruthy();
    expect(details.getByText("24 h d’attente")).toBeTruthy();
    expect(
      details.getByText("Ouverture immédiate : 180 émeraudes"),
    ).toBeTruthy();
    expect(details.getByText("36 h d’attente")).toBeTruthy();
    expect(
      details.getByText("Ouverture immédiate : 270 émeraudes"),
    ).toBeTruthy();
    expect(details.queryByText(/Disponible dès/)).toBeNull();
  });

  it("keeps division progress on the current timeline node and resets its ring on promotion", async () => {
    const { rerender } = render(
      <LeaguePanel progress={leagueProgress(420)} compact />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Ta ligue : Fer II/ }));
    const dialog = within(await screen.findByRole("dialog"));
    const ring = dialog.getByRole("progressbar", {
      name: "Progression vers Fer I",
    });
    expect(ring.getAttribute("aria-valuenow")).toBe("20");
    expect(ring.getAttribute("aria-valuemax")).toBe("200");
    expect(ring.getAttribute("aria-valuetext")).toContain(
      "180 trophées avant Fer I",
    );
    expect(
      ring
        .querySelector(".league-road-progress-value")
        ?.getAttribute("stroke-dashoffset"),
    ).toBe("90");
    expect(
      within(
        dialog.getByRole("region", { name: "Ta progression" }),
      ).queryByRole("progressbar"),
    ).toBeNull();
    expect(dialog.getByText("Et un 3ᵉ emplacement de coffre.")).toBeTruthy();

    fireEvent.click(dialog.getByRole("button", { name: "Palier suivant" }));
    expect(ring.closest('[aria-current="step"]')?.textContent).toContain(
      "Fer II",
    );
    expect(dialog.getAllByRole("progressbar")).toHaveLength(1);

    rerender(<LeaguePanel progress={leagueProgress(600)} compact />);
    expect(
      dialog
        .getByRole("progressbar", { name: "Progression vers Bronze IV" })
        .getAttribute("aria-valuenow"),
    ).toBe("0");
    rerender(<LeaguePanel progress={leagueProgress(6100)} compact />);
    const finalRing = dialog.getByRole("progressbar");
    expect(finalRing.getAttribute("aria-valuetext")).toBe(
      "Ligue maximale atteinte",
    );
    expect(
      finalRing
        .querySelector(".league-road-progress-value")
        ?.getAttribute("stroke-dashoffset"),
    ).toBe("0");
  });

  it("explores the entire timeline with the keyboard while retaining the current league", async () => {
    render(<LeaguePanel progress={leagueProgress(175)} compact />);
    fireEvent.click(screen.getByRole("button", { name: /Ta ligue : Fer IV/ }));
    const dialog = within(await screen.findByRole("dialog"));
    const road = dialog.getByRole("list", { name: "Parcours des ligues" });
    const first = dialog.getByRole("button", { name: /^Fer IV,/ });
    fireEvent.keyDown(first, { key: "ArrowRight" });
    const second = dialog.getByRole("button", { name: /^Fer III,/ });
    expect(second.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(second);

    fireEvent.keyDown(second, { key: "End" });
    const last = dialog.getByRole("button", { name: /^Challenger,/ });
    expect(document.activeElement).toBe(last);
    expect(
      dialog
        .getByRole("button", { name: "Palier suivant" })
        .hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.keyDown(last, { key: "ArrowRight" });
    expect(last.getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(last, { key: "Home" });
    expect(document.activeElement).toBe(first);
    expect(
      dialog
        .getByRole("button", { name: "Palier précédent" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(road.querySelectorAll('button[tabindex="0"]').length).toBe(1);
    expect(road.querySelector('[aria-current="step"]')?.textContent).toContain(
      "Fer IV",
    );
  });

  it("keeps reached milestones unlocked after a demotion and offers the next unearned reward", async () => {
    render(<LeaguePanel progress={leagueProgress(185, 800)} compact />);
    fireEvent.click(screen.getByRole("button", { name: /Ta ligue : Fer IV/ }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(
      dialog.getByRole("heading", { name: "Gardien des Ronces" }),
    ).toBeTruthy();
    expect(
      dialog.getByRole("button", { name: /^Bronze III 1\s000$/ }),
    ).toBeTruthy();
    expect(
      dialog.getByRole("region", { name: "Ta progression" }).textContent,
    ).toContain("Deck : 6 cartes max.");
    fireEvent.click(dialog.getByRole("button", { name: /^Bronze IV,/ }));
    const details = within(
      dialog.getByRole("region", {
        name: "Détails du palier sélectionné",
      }),
    );
    expect(details.getByText("PALIER ATTEINT")).toBeTruthy();
    expect(details.getByText(/Palier débloqué/)).toBeTruthy();
    expect(details.queryByText(/À débloquer/)).toBeNull();
  });

  it("shows earned trophies and the next league after promotion", () => {
    render(
      <LeagueResult
        reward={{ trophies: 25, trophiesTotal: 200, previousTrophies: 175 }}
      />,
    );
    expect(screen.getByLabelText("+25 trophées")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Fer III" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Fer II" })).toBeTruthy();
    const progress = screen.getByRole("progressbar", {
      name: "Progression vers Fer II",
    });
    expect(progress.getAttribute("aria-valuenow")).toBe("0");
    expect(progress.getAttribute("aria-valuetext")).toBe(
      "200 trophées, 200 avant Fer II",
    );
  });

  it("shows the actual loss and demotion with the next promotion in sight", () => {
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
    expect(screen.getByText("Rétrogradation")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Fer IV" })).toBeTruthy();
    expect(screen.getByLabelText("−15 trophées")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe(
      "185 trophées, 15 avant Fer III",
    );
  });

  it("shows the zero trophy floor without redundant explanations", () => {
    render(
      <LeagueResult
        reward={{ trophies: 0, previousTrophies: 0, trophiesTotal: 0 }}
      />,
    );
    expect(screen.getByLabelText("0 trophées")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "0",
    );
    expect(screen.queryByText("Tu es déjà à zéro trophée.")).toBeNull();
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
