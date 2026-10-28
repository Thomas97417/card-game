import { useEffect, type ReactNode } from "react";
import { Navigate, useRouterState } from "@tanstack/react-router";
import { useGameAuth } from "@/hooks/use-game-auth";
import { safeReturnTo } from "@/lib/game-auth";
import type { NavigationAuth } from "@/lib/navigation-auth";

export function GameAuthGate({
  required,
  children,
  navigationAuth,
}: {
  required: boolean;
  children: ReactNode;
  navigationAuth?: NavigationAuth;
}) {
  const { isLoading, isAuthenticated } = useGameAuth();
  const href = useRouterState({ select: (state) => state.location.href });

  useEffect(() => {
    if (!isLoading) navigationAuth?.update(isAuthenticated);
  }, [isLoading, isAuthenticated, navigationAuth]);

  if (!required || isAuthenticated) return children;
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center" role="status">
        Connexion en cours…
      </div>
    );
  }
  return (
    <Navigate
      to="/sign-in"
      search={{ returnTo: safeReturnTo(href) }}
      replace
    />
  );
}
