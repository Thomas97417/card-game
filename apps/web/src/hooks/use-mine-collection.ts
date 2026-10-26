import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries } from "convex/react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import type { MineBoard, MineKind } from "@sylve/game/mines";
import { useCurrencyGain } from "@/components/currency-gain";
import { showGameError } from "@/components/game/shared";
import { optimisticallyCollectMine, projectMineCollection } from "@/lib/optimistic-mines";
import { useMineClock } from "./use-mine-clock";

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
  // A failed obsolete refresh must not hide a newer successful result.
  return current ?? (previous instanceof Error ? undefined : previous);
}

type CollectionRequest = {
  ownerId: string;
  active: boolean;
  dismissGain: () => void;
};

export function useMineCollection(board: MineBoard | undefined) {
  const collect = useMutation(api.collection.collectMine);
  const showGain = useCurrencyGain();
  const [pending, setPending] = useState<MineKind[]>([]);
  const inFlight = useRef(new Map<MineKind, CollectionRequest>());
  const mounted = useRef(false);
  const ownerId = board?.ownerId;
  const currentOwner = useRef(ownerId);
  currentOwner.current = ownerId;
  useEffect(() => {
    mounted.current = true;
    setPending([]);
    const requests = inFlight.current;
    return () => {
      mounted.current = false;
      for (const request of requests.values()) {
        request.active = false;
        request.dismissGain();
      }
      requests.clear();
    };
  }, [ownerId]);
  const mineNow = useMineClock(board);

  async function collectResource(kind: MineKind) {
    const state = board?.mines?.[kind];
    if (!mounted.current || !ownerId || currentOwner.current !== ownerId || !state || inFlight.current.has(kind)) return;
    const clickedAt = mineNow();
    const { amount } = projectMineCollection(kind, state, clickedAt);
    if (amount <= 0) return;
    const request: CollectionRequest = { ownerId, active: true, dismissGain: () => {} };
    inFlight.current.set(kind, request);
    setPending((current) => [...current, kind]);
    const isCurrent = () => mounted.current && request.active && currentOwner.current === request.ownerId;
    try {
      request.dismissGain = showGain(kind, amount);
      const result = await collect.withOptimisticUpdate((store, args) => {
        optimisticallyCollectMine(store, args, clickedAt);
      })({ kind, revision: state.revision, expectedOwnerId: ownerId });
      if (!isCurrent()) return;
      // Query reconciliation handles balances. Never credit again on success.
      if (result.amount !== amount) {
        request.dismissGain();
        if (result.amount > 0) showGain(kind, result.amount);
      }
    } catch (error) {
      if (!isCurrent()) return;
      request.dismissGain();
      showGameError(error);
    } finally {
      // An old response must not release a newer account's collection lock.
      if (inFlight.current.get(kind) === request) inFlight.current.delete(kind);
      if (isCurrent()) setPending((current) => current.filter((item) => item !== kind));
    }
  }

  return { pending, collectResource };
}
