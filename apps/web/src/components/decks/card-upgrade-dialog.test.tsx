import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  CARD_VARIANTS,
  resolveCard,
  upgradeCost,
  type OwnedCard,
} from "@sylve/game";
import { GoldContext } from "@/components/gold-balance";
import { CardUpgradeDialog } from "./card-upgrade-dialog";
import type { SoulProgressView } from "./card-soulbind";

const readyProgress: SoulProgressView = {
  rank: 1000,
  soulDust: 10000,
  unlocked: true,
  evolutionUnlocked: true,
  earned: 10,
  required: 50,
};
const owned = CARD_VARIANTS.map((card) => ({
  card: resolveCard(card.id, 26),
  copies: 100,
}));
const starter: OwnedCard = {
  card: resolveCard("guardian:common"),
  copies: 100,
};

function setup(
  options: {
    entry?: OwnedCard;
    soulProgress?: SoulProgressView;
    collection?: OwnedCard[];
  } = {},
) {
  const entry = options.entry ?? starter;
  const soulProgress =
    "soulProgress" in options ? options.soulProgress : readyProgress;
  const collection = options.collection ?? owned;
  const actions = {
    onUpgrade: vi.fn().mockResolvedValue(undefined),
    onSoulbind: vi.fn().mockResolvedValue(undefined),
    onSacrifice: vi.fn().mockResolvedValue(undefined),
    onEvolve: vi.fn().mockResolvedValue(undefined),
  };
  const view = (
    current: OwnedCard | undefined = entry,
    readOnly = false,
    progress = soulProgress,
    entries = collection,
  ) => (
    <GoldContext.Provider value={10000}>
      {readOnly ? (
        <CardUpgradeDialog entry={current} readOnly onClose={vi.fn()} />
      ) : (
        <CardUpgradeDialog
          entry={current}
          onClose={vi.fn()}
          collection={entries}
          soulProgress={progress}
          {...actions}
        />
      )}
    </GoldContext.Provider>
  );
  return { ...render(view()), ...actions, view };
}

const openTab = (name: RegExp) =>
  fireEvent.click(screen.getByRole("tab", { name }));
const chooseDust = () =>
  fireEvent.click(screen.getByRole("button", { name: "Poussière d’âme" }));

describe("card dialog navigation", () => {
  it("opens a required companion at its owned level, upgrades it and returns to the selected link with refreshed prerequisites", async () => {
    const entry = { card: resolveCard("guardian:legendary"), copies: 34 };
    const companion = { card: resolveCard("knight:legendary", 2), copies: 50 };
    const collection = owned.map((item) =>
      item.card.id === companion.card.id ? companion : item,
    );
    const { rerender, view, onUpgrade } = setup({ entry, collection });
    openTab(/^Liens d’âme/);
    fireEvent.click(
      screen.getByRole("button", { name: "Afficher le lien d’âme II" }),
    );
    expect(
      (
        screen.getByRole("button", {
          name: /Activer le lien II/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    const trigger = screen.getByRole("button", {
      name: `Ouvrir la fiche de ${companion.card.name}`,
    });
    fireEvent.click(trigger);
    const child = within(
      await screen.findByRole("dialog", { name: companion.card.name }),
    );
    expect(
      child.getByRole("tab", { name: /^Amélioration Niveau 2/ }),
    ).toBeTruthy();
    const upgrade = child.getByRole("button", {
      name: "Améliorer au niveau 3",
    });
    expect((upgrade as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(upgrade);
    await waitFor(() =>
      expect(onUpgrade).toHaveBeenCalledExactlyOnceWith(companion.card.id),
    );

    rerender(
      view(
        entry,
        false,
        readyProgress,
        collection.map((item) =>
          item.card.id === companion.card.id
            ? {
                card: resolveCard(companion.card.id, 3),
                copies: companion.copies - upgradeCost(2, "legendary"),
              }
            : item,
        ),
      ),
    );
    expect(
      child.getByRole("tab", { name: /^Amélioration Niveau 3/ }),
    ).toBeTruthy();
    fireEvent.click(
      child.getByRole("button", { name: "Retour aux liens d’âme" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: companion.card.name }),
      ).toBeNull(),
    );
    expect(
      screen
        .getByRole("button", { name: "Afficher le lien d’âme II" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      (
        screen.getByRole("button", {
          name: /Activer le lien II/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("keeps an undiscovered required companion read-only and closes only its sheet on Escape", async () => {
    const entry = { card: resolveCard("guardian:legendary"), copies: 34 };
    const { onUpgrade } = setup({ entry, collection: [entry] });
    openTab(/^Liens d’âme/);
    const companion = resolveCard("owl:legendary");
    const trigger = screen.getByRole("button", {
      name: `Ouvrir la fiche de ${companion.name}`,
    });
    fireEvent.click(trigger);
    const child = await screen.findByRole("dialog", { name: companion.name });
    expect(
      within(child).queryByRole("button", { name: /Améliorer/ }),
    ).toBeNull();
    expect(
      within(child).getByRole("tab", { name: /^Caractéristiques/ }),
    ).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(child));
    fireEvent.keyDown(child, { key: "Escape", code: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: companion.name })).toBeNull(),
    );
    expect(screen.getByRole("dialog", { name: entry.card.name })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Lien d’âme I" })).toBeTruthy();
    expect(onUpgrade).not.toHaveBeenCalled();
  });

  it.each([
    {
      soulProgress: { ...readyProgress, unlocked: false },
      label: "Bronze IV requis",
    },
    { soulProgress: undefined, label: "Chargement…" },
  ])(
    "locks both progression menus while showing $label",
    async ({ soulProgress, label }) => {
      const { rerender, view, onSoulbind, onSacrifice, onEvolve } = setup({
        soulProgress,
      });
      const overview = screen.getByRole("tab", { name: /^Amélioration/ });
      for (const name of [/^Liens d’âme/, /^Évolution et poussière/]) {
        const tab = screen.getByRole("tab", { name }) as HTMLButtonElement;
        expect(tab.getAttribute("aria-disabled")).toBe("true");
        expect(tab.textContent).toContain(label);
        fireEvent.click(tab);
        expect(overview.getAttribute("aria-selected")).toBe("true");
      }
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole("dialog")),
      );
      act(() => overview.focus());
      fireEvent.keyDown(overview, { key: "ArrowDown" });
      expect(overview.getAttribute("aria-selected")).toBe("true");
      expect(document.activeElement).toBe(overview);
      expect(screen.queryByRole("region", { name: "Liens d’âme" })).toBeNull();
      expect(
        screen.queryByRole("region", { name: "Évolution et poussière" }),
      ).toBeNull();
      expect(onSoulbind).not.toHaveBeenCalled();
      expect(onSacrifice).not.toHaveBeenCalled();
      expect(onEvolve).not.toHaveBeenCalled();

      rerender(view(starter, false, readyProgress));
      for (const name of [/^Liens d’âme/, /^Évolution et poussière/]) {
        expect(
          screen.getByRole("tab", { name }).getAttribute("aria-disabled"),
        ).not.toBe("true");
        openTab(name);
      }
      expect(
        screen.getByRole("region", { name: "Évolution et poussière" }),
      ).toBeTruthy();
    },
  );

  it.each([/^Liens d’âme/, /^Évolution et poussière/])(
    "returns to improvement when the open progression menu becomes locked: %s",
    (name) => {
      const { rerender, view } = setup();
      openTab(name);
      rerender(view(starter, false, { ...readyProgress, unlocked: false }));
      expect(
        screen
          .getByRole("tab", { name: /^Amélioration/ })
          .getAttribute("aria-selected"),
      ).toBe("true");
      expect(
        screen.getByRole("region", { name: "Caractéristiques" }),
      ).toBeTruthy();
      expect(screen.queryByRole("region", { name: "Liens d’âme" })).toBeNull();
      expect(
        screen.queryByRole("region", { name: "Évolution et poussière" }),
      ).toBeNull();
    },
  );

  it("switches the central content, keeps a selected link when returning, and resets for another card", async () => {
    const { rerender, view, onSoulbind } = setup();
    expect(
      await screen.findByRole("region", { name: "Caractéristiques" }),
    ).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Lien d’âme I" })).toBeNull();

    openTab(/^Liens d’âme/);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Afficher le lien d’âme IV",
      }),
    );
    const fourth = within(
      screen.getByRole("region", { name: "Lien d’âme IV" }),
    );
    fireEvent.click(fourth.getByRole("button", { name: /Activer le lien IV/ }));
    await waitFor(() =>
      expect(onSoulbind).toHaveBeenCalledWith("guardian:common", 4),
    );

    openTab(/^Évolution et poussière/);
    chooseDust();
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Nombre de lots" }),
      { target: { value: "2" } },
    );
    openTab(/^Liens d’âme/);
    expect(screen.getByRole("region", { name: "Lien d’âme IV" })).toBeTruthy();
    openTab(/^Évolution et poussière/);
    expect(
      (
        screen.getByRole("spinbutton", {
          name: "Nombre de lots",
        }) as HTMLInputElement
      ).value,
    ).toBe("2");

    rerender(view({ card: resolveCard("guardian:rare"), copies: 40 }));
    expect(
      screen
        .getByRole("tab", { name: /^Amélioration/ })
        .getAttribute("aria-selected"),
    ).toBe("true");
    openTab(/^Liens d’âme/);
    expect(screen.getByRole("region", { name: "Lien d’âme I" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Lien d’âme IV" })).toBeNull();
  });

  it.each([
    { compact: false, key: "ArrowDown", orientation: "vertical" },
    { compact: true, key: "ArrowRight", orientation: "horizontal" },
  ])(
    "supports keyboard navigation with a $orientation menu",
    async ({ compact, key, orientation }) => {
      vi.mocked(window.matchMedia).mockImplementation((query) => ({
        matches: query === "(max-width: 900px)" && compact,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: () => true,
      }));
      setup();
      const tabs = screen.getByRole("tablist", {
        name: "Sections de la carte",
      });
      expect(tabs.getAttribute("aria-orientation") ?? "horizontal").toBe(
        orientation,
      );
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole("dialog")),
      );
      const overview = screen.getByRole("tab", { name: /^Amélioration/ });
      act(() => overview.focus());
      fireEvent.keyDown(overview, { key });
      await waitFor(() =>
        expect(
          screen
            .getByRole("tab", { name: /^Liens d’âme/ })
            .getAttribute("aria-selected"),
        ).toBe("true"),
      );
      expect(document.activeElement).toBe(
        screen.getByRole("tab", { name: /^Liens d’âme/ }),
      );
      expect(screen.getByRole("region", { name: "Lien d’âme I" })).toBeTruthy();
    },
  );

  it("keeps a pending activation disabled across navigation without spending twice", async () => {
    const { onSoulbind } = setup();
    let finish!: () => void;
    onSoulbind.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    openTab(/^Liens d’âme/);
    fireEvent.click(
      screen.getByRole("button", { name: /Activer le lien I Gratuit/ }),
    );
    openTab(/^Évolution et poussière/);
    openTab(/^Liens d’âme/);
    expect(
      (screen.getByRole("button", { name: /Activation…/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Activation…/ }));
    expect(onSoulbind).toHaveBeenCalledOnce();
    await act(async () => finish());
    expect(
      (
        screen.getByRole("button", {
          name: /Activer le lien I Gratuit/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("keeps the read-only card view free of progression actions", () => {
    const { rerender, view } = setup();
    rerender(view(starter, true));
    expect(
      screen.queryByRole("tab", { name: /^Évolution et poussière/ }),
    ).toBeNull();
    openTab(/^Liens d’âme/);
    expect(screen.getByText("Activation gratuite")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Activer le lien/ }),
    ).toBeNull();
    expect(screen.queryByLabelText("Progression des liens d’âme")).toBeNull();
  });
});

describe("resource exchange preview", () => {
  it("previews the maximum conversion and updates the quantity when reserves change", async () => {
    const { rerender, view, onSacrifice } = setup({
      entry: { ...starter, copies: 125 },
    });
    openTab(/^Évolution et poussière/);
    chooseDust();
    fireEvent.click(screen.getByRole("button", { name: "Maximum" }));
    const preview = within(screen.getByLabelText("Aperçu de la conversion"));
    expect(preview.getByText("100")).toBeTruthy();
    expect(preview.getByText("20")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Convertir 100 exemplaires en 20 poussières",
      }),
    );
    await waitFor(() =>
      expect(onSacrifice).toHaveBeenCalledWith("guardian:common", 2),
    );

    rerender(view({ ...starter, copies: 25 }));
    expect(
      (
        screen.getByRole("spinbutton", {
          name: "Nombre de lots",
        }) as HTMLInputElement
      ).value,
    ).toBe("1");
    expect(
      (
        screen.getByRole("button", {
          name: /Convertir 0 exemplaires/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      screen.getByText(
        "Encore 25 exemplaires nécessaires pour convertir un lot.",
      ),
    ).toBeTruthy();
  });

  it.each(["0", "1.5", "-1", "3"])(
    "prevents an invalid quantity %s from consuming reserves",
    (value) => {
      const { onSacrifice } = setup();
      openTab(/^Évolution et poussière/);
      chooseDust();
      fireEvent.change(
        screen.getByRole("spinbutton", { name: "Nombre de lots" }),
        { target: { value } },
      );
      const convert = screen.getByRole("button", {
        name: /Convertir 0 exemplaires/,
      });
      expect((convert as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(convert);
      expect(onSacrifice).not.toHaveBeenCalled();
      expect(
        screen.getByText("Choisis un nombre entier de lots entre 1 et 2."),
      ).toBeTruthy();
    },
  );

  it("shows a locked-feature preview until evolution unlocks while leaving dust conversion available", () => {
    const { rerender, view, onEvolve } = setup({
      soulProgress: { ...readyProgress, evolutionUnlocked: false },
      collection: [starter],
    });
    openTab(/^Évolution et poussière/);
    const lock = within(
      screen.getByRole("note", { name: "Évolutions verrouillées" }),
    );
    expect(
      lock.getByRole("heading", { name: "Évolutions verrouillées" }),
    ).toBeTruthy();
    expect(lock.getByRole("img", { name: "Or IV" })).toBeTruthy();
    expect(
      lock.getByText(
        "Atteins la ligue Or IV pour faire évoluer tes exemplaires.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Aperçu après déblocage")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Évoluer vers/ })).toBeNull();
    expect(onEvolve).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Gardien des remparts" }),
    ).toBeTruthy();
    chooseDust();
    expect(
      (
        screen.getByRole("button", {
          name: "Convertir 50 exemplaires en 10 poussières",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);

    rerender(view(starter, false, readyProgress, owned));
    fireEvent.click(screen.getByRole("button", { name: "Évolution" }));
    expect(
      screen.queryByRole("note", { name: "Évolutions verrouillées" }),
    ).toBeNull();
    expect(screen.queryByText("Aperçu après déblocage")).toBeNull();
    expect(
      (screen.getByRole("button", { name: /Évoluer vers/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("opens dust for a final form and explains why no further evolution exists", () => {
    setup({ entry: { card: resolveCard("guardian:legendary"), copies: 1 } });
    openTab(/^Évolution et poussière/);
    expect(
      screen.getByRole("button", {
        name: "Convertir 1 exemplaire en 10 poussières",
      }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Évolution" }));
    expect(
      screen.getByText("Cette carte a atteint sa forme finale"),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Évoluer vers/ })).toBeNull();
  });
});
