import { useEffect, useReducer } from "react";
import type { QueryClient } from "@tanstack/react-query";

/** Retain live Convex subscriptions until the player session changes. */
export const PLAYER_QUERY_OPTIONS = {
  gcTime: Infinity,
  throwOnError: true,
} as const;

// The owner follows the router's QueryClient, including across boundary remounts.
// Each SSR request has its own client, and unused clients can be garbage collected.
const owners = new WeakMap<QueryClient, string | null>();

export function usePlayerQueryCache(
  client: QueryClient | undefined,
  userId: string | null,
  isLoading: boolean,
) {
  const [, refresh] = useReducer((value) => value + 1, 0);
  const owner = client ? owners.get(client) : undefined;

  useEffect(() => {
    if (!client || isLoading || owner === userId) return;
    if (owners.get(client) !== userId) {
      client.clear();
      owners.set(client, userId);
    }
    refresh();
  }, [client, userId, isLoading, owner]);

  // Public pages remain available on a fresh anonymous client. An existing
  // player's cache must be cleared before another session can render its data.
  return !client || owner === userId || (owner === undefined && userId === null);
}
