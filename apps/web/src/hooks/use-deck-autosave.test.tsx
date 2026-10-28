import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { DEFAULT_DECK } from "@sylve/game";
import { useDeckAutosave, type DeckSave } from "./use-deck-autosave";

const original: DeckSave = {
  deckId: "deck" as Id<"decks">,
  name: "Sylve",
  cardIds: [...DEFAULT_DECK],
};
const renamed = (name: string) => ({ ...original, name });
function deferred() {
  let resolve!: (value?: unknown) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("automatic deck persistence", () => {
  it("confirms a retained revert when the failed intermediate edit never reached the server", async () => {
    const first = deferred();
    const save = vi.fn().mockReturnValueOnce(first.promise);
    const persisted = vi.fn();
    const { result } = renderHook(() => useDeckAutosave(save, persisted));
    act(() => {
      result.current.initialize(original);
      result.current.enqueue(renamed("Intermédiaire"));
      result.current.enqueue(original);
    });
    await act(async () => {
      first.reject(new Error("Offline"));
      await result.current.flush();
    });
    expect(persisted).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(save).toHaveBeenCalledOnce();
    expect(persisted).toHaveBeenCalledExactlyOnceWith(original);
    expect(result.current.status).toBe("saved");
  });

  it("does not rewrite the loaded snapshot or an identical edit", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeckAutosave(save));
    act(() => {
      result.current.initialize(original);
      result.current.enqueue(original);
    });
    expect(save).not.toHaveBeenCalled();
    expect(result.current.hasPendingChanges()).toBe(false);
  });

  it("starts immediately, coalesces rapid changes, and flushes the latest edit before navigation", async () => {
    const first = deferred();
    const save = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeckAutosave(save));
    act(() => {
      result.current.initialize(original);
      result.current.enqueue(renamed("Premier"));
      result.current.enqueue(renamed("Intermédiaire"));
      result.current.enqueue(renamed("Dernier"));
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("saving");
    expect(result.current.hasPendingChanges()).toBe(true);
    let flushed = false;
    const completion = result.current.flush().then((success) => {
      flushed = success;
    });
    expect(flushed).toBe(false);
    await act(async () => {
      first.resolve();
      await completion;
    });
    expect(save.mock.calls.map(([snapshot]) => snapshot.name)).toEqual([
      "Premier",
      "Dernier",
    ]);
    expect(flushed).toBe(true);
    expect(result.current.status).toBe("saved");
    expect(result.current.hasPendingChanges()).toBe(false);
  });

  it("retries the newest pending edit after a failed older write", async () => {
    const first = deferred();
    const save = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeckAutosave(save));
    act(() => {
      result.current.initialize(original);
      result.current.enqueue(renamed("Ancien"));
      result.current.enqueue(renamed("Dernier"));
    });
    let flushed!: boolean;
    await act(async () => {
      first.reject(new Error("Offline"));
      flushed = await result.current.flush();
    });
    expect(flushed).toBe(false);
    expect(result.current.status).toBe("error");
    expect(result.current.hasPendingChanges()).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(save.mock.calls.map(([snapshot]) => snapshot.name)).toEqual([
      "Ancien",
      "Dernier",
    ]);
    expect(result.current.status).toBe("saved");
    expect(result.current.hasPendingChanges()).toBe(false);
  });

  it("persists a revert even when the intermediate edit is still in flight", async () => {
    const first = deferred();
    const save = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeckAutosave(save));
    act(() => {
      result.current.initialize(original);
      result.current.enqueue(renamed("Autre"));
      result.current.enqueue(original);
    });
    await act(async () => {
      first.resolve();
      await result.current.flush();
    });
    expect(save.mock.calls.map(([snapshot]) => snapshot.name)).toEqual([
      "Autre",
      "Sylve",
    ]);
    expect(result.current.status).toBe("saved");
  });

  it("keeps draining queued writes after an unmount without updating React state", async () => {
    const first = deferred();
    const save = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useDeckAutosave(save));
    act(() => {
      result.current.initialize(original);
      result.current.enqueue(renamed("Premier"));
      result.current.enqueue(renamed("Dernier"));
    });
    const completion = result.current.flush();
    unmount();
    first.resolve();
    expect(await completion).toBe(true);
    expect(save.mock.calls.map(([snapshot]) => snapshot.name)).toEqual([
      "Premier",
      "Dernier",
    ]);
  });
});
