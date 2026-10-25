import { ConvexError, v } from "convex/values";
import {
  EPIC_MISSIONS,
  MISSION_CHESTS,
  missionBoard,
} from "@sylve/game/missions";
import { chestGold, chestLoot } from "@sylve/game/progression";
import { mutation, query } from "./_generated/server";
import { requirePlayer } from "./lib/game_service";
import {
  ensureMissions,
  playerMissions,
  recordMissionProgress,
} from "./lib/missions";
import { ensureEmeralds } from "./lib/wallet";
import { grantGold, grantLoot, playerLeague } from "./lib/progression";
import { ensureStarterDeck } from "./decks";

export const board = query({
  // A date key lets an idle client refresh at midnight. The server owns the calendar.
  args: { refreshKey: v.string() },
  handler: async (ctx) => {
    const { userId } = await requirePlayer(ctx);
    return missionBoard(await playerMissions(ctx, userId), Date.now());
  },
});

export const claim = mutation({
  args: { missionId: v.string(), periodKey: v.string(), tier: v.number() },
  handler: async (ctx, { missionId, periodKey, tier }) => {
    const { userId } = await requirePlayer(ctx);
    if (!Number.isSafeInteger(tier) || tier < 0)
      throw new ConvexError("Ce palier est invalide.");
    const state = await ensureMissions(ctx, userId);
    const view = missionBoard(state, Date.now());
    const epic = EPIC_MISSIONS.find((item) => item.id === missionId);
    if (epic) {
      if (periodKey !== "lifetime")
        throw new ConvexError("Cette mission est invalide.");
      const mission = view.epic.find((item) => item.id === missionId)!;
      // An old request cannot silently collect the newly unlocked tier.
      if (tier < mission.tier)
        return {
          currency: "emeralds" as const,
          amount: epic.reward * (tier + 1),
          alreadyClaimed: true,
        };
      if (tier !== mission.tier || mission.status !== "ready")
        throw new ConvexError("Ce palier n’est pas encore terminé.");
      const wallet = await ensureEmeralds(ctx, userId);
      await ctx.db.patch(wallet._id, {
        diamonds: wallet.diamonds + mission.reward,
      });
      await ctx.db.patch(state._id, {
        epicTiers: { ...state.epicTiers, [missionId]: tier + 1 },
      });
      return {
        currency: "emeralds" as const,
        amount: mission.reward,
        alreadyClaimed: false,
      };
    }
    const kind = view.daily.missions.some((item) => item.id === missionId)
      ? "daily"
      : "weekly";
    const mission = view[kind].missions.find((item) => item.id === missionId);
    if (!mission || tier !== 0)
      throw new ConvexError("Cette mission est introuvable.");
    if (periodKey !== state[kind].key)
      throw new ConvexError(
        "Cette mission a expiré. Consulte les nouveaux objectifs.",
      );
    if (mission.status === "claimed")
      return {
        currency: "seals" as const,
        amount: mission.reward,
        alreadyClaimed: true,
      };
    if (mission.status !== "ready")
      throw new ConvexError("Cette mission n’est pas encore terminée.");
    await ctx.db.patch(state._id, {
      [kind]: {
        ...state[kind],
        seals: state[kind].seals + mission.reward,
        claimed: [...state[kind].claimed, missionId],
      },
    });
    return {
      currency: "seals" as const,
      amount: mission.reward,
      alreadyClaimed: false,
    };
  },
});

export const openChest = mutation({
  args: {
    kind: v.union(v.literal("daily"), v.literal("weekly")),
    periodKey: v.string(),
    index: v.number(),
  },
  handler: async (ctx, { kind, periodKey, index }) => {
    const { userId } = await requirePlayer(ctx);
    const state = await ensureMissions(ctx, userId);
    const period = state[kind];
    if (periodKey !== period.key)
      throw new ConvexError(
        "Ce parcours a expiré. Consulte les nouveaux coffres.",
      );
    const rule = MISSION_CHESTS[kind][index];
    if (!Number.isInteger(index) || !rule)
      throw new ConvexError("Ce coffre est introuvable.");
    const previous = period.chests.find((item) => item.index === index);
    if (previous) return previous;
    if (period.seals < rule.threshold)
      throw new ConvexError(
        "Récupère davantage de sceaux de mission pour ouvrir ce coffre.",
      );
    await ensureStarterDeck(ctx, userId);
    const league = await playerLeague(ctx, userId);
    const reveals = await grantLoot(
      ctx,
      userId,
      chestLoot(rule.rarity, Math.random, league.peakTrophies),
    );
    const gold = chestGold(rule.rarity, Math.random, league.peakTrophies);
    await grantGold(ctx, userId, gold);
    const reward = { index, rarity: rule.rarity, reveals, gold };
    await ctx.db.patch(state._id, {
      [kind]: { ...period, chests: [...period.chests, reward] },
    });
    await recordMissionProgress(ctx, userId, { chestsOpened: 1 });
    return reward;
  },
});
