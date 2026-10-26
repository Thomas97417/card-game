import type { ReactNode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOG, resolveCard, variantCard } from "@sylve/game";
import {
  summonGold,
  summonGoldRewards,
  summonLoot,
  summonPrice,
  summonOffer,
  summonRoundRewards,
  type SummonResult,
} from "@sylve/game/summoning";
import { Sanctuary, type SummonRequest } from "./sanctuary";
import { GoldContext } from "@/components/gold-balance";
import { EmeraldContext } from "@/components/emerald-balance";
import { selectOption } from "@/test-select";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    hash,
    hashScrollIntoView: _hashScrollIntoView,
    ...props
  }: {
    children: ReactNode;
    to: string;
    hash?: string;
    hashScrollIntoView?: ScrollIntoViewOptions;
  }) => (
    <a href={`${to}${hash ? `#${hash}` : ""}`} {...props}>
      {children}
    </a>
  ),
}));

function reward(request: SummonRequest): SummonResult {
  return {
    ...request,
    cost: summonOffer(request.packId, request.count, !!request.repeatToken)
      .cost,
    repeatToken: `circle-${request.requestId}`,
    gold: summonGold(request.packId, request.count, () => 0),
    goldBySummon: summonGoldRewards(request.packId, request.count, () => 0),
    reveals: summonLoot(request.packId, request.count, () =>
      request.packId === "ancients" ? 0.5 : 0,
    ).map((item, index) => ({
      ...item,
      isNew: index === 0,
      level: 1,
      copies: index,
    })),
  };
}
function setup(overrides: Partial<Parameters<typeof Sanctuary>[0]> = {}) {
  const onSummon = vi.fn(async (request: SummonRequest) => reward(request));
  const onUpgrade = vi.fn().mockResolvedValue(undefined);
  const onUnlockChestSlot = vi.fn().mockResolvedValue(undefined);
  const onCloseCircle = vi.fn().mockResolvedValue(undefined);
  const onSaveRevealProgress = vi.fn().mockResolvedValue({ completed: false });
  const props = {
    emeralds: 3_000,
    ready: true,
    purchasedChestSlots: [],
    collection: undefined,
    onSummon,
    onUpgrade,
    onUnlockChestSlot,
    onCloseCircle,
    onSaveRevealProgress,
    ...overrides,
  };
  const view = (next: Parameters<typeof Sanctuary>[0]) => (
    <GoldContext.Provider value={500}>
      <EmeraldContext.Provider value={next.emeralds}>
        <Sanctuary {...next} />
      </EmeraldContext.Provider>
    </GoldContext.Provider>
  );
  const result = render(view(props));
  return {
    ...result,
    onSummon,
    onUpgrade,
    onUnlockChestSlot,
    onCloseCircle,
    onSaveRevealProgress,
    update: (changes: Partial<Parameters<typeof Sanctuary>[0]>) => {
      Object.assign(props, changes);
      result.rerender(view(props));
    },
  };
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

afterEach(() => window.localStorage.clear());

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
    await waitFor(() =>
      expect(
        within(keys).queryByRole("article", { name: "Clé de la Sylve" }),
      ).toBeNull(),
    );
    expect(within(keys).getAllByRole("article")).toHaveLength(2);
    expect(
      screen.getByText("L’emplacement 7 est débloqué pour toujours."),
    ).toBeTruthy();
    expect(onSummon).not.toHaveBeenCalled();
  });
  it("hides saved unlocks and blocks remaining keys without enough emeralds", () => {
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
      within(keys).queryByRole("article", { name: "Clé des anciens" }),
    ).toBeNull();
    expect(within(keys).getAllByRole("article")).toHaveLength(2);
    const expensive = within(keys).getByRole("button", {
      name: /emplacement 9 —/,
    });
    expect((expensive as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(expensive);
    expect(onUnlockChestSlot).not.toHaveBeenCalled();
  });
  it("waits for key ownership before displaying offers and hides the section when every key is owned", () => {
    const { update, onUnlockChestSlot } = setup({
      ready: false,
      purchasedChestSlots: undefined,
    });
    expect(screen.queryByRole("region", { name: "Clés de coffre" })).toBeNull();
    update({ ready: true, purchasedChestSlots: [5, 6, 7] });
    expect(screen.queryByRole("region", { name: "Clés de coffre" })).toBeNull();
    expect(purchase("Sylve", 1).disabled).toBe(false);
    expect(onUnlockChestSlot).not.toHaveBeenCalled();
  });
  it("removes the final key after confirmation without waiting for refreshed ownership", async () => {
    const { update, onUnlockChestSlot, onSummon } = setup({
      emeralds: 1_500,
      purchasedChestSlots: [5, 6],
    });
    const keys = screen.getByRole("region", { name: "Clés de coffre" });
    expect(within(keys).getAllByRole("article")).toHaveLength(1);
    const buy = within(keys).getByRole("button", { name: /emplacement 9 —/ });
    fireEvent.click(buy);
    fireEvent.click(buy);
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Clés de coffre" }),
      ).toBeNull(),
    );
    update({ purchasedChestSlots: [5, 6] });
    expect(screen.queryByRole("region", { name: "Clés de coffre" })).toBeNull();
    update({ purchasedChestSlots: [5, 6, 7] });
    expect(screen.queryByRole("region", { name: "Clés de coffre" })).toBeNull();
    expect(onUnlockChestSlot).toHaveBeenCalledExactlyOnceWith(7);
    expect(onSummon).not.toHaveBeenCalled();
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
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /emplacement 7 —/ }),
      ).toBeNull(),
    );
    expect(onUnlockChestSlot).toHaveBeenCalledTimes(2);
  });
  it("shows both balances, rates and guarantees, and links to the hub, collection and emerald shop", () => {
    setup();
    expect(
      screen
        .getByRole("status", { name: "Solde d’émeraudes" })
        .querySelector("img")
        ?.getAttribute("src"),
    ).toBe("/art/ui/emerald.webp");
    expect(
      screen
        .getByRole("link", { name: /^Acheter des émeraudes/ })
        .getAttribute("href"),
    ).toBe("/sanctuary#emerald-packs");
    expect(
      screen.getByRole("status", { name: "Solde de pièces d’or" }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /^Acheter des pièces d’or/ })
        .getAttribute("href"),
    ).toBe("/sanctuary#gold-packs");
    expect(screen.getByText("2 %")).toBeTruthy();
    const sylve = screen.getByRole("article", { name: "Appel de la Sylve" });
    expect(within(sylve).getByText("82 %")).toBeTruthy();
    expect(within(sylve).getByText("16 %")).toBeTruthy();
    expect(within(sylve).queryByText("Commune")).toBeNull();
    expect(within(sylve).getByText("30 cartes")).toBeTruthy();
    expect(within(sylve).getByText("20 cartes")).toBeTruthy();
    expect(within(sylve).getByText("10 cartes")).toBeTruthy();
    expect(sylve.querySelector('img[src*="rarity-common"]')).toBeNull();
    expect(screen.getByText("54 %")).toBeTruthy();
    expect(screen.getByText("46 %")).toBeTruthy();
    expect(screen.getByText("30–33 cartes")).toBeTruthy();
    expect(screen.getByText("ou 60–63 cartes")).toBeTruthy();
    expect(
      within(purchase("Sylve", 10).parentElement!).getByText(
        "1 compagnon légendaire garanti",
      ),
    ).toBeTruthy();
    expect(
      within(purchase("anciens", 10).parentElement!).getByText(
        "20 compagnons légendaires garantis",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Appel des divinités" }),
    ).toBeNull();
    expect(purchase("anciens", 1).getAttribute("aria-label")).toContain(
      "4999 émeraudes",
    );
    expect(purchase("anciens", 10).getAttribute("aria-label")).toContain(
      "44999 émeraudes",
    );
    expect(screen.queryByText(/Carte d’or garantie/)).toBeNull();
    expect(screen.queryByText(/5 compagnons par invocation/)).toBeNull();
    expect(
      within(purchase("Sylve", 10).parentElement!).getByText("10 invocations"),
    ).toBeTruthy();
    expect(
      within(purchase("anciens", 10).parentElement!).getByText(
        "10 invocations",
      ),
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

  it("buys a ten-pack once and reveals ten successive circles of six cards before offering another discounted lot", async () => {
    let finish!: (result: SummonResult) => void;
    const onSummon = vi.fn(
      (_request: SummonRequest) =>
        new Promise<SummonResult>((resolve) => {
          finish = resolve;
        }),
    );
    setup({ onSummon, emeralds: 44999 });
    const purchaseButton = purchase("anciens", 10);
    fireEvent.click(purchase("anciens", 10));
    fireEvent.click(purchase("anciens", 10));
    fireEvent.click(purchase("Sylve", 1));
    expect(onSummon).toHaveBeenCalledOnce();
    expect(purchaseButton.getAttribute("aria-busy")).toBe("true");
    expect(within(purchaseButton).getByText(/44\s*999/)).toBeTruthy();
    expect(screen.queryByText("Les esprits répondent à ton appel…")).toBeNull();
    const request = onSummon.mock.calls[0]![0];
    expect(request).toMatchObject({ packId: "ancients", count: 10 });
    expect(request.requestId.length).toBeGreaterThan(15);
    for (const button of screen.getAllByRole("button", { name: /^Invoquer/ }))
      expect((button as HTMLButtonElement).disabled).toBe(true);
    await act(async () => finish(reward(request)));
    const dialog = await screen.findByRole("dialog");
    expect(purchaseButton.getAttribute("aria-busy")).toBeNull();
    expect(dialog.querySelector(".animate-spin")).toBeNull();
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
    expect(legendary).toBe(20);
    expect(epic).toBe(30);
    const repeat = within(dialog).getByRole("button", {
      name: "Réinvoquer ×10, 39999 émeraudes",
    });
    fireEvent.click(repeat);
    fireEvent.click(repeat);
    expect(onSummon).toHaveBeenCalledTimes(2);
    expect(repeat.getAttribute("aria-busy")).toBe("true");
    expect(within(repeat).getByText(/39\s*999/)).toBeTruthy();
    expect(screen.queryByText("Les esprits répondent à ton appel…")).toBeNull();
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

  it("reopens every round of the saved batch already revealed without purchasing it again", async () => {
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
    expect(within(dialog).getByText("Dernière invocation")).toBeTruthy();
    expect(within(dialog).queryByText(/Un nouvel appel ouvrira/)).toBeNull();
    for (let round = 1; round <= 10; round++) {
      expect(within(dialog).getByText(`Invocation ${round} / 10`)).toBeTruthy();
      expect(within(dialog).getAllByRole("listitem")).toHaveLength(6);
      expect(
        within(dialog).queryByRole("button", { name: /^Révéler la carte/ }),
      ).toBeNull();
      expect(
        within(dialog).getAllByRole("button", {
          name: /voir les informations/,
        }),
      ).toHaveLength(5);
      expect(
        within(dialog).getByRole("img", {
          name: "Carte d’or : 500 pièces d’or",
        }),
      ).toBeTruthy();
      if (round < 10) {
        const next = within(dialog).getByRole("button", {
          name: /^Invocation suivante/,
        }) as HTMLButtonElement;
        expect(next.disabled).toBe(false);
        fireEvent.click(next);
      }
    }
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
    latest.reveals = latest.reveals.map((item) => ({
      ...item,
      variantId: `${CATALOG[0]!.id}:common`,
    }));
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
    const card = resolveCard(`${CATALOG[0]!.id}:rare`);
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
      screen.getByRole("button", { name: "Finissez votre tirage" }),
    );
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("conceals identities, rarities and gold behind identical backs, flips each card only once and preserves history", async () => {
    const { onSummon } = setup();
    fireEvent.click(purchase("Sylve", 1));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(6);
    expect(
      within(dialog).queryByText(
        "Touche chaque carte pour découvrir ta récompense.",
      ),
    ).toBeNull();
    expect(dialog.querySelector(".lucide-sparkles")).toBeNull();
    expect(within(dialog).queryByText(/cartes révélées/)).toBeNull();
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
      within(dialog).getByRole("button", { name: "Fermer la fenêtre" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(purchase("Sylve", 1).getAttribute("aria-label")).toContain(
      "149 émeraudes",
    );
    expect(purchase("Sylve", 10).getAttribute("aria-label")).toContain(
      "1299 émeraudes",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Dernière invocation" }),
    );
    const history = await screen.findByRole("dialog");
    expect(
      within(history).getByRole("img", {
        name: "Carte d’or : 500 pièces d’or",
      }),
    ).toBeTruthy();
    expect(onSummon).toHaveBeenCalledOnce();
  });

  it("briefly celebrates a first discovery, skips owned cards and does not replay it on resume or history", async () => {
    const { onSummon } = setup();
    fireEvent.click(purchase("Sylve", 1));
    const dialog = await screen.findByRole("dialog");
    const rewards = summonRoundRewards(reward(onSummon.mock.calls[0]![0]), 0);
    const first = rewards.findIndex(
      (item) => item.kind === "hero" && item.item.isNew,
    );
    const owned = rewards.findIndex(
      (item) => item.kind === "hero" && !item.item.isNew,
    );
    const reveal = (index: number) =>
      within(dialog).getByRole("button", {
        name: `Révéler la carte ${index + 1}`,
      });
    const firstBack = reveal(first);
    expect(dialog.querySelector(".card-discovery-effects")).toBeNull();
    vi.useFakeTimers();
    try {
      fireEvent.click(reveal(owned));
      expect(dialog.querySelector(".card-discovery-effects")).toBeNull();
      fireEvent.click(firstBack);
      expect(dialog.querySelectorAll(".card-discovery-effects")).toHaveLength(1);
      expect(dialog.querySelector(".summon-legendary-effects")).toBeNull();
      expect(dialog.querySelector(".summon-legendary-ambience")).toBeNull();
      expect(within(dialog).queryByText(/Nouvelle ·/)).toBeNull();
      act(() => vi.advanceTimersByTime(800));
      fireEvent.click(firstBack);
      act(() => vi.advanceTimersByTime(800));
      expect(dialog.querySelector(".card-discovery-effects")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Fermer la fenêtre" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(
      screen.getByRole("button", { name: "Finissez votre tirage" }),
    );
    const resumed = await screen.findByRole("dialog");
    expect(resumed.querySelector(".card-discovery-effects")).toBeNull();
    expect(
      within(resumed).queryByRole("button", {
        name: `Révéler la carte ${first + 1}`,
      }),
    ).toBeNull();
    turnAll(resumed);
    fireEvent.click(
      within(resumed).getByRole("button", { name: "Fermer la fenêtre" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Dernière invocation" }));
    expect(
      (await screen.findByRole("dialog")).querySelector(".card-discovery-effects"),
    ).toBeNull();
    expect(onSummon).toHaveBeenCalledOnce();
  });

  it("celebrates only newly flipped legendary cards and finishes overlapping effects independently", async () => {
    const { onSummon, onSaveRevealProgress } = setup({ emeralds: 4_999 });
    fireEvent.click(purchase("anciens", 1));
    const dialog = await screen.findByRole("dialog");
    const slots = within(dialog).getAllByRole("listitem");
    const rewards = summonRoundRewards(reward(onSummon.mock.calls[0]![0]), 0);
    const legendary = rewards.flatMap((item, index) =>
      item.kind === "hero" &&
      resolveCard(item.item.variantId).rarity === "legendary"
        ? [index]
        : [],
    );
    const backs = slots.map((slot) =>
      within(slot).getByRole("button", { name: /^Révéler la carte/ }),
    );
    expect(legendary).toHaveLength(2);
    expect(dialog.querySelector(".summon-legendary-effects")).toBeNull();
    expect(dialog.querySelector(".is-legendary-revealing")).toBeNull();
    expect(dialog.querySelector("[data-rarity]")).toBeNull();
    vi.useFakeTimers();
    try {
      fireEvent.click(backs[legendary[0]!]!);
      expect(
        slots[legendary[0]!]!.querySelector(
          ".summon-legendary-effects",
        )?.getAttribute("aria-hidden"),
      ).toBe("true");
      expect(
        slots[legendary[0]!]!.querySelector(".card-discovery-effects"),
      ).toBeNull();
      for (let index = 0; index < rewards.length; index++)
        if (!legendary.includes(index)) fireEvent.click(backs[index]!);
      expect(dialog.querySelectorAll(".summon-legendary-effects")).toHaveLength(
        1,
      );
      act(() => vi.advanceTimersByTime(600));
      fireEvent.click(backs[legendary[1]!]!);
      fireEvent.click(backs[legendary[0]!]!);
      expect(dialog.querySelectorAll(".summon-legendary-effects")).toHaveLength(
        2,
      );
      expect(dialog.querySelector(".card-discovery-effects")).toBeNull();
      expect(onSaveRevealProgress).toHaveBeenCalledTimes(6);
      expect(onSummon).toHaveBeenCalledOnce();
      act(() => vi.advanceTimersByTime(1_800));
      expect(
        slots[legendary[0]!]!.querySelector(".summon-legendary-effects"),
      ).toBeNull();
      expect(
        slots[legendary[1]!]!.querySelector(".summon-legendary-effects"),
      ).toBeTruthy();
      act(() => vi.advanceTimersByTime(600));
      expect(dialog.querySelector(".summon-legendary-effects")).toBeNull();
      expect(dialog.querySelector(".summon-legendary-ambience")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not replay a legendary celebration on resume or in the saved history", async () => {
    const { onSummon } = setup({ emeralds: 4_999 });
    fireEvent.click(purchase("anciens", 1));
    const dialog = await screen.findByRole("dialog");
    const rewards = summonRoundRewards(reward(onSummon.mock.calls[0]![0]), 0);
    const legendary = rewards.flatMap((item, index) =>
      item.kind === "hero" &&
      resolveCard(item.item.variantId).rarity === "legendary"
        ? [index]
        : [],
    );
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: `Révéler la carte ${legendary[0]! + 1}`,
      }),
    );
    expect(dialog.querySelector(".summon-legendary-effects")).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Fermer la fenêtre" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(
      screen.getByRole("button", { name: "Finissez votre tirage" }),
    );
    const resumed = await screen.findByRole("dialog");
    expect(resumed.querySelector(".summon-legendary-effects")).toBeNull();
    expect(
      within(resumed).queryByRole("button", {
        name: `Révéler la carte ${legendary[0]! + 1}`,
      }),
    ).toBeNull();
    fireEvent.click(
      within(resumed).getByRole("button", {
        name: `Révéler la carte ${legendary[1]! + 1}`,
      }),
    );
    expect(resumed.querySelector(".summon-legendary-effects")).toBeTruthy();
    turnAll(resumed);
    fireEvent.click(
      within(resumed).getByRole("button", { name: "Fermer la fenêtre" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(
      screen.getByRole("button", { name: "Dernière invocation" }),
    );
    const history = await screen.findByRole("dialog");
    expect(history.querySelector(".summon-legendary-effects")).toBeNull();
    expect(within(history).getAllByText("Légendaire")).toHaveLength(2);
    expect(onSummon).toHaveBeenCalledOnce();
  });

  it("reinvokes the same single pack from the center at its discounted price", async () => {
    const { onSummon } = setup();
    fireEvent.click(purchase("Sylve", 1));
    const dialog = await screen.findByRole("dialog");
    turnAll(dialog);
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Réinvoquer ×1, 139 émeraudes",
      }),
    );
    await waitFor(() => expect(onSummon).toHaveBeenCalledTimes(2));
    expect(onSummon.mock.calls[1]![0]).toMatchObject({
      packId: "sylve",
      count: 1,
      repeatToken: reward(onSummon.mock.calls[0]![0]).repeatToken,
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

  it("keeps shop prices at their base amounts even when old purchases exist", () => {
    setup({
      emeralds: 139,
      latest: reward({
        packId: "sylve",
        count: 1,
        requestId: "old-paid-sylve-call",
      }),
    });
    expect(purchase("Sylve", 1).getAttribute("aria-label")).toContain(
      "149 émeraudes",
    );
    expect(purchase("Sylve", 1).disabled).toBe(true);
    expect(purchase("Sylve", 10).getAttribute("aria-label")).toContain(
      "1299 émeraudes",
    );
    expect(
      within(purchase("Sylve", 10).parentElement!).getByText("10 invocations"),
    ).toBeTruthy();
    expect(
      within(purchase("Sylve", 10)).getByLabelText("Au lieu de 1490 émeraudes"),
    ).toBeTruthy();
    expect(screen.queryByText(/Prochain appel/)).toBeNull();
  });

  it.each([
    { pack: "Sylve", count: 1, prices: [149, 139, 129, 129] },
    { pack: "Sylve", count: 10, prices: [1299, 1149, 999, 999] },
    { pack: "anciens", count: 1, prices: [4999, 4749, 4499, 4499] },
    { pack: "anciens", count: 10, prices: [44999, 39999, 34999, 34999] },
  ] as const)(
    "progresses $pack x$count repeat prices to their floor and resets outside the circle",
    async ({ pack, count, prices }) => {
      let purchases = 0;
      const onSummon = vi.fn(async (request: SummonRequest) => ({
        ...reward(request),
        cost: prices[purchases++]!,
      }));
      const { update } = setup({ onSummon, emeralds: prices[0] });
      const finishBatch = (dialog: HTMLElement) => {
        for (let round = 0; round < count; round++) {
          turnAll(dialog);
          if (round < count - 1)
            fireEvent.click(
              within(dialog).getByRole("button", {
                name: /^Invocation suivante/,
              }),
            );
        }
      };
      fireEvent.click(purchase(pack, count));
      for (const [index, price] of prices.slice(1).entries()) {
        const dialog = await screen.findByRole("dialog");
        await waitFor(() =>
          expect(
            within(dialog).getAllByRole("button", {
              name: /^Révéler la carte/,
            }),
          ).toHaveLength(6),
        );
        finishBatch(dialog);
        const repeat = within(dialog).getByRole("button", {
          name: `Réinvoquer ×${count}, ${price} émeraudes`,
        }) as HTMLButtonElement;
        update({ emeralds: price - 1 });
        expect(repeat.disabled).toBe(true);
        update({ emeralds: price });
        expect(repeat.disabled).toBe(false);
        fireEvent.click(repeat);
        await waitFor(() => expect(onSummon).toHaveBeenCalledTimes(index + 2));
      }
      const last = await screen.findByRole("dialog");
      await waitFor(() =>
        expect(
          within(last).getAllByRole("button", {
            name: /^Révéler la carte/,
          }),
        ).toHaveLength(6),
      );
      finishBatch(last);
      expect(
        within(last).getByRole("button", {
          name: `Réinvoquer ×${count}, ${prices[3]} émeraudes`,
        }),
      ).toBeTruthy();
      fireEvent.click(
        within(last).getByRole("button", { name: "Fermer la fenêtre" }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(purchase(pack, count).getAttribute("aria-label")).toContain(
        `${prices[0]} émeraudes`,
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Dernière invocation" }),
      );
      const history = await screen.findByRole("dialog");
      finishBatch(history);
      expect(
        within(history).getByRole("button", {
          name: `Réinvoquer ×${count}, ${prices[0]} émeraudes`,
        }),
      ).toBeTruthy();
    },
    15000,
  );

  it("allows exactly affordable discounted repeats only inside a newly purchased circle", async () => {
    const { update } = setup({ emeralds: 149 });
    fireEvent.click(purchase("Sylve", 1));
    const dialog = await screen.findByRole("dialog");
    update({ emeralds: 139 });
    turnAll(dialog);
    expect(
      (
        within(dialog).getByRole("button", {
          name: "Réinvoquer ×1, 139 émeraudes",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Fermer la fenêtre" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(purchase("Sylve", 1).disabled).toBe(true);
  });

  it.each([1, 10] as const)(
    "forgets the x%s circle's discount on close and when revisiting history",
    async (count) => {
      const { onCloseCircle, onSummon } = setup();
      fireEvent.click(purchase("Sylve", count));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).queryByText(/% au prochain/)).toBeNull();
      expect(dialog.querySelector(".summon-repeat-badge")).toBeNull();
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Fermer la fenêtre" }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(onCloseCircle).toHaveBeenCalledExactlyOnceWith(
        reward(onSummon.mock.calls[0]![0]).repeatToken,
      );
      expect(purchase("Sylve", 1).getAttribute("aria-label")).toContain(
        "149 émeraudes",
      );
      expect(purchase("Sylve", 10).getAttribute("aria-label")).toContain(
        "1299 émeraudes",
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Finissez votre tirage" }),
      );
      const history = await screen.findByRole("dialog");
      expect(within(history).queryByText(/% au prochain/)).toBeNull();
      expect(onSummon).toHaveBeenCalledOnce();
      for (let round = 0; round < count; round++) {
        turnAll(history);
        if (round < count - 1)
          fireEvent.click(
            within(history).getByRole("button", {
              name: /^Invocation suivante/,
            }),
          );
      }
      const baseCost = summonPrice("sylve", count);
      expect(
        within(history).getByRole("button", {
          name: `Réinvoquer ×${count}, ${baseCost} émeraudes`,
        }),
      ).toBeTruthy();
      fireEvent.click(
        within(history).getByRole("button", {
          name: `Réinvoquer ×${count}, ${baseCost} émeraudes`,
        }),
      );
      await waitFor(() => expect(onSummon).toHaveBeenCalledTimes(2));
      expect(onSummon.mock.calls[1]![0].repeatToken).toBeUndefined();
    },
  );

  it.each(["Escape", "close button", "pagehide", "unmount"])(
    "revokes the discount on %s",
    async (exit) => {
      const { onCloseCircle, onSummon, unmount } = setup();
      fireEvent.click(purchase("Sylve", 1));
      const dialog = await screen.findByRole("dialog");
      if (exit === "Escape") fireEvent.keyDown(dialog, { key: "Escape" });
      else if (exit === "close button")
        fireEvent.click(
          within(dialog).getByRole("button", { name: "Fermer la fenêtre" }),
        );
      else if (exit === "pagehide") fireEvent(window, new Event("pagehide"));
      else unmount();
      await waitFor(() =>
        expect(onCloseCircle).toHaveBeenCalledExactlyOnceWith(
          reward(onSummon.mock.calls[0]![0]).repeatToken,
        ),
      );
    },
  );

  it("keeps a circle closed if a pending discounted purchase finishes after leaving", async () => {
    let finish!: (value: SummonResult) => void;
    const onSummon = vi
      .fn<(request: SummonRequest) => Promise<SummonResult>>()
      .mockImplementationOnce(async (request) => reward(request))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
    const { onCloseCircle } = setup({ onSummon });
    fireEvent.click(purchase("Sylve", 1));
    const dialog = await screen.findByRole("dialog");
    turnAll(dialog);
    fireEvent.click(
      within(dialog).getByRole("button", { name: /^Réinvoquer/ }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Fermer la fenêtre" }),
    );
    const next = reward(onSummon.mock.calls[1]![0]);
    await act(async () => finish(next));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onCloseCircle).toHaveBeenCalledWith(next.repeatToken);
    expect(purchase("Sylve", 1).getAttribute("aria-label")).toContain(
      "149 émeraudes",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Finissez votre tirage" }),
    );
    expect(
      within(await screen.findByRole("dialog")).queryByText(/% au prochain/),
    ).toBeNull();
  });

  it("keeps history viewable at its base price without restoring a discount", async () => {
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
    const repeat = within(dialog).getByRole("button", { name: /^Réinvoquer/ });
    expect((repeat as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(repeat);
    expect(onSummon).not.toHaveBeenCalled();
    expect(within(dialog).queryByText("Émeraudes insuffisantes")).toBeNull();
  });

  it.each([1, 10] as const)(
    "keeps archived divine x%s results readable while blocking another purchase",
    async (count) => {
      const latest = reward({
        packId: "divine",
        count,
        requestId: "archived-divine-request",
      });
      const { onSummon } = setup({ latest, emeralds: 100000 });
      expect(
        screen.queryByRole("heading", { name: "Appel des divinités" }),
      ).toBeNull();
      fireEvent.click(
        screen.getByRole("button", { name: "Dernière invocation" }),
      );
      const dialog = await screen.findByRole("dialog");
      for (let round = 1; round <= count; round++) {
        expect(
          within(dialog).queryByRole("button", { name: /^Révéler la carte/ }),
        ).toBeNull();
        expect(within(dialog).getAllByText("Légendaire")).toHaveLength(5);
        if (round < count) {
          const next = within(dialog).getByRole("button", {
            name: /^Invocation suivante/,
          }) as HTMLButtonElement;
          expect(next.disabled).toBe(false);
          fireEvent.click(next);
        }
      }
      const repeat = within(dialog).getByRole("button", {
        name: /^Réinvoquer/,
      }) as HTMLButtonElement;
      expect(repeat.disabled).toBe(true);
      fireEvent.click(repeat);
      expect(onSummon).not.toHaveBeenCalled();
      expect(
        within(dialog).getByText("Cet appel est temporairement indisponible."),
      ).toBeTruthy();
    },
  );

  it("finishes a paid divine batch despite its temporary unavailability without charging again", async () => {
    const draw: SummonResult = {
      ...reward({
        packId: "divine",
        count: 10,
        requestId: "unfinished-divine-request",
      }),
      revealProgress: {
        round: 9,
        revealed: Array.from({ length: 54 }, (_, i) => i),
      },
      revealCompleted: false,
    };
    const { onSummon, onSaveRevealProgress } = setup({
      latest: draw,
      unfinished: draw,
      emeralds: 100000,
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Finissez votre tirage" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Invocation 10 / 10")).toBeTruthy();
    expect(
      within(dialog).getAllByRole("button", { name: /^Révéler la carte/ }),
    ).toHaveLength(6);
    turnAll(dialog);
    expect(within(dialog).getByText("Carte d’or")).toBeTruthy();
    expect(onSaveRevealProgress).toHaveBeenLastCalledWith({
      requestId: draw.requestId,
      round: 9,
      revealed: Array.from({ length: 60 }, (_, i) => i),
    });
    expect(
      (
        within(dialog).getByRole("button", {
          name: /^Réinvoquer/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(onSummon).not.toHaveBeenCalled();
  });

  it("recovers a lost discounted response with the same identifier even when the wallet is now empty", async () => {
    const onSummon = vi
      .fn<(request: SummonRequest) => Promise<SummonResult>>()
      .mockImplementationOnce(async (request) => reward(request))
      .mockRejectedValueOnce(new Error("Response lost"))
      .mockImplementation(async (request) => ({
        ...reward(request),
        cost: 139,
      }));
    const { update } = setup({ onSummon });
    fireEvent.click(purchase("Sylve", 1));
    const dialog = await screen.findByRole("dialog");
    turnAll(dialog);
    fireEvent.click(
      within(dialog).getByRole("button", { name: /^Réinvoquer/ }),
    );
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(
      within(dialog).queryByRole("button", { name: /^Révéler la carte/ }),
    ).toBeNull();
    update({ emeralds: 0 });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Retrouver mon invocation" }),
    );
    await waitFor(() => expect(onSummon).toHaveBeenCalledTimes(3));
    expect(onSummon.mock.calls[1]![0]).toEqual(onSummon.mock.calls[2]![0]);
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /^Révéler la carte/ }),
      ).toHaveLength(6),
    );
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

  it("resumes only the hidden cards of an interrupted purchase without a second payment or discount", async () => {
    const { onSummon, onSaveRevealProgress } = setup();
    fireEvent.click(purchase("Sylve", 1));
    const first = await screen.findByRole("dialog");
    fireEvent.click(
      within(first).getByRole("button", { name: "Révéler la carte 1" }),
    );
    fireEvent.click(
      within(first).getByRole("button", { name: "Révéler la carte 3" }),
    );
    fireEvent.click(
      within(first).getByRole("button", { name: "Fermer la fenêtre" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(
      screen.queryByRole("button", { name: "Dernière invocation" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Finissez votre tirage" }),
    );
    const resumed = await screen.findByRole("dialog");
    expect(within(resumed).getByText("Finissez votre tirage")).toBeTruthy();
    expect(
      within(resumed).getAllByRole("button", { name: /^Révéler la carte/ }),
    ).toHaveLength(4);
    expect(
      within(resumed).queryByRole("button", { name: "Révéler la carte 1" }),
    ).toBeNull();
    expect(
      within(resumed).getByRole("button", {
        name: "Réinvoquer ×1, 149 émeraudes",
      }),
    ).toBeTruthy();
    turnAll(resumed);
    expect(onSummon).toHaveBeenCalledOnce();
    expect(onSaveRevealProgress).toHaveBeenLastCalledWith({
      requestId: onSummon.mock.calls[0]![0].requestId,
      round: 0,
      revealed: [0, 1, 2, 3, 4, 5],
    });
    fireEvent.click(
      within(resumed).getByRole("button", { name: "Fermer la fenêtre" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(
      screen.queryByRole("button", { name: "Finissez votre tirage" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Dernière invocation" }),
    );
    expect(
      within(await screen.findByRole("dialog")).queryByRole("button", {
        name: /^Révéler la carte/,
      }),
    ).toBeNull();
  });

  it("resumes a ten-pack on its interrupted step and preserves earlier reveals", async () => {
    const { onSummon } = setup();
    fireEvent.click(purchase("Sylve", 10));
    const first = await screen.findByRole("dialog");
    turnAll(first);
    fireEvent.click(
      within(first).getByRole("button", { name: /^Invocation suivante/ }),
    );
    fireEvent.click(
      within(first).getByRole("button", { name: "Révéler la carte 4" }),
    );
    fireEvent.click(
      within(first).getByRole("button", { name: "Fermer la fenêtre" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(
      screen.getByRole("button", { name: "Finissez votre tirage" }),
    );
    const resumed = await screen.findByRole("dialog");
    expect(within(resumed).getByText("Invocation 2 / 10")).toBeTruthy();
    expect(
      within(resumed).getAllByRole("button", { name: /^Révéler la carte/ }),
    ).toHaveLength(5);
    turnAll(resumed);
    fireEvent.click(
      within(resumed).getByRole("button", { name: /^Invocation suivante/ }),
    );
    expect(within(resumed).getByText("Invocation 3 / 10")).toBeTruthy();
    expect(
      within(resumed).getAllByRole("button", { name: /^Révéler la carte/ }),
    ).toHaveLength(6);
    expect(onSummon).toHaveBeenCalledOnce();
  });

  it("restores server-saved progress after a reload even with no emeralds", async () => {
    const draw: SummonResult = {
      ...reward({
        packId: "sylve",
        count: 10,
        requestId: "server-saved-progress",
      }),
      revealProgress: {
        round: 4,
        revealed: [...Array.from({ length: 24 }, (_, index) => index), 24, 27],
      },
      revealCompleted: false,
    };
    const { onSummon } = setup({ latest: draw, unfinished: draw, emeralds: 0 });
    fireEvent.click(
      screen.getByRole("button", { name: "Finissez votre tirage" }),
    );
    const resumed = await screen.findByRole("dialog");
    expect(within(resumed).getByText("Invocation 5 / 10")).toBeTruthy();
    expect(
      within(resumed).getAllByRole("button", { name: /^Révéler la carte/ }),
    ).toHaveLength(4);
    expect(onSummon).not.toHaveBeenCalled();
  });

  it("retains a browser draft until the server acknowledges it and recovers it on the next visit", async () => {
    const onSaveRevealProgress = vi
      .fn()
      .mockRejectedValue(new Error("Offline"));
    const first = setup({ onSaveRevealProgress });
    fireEvent.click(purchase("Sylve", 1));
    const dialog = await screen.findByRole("dialog");
    const request = first.onSummon.mock.calls[0]![0];
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Révéler la carte 2" }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Révéler la carte 5" }),
    );
    await waitFor(() => expect(onSaveRevealProgress).toHaveBeenCalledTimes(2));
    first.unmount();
    const draw: SummonResult = {
      ...reward(request),
      revealProgress: { round: 0, revealed: [] },
      revealCompleted: false,
    };
    const next = setup({ latest: draw, unfinished: draw, emeralds: 0 });
    fireEvent.click(
      screen.getByRole("button", { name: "Finissez votre tirage" }),
    );
    const resumed = await screen.findByRole("dialog");
    expect(
      within(resumed).getAllByRole("button", { name: /^Révéler la carte/ }),
    ).toHaveLength(4);
    expect(next.onSaveRevealProgress).toHaveBeenCalledWith({
      requestId: request.requestId,
      round: 0,
      revealed: [1, 4],
    });
    expect(next.onSummon).not.toHaveBeenCalled();
  });

  it("resumes a purchase confirmed by the server after a lost response and keeps the next purchase separate", async () => {
    const onSummon = vi
      .fn<(request: SummonRequest) => Promise<SummonResult>>()
      .mockRejectedValueOnce(new Error("Response lost"))
      .mockImplementation(async (request) => reward(request));
    const { update } = setup({ onSummon });
    fireEvent.click(purchase("Sylve", 1));
    await screen.findByRole("alert");
    const paid = onSummon.mock.calls[0]![0];
    const draw: SummonResult = {
      ...reward(paid),
      revealProgress: { round: 0, revealed: [] },
      revealCompleted: false,
    };
    update({ latest: draw, unfinished: draw });
    fireEvent.click(
      screen.getByRole("button", { name: "Finissez votre tirage" }),
    );
    const resumed = await screen.findByRole("dialog");
    turnAll(resumed);
    fireEvent.click(
      within(resumed).getByRole("button", { name: "Fermer la fenêtre" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(purchase("Sylve", 1));
    await waitFor(() => expect(onSummon).toHaveBeenCalledTimes(2));
    expect(onSummon.mock.calls[1]![0].requestId).not.toBe(paid.requestId);
  });

  it("can finish an earlier draw after buying another one", async () => {
    const { onSummon, onSaveRevealProgress } = setup();
    fireEvent.click(purchase("Sylve", 1));
    const first = await screen.findByRole("dialog");
    fireEvent.click(
      within(first).getByRole("button", { name: "Révéler la carte 1" }),
    );
    fireEvent.click(
      within(first).getByRole("button", { name: "Fermer la fenêtre" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(purchase("Sylve", 1));
    const second = await screen.findByRole("dialog");
    fireEvent.click(
      within(second).getByRole("button", { name: "Fermer la fenêtre" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(
      screen.getByRole("button", { name: "Finissez votre tirage" }),
    );
    const resumed = await screen.findByRole("dialog");
    expect(
      within(resumed).getAllByRole("button", { name: /^Révéler la carte/ }),
    ).toHaveLength(5);
    turnAll(resumed);
    expect(onSaveRevealProgress.mock.calls.at(-1)![0].requestId).toBe(
      onSummon.mock.calls[0]![0].requestId,
    );
    fireEvent.click(
      within(resumed).getByRole("button", { name: "Fermer la fenêtre" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(
      screen.getByRole("button", { name: "Finissez votre tirage" }),
    );
    expect(
      within(await screen.findByRole("dialog")).getAllByRole("button", {
        name: /^Révéler la carte/,
      }),
    ).toHaveLength(6);
    expect(onSummon).toHaveBeenCalledTimes(2);
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
  it("explores Rare and Epic profiles through level 26 and clamps the level on returning to Common", async () => {
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
    expect(within(dialog).getByRole("slider").getAttribute("max")).toBe("26");
    expect(
      within(dialog).getByRole("heading", { name: "Gardien des runes" }),
    ).toBeTruthy();
    expect(
      within(dialog)
        .getAllByAltText("Gardien des runes")[0]!
        .getAttribute("src"),
    ).toBe("/art/characters/evolutions/guardian-rare.webp");
    await selectOption("Niveau de la carte", "Niveau 26");
    fireEvent.click(
      within(dialog).getByRole("button", { name: /^Voir la forme épique/ }),
    );
    expect(
      within(dialog).getByRole("heading", { name: "Colosse du serment" }),
    ).toBeTruthy();
    expect(level.textContent).toContain("Niveau 26");
    fireEvent.click(
      within(dialog).getByRole("button", { name: /^Voir la forme commune/ }),
    );
    expect(level.textContent).toContain("Niveau 26");
    expect(
      within(dialog).getByRole("heading", { name: "Gardien de pierre" }),
    ).toBeTruthy();
  });
  it("explores sourced Legendaries through 26 and gives former Sylve creations their CW profiles", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Bestiaire" }));
    const dialog = await screen.findByRole("dialog");
    await selectOption("Rareté de la carte", "Légendaire");
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Découvrir Gardien du serment éternel",
      }),
    );
    expect(within(dialog).getByRole("slider").getAttribute("max")).toBe("26");
    expect(
      within(dialog).getByRole("heading", {
        name: "Gardien du serment éternel",
      }),
    ).toBeTruthy();
    await selectOption("Niveau de la carte", "Niveau 26");
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
    expect(within(dialog).queryByText(/Création Sylve/)).toBeNull();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Tout le bestiaire" }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Découvrir Gardien du serment éternel",
      }),
    );
    expect(within(dialog).getByRole("slider").getAttribute("max")).toBe("26");
  });
});
