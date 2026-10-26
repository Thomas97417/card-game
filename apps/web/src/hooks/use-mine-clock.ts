import { useCallback, useRef } from "react";
import type { MineBoard } from "@sylve/game/mines";

/** Rolling back an optimistic board must not rewind production to the last
 * server snapshot. Keep the latest monotonic anchor for this account. */
export function useMineClock(board: MineBoard | undefined) {
  const clock = useRef({ ownerId: board?.ownerId, serverNow: board?.serverNow ?? 0, receivedAt: performance.now() });
  if (board && (clock.current.ownerId !== board.ownerId || board.serverNow > clock.current.serverNow)) {
    clock.current = { ownerId: board.ownerId, serverNow: board.serverNow, receivedAt: performance.now() };
  }
  return useCallback(() => clock.current.serverNow + Math.max(0, performance.now() - clock.current.receivedAt), []);
}
