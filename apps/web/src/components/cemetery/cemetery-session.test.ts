import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CEMETERY,
  createCemeteryRun,
  stepCemetery,
  chooseCemeteryUpgrade,
  offerCemeteryLevel,
  type CemeteryRun,
} from "@sylve/game/cemetery";
import { CemeterySession, cemeteryDraftKey } from "./cemetery-session";
function fixture(
  initial = createCemeteryRun(77),
  storage = new Map<string, string>(),
) {
  let server = structuredClone(initial);
  const savedChoices = new Map<number, string>();
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
    resume: vi.fn(async (_lease: string, _expectedLeaseId?: string, _expectedTick?: number) => structuredClone(server)),
    pause: vi.fn(async (_lease: string, _expectedTick?: number) => {}),
    choose: vi.fn(async (_lease: string, serial: number, choice: string) => {
      if (savedChoices.has(serial)) {
        if (savedChoices.get(serial) !== choice) throw new Error("conflit");
      } else {
        if (server.choiceSerial !== serial) throw new Error("conflit");
        chooseCemeteryUpgrade(server, choice);
        savedChoices.set(serial, choice);
      }
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
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });
describe("la session de survie", () => {
  it("resumes immediately while the pause and resume acknowledgements are delayed, excluding time spent paused", async () => {
    const f = fixture();
    await f.session.resume(0);
    f.session.advance(50, {x:1000,y:0});
    await f.session.flush();
    const pauseGate = deferred(), resumeGate = deferred(),
      resume = f.options.resume.getMockImplementation()!;
    f.options.pause.mockImplementationOnce(async () => { await pauseGate.promise; });
    f.options.resume.mockImplementationOnce(async (...args) => {
      await resumeGate.promise;
      return resume(...args);
    });
    const paused = f.session.pause();
    const before = structuredClone(f.session.state);
    vi.advanceTimersByTime(10000);
    f.session.advance(10050, {x:1000,y:0});
    expect(f.session.state).toEqual(before);
    const resumed = f.session.resume(10050);
    expect(f.session.running).toBe(true);
    expect(f.session.saving).toBe(true);
    f.session.advance(10100, {x:1000,y:0});
    f.session.advance(10200, {x:1000,y:0});
    const predicted = structuredClone(f.session.state);
    expect(predicted.tick).toBe(4);
    pauseGate.resolve();
    for (let i=0;i<10;i++) await Promise.resolve();
    expect(f.session.running).toBe(true);
    const lease = f.options.resume.mock.calls[0]![0];
    expect(f.options.resume.mock.calls[1]).toEqual([lease,lease,1]);
    const finalPause = f.session.pause();
    resumeGate.resolve();
    await vi.advanceTimersByTimeAsync(150);
    await Promise.all([paused,resumed,finalPause]);
    expect(f.session.state).toEqual(predicted);
    expect(f.server()).toEqual(predicted);
    expect(f.session.running).toBe(false);
    expect(f.options.pause.mock.calls.map(args=>args[1])).toEqual([1,4]);
    expect(f.storage.size).toBe(0);
  });
  it.each([true,false])("coalesces rapid pause/resume toggles with final playing intent %s", async (playing) => {
    const f = fixture(), gate = deferred();
    await f.session.resume(0);
    f.options.pause.mockImplementationOnce(async()=>{await gate.promise;});
    const requests = [f.session.pause()];
    for(let i=0;i<30;i++) {
      requests.push(f.session.resume(0));
      requests.push(f.session.pause());
    }
    if(playing) requests.push(f.session.resume(0));
    expect(f.session.running).toBe(playing);
    expect(JSON.parse([...f.storage.values()][0]!).commands.length).toBeLessThanOrEqual(2);
    gate.resolve();
    await Promise.all(requests);
    expect(f.session.running).toBe(playing);
    expect(f.options.pause).toHaveBeenCalledOnce();
    expect(f.options.resume).toHaveBeenCalledTimes(playing?2:1);
    expect(f.storage.size).toBe(0);
  });
  it.each([true,false])("honors a pause during initial connection, with final playing intent %s", async (playing) => {
    const f=fixture(), gate=deferred(), resume=f.options.resume.getMockImplementation()!;
    f.options.resume.mockImplementationOnce(async(...args)=>{await gate.promise;return resume(...args);});
    const initial=f.session.resume(0);
    for(let i=0;i<10;i++) await Promise.resolve();
    await f.session.pause();
    if(playing) await f.session.resume(0);
    gate.resolve();
    await initial;
    await f.session.flush();
    expect(f.session.running).toBe(playing);
    expect(f.options.pause).toHaveBeenCalledTimes(playing?0:1);
  });
  it.each(["pause","resume"])("restores queued controls and following input after a lost %s response", async (lost) => {
    const f=fixture(), gate=deferred();
    await f.session.resume(0);
    if(lost==="pause") f.options.pause.mockImplementationOnce(async()=>{await gate.promise;throw new Error("réponse perdue");});
    else f.options.resume.mockImplementationOnce(async()=>{await gate.promise;throw new Error("réponse perdue");});
    const paused=f.session.pause(), resumed=f.session.resume(0);
    f.session.advance(50,{x:1000,y:0});
    const predicted=structuredClone(f.session.state);
    gate.resolve();
    await Promise.all([paused,resumed]);
    expect(f.session.running).toBe(false);
    const draft=JSON.parse([...f.storage.values()][0]!);
    expect(draft.version).toBe(3);
    expect(draft.commands.map((c:{type:string})=>c.type)).toEqual(lost==="pause"?["pause","resume"]:["resume"]);
    f.session.destroy();
    const reloaded=new CemeterySession({...f.options,leaseId:draft.leaseId,state:structuredClone(f.server())});
    expect(reloaded.state).toEqual(predicted);
    const recovering=reloaded.resume(50);
    await vi.advanceTimersByTimeAsync(50);
    await recovering;
    expect(reloaded.running).toBe(true);
    expect(reloaded.state).toEqual(predicted);
    expect(f.server()).toEqual(predicted);
    expect(f.storage.size).toBe(0);
  });
  it("keeps V2 choice drafts readable after adding pause/resume commands", async()=>{
    const state=createCemeteryRun(77);state.xp=5;offerCemeteryLevel(state);
    const f=fixture(state), choice=state.choices[0]!;
    f.storage.set(cemeteryDraftKey("alice","run-1"),JSON.stringify({
      version:2,leaseId:"original",baseTick:0,
      inputs:[{x:1000,y:0}],choices:[{tick:0,serial:state.choiceSerial,choice}],
    }));
    const reloaded=new CemeterySession(f.options), predicted=structuredClone(reloaded.state);
    expect(predicted.tick).toBe(1);
    expect(predicted.choices).toEqual([]);
    const resumed=reloaded.resume(50);
    await vi.advanceTimersByTimeAsync(50);
    await resumed;
    expect(reloaded.state).toEqual(predicted);
    expect(f.server()).toEqual(predicted);
  });
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
  it("resumes immediately after a selection while inputs and the choice are still saving", async () => {
    const state = createCemeteryRun(77);
    state.pickups = [
      { id: 1, kind: "xp", x: 0, y: 0, value: 5, eligible: false },
    ];
    const f = fixture(state);
    await f.session.resume(0);
    const submit = f.options.submit.getMockImplementation()!,
      choose = f.options.choose.getMockImplementation()!,
      inputGate = deferred(), choiceGate = deferred();
    f.options.submit.mockImplementationOnce(async (...args) => {
      await inputGate.promise;
      return submit(...args);
    });
    f.options.choose.mockImplementationOnce(async (...args) => {
      await choiceGate.promise;
      return choose(...args);
    });
    f.session.advance(50, { x: 0, y: 0 });
    expect(f.session.running).toBe(false);
    expect(f.session.saving).toBe(true);
    expect(f.session.state.choices.length).toBeGreaterThan(0);
    const serial = f.session.state.choiceSerial;
    const selected = f.session.choose(f.session.state.choices[0]!, serial, 50);
    expect(f.session.running).toBe(true);
    expect(f.session.state.choices).toEqual([]);
    f.session.advance(100, { x: 1000, y: 0 });
    f.session.advance(150, { x: 1000, y: 0 });
    const predicted = structuredClone(f.session.state);
    expect(predicted.tick).toBe(3);
    expect(f.server().tick).toBe(0);
    expect(JSON.parse([...f.storage.values()][0]!).commands).toHaveLength(1);

    inputGate.resolve();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(f.options.choose).toHaveBeenCalledWith(
      expect.any(String),
      serial,
      expect.any(String),
    );
    expect(f.session.state).toEqual(predicted);
    expect(f.session.running).toBe(true);
    const paused = f.session.pause();
    choiceGate.resolve();
    await vi.advanceTimersByTimeAsync(99);
    expect(f.options.submit).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    await selected;
    await paused;
    expect(f.session.state).toEqual(predicted);
    expect(f.server()).toEqual(predicted);
    expect(f.session.running).toBe(false);
    expect(f.options.resume).toHaveBeenCalledOnce();
    expect(f.storage.size).toBe(0);
  });
  it("queues consecutive levels without waiting, ignores a stale double click and preserves their order", async () => {
    const state = createCemeteryRun(77);
    state.xp = 50;
    offerCemeteryLevel(state);
    const f = fixture(state), gate = deferred();
    await f.session.resume(0);
    const choose = f.options.choose.getMockImplementation()!;
    f.options.choose.mockImplementationOnce(async (...args) => {
      await gate.promise;
      return choose(...args);
    });
    const serial = f.session.state.choiceSerial, choice = f.session.state.choices[0]!;
    const first = f.session.choose(choice, serial);
    await f.session.choose(choice, serial);
    expect(f.session.state.level).toBe(3);
    const commands = [first];
    while (f.session.state.choices.length) {
      commands.push(f.session.choose(f.session.state.choices[0]!));
    }
    const predicted = structuredClone(f.session.state);
    expect(predicted.level).toBe(4);
    expect(f.session.running).toBe(true);
    expect(f.server().level).toBe(2);
    gate.resolve();
    await Promise.all(commands);
    expect(f.server()).toEqual(predicted);
    expect(f.options.choose.mock.calls.map((args) => args[1])).toEqual([1, 2, 3]);
    expect(f.options.resume).not.toHaveBeenCalled();
    expect(f.storage.size).toBe(0);
  });
  it.each(["before", "after"])("restores a queued choice and later inputs when a request fails %s the server applies it", async (when) => {
    const state = createCemeteryRun(77);
    state.xp = 5;
    offerCemeteryLevel(state);
    const f = fixture(state), gate = deferred();
    await f.session.resume(0);
    const choose = f.options.choose.getMockImplementation()!;
    f.options.choose.mockImplementationOnce(async (...args) => {
      if (when === "after") await choose(...args);
      await gate.promise;
      throw new Error("réponse perdue");
    });
    const selected = f.session.choose(f.session.state.choices[0]!, undefined, 0);
    f.session.advance(50, { x: 1000, y: 0 });
    f.session.advance(100, { x: 1000, y: 0 });
    const predicted = structuredClone(f.session.state);
    gate.resolve();
    await selected;
    expect(f.session.running).toBe(false);
    expect(f.storage.size).toBe(1);
    f.session.destroy();
    const reloaded = new CemeterySession({ ...f.options, state: structuredClone(f.server()) });
    expect(reloaded.state).toEqual(predicted);
    const resumed = reloaded.resume(100);
    await vi.advanceTimersByTimeAsync(100);
    await resumed;
    expect(reloaded.running).toBe(true);
    expect(reloaded.state).toEqual(predicted);
    expect(f.server()).toEqual(predicted);
    expect(f.storage.size).toBe(0);
  });
  it("keeps a rejected choice and later input in the draft and stops prediction on a conflict", async () => {
    const state = createCemeteryRun(77);
    state.xp = 5;
    offerCemeteryLevel(state);
    const f = fixture(state), gate = deferred();
    await f.session.resume(0);
    f.options.choose.mockImplementationOnce(async () => {
      await gate.promise;
      throw new Error("autre onglet");
    });
    const selected = f.session.choose(f.session.state.choices[0]!, undefined, 0);
    f.session.advance(50, { x: 1000, y: 0 });
    gate.resolve();
    await selected;
    expect(f.session.running).toBe(false);
    const draft = JSON.parse([...f.storage.values()][0]!);
    expect(draft.commands.filter((command: {type:string}) => command.type === "choice")).toHaveLength(1);
    expect(draft.inputs).toHaveLength(1);
    expect(f.options.error).toHaveBeenCalledWith("autre onglet");
    expect(f.server().choices.length).toBeGreaterThan(0);
  });
  it("confirms a predicted death only after its queued upgrade and following inputs are verified", async () => {
    const state = createCemeteryRun(77);
    state.choices = ["weapon:knife"];
    state.choiceSerial = 1;
    state.health = 1;
    state.enemies = [{id:1,kind:"revenant",x:0,y:0,hp:1000,maxHp:1000,damage:7,speed:1,radius:17,born:0,knockback:0}];
    const f = fixture(state), gate = deferred();
    await f.session.resume(0);
    const choose = f.options.choose.getMockImplementation()!;
    f.options.choose.mockImplementationOnce(async (...args) => {
      await gate.promise;
      return choose(...args);
    });
    const selected = f.session.choose("weapon:knife", 1, 0);
    f.session.advance(50, {x:0,y:0});
    // The choice grants a short invulnerability window, so let it expire.
    for (let t = 100; t <= 600; t += 50) f.session.advance(t, {x:0,y:0});
    expect(f.session.state.ended).toBe(true);
    expect(f.options.finish).not.toHaveBeenCalled();
    gate.resolve();
    await vi.advanceTimersByTimeAsync(600);
    await selected;
    expect(f.server().ended).toBe(true);
    expect(f.options.finish).toHaveBeenCalledOnce();
    expect(f.session.settled).toBe(true);
    expect(f.storage.size).toBe(0);
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
