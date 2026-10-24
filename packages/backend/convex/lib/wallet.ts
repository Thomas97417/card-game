import { WELCOME_DIAMONDS } from "@sylve/game/summoning";
import type { MutationCtx } from "../_generated/server";
import { playerWallet } from "./progression";

/** Missing balance is the migration marker; a spent balance of zero stays zero. */
export async function ensureEmeralds(ctx: MutationCtx, ownerId: string) {
  const wallet = await playerWallet(ctx, ownerId);
  if (wallet) {
    if (wallet.diamonds !== undefined)
      return { ...wallet, diamonds: wallet.diamonds };
    await ctx.db.patch(wallet._id, { diamonds: WELCOME_DIAMONDS });
    return { ...wallet, diamonds: WELCOME_DIAMONDS };
  }
  const id = await ctx.db.insert("wallets", {
    ownerId,
    gold: 0,
    diamonds: WELCOME_DIAMONDS,
  });
  return { _id: id, ownerId, gold: 0, diamonds: WELCOME_DIAMONDS };
}
