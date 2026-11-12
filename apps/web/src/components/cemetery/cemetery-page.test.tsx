import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConvex, useMutation, useQuery } from "convex/react";
import { getFunctionName, type FunctionReturnType } from "convex/server";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import type { Doc, Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import {
  createCemeteryRun, stepCemetery, cemeterySummary, type CemeteryRun,
} from "@sylve/game/cemetery";
import { CemeteryPage } from "./cemetery-page";
import { CemeterySession } from "./cemetery-session";

vi.mock("convex/react", () => ({ useConvex: vi.fn(), useMutation: vi.fn(), useQuery: vi.fn() }));
vi.mock("@/components/game-header", () => ({ GameHeader: () => <a href="/hub">Retour au refuge</a> }));
vi.mock("@/components/play/chest-reveal-dialog", () => ({ ChestRevealDialog: () => null }));
const scene = vi.hoisted(() => ({ create: vi.fn(), render: vi.fn(), damage: vi.fn(), destroy: vi.fn() }));
vi.mock("./cemetery-scene", () => ({ createCemeteryScene: scene.create }));

type Board = FunctionReturnType<typeof api.cemetery.board>;
let board: Board, record: Doc<"cemeteryRuns">;
const client = { query: vi.fn(), mutation: vi.fn() };
const mutations = new Map<string, ReturnType<typeof vi.fn>>();
const releases: (() => void)[] = [];
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  releases.push(resolve);
  return { promise, resolve };
}
async function ready() {
  await act(async () => { for (let i = 0; i < 32; i++) await Promise.resolve(); });
}
async function enter() {
  render(<CemeteryPage />);
  fireEvent.click(screen.getByRole("button", { name: "Reprendre la partie" }));
  await ready();
  expect(screen.getByRole("button", { name: "Mettre en pause" })).toBeTruthy();
}
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  mutations.clear();
  client.query.mockReset(); client.mutation.mockReset();
  scene.create.mockResolvedValue({ render: scene.render, damage: scene.damage, destroy: scene.destroy });
  const state = createCemeteryRun(17);
  state.spawnBudget = -1000;
  const runId = "run-1" as Id<"cemeteryRuns">;
  record = {
    _id: runId, _creationTime: 0, ownerId: "alice", requestId: "run-1", startedAt: 0,
    leaseId: "original", leaseTick: 0, leaseAt: 0, leasePaused: true,
    state, status: "active", leagueTrophies: 0, rewardStatus: "none",
  };
  board = {
    ownerId: "alice", heroId: "sylve", gold: 1000, emeralds: 100, lastRun: null, pendingRewards: [],
    activeRun: { id: runId, seconds: 0, level: 1 },
    progress: { _id: "progress" as Id<"cemeteryProgress">, _creationTime: 0,
      ownerId: "alice", revision: 1, upgrades: {}, bestSeconds: 0, runs: 0, activeRunId: runId },
  };
  mutations.set("cemetery:resumeRun", vi.fn(async (args) => {
    record.leaseId = args.leaseId; record.leasePaused = false;
    return structuredClone(record);
  }));
  mutations.set("cemetery:pauseRun", vi.fn(async () => { record.leasePaused = true; }));
  mutations.set("cemetery:submitInputs", vi.fn(async (args) => {
    if (args.startTick !== record.state.tick) throw new Error("Checkpoint incorrect");
    for (const input of args.inputs) {
      stepCemetery(record.state as CemeteryRun, input);
      if (record.state.ended || record.state.choices.length) break;
    }
    return { state: structuredClone(record.state), acceptedTick: record.state.tick };
  }));
  mutations.set("cemetery:abandonRun", vi.fn(async () => { record.status = "abandoned"; board.activeRun = null; }));
  mutations.set("cemetery:finishRun", vi.fn(async () => {
    const summary = cemeterySummary(record.state as CemeteryRun);
    record.status = "dead"; record.rewardStatus = "unopened"; record.summary = summary;
    board.activeRun = null;
    board.pendingRewards = [{ id: record._id, rarity: summary.rarity, summary }];
    return summary;
  }));
  client.query.mockImplementation(async (ref) => getFunctionName(ref) === "cemetery:board" ? board : structuredClone(record));
  client.mutation.mockImplementation(async (ref, args) => mutations.get(getFunctionName(ref))!(args));
  vi.mocked(useConvex).mockReturnValue(client as unknown as ReturnType<typeof useConvex>);
  vi.mocked(useQuery).mockImplementation(((ref) => getFunctionName(ref) === "cemetery:board" ? board : undefined) as typeof useQuery);
  vi.mocked(useMutation).mockReturnValue(vi.fn() as unknown as ReturnType<typeof useMutation>);
});
afterEach(async () => {
  cleanup();
  releases.splice(0).forEach((release) => release());
  await vi.advanceTimersByTimeAsync(10000);
  vi.restoreAllMocks(); vi.clearAllMocks(); vi.useRealTimers(); localStorage.clear();
});

describe("le retour au menu du cimetière", () => {
  it("opens immediately during a stalled checkpoint and resumes the same prediction without another fetch", async () => {
    const gate = deferred(), submit = mutations.get("cemetery:submitInputs")!, send = submit.getMockImplementation()!;
    submit.mockImplementationOnce(async (args) => { await gate.promise; return send(args); });
    const pause = vi.spyOn(CemeterySession.prototype, "pause"), destroy = vi.spyOn(CemeterySession.prototype, "destroy");
    await enter();
    fireEvent.keyDown(window, { key: "d" });
    act(() => vi.advanceTimersByTime(1200));
    fireEvent.keyUp(window, { key: "d" });
    fireEvent.click(screen.getByRole("button", { name: "Mettre en pause" }));
    const session = pause.mock.contexts[0] as CemeterySession, predicted = structuredClone(session.state);
    expect(predicted.tick).toBeGreaterThanOrEqual(20);
    expect(record.state.tick).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Retour au menu" }));
    expect(screen.getByRole("heading", { name: /Le Puits/ })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText(/Sauvegarde · 00:01/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Reprendre la partie" }) as HTMLButtonElement).disabled).toBe(false);
    expect(destroy).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(5000));
    expect(session.state).toEqual(predicted);
    const queries = client.query.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Reprendre la partie" }));
    await ready();
    expect(client.query).toHaveBeenCalledTimes(queries);
    expect(session.running).toBe(true);
    expect(session.state).toEqual(predicted);
    act(() => vi.advanceTimersByTime(200));
    expect(session.state.tick).toBeGreaterThan(predicted.tick);
    fireEvent.click(screen.getByRole("button", { name: "Mettre en pause" }));
    fireEvent.click(screen.getByRole("button", { name: "Retour au menu" }));
    const final = structuredClone(session.state);
    gate.resolve();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); await session.flush(); });
    expect(record.state).toEqual(final);
    expect(destroy).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });

  it("reports a background failure in the menu and keeps the retained run recoverable", async () => {
    const gate = deferred(), pause = vi.spyOn(CemeterySession.prototype, "pause");
    mutations.get("cemetery:pauseRun")!.mockImplementationOnce(async () => { await gate.promise; throw new Error("hors ligne"); });
    await enter();
    act(() => vi.advanceTimersByTime(200));
    fireEvent.click(screen.getByRole("button", { name: "Mettre en pause" }));
    fireEvent.click(screen.getByRole("button", { name: "Retour au menu" }));
    const session = pause.mock.contexts[0] as CemeterySession, saved = structuredClone(session.state);
    gate.resolve(); await ready();
    expect(screen.getByRole("alert").textContent).toContain("hors ligne");
    expect(screen.getByRole("button", { name: "Reprendre la partie" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reprendre la partie" }));
    await ready();
    expect(session.state).toEqual(saved);
    expect(session.running).toBe(true);
  });

  it("clears the retained session after a deliberate abandon", async () => {
    const destroy = vi.spyOn(CemeterySession.prototype, "destroy");
    await enter(); act(() => vi.advanceTimersByTime(200));
    fireEvent.click(screen.getByRole("button", { name: "Mettre en pause" }));
    fireEvent.click(screen.getByRole("button", { name: "Retour au menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Abandonner cette partie" }));
    fireEvent.click(screen.getByRole("button", { name: "Abandonner la partie" }));
    await ready();
    expect(mutations.get("cemetery:abandonRun")).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Reprendre la partie" })).toBeNull();
    expect(screen.getByRole("button", { name: "Lancer une partie" })).toBeTruthy();
  });

  it.each([false, true])("opens the menu before death is finalized and recovers a failed save: %s", async (retry) => {
    const gate = deferred(), finish = mutations.get("cemetery:finishRun")!, settle = finish.getMockImplementation()!;
    finish.mockImplementationOnce(async (args) => {
      await gate.promise;
      if (retry) throw new Error("bilan interrompu");
      return settle(args);
    });
    record.state.health = 1;
    record.state.enemies = [{ id: 99, kind: "revenant", x: 0, y: 0, hp: 1000, maxHp: 1000,
      damage: 7, speed: 1, radius: 17, born: 0, knockback: 0 }];
    await enter(); act(() => vi.advanceTimersByTime(200)); await ready();
    expect(screen.getByRole("heading", { name: "Les ombres se souviendront." })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retour au menu" }));
    expect(screen.getByRole("heading", { name: /Le Puits/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reprendre la partie" })).toBeNull();
    expect((screen.getByRole("button", { name: "Lancer une partie" }) as HTMLButtonElement).disabled).toBe(true);
    gate.resolve(); await ready();
    if (retry) {
      expect(screen.getByRole("alert").textContent).toContain("bilan interrompu");
      expect((screen.getByRole("button", { name: "Lancer une partie" }) as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "Réessayer la sauvegarde" }));
      await ready();
    }
    expect((screen.getByRole("button", { name: "Lancer une partie" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole("button", { name: /Ouvrir le coffre commun/ })).toBeTruthy();
  });
});
