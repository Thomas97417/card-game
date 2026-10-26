import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import type { LeagueProgress } from "@sylve/game/leagues";
import { CurrencyBalances } from "./currency-balances";
import { LeaguePanel } from "./leagues/league-progress";
import UserMenu from "./user-menu";
import { useGameAuth } from "@/hooks/use-game-auth";

// null: signed out; undefined: loading; LeagueProgress: authoritative progress.
const PlayerLeagueContext = createContext<LeagueProgress | null | undefined>(null);

export function PlayerHeaderProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useGameAuth();
  const league = useQuery(api.collection.league, isAuthenticated ? {} : "skip");

  return (
    <PlayerLeagueContext.Provider value={isAuthenticated ? league : null}>
      {children}
    </PlayerLeagueContext.Provider>
  );
}

export function PlayerHeader({ league }: { league?: LeagueProgress } = {}) {
  const playerLeague = useContext(PlayerLeagueContext);
  const progress = league ?? playerLeague;

  return (
    <div className="player-header-actions">
      {progress ? (
        <LeaguePanel progress={progress} compact />
      ) : playerLeague === undefined ? (
        <div
          className="player-league-loading"
          role="status"
          aria-label="Chargement de la ligue"
        >
          <span aria-hidden="true">—</span>
        </div>
      ) : null}
      <CurrencyBalances />
      {playerLeague !== null && <UserMenu />}
    </div>
  );
}
