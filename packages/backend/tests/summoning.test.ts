import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  WELCOME_DIAMONDS,
  SUMMON_PACKS,
  summonOffer,
  type SummonResult,
} from "@sylve/game/summoning";
import { api, components } from "../convex/_generated/api";
import schema from "../convex/schema";
import { DEFAULT_DECK } from "@sylve/game";

const modules = import.meta.glob("../convex/**/*.ts");
const requestId = (id: number) =>
  `sanctuary-request-${id.toString().padStart(8, "0")}`;
function history(result: SummonResult) {
  const saved = { ...result };
  delete saved.repeatToken;
  saved.revealCompleted ??= true;
  return saved;
}
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
  it("authenticates key purchases, rejects league slots and debits each permanent unlock only once", async () => {
    const t = setup();
    await expect(
      t.mutation(api.sanctuary.unlockChestSlot, { slot: 5 }),
    ).rejects.toThrow("Connecte-toi");
    const { client, userId } = await player(t, "alice");
    const bob = await player(t, "bob");
    for (const slot of [-1, 0, 2, 4, 5.5, 8])
      await expect(
        client.mutation(api.sanctuary.unlockChestSlot, { slot }),
      ).rejects.toThrow("ne s’achète pas");
    const attempts = await Promise.all([
      client.mutation(api.sanctuary.unlockChestSlot, { slot: 5 }),
      client.mutation(api.sanctuary.unlockChestSlot, { slot: 5 }),
    ]);
    expect(attempts).toEqual([
      { slot: 5, cost: 500 },
      { slot: 5, cost: 500 },
    ]);
    expect(await client.query(api.collection.diamonds, {})).toBe(2500);
    expect((await client.query(api.chests.list, {})).purchasedSlots).toEqual([
      5,
    ]);
    expect(
      (await bob.client.query(api.chests.list, {})).purchasedSlots,
    ).toEqual([]);
    await client.mutation(api.sanctuary.unlockChestSlot, { slot: 7 });
    await client.mutation(api.sanctuary.unlockChestSlot, { slot: 6 });
    expect(await client.query(api.collection.diamonds, {})).toBe(0);
    expect(
      await client.mutation(api.sanctuary.unlockChestSlot, { slot: 7 }),
    ).toEqual({ slot: 7, cost: 1500 });
    const saved = await t.run((ctx) =>
      ctx.db
        .query("chestSlotUnlocks")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .collect(),
    );
    expect(saved).toHaveLength(3);
    expect(saved.reduce((cost, unlock) => cost + unlock.cost, 0)).toBe(3000);
  });
  it("rejects an unaffordable key without unlocking a slot or touching gold", async () => {
    const t = setup();
    const { client, userId } = await player(t, "alice");
    await t.run((ctx) =>
      ctx.db.insert("wallets", { ownerId: userId, gold: 725, diamonds: 499 }),
    );
    await expect(
      client.mutation(api.sanctuary.unlockChestSlot, { slot: 5 }),
    ).rejects.toThrow("pas assez d’émeraudes");
    expect(await client.query(api.collection.diamonds, {})).toBe(499);
    expect(await client.query(api.collection.gold, {})).toBe(725);
    expect((await client.query(api.chests.list, {})).purchasedSlots).toEqual(
      [],
    );
  });
  it("serializes competing keys against the same emerald balance", async () => {
    const t = setup();
    const { client, userId } = await player(t, "alice");
    await t.run((ctx) =>
      ctx.db.insert("wallets", { ownerId: userId, gold: 0, diamonds: 1000 }),
    );
    const attempts = await Promise.allSettled([
      client.mutation(api.sanctuary.unlockChestSlot, { slot: 5 }),
      client.mutation(api.sanctuary.unlockChestSlot, { slot: 6 }),
    ]);
    expect(
      attempts.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      (await client.query(api.chests.list, {})).purchasedSlots,
    ).toHaveLength(1);
    expect(
      await client.query(api.collection.diamonds, {}),
    ).toBeGreaterThanOrEqual(0);
  });
  it("keeps summoned cards behind league deck limits and preserves diamonds when settling a defeat", async () => {
    const t = setup();
    const { client, userId } = await player(t, "alice");
    vi.spyOn(Math, "random").mockReturnValue(0);
    const invocation = await client.mutation(api.sanctuary.summon, {
      packId: "ancients",
      count: 1,
      requestId: requestId(1),
    });
    const variantId = invocation.reveals[0]!.variantId;
    const deckId = await client.mutation(api.decks.ensureStarter, {});
    expect((await client.query(api.collection.league, {})).trophies).toBe(0);
    await expect(
      client.mutation(api.decks.save, {
        deckId,
        name: "Cinq cartes",
        cardIds: [...DEFAULT_DECK, variantId],
      }),
    ).rejects.toThrow("autorise 4 cartes");
    await client.mutation(api.decks.save, {
      deckId,
      name: "Compagnon invoqué",
      cardIds: [...DEFAULT_DECK.slice(0, 3), variantId],
    });
    await t.run((ctx) =>
      ctx.db.insert("leagueProgress", { ownerId: userId, trophies: 25 }),
    );
    const gameId = await client.mutation(api.games.createSolo, { deckId });
    const game = await client.query(api.games.get, { gameId });
    expect(
      game.players[1]!.deck.every(
        (card) => card.rarity === "common" && card.level === 1,
      ),
    ).toBe(true);
    await client.mutation(api.games.surrender, { gameId });
    expect((await client.query(api.collection.league, {})).trophies).toBe(10);
    expect(await client.query(api.collection.diamonds, {})).toBe(
      WELCOME_DIAMONDS - invocation.cost,
    );
    expect(await client.query(api.sanctuary.latest, {})).toEqual(
      history(invocation),
    );
    expect(
      (await client.query(api.collection.list, {})).some(
        (entry) => entry.card.id === variantId,
      ),
    ).toBe(true);
  });

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
    expect(collection.length).toBeGreaterThanOrEqual(5);
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
      t.mutation(api.sanctuary.closeCircle, { repeatToken: "closed-circle" }),
    ).rejects.toThrow("Connecte-toi");
    await expect(t.query(api.sanctuary.offers, {})).rejects.toThrow(
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
          diamonds: 100_000,
        }),
      );
      vi.spyOn(Math, "random").mockReturnValue(0);
      const result = await client.mutation(api.sanctuary.summon, {
        packId: pack.id,
        count: 10,
        requestId: requestId(1),
      });
      expect(result.cost).toBe(pack.tenPrice);
      expect(result.reveals).toHaveLength(50);
      expect(
        result.reveals.filter((item) => item.variantId.endsWith(":legendary")),
      ).toHaveLength(pack.guaranteedLegendaries);
      expect(await client.query(api.collection.diamonds, {})).toBe(
        100_000 - pack.tenPrice,
      );
      const collection = await client.query(api.collection.list, {});
      const totalCopies = collection.reduce(
        (sum, entry) => sum + entry.copies + 1,
        0,
      );
      expect(totalCopies).toBe(
        4 + result.reveals.reduce((sum, item) => sum + item.count, 0),
      );
      for (const item of result.reveals)
        expect(
          collection.some((entry) => entry.card.id === item.variantId),
        ).toBe(true);
      expect(result.gold).toBe(5000);
      expect(result.goldBySummon).toEqual(Array(10).fill(500));
      expect(await client.query(api.collection.gold, {})).toBe(result.gold);
      expect(await client.query(api.sanctuary.latest, {})).toEqual(
        history(result),
      );
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
      copies: 32,
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

  it("uses peak league quantities after demotion and freezes the retried result after promotion", async () => {
    const t = setup();
    const { client, userId } = await player(t, "alice");
    const progressId = await t.run((ctx) =>
      ctx.db.insert("leagueProgress", {
        ownerId: userId,
        trophies: 0,
        peakTrophies: 2400,
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert("wallets", { ownerId: userId, gold: 0, diamonds: 10000 }),
    );
    vi.spyOn(Math, "random").mockReturnValue(0);
    const request = {
      packId: "divine" as const,
      count: 1 as const,
      requestId: requestId(1),
    };
    const result = await client.mutation(api.sanctuary.summon, request);
    expect(result.reveals.map((item) => item.count)).toEqual([
      70, 35, 35, 35, 35,
    ]);
    await t.run((ctx) =>
      ctx.db.patch(progressId, { trophies: 6000, peakTrophies: 6000 }),
    );
    expect(await client.mutation(api.sanctuary.summon, request)).toEqual(
      result,
    );
    expect(await client.query(api.collection.diamonds, {})).toBe(10000 - 4499);
  });

  it.each([1, 10] as const)(
    "credits the Sylve gold bonus once with %s summons, including concurrent retries",
    async (count) => {
      const t = setup();
      const { client, userId } = await player(t, "alice");
      await t.run((ctx) =>
        ctx.db.insert("wallets", {
          ownerId: userId,
          gold: 725,
          diamonds: 10000,
        }),
      );
      vi.spyOn(Math, "random").mockReturnValue(0);
      const request = {
        packId: "sylve" as const,
        count,
        requestId: requestId(1),
      };
      const results = await Promise.all([
        client.mutation(api.sanctuary.summon, request),
        client.mutation(api.sanctuary.summon, request),
      ]);
      expect(results[0]).toEqual(results[1]);
      expect(results[0]!.gold).toBe(500 * count);
      expect(results[0]!.reveals).toHaveLength(5 * count);
      expect(await client.query(api.collection.gold, {})).toBe(
        725 + 500 * count,
      );
      expect(await client.query(api.collection.diamonds, {})).toBe(
        10000 - results[0]!.cost,
      );
      expect(await client.query(api.sanctuary.latest, {})).toEqual(
        history(results[0]!),
      );
      await client.mutation(api.sanctuary.summon, request);
      expect(await client.query(api.collection.gold, {})).toBe(
        725 + 500 * count,
      );
      expect(
        await t.run((ctx) => ctx.db.query("summons").collect()),
      ).toHaveLength(1);
    },
  );

  it("scales the gold card with peak league and preserves the amount of a retried invocation", async () => {
    const t = setup();
    const { client, userId } = await player(t, "alice");
    const progressId = await t.run((ctx) =>
      ctx.db.insert("leagueProgress", {
        ownerId: userId,
        trophies: 0,
        peakTrophies: 2400,
      }),
    );
    vi.spyOn(Math, "random").mockReturnValue(0);
    const request = {
      packId: "sylve" as const,
      count: 1 as const,
      requestId: requestId(1),
    };
    const first = await client.mutation(api.sanctuary.summon, request);
    expect(first.gold).toBe(1100);
    await t.run((ctx) =>
      ctx.db.patch(progressId, { trophies: 6000, peakTrophies: 6000 }),
    );
    expect(await client.mutation(api.sanctuary.summon, request)).toEqual(first);
    const second = await client.mutation(api.sanctuary.summon, {
      ...request,
      requestId: requestId(2),
    });
    expect(second.gold).toBe(2000);
    expect(await client.query(api.collection.gold, {})).toBe(3100);
  });

  it("does not grant a gold card when a Sylve purchase is unaffordable", async () => {
    const t = setup();
    const { client, userId } = await player(t, "alice");
    await t.run((ctx) =>
      ctx.db.insert("wallets", { ownerId: userId, gold: 725, diamonds: 148 }),
    );
    await expect(
      client.mutation(api.sanctuary.summon, {
        packId: "sylve",
        count: 1,
        requestId: requestId(1),
      }),
    ).rejects.toThrow("assez d’émeraudes");
    expect(await client.query(api.collection.gold, {})).toBe(725);
    expect(await client.query(api.collection.diamonds, {})).toBe(148);
    expect(await client.query(api.collection.list, {})).toEqual([]);
    expect(await client.query(api.sanctuary.latest, {})).toBeNull();
  });

  it("replays historical summons without granting a retroactive gold bonus", async () => {
    const t = setup();
    const { client, userId } = await player(t, "alice");
    const oldResult = {
      requestId: requestId(1),
      packId: "sylve" as const,
      count: 1 as const,
      cost: 149,
      reveals: [],
    };
    await t.run(async (ctx) => {
      await ctx.db.insert("wallets", {
        ownerId: userId,
        gold: 725,
        diamonds: 0,
      });
      await ctx.db.insert("summons", { ownerId: userId, ...oldResult });
    });
    const replay = { ...oldResult, gold: 0, revealCompleted: true };
    expect(await client.query(api.sanctuary.latest, {})).toEqual(replay);
    expect(
      await client.mutation(api.sanctuary.summon, {
        packId: "sylve",
        count: 1,
        requestId: requestId(1),
      }),
    ).toEqual(replay);
    expect(await client.query(api.collection.gold, {})).toBe(725);
    expect(await client.query(api.collection.diamonds, {})).toBe(0);
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
    ).rejects.toThrow("assez d’émeraudes");
    expect(await alice.client.query(api.collection.list, {})).toEqual(before);
    expect(
      await alice.client.query(api.collection.gold, {}),
    ).toBeGreaterThanOrEqual(5000);
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

  it.each(
    SUMMON_PACKS.flatMap((pack) =>
      ([1, 10] as const).map((count) => ({ packId: pack.id, count })),
    ),
  )(
    "limits the $packId x$count discount to its active circle and keeps shop prices unchanged",
    async ({ packId, count }) => {
      const t = setup();
      const { client, userId } = await player(t, "alice");
      await t.run((ctx) =>
        ctx.db.insert("wallets", {
          ownerId: userId,
          gold: 0,
          diamonds: 300000,
        }),
      );
      vi.spyOn(Math, "random").mockReturnValue(0);
      const before = await client.query(api.sanctuary.offers, {});
      expect(before).toHaveLength(6);
      expect(before.every((offer) => offer.cost === offer.baseCost)).toBe(true);
      const request = { packId, count, requestId: requestId(1) };
      const first = await client.mutation(api.sanctuary.summon, request);
      expect(first.cost).toBe(summonOffer(packId, count).cost);
      expect(first.repeatToken).toBeTruthy();
      expect(await client.query(api.sanctuary.offers, {})).toEqual(before);
      expect(await client.query(api.sanctuary.latest, {})).toEqual(
        history(first),
      );
      const nextRequest = {
        ...request,
        requestId: requestId(2),
        repeatToken: first.repeatToken,
      };
      const results = await Promise.all([
        client.mutation(api.sanctuary.summon, nextRequest),
        client.mutation(api.sanctuary.summon, nextRequest),
      ]);
      expect(results[0]).toEqual(results[1]);
      const second = results[0]!;
      expect(second.cost).toBe(summonOffer(packId, count, true).cost);
      expect(second.repeatToken).not.toBe(first.repeatToken);
      expect(second.goldBySummon).toHaveLength(count);
      expect(second.goldBySummon!.reduce((a, b) => a + b, 0)).toBe(second.gold);
      // Replaying an earlier purchase cannot reactivate its spent permission.
      expect(await client.mutation(api.sanctuary.summon, request)).toEqual(
        history(first),
      );
      await expect(
        client.mutation(api.sanctuary.summon, {
          ...nextRequest,
          requestId: requestId(3),
        }),
      ).rejects.toThrow("remise n’est plus disponible");
      const thirdRequest = {
        ...request,
        requestId: requestId(5),
        repeatToken: second.repeatToken,
      };
      const third = await client.mutation(api.sanctuary.summon, thirdRequest);
      const fourth = await client.mutation(api.sanctuary.summon, {
        ...request,
        requestId: requestId(6),
        repeatToken: third.repeatToken,
      });
      const cappedCost = packId === "sylve" && count === 1 ? 129 : second.cost;
      expect(third.cost).toBe(cappedCost);
      expect(fourth.cost).toBe(cappedCost);
      expect(await client.mutation(api.sanctuary.summon, thirdRequest)).toEqual(
        history(third),
      );
      expect(await client.query(api.collection.diamonds, {})).toBe(
        300000 - first.cost - second.cost - third.cost - fourth.cost,
      );
      expect(await client.query(api.sanctuary.offers, {})).toEqual(before);
      // Buying from the shop always uses its base price, even with an open circle.
      const fresh = await client.mutation(api.sanctuary.summon, {
        ...request,
        requestId: requestId(4),
      });
      expect(fresh.cost).toBe(first.cost);
      expect(await client.query(api.sanctuary.latest, {})).toEqual(
        history(fresh),
      );
      const freshRepeat = await client.mutation(api.sanctuary.summon, {
        ...request,
        requestId: requestId(7),
        repeatToken: fresh.repeatToken,
      });
      expect(freshRepeat.cost).toBe(second.cost);
    },
  );

  it("revokes a closed circle without reviving it through history or retries, and ignores stale close requests", async () => {
    const t = setup();
    const { client } = await player(t, "alice");
    const request = {
      packId: "sylve" as const,
      count: 1 as const,
      requestId: requestId(1),
    };
    const first = await client.mutation(api.sanctuary.summon, request);
    await client.mutation(api.sanctuary.closeCircle, {
      repeatToken: first.repeatToken!,
    });
    await client.mutation(api.sanctuary.closeCircle, {
      repeatToken: first.repeatToken!,
    });
    expect(await client.query(api.sanctuary.latest, {})).toEqual(
      history(first),
    );
    expect(await client.mutation(api.sanctuary.summon, request)).toEqual(
      history(first),
    );
    await expect(
      client.mutation(api.sanctuary.summon, {
        ...request,
        requestId: requestId(2),
        repeatToken: first.repeatToken,
      }),
    ).rejects.toThrow("remise n’est plus disponible");
    expect(await client.query(api.collection.diamonds, {})).toBe(
      WELCOME_DIAMONDS - 149,
    );
    const second = await client.mutation(api.sanctuary.summon, {
      ...request,
      requestId: requestId(3),
    });
    expect(second.cost).toBe(149);
    await client.mutation(api.sanctuary.closeCircle, {
      repeatToken: first.repeatToken!,
    });
    const third = await client.mutation(api.sanctuary.summon, {
      ...request,
      requestId: requestId(4),
      repeatToken: second.repeatToken,
    });
    expect(third.cost).toBe(139);
    expect(await client.query(api.collection.diamonds, {})).toBe(
      WELCOME_DIAMONDS - 149 - 149 - 139,
    );
  });

  it("rejects forged permissions and changes of account, pack or format without a debit", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const bob = await player(t, "bob");
    const request = {
      packId: "sylve" as const,
      count: 1 as const,
      requestId: requestId(1),
    };
    const first = await alice.client.mutation(api.sanctuary.summon, request);
    for (const change of [
      { repeatToken: "forged-circle" },
      { count: 10 as const },
      { packId: "ancients" as const },
    ])
      await expect(
        alice.client.mutation(api.sanctuary.summon, {
          ...request,
          requestId: requestId(2),
          repeatToken: first.repeatToken,
          ...change,
        }),
      ).rejects.toThrow("remise n’est plus disponible");
    await expect(
      bob.client.mutation(api.sanctuary.summon, {
        ...request,
        repeatToken: first.repeatToken,
      }),
    ).rejects.toThrow("remise n’est plus disponible");
    await bob.client.mutation(api.sanctuary.closeCircle, {
      repeatToken: first.repeatToken!,
    });
    expect(await alice.client.query(api.collection.diamonds, {})).toBe(
      WELCOME_DIAMONDS - 149,
    );
    expect(await bob.client.query(api.collection.diamonds, {})).toBe(0);
    expect(await bob.client.query(api.sanctuary.latest, {})).toBeNull();
    const second = await alice.client.mutation(api.sanctuary.summon, {
      ...request,
      requestId: requestId(3),
      repeatToken: first.repeatToken,
    });
    expect(second.cost).toBe(139);
  });

  it("allows only one distinct purchase to spend an active circle's discount", async () => {
    const t = setup();
    const { client, userId } = await player(t, "alice");
    vi.spyOn(Math, "random").mockReturnValue(0);
    const first = await client.mutation(api.sanctuary.summon, {
      packId: "sylve",
      count: 1,
      requestId: requestId(1),
    });
    await t.run(async (ctx) => {
      const wallet = (await ctx.db
        .query("wallets")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .unique())!;
      await ctx.db.patch(wallet._id, { diamonds: 1000 });
    });
    const results = await Promise.allSettled(
      [2, 3].map((id) =>
        client.mutation(api.sanctuary.summon, {
          packId: "sylve",
          count: 1,
          requestId: requestId(id),
          repeatToken: first.repeatToken,
        }),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(await client.query(api.collection.diamonds, {})).toBe(861);
    expect(await client.query(api.collection.gold, {})).toBe(1000);
    expect(
      (await client.query(api.sanctuary.offers, {})).find(
        (offer) => offer.packId === "sylve" && offer.count === 1,
      )?.cost,
    ).toBe(149);
  });

  it("does not consume an active circle's permission on insufficient funds", async () => {
    const t = setup();
    const { client, userId } = await player(t, "alice");
    const first = await client.mutation(api.sanctuary.summon, {
      packId: "sylve",
      count: 1,
      requestId: requestId(1),
    });
    const walletId = await t.run(async (ctx) => {
      const wallet = (await ctx.db
        .query("wallets")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .unique())!;
      await ctx.db.patch(wallet._id, { diamonds: 138 });
      return wallet._id;
    });
    const request = {
      packId: "sylve" as const,
      count: 1 as const,
      requestId: requestId(2),
      repeatToken: first.repeatToken,
    };
    await expect(
      client.mutation(api.sanctuary.summon, request),
    ).rejects.toThrow("pas assez d’émeraudes");
    expect(await client.query(api.collection.diamonds, {})).toBe(138);
    await t.run((ctx) => ctx.db.patch(walletId, { diamonds: 139 }));
    const second = await client.mutation(api.sanctuary.summon, request);
    expect(second.cost).toBe(139);
    expect(await client.query(api.collection.diamonds, {})).toBe(0);
    const next = {
      ...request,
      requestId: requestId(3),
      repeatToken: second.repeatToken,
    };
    await t.run((ctx) => ctx.db.patch(walletId, { diamonds: 128 }));
    await expect(client.mutation(api.sanctuary.summon, next)).rejects.toThrow(
      "pas assez d’émeraudes",
    );
    expect(await client.query(api.collection.diamonds, {})).toBe(128);
    await t.run((ctx) => ctx.db.patch(walletId, { diamonds: 129 }));
    const third = await client.mutation(api.sanctuary.summon, next);
    expect(third.cost).toBe(129);
    const gold = await client.query(api.collection.gold, {});
    expect(await client.mutation(api.sanctuary.summon, next)).toEqual(third);
    expect(await client.query(api.collection.gold, {})).toBe(gold);
    expect(await client.query(api.collection.diamonds, {})).toBe(0);
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

  it.each([1, 10] as const)(
    "persists x%s reveal progress across closure without granting rewards or restoring the discount",
    async (count) => {
      const t = setup();
      const { client } = await player(t, "alice");
      const request = {
        packId: "sylve" as const,
        count,
        requestId: requestId(1),
      };
      const first = await client.mutation(api.sanctuary.summon, request);
      expect(first.revealProgress).toEqual({ round: 0, revealed: [] });
      expect(first.revealCompleted).toBe(false);
      const before = {
        emeralds: await client.query(api.collection.diamonds, {}),
        gold: await client.query(api.collection.gold, {}),
        cards: await client.query(api.collection.list, {}),
      };
      await Promise.all(
        [0, 2].map((index) =>
          client.mutation(api.sanctuary.saveRevealProgress, {
            requestId: request.requestId,
            round: 0,
            revealed: [index],
          }),
        ),
      );
      await client.mutation(api.sanctuary.closeCircle, {
        repeatToken: first.repeatToken!,
      });
      const resumed = await client.query(api.sanctuary.unfinished, {});
      expect(resumed).toMatchObject({
        requestId: request.requestId,
        revealProgress: { round: 0, revealed: [0, 2] },
        revealCompleted: false,
      });
      expect(resumed).not.toHaveProperty("repeatToken");
      if (count === 10) {
        await client.mutation(api.sanctuary.saveRevealProgress, {
          requestId: request.requestId,
          round: 1,
          revealed: [0, 1, 2, 3, 4, 5, 8],
        });
        // A late response from an earlier page cannot hide cards or rewind the step.
        await client.mutation(api.sanctuary.saveRevealProgress, {
          requestId: request.requestId,
          round: 0,
          revealed: [0],
        });
        expect(
          (await client.query(api.sanctuary.unfinished, {}))!.revealProgress,
        ).toEqual({ round: 1, revealed: [0, 1, 2, 3, 4, 5, 8] });
      }
      const progress = {
        round: count - 1,
        revealed: Array.from({ length: count * 6 }, (_, index) => index),
      };
      expect(
        await client.mutation(api.sanctuary.saveRevealProgress, {
          requestId: request.requestId,
          ...progress,
        }),
      ).toEqual({ completed: true });
      await client.mutation(api.sanctuary.saveRevealProgress, {
        requestId: request.requestId,
        round: 0,
        revealed: [0],
      });
      expect(await client.query(api.sanctuary.unfinished, {})).toBeNull();
      expect(await client.query(api.sanctuary.latest, {})).toMatchObject({
        revealProgress: progress,
        revealCompleted: true,
      });
      expect(await client.mutation(api.sanctuary.summon, request)).toEqual({
        ...history(first),
        revealProgress: progress,
        revealCompleted: true,
      });
      await expect(
        client.mutation(api.sanctuary.summon, {
          ...request,
          requestId: requestId(2),
          repeatToken: first.repeatToken,
        }),
      ).rejects.toThrow("remise n’est plus disponible");
      expect(await client.query(api.collection.diamonds, {})).toBe(
        before.emeralds,
      );
      expect(await client.query(api.collection.gold, {})).toBe(before.gold);
      expect(await client.query(api.collection.list, {})).toEqual(before.cards);
    },
  );

  it("keeps every unfinished purchase available even after newer purchases", async () => {
    const t = setup();
    const { client } = await player(t, "alice");
    await client.mutation(api.sanctuary.summon, {
      packId: "sylve",
      count: 1,
      requestId: requestId(1),
    });
    await client.mutation(api.sanctuary.summon, {
      packId: "sylve",
      count: 10,
      requestId: requestId(2),
    });
    expect((await client.query(api.sanctuary.unfinished, {}))!.requestId).toBe(
      requestId(1),
    );
    await client.mutation(api.sanctuary.saveRevealProgress, {
      requestId: requestId(1),
      round: 0,
      revealed: [0, 1, 2, 3, 4, 5],
    });
    expect((await client.query(api.sanctuary.unfinished, {}))!.requestId).toBe(
      requestId(2),
    );
    await client.mutation(api.sanctuary.saveRevealProgress, {
      requestId: requestId(2),
      round: 9,
      revealed: Array.from({ length: 60 }, (_, index) => index),
    });
    expect(await client.query(api.sanctuary.unfinished, {})).toBeNull();
    expect(await client.query(api.collection.diamonds, {})).toBe(
      WELCOME_DIAMONDS - 149 - 1299,
    );
  });

  it("validates reveal positions and sequence and isolates each player's progress", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const bob = await player(t, "bob");
    await expect(t.query(api.sanctuary.unfinished, {})).rejects.toThrow(
      "Connecte-toi",
    );
    await expect(
      t.mutation(api.sanctuary.saveRevealProgress, {
        requestId: requestId(1),
        round: 0,
        revealed: [],
      }),
    ).rejects.toThrow("Connecte-toi");
    await alice.client.mutation(api.sanctuary.summon, {
      packId: "sylve",
      count: 10,
      requestId: requestId(1),
    });
    for (const progress of [
      { round: -1, revealed: [] },
      { round: 10, revealed: [] },
      { round: 0.5, revealed: [] },
      { round: 0, revealed: [-1] },
      { round: 0, revealed: [60] },
      { round: 0, revealed: [0.5] },
      { round: 0, revealed: Array(61).fill(0) },
      { round: 1, revealed: [0, 1] },
      { round: 0, revealed: [6] },
    ])
      await expect(
        alice.client.mutation(api.sanctuary.saveRevealProgress, {
          requestId: requestId(1),
          ...progress,
        }),
      ).rejects.toThrow();
    await expect(
      bob.client.mutation(api.sanctuary.saveRevealProgress, {
        requestId: requestId(1),
        round: 0,
        revealed: [0],
      }),
    ).rejects.toThrow("introuvable");
    expect(await bob.client.query(api.sanctuary.unfinished, {})).toBeNull();
    expect(
      (await alice.client.query(api.sanctuary.unfinished, {}))!.revealProgress,
    ).toEqual({ round: 0, revealed: [] });
  });

  it("treats legacy purchases as completed instead of prompting players to reveal them again", async () => {
    const t = setup();
    const { client, userId } = await player(t, "alice");
    await t.run((ctx) =>
      ctx.db.insert("summons", {
        ownerId: userId,
        requestId: requestId(1),
        packId: "sylve",
        count: 1,
        cost: 149,
        reveals: [],
      }),
    );
    expect(await client.query(api.sanctuary.unfinished, {})).toBeNull();
    expect(
      (await client.query(api.sanctuary.latest, {}))!.revealCompleted,
    ).toBe(true);
    expect(
      await client.mutation(api.sanctuary.saveRevealProgress, {
        requestId: requestId(1),
        round: 0,
        revealed: [],
      }),
    ).toEqual({ completed: true });
  });
});
