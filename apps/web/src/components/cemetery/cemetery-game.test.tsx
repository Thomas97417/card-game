import { act, fireEvent, render, screen } from "@testing-library/react";
import { useReducer } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCemeteryRun,
  stepCemetery,
  type CemeteryRun,
} from "@sylve/game/cemetery";
import { CemeteryGame } from "./cemetery-page";
import { CemeterySession } from "./cemetery-session";
const scene = vi.hoisted(() => ({
  create: vi.fn(),
  render: vi.fn(),
  destroy: vi.fn(),
  damage: vi.fn(),
}));
vi.mock("./cemetery-scene", () => ({ createCemeteryScene: scene.create }));
beforeEach(() => {
  vi.useFakeTimers();
  scene.create.mockResolvedValue({
    render: scene.render,
    destroy: scene.destroy,
    damage: scene.damage,
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function setup() {
  let server = createCemeteryRun(17),
    notify = () => {};
  const onError = vi.fn(),
    onFrame = vi.fn(),
    resume = vi.fn(async () => structuredClone(server)),
    pause = vi.fn(async () => {});
  const session = new CemeterySession({
    ownerId: "alice",
    runId: "run",
    leaseId: "lease",
    state: server,
    change: () => notify(),
    error: onError,
    frame: vi.fn(),
    resume,
    pause,
    submit: async (_lease, _start, inputs) => {
      inputs.forEach((i) => stepCemetery(server, i));
      return { state: structuredClone(server), acceptedTick: server.tick };
    },
    choose: async () => structuredClone(server),
    finish: async () => {},
  });
  function Harness() {
    const [, update] = useReducer((n) => n + 1, 0);
    notify = update;
    return (
      <CemeteryGame
        session={session}
        busy={false}
        error={null}
        rewardOpened={false}
        onError={onError}
        onFrame={onFrame}
        onMenu={vi.fn()}
        onImprove={vi.fn()}
        onReplay={vi.fn()}
        onOpen={vi.fn()}
        onReload={vi.fn()}
      />
    );
  }
  return {
    session,
    resume,
    pause,
    onError,
    Harness,
    server: () => server,
    replace: (state: CemeteryRun) => {
      server = state;
    },
  };
}
async function ready() {
  await act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
}
describe("les commandes de la survie", () => {
  it("moves with AZERTY keys, pauses on Escape and keeps keyboard focus in the pause dialog", async () => {
    const f = setup();
    render(<f.Harness />);
    await ready();
    expect(f.session.running).toBe(true);
    fireEvent.keyDown(window, { key: "z" });
    act(() => vi.advanceTimersByTime(200));
    expect(f.session.state.y).toBeLessThan(0);
    fireEvent.keyUp(window, { key: "z" });
    fireEvent.keyDown(window, { key: "Escape" });
    await ready();
    const tick = f.session.state.tick;
    act(() => vi.advanceTimersByTime(5000));
    expect(f.session.state.tick).toBe(tick);
    expect(f.pause).toHaveBeenCalled();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Reprendre" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Reprendre" }),
    );
    await ready();
    expect(f.session.running).toBe(true);
  });
  it("suspends active time when the document becomes hidden", async () => {
    const f = setup();
    render(<f.Harness />);
    await ready();
    act(() => vi.advanceTimersByTime(200));
    const tick = f.session.state.tick;
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    await ready();
    act(() => vi.advanceTimersByTime(5000));
    expect(f.session.running).toBe(false);
    expect(f.session.state.tick).toBe(tick);
  });
  it("does not advance a run when the graphics context cannot initialize", async () => {
    scene.create.mockRejectedValueOnce(new Error("WebGL unavailable"));
    const f = setup();
    render(<f.Harness />);
    await ready();
    expect(f.onError).toHaveBeenCalledWith(
      expect.stringContaining("rendu du cimetière"),
    );
    expect(f.resume).not.toHaveBeenCalled();
    expect(f.session.state.tick).toBe(0);
    expect(
      (
        screen.getByRole("button", {
          name: "Reprendre",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
