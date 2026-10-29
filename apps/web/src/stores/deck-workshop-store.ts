import { createStore } from "zustand/vanilla";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import type { CardRarity, CombatType, Faction } from "@sylve/game";

export interface WorkshopDeck {
  _id: Id<"decks">;
  name: string;
  cardIds: string[];
  updatedAt?: number;
}

export interface DeckDraft {
  id: Id<"decks">;
  name: string;
  cards: string[];
}

export interface DeckWorkshopState {
  draft: DeckDraft | null;
  isDirty: boolean;
  serverFingerprint: string | null;
  serverUpdatedAt: number | null;
  filter: CombatType | null;
  rarityFilters: CardRarity[];
  factionFilters: Faction[];
  upgradeOnly: boolean;
  evolutionOnly: boolean;
  syncDeck: (deck: WorkshopDeck) => void;
  setDraft: (draft: DeckDraft) => void;
  markSaved: (draft: DeckDraft) => void;
  selectCombatType: (type: CombatType | null) => void;
  toggleRarity: (rarity: CardRarity) => void;
  toggleFaction: (faction: Faction) => void;
  toggleUpgradeOnly: () => void;
  toggleEvolutionOnly: () => void;
  resetFilters: () => void;
}

const fingerprint = (draft: DeckDraft) =>
  JSON.stringify([draft.id, draft.name, draft.cards]);

const emptyFilters = () => ({
  filter: null,
  rarityFilters: [] as CardRarity[],
  factionFilters: [] as Faction[],
  upgradeOnly: false,
  evolutionOnly: false,
});

/** One store per mounted player session. Convex owns the persisted data. */
export function createDeckWorkshopStore() {
  return createStore<DeckWorkshopState>()((set) => ({
    draft: null,
    isDirty: false,
    serverFingerprint: null,
    serverUpdatedAt: null,
    ...emptyFilters(),
    syncDeck: (deck) => set((state) => {
      const incoming: DeckDraft = { id: deck._id, name: deck.name, cards: [...deck.cardIds] };
      const serverFingerprint = fingerprint(incoming);
      const serverUpdatedAt = deck.updatedAt ?? null;
      if (state.draft?.id !== incoming.id) {
        return { draft: incoming, isDirty: false, serverFingerprint, serverUpdatedAt };
      }
      if (serverUpdatedAt !== null && state.serverUpdatedAt !== null && serverUpdatedAt < state.serverUpdatedAt) return state;
      if (state.serverFingerprint === serverFingerprint && state.serverUpdatedAt === serverUpdatedAt) return state;
      // Identical confirmations only update server metadata, not draft subscribers.
      const matchesDraft = fingerprint(state.draft) === serverFingerprint;
      return {
        draft: state.isDirty || matchesDraft ? state.draft : incoming,
        isDirty: state.isDirty && !matchesDraft,
        serverFingerprint,
        serverUpdatedAt,
      };
    }),
    setDraft: (draft) => set((state) => {
      if (state.draft?.id !== draft.id || fingerprint(state.draft) === fingerprint(draft)) return state;
      return { draft: { ...draft, cards: [...draft.cards] }, isDirty: true };
    }),
    markSaved: (draft) => set((state) =>
      state.isDirty && state.draft && fingerprint(state.draft) === fingerprint(draft)
        ? { isDirty: false }
        : state,
    ),
    selectCombatType: (type) => set((state) =>
      type === null ? emptyFilters() : { filter: state.filter === type ? null : type },
    ),
    toggleRarity: (rarity) => set((state) => ({
      rarityFilters: state.rarityFilters.includes(rarity)
        ? state.rarityFilters.filter((value) => value !== rarity)
        : [...state.rarityFilters, rarity],
    })),
    toggleFaction: (faction) => set((state) => ({
      factionFilters: state.factionFilters.includes(faction)
        ? state.factionFilters.filter((value) => value !== faction)
        : [...state.factionFilters, faction],
    })),
    toggleUpgradeOnly: () => set((state) => ({ upgradeOnly: !state.upgradeOnly })),
    toggleEvolutionOnly: () => set((state) => ({ evolutionOnly: !state.evolutionOnly })),
    resetFilters: () => set(emptyFilters()),
  }));
}

export type DeckWorkshopStore = ReturnType<typeof createDeckWorkshopStore>;
