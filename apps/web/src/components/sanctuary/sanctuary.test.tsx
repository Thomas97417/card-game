import type { ReactNode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CATALOG, resolveCard, variantCard } from "@sylve/game";
import {
  summonLoot,
  summonPrice,
  type SummonResult,
} from "@sylve/game/summoning";
import { Sanctuary, type SummonRequest } from "./sanctuary";
import { GoldContext } from "@/components/gold-balance";
import { EmeraldContext } from "@/components/emerald-balance";
import { selectOption } from "@/test-select";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

function reward(request: SummonRequest): SummonResult {
  return {
    ...request,
    cost: summonPrice(request.packId, request.count),
    reveals: summonLoot(request.packId, request.count, () => 0).map(
      (item, index) => ({
        ...item,
        isNew: index === 0,
        level: 1,
        copies: index,
      }),
    ),
  };
}
function setup(overrides: Partial<Parameters<typeof Sanctuary>[0]> = {}) {
  const onSummon = vi.fn(async (request: SummonRequest) => reward(request));
  const onUpgrade = vi.fn().mockResolvedValue(undefined);
  const onUnlockChestSlot = vi.fn().mockResolvedValue(undefined);
  const props = {
    emeralds: 3_000,
    ready: true,
    collection: undefined,
    onSummon,
    onUpgrade,
    onUnlockChestSlot,
    ...overrides,
  };
  const result = render(
    <GoldContext.Provider value={500}>
      <EmeraldContext.Provider value={props.emeralds}>
        <Sanctuary {...props} />
      </EmeraldContext.Provider>
    </GoldContext.Provider>,
  );
  return { ...result, onSummon, onUpgrade, onUnlockChestSlot };
}
const purchase = (pack: "Sylve" | "anciens", count: 1 | 10) =>
  screen.getByRole("button", {
    name: new RegExp(
      `^Invoquer ${count} fois — Appel ${pack === "Sylve" ? "de la Sylve" : "des anciens"},`,
    ),
  }) as HTMLButtonElement;

describe("le sanctuaire", () => {
  it("offers three unique keys and unlocks a slot once without invoking cards", async () => {
    const { onUnlockChestSlot, onSummon } = setup();
    const keys = screen.getByRole("region", { name: "Clés de coffre" });
    expect(within(keys).getAllByRole("article")).toHaveLength(3);
    const buy = within(keys).getByRole("button", { name: /emplacement 7 —/ });
    fireEvent.click(buy);
    fireEvent.click(buy);
    await waitFor(() =>
      expect(onUnlockChestSlot).toHaveBeenCalledExactlyOnceWith(5),
    );
    expect(
      (
        (await screen.findByRole("button", {
          name: "Emplacement 7 déjà débloqué",
        })) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      screen.getByText("L’emplacement 7 est débloqué pour toujours."),
    ).toBeTruthy();
    expect(onSummon).not.toHaveBeenCalled();
  });
  it("shows saved unlocks and blocks keys without enough emeralds", () => {
    const { onUnlockChestSlot } = setup({
      emeralds: 500,
      purchasedChestSlots: [6],
    });
    const keys = screen.getByRole("region", { name: "Clés de coffre" });
    expect(
      (
        within(keys).getByRole("button", {
          name: /emplacement 7 —/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(
      (
        within(keys).getByRole("button", {
          name: "Emplacement 8 déjà débloqué",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    const expensive = within(keys).getByRole("button", {
      name: /emplacement 9 —/,
    });
    expect((expensive as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(expensive);
    expect(onUnlockChestSlot).not.toHaveBeenCalled();
  });
  it("locks invocations during a key purchase and lets a failed purchase be retried", async () => {
    let reject!: (reason: Error) => void;
    const onUnlockChestSlot = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, fail) => {
            reject = fail;
          }),
      )
      .mockResolvedValue(undefined);
    setup({ onUnlockChestSlot });
    const buy = screen.getByRole("button", { name: /emplacement 7 —/ });
    fireEvent.click(buy);
    expect(purchase("Sylve", 1).disabled).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: /emplacement 8 —/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await act(async () => reject(new Error("Network unavailable")));
    expect(await screen.findByRole("alert")).toBeTruthy();
    fireEvent.click(buy);
    await screen.findByRole("button", { name: "Emplacement 7 déjà débloqué" });
    expect(onUnlockChestSlot).toHaveBeenCalledTimes(2);
  });
  it("shows both balances, explicit rates and batch guarantees, and links to the hub and collection", () => {
    setup();
    expect(
      screen
        .getByRole("status", { name: "Solde d’émeraudes" })
        .querySelector("img")
        ?.getAttribute("src"),
    ).toBe("/art/ui/emerald.webp");
    expect(
      screen.getByRole("status", { name: "Solde de pièces d’or" }),
    ).toBeTruthy();
    expect(screen.getByText("2 %")).toBeTruthy();
    expect(screen.getByText("20 %")).toBeTruthy();
    expect(
      within(purchase("Sylve", 10)).getByText("1 légendaire garanti"),
    ).toBeTruthy();
    expect(
      within(purchase("anciens", 10)).getByText("2 légendaires garantis"),
    ).toBeTruthy();
    expect(
      within(purchase("Sylve", 10)).getByText("1 tirage gratuit"),
    ).toBeTruthy();
    expect(
      within(purchase("anciens", 10)).getByText("1 tirage gratuit"),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Retour au refuge" })
        .getAttribute("href"),
    ).toBe("/hub");
    expect(
      screen.getByRole("link", { name: "Ma collection" }).getAttribute("href"),
    ).toBe("/decks");
  });

  it("blocks unaffordable purchases while allowing exactly affordable singles", () => {
    setup({ emeralds: 149 });
    expect(purchase("Sylve", 1).disabled).toBe(false);
    expect(purchase("Sylve", 10).disabled).toBe(true);
    expect(purchase("anciens", 1).disabled).toBe(true);
    expect(purchase("anciens", 10).disabled).toBe(true);
    expect(screen.queryByText(/Émeraudes insuffisantes/)).toBeNull();
  });

  it.each([undefined, null, 0])(
    "does not purchase with a loading, absent or empty wallet (%s)",
    (emeralds) => {
      const { onSummon } = setup({ emeralds });
      for (const button of screen.getAllByRole("button", {
        name: /^Invoquer/,
      })) {
        expect((button as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(button);
      }
      expect(onSummon).not.toHaveBeenCalled();
    },
  );

  it("sends one batch purchase, locks every pack while waiting and reveals all ten cards", async () => {
    let finish!: (result: SummonResult) => void;
    const onSummon = vi.fn(
      (_request: SummonRequest) =>
        new Promise<SummonResult>((resolve) => {
          finish = resolve;
        }),
    );
    setup({ onSummon, emeralds: 3_899 });
    fireEvent.click(purchase("anciens", 10));
    fireEvent.click(purchase("anciens", 10));
    fireEvent.click(purchase("Sylve", 1));
    expect(onSummon).toHaveBeenCalledOnce();
    const request = onSummon.mock.calls[0]![0];
    expect(request).toMatchObject({ packId: "ancients", count: 10 });
    expect(request.requestId.length).toBeGreaterThan(15);
    for (const button of screen.getAllByRole("button", { name: /^Invoquer/ }))
      expect((button as HTMLButtonElement).disabled).toBe(true);
    await act(async () => finish(reward(request)));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Dernières invocations" }),
    ).toBeTruthy();
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(10);
    expect(within(dialog).getAllByText("Légendaire")).toHaveLength(2);
    expect(within(dialog).getByText("Nouvelle carte")).toBeTruthy();
    expect(within(dialog).getAllByText("+1 exemplaire")).toHaveLength(9);
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Continuer à invoquer" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(purchase("anciens", 10).disabled).toBe(false);
  });

  it("reuses the request identifier after a failed response to prevent a second debit", async () => {
    const onSummon = vi
      .fn<(request: SummonRequest) => Promise<SummonResult>>()
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockImplementation(async (request) => reward(request));
    setup({ onSummon });
    fireEvent.click(purchase("Sylve", 1));
    expect(await screen.findByRole("alert")).toBeTruthy();
    fireEvent.click(purchase("Sylve", 1));
    await screen.findByRole("dialog");
    expect(onSummon).toHaveBeenCalledTimes(2);
    expect(onSummon.mock.calls[0]![0]).toEqual(onSummon.mock.calls[1]![0]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("can revisit the saved last batch without purchasing it again", async () => {
    const latest = reward({
      packId: "sylve",
      count: 10,
      requestId: "saved-summon-request",
    });
    const { onSummon } = setup({ latest, emeralds: 0 });
    fireEvent.click(
      screen.getByRole("button", { name: "Dernière invocation" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(10);
    expect(onSummon).not.toHaveBeenCalled();
  });

  it("opens each summoned variant and returns to the batch when its details are closed", async () => {
    const latest = reward({
      packId: "ancients",
      count: 10,
      requestId: "saved-summon-request",
    });
    const { onSummon } = setup({ latest });
    fireEvent.click(
      screen.getByRole("button", { name: "Dernière invocation" }),
    );
    const reveal = await screen.findByRole("dialog");
    const items = within(reveal).getAllByRole("listitem");

    for (const index of [0, 9]) {
      const card = resolveCard(latest.reveals[index]!.variantId);
      const trigger = within(items[index]!).getByRole("button");
      expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
      fireEvent.click(trigger);
      const details = await screen.findByRole("dialog", { name: card.name });
      expect(within(details).getByText(card.title)).toBeTruthy();
      expect(
        within(details).getByRole("region", { name: "Caractéristiques" }),
      ).toBeTruthy();
      expect(
        within(details).queryByRole("complementary", {
          name: "Actions du deck",
        }),
      ).toBeNull();
      fireEvent.click(
        within(details).getByRole("button", { name: "Fermer la fenêtre" }),
      );
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: card.name })).toBeNull(),
      );
      expect(within(reveal).getAllByRole("listitem")).toHaveLength(10);
    }
    expect(onSummon).not.toHaveBeenCalled();
  });

  it("uses the current collection level and copies and upgrades the inspected variant", async () => {
    const latest = reward({
      packId: "sylve",
      count: 1,
      requestId: "saved-summon-request",
    });
    const card = variantCard(CATALOG[0]!.id, "common", 2);
    const { onUpgrade } = setup({
      latest,
      collection: [{ card, copies: 50 }],
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Dernière invocation" }),
    );
    const reveal = await screen.findByRole("dialog");
    fireEvent.click(
      within(reveal).getByRole("button", {
        name: /niveau 2, voir les informations/,
      }),
    );
    const details = await screen.findByRole("dialog", { name: card.name });
    expect(within(details).getByText("50 / 50 exemplaires")).toBeTruthy();
    fireEvent.click(
      within(details).getByRole("button", { name: "Améliorer au niveau 3" }),
    );
    await waitFor(() =>
      expect(onUpgrade).toHaveBeenCalledExactlyOnceWith(card.id),
    );
  });

  it("uses the final reserve for repeated cards while the collection loads", async () => {
    setup();
    fireEvent.click(purchase("Sylve", 10));
    const reveal = await screen.findByRole("dialog");
    const items = within(reveal).getAllByRole("listitem");
    fireEvent.click(within(items[1]!).getByRole("button"));
    const card = resolveCard(`${CATALOG[0]!.id}:common`);
    const details = await screen.findByRole("dialog", { name: card.name });
    expect(within(details).getByText("9 / 25 exemplaires")).toBeTruthy();
    fireEvent.keyDown(details, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: card.name })).toBeNull(),
    );
    expect(within(reveal).getAllByRole("listitem")).toHaveLength(10);
    fireEvent.click(
      within(reveal).getByRole("button", { name: "Fermer la fenêtre" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(
      screen.getByRole("button", { name: "Dernière invocation" }),
    );
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("keeps the creature bestiary available from the new page", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Bestiaire" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: `Découvrir ${CATALOG[1]!.name}`,
      }),
    );
    expect(
      within(dialog).getByRole("heading", { name: CATALOG[1]!.name }),
    ).toBeTruthy();
    expect(within(dialog).getByRole("slider").getAttribute("max")).toBe("26");
    expect(within(dialog).getByText("Niv. 6")).toBeTruthy();
    await selectOption("Niveau de la carte", "Niveau 6");
    expect(within(dialog).getByText("Active · niv. 6")).toBeTruthy();
    expect(within(dialog).getByText("Niv. 11")).toBeTruthy();
    await selectOption("Niveau de la carte", "Niveau 26");
    expect(within(dialog).getByText("Active · niv. 11")).toBeTruthy();
  });
  it("explores Rare and Epic profiles through level 31 and clamps the level on returning to Common", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Bestiaire" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Découvrir Gardien de pierre",
      }),
    );
    const level = within(dialog).getByRole("combobox", {
      name: /Niveau de la carte/,
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /^Voir la forme rare/ }),
    );
    expect(within(dialog).getByRole("slider").getAttribute("max")).toBe("31");
    expect(
      within(dialog).getByRole("heading", { name: "Gardien des runes" }),
    ).toBeTruthy();
    expect(
      within(dialog)
        .getAllByAltText("Gardien des runes")[0]!
        .getAttribute("src"),
    ).toBe("/art/characters/evolutions/guardian-rare.webp");
    await selectOption("Niveau de la carte", "Niveau 31");
    fireEvent.click(
      within(dialog).getByRole("button", { name: /^Voir la forme épique/ }),
    );
    expect(
      within(dialog).getByRole("heading", { name: "Colosse du serment" }),
    ).toBeTruthy();
    expect(level.textContent).toContain("Niveau 31");
    fireEvent.click(
      within(dialog).getByRole("button", { name: /^Voir la forme commune/ }),
    );
    expect(level.textContent).toContain("Niveau 26");
    expect(
      within(dialog).getByRole("heading", { name: "Gardien de pierre" }),
    ).toBeTruthy();
  });
  it("explores sourced Legendaries through 31 and labels both Sylve buildings with their own cap", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Bestiaire" }));
    const dialog = await screen.findByRole("dialog");
    await selectOption("Rareté de la carte", "Légendaire");
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Découvrir Gardien du serment éternel",
      }),
    );
    expect(within(dialog).getByRole("slider").getAttribute("max")).toBe("31");
    expect(
      within(dialog).getByRole("heading", {
        name: "Gardien du serment éternel",
      }),
    ).toBeTruthy();
    await selectOption("Niveau de la carte", "Niveau 31");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Tout le bestiaire" }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Découvrir Totem de l’aurore",
      }),
    );
    const buildingLevel = within(dialog).getByRole("combobox", {
      name: "Niveau de la carte",
    });
    expect(buildingLevel.textContent).toContain("Niveau 26");
    expect(within(dialog).getByRole("slider").getAttribute("max")).toBe("26");
    expect(within(dialog).getByText(/Création Sylve/)).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Tout le bestiaire" }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Découvrir Gardien du serment éternel",
      }),
    );
    expect(within(dialog).getByRole("slider").getAttribute("max")).toBe("31");
  });
});
