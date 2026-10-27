import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConvexProvider, ConvexReactClient, type Watch } from "convex/react";
import { HOUR_MS, type MineBoard } from "@sylve/game/mines";
import { useMineBoard } from "./use-mine-collection";

const board: MineBoard = {
  ownerId: "alice",
  serverNow: HOUR_MS,
  rank: 6, mineLevel: 1,
  mines: {
    gold: { amount: 6, updatedAt: HOUR_MS, heroLevel: 1, revision: 0 },
    emeralds: { amount: 2, updatedAt: HOUR_MS, heroLevel: 1, revision: 0 },
  },
};

/** Keep the real Convex hooks and subscription observer, replacing only
 * transport watches so this cannot open a connection or alter a real wallet. */
function setup() {
  const client = new ConvexReactClient("https://mines-test.convex.cloud");
  type Source = {
    value: MineBoard | undefined;
    listeners: Set<() => void>;
    watch: Watch<MineBoard>;
  };
  const sources = new Map<number, Source>();
  function source(key: number): Source {
    const existing = sources.get(key);
    if (existing) return existing;
    const listeners = new Set<() => void>();
    const entry: Source = {
      value: undefined,
      listeners,
      watch: {
        localQueryResult: () => sources.get(key)?.value,
        journal: () => undefined,
        onUpdate: (callback) => {
          listeners.add(callback);
          return () => { listeners.delete(callback); };
        },
      },
    };
    sources.set(key, entry);
    return entry;
  }
  vi.spyOn(client, "watchQuery").mockImplementation((...args: Parameters<ConvexReactClient["watchQuery"]>) =>
    source(args[1]?.refreshKey as number).watch,
  );
  function update(key: number, value: MineBoard) {
    source(key).value = value;
    act(() => {
      for (const listener of source(key).listeners) listener();
    });
  }
  function wrapper({ children }: { children: ReactNode }) {
    return <ConvexProvider client={client}>{children}</ConvexProvider>;
  }
  return { client, source, update, wrapper };
}

describe("abonnements réels des mines", () => {
  it("settles and rerenders without resubscribing or looping", async () => {
    const { client, source, wrapper } = setup();
    source(1).value = board;
    const { result, rerender, unmount } = renderHook(
      ({ refreshKey }) => useMineBoard(refreshKey),
      { initialProps: { refreshKey: 1 }, wrapper },
    );
    expect(result.current).toBe(board);
    const subscriptions = [...source(1).listeners];
    rerender({ refreshKey: 1 });
    expect(result.current).toBe(board);
    expect([...source(1).listeners]).toEqual(subscriptions);
    unmount();
    expect(source(1).listeners.size).toBe(0);
    await client.close();
  });

  it("keeps rollback reactive during refresh and releases the previous subscription", async () => {
    const { client, source, update, wrapper } = setup();
    source(1).value = board;
    const { result, rerender, unmount } = renderHook(
      ({ refreshKey }) => useMineBoard(refreshKey),
      { initialProps: { refreshKey: 1 }, wrapper },
    );
    rerender({ refreshKey: 2 });
    expect(result.current).toBe(board);
    const collected: MineBoard = {
      ...board,
      mines: {
        ...board.mines!,
        gold: { ...board.mines!.gold, amount: 0, revision: 1 },
      },
    };
    update(1, collected);
    expect(result.current).toBe(collected);
    update(1, board);
    expect(result.current).toBe(board);

    const refreshed = { ...board, serverNow: HOUR_MS + 30_000 };
    update(2, refreshed);
    expect(result.current).toBe(refreshed);
    expect(source(1).listeners.size).toBe(0);
    expect(source(2).listeners.size).toBe(2);
    unmount();
    expect(source(2).listeners.size).toBe(0);
    await client.close();
  });
});
