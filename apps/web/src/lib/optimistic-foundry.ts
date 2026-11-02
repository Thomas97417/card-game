import type { OptimisticLocalStore } from 'convex/browser';
import type { FunctionArgs } from 'convex/server';
import { api } from '@my-better-t-app/backend/convex/_generated/api';
import { buyFoundrySkill } from '@sylve/game/foundry';

/** Convex replays pending purchases and removes this preview on confirmation or rejection. */
export function optimisticallyPurchaseFoundrySkill(
  store: OptimisticLocalStore,
  { expectedOwnerId, revision, skill }: FunctionArgs<typeof api.foundry.purchaseSkill>,
) {
  const user = store.getQuery(api.auth.getCurrentUser, {});
  if (user && String(user._id) !== expectedOwnerId) return;
  const queries = store.getAllQueries(api.foundry.board);
  const current = queries.reduce<(typeof queries)[number] | undefined>((latest, query) => {
    if (query.value?.ownerId !== expectedOwnerId || !query.value.progress) return latest;
    const saved = latest?.value?.progress;
    return !saved || query.value.progress.revision > saved.revision ||
      (query.value.progress.revision === saved.revision && query.value.serverNow > latest!.value!.serverNow)
      ? query : latest;
  }, undefined)?.value;
  const progress = current?.progress;
  if (!progress || progress.ownerId !== expectedOwnerId || progress.revision !== revision || current.round || progress.activeRoundId) return;
  let cycle;
  try { cycle = buyFoundrySkill(progress.cycle, skill); }
  catch { return; }

  // Refresh keys may change while requests are pending. Keep every loaded board consistent.
  for (const { args, value } of queries) {
    if (value?.ownerId !== expectedOwnerId || value.progress?._id !== progress._id || value.progress.revision !== revision) continue;
    store.setQuery(api.foundry.board, args, {
      ...value,
      progress: { ...value.progress, cycle, revision: revision + 1 },
    });
  }
}
