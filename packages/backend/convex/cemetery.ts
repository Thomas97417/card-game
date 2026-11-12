import { ConvexError, v } from "convex/values";
import {
  CEMETERY,
  createCemeteryRun,
  stepCemetery,
  chooseCemeteryUpgrade,
  cemeterySummary,
  upgradeCost,
  validCemeteryInput,
  type CemeteryRun,
} from "@sylve/game/cemetery";
import { chestGold, chestLoot } from "@sylve/game/progression";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requirePlayer } from "./lib/game_service";
import { ensureStarterDeck } from "./decks";
import {
  playerWallet,
  playerLeague,
  grantGold,
  grantLoot,
} from "./lib/progression";
import { ensureEmeralds } from "./lib/wallet";
import { recordMissionProgress } from "./lib/missions";
import { cemeteryInput, cemeteryUpgradeId } from "./lib/cemetery";

const ownerArgs = { expectedOwnerId: v.string() };
const runArgs = { ...ownerArgs, runId: v.id("cemeteryRuns") };
const progressFor = (ctx: QueryCtx | MutationCtx, ownerId: string) =>
  ctx.db
    .query("cemeteryProgress")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .unique();
async function owner(ctx: MutationCtx, expected: string) {
  const { userId } = await requirePlayer(ctx);
  if (userId !== expected)
    throw new ConvexError(
      "Cette partie appartient à un autre compte. Recharge le cimetière.",
    );
  return userId;
}
async function ownedRun(
  ctx: MutationCtx,
  expected: string,
  id: Id<"cemeteryRuns">,
) {
  const userId = await owner(ctx, expected),
    run = await ctx.db.get(id);
  if (!run || run.ownerId !== userId)
    throw new ConvexError("Cette partie est introuvable.");
  return run;
}
function identifier(id: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id))
    throw new ConvexError("Identifiant de requête invalide.");
}
function stateOf(value: unknown) {
  return value as CemeteryRun;
}
export const board = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requirePlayer(ctx),
      progress = await progressFor(ctx, userId);
    const [hero, wallet, active, last, pending] = await Promise.all([
      ctx.db
        .query("heroes")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .unique(),
      playerWallet(ctx, userId),
      progress?.activeRunId ? ctx.db.get(progress.activeRunId) : null,
      progress?.lastRunId ? ctx.db.get(progress.lastRunId) : null,
      ctx.db
        .query("cemeteryRuns")
        .withIndex("by_owner_reward", (q) =>
          q.eq("ownerId", userId).eq("rewardStatus", "unopened"),
        )
        .order("asc")
        .take(20),
    ]);
    return {
      ownerId: userId,
      progress,
      heroId: hero?.selectedHeroId ?? ("sylve" as const),
      gold: wallet?.gold ?? 0,
      emeralds: wallet?.diamonds ?? 0,
      activeRun: active
        ? {
            id: active._id,
            seconds: (active.state.tick * CEMETERY.stepMs) / 1000,
            level: active.state.level,
          }
        : null,
      lastRun: last
        ? {
            id: last._id,
            summary: last.summary,
            status: last.status,
            rewardStatus: last.rewardStatus,
          }
        : null,
      pendingRewards: pending.map((r) => ({
        id: r._id,
        summary: r.summary,
        rarity: r.reward!.rarity,
      })),
    };
  },
});
export const ensure = mutation({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const userId = await owner(ctx, args.expectedOwnerId);
    await ensureStarterDeck(ctx, userId);
    await ensureEmeralds(ctx, userId);
    const existing = await progressFor(ctx, userId);
    if (existing) return existing._id;
    return ctx.db.insert("cemeteryProgress", {
      ownerId: userId,
      revision: 0,
      upgrades: {},
      bestSeconds: 0,
      runs: 0,
    });
  },
});
export const run = query({
  args: { runId: v.id("cemeteryRuns") },
  handler: async (ctx, args) => {
    const { userId } = await requirePlayer(ctx),
      saved = await ctx.db.get(args.runId);
    if (!saved || saved.ownerId !== userId)
      throw new ConvexError("Cette partie est introuvable.");
    return saved;
  },
});
export const startRun = mutation({
  args: {
    ...ownerArgs,
    revision: v.number(),
    requestId: v.string(),
    leaseId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await owner(ctx, args.expectedOwnerId);
    identifier(args.requestId);
    identifier(args.leaseId);
    const previous = await ctx.db
      .query("cemeteryRuns")
      .withIndex("by_owner_request", (q) =>
        q.eq("ownerId", userId).eq("requestId", args.requestId),
      )
      .unique();
    if (previous) return previous;
    const saved = await progressFor(ctx, userId);
    if (!saved || saved.revision !== args.revision)
      throw new ConvexError(
        "Le cimetière a changé dans un autre onglet. Recharge son état.",
      );
    if (saved.activeRunId)
      throw new ConvexError(
        "Reprends ou abandonne d’abord la partie en cours.",
      );
    const hero = await ctx.db
        .query("heroes")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .unique(),
      league = await playerLeague(ctx, userId),
      now = Date.now();
    const state = createCemeteryRun(
      Math.floor(Math.random() * 4294967295) + 1,
      hero?.selectedHeroId ?? "sylve",
      saved.upgrades,
    );
    const id = await ctx.db.insert("cemeteryRuns", {
      ownerId: userId,
      requestId: args.requestId,
      startedAt: now,
      leaseAt: now,
      leaseTick: 0,
      leaseId: args.leaseId,
      leasePaused: false,
      state,
      status: "active",
      leagueTrophies: league.peakTrophies,
      rewardStatus: "none",
    });
    await ctx.db.patch(saved._id, {
      activeRunId: id,
      revision: saved.revision + 1,
    });
    return (await ctx.db.get(id))!;
  },
});
export const resumeRun = mutation({
  args: { ...runArgs, leaseId: v.string() },
  handler: async (ctx, args) => {
    const run = await ownedRun(ctx, args.expectedOwnerId, args.runId);
    identifier(args.leaseId);
    if (run.status !== "active")
      throw new ConvexError("Cette partie est déjà terminée.");
    if (run.leaseId === args.leaseId && !run.leasePaused) return run;
    await ctx.db.patch(run._id, {
      leaseAt: Date.now(),
      leaseTick: run.state.tick,
      leaseId: args.leaseId,
      leasePaused: false,
    });
    return (await ctx.db.get(run._id))!;
  },
});
export const pauseRun = mutation({
  args: { ...runArgs, leaseId: v.string() },
  handler: async (ctx, args) => {
    const run = await ownedRun(ctx, args.expectedOwnerId, args.runId);
    if (run.leaseId !== args.leaseId)
      throw new ConvexError("Cette partie est ouverte dans un autre onglet.");
    if (run.status === "active" && !run.leasePaused)
      await ctx.db.patch(run._id, { leasePaused: true });
  },
});
export const submitInputs = mutation({
  args: {
    ...runArgs,
    leaseId: v.string(),
    startTick: v.number(),
    inputs: v.array(cemeteryInput),
  },
  handler: async (ctx, args) => {
    const run = await ownedRun(ctx, args.expectedOwnerId, args.runId);
    if (
      !Number.isSafeInteger(args.startTick) ||
      args.startTick < 0 ||
      !args.inputs.length ||
      args.inputs.length > CEMETERY.maxBatchTicks ||
      !args.inputs.every(validCemeteryInput)
    )
      throw new ConvexError("Lot de déplacements invalide.");
    const payload = JSON.stringify(args.inputs),
      previous = await ctx.db
        .query("cemeteryInputReceipts")
        .withIndex("by_run_kind_cursor", (q) =>
          q
            .eq("runId", run._id)
            .eq("kind", "inputs")
            .eq("cursor", args.startTick),
        )
        .unique();
    if (previous) {
      if (previous.payload !== payload)
        throw new ConvexError("Cette partie est pilotée dans un autre onglet.");
      return { state: run.state, acceptedTick: previous.endTick };
    }
    if (
      run.status !== "active" ||
      run.leaseId !== args.leaseId ||
      run.leasePaused ||
      run.state.tick !== args.startTick ||
      run.state.ended ||
      run.state.choices.length
    )
      throw new ConvexError("La partie a changé. Reprends sa sauvegarde.");
    if (
      (args.startTick + args.inputs.length - run.leaseTick) * CEMETERY.stepMs >
      Date.now() - run.leaseAt + 150
    )
      throw new ConvexError("Les déplacements arrivent trop vite.");
    const state = stateOf(run.state);
    for (const input of args.inputs) {
      stepCemetery(state, input);
      if (state.ended || state.choices.length) break;
    }
    await ctx.db.insert("cemeteryInputReceipts", {
      runId: run._id,
      kind: "inputs",
      cursor: args.startTick,
      endTick: state.tick,
      payload,
    });
    await ctx.db.patch(run._id, {
      state,
      ...(state.choices.length || state.ended ? { leasePaused: true } : {}),
    });
    return { state, acceptedTick: state.tick };
  },
});
export const chooseUpgrade = mutation({
  args: {
    ...runArgs,
    leaseId: v.string(),
    serial: v.number(),
    choice: v.string(),
  },
  handler: async (ctx, args) => {
    const run = await ownedRun(ctx, args.expectedOwnerId, args.runId);
    const previous = await ctx.db
      .query("cemeteryInputReceipts")
      .withIndex("by_run_kind_cursor", (q) =>
        q.eq("runId", run._id).eq("kind", "choice").eq("cursor", args.serial),
      )
      .unique();
    if (previous) {
      if (previous.payload !== args.choice)
        throw new ConvexError("Ce choix a déjà été effectué.");
      return run;
    }
    if (
      run.status !== "active" ||
      run.leaseId !== args.leaseId ||
      run.state.choiceSerial !== args.serial
    )
      throw new ConvexError(
        "Cette amélioration a changé dans un autre onglet.",
      );
    const state = stateOf(run.state);
    try {
      chooseCemeteryUpgrade(state, args.choice);
    } catch (error) {
      throw new ConvexError((error as Error).message);
    }
    await ctx.db.insert("cemeteryInputReceipts", {
      runId: run._id,
      kind: "choice",
      cursor: args.serial,
      endTick: state.tick,
      payload: args.choice,
    });
    await ctx.db.patch(run._id, { state, leasePaused: true });
    return (await ctx.db.get(run._id))!;
  },
});
export const purchaseUpgrade = mutation({
  args: {
    ...ownerArgs,
    upgrade: cemeteryUpgradeId,
    expectedRank: v.number(),
    currency: v.union(v.literal("gold"), v.literal("emeralds")),
  },
  handler: async (ctx, args) => {
    const userId = await owner(ctx, args.expectedOwnerId),
      saved = await progressFor(ctx, userId);
    if (!saved) throw new ConvexError("Ouvre d’abord le cimetière.");
    const rank = saved.upgrades[args.upgrade] ?? 0;
    // A repeated purchase of the same rank never buys the next rank or charges twice.
    if (rank > args.expectedRank) return;
    if (saved.activeRunId || rank !== args.expectedRank)
      throw new ConvexError(
        "Termine ta partie ou actualise les améliorations.",
      );
    let cost;
    try {
      cost = upgradeCost(args.upgrade, rank);
    } catch (error) {
      throw new ConvexError((error as Error).message);
    }
    const wallet = await ensureEmeralds(ctx, userId),
      field = args.currency === "gold" ? "gold" : "diamonds",
      price = cost[args.currency];
    if (wallet[field] < price)
      throw new ConvexError(
        args.currency === "gold"
          ? "Tu n’as pas assez d’or."
          : "Tu n’as pas assez d’émeraudes.",
      );
    await ctx.db.patch(wallet._id, { [field]: wallet[field] - price });
    await ctx.db.patch(saved._id, {
      upgrades: { ...saved.upgrades, [args.upgrade]: rank + 1 },
      revision: saved.revision + 1,
    });
  },
});
export const finishRun = mutation({
  args: runArgs,
  handler: async (ctx, args) => {
    const run = await ownedRun(ctx, args.expectedOwnerId, args.runId);
    if (run.status === "dead") return run.summary!;
    if (run.status !== "active" || !run.state.ended)
      throw new ConvexError("Cette partie n’est pas terminée.");
    const saved = await progressFor(ctx, run.ownerId);
    if (saved?.activeRunId !== run._id)
      throw new ConvexError("La partie a changé.");
    const summary = cemeterySummary(stateOf(run.state));
    const reward = {
      rarity: summary.rarity,
      contents: chestLoot(summary.rarity, Math.random, run.leagueTrophies),
      gold:
        chestGold(summary.rarity, Math.random, run.leagueTrophies) +
        summary.gold,
    };
    await ctx.db.patch(run._id, {
      status: "dead",
      summary,
      rewardStatus: "unopened",
      reward,
    });
    await ctx.db.patch(saved._id, {
      activeRunId: undefined,
      lastRunId: run._id,
      runs: saved.runs + 1,
      bestSeconds: Math.max(saved.bestSeconds, summary.seconds),
      revision: saved.revision + 1,
    });
    return summary;
  },
});
export const abandonRun = mutation({
  args: runArgs,
  handler: async (ctx, args) => {
    const run = await ownedRun(ctx, args.expectedOwnerId, args.runId);
    if (run.status === "abandoned") return;
    if (run.status !== "active")
      throw new ConvexError("Cette partie est déjà terminée.");
    // A verified death remains claimable even when another tab presses Abandonner.
    if (run.state.ended)
      throw new ConvexError("La partie est terminée : récupère son coffre.");
    const saved = await progressFor(ctx, run.ownerId);
    if (saved?.activeRunId !== run._id)
      throw new ConvexError("La partie a changé.");
    await ctx.db.patch(run._id, { status: "abandoned", leasePaused: true });
    await ctx.db.patch(saved._id, {
      activeRunId: undefined,
      revision: saved.revision + 1,
    });
  },
});
export const openReward = mutation({
  args: runArgs,
  handler: async (ctx, args) => {
    const run = await ownedRun(ctx, args.expectedOwnerId, args.runId);
    if (run.status !== "dead" || !run.reward)
      throw new ConvexError("Ce coffre n’est pas encore disponible.");
    if (run.rewardStatus === "opened")
      return {
        rarity: run.reward.rarity,
        gold: run.reward.gold,
        reveals: run.reward.reveals ?? [],
      };
    const reveals = await grantLoot(ctx, run.ownerId, run.reward.contents);
    await grantGold(ctx, run.ownerId, run.reward.gold);
    await ctx.db.patch(run._id, {
      rewardStatus: "opened",
      reward: { ...run.reward, reveals },
    });
    await recordMissionProgress(ctx, run.ownerId, { chestsOpened: 1 });
    return { rarity: run.reward.rarity, gold: run.reward.gold, reveals };
  },
});
