import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries } from "convex/react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import type { MineBoard, MineKind } from "@sylve/game/mines";
import { useCurrencyGain } from "@/components/currency-gain";
import { showGameError } from "@/components/game/shared";
import { optimisticallyCollectMine, projectMineCollection } from "@/lib/optimistic-mines";

/** Keep the previous subscription alive until the refresh has loaded. Both
 * values stay in Convex's cache, so a rejection also rolls back during refresh. */
export function useMineBoard(refreshKey: number): MineBoard | undefined {
  const [previousKey, setPreviousKey] = useState(refreshKey);
  // Convex's useQueries subscribes by object identity. Recreating this object
  // on every render makes its internal subscription update without settling.
  const queries = useMemo(() => ({
    current: { query: api.collection.mineBoard, args: { refreshKey } },
    previous: { query: api.collection.mineBoard, args: { refreshKey: previousKey } },
  }), [refreshKey, previousKey]);
  const values = useQueries(queries);
  const current = values.current as MineBoard | Error | undefined;
  const previous = values.previous as MineBoard | Error | undefined;
  useEffect(() => {
    if (current && !(current instanceof Error)) setPreviousKey(refreshKey);
  }, [current, refreshKey]);
  if (current instanceof Error) throw current;
  if (previous instanceof Error) throw previous;
  return current ?? previous;
}

export function useMineCollection(board: MineBoard | undefined) {
  const collect = useMutation(api.collection.collectMine);
  const showGain = useCurrencyGain();
  const [pending, setPending] = useState<MineKind[]>([]);
  const inFlight = useRef(new Set<MineKind>());
  const clock = useMemo(
    () => ({ serverNow: board?.serverNow ?? 0, receivedAt: performance.now() }),
    [board],
  );

  async function collectResource(kind: MineKind) {
    const state = board?.mines?.[kind];
    if (!state || inFlight.current.has(kind)) return;
    const clickedAt = clock.serverNow + Math.max(0, performance.now() - clock.receivedAt);
    const { amount } = projectMineCollection(kind, state, clickedAt);
    if (amount <= 0) return;
    inFlight.current.add(kind);
    setPending((current) => [...current, kind]);
    const dismissGain = showGain(kind, amount);
    try {
      const result = await collect.withOptimisticUpdate((store, args) => {
        optimisticallyCollectMine(store, args, clickedAt);
      })({ kind, revision: state.revision });
      // Query reconciliation handles balances. Never credit again on success.
      if (result.amount !== amount) {
        dismissGain();
        if (result.amount > 0) showGain(kind, result.amount);
      }
    } catch (error) {
      dismissGain();
      showGameError(error);
    } finally {
      inFlight.current.delete(kind);
      setPending((current) => current.filter((item) => item !== kind));
    }
  }

  return { pending, collectResource };
}
