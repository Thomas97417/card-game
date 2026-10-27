import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cardsOfRarity } from "@sylve/game";
import { deckCapacity } from "@sylve/game/leagues";
import { api, components } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
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
        expiresAt: Date.now() + 3_600_000,
      },
    },
  });
  const client = t.withIdentity({ subject: user._id, sessionId: session._id });
  const deckId = await client.mutation(api.decks.ensureStarter, {});
  await client.mutation(api.decks.ensureStarter, {});
  return { client, deckId, ownerId: String(user._id) };
}
async function configureDeck(
  t: Test,
  deckId: Id<"decks">,
  trophies: number,
  size: number,
  peakTrophies = trophies,
) {
  const capacity = deckCapacity(peakTrophies);
  const ids = cardsOfRarity("common")
    .slice(0, capacity)
    .map((card) => card.id);
  await t.run(async (ctx) => {
    const deck = (await ctx.db.get(deckId))!;
    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_owner", (q) => q.eq("ownerId", deck.ownerId))
      .unique();
    if (wallet) await ctx.db.patch(wallet._id, { catalogueVersion: 2 });
    else
      await ctx.db.insert("wallets", {
        ownerId: deck.ownerId,
        gold: 0,
        catalogueVersion: 2,
      });
    const progress = await ctx.db
      .query("leagueProgress")
      .withIndex("by_owner", (q) => q.eq("ownerId", deck.ownerId))
      .unique();
    if (progress) await ctx.db.patch(progress._id, { trophies, peakTrophies });
    else
      await ctx.db.insert("leagueProgress", {
        ownerId: deck.ownerId,
        trophies,
        peakTrophies,
      });
    for (const variantId of ids) {
      const owned = await ctx.db
        .query("collection")
        .withIndex("by_owner_variant", (q) =>
          q.eq("ownerId", deck.ownerId).eq("variantId", variantId),
        )
        .unique();
      if (!owned)
        await ctx.db.insert("collection", {
          ownerId: deck.ownerId,
          variantId,
          level: 26,
          copies: 0,
        });
    }
    await ctx.db.patch(deckId, { cardIds: ids.slice(0, size) });
  });
  return ids;
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("decks complets avant un combat", () => {
  it.each([0, 200, 800, 1600, 2400])(
    "requires every unlocked slot at %i trophies for solo, public and private games",
    async (trophies) => {
      const t = setup();
      const { client, deckId } = await player(t, "alice");
      const capacity = deckCapacity(trophies);
      const ids = await configureDeck(t, deckId, trophies, capacity - 1);
      for (const mutation of [
        api.games.createSolo,
        api.matchmaking.enqueue,
        api.games.createPrivate,
      ]) {
        await expect(client.mutation(mutation, { deckId })).rejects.toThrow(
          `(${capacity - 1}/${capacity} cartes)`,
        );
      }
      expect(
        await t.run((ctx) => ctx.db.query("games").collect()),
      ).toHaveLength(0);
      expect(
        await t.run((ctx) => ctx.db.query("matchmakingQueue").collect()),
      ).toHaveLength(0);
      await client.mutation(api.decks.save, {
        deckId,
        name: "Deck complet",
        cardIds: ids,
      });
      const gameId = await client.mutation(api.games.createSolo, { deckId });
      expect(
        (await client.query(api.games.get, { gameId })).players[0]!.deck,
      ).toHaveLength(capacity);
    },
  );

  it("keeps all peak-league slots required after a demotion", async () => {
    const t = setup();
    const { client, deckId } = await player(t, "alice");
    const ids = await configureDeck(t, deckId, 0, 4, 2400);
    await client.mutation(api.decks.save, {
      deckId,
      name: "Deck en cours",
      cardIds: ids.slice(0, 4),
    });
    await expect(
      client.mutation(api.matchmaking.enqueue, { deckId }),
    ).rejects.toThrow("(4/8 cartes)");
    await client.mutation(api.decks.save, {
      deckId,
      name: "Deck complet",
      cardIds: ids,
    });
    await client.mutation(api.matchmaking.enqueue, { deckId });
    expect(
      (await t.run((ctx) => ctx.db.query("matchmakingQueue").unique()))!.cards,
    ).toHaveLength(8);
  });

  it("rejects an incomplete guest deck without consuming the invitation, then allows its completed deck", async () => {
    const t = setup();
    const host = await player(t, "host");
    const guest = await player(t, "guest");
    const ids = await configureDeck(t, guest.deckId, 200, 4);
    const invitation = await host.client.mutation(api.games.createPrivate, {
      deckId: host.deckId,
    });
    await expect(
      guest.client.mutation(api.games.joinPrivate, {
        code: invitation.code,
        deckId: guest.deckId,
      }),
    ).rejects.toThrow("Complète ton deck");
    expect((await t.run((ctx) => ctx.db.get(invitation.gameId)))!.status).toBe(
      "waiting",
    );
    await guest.client.mutation(api.decks.save, {
      deckId: guest.deckId,
      name: "Deck complet",
      cardIds: ids,
    });
    await guest.client.mutation(api.games.joinPrivate, {
      code: invitation.code,
      deckId: guest.deckId,
    });
    expect(
      (
        await guest.client.query(api.games.get, { gameId: invitation.gameId })
      ).players.map((p) => p.deck.length),
    ).toEqual([4, 5]);
  });

  it("blocks an old invitation with an incomplete host snapshot and preserves cancellation", async () => {
    const t = setup();
    const host = await player(t, "host");
    const guest = await player(t, "guest");
    const invitation = await host.client.mutation(api.games.createPrivate, {
      deckId: host.deckId,
    });
    await configureDeck(t, host.deckId, 200, 4);
    await expect(
      guest.client.mutation(api.games.joinPrivate, {
        code: invitation.code,
        deckId: guest.deckId,
      }),
    ).rejects.toThrow("Ton adversaire doit compléter son deck");
    expect(
      (await t.run((ctx) => ctx.db.get(invitation.gameId)))!.state,
    ).toBeUndefined();
    await host.client.mutation(api.games.cancelPrivate, {
      gameId: invitation.gameId,
    });
    expect((await host.client.query(api.games.activity, {})).gameId).toBeNull();
  });

  it("discards incomplete queued snapshots so they cannot play or block valid opponents", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const bob = await player(t, "bob");
    const charlie = await player(t, "charlie");
    await alice.client.mutation(api.matchmaking.enqueue, {
      deckId: alice.deckId,
    });
    await configureDeck(t, alice.deckId, 200, 4);
    expect(
      await bob.client.mutation(api.matchmaking.enqueue, {
        deckId: bob.deckId,
      }),
    ).toEqual({ gameId: null });
    expect((await alice.client.query(api.games.activity, {})).queued).toBe(
      false,
    );
    const match = await charlie.client.mutation(api.matchmaking.enqueue, {
      deckId: charlie.deckId,
    });
    expect(match.gameId).toBeTruthy();
    expect(
      (
        await bob.client.query(api.games.get, { gameId: match.gameId! })
      ).players.map((p) => p.deck.length),
    ).toEqual([4, 4]);
  });

  it("rejects a waiting host whose current deck was emptied after capturing a complete invitation", async () => {
    const t = setup();
    const host = await player(t, "host");
    const guest = await player(t, "guest");
    const ids = await configureDeck(t, host.deckId, 200, 5);
    const invitation = await host.client.mutation(api.games.createPrivate, {
      deckId: host.deckId,
    });
    await host.client.mutation(api.decks.save, {
      deckId: host.deckId,
      name: "Deck incomplet",
      cardIds: ids.slice(0, 4),
    });
    await expect(
      guest.client.mutation(api.games.joinPrivate, {
        deckId: guest.deckId,
        code: invitation.code,
      }),
    ).rejects.toThrow("Ton adversaire doit compléter son deck");
    expect((await t.run((ctx) => ctx.db.get(invitation.gameId)))!.status).toBe(
      "waiting",
    );
  });

  it("does not match a complete queued snapshot after its owner removes a card", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const bob = await player(t, "bob");
    const ids = await configureDeck(t, alice.deckId, 200, 5);
    await alice.client.mutation(api.matchmaking.enqueue, {
      deckId: alice.deckId,
    });
    await alice.client.mutation(api.decks.save, {
      deckId: alice.deckId,
      name: "Deck incomplet",
      cardIds: ids.slice(0, 4),
    });
    expect(
      await bob.client.mutation(api.matchmaking.enqueue, {
        deckId: bob.deckId,
      }),
    ).toEqual({ gameId: null });
    expect((await alice.client.query(api.games.activity, {})).queued).toBe(
      false,
    );
    expect(await t.run((ctx) => ctx.db.query("games").collect())).toHaveLength(
      0,
    );
  });

  it("stops renewing a queue when the active deck becomes incomplete", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const ids = await configureDeck(t, alice.deckId, 200, 5);
    await alice.client.mutation(api.matchmaking.enqueue, {
      deckId: alice.deckId,
    });
    await alice.client.mutation(api.decks.save, {
      deckId: alice.deckId,
      name: "Deck incomplet",
      cardIds: ids.slice(0, 4),
    });
    await alice.client.mutation(api.matchmaking.heartbeat, {});
    expect((await alice.client.query(api.games.activity, {})).queued).toBe(
      false,
    );
    expect(
      await t.run((ctx) => ctx.db.query("matchmakingQueue").collect()),
    ).toHaveLength(0);
  });
});
