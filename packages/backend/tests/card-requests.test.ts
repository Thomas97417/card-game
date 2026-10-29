import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, components } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
function setup() {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  return t;
}
type Test = ReturnType<typeof setup>;
async function player(
  t: Test,
  name: string,
  experience = 120,
  peakTrophies = 0,
) {
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
  const id = String(user._id);
  const walletId = await t.run((ctx) =>
    ctx.db.insert("wallets", {
      ownerId: id,
      gold: 0,
      diamonds: 0,
      experience,
      catalogueVersion: 2,
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("leagueProgress", { ownerId: id, trophies: 0, peakTrophies }),
  );
  return {
    id,
    walletId,
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
function stock(
  t: Test,
  ownerId: string,
  variantId = "guardian:common",
  copies = 100,
  level = 1,
) {
  return t.run((ctx) =>
    ctx.db.insert("collection", { ownerId, variantId, copies, level }),
  );
}
afterEach(() => vi.useRealTimers());

describe("daily card requests and donations", () => {
  it("authenticates requests, stock views and donations", async () => {
    const t = setup();
    const requestId = await t.run((ctx) =>
      ctx.db.insert("cardRequests", {
        ownerId: "alice",
        day: "2026-10-29",
        variantId: "guardian:common",
        requested: 5,
        received: 0,
      }),
    );
    for (const query of [api.social.cardRequestStatus, api.social.cardRequests])
      await expect(t.query(query, {})).rejects.toThrow("Connecte-toi");
    await expect(
      t.mutation(api.social.requestCards, { variantId: "guardian:common" }),
    ).rejects.toThrow("Connecte-toi");
    await expect(
      t.mutation(api.social.donateCards, {
        requestId,
        count: 1,
        expectedDonated: 0,
      }),
    ).rejects.toThrow("Connecte-toi");
  });

  it("requires unlocked friends and a discovered common or rare, without consuming failed attempts", async () => {
    const t = setup();
    const locked = await player(t, "locked", 0),
      a = await player(t, "alice");
    await stock(t, locked.id);
    await expect(
      locked.client.mutation(api.social.requestCards, {
        variantId: "guardian:common",
      }),
    ).rejects.toThrow("rang 5");
    for (const variantId of ["guardian:epic", "guardian:legendary"])
      await expect(
        a.client.mutation(api.social.requestCards, { variantId }),
      ).rejects.toThrow("communes ou rares");
    await expect(
      a.client.mutation(api.social.requestCards, { variantId: "no-such-card" }),
    ).rejects.toThrow();
    await expect(
      a.client.mutation(api.social.requestCards, {
        variantId: "guardian:common",
      }),
    ).rejects.toThrow("Découvre");
    expect(
      (await a.client.query(api.social.cardRequestStatus, {})).request,
    ).toBeNull();
    await stock(t, a.id, "guardian:common", 0);
    await a.client.mutation(api.social.requestCards, {
      variantId: "guardian:common",
    });
    expect(
      await a.client.query(api.social.cardRequestStatus, {}),
    ).toMatchObject({
      unlocked: true,
      leagueLabel: "Fer IV",
      request: { variantId: "guardian:common", requested: 5, received: 0 },
    });
  });

  it("keeps one request per Paris day across concurrent retries, completion and midnight", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-29T22:59:59Z"));
    const t = setup();
    const a = await player(t, "alice"),
      b = await player(t, "bob");
    await befriend(a, b);
    await stock(t, a.id, "guardian:common", 0);
    await stock(t, a.id, "guardian:rare", 0);
    await stock(t, b.id);
    const results = await Promise.all(
      [1, 2].map(() =>
        a.client.mutation(api.social.requestCards, {
          variantId: "guardian:common",
        }),
      ),
    );
    expect(results[0]).toBe(results[1]);
    expect(
      await t.run((ctx) => ctx.db.query("cardRequests").collect()),
    ).toHaveLength(1);
    await b.client.mutation(api.social.donateCards, {
      requestId: results[0]!,
      count: 5,
      expectedDonated: 0,
    });
    await expect(
      a.client.mutation(api.social.requestCards, {
        variantId: "guardian:rare",
      }),
    ).rejects.toThrow("déjà demandé");
    expect(
      (
        await a.client.query(api.social.cardRequestStatus, {
          refreshDay: "2099-01-01",
        })
      ).day,
    ).toBe("2026-10-29");
    vi.setSystemTime(new Date("2026-10-29T23:00:00Z"));
    expect(
      (await a.client.query(api.social.cardRequestStatus, {})).request,
    ).toBeNull();
    expect(await b.client.query(api.social.cardRequests, {})).toEqual([]);
    await expect(
      b.client.mutation(api.social.donateCards, {
        requestId: results[0]!,
        count: 1,
        expectedDonated: 5,
      }),
    ).rejects.toThrow("expiré");
    const next = await a.client.mutation(api.social.requestCards, {
      variantId: "guardian:rare",
    });
    expect(next).not.toBe(results[0]);
  });

  it("allows only one of two concurrent requests for different cards", async () => {
    const t = setup();
    const a = await player(t, "alice");
    await stock(t, a.id);
    await stock(t, a.id, "guardian:rare");
    const attempts = await Promise.allSettled(
      ["guardian:common", "guardian:rare"].map((variantId) =>
        a.client.mutation(api.social.requestCards, { variantId }),
      ),
    );
    expect(
      attempts.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      await t.run((ctx) => ctx.db.query("cardRequests").collect()),
    ).toHaveLength(1);
  });

  it("moves only reserve copies, preserves levels and credits sender rank XP once on retries", async () => {
    const t = setup();
    const a = await player(t, "alice"),
      b = await player(t, "bob", 149);
    await befriend(a, b);
    const recipientId = await stock(t, a.id, "guardian:rare", 4, 2);
    const senderId = await stock(t, b.id, "guardian:rare", 2, 3);
    const requestId = await a.client.mutation(api.social.requestCards, {
      variantId: "guardian:rare",
    });
    const request = (await b.client.query(api.social.cardRequests, {}))[0]!;
    expect(request).toMatchObject({
      playerName: "alice",
      copies: 2,
      sendable: 2,
      donationLimit: 2,
      experiencePerCard: 3,
    });
    const results = await Promise.all(
      [1, 2].map(() =>
        b.client.mutation(api.social.donateCards, {
          requestId,
          count: 2,
          expectedDonated: 0,
        }),
      ),
    );
    expect(results.filter((result) => result.sent)).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.get(senderId))).toMatchObject({
      level: 3,
      copies: 0,
    });
    expect(await t.run((ctx) => ctx.db.get(recipientId))).toMatchObject({
      level: 2,
      copies: 6,
    });
    expect(await b.client.query(api.collection.rank, {})).toMatchObject({
      rank: 6,
      experience: 155,
      mineLevel: 2,
      pending: { toRank: 6 },
    });
    expect((await a.client.query(api.collection.rank, {})).experience).toBe(
      120,
    );
    expect(
      (await a.client.query(api.social.cardRequestStatus, {})).request,
    ).toMatchObject({ received: 2 });
    expect(
      await t.run((ctx) => ctx.db.query("cardDonations").collect()),
    ).toHaveLength(1);
  });

  it("keeps requests private and rechecks friendship, quantities and remaining reserves on every donation", async () => {
    const t = setup();
    const a = await player(t, "alice"),
      b = await player(t, "bob"),
      c = await player(t, "clara");
    await stock(t, a.id);
    const senderId = await stock(t, b.id, "guardian:common", 1);
    const requestId = await a.client.mutation(api.social.requestCards, {
      variantId: "guardian:common",
    });
    expect(await c.client.query(api.social.cardRequests, {})).toEqual([]);
    await expect(
      c.client.mutation(api.social.donateCards, {
        requestId,
        count: 1,
        expectedDonated: 0,
      }),
    ).rejects.toThrow("tes amis");
    await b.client.mutation(api.social.request, { playerId: a.id });
    expect(await b.client.query(api.social.cardRequests, {})).toEqual([]);
    await expect(
      b.client.mutation(api.social.donateCards, {
        requestId,
        count: 1,
        expectedDonated: 0,
      }),
    ).rejects.toThrow("tes amis");
    await a.client.mutation(api.social.accept, { playerId: b.id });
    await expect(
      a.client.mutation(api.social.donateCards, {
        requestId,
        count: 1,
        expectedDonated: 0,
      }),
    ).rejects.toThrow("propre demande");
    for (const count of [-1, 0, 1.5, Number.MAX_SAFE_INTEGER + 1])
      await expect(
        b.client.mutation(api.social.donateCards, {
          requestId,
          count,
          expectedDonated: 0,
        }),
      ).rejects.toThrow("invalide");
    await expect(
      b.client.mutation(api.social.donateCards, {
        requestId,
        count: 1,
        expectedDonated: -1,
      }),
    ).rejects.toThrow("invalide");
    await expect(
      b.client.mutation(api.social.donateCards, {
        requestId,
        count: 2,
        expectedDonated: 0,
      }),
    ).rejects.toThrow("réserve");
    await t.run((ctx) => ctx.db.patch(senderId, { copies: 0 }));
    expect(
      (await b.client.query(api.social.cardRequests, {}))[0]!.sendable,
    ).toBe(0);
    await expect(
      b.client.mutation(api.social.donateCards, {
        requestId,
        count: 1,
        expectedDonated: 0,
      }),
    ).rejects.toThrow("réserve");
    await a.client.mutation(api.social.remove, { playerId: b.id });
    expect(await b.client.query(api.social.cardRequests, {})).toEqual([]);
    await expect(
      b.client.mutation(api.social.donateCards, {
        requestId,
        count: 1,
        expectedDonated: 0,
      }),
    ).rejects.toThrow("tes amis");
    expect((await b.client.query(api.collection.rank, {})).experience).toBe(
      120,
    );
  });

  it("uses each player's best league and persists cumulative limits after removing and re-adding friends", async () => {
    const t = setup();
    const a = await player(t, "alice", 120, 6000),
      b = await player(t, "bob", 120, 2000);
    await befriend(a, b);
    await stock(t, a.id);
    const senderId = await stock(t, b.id);
    const requestId = await a.client.mutation(api.social.requestCards, {
      variantId: "guardian:common",
    });
    expect(
      (await a.client.query(api.social.cardRequestStatus, {})).request
        ?.requested,
    ).toBe(150);
    expect(
      (await b.client.query(api.social.cardRequests, {}))[0]!.donationLimit,
    ).toBe(17);
    await expect(
      b.client.mutation(api.social.donateCards, {
        requestId,
        count: 18,
        expectedDonated: 0,
      }),
    ).rejects.toThrow("maximum 17");
    await b.client.mutation(api.social.donateCards, {
      requestId,
      count: 10,
      expectedDonated: 0,
    });
    expect(
      (await b.client.query(api.social.cardRequests, {}))[0],
    ).toMatchObject({ donated: 10, sendable: 7 });
    await b.client.mutation(api.social.donateCards, {
      requestId,
      count: 7,
      expectedDonated: 10,
    });
    await b.client.mutation(api.social.remove, { playerId: a.id });
    await befriend(a, b);
    expect(
      (await b.client.query(api.social.cardRequests, {}))[0],
    ).toMatchObject({ donated: 17, sendable: 0 });
    await expect(
      b.client.mutation(api.social.donateCards, {
        requestId,
        count: 1,
        expectedDonated: 17,
      }),
    ).rejects.toThrow("maximum 17");
    expect((await t.run((ctx) => ctx.db.get(senderId)))!.copies).toBe(83);
    expect((await b.client.query(api.collection.rank, {})).experience).toBe(
      137,
    );
  });

  it("serializes two donors filling the last requested card without overfilling or awarding extra XP", async () => {
    const t = setup();
    const a = await player(t, "alice"),
      b = await player(t, "bob"),
      c = await player(t, "clara");
    await befriend(a, b);
    await befriend(a, c);
    await stock(t, a.id, "guardian:rare", 0);
    const bStock = await stock(t, b.id, "guardian:rare", 10);
    const cStock = await stock(t, c.id, "guardian:rare", 10);
    const requestId = await a.client.mutation(api.social.requestCards, {
      variantId: "guardian:rare",
    });
    await b.client.mutation(api.social.donateCards, {
      requestId,
      count: 1,
      expectedDonated: 0,
    });
    const results = await Promise.allSettled([
      b.client.mutation(api.social.donateCards, {
        requestId,
        count: 1,
        expectedDonated: 1,
      }),
      c.client.mutation(api.social.donateCards, {
        requestId,
        count: 1,
        expectedDonated: 0,
      }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      (await a.client.query(api.social.cardRequestStatus, {})).request
        ?.received,
    ).toBe(2);
    const reserves = await t.run(
      async (ctx) =>
        (await ctx.db.get(bStock))!.copies + (await ctx.db.get(cStock))!.copies,
    );
    expect(reserves).toBe(18);
    const ranks = await Promise.all([
      b.client.query(api.collection.rank, {}),
      c.client.query(api.collection.rank, {}),
    ]);
    expect(ranks.reduce((sum, rank) => sum + rank.experience, 0)).toBe(246);
  });
});
