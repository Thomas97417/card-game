import { ConvexError, v } from "convex/values";
import { ASSISTANTS, ASSISTANT_IDS, FOUNDRY, TOOLS, buyFoundryUpgrade, buyFoundrySkill, buyFoundryCharm, chooseFoundryBlessing, createFoundryRound,
  deliverFoundryOrder, foundryInputDigest, foundrySummary, newFoundryCycle, settleFoundryRound, stepFoundry, validFoundryInput,
  type FoundryAssistant } from "@sylve/game/foundry";
import { chestGold, chestLoot } from "@sylve/game/progression";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requirePlayer } from "./lib/game_service";
import { ensureStarterDeck } from "./decks";
import { grantGold, grantLoot, playerLeague } from "./lib/progression";
import { socialDay } from "./lib/social";
import { recordMissionProgress } from "./lib/missions";
import { foundryAssistant, foundryBlessing, foundryInput, foundryTool, foundryUpgrade, foundrySkill, foundryCharm } from "./lib/foundry";

const ownerArg = { expectedOwnerId: v.string() };
const revisionArgs = { ...ownerArg, revision: v.number() };
const progressFor = (ctx: QueryCtx | MutationCtx, ownerId: string) => ctx.db.query("foundryProgress").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).unique();
async function owner(ctx: MutationCtx, expected: string) {
  const { userId } = await requirePlayer(ctx);
  if (userId !== expected) throw new ConvexError("Ce chantier appartient à un autre compte. Recharge la fonderie.");
  return userId;
}
async function progress(ctx: MutationCtx, userId: string, revision: number) {
  const saved = await progressFor(ctx, userId);
  if (!saved) throw new ConvexError("Ouvre d’abord la fonderie.");
  if (saved.revision !== revision) throw new ConvexError("Le chantier a changé dans un autre onglet. Reprends son état sauvegardé.");
  return saved;
}
function idle(saved: Doc<"foundryProgress">) {
  if (saved.activeRoundId) throw new ConvexError("Termine ou reprends la manche en cours.");
}
function rules<T>(fn: () => T): T {
  try { return fn(); } catch (error) { throw new ConvexError(error instanceof Error ? error.message : "Cette action est indisponible."); }
}
async function assistants(ctx: QueryCtx | MutationCtx, userId: string): Promise<FoundryAssistant[]> {
  const cards = await ctx.db.query("collection").withIndex("by_owner_variant", (q) => q.eq("ownerId", userId)).collect();
  return ASSISTANT_IDS.filter((id) => id === "smith" || cards.some((card) => card.variantId.split(":")[0] === ASSISTANTS[id].family));
}
export const board = query({
  args: { refreshKey: v.optional(v.number()) },
  handler: async (ctx) => {
    const { userId } = await requirePlayer(ctx); const saved = await progressFor(ctx, userId);
    const day = socialDay();
    const [round, daily, pendingReward, availableAssistants] = await Promise.all([
      saved?.activeRoundId ? ctx.db.get(saved.activeRoundId) : null,
      ctx.db.query("foundryDaily").withIndex("by_owner_day", (q) => q.eq("ownerId", userId).eq("day", day)).unique(),
      ctx.db.query("foundryDaily").withIndex("by_owner_seen", (q) => q.eq("ownerId", userId).eq("seen", false)).first(),
      assistants(ctx, userId),
    ]);
    return { ownerId: userId, progress: saved, round, daily: { day, delivered: daily?.delivered ?? 0, claimed: !!daily?.receipt }, pendingReward, availableAssistants, serverNow: Date.now() };
  },
});
export const ensure = mutation({
  args: ownerArg,
  handler: async (ctx, args) => {
    const userId = await owner(ctx, args.expectedOwnerId); await ensureStarterDeck(ctx, userId);
    const saved = await progressFor(ctx, userId);
    if (saved) return saved._id;
    return ctx.db.insert("foundryProgress", { ownerId: userId, revision: 0, mastery: 0, masterySpent: 0, charms: [], cycle: newFoundryCycle(1, Math.floor(Math.random() * 4294967295) + 1) });
  },
});
export const startRound = mutation({
  args: { ...revisionArgs, requestId: v.string(), tool: foundryTool, assistant: foundryAssistant },
  handler: async (ctx, args) => {
    const userId = await owner(ctx, args.expectedOwnerId);
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(args.requestId)) throw new ConvexError("Identifiant de manche invalide.");
    const previous = await ctx.db.query("foundryRounds").withIndex("by_owner_request", (q) => q.eq("ownerId", userId).eq("requestId", args.requestId)).unique();
    if (previous) return previous;
    const saved = await progress(ctx, userId, args.revision); idle(saved);
    if (saved.cycle.status !== "active" || saved.cycle.choices.length || saved.cycle.roundsLeft <= 0) throw new ConvexError("Livre ta commande et choisis ta bénédiction avant de jouer.");
    if (saved.mastery < TOOLS[args.tool].mastery) throw new ConvexError("Cet outil n’est pas encore débloqué.");
    if (!(await assistants(ctx, userId)).includes(args.assistant)) throw new ConvexError("Découvre ce compagnon dans ta collection pour l’inviter.");
    const state = createFoundryRound(Math.floor(Math.random() * 4294967295) + 1, saved.cycle, args.tool, args.assistant, saved.charms ?? []);
    const id = await ctx.db.insert("foundryRounds", { ownerId: userId, cycleNumber: saved.cycle.number, requestId: args.requestId, startedAt: Date.now(), finished: false, state, batches: [] });
    await ctx.db.patch(saved._id, { activeRoundId: id, revision: saved.revision + 1 });
    return (await ctx.db.get(id))!;
  },
});
export const submitInputs = mutation({
  args: { ...ownerArg, roundId: v.id("foundryRounds"), startTick: v.number(), inputs: v.array(foundryInput) },
  handler: async (ctx, args) => {
    const userId = await owner(ctx, args.expectedOwnerId); const round = await ctx.db.get(args.roundId);
    if (!round || round.ownerId !== userId) throw new ConvexError("Cette manche est introuvable.");
    if (!Number.isSafeInteger(args.startTick) || args.startTick < 0 || !args.inputs.length || args.inputs.length > FOUNDRY.maxBatchTicks || !args.inputs.every(validFoundryInput)) throw new ConvexError("Lot de visée invalide.");
    const digest = foundryInputDigest(args.inputs);
    const previous = round.batches.find((batch) => batch.startTick === args.startTick);
    if (previous) {
      if (previous.digest !== digest) throw new ConvexError("Cette manche est pilotée dans un autre onglet.");
      return round.state;
    }
    const saved = await progressFor(ctx, userId);
    if (round.finished || saved?.activeRoundId !== round._id || saved.cycle.number !== round.cycleNumber || round.state.tick !== args.startTick) throw new ConvexError("La manche a changé. Reprends son état sauvegardé.");
    if (round.state.ended) throw new ConvexError("Cette manche est déjà terminée.");
    if ((args.startTick + args.inputs.length) * FOUNDRY.stepMs > Date.now() - round.startedAt + 100) throw new ConvexError("Les frappes arrivent trop vite.");
    const state = round.state;
    for (const input of args.inputs) { stepFoundry(state, input); if (state.ended) break; }
    await ctx.db.patch(round._id, { state, batches: [...round.batches, { startTick: args.startTick, endTick: state.tick, digest }] });
    return state;
  },
});
export const finishRound = mutation({
  args: { ...ownerArg, roundId: v.id("foundryRounds") },
  handler: async (ctx, args) => {
    const userId = await owner(ctx, args.expectedOwnerId); const round = await ctx.db.get(args.roundId);
    if (!round || round.ownerId !== userId) throw new ConvexError("Cette manche est introuvable.");
    const summary = foundrySummary(round.state);
    if (round.finished) return summary;
    const saved = await progressFor(ctx, userId);
    if (!saved || saved.activeRoundId !== round._id) throw new ConvexError("La manche a changé.");
    const cycle = rules(() => settleFoundryRound(saved.cycle, round.state));
    await ctx.db.patch(saved._id, { cycle, revision: saved.revision + 1, activeRoundId: undefined, lastSummary: summary });
    await ctx.db.patch(round._id, { finished: true });
    return summary;
  },
});
export const purchaseUpgrade = mutation({
  args: { ...revisionArgs, upgrade: foundryUpgrade },
  handler: async (ctx, args) => {
    const userId = await owner(ctx, args.expectedOwnerId); const saved = await progress(ctx, userId, args.revision); idle(saved);
    const cycle = rules(() => buyFoundryUpgrade(saved.cycle, args.upgrade));
    await ctx.db.patch(saved._id, { cycle, revision: saved.revision + 1 });
  },
});
export const purchaseSkill = mutation({
  args: { ...revisionArgs, skill: foundrySkill },
  handler: async (ctx, args) => {
    const userId = await owner(ctx, args.expectedOwnerId); const saved = await progress(ctx, userId, args.revision); idle(saved);
    const cycle = rules(() => buyFoundrySkill(saved.cycle, args.skill));
    await ctx.db.patch(saved._id, { cycle, revision: saved.revision + 1 });
  },
});
export const purchaseCharm = mutation({
  args: { ...revisionArgs, charm: foundryCharm },
  handler: async (ctx, args) => {
    const userId = await owner(ctx, args.expectedOwnerId); const saved = await progress(ctx, userId, args.revision); idle(saved);
    const changes = rules(() => buyFoundryCharm(saved.mastery, saved.masterySpent ?? 0, saved.charms ?? [], args.charm));
    await ctx.db.patch(saved._id, { ...changes, revision: saved.revision + 1 });
  },
});
export const abandonChantier = mutation({
  args: revisionArgs,
  handler: async (ctx, args) => {
    const userId = await owner(ctx, args.expectedOwnerId); const saved = await progress(ctx, userId, args.revision); idle(saved);
    if (saved.cycle.status !== "active" || saved.cycle.choices.length) throw new ConvexError("Choisis ta bénédiction ou ouvre le chantier suivant.");
    await ctx.db.patch(saved._id, { cycle: { ...saved.cycle, status: "abandoned" }, revision: saved.revision + 1 });
  },
});
export const payOrder = mutation({
  args: { ...revisionArgs, cycleNumber: v.number(), orderIndex: v.number() },
  handler: async (ctx, args) => {
    const userId = await owner(ctx, args.expectedOwnerId); const existing = await progressFor(ctx, userId);
    if (existing && (existing.cycle.number > args.cycleNumber || (existing.cycle.number === args.cycleNumber && existing.cycle.orderIndex > args.orderIndex))) return;
    const saved = await progress(ctx, userId, args.revision); idle(saved);
    if (saved.cycle.number !== args.cycleNumber || saved.cycle.orderIndex !== args.orderIndex) throw new ConvexError("Cette commande a changé.");
    const cycle = rules(() => deliverFoundryOrder(saved.cycle));
    await ctx.db.patch(saved._id, { cycle, mastery: saved.mastery + 1, revision: saved.revision + 1 });
    const day = socialDay();
    const daily = await ctx.db.query("foundryDaily").withIndex("by_owner_day", (q) => q.eq("ownerId", userId).eq("day", day)).unique();
    const delivered = Math.min(3, (daily?.delivered ?? 0) + 1);
    let receipt = daily?.receipt;
    if (delivered === 3 && !receipt) {
      await ensureStarterDeck(ctx, userId);
      const league = await playerLeague(ctx, userId);
      const reveals = await grantLoot(ctx, userId, chestLoot("common", Math.random, league.peakTrophies));
      const gold = chestGold("common", Math.random, league.peakTrophies);
      await grantGold(ctx, userId, gold); await recordMissionProgress(ctx, userId, { chestsOpened: 1 });
      receipt = { rarity: "common" as const, gold, reveals, awardedAt: Date.now() };
    }
    const value = { delivered, ...(receipt ? { receipt } : {}), seen: receipt ? (daily?.receipt ? daily.seen : false) : true };
    if (daily) await ctx.db.patch(daily._id, value);
    else await ctx.db.insert("foundryDaily", { ownerId: userId, day, ...value });
  },
});
export const chooseBlessing = mutation({
  args: { ...revisionArgs, blessing: foundryBlessing },
  handler: async (ctx, args) => {
    const userId = await owner(ctx, args.expectedOwnerId); const saved = await progress(ctx, userId, args.revision); idle(saved);
    const cycle = rules(() => chooseFoundryBlessing(saved.cycle, args.blessing));
    await ctx.db.patch(saved._id, { cycle, revision: saved.revision + 1 });
  },
});
export const newChantier = mutation({
  args: revisionArgs,
  handler: async (ctx, args) => {
    const userId = await owner(ctx, args.expectedOwnerId); const saved = await progress(ctx, userId, args.revision); idle(saved);
    if (saved.cycle.status === "active" || saved.cycle.choices.length) throw new ConvexError("Termine d’abord le chantier en cours.");
    await ctx.db.patch(saved._id, { cycle: newFoundryCycle(saved.cycle.number + 1, Math.floor(Math.random() * 4294967295) + 1), revision: saved.revision + 1, lastSummary: undefined });
  },
});
export const acknowledgeReward = mutation({
  args: { ...ownerArg, rewardId: v.id("foundryDaily") },
  handler: async (ctx, args) => {
    const userId = await owner(ctx, args.expectedOwnerId); const saved = await ctx.db.get(args.rewardId);
    if (!saved || saved.ownerId !== userId || !saved.receipt) throw new ConvexError("Cette récompense est introuvable.");
    if (!saved.seen) await ctx.db.patch(saved._id, { seen: true });
  },
});
