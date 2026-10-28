import { useCallback, useEffect, useRef, useState } from "react";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";

export interface DeckSave {
  deckId: Id<"decks">;
  name: string;
  cardIds: string[];
}
export type DeckSaveStatus = "saved" | "saving" | "error";
const keyOf = (deck: DeckSave) => JSON.stringify(deck);

/** Start writes immediately, serialize them, and coalesce edits made during a write. */
export function useDeckAutosave(
  onSave: (deck: DeckSave) => Promise<unknown>,
  onPersisted?: (deck: DeckSave) => void,
) {
  const [status, setStatus] = useState<DeckSaveStatus>("saved");
  const save = useRef(onSave);
  save.current = onSave;
  const persisted = useRef(onPersisted);
  persisted.current = onPersisted;
  const queue = useRef({
    persisted: "",
    pending: null as DeckSave | null,
    running: null as Promise<boolean> | null,
    retry: null as ReturnType<typeof setTimeout> | null,
    retryDelay: 1000,
    mounted: true,
  });

  const flush = useCallback(function flush(): Promise<boolean> {
    const state = queue.current;
    if (state.retry) {
      clearTimeout(state.retry);
      state.retry = null;
    }
    if (state.running) return state.running;
    async function drain() {
      while (state.pending) {
        const next = state.pending;
        state.pending = null;
        if (keyOf(next) === state.persisted) {
          persisted.current?.(next);
          continue;
        }
        if (state.mounted) setStatus("saving");
        try {
          await save.current(next);
          state.persisted = keyOf(next);
          persisted.current?.(next);
          state.retryDelay = 1000;
        } catch {
          // A newer local edit always wins over a failed older snapshot.
          state.pending ??= next;
          if (state.mounted) {
            setStatus("error");
            state.retry = setTimeout(() => {
              state.retry = null;
              void flush();
            }, state.retryDelay);
            state.retryDelay = Math.min(state.retryDelay * 2, 10_000);
          }
          return false;
        }
      }
      if (state.mounted) setStatus("saved");
      return true;
    }
    state.running = drain().finally(() => {
      state.running = null;
      if (state.mounted && state.pending && !state.retry) void flush();
    });
    return state.running;
  }, []);

  const initialize = useCallback((deck: DeckSave) => {
    queue.current.persisted = keyOf(deck);
  }, []);

  const enqueue = useCallback(
    (deck: DeckSave) => {
      const state = queue.current;
      if (!state.running && !state.pending && keyOf(deck) === state.persisted) {
        persisted.current?.(deck);
        return;
      }
      state.pending = deck;
      void flush();
    },
    [flush],
  );

  const hasPendingChanges = useCallback(
    () => !!queue.current.running || !!queue.current.pending,
    [],
  );

  useEffect(() => {
    const state = queue.current;
    state.mounted = true;
    return () => {
      state.mounted = false;
      if (state.retry) clearTimeout(state.retry);
    };
  }, []);

  return { status, initialize, enqueue, flush, hasPendingChanges };
}
