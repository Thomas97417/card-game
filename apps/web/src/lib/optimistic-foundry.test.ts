import { describe, expect, it, vi } from 'vitest';
import type { OptimisticLocalStore } from 'convex/browser';
import { getFunctionName, type FunctionReference, type FunctionReturnType } from 'convex/server';
import { api } from '@my-better-t-app/backend/convex/_generated/api';
import type { Id } from '@my-better-t-app/backend/convex/_generated/dataModel';
import { newFoundryCycle } from '@sylve/game/foundry';
import { optimisticallyPurchaseFoundrySkill } from './optimistic-foundry';

type Board = FunctionReturnType<typeof api.foundry.board>;
function setup() {
  const board: Board = {
    ownerId: 'alice', serverNow: 1000, round: null, pendingReward: null,
    daily: { day: '2026-11-02', delivered: 0, claimed: false },
    progress: { _id: 'progress' as Id<'foundryProgress'>, _creationTime: 1000, ownerId: 'alice', revision: 8, mastery: 0, cycle: { ...newFoundryCycle(), shards: 13 } },
  };
  const cache = new Map<string, { name: string; args: unknown; value: unknown }>();
  const key = (query: FunctionReference<'query'>, args: unknown) => getFunctionName(query) + ':' + JSON.stringify(args);
  const store: OptimisticLocalStore = {
    getQuery: vi.fn().mockImplementation((query, args) => cache.get(key(query, args))?.value),
    getAllQueries: vi.fn().mockImplementation(query => [...cache.values()].filter(entry => entry.name === getFunctionName(query)).map(({ args, value }) => ({ args, value }))),
    setQuery: vi.fn().mockImplementation((query, args, value) => { cache.set(key(query, args), { name: getFunctionName(query), args, value }); }),
  };
  store.setQuery(api.auth.getCurrentUser, {}, { _id: 'alice' } as never);
  for (const refreshKey of [1, 2]) store.setQuery(api.foundry.board, { refreshKey }, structuredClone(board));
  vi.mocked(store.setQuery).mockClear();
  return { store, board, read: (refreshKey = 1) => store.getQuery(api.foundry.board, { refreshKey })! };
}
const root = { expectedOwnerId: 'alice', revision: 8, skill: 'smash-damage-1' as const };
const loot = { expectedOwnerId: 'alice', revision: 9, skill: 'fortune-loot-1' as const };

describe('les achats optimistes de compétences', () => {
  it('updates every refresh key immutably and supports consecutive purchases with the actual remaining balance', () => {
    const { store, read } = setup(), original = read(), snapshot = structuredClone(original);
    optimisticallyPurchaseFoundrySkill(store, root);
    expect(read().progress).toMatchObject({ revision: 9, cycle: { shards: 12, skills: ['smash-damage-1'] } });
    optimisticallyPurchaseFoundrySkill(store, loot);
    for (const refreshKey of [1, 2]) expect(read(refreshKey).progress).toMatchObject({ revision: 10, cycle: { shards: 0, skills: ['smash-damage-1', 'fortune-loot-1'] } });
    expect(original).toEqual(snapshot);
    vi.mocked(store.setQuery).mockClear();
    optimisticallyPurchaseFoundrySkill(store, { expectedOwnerId: 'alice', revision: 10, skill: 'frenzy-speed-1' });
    expect(store.setQuery).not.toHaveBeenCalled();
  });
  it('does not charge twice when replayed or when the skill is already owned', () => {
    const { store, read } = setup();
    optimisticallyPurchaseFoundrySkill(store, root);
    vi.mocked(store.setQuery).mockClear();
    optimisticallyPurchaseFoundrySkill(store, root);
    optimisticallyPurchaseFoundrySkill(store, { ...root, revision: 9 });
    expect(store.setQuery).not.toHaveBeenCalled();
    expect(read().progress!.cycle.shards).toBe(12);
  });
  it('leaves a dependent purchase unapplied when its optimistic prerequisite has been rolled back', () => {
    const { store, read } = setup();
    // After rejection, Convex replays remaining updates on the authoritative cache.
    optimisticallyPurchaseFoundrySkill(store, loot);
    expect(store.setQuery).not.toHaveBeenCalled();
    expect(read().progress).toMatchObject({ revision: 8, cycle: { shards: 13, skills: [] } });
    optimisticallyPurchaseFoundrySkill(store, root);
    optimisticallyPurchaseFoundrySkill(store, loot);
    expect(read().progress!.cycle.shards).toBe(0);
  });
  it('defers to a newer server revision even if another refresh key still has an older result', () => {
    const { store, board } = setup();
    store.setQuery(api.foundry.board, { refreshKey: 2 }, { ...board, serverNow: 999, progress: { ...board.progress!, revision: 10 } });
    vi.mocked(store.setQuery).mockClear();
    optimisticallyPurchaseFoundrySkill(store, root);
    expect(store.setQuery).not.toHaveBeenCalled();
  });
  it.each(['round', 'choices', 'completed', 'unaffordable'] as const)('does not preview a forbidden purchase: %s', reason => {
    const { store, board } = setup();
    const progress = { ...board.progress!, cycle: { ...board.progress!.cycle } };
    if (reason === 'round') progress.activeRoundId = 'active' as Id<'foundryRounds'>;
    if (reason === 'choices') progress.cycle.choices = ['power'];
    if (reason === 'completed') progress.cycle.status = 'completed';
    if (reason === 'unaffordable') progress.cycle.shards = 0;
    for (const refreshKey of [1, 2]) store.setQuery(api.foundry.board, { refreshKey }, { ...board, progress });
    vi.mocked(store.setQuery).mockClear();
    optimisticallyPurchaseFoundrySkill(store, root);
    expect(store.setQuery).not.toHaveBeenCalled();
  });
  it('does not apply an old account’s purchase after the account changes', () => {
    const { store } = setup();
    store.setQuery(api.auth.getCurrentUser, {}, { _id: 'bob' } as never);
    vi.mocked(store.setQuery).mockClear();
    optimisticallyPurchaseFoundrySkill(store, root);
    expect(store.setQuery).not.toHaveBeenCalled();
  });
  it('keeps historical prices for a saved chantier', () => {
    const { store, board, read } = setup();
    for (const refreshKey of [1, 2]) store.setQuery(api.foundry.board, { refreshKey }, {
      ...board, progress: { ...board.progress!, cycle: { ...board.progress!.cycle, economy: 3, shards: 500 } },
    });
    optimisticallyPurchaseFoundrySkill(store, { ...root, skill: 'forge-grip' });
    expect(read().progress!.cycle.shards).toBe(200);
  });
});
