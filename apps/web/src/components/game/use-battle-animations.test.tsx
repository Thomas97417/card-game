import { useRef } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameEvent } from "@sylve/game";
import { useBattleAnimations } from "./use-battle-animations";
import { createBattleScene, type BattleScene } from "./battle-animations";

vi.mock("./battle-animations", () => ({ createBattleScene: vi.fn() }));

const events: GameEvent[] = [{ seq: 1, type: "summon", player: 0, cardId: "fox:common", row: 0, depth: 0 }];
let reduced = false;
let change: (() => void) | undefined;
let tick: FrameRequestCallback | undefined;
let scene: BattleScene;

function Arena() {
  const arena = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  useBattleAnimations(arena, host, events);
  return <section ref={(node) => {
    arena.current = node;
    if (node) Object.defineProperty(node, "clientWidth", { value: 1000, configurable: true });
  }}><div ref={host} /></section>;
}

beforeEach(() => {
  reduced = false;
  change = undefined;
  tick = undefined;
  scene = { play: vi.fn(), clear: vi.fn(), destroy: vi.fn() };
  vi.mocked(createBattleScene).mockResolvedValue(scene);
  vi.mocked(window.matchMedia).mockImplementation((query) => ({
    get matches() { return reduced; }, media: query,
    addEventListener: vi.fn((_event: string, listener: () => void) => { change = listener; }),
    removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { tick = callback; return 1; });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

describe("battle animation integration", () => {
  it("does not load the graphics engine when reduced motion is requested", async () => {
    reduced = true;
    render(<Arena />);
    await act(async () => {});
    expect(createBattleScene).not.toHaveBeenCalled();
  });

  it("starts after layout and tears down immediately when reduced motion changes", async () => {
    const { unmount } = render(<Arena />);
    await waitFor(() => expect(tick).toBeDefined());
    expect(scene.play).not.toHaveBeenCalled();
    act(() => tick!(performance.now()));
    expect(scene.play).toHaveBeenCalledWith(events, expect.any(Number));
    act(() => { reduced = true; change!(); });
    expect(scene.destroy).toHaveBeenCalledOnce();
    unmount();
    expect(scene.destroy).toHaveBeenCalledOnce();
  });

  it("aborts a pending initialization and destroys a late scene after leaving", async () => {
    let finish!: (scene: BattleScene) => void;
    vi.mocked(createBattleScene).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { unmount } = render(<Arena />);
    await waitFor(() => expect(createBattleScene).toHaveBeenCalledOnce());
    const signal = vi.mocked(createBattleScene).mock.calls[0]![2];
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => finish(scene));
    expect(scene.destroy).toHaveBeenCalledOnce();
    expect(scene.play).not.toHaveBeenCalled();
  });

  it("clears transient effects when the page is hidden", async () => {
    const { unmount } = render(<Arena />);
    await waitFor(() => expect(tick).toBeDefined());
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(scene.clear).toHaveBeenCalledOnce();
    unmount();
    expect(scene.destroy).toHaveBeenCalledOnce();
  });
});
