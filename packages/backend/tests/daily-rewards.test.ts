import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DECK, resolveCard } from "@sylve/game";
import {
  DAILY_REWARDS,
  DAILY_REWARD_DELAY_MS,
} from "@sylve/game/daily-rewards";
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
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "user",
      data: {
        name,
        email: `${name}@example.invalid`,
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "session",
      data: {
        userId: user._id,
        token: `${name}-session`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + 90 * DAILY_REWARD_DELAY_MS,
      },
    },
  });
  await t.run((ctx) =>
    ctx.db.insert("wallets", { ownerId: user._id, gold: 0, diamonds: 0 }),
  );
  return t.withIdentity({ subject: user._id, sessionId: session._id });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-21T23:50:00Z"));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("cadeaux quotidiens du refuge", () => {
  it("requires a player, validates days, and makes only the first gift immediately available", async () => {
    const t = setup();
    await expect(
      t.query(api.dailyRewards.board, { refreshKey: Date.now() }),
    ).rejects.toThrow("Connecte-toi");
    await expect(
      t.mutation(api.dailyRewards.claim, { day: 1 }),
    ).rejects.toThrow("Connecte-toi");
    const alice = await player(t, "alice");
    expect(
      await alice.query(api.dailyRewards.board, { refreshKey: Date.now() }),
    ).toEqual({
      serverNow: Date.now(),
      claimedDays: 0,
      nextClaimAt: Date.now(),
    });
    for (const day of [0, -1, 1.5, 8])
      await expect(
        alice.mutation(api.dailyRewards.claim, { day }),
      ).rejects.toThrow("introuvable");
    await expect(
      alice.mutation(api.dailyRewards.claim, { day: 7 }),
    ).rejects.toThrow("cadeau précédent");
    expect(await alice.query(api.collection.gold, {})).toBe(0);
    expect(
      await t.run((ctx) => ctx.db.query("dailyRewards").collect()),
    ).toEqual([]);
  });

  it("grants currency once under concurrent requests and isolates each account", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const firstClaimAt = Date.now();
    const results = await Promise.all([
      alice.mutation(api.dailyRewards.claim, { day: 1 }),
      alice.mutation(api.dailyRewards.claim, { day: 1 }),
    ]);
    expect(results.map((result) => result.alreadyClaimed).sort()).toEqual([
      false,
      true,
    ]);
    expect(await alice.query(api.collection.gold, {})).toBe(5_000);
    expect(
      await alice.query(api.dailyRewards.board, { refreshKey: Date.now() }),
    ).toMatchObject({
      claimedDays: 1,
      nextClaimAt: firstClaimAt + DAILY_REWARD_DELAY_MS,
    });
    const bob = await player(t, "bob");
    expect(
      (await bob.query(api.dailyRewards.board, { refreshKey: Date.now() }))
        .claimedDays,
    ).toBe(0);
    expect(await bob.query(api.collection.gold, {})).toBe(0);
    await bob.mutation(api.dailyRewards.claim, { day: 1 });
    expect(await alice.query(api.collection.gold, {})).toBe(5_000);
    expect(
      await t.run((ctx) => ctx.db.query("dailyRewards").collect()),
    ).toHaveLength(2);
  });

  it("waits exactly 24 hours after each actual claim, including late returns and stale retries", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const firstClaimAt = Date.now();
    await alice.mutation(api.dailyRewards.claim, { day: 1 });
    // Crossing midnight never unlocks the following gift.
    vi.setSystemTime(firstClaimAt + 30 * 60_000);
    await expect(
      alice.mutation(api.dailyRewards.claim, { day: 2 }),
    ).rejects.toThrow("24 heures");
    vi.setSystemTime(firstClaimAt + DAILY_REWARD_DELAY_MS - 1);
    await expect(
      alice.mutation(api.dailyRewards.claim, { day: 2 }),
    ).rejects.toThrow("24 heures");
    vi.setSystemTime(firstClaimAt + DAILY_REWARD_DELAY_MS);
    // Retrying yesterday's request cannot silently collect today's gift.
    expect(
      (await alice.mutation(api.dailyRewards.claim, { day: 1 })).alreadyClaimed,
    ).toBe(true);
    expect(
      (await alice.query(api.dailyRewards.board, { refreshKey: Date.now() }))
        .claimedDays,
    ).toBe(1);
    await alice.mutation(api.dailyRewards.claim, { day: 2 });
    expect(await alice.query(api.collection.diamonds, {})).toBe(25);

    vi.setSystemTime(firstClaimAt + 5 * DAILY_REWARD_DELAY_MS);
    expect(
      (await alice.query(api.dailyRewards.board, { refreshKey: Date.now() }))
        .claimedDays,
    ).toBe(2);
    await expect(
      alice.mutation(api.dailyRewards.claim, { day: 4 }),
    ).rejects.toThrow("cadeau précédent");
    await alice.mutation(api.dailyRewards.claim, { day: 3 });
    expect(
      (await alice.query(api.dailyRewards.board, { refreshKey: Date.now() }))
        .nextClaimAt,
    ).toBe(Date.now() + DAILY_REWARD_DELAY_MS);
    await expect(
      alice.mutation(api.dailyRewards.claim, { day: 4 }),
    ).rejects.toThrow("24 heures");
  });

  it("saves all seven gifts, opens real rare, big rare and epic loot once, and completes the journey", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    let totalGold = 0;
    let totalEmeralds = 0;
    const chestRarities: string[] = [];
    for (let day = 1; day <= DAILY_REWARDS.length; day++) {
      const first = await alice.mutation(api.dailyRewards.claim, { day });
      const retry = await alice.mutation(api.dailyRewards.claim, { day });
      expect(retry).toEqual({ ...first, alreadyClaimed: true });
      totalGold += first.gold;
      totalEmeralds += first.emeralds;
      if (first.rarity) {
        chestRarities.push(first.rarity);
        expect(first.reveals.length).toBeGreaterThan(0);
        expect(first.gold).toBeGreaterThan(0);
        for (const reveal of first.reveals) {
          expect(reveal.count).toBeGreaterThan(0);
          expect(resolveCard(reveal.variantId)).toBeDefined();
        }
      }
      expect(await alice.query(api.collection.gold, {})).toBe(totalGold);
      expect(await alice.query(api.collection.diamonds, {})).toBe(
        totalEmeralds,
      );
      vi.setSystemTime(Date.now() + DAILY_REWARD_DELAY_MS);
    }
    expect(chestRarities).toEqual(["rare", "bigRare", "epic"]);
    expect(totalEmeralds).toBe(100);
    expect(
      await alice.query(api.dailyRewards.board, { refreshKey: Date.now() }),
    ).toMatchObject({
      claimedDays: 7,
      nextClaimAt: null,
    });
    const saved = await t.run((ctx) => ctx.db.query("dailyRewards").unique());
    expect(saved!.claims).toHaveLength(7);
    const mission = await t.run((ctx) =>
      ctx.db.query("missionProgress").unique(),
    );
    expect(mission!.lifetime.chestsOpened).toBe(3);
    const cards = await t.run((ctx) => ctx.db.query("collection").collect());
    for (const id of DEFAULT_DECK)
      expect(cards.some((card) => card.variantId === id)).toBe(true);
    const receivedCards = saved!.claims
      .flatMap((claim) => claim.reveals)
      .reduce((sum, reveal) => sum + reveal.count, 0);
    expect(cards.reduce((sum, card) => sum + card.copies + 1, 0)).toBe(
      DEFAULT_DECK.length + receivedCards,
    );
    const finalReveal = saved!.claims[6]!.reveals;
    expect(
      finalReveal.some((reveal) =>
        ["epic", "legendary"].includes(resolveCard(reveal.variantId).rarity!),
      ),
    ).toBe(true);
    vi.setSystemTime(Date.now() + 30 * DAILY_REWARD_DELAY_MS);
    expect(
      (await alice.query(api.dailyRewards.board, { refreshKey: Date.now() }))
        .nextClaimAt,
    ).toBeNull();
    expect(
      (await alice.mutation(api.dailyRewards.claim, { day: 7 })).alreadyClaimed,
    ).toBe(true);
    expect(await alice.query(api.collection.gold, {})).toBe(totalGold);
  });
});
