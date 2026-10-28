import { useRef } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameEvent } from "@sylve/game";
import { createBattleAudio } from "./battle-audio";
import { BattleAudioControls } from "./battle-audio-controls";
import { BATTLE_AUDIO_STORAGE_KEY, useBattleAudio } from "./use-battle-audio";

vi.mock("./battle-audio", () => ({ createBattleAudio: vi.fn() }));
const engine = {
  unlock: vi.fn(), setPreferences: vi.fn(), play: vi.fn(), cancelFrame: vi.fn(),
  finish: vi.fn(), setHidden: vi.fn(), destroy: vi.fn(),
};
const empty: GameEvent[] = [];
function Duel({ events = empty, outcome = null }: { events?: GameEvent[]; outcome?: boolean | null }) {
  const root = useRef<HTMLElement>(null);
  const audio = useBattleAudio(root, events, 0, outcome);
  return <main ref={root}><BattleAudioControls {...audio} /></main>;
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(createBattleAudio).mockReturnValue(engine);
});
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe("duel audio integration", () => {
  it("persists controls across duels and keeps audio available with reduced motion", async () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    localStorage.setItem(BATTLE_AUDIO_STORAGE_KEY, JSON.stringify({ enabled: false, volume: 0.35 }));
    const first = render(<Duel />);
    await waitFor(() => expect(createBattleAudio).toHaveBeenCalledOnce());
    expect(createBattleAudio).toHaveBeenCalledWith(expect.any(HTMLElement), { enabled: false, volume: 0.35 });
    const slider = screen.getByRole("slider", { name: "Volume du combat" }) as HTMLInputElement;
    expect(slider.disabled).toBe(true);
    expect(slider.value).toBe("35");
    fireEvent.pointerDown(window);
    fireEvent.click(screen.getByRole("button", { name: "Activer le son du combat" }));
    fireEvent.change(slider, { target: { value: "70" } });
    expect(engine.unlock).toHaveBeenCalledOnce();
    expect(engine.setPreferences).toHaveBeenLastCalledWith({ enabled: true, volume: 0.7 });
    expect(JSON.parse(localStorage.getItem(BATTLE_AUDIO_STORAGE_KEY)!)).toEqual({ enabled: true, volume: 0.7 });
    first.unmount();
    expect(engine.destroy).toHaveBeenCalledOnce();
    render(<Duel />);
    await waitFor(() => expect(createBattleAudio).toHaveBeenCalledTimes(2));
    expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("70");
  });

  it("forwards the playback clock and visibility, releases listeners and loads safely after unmount", async () => {
    const first = render(<Duel />);
    await waitFor(() => expect(createBattleAudio).toHaveBeenCalledOnce());
    const events: GameEvent[] = [{ seq: 1, type: "summon", player: 0 }];
    first.rerender(<Duel events={events} />);
    expect(engine.play).toHaveBeenLastCalledWith(events, expect.any(Number), 0);
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(engine.setHidden).toHaveBeenLastCalledWith(true);
    first.unmount();
    engine.unlock.mockClear();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(engine.unlock).not.toHaveBeenCalled();
    vi.mocked(createBattleAudio).mockClear();
    const late = render(<Duel />);
    late.unmount();
    await act(async () => {});
    expect(createBattleAudio).not.toHaveBeenCalled();
  });

  it("degrades gracefully with unavailable storage and forwards a settled result", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("private mode"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("private mode"); });
    const duel = render(<Duel />);
    await waitFor(() => expect(createBattleAudio).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Couper le son du combat" }));
    expect(screen.getByRole("button", { name: "Activer le son du combat" })).toBeTruthy();
    duel.rerender(<Duel outcome={false} />);
    expect(engine.finish).toHaveBeenCalledWith(false);
  });
});
