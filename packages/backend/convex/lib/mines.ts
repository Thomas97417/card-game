import { changeMineLevel, type MineState } from "@sylve/game/mines";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/** Settle old production in the transaction that changes account rank. */
export async function syncMineLevel(
  ctx: MutationCtx,
  wallet: {
    _id: Id<"wallets">;
    mines?: { gold: MineState; emeralds: MineState };
  },
  level: number,
) {
  if (!wallet.mines) return;
  if (
    wallet.mines.gold.level === level &&
    wallet.mines.emeralds.level === level &&
    wallet.mines.gold.heroLevel === undefined &&
    wallet.mines.emeralds.heroLevel === undefined
  ) return;
  const now = Date.now();
  await ctx.db.patch(wallet._id, {
    mines: {
      gold: changeMineLevel("gold", wallet.mines.gold, level, now),
      emeralds: changeMineLevel("emeralds", wallet.mines.emeralds, level, now),
    },
  });
}
