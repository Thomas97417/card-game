import { afterEach, describe, expect, it, vi } from "vitest";
import { ConvexReactClient } from "convex/react";
import { getFunctionName, type FunctionReference } from "convex/server";
import { convexToJson, type Value } from "convex/values";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { HOUR_MS, type MineBoard, type MineKind } from "@sylve/game/mines";
import { optimisticallyCollectMine } from "./optimistic-mines";

const board: MineBoard = {
  ownerId: "alice", serverNow: HOUR_MS, rank: 1, mineLevel: 1,
  mines: {
    gold: { amount: 0, updatedAt: 0, heroLevel: 1, revision: 0 },
    emeralds: { amount: 0, updatedAt: 0, heroLevel: 1, revision: 0 },
  },
};
type ClientMessage = {
  type: string;
  requestId?: number;
  newVersion?: number;
  modifications?: { type: string; queryId: number; udfPath?: string; args?: unknown[] }[];
};

/** Only replace the WebSocket transport: mutation queuing, optimistic replay,
 * query reconciliation and rejected promises all use the installed Convex SDK. */
class MemorySocket {
  static current: MemorySocket;
  sent: ClientMessage[] = [];
  onopen?: () => void;
  onclose?: (event: { code: number; reason: string }) => void;
  onmessage?: (event: { data: string }) => void;
  constructor() { MemorySocket.current = this; }
  send(data: string) { this.sent.push(JSON.parse(data)); }
  close() { this.onclose?.({ code: 1000, reason: "" }); }
  receive(message: unknown) { this.onmessage?.({ data: JSON.stringify(message) }); }
}

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  try { for (const cleanup of cleanups.splice(0)) await cleanup(); }
  finally { vi.useRealTimers(); }
});

function setup() {
  const client = new ConvexReactClient("https://mines-test.convex.cloud", {
    webSocketConstructor: MemorySocket as unknown as typeof WebSocket,
    unsavedChangesWarning: false,
    logger: false,
  });
  const subscriptions: (() => void)[] = [];
  const values = new Map<string, { query: FunctionReference<"query">; args: Record<string, Value>; value: Value }>();
  const key = (query: FunctionReference<"query">, args: unknown) => `${getFunctionName(query)}:${JSON.stringify(args)}`;
  function observe(query: FunctionReference<"query">, args: Record<string, Value>, value: Value) {
    values.set(key(query, args), { query, args, value });
    subscriptions.push(client.watchQuery(query, args).onUpdate(() => {}));
  }
  function set(query: FunctionReference<"query">, args: Record<string, Value>, value: unknown) {
    values.get(key(query, args))!.value = value as Value;
  }
  observe(api.auth.getCurrentUser, {}, { _id: "alice" });
  observe(api.collection.gold, {}, 100);
  observe(api.collection.diamonds, {}, 200);
  for (const refreshKey of [1, 2]) observe(api.collection.mineBoard, { refreshKey }, board as unknown as Value);
  let socket = MemorySocket.current;
  socket.onopen?.();
  cleanups.push(async () => { for (const unsubscribe of subscriptions) unsubscribe(); await client.close(); });
  function timestamp(value: number) {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setBigUint64(0, BigInt(value), true);
    return btoa(String.fromCharCode(...bytes));
  }
  let ticks = 0;
  let version = { querySet: 0, identity: 0, ts: timestamp(0) };
  function transition() {
    const changes = socket.sent.filter((message) => message.type === "ModifyQuerySet");
    const endVersion = { ...version, querySet: changes.at(-1)!.newVersion!, ts: timestamp(++ticks) };
    socket.receive({
      type: "Transition", startVersion: version, endVersion,
      modifications: [...values.values()].map(({ query, args, value }) => {
        const added = changes.flatMap((message) => message.modifications ?? []).find(
          (item) => item.type === "Add" && item.udfPath === getFunctionName(query) && JSON.stringify(item.args) === JSON.stringify([args]),
        )!;
        return { type: "QueryUpdated", queryId: added.queryId, value: convexToJson(value), logLines: [], journal: null };
      }),
    });
    version = endVersion;
  }
  transition();
  function reconnect() {
    socket.onclose?.({ code: 1006, reason: "Test network interruption" });
    vi.advanceTimersByTime(2000);
    socket = MemorySocket.current;
    socket.onopen?.();
    version = { querySet: 0, identity: 0, ts: timestamp(0) };
    transition();
  }
  function collect(kind: MineKind) {
    const args = { kind, revision: 0, expectedOwnerId: board.ownerId };
    return client.mutation(api.collection.collectMine, args, {
      optimisticUpdate: (store) => optimisticallyCollectMine(store, args, board.serverNow),
    });
  }
  function respond(index: number, result: { kind: MineKind; amount: number; alreadyCollected: boolean } | string) {
    const request = socket.sent.filter((message) => message.type === "Mutation")[index]!;
    if (typeof result === "string") {
      socket.receive({ type: "MutationResponse", requestId: request.requestId, success: false, result, errorData: result, logLines: [] });
    } else {
      socket.receive({ type: "MutationResponse", requestId: request.requestId, success: true, result, ts: timestamp(ticks + 1), logLines: [] });
      transition();
    }
  }
  const readBoard = (refreshKey = 1) => client.watchQuery(api.collection.mineBoard, { refreshKey }).localQueryResult()!;
  const gold = () => client.watchQuery(api.collection.gold, {}).localQueryResult();
  const emeralds = () => client.watchQuery(api.collection.diamonds, {}).localQueryResult();
  return { observe, set, transition, reconnect, collect, respond, readBoard, gold, emeralds };
}

describe("retours arrière avec le vrai client Convex", () => {
  it.each(["gold", "emeralds"] as const)("restores %s after a server or session rejection", async (kind) => {
    const app = setup();
    const request = app.collect(kind);
    expect(app.gold()).toBe(kind === "gold" ? 106 : 100);
    expect(app.emeralds()).toBe(kind === "emeralds" ? 202 : 200);
    expect(app.readBoard().mines![kind].revision).toBe(1);
    const rejected = expect(request).rejects.toThrow("Connecte-toi");
    app.respond(0, "Connecte-toi pour jouer.");
    await rejected;
    expect(app.gold()).toBe(100);
    expect(app.emeralds()).toBe(200);
    for (const refreshKey of [1, 2]) expect(app.readBoard(refreshKey)).toEqual(board);
  });

  it("rolls back only the failed mine during refresh and never doubles a confirmed reward", async () => {
    const app = setup();
    const gold = app.collect("gold"), emeralds = app.collect("emeralds");
    app.observe(api.collection.mineBoard, { refreshKey: 3 }, board as unknown as Value);
    app.transition();
    expect(app.readBoard(3).mines!.gold.revision).toBe(1);
    expect(app.readBoard(3).mines!.emeralds.revision).toBe(1);
    const rejected = expect(gold).rejects.toThrow("Collecte refusée");
    app.respond(0, "Collecte refusée");
    await rejected;
    expect(app.gold()).toBe(100);
    expect(app.emeralds()).toBe(202);
    for (const refreshKey of [1, 2, 3]) {
      expect(app.readBoard(refreshKey).mines!.gold).toEqual(board.mines!.gold);
      expect(app.readBoard(refreshKey).mines!.emeralds.revision).toBe(1);
      app.set(api.collection.mineBoard, { refreshKey }, {
        ...board, mines: { ...board.mines!, emeralds: { ...board.mines!.emeralds, updatedAt: HOUR_MS, revision: 1 } },
      });
    }
    app.set(api.collection.diamonds, {}, 202);
    app.respond(1, { kind: "emeralds", amount: 2, alreadyCollected: false });
    await emeralds;
    expect(app.emeralds()).toBe(202);
    expect(app.gold()).toBe(100);
  });

  it("removes an expired session's preview and never replays it onto another account", async () => {
    const app = setup();
    const request = app.collect("gold");
    app.set(api.auth.getCurrentUser, {}, null);
    app.transition();
    expect(app.gold()).toBe(100);
    const bob = { ...board, ownerId: "bob" };
    app.set(api.auth.getCurrentUser, {}, { _id: "bob" });
    app.set(api.collection.gold, {}, 500);
    app.set(api.collection.diamonds, {}, 700);
    for (const refreshKey of [1, 2]) app.set(api.collection.mineBoard, { refreshKey }, bob);
    app.transition();
    expect(app.gold()).toBe(500);
    expect(app.emeralds()).toBe(700);
    const rejected = expect(request).rejects.toThrow("session a changé");
    app.respond(0, "Ta session a changé.");
    await rejected;
    expect(app.gold()).toBe(500);
    for (const refreshKey of [1, 2]) expect(app.readBoard(refreshKey)).toEqual(bob);
  });

  it.each(["success", "failure"])("handles a lost response followed by reconnect and %s without double credit", async (outcome) => {
    vi.useFakeTimers();
    const app = setup();
    const request = app.collect("gold");
    const result = request.then((value) => ({ value, error: null }), (error: Error) => ({ value: null, error }));
    expect(app.gold()).toBe(106);
    if (outcome === "success") {
      // The server committed, but its response was lost before reconnecting.
      app.set(api.collection.gold, {}, 106);
      for (const refreshKey of [1, 2]) app.set(api.collection.mineBoard, { refreshKey }, {
        ...board, mines: { ...board.mines!, gold: { ...board.mines!.gold, updatedAt: HOUR_MS, revision: 1 } },
      });
    }
    app.reconnect();
    expect(app.gold()).toBe(106);
    if (outcome === "success") app.respond(0, { kind: "gold", amount: 6, alreadyCollected: false });
    else app.respond(0, "Connecte-toi pour jouer.");
    const response = await result;
    expect(app.gold()).toBe(outcome === "success" ? 106 : 100);
    expect(app.readBoard().mines!.gold.revision).toBe(outcome === "success" ? 1 : 0);
    if (outcome === "failure") expect(response.error?.message).toContain("Connecte-toi");
    else expect(response.value?.amount).toBe(6);
  });
});
