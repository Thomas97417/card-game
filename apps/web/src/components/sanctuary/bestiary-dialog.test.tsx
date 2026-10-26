import type { ReactNode } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CATALOG, cardsOfRarity, variantCard } from "@sylve/game";
import { BestiaryDialog } from "./bestiary-dialog";
import { selectOption } from "@/test-select";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

async function openBestiary() {
  render(<BestiaryDialog />);
  fireEvent.click(screen.getByRole("button", { name: "Bestiaire" }));
  return screen.findByRole("dialog", { name: "Le bestiaire" });
}

describe("Bestiary navigation", () => {
  it("shares the preview level between gallery sliders, card details and the shadcn select", async () => {
    const dialog = await openBestiary();
    const gallerySlider = within(dialog).getByRole("slider");
    fireEvent.change(gallerySlider, { target: { value: "8" } });
    expect(within(dialog).getAllByText("Niv. 8")).toHaveLength(
      cardsOfRarity("common").length,
    );
    expect(
      within(dialog).getByRole("combobox", { name: "Niveau de la carte" })
        .textContent,
    ).toContain("Niveau 8");
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: `Découvrir ${CATALOG[0]!.name}`,
      }),
    );
    expect((within(dialog).getByRole("slider") as HTMLInputElement).value).toBe(
      "8",
    );
    await selectOption("Niveau de la carte", "Niveau 11");
    expect((within(dialog).getByRole("slider") as HTMLInputElement).value).toBe(
      "11",
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Tout le bestiaire" }),
    );
    expect(within(dialog).getAllByText("Niv. 11")).toHaveLength(
      cardsOfRarity("common").length,
    );
    expect((within(dialog).getByRole("slider") as HTMLInputElement).value).toBe(
      "11",
    );
    await selectOption("Niveau de la carte", "Niveau 3");
    expect(within(dialog).getAllByText("Niv. 3")).toHaveLength(
      cardsOfRarity("common").length,
    );
    expect((within(dialog).getByRole("slider") as HTMLInputElement).value).toBe(
      "3",
    );
  });

  it("clamps gallery levels when changing rarity and closes the level menu with Escape without closing the bestiary", async () => {
    const dialog = await openBestiary();
    await selectOption("Rareté de la carte", "Légendaire");
    await selectOption("Niveau de la carte", "Niveau 26");
    expect((within(dialog).getByRole("slider") as HTMLInputElement).value).toBe(
      "26",
    );
    expect(
      within(
        within(dialog).getByRole("button", {
          name: "Découvrir Totem de l’aurore",
        }),
      ).getByText("Niv. 26"),
    ).toBeTruthy();
    await selectOption("Rareté de la carte", "Commune");
    expect((within(dialog).getByRole("slider") as HTMLInputElement).value).toBe(
      "26",
    );
    expect(within(dialog).getAllByText("Niv. 26")).toHaveLength(
      cardsOfRarity("common").length,
    );
    const trigger = within(dialog).getByRole("combobox", {
      name: "Niveau de la carte",
    });
    fireEvent.click(trigger);
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option")).toHaveLength(26);
    expect(
      within(listbox).queryByRole("option", { name: "Niveau 31" }),
    ).toBeNull();
    fireEvent.keyDown(
      within(listbox).getByRole("option", { name: "Niveau 26" }),
      { key: "Escape" },
    );
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(screen.getByRole("dialog", { name: "Le bestiaire" })).toBe(dialog);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("jumps to the evolution section and can reopen the current form's information", async () => {
    const dialog = await openBestiary();
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: `Découvrir ${CATALOG[0]!.name}`,
      }),
    );
    const heading = within(dialog).getByRole("heading", {
      name: "Ses évolutions",
    });
    const scrollIntoView = vi.fn();
    heading.scrollIntoView = scrollIntoView;
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Voir ses évolutions" }),
    );
    expect(document.activeElement).toBe(heading);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    const scroller = dialog.querySelector(".bestiary-scroll")!;
    scroller.scrollTop = 400;
    fireEvent.click(
      within(dialog).getByRole("button", { name: /^Voir la forme commune/ }),
    );
    expect(scroller.scrollTop).toBe(0);
    expect(document.activeElement).toBe(
      within(dialog).getByRole("heading", { name: CATALOG[0]!.name }),
    );
  });

  it("opens details in the same dialog and restores the gallery position and keyboard focus", async () => {
    const dialog = await openBestiary();
    const scroller = dialog.querySelector(".bestiary-scroll")!;
    scroller.scrollTop = 240;
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: `Découvrir ${CATALOG[0]!.name}`,
      }),
    );
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(document.activeElement).toBe(
      within(dialog).getByRole("heading", { name: CATALOG[0]!.name }),
    );
    expect(
      (
        within(dialog).getByRole("button", {
          name: "Créature précédente",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Créature suivante" }),
    );
    expect(
      within(dialog).getByRole("heading", { name: CATALOG[1]!.name }),
    ).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Créature précédente" }),
    );
    expect(
      within(dialog).getByRole("heading", { name: CATALOG[0]!.name }),
    ).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Créature suivante" }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Tout le bestiaire" }),
    );
    expect(dialog.querySelector(".bestiary-scroll")!.scrollTop).toBe(240);
    expect(document.activeElement).toBe(
      within(dialog).getByRole("button", {
        name: `Découvrir ${CATALOG[0]!.name}`,
      }),
    );
    expect(
      within(dialog).getAllByRole("button", { name: /^Découvrir / }),
    ).toHaveLength(cardsOfRarity("common").length);
  });

  it("searches every evolution name without accents and keeps the search on return", async () => {
    const dialog = await openBestiary();
    const legendaryName = variantCard(CATALOG[0]!.id, "legendary").name;
    const query = legendaryName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
    fireEvent.change(within(dialog).getByRole("searchbox"), {
      target: { value: query },
    });
    expect(
      within(dialog).getAllByRole("button", { name: /^Découvrir / }),
    ).toHaveLength(1);
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: `Découvrir ${CATALOG[0]!.name}`,
      }),
    );
    expect(
      (
        within(dialog).getByRole("button", {
          name: "Créature suivante",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(
      within(dialog).getByRole("button", { name: /^Voir la forme légendaire/ }),
    );
    expect(
      within(dialog).getByRole("heading", { name: legendaryName }),
    ).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Tout le bestiaire" }),
    );
    expect(
      (within(dialog).getByRole("searchbox") as HTMLInputElement).value,
    ).toBe(query);
    expect(
      within(dialog).getByRole("combobox", { name: "Rareté de la carte" })
        .textContent,
    ).toContain("Légendaire");
    expect(
      within(dialog).getByRole("button", {
        name: `Découvrir ${legendaryName}`,
      }),
    ).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Effacer la recherche" }),
    );
    expect(
      within(dialog).getAllByRole("button", { name: /^Découvrir / }),
    ).toHaveLength(CATALOG.length);
  });

  it("filters the CW building forms and recovers from an empty search", async () => {
    const dialog = await openBestiary();
    await selectOption("Rareté de la carte", "Rare");
    fireEvent.click(within(dialog).getByRole("button", { name: "Bâtiments" }));
    expect(
      within(dialog).getAllByRole("button", { name: /^Découvrir / }),
    ).toHaveLength(1);
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Découvrir Totem des couronnes",
      }),
    );
    expect(
      (
        within(dialog).getByRole("button", {
          name: "Créature suivante",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Tout le bestiaire" }),
    );
    fireEvent.change(within(dialog).getByRole("searchbox"), {
      target: { value: "introuvable" },
    });
    expect(
      within(dialog).getByRole("heading", { name: "Aucun compagnon trouvé" }),
    ).toBeTruthy();
    expect(within(dialog).getByRole("status").textContent).toBe("0 créatures");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Réinitialiser les filtres" }),
    );
    expect(
      within(dialog).getAllByRole("button", { name: /^Découvrir / }),
    ).toHaveLength(22);
  });

  it("updates level previews and clamps a legendary creature to a building's cap during navigation", async () => {
    const dialog = await openBestiary();
    await selectOption("Rareté de la carte", "Légendaire");
    const buildingIndex = CATALOG.findIndex((card) => card.id === "idol");
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: `Découvrir ${variantCard(CATALOG[buildingIndex - 1]!.id, "legendary").name}`,
      }),
    );
    const levels = within(dialog).getByRole("combobox", {
      name: "Niveau de la carte",
    });
    fireEvent.change(
      within(dialog).getByRole("slider", { name: "Parcourir les niveaux" }),
      { target: { value: "26" } },
    );
    expect(levels.textContent).toContain("Niveau 26");
    expect(
      (
        within(dialog).getByRole("button", {
          name: "Niveau suivant",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Créature suivante" }),
    );
    expect(levels.textContent).toContain("Niveau 26");
    expect(within(dialog).getByRole("slider").getAttribute("max")).toBe("26");
    expect(
      within(dialog).getByRole("heading", {
        name: variantCard("idol", "legendary").name,
      }),
    ).toBeTruthy();
    const healthStat = within(dialog).getAllByRole("definition")[1]!;
    expect(healthStat.textContent).toBe(
      String(variantCard("idol", "legendary", 26).health),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Niveau précédent" }),
    );
    expect(levels.textContent).toContain("Niveau 25");
    expect(
      within(healthStat).getByText(
        `+${variantCard("idol", "legendary", 26).health - variantCard("idol", "legendary", 25).health} au niv. 26`,
      ),
    ).toBeTruthy();
  });

  it("opens the next ability level in a dismissible preview and clears it when changing level", async () => {
    const dialog = await openBestiary();
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: `Découvrir ${variantCard("lynx", "common").name}`,
      }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: /^Voir la forme épique/ }),
    );
    fireEvent.change(within(dialog).getByRole("slider"), {
      target: { value: "20" },
    });
    const ability = variantCard("lynx", "epic", 21).abilities![0]!;
    const trigger = within(dialog).getByRole("button", {
      name: `Voir ${ability.name} au niveau 21`,
    });
    fireEvent.click(trigger);
    const preview = await screen.findByRole("dialog", {
      name: `${ability.name} · niveau 21`,
    });
    expect(within(preview).getByText(ability.description)).toBeTruthy();
    fireEvent.keyDown(preview, { key: "Escape" });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", {
          name: `${ability.name} · niveau 21`,
        }),
      ).toBeNull(),
    );
    expect(screen.getByRole("dialog", { name: /Lame du haut conseil/ })).toBe(
      dialog,
    );
    fireEvent.click(trigger);
    await screen.findByRole("dialog", {
      name: `${ability.name} · niveau 21`,
    });
    fireEvent.change(within(dialog).getByRole("slider"), {
      target: { value: "21" },
    });
    await waitFor(() => expect(screen.getAllByRole("dialog")).toHaveLength(1));
    expect(within(dialog).getByText(ability.description)).toBeTruthy();
  });

  it("closes with Escape, restores trigger focus and reopens on the gallery", async () => {
    const dialog = await openBestiary();
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: `Découvrir ${CATALOG[0]!.name}`,
      }),
    );
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Bestiaire" }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Bestiaire" }));
    expect(
      await screen.findByRole("dialog", { name: "Le bestiaire" }),
    ).toBeTruthy();
  });
});
