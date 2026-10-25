import { v } from "convex/values";
import {
  currentMissionState,
  MISSION_COUNTERS,
  type MissionCounters,
} from "@sylve/game/missions";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { chestTypeValidator, revealValidator } from "./validators";

const counters = v.object({
  battles: v.number(),
  wins: v.number(),
  cardsPlayed: v.number(),
  chestsOpened: v.number(),
  summons: v.number(),
  upgrades: v.number(),
  evolutions: v.number(),
});
const period = v.object({
  key: v.string(),
  counters,
  claimed: v.array(v.string()),
  seals: v.number(),
  chests: v.array(
    v.object({
      index: v.number(),
      rarity: chestTypeValidator,
      reveals: v.array(revealValidator),
      gold: v.number(),
    }),
  ),
});
export const missionStateFields = {
  lifetime: counters,
  daily: period,
  weekly: period,
  epicTiers: v.record(v.string(), v.number()),
};

export async function playerMissions(
  ctx: QueryCtx | MutationCtx,
  ownerId: string,
) {
  return ctx.db
    .query("missionProgress")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .unique();
}

export async function ensureMissions(
  ctx: MutationCtx,
  ownerId: string,
  now = Date.now(),
) {
  const saved = await playerMissions(ctx, ownerId);
  const state = currentMissionState(saved, now);
  if (saved) {
    if (
      saved.daily.key !== state.daily.key ||
      saved.weekly.key !== state.weekly.key
    )
      await ctx.db.patch(saved._id, {
        daily: state.daily,
        weekly: state.weekly,
      });
    return { ...state, _id: saved._id };
  }
  const _id = await ctx.db.insert("missionProgress", { ownerId, ...state });
  return { ...state, _id };
}

/** Called only after a successful server action, in that action's transaction. */
export async function recordMissionProgress(
  ctx: MutationCtx,
  ownerId: string,
  changes: Partial<MissionCounters>,
) {
  if (!Object.values(changes).some((count) => count && count > 0)) return;
  const state = await ensureMissions(ctx, ownerId);
  function add(counters: MissionCounters): MissionCounters {
    return Object.fromEntries(
      MISSION_COUNTERS.map((key) => [key, counters[key] + (changes[key] ?? 0)]),
    ) as MissionCounters;
  }
  await ctx.db.patch(state._id, {
    lifetime: add(state.lifetime),
    daily: { ...state.daily, counters: add(state.daily.counters) },
    weekly: { ...state.weekly, counters: add(state.weekly.counters) },
  });
}
