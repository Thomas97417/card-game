import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { describe, expect, it, vi, afterEach } from "vitest";
import { WELCOME_DIAMONDS, SUMMON_PACKS } from "@sylve/game/summoning";
import { api, components } from "../convex/_generated/api";
import schema from "../convex/schema";
import { DEFAULT_DECK } from "@sylve/game";

const modules = import.meta.glob("../convex/**/*.ts");
const requestId = (id: number) =>
  `sanctuary-request-${id.toString().padStart(8, "0")}`;
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
        expiresAt: now + 86_400_000,
      },
    },
  });
  return {
    userId: user._id,
    client: t.withIdentity({ subject: user._id, sessionId: session._id }),
  };
}
afterEach(() => vi.restoreAllMocks());

describe("sanctuaire autoritaire", () => {
  it("preserves the four starter cards when the first action is a direct invocation", async () => {
    const t = setup();
    const { client } = await player(t, "alice");
    await client.mutation(api.sanctuary.summon, {
      packId: "ancients",
      count: 1,
      requestId: requestId(1),
    });
    await client.mutation(api.decks.ensureStarter, {});
    expect((await client.query(api.decks.list, {}))[0]!.cardIds).toEqual(
      DEFAULT_DECK,
    );
    const collection = await client.query(api.collection.list, {});
    expect(collection).toHaveLength(5);
    for (const id of DEFAULT_DECK)
      expect(collection.some((entry) => entry.card.id === id)).toBe(true);
  });
  it("requires authentication for wallets, balances, purchases and results", async () => {
    const t = setup();
    await expect(t.query(api.collection.diamonds, {})).rejects.toThrow(
      "Connecte-toi",
    );
    await expect(t.mutation(api.sanctuary.ensureWallet, {})).rejects.toThrow(
      "Connecte-toi",
    );
    await expect(t.query(api.sanctuary.latest, {})).rejects.toThrow(
      "Connecte-toi",
    );
    await expect(
      t.mutation(api.sanctuary.summon, {
        packId: "sylve",
        count: 1,
        requestId: requestId(1),
      }),
    ).rejects.toThrow("Connecte-toi");
  });

  it("migrates an existing gold wallet once and never refills spent diamonds", async () => {
    const t = setup();
    const { client, userId } = await player(t, "alice");
    const walletId = await t.run((ctx) =>
      ctx.db.insert("wallets", { ownerId: userId, gold: 725 }),
    );
    expect(await client.query(api.collection.diamonds, {})).toBe(0);
    await Promise.all(
      Array.from({ length: 3 }, () =>
        client.mutation(api.sanctuary.ensureWallet, {}),
      ),
    );
    expect(await client.query(api.collection.diamonds, {})).toBe(
      WELCOME_DIAMONDS,
    );
    expect(await client.query(api.collection.gold, {})).toBe(725);
    await t.run((ctx) => ctx.db.patch(walletId, { diamonds: 0 }));
    await client.mutation(api.sanctuary.ensureWallet, {});
    expect(await client.query(api.collection.diamonds, {})).toBe(0);
    expect(
      await t.run((ctx) => ctx.db.query("wallets").collect()),
    ).toHaveLength(1);
  });

  it.each(SUMMON_PACKS)(
    "charges $tenPrice and grants $guaranteedLegendaries legendary cards for $id",
    async (pack) => {
      const t = setup();
      const { client, userId } = await player(t, "alice");
      await client.mutation(api.decks.ensureStarter, {});
      await t.run((ctx) =>
        ctx.db.insert("wallets", {
          ownerId: userId,
          gold: 0,
          diamonds: 10_000,
        }),
      );
      vi.spyOn(Math, "random").mockReturnValue(0);
      const result = await client.mutation(api.sanctuary.summon, {
        packId: pack.id,
        count: 10,
        requestId: requestId(1),
      });
      expect(result.cost).toBe(pack.tenPrice);
      expect(result.reveals).toHaveLength(10);
      expect(
        result.reveals.filter((item) => item.variantId.endsWith(":legendary")),
      ).toHaveLength(pack.guaranteedLegendaries);
      expect(await client.query(api.collection.diamonds, {})).toBe(
        10_000 - pack.tenPrice,
      );
      const collection = await client.query(api.collection.list, {});
      const totalCopies = collection.reduce(
        (sum, entry) => sum + entry.copies + 1,
        0,
      );
      expect(totalCopies).toBe(14);
      for (const item of result.reveals)
        expect(
          collection.some((entry) => entry.card.id === item.variantId),
        ).toBe(true);
      expect(await client.query(api.sanctuary.latest, {})).toEqual(result);
    },
  );

  it("charges once on concurrent retries and retains unlocks, levels and duplicate copies", async () => {
    const t = setup();
    const { client, userId } = await player(t, "alice");
    await client.mutation(api.decks.ensureStarter, {});
    await t.run(async (ctx) => {
      const card = (await ctx.db
        .query("collection")
        .withIndex("by_owner_variant", (q) =>
          q.eq("ownerId", userId).eq("variantId", "guardian:common"),
        )
        .unique())!;
      await ctx.db.patch(card._id, { level: 4, copies: 12 });
    });
    vi.spyOn(Math, "random").mockReturnValue(0);
    const request = {
      packId: "sylve" as const,
      count: 1 as const,
      requestId: requestId(1),
    };
    const results = await Promise.all([
      client.mutation(api.sanctuary.summon, request),
      client.mutation(api.sanctuary.summon, request),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(results[0]!.reveals[0]).toMatchObject({
      variantId: "guardian:common",
      isNew: false,
      level: 4,
      copies: 13,
    });
    expect(await client.query(api.collection.diamonds, {})).toBe(
      WELCOME_DIAMONDS - 149,
    );
    expect(
      await t.run((ctx) => ctx.db.query("summons").collect()),
    ).toHaveLength(1);
    await expect(
      client.mutation(api.sanctuary.summon, { ...request, count: 10 }),
    ).rejects.toThrow("autre pack");
    await expect(
      client.mutation(api.sanctuary.summon, { ...request, packId: "ancients" }),
    ).rejects.toThrow("autre pack");
  });

  it("serializes separate purchases without overspending and keeps another player's wallet private", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const bob = await player(t, "bob");
    await t.run((ctx) =>
      ctx.db.insert("wallets", {
        ownerId: alice.userId,
        gold: 0,
        diamonds: 4_000,
      }),
    );
    const outcomes = await Promise.allSettled(
      [1, 2].map((id) =>
        alice.client.mutation(api.sanctuary.summon, {
          packId: "ancients",
          count: 10,
          requestId: requestId(id),
        }),
      ),
    );
    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled"),
    ).toHaveLength(1);
    expect(await alice.client.query(api.collection.diamonds, {})).toBe(101);
    const before = await alice.client.query(api.collection.list, {});
    await expect(
      alice.client.mutation(api.sanctuary.summon, {
        packId: "ancients",
        count: 10,
        requestId: requestId(3),
      }),
    ).rejects.toThrow("assez de diamants");
    expect(await alice.client.query(api.collection.list, {})).toEqual(before);
    expect(await alice.client.query(api.collection.gold, {})).toBe(0);
    expect(await bob.client.query(api.collection.diamonds, {})).toBe(0);
    expect(await bob.client.query(api.sanctuary.latest, {})).toBeNull();
    await bob.client.mutation(api.sanctuary.summon, {
      packId: "sylve",
      count: 1,
      requestId: requestId(1),
    });
    expect(await bob.client.query(api.collection.diamonds, {})).toBe(2_851);
    expect(await alice.client.query(api.collection.diamonds, {})).toBe(101);
  });

  it("rejects unknown packs, invalid quantities and invalid request identifiers without a debit", async () => {
    const t = setup();
    const { client } = await player(t, "alice");
    await client.mutation(api.sanctuary.ensureWallet, {});
    for (const invalid of [
      { packId: "unknown" },
      { count: 11 },
      { count: -1 },
      { count: 1.5 },
      { requestId: "" },
    ]) {
      await expect(
        client.mutation(api.sanctuary.summon, {
          packId: "sylve",
          count: 1,
          requestId: requestId(1),
          ...invalid,
        } as never),
      ).rejects.toThrow();
    }
    expect(await client.query(api.collection.diamonds, {})).toBe(
      WELCOME_DIAMONDS,
    );
    expect(await client.query(api.collection.list, {})).toEqual([]);
  });
});
