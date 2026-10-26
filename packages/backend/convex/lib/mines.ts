import { changeMineLevel, type MineState } from "@sylve/game/mines";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/** Called in the same transaction as the Guardian's level update. */
export async function syncMineLevel(
  ctx: MutationCtx,
  wallet: {
    _id: Id<"wallets">;
    mines?: { gold: MineState; emeralds: MineState };
  },
  heroLevel: number,
) {
  if (!wallet.mines) return;
  if (
    wallet.mines.gold.heroLevel === heroLevel &&
    wallet.mines.emeralds.heroLevel === heroLevel
  ) return;
  const now = Date.now();
  await ctx.db.patch(wallet._id, {
    mines: {
      gold: changeMineLevel("gold", wallet.mines.gold, heroLevel, now),
      emeralds: changeMineLevel("emeralds", wallet.mines.emeralds, heroLevel, now),
    },
  });
}
