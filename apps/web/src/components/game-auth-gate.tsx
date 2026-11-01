import { useEffect, type ReactNode } from "react";
import { Navigate, useRouterState } from "@tanstack/react-router";
import { useGameAuth } from "@/hooks/use-game-auth";
import { safeReturnTo } from "@/lib/game-auth";
import type { NavigationAuth } from "@/lib/navigation-auth";
import { DeckWorkshopStoreProvider } from "./decks/deck-workshop-state";
import type { QueryClient } from "@tanstack/react-query";
import { usePlayerQueryCache } from "@/hooks/use-player-query-cache";
import { GameConnectionScreen } from "./game-connection-screen";

export function GameAuthGate({
  required,
  children,
  navigationAuth,
  queryClient,
}: {
  required: boolean;
  children: ReactNode;
  navigationAuth?: NavigationAuth;
  queryClient?: QueryClient;
}) {
  const { isLoading, isAuthenticated, userId } = useGameAuth();
  const cacheReady = usePlayerQueryCache(queryClient, userId, isLoading);
  const href = useRouterState({ select: (state) => state.location.href });

  useEffect(() => {
    if (!isLoading) navigationAuth?.update(isAuthenticated);
  }, [isLoading, isAuthenticated, navigationAuth]);

  if ((!required || isAuthenticated) && cacheReady) {
    return (
      <DeckWorkshopStoreProvider key={userId ?? "anonymous"}>
        {children}
      </DeckWorkshopStoreProvider>
    );
  }
  if (isLoading || !cacheReady) {
    return <GameConnectionScreen />;
  }
  return (
    <Navigate
      to="/sign-in"
      search={{ returnTo: safeReturnTo(href) }}
      replace
    />
  );
}
