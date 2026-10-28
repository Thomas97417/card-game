import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useStore } from "zustand";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { createDeckWorkshopStore, type DeckDraft, type WorkshopDeck } from "./deck-workshop-store";

const original: WorkshopDeck = {
  _id: "deck-one" as Id<"decks">,
  name: "Les gardiens",
  cardIds: ["guardian:common", "fox:rare"],
  updatedAt: 10,
};
const draftOf = (deck: WorkshopDeck): DeckDraft => ({
  id: deck._id, name: deck.name, cards: [...deck.cardIds],
});

describe("workshop draft synchronization", () => {
  it.each([true, false])(
    "does not rerender a draft subscriber for an identical server confirmation (save resolves first: %s)",
    (saveResolvesFirst) => {
      const store = createDeckWorkshopStore();
      store.getState().syncDeck(original);
      let renders = 0;
      const { result } = renderHook(() => {
        renders++;
        return useStore(store, (state) => state.draft);
      });
      const edited = { ...draftOf(original), cards: ["knight:common", "fox:rare"] };
      act(() => store.getState().setDraft(edited));
      const localDraft = result.current;
      const rendersAfterEdit = renders;
      act(() => {
        if (saveResolvesFirst) store.getState().markSaved(edited);
        store.getState().syncDeck({ ...original, cardIds: [...edited.cards], updatedAt: 11 });
        if (!saveResolvesFirst) store.getState().markSaved(edited);
      });
      expect(result.current).toBe(localDraft);
      expect(renders).toBe(rendersAfterEdit);
      expect(store.getState().serverUpdatedAt).toBe(11);
      expect(store.getState().isDirty).toBe(false);

      act(() => store.getState().syncDeck({ ...original, cardIds: [...edited.cards], updatedAt: 12 }));
      expect(renders).toBe(rendersAfterEdit);
      expect(store.getState().serverUpdatedAt).toBe(12);

      act(() => store.getState().syncDeck({ ...original, updatedAt: 13 }));
      expect(result.current).toEqual(draftOf(original));
      expect(renders).toBe(rendersAfterEdit + 1);
    },
  );

  it("accepts a newer server revert even if its cards match the initial snapshot, and ignores older snapshots", () => {
    const store = createDeckWorkshopStore();
    store.getState().syncDeck(original);
    const edited = { ...draftOf(original), name: "Sauvegardé localement" };
    store.getState().setDraft(edited);
    store.getState().markSaved(edited);
    store.getState().syncDeck({ ...original, updatedAt: 12 });
    expect(store.getState().draft).toEqual(draftOf(original));
    store.getState().syncDeck({ ...original, name: edited.name, updatedAt: 11 });
    expect(store.getState().draft).toEqual(draftOf(original));
    expect(store.getState().serverUpdatedAt).toBe(12);
  });

  it("isolates store instances and does not change the incoming Convex data", () => {
    const first = createDeckWorkshopStore();
    const second = createDeckWorkshopStore();
    first.getState().syncDeck(original);
    first.getState().setDraft({ ...draftOf(original), cards: ["knight:common"] });
    first.getState().toggleRarity("rare");
    expect(second.getState().draft).toBeNull();
    expect(second.getState().rarityFilters).toEqual([]);
    expect(original.cardIds).toEqual(["guardian:common", "fox:rare"]);
  });

  it("accepts live server updates for clean drafts and preserves newer edits until confirmed", () => {
    const store = createDeckWorkshopStore();
    store.getState().syncDeck(original);
    const remote = { ...original, name: "Renommé ailleurs" };
    store.getState().syncDeck(remote);
    expect(store.getState().draft).toEqual(draftOf(remote));

    const firstEdit = { ...draftOf(remote), cards: ["knight:common", "fox:rare"] };
    const latestEdit = { ...firstEdit, cards: ["wolf:rare", "fox:rare"] };
    store.getState().setDraft(firstEdit);
    store.getState().setDraft(latestEdit);
    store.getState().syncDeck({ ...remote, cardIds: firstEdit.cards });
    store.getState().markSaved(firstEdit);
    expect(store.getState().draft).toEqual(latestEdit);
    expect(store.getState().isDirty).toBe(true);

    store.getState().markSaved(latestEdit);
    store.getState().syncDeck({ ...remote, cardIds: latestEdit.cards });
    store.getState().syncDeck({ ...remote, name: "Nouveau nom serveur", cardIds: latestEdit.cards });
    expect(store.getState().draft?.name).toBe("Nouveau nom serveur");
    expect(store.getState().isDirty).toBe(false);
  });

  it("keeps a local revert while an intermediate composition is being saved", () => {
    const store = createDeckWorkshopStore();
    store.getState().syncDeck(original);
    const intermediate = { ...draftOf(original), cards: ["knight:common", "fox:rare"] };
    store.getState().setDraft(intermediate);
    store.getState().setDraft(draftOf(original));
    store.getState().syncDeck({ ...original, cardIds: intermediate.cards });
    store.getState().markSaved(intermediate);
    expect(store.getState().draft).toEqual(draftOf(original));
    expect(store.getState().isDirty).toBe(true);
    store.getState().markSaved(draftOf(original));
    expect(store.getState().isDirty).toBe(false);
  });

  it("loads a different deck without applying a late acknowledgement from the old deck", () => {
    const store = createDeckWorkshopStore();
    store.getState().syncDeck(original);
    const oldDraft = { ...draftOf(original), name: "Ancien brouillon" };
    store.getState().setDraft(oldDraft);
    const next = { ...original, _id: "deck-two" as Id<"decks">, name: "Autre deck" };
    store.getState().syncDeck(next);
    const newDraft = { ...draftOf(next), name: "Nouveau brouillon" };
    store.getState().setDraft(newDraft);
    store.getState().markSaved(oldDraft);
    expect(store.getState().draft).toEqual(newDraft);
    expect(store.getState().isDirty).toBe(true);
  });
});
