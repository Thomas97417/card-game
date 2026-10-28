import { useEffect, useMemo, useState } from "react";
import type { DailyRewardsBoard } from "@sylve/game/daily-rewards";

/** Count from the server snapshot, independently of the device's wall clock. */
export function useDailyRewardClock(board: DailyRewardsBoard | undefined) {
  const [, tick] = useState(0);
  const anchor = useMemo(
    () => ({ serverNow: board?.serverNow ?? 0, receivedAt: performance.now() }),
    [board],
  );
  useEffect(() => {
    if (!board || board.nextClaimAt === null) return;
    const nextClaimAt = board.nextClaimAt;
    let timer: number | undefined;
    const schedule = () => {
      const now = anchor.serverNow + Math.max(0, performance.now() - anchor.receivedAt);
      const remaining = nextClaimAt - now;
      if (remaining <= 0) return;
      timer = window.setTimeout(() => {
        tick((value) => value + 1);
        schedule();
      }, Math.min(1000, remaining));
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [board, anchor]);
  return anchor.serverNow + Math.max(0, performance.now() - anchor.receivedAt);
}
