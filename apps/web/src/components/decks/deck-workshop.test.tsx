import type { ReactNode } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOG, DEFAULT_DECK, DECK_SIZE } from "@sylve/game";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { DeckWorkshop, type WorkshopDeck } from "./deck-workshop";

vi.mock("@tanstack/react-router", () => ({
  useBlocker: vi.fn(),
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const deckId = "saved-deck" as Id<"decks">;
const savedDeck: WorkshopDeck = {
  _id: deckId,
  name: "Les gardiens de la Sylve",
  // Deliberately different from the starter to verify we open the saved deck.
  cardIds: [...DEFAULT_DECK.slice(0, -1), "wolf"],
};

function setup() {
  const onSave = vi.fn().mockResolvedValue(deckId);
  const result = render(<DeckWorkshop deck={savedDeck} onSave={onSave} />);
  return { ...result, onSave };
}
const deckRow = () =>
  within(screen.getByRole("region", { name: "Cartes du deck" }));
const collection = () =>
  within(screen.getByRole("region", { name: "Cartes de la collection" }));
const card = (region: ReturnType<typeof within>, name: string) =>
  region.getByRole("button", { name: new RegExp(`^${name},`) });

beforeEach(() => {
  // jsdom has no pointer capture or hit testing; emulate the browser primitives.
  vi.stubGlobal("PointerEvent", MouseEvent);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function dragCard(
  source: HTMLElement,
  target: HTMLElement | null,
  pointerType = "mouse",
) {
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: vi.fn().mockReturnValue(target),
  });
  fireEvent.pointerDown(source, {
    button: 0,
    pointerId: 1,
    pointerType,
    clientX: 80,
    clientY: 450,
  });
  fireEvent.pointerMove(source, {
    pointerId: 1,
    pointerType,
    clientX: 100,
    clientY: 200,
  });
  fireEvent.pointerUp(source, {
    pointerId: 1,
    pointerType,
    clientX: 100,
    clientY: 200,
  });
}

describe("l’atelier des decks", () => {
  it("opens the player's saved deck and keeps its cards out of the collection", () => {
    setup();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(deckRow().getAllByRole("button")).toHaveLength(DECK_SIZE);
    expect(card(deckRow(), "Loup de lune")).toBeTruthy();
    expect(
      collection().queryByRole("button", { name: /^Loup de lune,/ }),
    ).toBeNull();
    expect(collection().getAllByRole("button")).toHaveLength(
      CATALOG.length - DECK_SIZE,
    );
    expect(
      screen.queryByRole("button", {
        name: /Enregistrer|Enregistré|Créer|Supprimer/,
      }),
    ).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it.each(["mouse", "touch"])(
    "replaces a card by dragging with %s, preserving eight unique cards",
    async (pointerType) => {
      const { onSave } = setup();
      dragCard(
        card(collection(), "Chevalier ronce"),
        card(deckRow(), "Gardien de pierre"),
        pointerType,
      );
      expect(deckRow().getAllByRole("button")).toHaveLength(DECK_SIZE);
      expect(
        card(deckRow(), "Chevalier ronce").getAttribute("aria-label"),
      ).toContain("carte 1 du deck");
      expect(card(collection(), "Gardien de pierre")).toBeTruthy();
      expect(
        collection().queryByRole("button", { name: /^Chevalier ronce,/ }),
      ).toBeNull();
      expect(screen.getByRole("status").textContent).toContain(
        "Chevalier ronce remplace Gardien de pierre",
      );
      await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
      const saved = onSave.mock.calls[0]![0];
      expect(saved.deckId).toBe(deckId);
      expect(saved.cardIds).toEqual(["knight", ...savedDeck.cardIds.slice(1)]);
      expect(new Set(saved.cardIds).size).toBe(DECK_SIZE);
    },
  );

  it("swaps cards within the deck without duplicating or losing a card", () => {
    setup();
    dragCard(
      card(deckRow(), "Gardien de pierre"),
      card(deckRow(), "Renard des braises"),
    );
    expect(
      card(deckRow(), "Renard des braises").getAttribute("aria-label"),
    ).toContain("carte 1 du deck");
    expect(
      card(deckRow(), "Gardien de pierre").getAttribute("aria-label"),
    ).toContain("carte 2 du deck");
    expect(deckRow().getAllByRole("button")).toHaveLength(DECK_SIZE);
    expect(collection().getAllByRole("button")).toHaveLength(4);
  });

  it("ignores an invalid drop and cancels an active drag with Escape", () => {
    const { container } = setup();
    const source = card(collection(), "Chevalier ronce");
    dragCard(source, screen.getByRole("heading", { level: 1 }));
    expect(card(deckRow(), "Gardien de pierre")).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: /Enregistrer|Enregistré|Créer|Supprimer/,
      }),
    ).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn().mockReturnValue(card(deckRow(), "Gardien de pierre")),
    });
    fireEvent.pointerDown(source, { button: 0, clientX: 10, clientY: 500 });
    fireEvent.pointerMove(source, { clientX: 100, clientY: 200 });
    expect(container.querySelector(".workshop-drag-preview")).toBeTruthy();
    fireEvent.keyDown(source, { key: "Escape" });
    fireEvent.pointerUp(source, { clientX: 100, clientY: 200 });
    expect(container.querySelector(".workshop-drag-preview")).toBeNull();
    expect(card(deckRow(), "Gardien de pierre")).toBeTruthy();
  });

  it("filters only the collection and restores all cards on a second press", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "À distance" }));
    expect(collection().getAllByRole("button")).toHaveLength(2);
    for (const button of collection().getAllByRole("button"))
      expect(button.getAttribute("aria-label")).toContain("À distance");
    expect(deckRow().getAllByRole("button")).toHaveLength(DECK_SIZE);
    fireEvent.click(screen.getByRole("button", { name: "Corps à corps" }));
    expect(collection().getAllByRole("button")).toHaveLength(2);
    for (const button of collection().getAllByRole("button"))
      expect(button.getAttribute("aria-label")).toContain("Corps à corps");
    fireEvent.click(screen.getByRole("button", { name: "Corps à corps" }));
    expect(collection().getAllByRole("button")).toHaveLength(4);
    expect(
      screen
        .getByRole("button", { name: "Toutes" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("allows keyboard activation to select a replacement and cancel a selection", () => {
    setup();
    fireEvent.click(card(collection(), "Chevalier ronce"), { detail: 0 });
    expect(screen.getByRole("status").textContent).toContain(
      "choisis une carte du deck à remplacer",
    );
    fireEvent.keyDown(card(collection(), "Chevalier ronce"), { key: "Escape" });
    expect(
      card(collection(), "Chevalier ronce").getAttribute("aria-pressed"),
    ).toBe("false");
    fireEvent.click(card(collection(), "Chevalier ronce"), { detail: 0 });
    fireEvent.click(card(deckRow(), "Gardien de pierre"), { detail: 0 });
    expect(card(deckRow(), "Chevalier ronce")).toBeTruthy();
    expect(card(collection(), "Gardien de pierre")).toBeTruthy();
  });
});
