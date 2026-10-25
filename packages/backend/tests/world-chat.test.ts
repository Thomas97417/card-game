import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components } from "../convex/_generated/api";
import schema from "../convex/schema";
import {
  WORLD_CHAT_HISTORY_LIMIT,
  WORLD_CHAT_SEND_INTERVAL_MS,
} from "../convex/lib/chat";

const modules = import.meta.glob("../convex/**/*.ts");
function setup() {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  return t;
}

async function player(t: ReturnType<typeof setup>, name: string) {
  const now = Date.now();
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "user",
      data: {
        name,
        email: `${name}@example.invalid`,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "session",
      data: {
        userId: user._id,
        token: `${name}-session`,
        createdAt: now,
        updatedAt: now,
        expiresAt: now + 3_600_000,
      },
    },
  });
  return t.withIdentity({ subject: user._id, sessionId: session._id });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("le chat mondial", () => {
  it("requires a real authenticated player to read and send", async () => {
    const t = setup();
    await expect(t.query(api.worldChat.list, {})).rejects.toThrow(
      "Connecte-toi",
    );
    await expect(
      t.mutation(api.worldChat.send, { body: "Bonjour" }),
    ).rejects.toThrow("Connecte-toi");
    await expect(
      t
        .withIdentity({ subject: "invented-player", sessionId: "invented-session" })
        .mutation(api.worldChat.send, { body: "Bonjour" }),
    ).rejects.toThrow("Connecte-toi");
  });

  it("shares persisted messages between players in chronological order, with server-assigned authors", async () => {
    const t = setup();
    const alice = await player(t, "Alice");
    const bob = await player(t, "Bob");
    expect(await alice.query(api.worldChat.list, {})).toEqual([]);
    const first = await alice.mutation(api.worldChat.send, {
      body: "  Bonjour les gardiens !  ",
    });
    vi.advanceTimersByTime(10);
    const second = await bob.mutation(api.worldChat.send, {
      body: "Salut Alice !\nPrête pour un duel ?",
    });
    const messages = await bob.query(api.worldChat.list, {});
    expect(messages.map((message) => message.id)).toEqual([first, second]);
    expect(messages[0]).toMatchObject({
      body: "Bonjour les gardiens !",
      senderName: "Alice",
      isOwn: false,
    });
    expect(messages[1]).toMatchObject({
      body: "Salut Alice !\nPrête pour un duel ?",
      senderName: "Bob",
      isOwn: true,
    });
    expect(messages[0]).not.toHaveProperty("senderId");
    const reconnected = await alice.query(api.worldChat.list, {});
    expect(reconnected[0]!.isOwn).toBe(true);
    expect(reconnected[1]!.isOwn).toBe(false);
    expect(reconnected[0]!.sentAt).toBeLessThan(reconnected[1]!.sentAt);
  });

  it("rejects empty or oversized text without consuming the send interval", async () => {
    const t = setup();
    const alice = await player(t, "Alice");
    for (const body of ["", " \n\t ", "x".repeat(501)]) {
      await expect(
        alice.mutation(api.worldChat.send, { body }),
      ).rejects.toThrow();
    }
    await alice.mutation(api.worldChat.send, { body: "é".repeat(500) });
    expect((await alice.query(api.worldChat.list, {}))[0]!.body).toHaveLength(
      500,
    );
  });

  it("enforces the send interval per player while allowing other players to reply", async () => {
    const t = setup();
    const alice = await player(t, "Alice");
    const bob = await player(t, "Bob");
    await alice.mutation(api.worldChat.send, { body: "Bonjour" });
    await expect(
      alice.mutation(api.worldChat.send, { body: "Encore" }),
    ).rejects.toThrow("deux secondes");
    await bob.mutation(api.worldChat.send, { body: "Bienvenue" });
    vi.advanceTimersByTime(WORLD_CHAT_SEND_INTERVAL_MS - 1);
    await expect(
      alice.mutation(api.worldChat.send, { body: "Trop tôt" }),
    ).rejects.toThrow("deux secondes");
    vi.advanceTimersByTime(1);
    await alice.mutation(api.worldChat.send, { body: "Merci !" });
    expect(await bob.query(api.worldChat.list, {})).toHaveLength(3);
  });

  it("returns the latest 100 messages without deleting older history", async () => {
    const t = setup();
    const alice = await player(t, "Alice");
    await t.run(async (ctx) => {
      for (let i = 0; i < WORLD_CHAT_HISTORY_LIMIT + 5; i++) {
        vi.advanceTimersByTime(1);
        await ctx.db.insert("worldMessages", {
          senderId: "another-player",
          senderName: "Gardien",
          body: `Message ${i}`,
        });
      }
    });
    const messages = await alice.query(api.worldChat.list, {});
    expect(messages).toHaveLength(WORLD_CHAT_HISTORY_LIMIT);
    expect(messages[0]!.body).toBe("Message 5");
    expect(messages.at(-1)!.body).toBe("Message 104");
    expect(
      await t.run((ctx) => ctx.db.query("worldMessages").collect()),
    ).toHaveLength(105);
  });
});
