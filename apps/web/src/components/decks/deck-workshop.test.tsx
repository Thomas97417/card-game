import type { ReactNode } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CATALOG,
  DEFAULT_DECK,
  DECK_SIZE,
  variantCard,
  availableRarities,
  maxCardLevel,
  upgradeCost,
  type OwnedCard,
} from "@sylve/game";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { DeckWorkshop, type WorkshopDeck } from "./deck-workshop";
import { GoldContext } from "@/components/gold-balance";
import { leagueProgress } from "@sylve/game/leagues";

vi.mock("@tanstack/react-router", () => ({
  useBlocker: vi.fn(),
  Link: ({
    children,
    to,
    hashScrollIntoView: _hashScrollIntoView,
    ...props
  }: {
    children: ReactNode;
    to: string;
    hashScrollIntoView?: ScrollIntoViewOptions;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const deckId = "saved-deck" as Id<"decks">;
const fullCollection: OwnedCard[] = CATALOG.map((base) => ({
  card: variantCard(base.id, availableRarities(base.id)[0]!),
  copies: 0,
}));
const savedDeck: WorkshopDeck = {
  _id: deckId,
  name: "Les gardiens de la Sylve",
  cardIds: [
    ...CATALOG.slice(0, 7).map((card) => `${card.id}:common`),
    "wolf:rare",
  ],
};
const starter = { ...savedDeck, cardIds: [...DEFAULT_DECK] };
function setup(
  deck = savedDeck,
  collection = fullCollection,
  gold: number | undefined = 500,
  trophies = 2400,
) {
  const onSave = vi.fn().mockResolvedValue(deckId);
  const onUpgrade = vi.fn().mockResolvedValue(undefined);
  const result = render(
    <GoldContext.Provider value={gold}>
      <DeckWorkshop
        league={leagueProgress(trophies)}
        deck={deck}
        collection={collection}
        onSave={onSave}
        onUpgrade={onUpgrade}
      />
    </GoldContext.Provider>,
  );
  return { ...result, onSave, onUpgrade };
}
const deckRow = () =>
  within(screen.getByRole("region", { name: "Cartes du deck" }));
const collection = () =>
  within(screen.getByRole("region", { name: "Cartes de la collection" }));
const card = (region: ReturnType<typeof within>, name: string) =>
  region.getByRole("button", { name: new RegExp(`^${name},`) });
const deckCards = () =>
  deckRow().getAllByRole("button", { name: /points de vie/ });
beforeEach(() => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function pointer(
  target: HTMLElement,
  type: string,
  options: MouseEventInit & { pointerType?: string } = {},
) {
  const { pointerType = "mouse", ...mouseOptions } = options;
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
    ...mouseOptions,
  });
  Object.assign(event, { pointerType, pointerId: 1 });
  fireEvent(target, event);
}
function dragCard(
  source: HTMLElement,
  target: HTMLElement | null,
  pointerType = "mouse",
) {
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: vi.fn().mockReturnValue(target),
  });
  pointer(source, "pointerdown", {
    pointerType,
    clientX: 80,
    clientY: 450,
  });
  pointer(source, "pointermove", {
    pointerType,
    clientX: 100,
    clientY: 200,
  });
  pointer(source, "pointerup", {
    pointerType,
    clientX: 100,
    clientY: 200,
  });
}

describe("l’atelier et la collection", () => {
  it.each(["Cartes du deck", "Cartes de la collection"])(
    "scrolls %s horizontally with the wheel and leaves trackpad gestures and zoom native",
    (label) => {
      const { onSave } = setup();
      const row = screen.getByRole("region", { name: label });
      Object.defineProperties(row, {
        scrollWidth: { value: 1200, configurable: true },
        clientWidth: { value: 600, configurable: true },
      });
      row.scrollLeft = 100;
      expect(fireEvent.wheel(row, { deltaY: 80 })).toBe(false);
      expect(row.scrollLeft).toBe(180);
      expect(fireEvent.wheel(row, { deltaY: -40 })).toBe(false);
      expect(row.scrollLeft).toBe(140);
      expect(fireEvent.wheel(row, { deltaX: 50 })).toBe(true);
      expect(fireEvent.wheel(row, { deltaY: 80, ctrlKey: true })).toBe(true);
      expect(fireEvent.wheel(row, { deltaY: 80, shiftKey: true })).toBe(true);
      expect(row.scrollLeft).toBe(140);
      expect(onSave).not.toHaveBeenCalled();

      Object.defineProperty(row, "scrollWidth", { value: 600 });
      expect(fireEvent.wheel(row, { deltaY: 80 })).toBe(true);
      expect(row.scrollLeft).toBe(140);
    },
  );

  it.each(["Cartes du deck", "Cartes de la collection"])(
    "pans %s from its background and preserves the next card click",
    async (label) => {
      const { onSave } = setup();
      const row = screen.getByRole("region", { name: label });
      row.scrollLeft = 200;
      pointer(row, "pointerdown", { clientX: 200 });
      pointer(row, "pointermove", { clientX: 120 });
      expect(row.scrollLeft).toBe(280);
      pointer(row, "pointerup", { clientX: 120 });
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(deckCards()).toHaveLength(8);
      expect(onSave).not.toHaveBeenCalled();

      const guardian = card(deckRow(), "Gardien du rempart");
      pointer(guardian, "pointerdown");
      pointer(guardian, "pointerup");
      fireEvent.click(guardian, { detail: 1 });
      expect(await screen.findByRole("dialog")).toBeTruthy();
    },
  );

  it.each(["Cartes du deck", "Cartes de la collection"])(
    "reserves horizontal touch gestures on %s for scrolling instead of moving cards",
    async (label) => {
      const { onSave } = setup();
      const row = screen.getByRole("region", { name: label });
      const source = within(row).getAllByRole("button")[0]!;
      pointer(source, "pointerdown", {
        pointerType: "touch",
        clientX: 200,
        clientY: 300,
      });
      pointer(source, "pointermove", {
        pointerType: "touch",
        clientX: 100,
        clientY: 310,
      });
      pointer(source, "pointercancel", { pointerType: "touch" });
      fireEvent.click(source, { detail: 1 });
      expect(document.querySelector(".workshop-drag-preview")).toBeNull();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(deckCards()).toHaveLength(8);
      expect(onSave).not.toHaveBeenCalled();

      pointer(source, "pointerdown", { pointerType: "touch" });
      pointer(source, "pointerup", { pointerType: "touch" });
      fireEvent.click(source, { detail: 1 });
      expect(await screen.findByRole("dialog")).toBeTruthy();
    },
  );

  it("chains four slots in Iron IV and prevents adding or dropping into them", async () => {
    const { onSave } = setup(starter, fullCollection, 500, 0);
    expect(deckCards()).toHaveLength(4);
    const locked = deckRow().getAllByRole("img", {
      name: /Emplacement .* verrouillé/,
    });
    expect(locked).toHaveLength(4);
    expect(locked[0]!.getAttribute("aria-label")).toContain(
      "Fer III à 200 trophées",
    );
    dragCard(card(collection(), "Archère du bastion"), locked[0]!);
    expect(deckCards()).toHaveLength(4);
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(card(collection(), "Archère du bastion"), { detail: 0 });
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Remplacer une carte" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Ajouter au deck" }),
    ).toBeNull();
  });

  it("releases the fifth slot exactly at the Iron III promotion", async () => {
    const { onSave } = setup(starter, fullCollection, 500, 200);
    expect(
      deckRow().getAllByRole("img", { name: /Emplacement .* verrouillé/ }),
    ).toHaveLength(3);
    dragCard(
      card(collection(), "Archère du bastion"),
      deckRow().getByRole("button", { name: "Emplacement 5 libre" }),
    );
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0]![0].cardIds).toHaveLength(5);
  });
  it("opens the saved deck, shows only owned reserve cards, and exposes rarity filters", () => {
    setup();
    expect(deckCards()).toHaveLength(8);
    expect(card(deckRow(), "Loup des failles")).toBeTruthy();
    expect(
      collection().queryByRole("button", { name: /^Loup des failles,/ }),
    ).toBeNull();
    expect(collection().getAllByRole("button")).toHaveLength(
      CATALOG.length - 8,
    );
    expect(
      screen.queryByRole("button", { name: /Enregistrer|Créer|Supprimer/ }),
    ).toBeNull();
    const rarities = within(
      screen.getByRole("group", { name: "Filtrer par rareté" }),
    );
    for (const name of ["Commune", "Rare", "Épique", "Légendaire"]) {
      expect(
        rarities.getByRole("button", { name }).getAttribute("aria-pressed"),
      ).toBe("false");
    }
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText("L’atelier des gardiens")).toBeNull();
  });
  it("sorts the reserve by descending rarity by default and after returning to Toutes", () => {
    const reserve: OwnedCard[] = [
      { card: variantCard("fox", "rare"), copies: 0 },
      { card: variantCard("guardian", "legendary"), copies: 0 },
      {
        card: { ...variantCard("knight", "common"), rarity: undefined },
        copies: 0,
      },
      { card: variantCard("wolf", "epic"), copies: 0 },
      { card: variantCard("dragon", "legendary"), copies: 0 },
      { card: variantCard("bear", "rare"), copies: 0 },
    ];
    const owned = [
      ...fullCollection.filter((entry) =>
        savedDeck.cardIds.includes(entry.card.id),
      ),
      ...reserve,
    ];
    const originalIds = owned.map((entry) => entry.card.id);
    const { onSave } = setup(savedDeck, owned);
    const expectedOrder = [1, 4, 3, 0, 5, 2].map(
      (index) => reserve[index]!.card.name,
    );
    const visibleNames = () =>
      collection()
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")!.split(",")[0]);

    expect(
      screen
        .getByRole("button", { name: "Toutes" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(visibleNames()).toEqual(expectedOrder);
    fireEvent.click(screen.getByRole("button", { name: "Bâtiments" }));
    fireEvent.click(screen.getByRole("button", { name: "Rare" }));
    fireEvent.click(screen.getByRole("button", { name: "Toutes" }));
    expect(visibleNames()).toEqual(expectedOrder);
    expect(owned.map((entry) => entry.card.id)).toEqual(originalIds);
    expect(
      deckCards().map(
        (button) => button.getAttribute("aria-label")!.split(",")[0],
      ),
    ).toEqual(
      savedDeck.cardIds.map(
        (id) => owned.find((entry) => entry.card.id === id)!.card.name,
      ),
    );
    expect(onSave).not.toHaveBeenCalled();
  });
  it.each(["mouse", "touch"])(
    "replaces a card by dragging with %s and saves eight unique variants",
    async (pointerType) => {
      const { onSave } = setup();
      dragCard(
        card(collection(), "Écuyer du royaume"),
        card(deckRow(), "Gardien du rempart"),
        pointerType,
      );
      expect(deckCards()).toHaveLength(DECK_SIZE);
      expect(
        card(deckRow(), "Écuyer du royaume").getAttribute("aria-label"),
      ).toContain("carte 1 du deck");
      expect(card(collection(), "Gardien du rempart")).toBeTruthy();
      expect(
        screen.getByRole("region", { name: "Cartes de la collection" })
          .scrollLeft,
      ).toBe(0);
      await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
      expect(onSave.mock.calls[0]![0].cardIds).toEqual([
        "knight:common",
        ...savedDeck.cardIds.slice(1),
      ]);
      expect(new Set(onSave.mock.calls[0]![0].cardIds).size).toBe(8);
    },
  );
  it("swaps cards within the deck without duplicating or losing one", () => {
    setup();
    dragCard(
      card(deckRow(), "Gardien du rempart"),
      card(deckRow(), "Archère du bastion"),
    );
    expect(
      card(deckRow(), "Archère du bastion").getAttribute("aria-label"),
    ).toContain("carte 1 du deck");
    expect(
      card(deckRow(), "Gardien du rempart").getAttribute("aria-label"),
    ).toContain("carte 2 du deck");
    expect(deckCards()).toHaveLength(8);
  });
  it("ignores invalid drops and cancels dragging with Escape", () => {
    setup();
    const source = card(collection(), "Écuyer du royaume");
    dragCard(source, screen.getByRole("main", { name: "Deck et collection" }));
    expect(card(deckRow(), "Gardien du rempart")).toBeTruthy();
    fireEvent.pointerDown(source, {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 500,
    });
    fireEvent.pointerMove(source, { pointerId: 1, clientX: 100, clientY: 200 });
    fireEvent.keyDown(source, { key: "Escape" });
    fireEvent.pointerUp(source, { pointerId: 1, clientX: 100, clientY: 200 });
    expect(card(deckRow(), "Gardien du rempart")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("combines multiple rarity toggles with combat type and leaves the deck intact", () => {
    setup(savedDeck, [
      ...fullCollection,
      { card: variantCard("guardian", "epic"), copies: 0 },
      { card: variantCard("wolf", "legendary"), copies: 0 },
      { card: variantCard("fox", "epic"), copies: 0 },
      { card: variantCard("dragon", "legendary"), copies: 0 },
      { card: variantCard("guardian", "rare"), copies: 0 },
    ]);
    const epic = screen.getByRole("button", { name: "Épique" });
    const legendary = screen.getByRole("button", { name: "Légendaire" });
    fireEvent.click(epic);
    fireEvent.click(legendary);
    expect(epic.getAttribute("aria-pressed")).toBe("true");
    expect(legendary.getAttribute("aria-pressed")).toBe("true");
    expect(collection().getAllByRole("button")).toHaveLength(4);

    fireEvent.click(screen.getByRole("button", { name: "Corps à corps" }));
    expect(collection().getAllByRole("button")).toHaveLength(2);
    expect(card(collection(), "Colosse du serment")).toBeTruthy();
    expect(card(collection(), "Loup de l’astre rouge")).toBeTruthy();
    expect(
      collection().queryByRole("button", { name: /^Flèche de la citadelle,/ }),
    ).toBeNull();
    expect(deckCards()).toHaveLength(8);

    fireEvent.click(epic);
    expect(epic.getAttribute("aria-pressed")).toBe("false");
    expect(legendary.getAttribute("aria-pressed")).toBe("true");
    expect(collection().getAllByRole("button")).toHaveLength(1);
    expect(card(collection(), "Loup de l’astre rouge")).toBeTruthy();

    fireEvent.click(legendary);
    expect(
      collection().getByRole("button", {
        name: /Gardien des remparts,.*Rare,/,
      }),
    ).toBeTruthy();
    fireEvent.click(epic);
    fireEvent.click(screen.getByRole("button", { name: "Toutes" }));
    expect(epic.getAttribute("aria-pressed")).toBe("false");
    expect(
      screen
        .getByRole("button", { name: "Corps à corps" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    expect(collection().getAllByRole("button")).toHaveLength(
      CATALOG.length - 8 + 5,
    );
  });
  it("combines family selections with type and rarity without modifying the saved deck", () => {
    const { onSave } = setup(starter, [
      ...fullCollection,
      { card: variantCard("guardian", "epic"), copies: 0 },
      { card: variantCard("wolf", "legendary"), copies: 0 },
      { card: variantCard("dragon", "legendary"), copies: 0 },
    ]);
    const families = within(
      screen.getByRole("group", { name: "Filtrer par famille" }),
    );
    const order = families.getByRole("button", { name: "Ordre" });
    const chaos = families.getByRole("button", { name: "Chaos" });
    const nature = families.getByRole("button", { name: "Nature" });
    const all = screen.getByRole("button", { name: "Toutes" });
    const buttons = () => collection().getAllByRole("button");
    const deckBefore = deckCards().map((card) =>
      card.getAttribute("aria-label"),
    );

    fireEvent.click(order);
    expect(order.getAttribute("aria-pressed")).toBe("true");
    expect(all.getAttribute("aria-pressed")).toBe("false");
    expect(
      buttons().every((button) => button.dataset.faction === "order"),
    ).toBe(true);
    fireEvent.click(chaos);
    expect(new Set(buttons().map((button) => button.dataset.faction))).toEqual(
      new Set(["order", "chaos"]),
    );
    fireEvent.click(screen.getByRole("button", { name: "Légendaire" }));
    expect(buttons()).toHaveLength(1);
    expect(buttons()[0]!.dataset.faction).toBe("chaos");
    fireEvent.click(nature);
    expect(buttons()).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "À distance" }));
    expect(buttons()).toHaveLength(1);
    expect(buttons()[0]!.dataset.faction).toBe("nature");
    fireEvent.click(all);
    expect(all.getAttribute("aria-pressed")).toBe("true");
    for (const button of [order, chaos, nature])
      expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(buttons()).toHaveLength(
      fullCollection.length - starter.cardIds.length + 3,
    );
    expect(deckCards().map((card) => card.getAttribute("aria-label"))).toEqual(
      deckBefore,
    );
    expect(onSave).not.toHaveBeenCalled();
  });
  it("resets every filter group from an empty result", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Chaos" }));
    fireEvent.click(screen.getByRole("button", { name: "À distance" }));
    expect(collection().getAllByRole("button")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Épique" }));
    fireEvent.click(screen.getByRole("button", { name: "Légendaire" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Cartes améliorables" }),
    );
    expect(
      screen.getByRole("heading", { name: "Aucune carte avec ces filtres" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Voir toute la collection" }),
    );
    expect(collection().getAllByRole("button")).toHaveLength(
      CATALOG.length - 8,
    );
    expect(
      screen
        .getByRole("button", { name: "Toutes" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    for (const name of [
      "Épique",
      "Légendaire",
      "Chaos",
      "Cartes améliorables",
    ]) {
      expect(
        screen.getByRole("button", { name }).getAttribute("aria-pressed"),
      ).toBe("false");
    }
  });
  it("opens collection card details without a replacement button or changing the deck", async () => {
    const { onSave } = setup();
    fireEvent.click(card(collection(), "Écuyer du royaume"), { detail: 0 });
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Remplacer une carte" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Déplacer dans le deck" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Fermer la fenêtre" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(card(collection(), "Écuyer du royaume")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });
  it("keeps keyboard movement and cancellation for cards already in the deck", async () => {
    const { onSave } = setup();
    fireEvent.click(card(deckRow(), "Gardien du rempart"), { detail: 0 });
    fireEvent.click(
      await screen.findByRole("button", { name: "Déplacer dans le deck" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.keyDown(card(deckRow(), "Gardien du rempart"), { key: "Escape" });
    expect(
      screen.getByRole("status", { name: "Conseils pour ton deck" })
        .textContent,
    ).not.toContain("Choisis une carte");
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(card(deckRow(), "Gardien du rempart"), { detail: 0 });
    fireEvent.click(
      await screen.findByRole("button", { name: "Déplacer dans le deck" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const targetId = savedDeck.cardIds[1]!;
    const target = fullCollection.find(
      (entry) => entry.card.id === targetId,
    )!.card;
    fireEvent.click(card(deckRow(), target.name), { detail: 0 });
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls.at(-1)?.[0].cardIds.slice(0, 2)).toEqual([
      targetId,
      savedDeck.cardIds[0],
    ]);
  });
  it("grows a starter deck through an empty slot and saves the added card", async () => {
    const { onSave } = setup(starter);
    expect(deckCards()).toHaveLength(4);
    dragCard(
      card(collection(), "Archère du bastion"),
      deckRow().getByRole("button", { name: "Emplacement 5 libre" }),
    );
    expect(deckCards()).toHaveLength(5);
    await waitFor(() =>
      expect(onSave.mock.calls.at(-1)?.[0].cardIds).toEqual([
        ...DEFAULT_DECK,
        "fox:common",
      ]),
    );
  });
  it("keeps rarity variants independent, uses evolved art and upgrades the exact variant", async () => {
    const rare = { card: variantCard("guardian", "rare"), copies: 25 };
    const { onUpgrade } = setup(starter, [...fullCollection, rare]);
    const rareButton = collection().getByRole("button", {
      name: /Gardien des remparts,.*Rare, niveau 1/,
    });
    expect(rareButton.getAttribute("data-rarity")).toBe("rare");
    expect(rareButton.querySelector("img")?.getAttribute("src")).toBe(
      "/art/characters/evolutions/guardian-rare.webp",
    );
    fireEvent.click(rareButton);
    fireEvent.click(
      await screen.findByRole("button", { name: "Améliorer au niveau 2" }),
    );
    await waitFor(() =>
      expect(onUpgrade).toHaveBeenCalledWith("guardian:rare"),
    );
    expect(
      screen.queryByRole("button", { name: "Ajouter au deck" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Fermer la fenêtre" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    dragCard(
      rareButton,
      deckRow().getByRole("button", { name: "Emplacement 5 libre" }),
    );
    expect(
      deckRow().getAllByRole("button", { name: /^Gardien du rempart,/ }),
    ).toHaveLength(1);
    expect(
      deckRow().getByRole("button", { name: /^Gardien des remparts,/ }),
    ).toBeTruthy();
  });
  it("keeps only the name below deck and collection artwork", () => {
    setup();
    for (const label of ["Cartes du deck", "Cartes de la collection"]) {
      const row = screen.getByRole("region", { name: label });
      expect(row.querySelector(".workshop-card-type")).toBeNull();
      expect(row.querySelector(".workshop-copies")).toBeNull();
      expect(row.querySelector(".workshop-card-name")).toBeTruthy();
    }
  });
  it.each(["common", "rare", "epic", "legendary"] as const)(
    "marks and filters %s cards at the copy threshold, excluding maximum levels regardless of gold",
    (rarity) => {
      const ready = variantCard("guardian", rarity, 3);
      const readyReserve = variantCard("mushroom", rarity, 3);
      const missing = variantCard("fox", rarity, 3);
      const maximum = variantCard(
        "dragon",
        rarity,
        maxCardLevel(rarity, "dragon"),
      );
      const owned = [
        { card: ready, copies: upgradeCost(3, rarity) },
        { card: readyReserve, copies: upgradeCost(3, rarity) },
        { card: missing, copies: upgradeCost(3, rarity) - 1 },
        { card: maximum, copies: 100_000 },
      ];
      const { onSave } = setup({ ...savedDeck, cardIds: [ready.id] }, owned, 0);
      const indicator = within(card(deckRow(), ready.name)).getByRole("img", {
        name: "Assez de cartes pour améliorer",
      });
      expect(indicator.closest(".card-level")?.textContent).toBe("Niv. 3");
      expect(
        within(card(collection(), readyReserve.name)).getByRole("img", {
          name: "Assez de cartes pour améliorer",
        }),
      ).toBeTruthy();
      for (const entry of [missing, maximum]) {
        expect(
          within(card(collection(), entry.name)).queryByRole("img", {
            name: "Assez de cartes pour améliorer",
          }),
        ).toBeNull();
      }
      const upgrade = screen.getByRole("button", {
        name: "Cartes améliorables",
      });
      const all = screen.getByRole("button", { name: "Toutes" });
      fireEvent.click(upgrade);
      expect(upgrade.getAttribute("aria-pressed")).toBe("true");
      expect(all.getAttribute("aria-pressed")).toBe("false");
      expect(collection().getAllByRole("button")).toHaveLength(1);
      expect(card(collection(), readyReserve.name)).toBeTruthy();
      expect(card(deckRow(), ready.name)).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Corps à corps" }));
      expect(
        screen.getByRole("heading", { name: "Aucune carte avec ces filtres" }),
      ).toBeTruthy();
      fireEvent.click(all);
      expect(upgrade.getAttribute("aria-pressed")).toBe("false");
      expect(collection().getAllByRole("button")).toHaveLength(3);

      fireEvent.click(upgrade);
      fireEvent.click(upgrade);
      expect(all.getAttribute("aria-pressed")).toBe("true");
      expect(collection().getAllByRole("button")).toHaveLength(3);
      expect(onSave).not.toHaveBeenCalled();
    },
  );
  it("keeps improvement disabled when there are not enough copies", async () => {
    setup(starter);
    fireEvent.click(card(deckRow(), "Gardien du rempart"));
    expect(
      (
        (await screen.findByRole("button", {
          name: "Améliorer au niveau 2",
        })) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText("0/25")).toBeTruthy();
  });
  it("disables an upgrade when copies are ready but gold is missing", async () => {
    const owned = fullCollection.map((entry) => ({ ...entry, copies: 25 }));
    const { onUpgrade } = setup(starter, owned, 49);
    fireEvent.click(card(deckRow(), "Gardien du rempart"));
    const action = await screen.findByRole("button", {
      name: "Améliorer au niveau 2",
    });
    expect((action as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(action);
    expect(onUpgrade).not.toHaveBeenCalled();
  });
  it("shows the level-dependent gold cost", async () => {
    const owned = fullCollection.map((entry) => ({
      ...entry,
      card: variantCard(entry.card.baseId!, entry.card.rarity!, 3),
      copies: 75,
    }));
    setup(starter, owned, 150);
    fireEvent.click(card(deckRow(), "Gardien du rempart"));
    const action = await screen.findByRole("button", {
      name: "Améliorer au niveau 4",
    });
    expect((action as HTMLButtonElement).disabled).toBe(false);
    expect(within(action).getByText("120")).toBeTruthy();
  });
  it("filters buildings and exposes their abilities", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Bâtiments" }));
    expect(collection().getAllByRole("button")).toHaveLength(1);
    fireEvent.click(card(collection(), "Totem des couronnes"));
    const dialog = within(await screen.findByRole("dialog"));
    expect(
      dialog.getByText(
        "À la fin du tour : inflige 1 dégât à tous les ennemis.",
      ),
    ).toBeTruthy();
    expect(dialog.getByText("Active · niv. 1")).toBeTruthy();
  });
  it("previews an ability unlock at a level that does not add attack or HP", async () => {
    const owned = [
      { card: variantCard("guardian", "common", 10), copies: 450 },
      ...fullCollection.filter((e) => e.card.baseId !== "guardian"),
    ];
    setup(starter, owned, 3000);
    fireEvent.click(card(deckRow(), "Gardien du rempart"));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText(/Niv. 11 : Débloquée/)).toBeTruthy();
    expect(
      (
        dialog.getByRole("button", {
          name: "Améliorer au niveau 11",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(dialog.getByText("Niv. 11")).toBeTruthy();
  });
});
