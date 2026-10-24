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
import { DiamondContext } from "@/components/diamond-balance";

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
  const props = {
    diamonds: 3_000,
    ready: true,
    collection: undefined,
    onSummon,
    onUpgrade,
    ...overrides,
  };
  const result = render(
    <GoldContext.Provider value={500}>
      <DiamondContext.Provider value={props.diamonds}>
        <Sanctuary {...props} />
      </DiamondContext.Provider>
    </GoldContext.Provider>,
  );
  return { ...result, onSummon, onUpgrade };
}
const purchase = (pack: "Sylve" | "anciens", count: 1 | 10) =>
  screen.getByRole("button", {
    name: new RegExp(
      `^Invoquer ${count} fois — Appel ${pack === "Sylve" ? "de la Sylve" : "des anciens"},`,
    ),
  }) as HTMLButtonElement;

describe("le sanctuaire", () => {
  it("shows both balances, explicit rates and batch guarantees, and links to the hub and collection", () => {
    setup();
    expect(
      screen
        .getByRole("status", { name: "Solde de diamants" })
        .querySelector("img")
        ?.getAttribute("src"),
    ).toBe("/art/ui/diamonds.webp");
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
    setup({ diamonds: 149 });
    expect(purchase("Sylve", 1).disabled).toBe(false);
    expect(purchase("Sylve", 10).disabled).toBe(true);
    expect(purchase("anciens", 1).disabled).toBe(true);
    expect(purchase("anciens", 10).disabled).toBe(true);
    expect(screen.getByText(/Il te manque 300 diamants/)).toBeTruthy();
  });

  it.each([undefined, null, 0])(
    "does not purchase with a loading, absent or empty wallet (%s)",
    (diamonds) => {
      const { onSummon } = setup({ diamonds });
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
    setup({ onSummon, diamonds: 3_899 });
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
    const { onSummon } = setup({ latest, diamonds: 0 });
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
        within(details).queryByRole("complementary", { name: "Actions du deck" }),
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
    const levels = within(dialog).getByRole("combobox", {
      name: /Niveau de la carte/,
    });
    expect(within(levels).getAllByRole("option")).toHaveLength(26);
    expect(within(dialog).getByText("Niv. 6")).toBeTruthy();
    fireEvent.change(levels, { target: { value: "6" } });
    expect(within(dialog).getByText("Active · niv. 6")).toBeTruthy();
    expect(within(dialog).getByText("Niv. 11")).toBeTruthy();
    fireEvent.change(levels, { target: { value: "26" } });
    expect(within(dialog).getByText("Active · niv. 11")).toBeTruthy();
  });
  it("explores Rare and Epic profiles through level 31 and clamps the level on returning to Common", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Bestiaire" }));
    const dialog = await screen.findByRole("dialog");
    const rarity = within(dialog).getByRole("combobox", {
      name: /Rareté de la carte/,
    });
    const level = within(dialog).getByRole("combobox", {
      name: /Niveau de la carte/,
    });
    fireEvent.change(rarity, { target: { value: "rare" } });
    expect(within(level).getAllByRole("option")).toHaveLength(31);
    expect(
      within(dialog).getByRole("heading", { name: "Gardien des runes" }),
    ).toBeTruthy();
    expect(
      within(dialog)
        .getAllByAltText("Gardien des runes")[0]!
        .getAttribute("src"),
    ).toBe("/art/characters/evolutions/guardian-rare.webp");
    fireEvent.change(level, { target: { value: "31" } });
    fireEvent.change(rarity, { target: { value: "epic" } });
    expect(
      within(dialog).getByRole("heading", { name: "Colosse du serment" }),
    ).toBeTruthy();
    expect((level as HTMLSelectElement).value).toBe("31");
    fireEvent.change(rarity, { target: { value: "common" } });
    expect((level as HTMLSelectElement).value).toBe("26");
    expect(
      within(dialog).getByRole("heading", { name: "Gardien de pierre" }),
    ).toBeTruthy();
  });
  it("explores sourced Legendaries through 31 and labels both Sylve buildings with their own cap", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Bestiaire" }));
    const dialog = await screen.findByRole("dialog");
    const rarity = within(dialog).getByRole("combobox", {
      name: /Rareté de la carte/,
    });
    const level = within(dialog).getByRole("combobox", {
      name: /Niveau de la carte/,
    });
    fireEvent.change(rarity, { target: { value: "legendary" } });
    expect(within(level).getAllByRole("option")).toHaveLength(31);
    expect(
      within(dialog).getByRole("heading", {
        name: "Gardien du serment éternel",
      }),
    ).toBeTruthy();
    fireEvent.change(level, { target: { value: "31" } });
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Découvrir Totem de l’aurore",
      }),
    );
    expect((level as HTMLSelectElement).value).toBe("26");
    expect(within(level).getAllByRole("option")).toHaveLength(26);
    expect(within(dialog).getByText(/Création Sylve/)).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Découvrir Gardien du serment éternel",
      }),
    );
    expect(within(level).getAllByRole("option")).toHaveLength(31);
  });
});
