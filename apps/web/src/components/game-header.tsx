import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { LeagueProgress } from "@sylve/game/leagues";
import { PlayerHeader } from "./player-header";

export function GameHeader({
  children,
  league,
  className = "",
}: {
  children?: ReactNode;
  league?: LeagueProgress;
  className?: string;
}) {
  return (
    <header className={`game-page-header ${className}`}>
      {children ?? (
        <Link
          to="/hub"
          className="workshop-back"
          aria-label="Retour au refuge"
          draggable={false}
        >
          <img
            src="/art/ui/back-arrow.webp"
            alt=""
            width={288}
            height={157}
            draggable={false}
          />
        </Link>
      )}
      <PlayerHeader league={league} />
    </header>
  );
}
