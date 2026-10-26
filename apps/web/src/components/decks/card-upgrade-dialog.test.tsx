import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CARD_VARIANTS, resolveCard, type OwnedCard } from "@sylve/game";
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

function setup({
  entry = starter,
  soulProgress = readyProgress,
  collection = owned,
} = {}) {
  const actions = {
    onUpgrade: vi.fn().mockResolvedValue(undefined),
    onSoulbind: vi.fn().mockResolvedValue(undefined),
    onSacrifice: vi.fn().mockResolvedValue(undefined),
    onEvolve: vi.fn().mockResolvedValue(undefined),
  };
  const view = (current: OwnedCard | undefined = entry, readOnly = false) => (
    <GoldContext.Provider value={10000}>
      {readOnly ? (
        <CardUpgradeDialog entry={current} readOnly onClose={vi.fn()} />
      ) : (
        <CardUpgradeDialog
          entry={current}
          onClose={vi.fn()}
          collection={collection}
          soulProgress={soulProgress}
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
    expect(
      screen.getByText(
        "Après conversion : 25 exemplaires en réserve · 10020 poussières d’âme.",
      ),
    ).toBeTruthy();
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

  it("explains locked evolution while leaving dust conversion available", () => {
    setup({
      soulProgress: { ...readyProgress, evolutionUnlocked: false },
      collection: [starter],
    });
    openTab(/^Évolution et poussière/);
    expect(screen.getByText("Débloqué en ligue Or IV")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: /Évoluer vers/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      screen.getByText(
        "Découvre cette forme dans ta collection pour l’obtenir par évolution.",
      ),
    ).toBeTruthy();
    chooseDust();
    expect(
      (
        screen.getByRole("button", {
          name: "Convertir 50 exemplaires en 10 poussières",
        }) as HTMLButtonElement
      ).disabled,
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
