import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { describe, expect, it } from "vitest";
import type { GoldPackId, GoldPurchaseRequest } from "@sylve/game/gold-packs";
import { api, components } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const requestId = (id: number) => `gold-purchase-request-${id}`;
function setup() {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  return t;
}
async function player(t: ReturnType<typeof setup>, name = "alice") {
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

describe("achat d’or avec des émeraudes", () => {
  it("requires authentication and rejects forged packs, amounts and request IDs", async () => {
    const t = setup();
    const request: GoldPurchaseRequest = {
      packId: "gold-pouch",
      requestId: requestId(1),
    };
    await expect(t.mutation(api.sanctuary.buyGold, request)).rejects.toThrow(
      "Connecte-toi",
    );
    const { client } = await player(t);
    await expect(
      client.mutation(api.sanctuary.buyGold, {
        ...request,
        packId: "forged-pack" as GoldPackId,
      }),
    ).rejects.toThrow();
    await expect(
      client.mutation(api.sanctuary.buyGold, {
        ...request,
        cost: 1,
        gold: 999_999,
        ownerId: "someone-else",
      } as GoldPurchaseRequest),
    ).rejects.toThrow();
    for (const invalid of ["", "short", "a".repeat(81), "!".repeat(20)])
      await expect(
        client.mutation(api.sanctuary.buyGold, {
          ...request,
          requestId: invalid,
        }),
      ).rejects.toThrow("Identifiant d’achat invalide");
    expect(await client.query(api.collection.gold, {})).toBe(0);
    expect(await t.run((ctx) => ctx.db.query("goldPurchases").collect())).toEqual(
      [],
    );
  });

  it.each([
    ["gold-pouch", 25_000, 150],
    ["gold-chest", 100_000, 500],
  ] as const)("exchanges the exact server price for %s", async (packId, gold, cost) => {
    const t = setup();
    const { client, userId } = await player(t);
    const walletId = await t.run((ctx) =>
      ctx.db.insert("wallets", {
        ownerId: userId,
        gold: 725,
        diamonds: cost,
        soulDust: 9,
        experience: 42,
      }),
    );
    expect(
      await client.mutation(api.sanctuary.buyGold, {
        packId,
        requestId: requestId(1),
      }),
    ).toEqual({ packId, gold, cost });
    expect(await client.query(api.collection.gold, {})).toBe(725 + gold);
    expect(await client.query(api.collection.diamonds, {})).toBe(0);
    expect(await t.run((ctx) => ctx.db.get(walletId))).toMatchObject({
      soulDust: 9,
      experience: 42,
    });
    const receipts = await t.run((ctx) => ctx.db.query("goldPurchases").collect());
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({ ownerId: userId, packId, gold, cost });
  });

  it("deduplicates concurrent retries even when the first purchase spent the last emeralds", async () => {
    const t = setup();
    const { client, userId } = await player(t);
    await t.run((ctx) =>
      ctx.db.insert("wallets", { ownerId: userId, gold: 10, diamonds: 150 }),
    );
    const request = { packId: "gold-pouch", requestId: requestId(1) } as const;
    const results = await Promise.all([
      client.mutation(api.sanctuary.buyGold, request),
      client.mutation(api.sanctuary.buyGold, request),
    ]);
    expect(results).toEqual([
      { packId: "gold-pouch", gold: 25_000, cost: 150 },
      { packId: "gold-pouch", gold: 25_000, cost: 150 },
    ]);
    expect(await client.mutation(api.sanctuary.buyGold, request)).toEqual(results[0]);
    expect(await client.query(api.collection.gold, {})).toBe(25_010);
    expect(await client.query(api.collection.diamonds, {})).toBe(0);
    expect(await t.run((ctx) => ctx.db.query("goldPurchases").collect())).toHaveLength(1);
    await expect(
      client.mutation(api.sanctuary.buyGold, { ...request, packId: "gold-chest" }),
    ).rejects.toThrow("autre pack");
  });

  it.each([
    ["gold-pouch", 149],
    ["gold-chest", 499],
    ["gold-pouch", 0],
    ["gold-pouch", -100],
  ] as const)("leaves both balances unchanged for %s with %i emeralds", async (packId, diamonds) => {
    const t = setup();
    const { client, userId } = await player(t);
    await t.run((ctx) =>
      ctx.db.insert("wallets", { ownerId: userId, gold: 725, diamonds }),
    );
    await expect(
      client.mutation(api.sanctuary.buyGold, { packId, requestId: requestId(1) }),
    ).rejects.toThrow("pas assez d’émeraudes");
    expect(await client.query(api.collection.gold, {})).toBe(725);
    expect(await client.query(api.collection.diamonds, {})).toBe(diamonds);
    expect(await t.run((ctx) => ctx.db.query("goldPurchases").collect())).toEqual([]);
  });

  it("serializes different purchases against the same balance without overspending", async () => {
    const t = setup();
    const { client, userId } = await player(t);
    await t.run((ctx) =>
      ctx.db.insert("wallets", { ownerId: userId, gold: 0, diamonds: 500 }),
    );
    const results = await Promise.allSettled([
      client.mutation(api.sanctuary.buyGold, {
        packId: "gold-chest",
        requestId: requestId(1),
      }),
      client.mutation(api.sanctuary.buyGold, {
        packId: "gold-pouch",
        requestId: requestId(2),
      }),
    ]);
    const success = results.filter((result) => result.status === "fulfilled");
    expect(success).toHaveLength(1);
    expect(await client.query(api.collection.gold, {})).toBe(success[0]!.value.gold);
    expect(await client.query(api.collection.diamonds, {})).toBe(500 - success[0]!.value.cost);
    expect(await t.run((ctx) => ctx.db.query("goldPurchases").collect())).toHaveLength(1);
  });

  it("scopes request IDs to each player and permits intentional repeat purchases", async () => {
    const t = setup();
    const alice = await player(t);
    const bob = await player(t, "bob");
    const request = { packId: "gold-pouch", requestId: requestId(1) } as const;
    await alice.client.mutation(api.sanctuary.buyGold, request);
    await bob.client.mutation(api.sanctuary.buyGold, request);
    await alice.client.mutation(api.sanctuary.buyGold, { ...request, requestId: requestId(2) });
    expect(await alice.client.query(api.collection.gold, {})).toBe(50_000);
    expect(await alice.client.query(api.collection.diamonds, {})).toBe(2_700);
    expect(await bob.client.query(api.collection.gold, {})).toBe(25_000);
    expect(await bob.client.query(api.collection.diamonds, {})).toBe(2_850);
  });

  it("migrates a legacy wallet once while preserving its existing gold", async () => {
    const t = setup();
    const { client, userId } = await player(t);
    await t.run((ctx) => ctx.db.insert("wallets", { ownerId: userId, gold: 725 }));
    await client.mutation(api.sanctuary.buyGold, { packId: "gold-chest", requestId: requestId(1) });
    await client.mutation(api.sanctuary.buyGold, { packId: "gold-pouch", requestId: requestId(2) });
    expect(await client.query(api.collection.gold, {})).toBe(125_725);
    expect(await client.query(api.collection.diamonds, {})).toBe(2_350);
  });
});
