import {
  catalogueMigration,
  nextFriendSlotUnlock,
  rankBenefits,
  rankEmeraldReward,
  rankProgress,
} from "@sylve/game";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { migratePlayerCatalogue } from "./catalogue";
import { syncMineLevel } from "./mines";
import { ensureEmeraldWallet, playerWallet } from "./progression";

/** Legacy card XP is projected for reads until the catalogue migration is saved. */
export async function readRank(ctx: QueryCtx | MutationCtx, ownerId: string) {
  const wallet = await playerWallet(ctx, ownerId);
  let experience = wallet?.experience;
  if (experience === undefined) {
    const collection = await ctx.db
      .query("collection")
      .withIndex("by_owner_variant", (q) => q.eq("ownerId", ownerId))
      .collect();
    experience = catalogueMigration(collection).experience;
  }
  const progress = rankProgress(experience);
  const acknowledged = wallet?.rankAcknowledgedThrough ?? 1;
  const rewarded = Math.min(wallet?.rankRewardedThrough ?? 1, progress.rank);
  return {
    ownerId,
    ...progress,
    ...rankBenefits(progress.rank),
    nextFriends: nextFriendSlotUnlock(progress.rank),
    pending:
      rewarded > acknowledged
        ? {
            fromRank: acknowledged,
            toRank: rewarded,
            emeralds: rankEmeraldReward(acknowledged, rewarded),
          }
        : null,
  };
}

/** Trusted XP sources, rank rewards and prospective mine rates commit together. */
export async function addRankExperience(
  ctx: MutationCtx,
  ownerId: string,
  amount = 0,
) {
  await migratePlayerCatalogue(ctx, ownerId, true);
  const wallet = await ensureEmeraldWallet(ctx, ownerId);
  const experience =
    (wallet.experience ?? (await readRank(ctx, ownerId)).experience) + amount;
  const { rank } = rankProgress(experience);
  const rewarded = wallet.rankRewardedThrough ?? 1;
  const emeralds = rankEmeraldReward(rewarded, rank);
  await syncMineLevel(ctx, wallet, rankBenefits(rank).mineLevel);
  if (
    experience !== wallet.experience ||
    wallet.rankRewardedThrough === undefined ||
    rank > rewarded
  ) {
    await ctx.db.patch(wallet._id, {
      experience,
      rankRewardedThrough: Math.max(rewarded, rank),
      diamonds: (wallet.diamonds ?? 0) + emeralds,
    });
  }
  return (await ctx.db.get(wallet._id))!;
}
