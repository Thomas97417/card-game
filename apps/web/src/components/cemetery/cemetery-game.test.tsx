import { act, fireEvent, render, screen } from "@testing-library/react";
import { useReducer } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCemeteryRun,
  stepCemetery,
  chooseCemeteryUpgrade,
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
function setup(initial = createCemeteryRun(17)) {
  let server = structuredClone(initial),
    notify = () => {};
  const onError = vi.fn(),
    onFrame = vi.fn(),
    resume = vi.fn(async (_lease: string, _expectedLeaseId?: string, _expectedTick?: number) => structuredClone(server)),
    pause = vi.fn(async () => {}),
    submit = vi.fn(async (_lease: string, _start: number, inputs: {x:number; y:number}[]) => {
      inputs.forEach((i) => stepCemetery(server, i));
      return { state: structuredClone(server), acceptedTick: server.tick };
    });
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
    submit,
    choose: async (_lease, _serial, choice) => {
      chooseCemeteryUpgrade(server, choice);
      return structuredClone(server);
    },
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
    submit,
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
  it("keeps Resume enabled during saving and closes the pause dialog before network confirmation",async()=>{
    const f=setup();render(<f.Harness/>);await ready();
    act(()=>vi.advanceTimersByTime(200));
    let release!:()=>void;
    f.pause.mockImplementationOnce(async()=>{await new Promise<void>(resolve=>{release=resolve;});});
    fireEvent.click(screen.getByRole("button",{name:"Mettre en pause"}));
    expect(f.session.running).toBe(false);
    const resume=screen.getByRole("button",{name:"Reprendre"}) as HTMLButtonElement;
    expect(resume.disabled).toBe(false);
    expect(document.activeElement).toBe(resume);
    await ready();
    expect(f.pause).toHaveBeenCalledOnce();
    fireEvent.click(resume);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(f.session.running).toBe(true);
    const tick=f.session.state.tick;
    act(()=>vi.advanceTimersByTime(100));
    expect(f.session.state.tick).toBeGreaterThan(tick);
    let paused!:Promise<void>;act(()=>{paused=f.session.pause();});
    release();
    await act(async()=>{await vi.advanceTimersByTimeAsync(1000);await paused;});
    expect(f.session.state).toEqual(f.server());
  });
  it("shows only the level heading and accepts a choice while the checkpoint is still saving", async () => {
    const initial = createCemeteryRun(17);
    initial.pickups = [{id:1,kind:"xp",x:0,y:0,value:5,eligible:false}];
    const f = setup(initial), submit = f.submit.getMockImplementation()!;
    let release!: () => void;
    f.submit.mockImplementationOnce(async (...args) => {
      await new Promise<void>((resolve) => { release = resolve; });
      return submit(...args);
    });
    render(<f.Harness />);
    await ready();
    act(() => vi.advanceTimersByTime(200));
    const dialog = screen.getByRole("dialog", {name:"NIVEAU 2"});
    expect(dialog.querySelector("h2")!.textContent).toBe("NIVEAU 2");
    expect(dialog.textContent).not.toContain("Un pouvoir s’éveille");
    expect(dialog.textContent).not.toContain("Choisis ce qui t’aidera");
    expect(dialog.textContent).not.toContain("Sauvegarde");
    const choice = dialog.querySelector("button")!;
    expect(choice.disabled).toBe(false);
    expect(document.activeElement).toBe(choice);
    fireEvent.click(choice);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(f.session.running).toBe(true);
    act(() => vi.advanceTimersByTime(200));
    expect(f.session.state.tick).toBeGreaterThan(1);
    const paused = f.session.pause();
    release();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); await paused; });
    expect(f.session.state).toEqual(f.server());
  });
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
