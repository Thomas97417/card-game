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
    const timer = window.setInterval(() => tick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [board]);
  return anchor.serverNow + Math.max(0, performance.now() - anchor.receivedAt);
}
