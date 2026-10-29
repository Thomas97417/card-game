import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { describe, expect, it } from "vitest";
import { DEFAULT_DECK, deckMight, resolveCard } from "@sylve/game";
import { GUILD_MEMBER_LIMIT } from "@sylve/game/guilds";
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
        expiresAt: Date.now() + 86_400_000,
      },
    },
  });
  return {
    ownerId: String(user._id),
    client: t.withIdentity({ subject: user._id, sessionId: session._id }),
  };
}
const fields = {
  name: "Les Veilleurs",
  description: "Unis sous la même bannière",
  emblemId: "moon-wolf",
};

describe("guildes du refuge", () => {
  it("requires authentication for queries and mutations", async () => {
    const t = setup();
    await expect(t.query(api.guilds.leaderboard, {})).rejects.toThrow(
      "Connecte-toi",
    );
    await expect(t.query(api.guilds.mine, {})).rejects.toThrow("Connecte-toi");
    await expect(t.mutation(api.guilds.create, fields)).rejects.toThrow(
      "Connecte-toi",
    );
    const alice = await player(t, "alice");
    expect(await alice.client.query(api.guilds.mine, {})).toBeNull();
    expect(await alice.client.query(api.guilds.leaderboard, {})).toEqual({
      guildId: null,
      guilds: [],
    });
  });

  it("creates a guild and leader membership atomically and reserves normalized names", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const bob = await player(t, "bob");
    const guildId = await alice.client.mutation(api.guilds.create, {
      ...fields,
      name: "  Les   Veilleurs  ",
    });
    expect(await alice.client.query(api.guilds.mine, {})).toMatchObject({
      id: guildId,
      name: fields.name,
      description: fields.description,
      emblemId: "moon-wolf",
      isLeader: true,
      power: 0,
      members: [
        { playerId: alice.ownerId, isLeader: true, isSelf: true, power: 0 },
      ],
    });
    await expect(
      bob.client.mutation(api.guilds.create, {
        ...fields,
        name: "LES VEILLEURS",
      }),
    ).rejects.toThrow("déjà utilisé");
    await expect(
      alice.client.mutation(api.guilds.create, {
        ...fields,
        name: "Autre guilde",
      }),
    ).rejects.toThrow("déjà partie");
    expect(
      (await alice.client.query(api.guilds.leaderboard, {})).guilds,
    ).toHaveLength(1);
  });

  it("validates names, descriptions and the emblem allowlist on the server", async () => {
    const t = setup();
    const { client } = await player(t, "alice");
    for (const name of [" ", "ab", "x".repeat(33)]) {
      await expect(
        client.mutation(api.guilds.create, { ...fields, name }),
      ).rejects.toThrow("3 à 32");
    }
    await expect(
      client.mutation(api.guilds.create, {
        ...fields,
        description: "x".repeat(161),
      }),
    ).rejects.toThrow("160");
    await expect(
      client.mutation(api.guilds.create, {
        ...fields,
        emblemId: "https://untrusted.invalid/icon.png",
      }),
    ).rejects.toThrow("emblème disponible");
    expect(await client.query(api.guilds.mine, {})).toBeNull();
  });

  it("sums current equipped card power, respects unlocked slots and refreshes after deck changes", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const bob = await player(t, "bob");
    const cara = await player(t, "cara");
    await alice.client.mutation(api.decks.ensureStarter, {});
    const bobDeckId = await bob.client.mutation(api.decks.ensureStarter, {});
    await cara.client.mutation(api.decks.ensureStarter, {});
    const alliance = await alice.client.mutation(api.guilds.create, fields);
    await bob.client.mutation(api.guilds.join, { guildId: alliance });
    await cara.client.mutation(api.guilds.create, {
      ...fields,
      name: "Les Solitaires",
    });
    const starterPower = deckMight(
      DEFAULT_DECK.slice(0, 4).map((id) => resolveCard(id, 1)),
    );
    const ranking = await cara.client.query(api.guilds.leaderboard, {});
    expect(
      ranking.guilds.map((guild) => [guild.name, guild.power, guild.rank]),
    ).toEqual([
      [fields.name, starterPower * 2, 1],
      ["Les Solitaires", starterPower, 2],
    ]);
    await t.run(async (ctx) => {
      const card = (await ctx.db
        .query("collection")
        .withIndex("by_owner_variant", (q) =>
          q.eq("ownerId", bob.ownerId).eq("variantId", DEFAULT_DECK[0]!),
        )
        .unique())!;
      await ctx.db.patch(card._id, { level: 5 });
      const hero = (await ctx.db
        .query("heroes")
        .withIndex("by_owner", (q) => q.eq("ownerId", bob.ownerId))
        .unique())!;
      await ctx.db.patch(hero._id, { level: 10, peakMight: 1000000 });
      // A legacy deck can contain more than the current league permits.
      await ctx.db.patch(bobDeckId, {
        cardIds: [...DEFAULT_DECK],
        updatedAt: Date.now() + 1,
      });
    });
    const bobPower = deckMight(
      DEFAULT_DECK.slice(0, 4).map((id, index) =>
        resolveCard(id, index === 0 ? 5 : 1),
      ),
    );
    expect((await alice.client.query(api.guilds.mine, {}))?.power).toBe(
      starterPower + bobPower,
    );
    expect(
      (await alice.client.query(api.guilds.mine, {}))?.members[0],
    ).toMatchObject({ playerId: bob.ownerId, power: bobPower });
    await t.run(async (ctx) => {
      await ctx.db.patch(bobDeckId, {
        cardIds: DEFAULT_DECK.slice(1, 4),
        updatedAt: Date.now() + 2,
      });
    });
    const reduced = deckMight(
      DEFAULT_DECK.slice(1, 4).map((id) => resolveCard(id, 1)),
    );
    expect(
      (await bob.client.query(api.guilds.leaderboard, {})).guilds[0]?.power,
    ).toBe(starterPower + reduced);
  });

  it("allows joining only one guild and treats a repeated join as idempotent", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const bob = await player(t, "bob");
    const cara = await player(t, "cara");
    const first = await alice.client.mutation(api.guilds.create, fields);
    const second = await bob.client.mutation(api.guilds.create, {
      ...fields,
      name: "Autre alliance",
    });
    await cara.client.mutation(api.guilds.join, { guildId: first });
    await cara.client.mutation(api.guilds.join, { guildId: first });
    await expect(
      cara.client.mutation(api.guilds.join, { guildId: second }),
    ).rejects.toThrow("Quitte ta guilde");
    expect(
      (await alice.client.query(api.guilds.mine, {}))?.members,
    ).toHaveLength(2);
    await expect(
      cara.client.mutation(api.guilds.leave, { guildId: second }),
    ).rejects.toThrow("ne fais plus partie");
  });

  it("restricts customization to the leader and keeps names unique when editing", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const bob = await player(t, "bob");
    const cara = await player(t, "cara");
    const first = await alice.client.mutation(api.guilds.create, fields);
    await bob.client.mutation(api.guilds.join, { guildId: first });
    await cara.client.mutation(api.guilds.create, {
      ...fields,
      name: "Nom réservé",
    });
    await expect(
      bob.client.mutation(api.guilds.update, { ...fields, guildId: first }),
    ).rejects.toThrow("Seul le chef");
    await expect(
      alice.client.mutation(api.guilds.update, {
        ...fields,
        name: "NOM RÉSERVÉ",
        guildId: first,
      }),
    ).rejects.toThrow("déjà utilisé");
    await alice.client.mutation(api.guilds.update, {
      name: "Les Dragons",
      description: "Notre nouvelle devise",
      emblemId: "ember-dragon",
      guildId: first,
    });
    expect(await bob.client.query(api.guilds.mine, {})).toMatchObject({
      name: "Les Dragons",
      description: "Notre nouvelle devise",
      emblemId: "ember-dragon",
      isLeader: false,
    });
  });

  it("transfers leadership on departure and dissolves only when the last member leaves", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const bob = await player(t, "bob");
    const guildId = await alice.client.mutation(api.guilds.create, fields);
    await bob.client.mutation(api.guilds.join, { guildId });
    await alice.client.mutation(api.guilds.leave, { guildId });
    expect(await alice.client.query(api.guilds.mine, {})).toBeNull();
    expect(await bob.client.query(api.guilds.mine, {})).toMatchObject({
      isLeader: true,
      members: [{ playerId: bob.ownerId, isLeader: true }],
    });
    await bob.client.mutation(api.guilds.leave, { guildId });
    expect(
      (await alice.client.query(api.guilds.leaderboard, {})).guilds,
    ).toEqual([]);
    await expect(
      alice.client.mutation(api.guilds.join, { guildId }),
    ).rejects.toThrow("n’existe plus");
    // The name becomes available again after dissolution.
    await alice.client.mutation(api.guilds.create, fields);
  });

  it("enforces the member limit at the server", async () => {
    const t = setup();
    const alice = await player(t, "alice");
    const guildId = await alice.client.mutation(api.guilds.create, fields);
    for (let index = 1; index < GUILD_MEMBER_LIMIT; index++) {
      const member = await player(t, `member${index}`);
      await member.client.mutation(api.guilds.join, { guildId });
    }
    const outsider = await player(t, "outsider");
    await expect(
      outsider.client.mutation(api.guilds.join, { guildId }),
    ).rejects.toThrow("complète");
    expect(await outsider.client.query(api.guilds.mine, {})).toBeNull();
    expect(
      (await alice.client.query(api.guilds.mine, {}))?.members,
    ).toHaveLength(GUILD_MEMBER_LIMIT);
  });
});
