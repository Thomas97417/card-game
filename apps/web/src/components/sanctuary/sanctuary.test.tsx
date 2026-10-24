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
  summonGold,
  summonGoldRewards,
  summonOffer,
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
    gold: summonGold(request.packId, request.count, () => 0),
    goldBySummon: summonGoldRewards(request.packId, request.count, () => 0),
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
const purchase = (pack: "Sylve" | "anciens" | "divinités", count: 1 | 10) =>
  screen.getByRole("button", {
    name: new RegExp(
      `^Invoquer ${count} fois — Appel ${pack === "Sylve" ? "de la Sylve" : `des ${pack}`},`,
    ),
  }) as HTMLButtonElement;

function turnAll(dialog: HTMLElement) {
  for (const button of within(dialog).queryAllByRole("button", {
    name: /^Révéler la carte/,
  }))
    fireEvent.click(button);
}

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
    expect(screen.getByText("100 %")).toBeTruthy();
    expect(
      within(purchase("Sylve", 10)).getByText("1 compagnon légendaire garanti"),
    ).toBeTruthy();
    expect(
      within(purchase("anciens", 10)).getByText(
        "2 compagnons légendaires garantis",
      ),
    ).toBeTruthy();
    expect(
      within(purchase("divinités", 10)).getByText("50 compagnons légendaires"),
    ).toBeTruthy();
    expect(purchase("divinités", 1).getAttribute("aria-label")).toContain(
      "4499 émeraudes",
    );
    expect(purchase("divinités", 10).getAttribute("aria-label")).toContain(
      "39999 émeraudes",
    );
    expect(screen.getAllByText(/Carte d’or garantie : 500–1/)).toHaveLength(3);
    expect(within(purchase("Sylve", 10)).getByText("Offre ×10")).toBeTruthy();
    expect(within(purchase("anciens", 10)).getByText("Offre ×10")).toBeTruthy();
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

  it("buys a ten-pack once and reveals ten successive circles of six cards before offering another discounted lot", async () => {
    let finish!: (result: SummonResult) => void;
    const onSummon = vi.fn(
      (_request: SummonRequest) =>
        new Promise<SummonResult>((resolve) => {
          finish = resolve;
        }),
    );
    setup({ onSummon, emeralds: 3899 });
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
    let legendary = 0;
    let epic = 0;
    for (let round = 1; round <= 10; round++) {
      expect(within(dialog).getByText(`Invocation ${round} / 10`)).toBeTruthy();
      expect(within(dialog).getAllByRole("listitem")).toHaveLength(6);
      expect(
        within(dialog).getAllByRole("button", { name: /^Révéler la carte/ }),
      ).toHaveLength(6);
      const next = within(dialog).getByRole("button", {
        name: round < 10 ? /^Invocation suivante/ : /^Réinvoquer ×10/,
      }) as HTMLButtonElement;
      expect(next.disabled).toBe(true);
      fireEvent.click(next);
      expect(onSummon).toHaveBeenCalledOnce();
      turnAll(dialog);
      expect(next.disabled).toBe(false);
      expect(
        within(dialog).getByRole("img", {
          name: "Carte d’or : 500 pièces d’or",
        }),
      ).toBeTruthy();
      legendary += within(dialog).queryAllByText("Légendaire").length;
      epic += within(dialog).queryAllByText("Épique").length;
      if (round < 10) fireEvent.click(next);
    }
    expect(legendary).toBe(2);
    expect(epic).toBe(48);
    const repeat = within(dialog).getByRole("button", {
      name: "Réinvoquer ×10, 3509 émeraudes, remise de 10 %",
    });
    fireEvent.click(repeat);
    fireEvent.click(repeat);
    expect(onSummon).toHaveBeenCalledTimes(2);
    const nextRequest = onSummon.mock.calls[1]![0];
    expect(nextRequest).toMatchObject({ packId: "ancients", count: 10 });
    expect(nextRequest.requestId).not.toBe(request.requestId);
    await act(async () => finish(reward(nextRequest)));
    expect(
      within(await screen.findByRole("dialog")).getByText("Invocation 1 / 10"),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: /^Révéler la carte/ }),
    ).toHaveLength(6);
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
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(6);
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
    for (const index of [0, 9]) {
      if (index === 9)
        fireEvent.click(
          within(reveal).getByRole("button", { name: /^Invocation suivante/ }),
        );
      turnAll(reveal);
      const card = resolveCard(latest.reveals[index]!.variantId);
      const trigger = within(reveal).getAllByRole("button", {
        name: new RegExp(`^${card.name},`),
      })[0]!;
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
      expect(within(reveal).getAllByRole("listitem")).toHaveLength(6);
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
    turnAll(reveal);
    fireEvent.click(
      within(reveal).getAllByRole("button", {
        name: /niveau 2, voir les informations/,
      })[0]!,
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
    turnAll(reveal);
    const card = resolveCard(`${CATALOG[0]!.id}:common`);
    fireEvent.click(
      within(reveal).getAllByRole("button", {
        name: new RegExp(`^${card.name},`),
      })[0]!,
    );
    const details = await screen.findByRole("dialog", { name: card.name });
    expect(within(details).getByText("49 / 25 exemplaires")).toBeTruthy();
    fireEvent.keyDown(details, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: card.name })).toBeNull(),
    );
    expect(within(reveal).getAllByRole("listitem")).toHaveLength(6);
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

  it("conceals identities, rarities and gold behind identical backs, flips each card only once and preserves history", async () => {
    const { onSummon } = setup();
    fireEvent.click(purchase("Sylve", 1));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(6);
    expect(within(dialog).queryByText("Carte d’or")).toBeNull();
    expect(
      within(dialog).queryByRole("button", { name: /voir les informations/ }),
    ).toBeNull();
    expect(dialog.querySelector("[data-rarity]")).toBeNull();
    const backs = within(dialog).getAllByRole("button", {
      name: /^Révéler la carte/,
    });
    expect(
      backs.map((button) => button.querySelector("img")?.getAttribute("src")),
    ).toEqual(Array(6).fill("/art/ui/summon-card-back.webp"));
    fireEvent.click(backs[0]!);
    fireEvent.click(backs[0]!);
    expect(within(dialog).getByRole("status").textContent).toBe(
      "1 / 6 cartes révélées",
    );
    expect(
      within(dialog).getAllByRole("button", { name: /^Révéler la carte/ }),
    ).toHaveLength(5);
    expect(onSummon).toHaveBeenCalledOnce();
    turnAll(dialog);
    expect(
      within(dialog).getByRole("img", { name: "Carte d’or : 500 pièces d’or" }),
    ).toBeTruthy();
    expect(
      within(dialog).getAllByRole("button", { name: /voir les informations/ }),
    ).toHaveLength(5);
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Retour au sanctuaire" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(purchase("Sylve", 1).getAttribute("aria-label")).toContain(
      "134 émeraudes",
    );
    expect(purchase("Sylve", 10).getAttribute("aria-label")).toContain(
      "1299 émeraudes",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Dernière invocation" }),
    );
    const history = await screen.findByRole("dialog");
    turnAll(history);
    expect(
      within(history).getByRole("img", {
        name: "Carte d’or : 500 pièces d’or",
      }),
    ).toBeTruthy();
    expect(onSummon).toHaveBeenCalledOnce();
  });

  it("reinvokes the same single pack from the center at its discounted price", async () => {
    const { onSummon } = setup();
    fireEvent.click(purchase("Sylve", 1));
    const dialog = await screen.findByRole("dialog");
    turnAll(dialog);
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Réinvoquer ×1, 134 émeraudes, remise de 10 %",
      }),
    );
    await waitFor(() => expect(onSummon).toHaveBeenCalledTimes(2));
    expect(onSummon.mock.calls[1]![0]).toMatchObject({
      packId: "sylve",
      count: 1,
    });
    expect(onSummon.mock.calls[1]![0].requestId).not.toBe(
      onSummon.mock.calls[0]![0].requestId,
    );
    expect(
      within(await screen.findByRole("dialog")).getAllByRole("button", {
        name: /^Révéler la carte/,
      }),
    ).toHaveLength(6);
  });

  it("uses saved discounted offers for affordability and blocks an unaffordable central repeat", async () => {
    setup({ emeralds: 134, offers: [summonOffer("sylve", 1, true)] });
    expect(purchase("Sylve", 1).disabled).toBe(false);
    fireEvent.click(purchase("Sylve", 1));
    const dialog = await screen.findByRole("dialog");
    turnAll(dialog);
    // The exact discounted price remains affordable in this controlled wallet.
    expect(
      (
        within(dialog).getByRole("button", {
          name: /^Réinvoquer/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("keeps history viewable when the discounted repeat is unaffordable", async () => {
    const latest = reward({
      packId: "sylve",
      count: 1,
      requestId: "saved-summon-request",
    });
    const { onSummon } = setup({ emeralds: 133, latest });
    fireEvent.click(
      screen.getByRole("button", { name: "Dernière invocation" }),
    );
    const dialog = await screen.findByRole("dialog");
    turnAll(dialog);
    const repeat = within(dialog).getByRole("button", { name: /^Réinvoquer/ });
    expect((repeat as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(repeat);
    expect(onSummon).not.toHaveBeenCalled();
    expect(within(dialog).getByText("Émeraudes insuffisantes")).toBeTruthy();
  });

  it("keeps the all-legendary offer distinct and blocks its expensive price until affordable", async () => {
    const { onSummon } = setup({ emeralds: 4499 });
    expect(purchase("divinités", 1).disabled).toBe(false);
    expect(purchase("divinités", 10).disabled).toBe(true);
    fireEvent.click(purchase("divinités", 1));
    const dialog = await screen.findByRole("dialog");
    expect(onSummon).toHaveBeenCalledWith(
      expect.objectContaining({ packId: "divine", count: 1 }),
    );
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(6);
    turnAll(dialog);
    expect(within(dialog).getAllByText("Légendaire")).toHaveLength(5);
    expect(within(dialog).getByText("Carte d’or")).toBeTruthy();
  });

  it("recovers a lost discounted response with the same identifier even when the wallet is now empty", async () => {
    const onSummon = vi
      .fn<(request: SummonRequest) => Promise<SummonResult>>()
      .mockImplementationOnce(async (request) => reward(request))
      .mockRejectedValueOnce(new Error("Response lost"))
      .mockImplementation(async (request) => ({
        ...reward(request),
        cost: 134,
      }));
    const { rerender } = setup({ onSummon });
    fireEvent.click(purchase("Sylve", 1));
    const dialog = await screen.findByRole("dialog");
    turnAll(dialog);
    fireEvent.click(
      within(dialog).getByRole("button", { name: /^Réinvoquer/ }),
    );
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(within(dialog).getByText("6 / 6 cartes révélées")).toBeTruthy();
    rerender(
      <GoldContext.Provider value={500}>
        <EmeraldContext.Provider value={0}>
          <Sanctuary
            emeralds={0}
            ready
            collection={undefined}
            onSummon={onSummon}
            onUpgrade={async () => {}}
            onUnlockChestSlot={async () => {}}
          />
        </EmeraldContext.Provider>
      </GoldContext.Provider>,
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Retrouver mon invocation" }),
    );
    await waitFor(() => expect(onSummon).toHaveBeenCalledTimes(3));
    expect(onSummon.mock.calls[1]![0]).toEqual(onSummon.mock.calls[2]![0]);
    const recovered = await screen.findByRole("dialog");
    expect(
      within(recovered).getAllByRole("button", { name: /^Révéler la carte/ }),
    ).toHaveLength(6);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("splits a legacy batch's aggregate gold over ten rounds without inventing rewards", async () => {
    const latest = reward({
      packId: "sylve",
      count: 10,
      requestId: "old-batch-gold-total",
    });
    delete latest.goldBySummon;
    latest.gold = 5003;
    const { onSummon } = setup({ latest, emeralds: 0 });
    fireEvent.click(
      screen.getByRole("button", { name: "Dernière invocation" }),
    );
    const dialog = await screen.findByRole("dialog");
    let total = 0;
    for (let round = 0; round < 10; round++) {
      turnAll(dialog);
      const card = within(dialog).getByRole("img", { name: /^Carte d’or :/ });
      total += Number(card.getAttribute("aria-label")!.match(/: (\d+) /)![1]);
      if (round < 9)
        fireEvent.click(
          within(dialog).getByRole("button", { name: /^Invocation suivante/ }),
        );
    }
    expect(total).toBe(5003);
    expect(onSummon).not.toHaveBeenCalled();
  });

  it("can display historical results without a gold card", async () => {
    const latest = reward({
      packId: "sylve",
      count: 1,
      requestId: "legacy-summon-result",
    });
    delete latest.gold;
    delete latest.goldBySummon;
    setup({ latest });
    fireEvent.click(
      screen.getByRole("button", { name: "Dernière invocation" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(5);
    expect(within(dialog).queryByText("Carte d’or")).toBeNull();
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
