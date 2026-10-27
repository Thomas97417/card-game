import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, components } from "../convex/_generated/api";
import schema from "../convex/schema";
import { friendshipPair, socialDay } from "../convex/lib/social";

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
        expiresAt: now + 7 * 86400000,
      },
    },
  });
  await t.run((ctx) => ctx.db.insert("wallets", {
    ownerId: String(user._id), gold: 0, experience: 120, catalogueVersion: 2,
  }));
  return {
    id: String(user._id),
    client: t.withIdentity({ subject: user._id, sessionId: session._id }),
  };
}
async function befriend(
  a: Awaited<ReturnType<typeof player>>,
  b: Awaited<ReturnType<typeof player>>,
) {
  await a.client.mutation(api.social.request, { playerId: b.id });
  await b.client.mutation(api.social.accept, { playerId: a.id });
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("amis et entraide", () => {
  it("authenticates reads, invitations, private chat and help", async () => {
    const t = setup();
    for (const query of [api.social.list, api.social.balance])
      await expect(t.query(query, {})).rejects.toThrow("Connecte-toi");
    await expect(
      t.query(api.friendChat.list, { playerId: "unknown" }),
    ).rejects.toThrow("Connecte-toi");
    for (const action of [
      api.social.request,
      api.social.accept,
      api.social.remove,
      api.social.sendHelp,
    ])
      await expect(t.mutation(action, { playerId: "unknown" })).rejects.toThrow(
        "Connecte-toi",
      );
    await expect(
      t.mutation(api.friendChat.send, { playerId: "unknown", body: "Salut" }),
    ).rejects.toThrow("Connecte-toi");
  });

  it("requires consent, exposes both request lists, handles crossed requests and removes both sides", async () => {
    const t = setup();
    const a = await player(t, "alice"),
      b = await player(t, "bob"),
      c = await player(t, "clara");
    await expect(
      a.client.mutation(api.social.request, { playerId: a.id }),
    ).rejects.toThrow("toi-même");
    await expect(
      a.client.mutation(api.social.request, { playerId: "unknown" }),
    ).rejects.toThrow("introuvable");
    await Promise.all([
      a.client.mutation(api.social.request, { playerId: b.id }),
      b.client.mutation(api.social.request, { playerId: a.id }),
    ]);
    expect(
      await t.run((ctx) => ctx.db.query("friendships").collect()),
    ).toHaveLength(1);
    // Whichever crossed request committed first must be accepted by its recipient.
    const incomingA = (await a.client.query(api.social.list, {})).incoming;
    const sender = incomingA.length ? b : a,
      recipient = incomingA.length ? a : b;
    expect(
      (await sender.client.query(api.social.list, {})).outgoing[0]?.playerId,
    ).toBe(recipient.id);
    expect(
      (await recipient.client.query(api.social.list, {})).incoming[0]?.playerId,
    ).toBe(sender.id);
    await expect(
      sender.client.mutation(api.social.accept, { playerId: recipient.id }),
    ).rejects.toThrow("doit accepter");
    await expect(
      c.client.mutation(api.social.accept, { playerId: sender.id }),
    ).rejects.toThrow("plus disponible");
    await recipient.client.mutation(api.social.accept, { playerId: sender.id });
    for (const [viewer, other] of [
      [a, b],
      [b, a],
    ]) {
      const list = await viewer!.client.query(api.social.list, {});
      expect(list.friends[0]?.playerId).toBe(other!.id);
      expect(list.incoming).toEqual([]);
      expect(list.outgoing).toEqual([]);
    }
    const profile = await a.client.query(api.collection.playerProfile, {
      ownerId: b.id,
    });
    expect(profile).toMatchObject({ trophies: 0, deck: null });
    await a.client.mutation(api.social.remove, { playerId: b.id });
    expect((await b.client.query(api.social.list, {})).friends).toEqual([]);
  });

  it("caps both lists at their rank allowance, including concurrent acceptances into the last slot", async () => {
    const t = setup();
    const a = await player(t, "alice"),
      b = await player(t, "bob"),
      c = await player(t, "clara");
    await b.client.mutation(api.social.request, { playerId: a.id });
    await c.client.mutation(api.social.request, { playerId: a.id });
    await t.run(async (ctx) => {
      for (let i = 0; i < 5 - 1; i++)
        await ctx.db.insert("friendships", {
          ...friendshipPair(a.id, `friend-${i}`),
          requestedBy: a.id,
          status: "accepted",
        });
    });
    const results = await Promise.allSettled([
      a.client.mutation(api.social.accept, { playerId: b.id }),
      a.client.mutation(api.social.accept, { playerId: c.id }),
    ]);
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("friendships")
          .filter((q) => q.eq(q.field("status"), "accepted"))
          .collect(),
      ),
    ).toHaveLength(5);
    const d = await player(t, "david");
    await expect(
      d.client.mutation(api.social.request, { playerId: a.id }),
    ).rejects.toThrow("déjà 5 amis");
    await expect(
      a.client.mutation(api.social.request, { playerId: d.id }),
    ).rejects.toThrow("déjà 5 amis");
  });

  it("credits only the recipient once per friend per day, without resetting on remove and re-add", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T22:59:00Z"));
    const t = setup();
    const a = await player(t, "alice"),
      b = await player(t, "bob"),
      c = await player(t, "clara");
    await expect(
      a.client.mutation(api.social.sendHelp, { playerId: b.id }),
    ).rejects.toThrow("tes amis");
    await befriend(a, b);
    await befriend(c, b);
    await Promise.all([
      a.client.mutation(api.social.sendHelp, { playerId: b.id }),
      a.client.mutation(api.social.sendHelp, { playerId: b.id }),
      c.client.mutation(api.social.sendHelp, { playerId: b.id }),
    ]);
    expect(await b.client.query(api.social.balance, {})).toBe(20);
    expect(await a.client.query(api.social.balance, {})).toBe(0);
    expect(
      (await a.client.query(api.social.list, {})).friends[0]?.helpSent,
    ).toBe(true);
    await a.client.mutation(api.social.remove, { playerId: b.id });
    await befriend(a, b);
    expect(
      await a.client.mutation(api.social.sendHelp, { playerId: b.id }),
    ).toMatchObject({ sent: false });
    vi.advanceTimersByTime(60_000);
    expect(
      (await a.client.query(api.social.list, {})).friends[0]?.helpSent,
    ).toBe(false);
    await a.client.mutation(api.social.sendHelp, { playerId: b.id });
    expect(await b.client.query(api.social.balance, {})).toBe(30);
    await b.client.mutation(api.social.sendHelp, { playerId: a.id });
    expect(await a.client.query(api.social.balance, {})).toBe(10);
  });

  it("uses midnight in Paris on winter and summer dates", () => {
    expect(socialDay(Date.parse("2026-10-26T22:59:59Z"))).toBe("2026-10-26");
    expect(socialDay(Date.parse("2026-10-26T23:00:00Z"))).toBe("2026-10-27");
    expect(socialDay(Date.parse("2026-07-01T22:00:00Z"))).toBe("2026-07-02");
  });

  it("keeps conversations private and prevents sending after a friendship is removed", async () => {
    vi.useFakeTimers();
    const t = setup();
    const a = await player(t, "alice"),
      b = await player(t, "bob"),
      c = await player(t, "clara");
    await expect(
      a.client.mutation(api.friendChat.send, { playerId: b.id, body: "Salut" }),
    ).rejects.toThrow("tes amis");
    await befriend(a, b);
    for (const body of [" \n ", "x".repeat(501)])
      await expect(
        a.client.mutation(api.friendChat.send, { playerId: b.id, body }),
      ).rejects.toThrow();
    await a.client.mutation(api.friendChat.send, {
      playerId: b.id,
      body: " Salut Bob ! ",
    });
    await expect(
      a.client.mutation(api.friendChat.send, {
        playerId: b.id,
        body: "Trop vite",
      }),
    ).rejects.toThrow("deux secondes");
    await b.client.mutation(api.friendChat.send, {
      playerId: a.id,
      body: "Salut Alice !",
    });
    expect(
      (await b.client.query(api.friendChat.list, { playerId: a.id })).map(
        (m) => [m.body, m.isOwn],
      ),
    ).toEqual([
      ["Salut Bob !", false],
      ["Salut Alice !", true],
    ]);
    expect(
      await c.client.query(api.friendChat.list, { playerId: a.id }),
    ).toEqual([]);
    expect(await a.client.query(api.worldChat.list, {})).toEqual([]);
    await a.client.mutation(api.social.remove, { playerId: b.id });
    expect(
      await b.client.query(api.friendChat.list, { playerId: a.id }),
    ).toEqual([]);
    vi.advanceTimersByTime(2000);
    await expect(
      b.client.mutation(api.friendChat.send, {
        playerId: a.id,
        body: "Encore",
      }),
    ).rejects.toThrow("tes amis");
  });

  it("buys common/rare summons only with help tokens, retries without a second debit, and cannot borrow emeralds", async () => {
    const t = setup();
    const a = await player(t, "alice");
    const walletId = await t.run(async (ctx) => {
      const wallet = (await ctx.db.query("wallets").unique())!;
      await ctx.db.patch(wallet._id, { diamonds: 99999, friendshipTokens: 149 });
      return wallet._id;
    });
    const request = {
      packId: "friendship" as const,
      count: 1 as const,
      requestId: "friendship-summon-0001",
    };
    await expect(
      a.client.mutation(api.sanctuary.summon, request),
    ).rejects.toThrow("jetons d’entraide");
    await t.run((ctx) => ctx.db.patch(walletId, { friendshipTokens: 150 }));
    const results = await Promise.all([
      a.client.mutation(api.sanctuary.summon, request),
      a.client.mutation(api.sanctuary.summon, request),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(results[0]!.reveals).toHaveLength(5);
    expect(
      results[0]!.reveals.every((r) => /:(common|rare)$/.test(r.variantId)),
    ).toBe(true);
    expect(await a.client.query(api.social.balance, {})).toBe(0);
    expect(await a.client.query(api.collection.diamonds, {})).toBe(99999);
    expect(await a.client.query(api.collection.gold, {})).toBe(
      results[0]!.gold,
    );
    await a.client.mutation(api.sanctuary.closeCircle, {
      repeatToken: results[0]!.repeatToken!,
    });
    await expect(
      a.client.mutation(api.sanctuary.summon, {
        ...request,
        requestId: "friendship-summon-0002",
        repeatToken: results[0]!.repeatToken,
      }),
    ).rejects.toThrow("remise");
  });
});
