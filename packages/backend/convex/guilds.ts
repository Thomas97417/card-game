import { deckMight } from "@sylve/game";
import {
  GUILD_DESCRIPTION_MAX,
  GUILD_EMBLEMS,
  GUILD_MEMBER_LIMIT,
  GUILD_NAME_MAX,
  GUILD_NAME_MIN,
  guildNameKey,
} from "@sylve/game/guilds";
import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { authComponent } from "./auth";
import { requirePlayer } from "./lib/game_service";
import { heroDeckCards } from "./lib/heroes";
import { socialProfile } from "./lib/social";

function membership(ctx: QueryCtx | MutationCtx, playerId: string) {
  return ctx.db
    .query("guildMemberships")
    .withIndex("by_player", (q) => q.eq("playerId", playerId))
    .unique();
}

function memberships(ctx: QueryCtx | MutationCtx, guildId: Id<"guilds">) {
  return ctx.db
    .query("guildMemberships")
    .withIndex("by_guild", (q) => q.eq("guildId", guildId))
    .collect();
}

/** Read equipped cards live, including upgrades, soulbinds and unlocked slots. */
async function liveMembers(ctx: QueryCtx, guildId: Id<"guilds">) {
  const entries = await memberships(ctx, guildId);
  const members = await Promise.all(
    entries.map(async (entry) => {
      const user = await authComponent.getAnyUserById(ctx, entry.playerId);
      if (!user) return null;
      const cards = await heroDeckCards(ctx, entry.playerId);
      return {
        playerId: entry.playerId,
        name: user.name,
        power: deckMight(cards),
      };
    }),
  );
  return members.filter((member) => member !== null);
}

export const leaderboard = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requirePlayer(ctx);
    const [guilds, own] = await Promise.all([
      ctx.db.query("guilds").collect(),
      membership(ctx, userId),
    ]);
    const entries = await Promise.all(
      guilds.map(async (guild) => {
        const members = await liveMembers(ctx, guild._id);
        return {
          id: guild._id,
          name: guild.name,
          description: guild.description,
          emblemId: guild.emblemId,
          memberCount: members.length,
          power: members.reduce((sum, member) => sum + member.power, 0),
          isOwn: own?.guildId === guild._id,
          createdAt: guild._creationTime,
        };
      }),
    );
    entries.sort(
      (a, b) =>
        b.power - a.power ||
        a.createdAt - b.createdAt ||
        a.id.localeCompare(b.id),
    );
    return {
      guildId: own?.guildId ?? null,
      guilds: entries.map(({ createdAt: _createdAt, ...guild }, index) => ({
        ...guild,
        rank: index + 1,
      })),
    };
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requirePlayer(ctx);
    const own = await membership(ctx, userId);
    if (!own) return null;
    const guild = await ctx.db.get(own.guildId);
    if (!guild) return null;
    const members = await liveMembers(ctx, guild._id);
    const profiles = await Promise.all(
      members.map(async (member) => ({
        ...member,
        profile: await socialProfile(ctx, member.playerId),
        isLeader: member.playerId === guild.leaderId,
        isSelf: member.playerId === userId,
      })),
    );
    profiles.sort(
      (a, b) =>
        b.power - a.power ||
        a.name.localeCompare(b.name, "fr") ||
        a.playerId.localeCompare(b.playerId),
    );
    return {
      id: guild._id,
      name: guild.name,
      description: guild.description,
      emblemId: guild.emblemId,
      isLeader: guild.leaderId === userId,
      power: members.reduce((sum, member) => sum + member.power, 0),
      members: profiles,
    };
  },
});

const guildFields = {
  name: v.string(),
  description: v.string(),
  emblemId: v.string(),
};

function validateGuild(fields: {
  name: string;
  description: string;
  emblemId: string;
}) {
  const name = fields.name.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const description = fields.description.trim();
  if (name.length < GUILD_NAME_MIN || name.length > GUILD_NAME_MAX)
    throw new ConvexError(
      `Choisis un nom de ${GUILD_NAME_MIN} à ${GUILD_NAME_MAX} caractères.`,
    );
  if (description.length > GUILD_DESCRIPTION_MAX)
    throw new ConvexError(
      `La description est limitée à ${GUILD_DESCRIPTION_MAX} caractères.`,
    );
  if (!GUILD_EMBLEMS.some((emblem) => emblem.id === fields.emblemId))
    throw new ConvexError("Choisis un emblème disponible dans la collection.");
  return {
    name,
    nameKey: guildNameKey(name),
    description,
    emblemId: fields.emblemId,
  };
}

export const create = mutation({
  args: guildFields,
  handler: async (ctx, args) => {
    const { userId } = await requirePlayer(ctx);
    if (await membership(ctx, userId))
      throw new ConvexError("Tu fais déjà partie d’une guilde.");
    const fields = validateGuild(args);
    const existing = await ctx.db
      .query("guilds")
      .withIndex("by_name", (q) => q.eq("nameKey", fields.nameKey))
      .unique();
    if (existing) throw new ConvexError("Ce nom de guilde est déjà utilisé.");
    const guildId = await ctx.db.insert("guilds", {
      ...fields,
      leaderId: userId,
    });
    await ctx.db.insert("guildMemberships", { guildId, playerId: userId });
    return guildId;
  },
});

export const join = mutation({
  args: { guildId: v.id("guilds") },
  handler: async (ctx, { guildId }) => {
    const { userId } = await requirePlayer(ctx);
    const previous = await membership(ctx, userId);
    if (previous?.guildId === guildId) return guildId;
    if (previous)
      throw new ConvexError(
        "Quitte ta guilde actuelle avant d’en rejoindre une autre.",
      );
    if (!(await ctx.db.get(guildId)))
      throw new ConvexError("Cette guilde n’existe plus.");
    const entries = await memberships(ctx, guildId);
    // Purge deleted accounts so they never occupy a member slot indefinitely.
    let count = 0;
    for (const entry of entries) {
      if (await authComponent.getAnyUserById(ctx, entry.playerId)) count++;
      else await ctx.db.delete(entry._id);
    }
    if (count >= GUILD_MEMBER_LIMIT)
      throw new ConvexError("Cette guilde est complète.");
    await ctx.db.insert("guildMemberships", { guildId, playerId: userId });
    return guildId;
  },
});

export const update = mutation({
  args: { guildId: v.id("guilds"), ...guildFields },
  handler: async (ctx, { guildId, ...args }) => {
    const { userId } = await requirePlayer(ctx);
    const guild = await ctx.db.get(guildId);
    if (!guild || guild.leaderId !== userId)
      throw new ConvexError("Seul le chef de guilde peut la modifier.");
    const fields = validateGuild(args);
    const existing = await ctx.db
      .query("guilds")
      .withIndex("by_name", (q) => q.eq("nameKey", fields.nameKey))
      .unique();
    if (existing && existing._id !== guildId)
      throw new ConvexError("Ce nom de guilde est déjà utilisé.");
    await ctx.db.patch(guildId, fields);
  },
});

export const leave = mutation({
  args: { guildId: v.id("guilds") },
  handler: async (ctx, { guildId }) => {
    const { userId } = await requirePlayer(ctx);
    const own = await membership(ctx, userId);
    if (!own || own.guildId !== guildId)
      throw new ConvexError("Tu ne fais plus partie de cette guilde.");
    const guild = await ctx.db.get(guildId);
    await ctx.db.delete(own._id);
    if (!guild) return;
    const remaining = [];
    for (const entry of await memberships(ctx, guildId)) {
      if (await authComponent.getAnyUserById(ctx, entry.playerId))
        remaining.push(entry);
      else await ctx.db.delete(entry._id);
    }
    if (!remaining.length) await ctx.db.delete(guildId);
    else if (guild.leaderId === userId) {
      remaining.sort(
        (a, b) =>
          a._creationTime - b._creationTime || a._id.localeCompare(b._id),
      );
      await ctx.db.patch(guildId, { leaderId: remaining[0]!.playerId });
    }
  },
});
