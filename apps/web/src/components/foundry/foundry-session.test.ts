import { describe, expect, it, vi } from "vitest";
import { createFoundryRound, newFoundryCycle, stepFoundry, type FoundryInput } from "@sylve/game/foundry";
import { FoundrySession, foundryDraftKey } from "./foundry-session";

function setup() {
  const server = createFoundryRound(7, newFoundryCycle(), "mallet");
  const storage = new Map<string, string>();
  const submit = vi.fn(async (startTick: number, inputs: FoundryInput[]) => {
    expect(startTick).toBe(server.tick); inputs.forEach((input) => stepFoundry(server, input)); return structuredClone(server);
  });
  const options = { ownerId: "alice", roundId: "round-1", state: server, storage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => { storage.set(k, v); }, removeItem: (k: string) => { storage.delete(k); } }, submit,
    finish: vi.fn(async () => {}), finished: vi.fn(), error: vi.fn(), change: vi.fn(), impact: vi.fn() };
  return { options, storage, server };
}
describe("la reprise d’une manche de fonderie", () => {
  it("restores and confirms a long round beyond the former total input limit", async () => {
    const { options, storage, server } = setup(); server.concentration = server.stats.concentration = 10000; server.targets = [];
    const inputs = Array.from({ length: 2000 }, () => ({ x: 5.6, z: 3.4, active: false }));
    storage.set(foundryDraftKey("alice", "round-1"), JSON.stringify({ version: 1, baseTick: 0, inputs }));
    const session = new FoundrySession(options); expect(session.state.tick).toBe(2000); expect(session.state.ended).toBe(false);
    await session.flush(); expect(session.state).toEqual(server); expect(server.tick).toBe(2000); expect(options.finish).not.toHaveBeenCalled();
  });
  it("pauses a stalled connection without ending the round or losing unconfirmed input", async () => {
    const { options, server } = setup(); server.concentration = server.stats.concentration = 10000; server.targets = [];
    let release!: () => void, first = true;
    const session = new FoundrySession({ ...options, submit: async (start, inputs) => { if (first) { first = false; await new Promise<void>((resolve) => { release = resolve; }); } return options.submit(start, inputs); } });
    session.resume(0); for (let tick = 1; tick <= 2500; tick++) session.advance(tick * 50, { x: 5.6, z: 3.4, active: false });
    expect(session.running).toBe(false); expect(session.state.ended).toBe(false); expect(session.state.tick).toBe(2400); expect(options.error).toHaveBeenCalledOnce();
    release(); await session.flush(); expect(session.state).toEqual(server); expect(options.finish).not.toHaveBeenCalled(); session.destroy();
  });
  it("does not drain concentration while paused and replays batches on the server", async () => {
    const { options, server } = setup(); const session = new FoundrySession(options);
    session.resume(0); for (let i = 1; i <= 45; i++) session.advance(i * 50, { x: 0, z: 0, active: true });
    session.pause(); await session.flush(); expect(session.state).toEqual(server);
    const tick = session.state.tick; session.advance(99_000, { x: 0, z: 0, active: true }); expect(session.state.tick).toBe(tick);
    session.resume(100_000); session.advance(100_050, { x: 0, z: 0, active: true }); expect(session.state.tick).toBe(tick + 1);
  });
  it("restores unacknowledged inputs and trims inputs already committed before a lost response", async () => {
    const { options, storage, server } = setup(); const original = structuredClone(server);
    const inputs = Array.from({ length: 12 }, () => ({ x: 0, z: 0, active: true }));
    inputs.slice(0, 5).forEach((input) => stepFoundry(server, input));
    storage.set(foundryDraftKey("alice", "round-1"), JSON.stringify({ version: 1, baseTick: 0, inputs }));
    const session = new FoundrySession({ ...options, state: server });
    expect(session.state.tick).toBe(12); expect(session.running).toBe(false);
    inputs.forEach((input) => stepFoundry(original, input)); expect(session.state).toEqual(original);
    await session.flush(); expect(session.state).toEqual(server); expect(storage.size).toBe(0);
    const bob = new FoundrySession({ ...options, ownerId: "bob", state: createFoundryRound(7, newFoundryCycle(), "mallet") });
    expect(bob.state.tick).toBe(0);
  });
  it("keeps the draft and stops gameplay when a competing tab rejects a batch", async () => {
    const { options, storage } = setup();
    const session = new FoundrySession({ ...options, submit: vi.fn(async () => { throw new Error("Autre onglet"); }) }); session.resume(0);
    for (let i = 1; i <= 10; i++) session.advance(i * 50, { x: 5.6, z: 3.4, active: false });
    await session.flush(); expect(session.running).toBe(false); expect(options.error).toHaveBeenCalled(); expect(storage.size).toBe(1);
  });
  it("reconciles predicted loot with the server and replays only unconfirmed input", async () => {
    const { options, server } = setup();
    const session = new FoundrySession({ ...options, submit: async (start, inputs) => { await options.submit(start, inputs); server.shards += 7; return structuredClone(server); } });
    session.resume(0);
    for (let i = 1; i <= 10; i++) session.advance(i * 50, { x: 5.6, z: 3.4, active: false });
    expect(session.state.shards).toBe(0); await session.flush();
    expect(session.state.shards).toBe(7); expect(session.state).toEqual(server);
  });
  it("finishes an acknowledged completed round once and ignores corrupt drafts", async () => {
    const { options, storage } = setup();
    storage.set(foundryDraftKey("alice", "round-1"), '{"version":1,"baseTick":0,"inputs":[null]}');
    const session = new FoundrySession({ ...options, state: { ...options.state, ended: true, tick: 1000 } });
    expect(session.state.tick).toBe(1000); await session.flush(); await session.flush();
    expect(options.finish).toHaveBeenCalledTimes(1); expect(options.finished).toHaveBeenCalledTimes(1);
  });
});
