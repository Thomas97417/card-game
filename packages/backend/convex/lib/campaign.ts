import { campaignStage, campaignStageReward } from "@sylve/game/campaign";
import { chestGold, chestLoot } from "@sylve/game/progression";
import type { GameState } from "@sylve/game";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { ensureEmeralds } from "./wallet";
import { playerLeague } from "./progression";

export function campaignProgress(ctx: QueryCtx | MutationCtx, ownerId: string) {
  return ctx.db.query("campaignProgress")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique();
}

/** The finish transaction unlocks one stage and awards its first-clear reward exactly once. */
export async function awardCampaignRewards(ctx: MutationCtx, game: Doc<"games">, state: GameState) {
  if (!game.campaign || game.campaignReward || state.status !== "finished" ||
    state.winner === null || state.players[state.winner]?.userId !== game.hostId) return;
  const encounter = campaignStage(game.campaign.region, game.campaign.stage);
  if (!encounter) return;
  const progress = await campaignProgress(ctx, game.hostId);
  const completed = progress?.completedStages ?? 0;
  if (encounter.index < completed) {
    await ctx.db.patch(game._id, { campaignReward: { firstClear: false, gold: 0, emeralds: 0 } });
    return;
  }
  // A corrupt/out-of-order match must never skip the progression frontier.
  if (encounter.index !== completed) return;
  const reward = campaignStageReward(game.campaign.region, game.campaign.stage);
  const wallet = await ensureEmeralds(ctx, game.hostId);
  await ctx.db.patch(wallet._id, { gold: wallet.gold + reward.gold, diamonds: wallet.diamonds + reward.emeralds });
  let chestId;
  if (reward.chest) {
    const league = await playerLeague(ctx, game.hostId);
    chestId = await ctx.db.insert("campaignChests", {
      ownerId: game.hostId, region: game.campaign.region, gameId: game._id,
      contents: chestLoot("epic", Math.random, league.peakTrophies),
      gold: chestGold("epic", Math.random, league.peakTrophies),
    });
  }
  if (progress) await ctx.db.patch(progress._id, { completedStages: completed + 1 });
  else await ctx.db.insert("campaignProgress", { ownerId: game.hostId, completedStages: 1 });
  await ctx.db.patch(game._id, { campaignReward: {
    firstClear: true, gold: reward.gold, emeralds: reward.emeralds,
    ...(chestId ? { chestId } : {}),
  } });
}
