import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { DEFAULT_HERO_ID } from "@sylve/game/hero-metadata";
import { heroRecord } from "./heroes";
import { playerLeague } from "./progression";

export const FRIEND_HELP_TOKENS = 10;

/** Read the current guardian without exposing account progress. */
export async function socialProfile(ctx: QueryCtx | MutationCtx, playerId: string) {
  const hero = await heroRecord(ctx, playerId);
  return { heroId: hero?.selectedHeroId ?? DEFAULT_HERO_ID };
}

export async function socialProfiles(ctx: QueryCtx, playerIds: string[]) {
  return new Map(await Promise.all(
    [...new Set(playerIds)].map(async (playerId) => {
      const [profile, league] = await Promise.all([
        socialProfile(ctx, playerId),
        playerLeague(ctx, playerId),
      ]);
      return [playerId, { profile, trophies: league.trophies }] as const;
    }),
  ));
}

/** Daily help resets at midnight in the game's French timezone, including DST. */
export function socialDay(now = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function friendshipPair(userId: string, playerId: string) {
  const [playerA, playerB] = [userId, playerId].sort();
  return { playerA: playerA!, playerB: playerB! };
}

export async function friendship(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  playerId: string,
) {
  const { playerA, playerB } = friendshipPair(userId, playerId);
  return ctx.db
    .query("friendships")
    .withIndex("by_pair", (q) =>
      q.eq("playerA", playerA).eq("playerB", playerB),
    )
    .unique();
}

export async function playerFriendships(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  status: "pending" | "accepted",
) {
  const [a, b] = await Promise.all([
    ctx.db
      .query("friendships")
      .withIndex("by_a_status", (q) =>
        q.eq("playerA", userId).eq("status", status),
      )
      .collect(),
    ctx.db
      .query("friendships")
      .withIndex("by_b_status", (q) =>
        q.eq("playerB", userId).eq("status", status),
      )
      .collect(),
  ]);
  return [...a, ...b];
}

export async function requireFriend(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  playerId: string,
) {
  const relation = await friendship(ctx, userId, playerId);
  if (!relation || relation.status !== "accepted")
    throw new ConvexError("Ce gardien ne fait pas partie de tes amis.");
  return relation;
}
