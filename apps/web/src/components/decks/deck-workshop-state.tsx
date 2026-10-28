import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import {
  createDeckWorkshopStore,
  type DeckWorkshopState,
  type DeckWorkshopStore,
} from "@/stores/deck-workshop-store";

const DeckWorkshopContext = createContext<DeckWorkshopStore | null>(null);

export function DeckWorkshopStoreProvider({ children, store }: {
  children: ReactNode;
  store?: DeckWorkshopStore;
}) {
  // React owns the instance, so SSR requests and player sessions never share it.
  const [value] = useState(() => store ?? createDeckWorkshopStore());
  return <DeckWorkshopContext.Provider value={value}>{children}</DeckWorkshopContext.Provider>;
}

export function useDeckWorkshopStore() {
  const store = useContext(DeckWorkshopContext);
  if (!store) throw new Error("DeckWorkshopStoreProvider is missing.");
  return store;
}

export function useDeckWorkshopState<T>(selector: (state: DeckWorkshopState) => T) {
  return useStore(useDeckWorkshopStore(), selector);
}
