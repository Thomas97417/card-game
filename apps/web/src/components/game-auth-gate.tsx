import type { ReactNode } from "react";
import { Navigate, useRouterState } from "@tanstack/react-router";
import { useGameAuth } from "@/hooks/use-game-auth";
import { safeReturnTo } from "@/lib/game-auth";

export function GameAuthGate({
  required,
  children,
}: {
  required: boolean;
  children: ReactNode;
}) {
  const { isLoading, isAuthenticated } = useGameAuth();
  const href = useRouterState({ select: (state) => state.location.href });

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
