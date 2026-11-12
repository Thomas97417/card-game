import { describe, expect, it, vi } from "vitest";
import {
  CEMETERY,
  createCemeteryRun,
  stepCemetery,
  chooseCemeteryUpgrade,
  type CemeteryRun,
} from "@sylve/game/cemetery";
import { CemeterySession, cemeteryDraftKey } from "./cemetery-session";
function fixture(
  initial = createCemeteryRun(77),
  storage = new Map<string, string>(),
) {
  let server = structuredClone(initial);
  const options = {
    ownerId: "alice",
    runId: "run-1",
    leaseId: "original",
    state: initial,
    storage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    },
    submit: vi.fn(
      async (
        _lease: string,
        start: number,
        inputs: { x: number; y: number }[],
      ) => {
        if (server.tick !== start) throw new Error("conflit");
        for (const i of inputs) {
          stepCemetery(server, i);
          if (server.ended || server.choices.length) break;
        }
        return { state: structuredClone(server), acceptedTick: server.tick };
      },
    ),
    resume: vi.fn(async () => structuredClone(server)),
    pause: vi.fn(async () => {}),
    choose: vi.fn(async (_lease: string, _serial: number, choice: string) => {
      chooseCemeteryUpgrade(server, choice);
      return structuredClone(server);
    }),
    finish: vi.fn(async () => {}),
    change: vi.fn(),
    frame: vi.fn(),
    error: vi.fn(),
  };
  return {
    options,
    storage,
    session: new CemeterySession(options),
    server: () => server,
    replace: (s: CemeteryRun) => {
      server = s;
    },
  };
}
describe("la session de survie", () => {
  it("synchronizes predicted input batches and freezes while paused", async () => {
    const f = fixture();
    await f.session.resume(0);
    for (let t = 50; t <= 500; t += 50) f.session.advance(t, { x: 1000, y: 0 });
    await f.session.pause();
    const paused = structuredClone(f.session.state);
    f.session.advance(3600000, { x: 1000, y: 0 });
    expect(f.session.state).toEqual(paused);
    expect(f.server()).toEqual(paused);
    expect(f.options.pause).toHaveBeenCalledOnce();
    expect(f.storage.size).toBe(0);
  });
  it("replays only unconfirmed input from a draft scoped to its owner, run and lease", async () => {
    const f = fixture(),
      inputs = Array.from({ length: 8 }, () => ({ x: 500, y: -1000 }));
    f.storage.set(
      cemeteryDraftKey("alice", "run-1"),
      JSON.stringify({ version: 1, leaseId: "original", baseTick: 0, inputs }),
    );
    const reloaded = new CemeterySession(f.options);
    expect(reloaded.state.tick).toBe(8);
    expect(reloaded.running).toBe(false);
    await reloaded.resume(100);
    expect(f.options.submit).toHaveBeenCalledOnce();
    expect(f.server().tick).toBe(8);
    expect(reloaded.state).toEqual(f.server());
    const stranger = new CemeterySession({ ...f.options, ownerId: "bob" });
    expect(stranger.state.tick).toBe(0);
  });
  it("retains the draft on connection failure and confirms death only after the server accepts it", async () => {
    const f = fixture();
    await f.session.resume(0);
    f.options.submit.mockRejectedValueOnce(new Error("hors ligne"));
    f.session.advance(50, { x: 1000, y: 0 });
    await expect(f.session.flush()).rejects.toThrow("hors ligne");
    expect(f.session.running).toBe(false);
    expect(f.storage.size).toBe(1);
    expect(f.options.finish).not.toHaveBeenCalled();
    await f.session.flush();
    expect(f.storage.size).toBe(0);
    expect(f.session.state.tick).toBe(1);
  });
  it("stops on a level choice and resumes only after the choice is persisted", async () => {
    const state = createCemeteryRun(77);
    state.pickups = [
      { id: 1, kind: "xp", x: 0, y: 0, value: 5, eligible: false },
    ];
    const f = fixture(state);
    await f.session.resume(0);
    f.session.advance(50, { x: 0, y: 0 });
    await f.session.flush();
    expect(f.session.running).toBe(false);
    expect(f.session.state.choices.length).toBeGreaterThan(0);
    const serial = f.session.state.choiceSerial;
    await f.session.choose(f.session.state.choices[0]!);
    expect(f.options.choose).toHaveBeenCalledWith(
      expect.any(String),
      serial,
      expect.any(String),
    );
    expect(f.session.running).toBe(true);
    expect(f.session.state.choices).toEqual([]);
  });
  it("bounds unconfirmed input during a stalled connection", async () => {
    const f = fixture();
    await f.session.resume(0);
    let release!: () => void;
    f.options.submit.mockImplementationOnce(async (_lease, start, inputs) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      for (const i of inputs) stepCemetery(f.server(), i);
      return {
        state: structuredClone(f.server()),
        acceptedTick: start + inputs.length,
      };
    });
    for (let t = 50; t <= (CEMETERY.maxDraftInputs + 10) * 50; t += 50)
      f.session.advance(t, { x: 1000, y: 0 });
    expect(f.session.running).toBe(false);
    expect(f.session.state.tick).toBe(CEMETERY.maxDraftInputs);
    release();
    await f.session.flush();
    expect(f.storage.size).toBe(0);
  });
});
