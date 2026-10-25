import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FunctionReturnType } from "convex/server";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { HOUR_MS, type MineBoard } from "@sylve/game/mines";
import { useMineBoard, useMineCollection } from "./use-mine-collection";

const mocks = vi.hoisted(() => ({
  collect: vi.fn(), optimistic: vi.fn(), gain: vi.fn(), dismiss: vi.fn(), error: vi.fn(), queries: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useMutation: () => ({ withOptimisticUpdate: mocks.optimistic }),
  useQueries: mocks.queries,
}));
vi.mock("@/components/currency-gain", () => ({ useCurrencyGain: () => mocks.gain }));
vi.mock("@/components/game/shared", () => ({ showGameError: mocks.error }));

type Result = FunctionReturnType<typeof api.collection.collectMine>;
function deferred() {
  let resolve!: (value: Result) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Result>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const board: MineBoard = {
  serverNow: 4 * HOUR_MS,
  heroLevel: 1,
  mines: {
    gold: { amount: 0, updatedAt: 3 * HOUR_MS, heroLevel: 1, revision: 0 },
    emeralds: { amount: 0, updatedAt: 3 * HOUR_MS, heroLevel: 1, revision: 0 },
  },
};
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["performance"] });
  vi.clearAllMocks();
  mocks.gain.mockReturnValue(mocks.dismiss);
  mocks.optimistic.mockReturnValue(mocks.collect);
});
afterEach(() => vi.useRealTimers());

describe("collecte immédiate avec confirmation serveur", () => {
  it("reflects a rollback even while a new refresh key is still loading", () => {
    mocks.queries.mockReturnValue({ current: board, previous: board });
    const { result, rerender } = renderHook(({ refreshKey }) => useMineBoard(refreshKey), {
      initialProps: { refreshKey: 1 },
    });
    const optimistic = {
      ...board,
      mines: { ...board.mines!, gold: { ...board.mines!.gold, amount: 0, updatedAt: board.serverNow, revision: 1 } },
    };
    mocks.queries.mockReturnValue({ current: undefined, previous: optimistic });
    rerender({ refreshKey: 2 });
    expect(result.current).toBe(optimistic);
    expect(mocks.queries.mock.calls.at(-1)![0].previous.args.refreshKey).toBe(1);
    mocks.queries.mockReturnValue({ current: undefined, previous: board });
    rerender({ refreshKey: 2 });
    expect(result.current).toBe(board);
    const refreshed = { ...board, serverNow: board.serverNow + 30_000 };
    mocks.queries.mockReturnValue({ current: refreshed, previous: board });
    rerender({ refreshKey: 2 });
    expect(result.current).toBe(refreshed);
    expect(mocks.queries.mock.calls.at(-1)![0].previous.args.refreshKey).toBe(2);
  });

  it("animates before the response, blocks double clicks and does not replay a confirmed gain", async () => {
    const request = deferred();
    mocks.collect.mockReturnValue(request.promise);
    const { result } = renderHook(() => useMineCollection(board));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.collectResource("gold");
      void result.current.collectResource("gold");
    });
    expect(mocks.gain).toHaveBeenCalledWith("gold", 6);
    expect(mocks.collect).toHaveBeenCalledExactlyOnceWith({ kind: "gold", revision: 0 });
    expect(mocks.optimistic).toHaveBeenCalledWith(expect.any(Function));
    expect(result.current.pending).toEqual(["gold"]);
    await act(async () => {
      request.resolve({ kind: "gold", amount: 6, alreadyCollected: false });
      await pending;
    });
    expect(mocks.gain).toHaveBeenCalledTimes(1);
    expect(mocks.dismiss).not.toHaveBeenCalled();
    expect(result.current.pending).toEqual([]);
  });

  it("cancels a failed animation, reports the error and allows retrying the same revision", async () => {
    const request = deferred();
    mocks.collect.mockReturnValue(request.promise);
    const { result } = renderHook(() => useMineCollection(board));
    let pending!: Promise<void>;
    act(() => { pending = result.current.collectResource("gold"); });
    const error = new Error("Collecte refusée");
    await act(async () => { request.reject(error); await pending; });
    expect(mocks.dismiss).toHaveBeenCalledOnce();
    expect(mocks.error).toHaveBeenCalledWith(error);
    expect(result.current.pending).toEqual([]);
    mocks.collect.mockResolvedValue({ kind: "gold", amount: 6, alreadyCollected: false });
    await act(async () => { await result.current.collectResource("gold"); });
    expect(mocks.collect).toHaveBeenCalledTimes(2);
    expect(mocks.collect).toHaveBeenLastCalledWith({ kind: "gold", revision: 0 });
  });

  it("collects both mines independently and only cancels the rejected currency", async () => {
    const gold = deferred(), emeralds = deferred();
    const dismissGold = vi.fn(), dismissEmeralds = vi.fn();
    mocks.collect.mockReturnValueOnce(gold.promise).mockReturnValueOnce(emeralds.promise);
    mocks.gain.mockReturnValueOnce(dismissGold).mockReturnValueOnce(dismissEmeralds);
    const { result } = renderHook(() => useMineCollection(board));
    let first!: Promise<void>, second!: Promise<void>;
    act(() => {
      first = result.current.collectResource("gold");
      second = result.current.collectResource("emeralds");
    });
    expect(result.current.pending).toEqual(["gold", "emeralds"]);
    expect(mocks.gain.mock.calls).toEqual([["gold", 6], ["emeralds", 2]]);
    await act(async () => {
      gold.resolve({ kind: "gold", amount: 6, alreadyCollected: false });
      await first;
    });
    expect(result.current.pending).toEqual(["emeralds"]);
    await act(async () => { emeralds.reject(new Error("Refusée")); await second; });
    expect(dismissGold).not.toHaveBeenCalled();
    expect(dismissEmeralds).toHaveBeenCalledOnce();
    expect(result.current.pending).toEqual([]);
  });

  it.each([0, 7])("reconciles the animation with a server reward of %i", async (amount) => {
    mocks.collect.mockResolvedValue({ kind: "gold", amount, alreadyCollected: amount === 0 });
    const { result } = renderHook(() => useMineCollection(board));
    await act(async () => { await result.current.collectResource("gold"); });
    expect(mocks.dismiss).toHaveBeenCalledOnce();
    expect(mocks.gain.mock.calls).toEqual(amount === 0 ? [["gold", 6]] : [["gold", 6], ["gold", 7]]);
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("does not send a collection while the board is missing or the reserve is empty", async () => {
    const { result, rerender } = renderHook(({ data }) => useMineCollection(data), {
      initialProps: { data: undefined as MineBoard | undefined },
    });
    await act(async () => { await result.current.collectResource("gold"); });
    rerender({ data: { ...board, serverNow: board.mines!.gold.updatedAt } });
    await act(async () => { await result.current.collectResource("gold"); });
    expect(mocks.collect).not.toHaveBeenCalled();
    expect(mocks.gain).not.toHaveBeenCalled();
  });
});
