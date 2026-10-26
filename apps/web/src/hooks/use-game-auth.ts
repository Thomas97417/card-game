import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";

/** A valid JWT can outlive its Better Auth session. Check both before
 * subscribing to player data or initializing a wallet. */
export function useGameAuth() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.auth.getCurrentUser, isAuthenticated ? {} : "skip");

  return {
    isLoading: isLoading || (isAuthenticated && user === undefined),
    isAuthenticated: isAuthenticated && !!user,
  };
}
