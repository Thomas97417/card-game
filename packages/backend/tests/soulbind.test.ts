import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { describe, expect, it } from "vitest";
import {
  CARD_VARIANTS,
  resolveCard,
  soulbindDefinitions,
  catalogueMigration,
} from "@sylve/game";
import { api, components } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
function setup() {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  return t;
}
type Test = ReturnType<typeof setup>;
async function player(t: Test, name: string) {
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
        expiresAt: now + 86400000,
      },
    },
  });
  return t.withIdentity({ subject: user._id, sessionId: session._id });
}
async function fixture() {
  const t = setup();
  const alice = await player(t, "alice");
  const deckId = await alice.mutation(api.decks.ensureStarter, {});
  const ownerId = await t.run(async (ctx) => {
    const ownerId = (await ctx.db.get(deckId))!.ownerId;
    for (const card of CARD_VARIANTS) {
      const existing = await ctx.db
        .query("collection")
        .withIndex("by_owner_variant", (q) =>
          q.eq("ownerId", ownerId).eq("variantId", card.id),
        )
        .unique();
      if (existing)
        await ctx.db.patch(existing._id, { level: 26, copies: 100 });
      else
        await ctx.db.insert("collection", {
          ownerId,
          variantId: card.id,
          level: 26,
          copies: 100,
        });
    }
    await ctx.db.insert("wallets", {
      ownerId,
      gold: 1000000,
      soulDust: 10000,
      experience: 1000000000,
      catalogueVersion: 2,
    });
    await ctx.db.insert("leagueProgress", {
      ownerId,
      trophies: 2400,
      peakTrophies: 2400,
    });
    return ownerId;
  });
  return { t, alice, ownerId, deckId };
}
async function inventory(t: Test, ownerId: string) {
  return t.run(async (ctx) => ({
    cards: await ctx.db
      .query("collection")
      .withIndex("by_owner_variant", (q) => q.eq("ownerId", ownerId))
      .collect(),
    wallet: await ctx.db
      .query("wallets")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .unique(),
  }));
}

describe("authoritative Soulbind transactions", () => {
  it("activates IV before I, consumes dust once and never spends the prerequisite cards", async () => {
    const { t, alice, ownerId } = await fixture();
    const before = await inventory(t, ownerId);
    const linked = await alice.mutation(api.collection.soulbind, {
      variantId: "guardian:common",
      tier: 4,
    });
    expect(linked.card.soulbinds).toEqual([4]);
    expect(linked.card.health).toBe(
      resolveCard("guardian:common", 26).health + 3,
    );
    const after = await inventory(t, ownerId);
    expect(after.wallet!.soulDust).toBe(9850);
    expect(after.cards.map((c) => [c.variantId, c.level, c.copies])).toEqual(
      before.cards.map((c) => [c.variantId, c.level, c.copies]),
    );
    await expect(
      alice.mutation(api.collection.soulbind, {
        variantId: "guardian:common",
        tier: 4,
      }),
    ).rejects.toThrow("déjà actif");
    expect((await inventory(t, ownerId)).wallet!.soulDust).toBe(9850);
    expect(
      (await alice.query(api.collection.list, {})).find(
        (e) => e.card.id === "guardian:common",
      )!.card,
    ).toEqual(linked.card);
  });
  it("serializes two concurrent requests for one paid link", async () => {
    const { t, alice, ownerId } = await fixture();
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        alice.mutation(api.collection.soulbind, {
          variantId: "guardian:common",
          tier: 2,
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const stored = await inventory(t, ownerId);
    expect(stored.wallet!.soulDust).toBe(9950);
    expect(
      stored.cards.find((c) => c.variantId === "guardian:common")!.soulbinds,
    ).toEqual([2]);
  });
  it("rejects forged or unmet gates without changing currency or cards", async () => {
    const { t, alice, ownerId } = await fixture();
    await t.run(async (ctx) => {
      const w = await ctx.db
        .query("wallets")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .unique();
      await ctx.db.patch(w!._id, { experience: 0 });
    });
    await expect(
      alice.mutation(api.collection.soulbind, {
        variantId: "guardian:common",
        tier: 1,
      }),
    ).rejects.toThrow("rang 6");
    await t.run(async (ctx) => {
      const w = await ctx.db
        .query("wallets")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .unique();
      await ctx.db.patch(w!._id, { experience: 1000000000 });
      const r = await ctx.db
        .query("collection")
        .withIndex("by_owner_variant", (q) =>
          q.eq("ownerId", ownerId).eq("variantId", "lynx:common"),
        )
        .unique();
      await ctx.db.patch(r!._id, { level: 5 });
    });
    await expect(
      alice.mutation(api.collection.soulbind, {
        variantId: "guardian:common",
        tier: 1,
      }),
    ).rejects.toThrow("compagnons");
    for (const tier of [0, 5, 1.5])
      await expect(
        alice.mutation(api.collection.soulbind, {
          variantId: "guardian:common",
          tier,
        }),
      ).rejects.toThrow();
    expect((await inventory(t, ownerId)).wallet!.soulDust).toBe(10000);
    await expect(
      t.mutation(api.collection.soulbind, {
        variantId: "guardian:common",
        tier: 1,
      }),
    ).rejects.toThrow("Connecte-toi");
    const bob = await player(t, "bob");
    await bob.mutation(api.decks.ensureStarter, {});
    await expect(
      bob.mutation(api.collection.soulbind, {
        variantId: "fox:legendary",
        tier: 1,
      }),
    ).rejects.toThrow("débloquée");
  });
  it("uses the retained peak league unlock and rejects insufficient dust", async () => {
    const { t, alice, ownerId } = await fixture();
    await t.run(async (ctx) => {
      const league = await ctx.db
        .query("leagueProgress")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .unique();
      await ctx.db.patch(league!._id, { trophies: 799, peakTrophies: 799 });
    });
    await expect(
      alice.mutation(api.collection.soulbind, {
        variantId: "guardian:common",
        tier: 1,
      }),
    ).rejects.toThrow("Bronze IV");
    await t.run(async (ctx) => {
      const league = await ctx.db
        .query("leagueProgress")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .unique();
      await ctx.db.patch(league!._id, { trophies: 0, peakTrophies: 800 });
      const w = await ctx.db
        .query("wallets")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .unique();
      await ctx.db.patch(w!._id, { soulDust: 0 });
    });
    expect((await alice.query(api.collection.soulProgress, {})).unlocked).toBe(
      true,
    );
    await alice.mutation(api.collection.soulbind, {
      variantId: "guardian:common",
      tier: 1,
    });
    await expect(
      alice.mutation(api.collection.soulbind, {
        variantId: "guardian:common",
        tier: 2,
      }),
    ).rejects.toThrow("poussière");
  });
  it("preserves Soulbind bonuses through upgrades and snapshots them in new matches", async () => {
    const { t, alice, ownerId, deckId } = await fixture();
    await alice.mutation(api.collection.soulbind, {
      variantId: "guardian:common",
      tier: 1,
    });
    await t.run(async (ctx) => {
      const e = await ctx.db
        .query("collection")
        .withIndex("by_owner_variant", (q) =>
          q.eq("ownerId", ownerId).eq("variantId", "guardian:common"),
        )
        .unique();
      await ctx.db.patch(e!._id, { level: 1, copies: 25 });
    });
    const before = (await inventory(t, ownerId)).wallet!.experience!;
    const upgraded = await alice.mutation(api.collection.upgrade, {
      variantId: "guardian:common",
    });
    expect(upgraded.card).toMatchObject({
      level: 2,
      health: 12,
      soulbinds: [1],
    });
    expect((await inventory(t, ownerId)).wallet!.experience).toBe(before + 10);
    const gameId = await alice.mutation(api.games.createSolo, { deckId });
    const game = await alice.query(api.games.get, { gameId });
    expect(
      game.players[0]!.deck.find((c) => c.id === "guardian:common"),
    ).toEqual(upgraded.card);
  });
  it("keeps every adapted requirement resolvable in the collection", async () => {
    const { alice } = await fixture();
    const collection = await alice.query(api.collection.list, {});
    for (const card of collection)
      for (const link of soulbindDefinitions(card.card.id))
        for (const r of link.requirements)
          expect(
            collection.some(
              (c) => c.card.id === r.variantId && c.card.level! >= r.level,
            ),
          ).toBe(true);
  });
});

describe("dust and evolution", () => {
  it("converts reserves at CW rates and keeps the owned card, its level and its links", async () => {
    const { t, alice, ownerId } = await fixture();
    await alice.mutation(api.collection.soulbind, {
      variantId: "guardian:common",
      tier: 1,
    });
    const result = await alice.mutation(api.collection.sacrifice, {
      variantId: "guardian:common",
      batches: 2,
    });
    expect(result).toEqual({ copies: 0, soulDust: 10020 });
    const e = (await inventory(t, ownerId)).cards.find(
      (c) => c.variantId === "guardian:common",
    )!;
    expect(e).toMatchObject({ level: 26, copies: 0, soulbinds: [1] });
    await expect(
      alice.mutation(api.collection.sacrifice, {
        variantId: e.variantId,
        batches: 1,
      }),
    ).rejects.toThrow("réserve");
    await expect(
      alice.mutation(api.collection.sacrifice, {
        variantId: e.variantId,
        batches: -1,
      }),
    ).rejects.toThrow("entier");
  });
  it("serializes concurrent conversions against a single reserve", async () => {
    const { t, alice, ownerId } = await fixture();
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        alice.mutation(api.collection.sacrifice, {
          variantId: "guardian:common",
          batches: 2,
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await inventory(t, ownerId)).wallet!.soulDust).toBe(10020);
  });
  it("evolves only to a documented, owned form at the CW conversion rate", async () => {
    const { t, alice, ownerId } = await fixture();
    expect(
      await alice.mutation(api.collection.evolve, {
        variantId: "guardian:rare",
        targetId: "guardian:epic",
      }),
    ).toMatchObject({ copies: 105, count: 5 });
    const stored = await inventory(t, ownerId);
    expect(
      stored.cards.find((c) => c.variantId === "guardian:rare"),
    ).toMatchObject({ level: 26, copies: 50 });
    expect(stored.wallet!.gold).toBe(1000000);
    await expect(
      alice.mutation(api.collection.evolve, {
        variantId: "guardian:rare",
        targetId: "fox:legendary",
      }),
    ).rejects.toThrow("n’existe pas");
    await t.run(async (ctx) => {
      const e = await ctx.db
        .query("collection")
        .withIndex("by_owner_variant", (q) =>
          q.eq("ownerId", ownerId).eq("variantId", "guardian:epic"),
        )
        .unique();
      await ctx.db.delete(e!._id);
    });
    await expect(
      alice.mutation(api.collection.evolve, {
        variantId: "guardian:rare",
        targetId: "guardian:epic",
      }),
    ).rejects.toThrow("Découvre");
  });
});

describe("persistent catalogue migration", () => {
  it("migrates pending rewards and historical reveals without rewriting a saved match", async () => {
    const { t, alice, ownerId, deckId } = await fixture();
    const gameId = await alice.mutation(api.games.createSolo, { deckId });
    const before = await t.run((ctx) => ctx.db.get(gameId));
    const reveal = {
      variantId: "tree:common",
      count: 7,
      isNew: false,
      level: 31,
      copies: 42,
    };
    const ids = await t.run(async (ctx) => {
      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .unique();
      await ctx.db.patch(wallet!._id, { catalogueVersion: undefined });
      const chestId = await ctx.db.insert("chests", {
        ownerId,
        gameId,
        slot: 0,
        rarity: "common",
        status: "opened",
        awardedAt: 0,
        unlockAt: 0,
        contents: [{ variantId: "tree:common", count: 7 }],
        reveals: [reveal],
      });
      const summonId = await ctx.db.insert("summons", {
        ownerId,
        requestId: "legacy-reveal",
        packId: "sylve",
        count: 1,
        cost: 149,
        reveals: [reveal],
      });
      const victoryId = await ctx.db.insert("victoryChests", {
        ownerId,
        wins: 3,
        cycle: 1,
        contents: [{ variantId: "tree:common", count: 7 }],
        lastClaim: { cycle: 0, reveals: [reveal] },
      });
      return { chestId, summonId, victoryId };
    });
    await alice.mutation(api.decks.ensureStarter, {});
    await t.run(async (ctx) => {
      const expected = { ...reveal, variantId: "tree:rare", level: 26 };
      const chest = (await ctx.db.get(ids.chestId))!;
      const summon = (await ctx.db.get(ids.summonId))!;
      const victory = (await ctx.db.get(ids.victoryId))!;
      expect(chest.contents).toEqual([{ variantId: "tree:rare", count: 7 }]);
      expect(chest.reveals).toEqual([expected]);
      expect(summon.reveals).toEqual([expected]);
      expect(victory.contents).toEqual(chest.contents);
      expect(victory.lastClaim!.reveals).toEqual([expected]);
      expect(await ctx.db.get(gameId)).toEqual(before);
    });
  });
  it("refunds old levels and merges missing common forms once, while migrating saved decks", async () => {
    const t = setup();
    const alice = await player(t, "legacy");
    const deckId = await alice.mutation(api.decks.ensureStarter, {});
    const records = [
      { variantId: "wolf:common", level: 2, copies: 10 },
      { variantId: "wolf:rare", level: 5, copies: 20 },
      { variantId: "fox:rare", level: 31, copies: 9 },
    ];
    const ownerId = await t.run(async (ctx) => {
      const ownerId = (await ctx.db.get(deckId))!.ownerId;
      for (const r of records)
        await ctx.db.insert("collection", { ownerId, ...r });
      await ctx.db.patch(deckId, {
        cardIds: [
          "wolf:common",
          "guardian:common",
          "turtle:common",
          "wisp:common",
        ],
      });
      await ctx.db.insert("wallets", { ownerId, gold: 123 });
      return ownerId;
    });
    const expected = catalogueMigration(records);
    await alice.mutation(api.decks.ensureStarter, {});
    const first = await inventory(t, ownerId);
    expect(first.wallet!.gold).toBe(123 + expected.goldRefund);
    expect(first.wallet!.catalogueVersion).toBe(2);
    expect(
      first.cards.filter((c) => c.variantId.startsWith("wolf:")),
    ).toHaveLength(1);
    expect(first.cards.find((c) => c.variantId === "wolf:rare")).toMatchObject({
      level: 5,
      copies: 56,
    });
    expect(first.cards.find((c) => c.variantId === "fox:rare")!.level).toBe(26);
    expect((await alice.query(api.decks.list, {}))[0]!.cardIds[0]).toBe(
      "wolf:rare",
    );
    await alice.mutation(api.decks.ensureStarter, {});
    expect(await inventory(t, ownerId)).toEqual(first);
  });
});
