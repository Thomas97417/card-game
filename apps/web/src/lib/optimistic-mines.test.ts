import { describe, expect, it, vi } from "vitest";
import type { OptimisticLocalStore } from "convex/browser";
import { getFunctionName, type FunctionReference } from "convex/server";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { HOUR_MS, type MineBoard } from "@sylve/game/mines";
import { optimisticallyCollectMine, projectMineCollection } from "./optimistic-mines";

const board: MineBoard = {
  ownerId: "alice",
  serverNow: 4 * HOUR_MS,
  rank: 6, mineLevel: 1,
  mines: {
    gold: { amount: 0, updatedAt: 3 * HOUR_MS, heroLevel: 1, revision: 0 },
    emeralds: { amount: 0, updatedAt: 3 * HOUR_MS, heroLevel: 1, revision: 0 },
  },
};

function setup() {
  const cache = new Map<string, { name: string; args: unknown; value: unknown }>();
  const key = (query: FunctionReference<"query">, args: unknown) =>
    `${getFunctionName(query)}:${JSON.stringify(args)}`;
  const store: OptimisticLocalStore = {
    getQuery: vi.fn().mockImplementation((query, args) => cache.get(key(query, args))?.value),
    getAllQueries: vi.fn().mockImplementation((query) =>
      [...cache.values()].filter((entry) => entry.name === getFunctionName(query))
        .map(({ args, value }) => ({ args, value })),
    ),
    setQuery: vi.fn().mockImplementation((query, args, value) => {
      cache.set(key(query, args), { name: getFunctionName(query), args, value });
    }),
  };
  cache.set(key(api.auth.getCurrentUser, {}), { name: "auth:getCurrentUser", args: {}, value: { _id: board.ownerId } });
  store.setQuery(api.collection.gold, {}, 100);
  store.setQuery(api.collection.diamonds, {}, 200);
  store.setQuery(api.collection.mineBoard, { refreshKey: 1 }, structuredClone(board));
  store.setQuery(api.collection.mineBoard, { refreshKey: 2 }, structuredClone(board));
  vi.mocked(store.setQuery).mockClear();
  return store;
}

describe("collecte optimiste des mines", () => {
  it.each(["gold", "emeralds"] as const)("credits %s immediately and empties every cached refresh key", (kind) => {
    const store = setup();
    const original = structuredClone(store.getQuery(api.collection.mineBoard, { refreshKey: 1 }));
    const source = store.getQuery(api.collection.mineBoard, { refreshKey: 1 });
    optimisticallyCollectMine(store, { kind, revision: 0, expectedOwnerId: board.ownerId }, board.serverNow);
    expect(store.getQuery(api.collection.gold, {})).toBe(kind === "gold" ? 106 : 100);
    expect(store.getQuery(api.collection.diamonds, {})).toBe(kind === "emeralds" ? 202 : 200);
    for (const refreshKey of [1, 2]) {
      const next = store.getQuery(api.collection.mineBoard, { refreshKey })!;
      expect(next.mines![kind]).toMatchObject({ amount: 0, revision: 1, updatedAt: board.serverNow });
      const other = kind === "gold" ? "emeralds" : "gold";
      expect(next.mines![other]).toEqual(board.mines![other]);
    }
    expect(source).toEqual(original);
  });

  it("retains fractional resources and respects the server production cap", () => {
    const projection = projectMineCollection("gold", board.mines!.gold, board.serverNow + HOUR_MS / 4);
    expect(projection.amount).toBe(7);
    expect(projection.mine.amount).toBe(0.5);
    const capped = projectMineCollection("gold", board.mines!.gold, board.serverNow + 12 * HOUR_MS);
    expect(capped.amount).toBe(48);
    expect(capped.mine.amount).toBe(0);
  });

  it("never credits a revision twice when an optimistic update is replayed", () => {
    const store = setup();
    optimisticallyCollectMine(store, { kind: "gold", revision: 0, expectedOwnerId: board.ownerId }, board.serverNow);
    const updates = vi.mocked(store.setQuery).mock.calls.length;
    optimisticallyCollectMine(store, { kind: "gold", revision: 0, expectedOwnerId: board.ownerId }, board.serverNow);
    expect(store.setQuery).toHaveBeenCalledTimes(updates);
    expect(store.getQuery(api.collection.gold, {})).toBe(106);
  });

  it("supports both currencies in flight without overwriting either reserve or balance", () => {
    const store = setup();
    optimisticallyCollectMine(store, { kind: "gold", revision: 0, expectedOwnerId: board.ownerId }, board.serverNow);
    optimisticallyCollectMine(store, { kind: "emeralds", revision: 0, expectedOwnerId: board.ownerId }, board.serverNow);
    expect(store.getQuery(api.collection.gold, {})).toBe(106);
    expect(store.getQuery(api.collection.diamonds, {})).toBe(202);
    const next = store.getQuery(api.collection.mineBoard, { refreshKey: 2 })!;
    expect(next.mines!.gold).toMatchObject({ amount: 0, revision: 1 });
    expect(next.mines!.emeralds).toMatchObject({ amount: 0, revision: 1 });
  });

  it("defers to a server revision already collected in another tab, even with an older refresh key", () => {
    const store = setup();
    store.setQuery(api.collection.mineBoard, { refreshKey: 2 }, {
      ...board, serverNow: board.serverNow - 1000,
      mines: { ...board.mines!, gold: { ...board.mines!.gold, revision: 1 } },
    });
    vi.mocked(store.setQuery).mockClear();
    optimisticallyCollectMine(store, { kind: "gold", revision: 0, expectedOwnerId: board.ownerId }, board.serverNow);
    expect(store.setQuery).not.toHaveBeenCalled();
  });

  it("does not invent a loading balance or consume an empty or uninitialized mine", () => {
    const store = setup();
    store.setQuery(api.collection.gold, {}, undefined);
    optimisticallyCollectMine(store, { kind: "gold", revision: 0, expectedOwnerId: board.ownerId }, board.serverNow);
    expect(store.getQuery(api.collection.gold, {})).toBeUndefined();
    const empty = { ...board, mines: null };
    store.setQuery(api.collection.mineBoard, { refreshKey: 1 }, empty);
    store.setQuery(api.collection.mineBoard, { refreshKey: 2 }, undefined);
    vi.mocked(store.setQuery).mockClear();
    optimisticallyCollectMine(store, { kind: "emeralds", revision: 0, expectedOwnerId: board.ownerId }, board.serverNow);
    expect(store.setQuery).not.toHaveBeenCalled();
    store.setQuery(api.collection.mineBoard, { refreshKey: 1 }, board);
    vi.mocked(store.setQuery).mockClear();
    optimisticallyCollectMine(store, { kind: "gold", revision: 0, expectedOwnerId: board.ownerId }, board.mines!.gold.updatedAt);
    expect(store.setQuery).not.toHaveBeenCalled();
  });

  it("does not apply an old account's optimism to another account's data", () => {
    const store = setup();
    vi.mocked(store.getQuery).mockReturnValue({ _id: "bob" });
    optimisticallyCollectMine(store, { kind: "gold", revision: 0, expectedOwnerId: board.ownerId }, board.serverNow);
    expect(store.setQuery).not.toHaveBeenCalled();
  });

  it("ignores cached boards belonging to another account", () => {
    const store = setup();
    store.setQuery(api.collection.mineBoard, { refreshKey: 2 }, {
      ...board, ownerId: "bob", serverNow: board.serverNow + 1000,
      mines: { ...board.mines!, gold: { ...board.mines!.gold, revision: 99 } },
    });
    vi.mocked(store.setQuery).mockClear();
    optimisticallyCollectMine(store, { kind: "gold", revision: 0, expectedOwnerId: board.ownerId }, board.serverNow);
    expect(store.getQuery(api.collection.gold, {})).toBe(106);
    expect(store.getQuery(api.collection.mineBoard, { refreshKey: 2 })!.mines!.gold.revision).toBe(99);
  });
});
