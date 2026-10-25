import type { OptimisticLocalStore } from "convex/browser";
import type { FunctionArgs } from "convex/server";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { mineAmount, type MineKind, type MineState } from "@sylve/game/mines";

export function projectMineCollection(kind: MineKind, state: MineState, now: number) {
  const updatedAt = Math.max(now, state.updatedAt);
  const total = mineAmount(kind, state, updatedAt);
  const amount = Math.floor(total);
  return {
    amount,
    mine: {
      ...state,
      amount: total - amount,
      updatedAt,
      revision: state.revision + 1,
    },
  };
}

/** Convex rolls back this immutable preview when authoritative queries arrive.
 * A fixed click time keeps replays deterministic while the request is pending. */
export function optimisticallyCollectMine(
  store: OptimisticLocalStore,
  { kind, revision }: FunctionArgs<typeof api.collection.collectMine>,
  clickedAt: number,
) {
  const queries = store.getAllQueries(api.collection.mineBoard);
  let latest: (typeof queries)[number] | undefined;
  for (const query of queries) {
    const state = query.value?.mines?.[kind];
    if (!state) continue;
    const previous = latest?.value?.mines?.[kind];
    if (
      !previous || state.revision > previous.revision ||
      (state.revision === previous.revision && query.value!.serverNow > latest!.value!.serverNow)
    ) latest = query;
  }
  const state = latest?.value?.mines?.[kind];
  // A newer revision, including one from another tab, already consumed this reserve.
  if (!state || state.revision !== revision) return;
  const projection = projectMineCollection(kind, state, clickedAt);
  if (projection.amount <= 0) return;

  const balanceQuery = kind === "gold" ? api.collection.gold : api.collection.diamonds;
  const balance = store.getQuery(balanceQuery, {});
  if (balance !== undefined)
    store.setQuery(balanceQuery, {}, balance + projection.amount);

  // Refresh keys may change during a request. Update every loaded version so
  // switching subscriptions cannot make a collected reserve reappear.
  for (const { args, value } of queries) {
    if (!value?.mines || value.mines[kind].revision !== revision) continue;
    store.setQuery(api.collection.mineBoard, args, {
      ...value,
      serverNow: Math.max(value.serverNow, projection.mine.updatedAt),
      mines: { ...value.mines, [kind]: projection.mine },
    });
  }
}
