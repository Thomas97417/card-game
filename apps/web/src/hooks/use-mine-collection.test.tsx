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
  ownerId: "alice",
  serverNow: 4 * HOUR_MS,
  rank: 6, mineLevel: 1,
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
    expect(mocks.collect).toHaveBeenCalledExactlyOnceWith({ kind: "gold", revision: 0, expectedOwnerId: board.ownerId });
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
    expect(mocks.collect).toHaveBeenLastCalledWith({ kind: "gold", revision: 0, expectedOwnerId: board.ownerId });
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

  it.each(["success", "failure"])("ignores a late %s after leaving the hub and dismisses its animation", async (outcome) => {
    const request = deferred();
    mocks.collect.mockReturnValue(request.promise);
    const { result, unmount } = renderHook(() => useMineCollection(board));
    const collectResource = result.current.collectResource;
    let pending!: Promise<void>;
    act(() => { pending = collectResource("gold"); });
    unmount();
    expect(mocks.dismiss).toHaveBeenCalledOnce();
    await collectResource("emeralds");
    await act(async () => {
      if (outcome === "success") request.resolve({ kind: "gold", amount: 7, alreadyCollected: false });
      else request.reject(new Error("Connecte-toi pour jouer."));
      await pending;
    });
    expect(mocks.collect).toHaveBeenCalledOnce();
    expect(mocks.gain).toHaveBeenCalledOnce();
    expect(mocks.dismiss).toHaveBeenCalledOnce();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("isolates a new account from the previous account's pending response and click handler", async () => {
    const first = deferred(), second = deferred();
    const dismissFirst = vi.fn(), dismissSecond = vi.fn();
    mocks.collect.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    mocks.gain.mockReturnValueOnce(dismissFirst).mockReturnValueOnce(dismissSecond);
    const { result, rerender } = renderHook(({ data }) => useMineCollection(data), { initialProps: { data: board } });
    const staleClick = result.current.collectResource;
    let oldPending!: Promise<void>, newPending!: Promise<void>;
    act(() => { oldPending = staleClick("gold"); });
    rerender({ data: { ...board, ownerId: "bob" } });
    expect(dismissFirst).toHaveBeenCalledOnce();
    expect(result.current.pending).toEqual([]);
    await staleClick("gold");
    act(() => { newPending = result.current.collectResource("gold"); });
    await act(async () => {
      first.resolve({ kind: "gold", amount: 7, alreadyCollected: false });
      await oldPending;
    });
    expect(result.current.pending).toEqual(["gold"]);
    await result.current.collectResource("gold");
    expect(mocks.collect).toHaveBeenCalledTimes(2);
    expect(mocks.collect.mock.calls.map(([args]) => args.expectedOwnerId)).toEqual(["alice", "bob"]);
    expect(mocks.gain).toHaveBeenCalledTimes(2);
    await act(async () => { second.reject(new Error("Refusée")); await newPending; });
    expect(dismissSecond).toHaveBeenCalledOnce();
    expect(result.current.pending).toEqual([]);
  });

  it("keeps a newly produced coin collectible after an optimistic rollback", async () => {
    const request = deferred();
    const snapshot: MineBoard = { ...board, serverNow: 599_000, mines: {
      gold: { amount: 0, updatedAt: 0, heroLevel: 1, revision: 0 },
      emeralds: { amount: 0, updatedAt: 0, heroLevel: 1, revision: 0 },
    } };
    mocks.collect.mockReturnValueOnce(request.promise);
    const { result, rerender } = renderHook(({ data }) => useMineCollection(data), { initialProps: { data: snapshot } });
    act(() => vi.advanceTimersByTime(1000));
    let pending!: Promise<void>;
    act(() => { pending = result.current.collectResource("gold"); });
    rerender({ data: { ...snapshot, serverNow: 600_000, mines: {
      ...snapshot.mines!, gold: { ...snapshot.mines!.gold, updatedAt: 600_000, revision: 1 },
    } } });
    act(() => vi.advanceTimersByTime(1000));
    await act(async () => { request.reject(new Error("Refusée")); await pending; });
    rerender({ data: snapshot });
    mocks.collect.mockResolvedValue({ kind: "gold", amount: 1, alreadyCollected: false });
    await act(async () => { await result.current.collectResource("gold"); });
    expect(mocks.collect).toHaveBeenCalledTimes(2);
    expect(mocks.gain.mock.calls).toEqual([["gold", 1], ["gold", 1]]);
  });

  it("does not let an obsolete refresh error hide a current valid result", () => {
    mocks.queries.mockReturnValue({ current: board, previous: new Error("Ancienne requête refusée") });
    const { result, rerender } = renderHook(() => useMineBoard(2));
    expect(result.current).toBe(board);
    mocks.queries.mockReturnValue({ current: undefined, previous: new Error("Ancienne requête refusée") });
    rerender();
    expect(result.current).toBeUndefined();
  });
});
