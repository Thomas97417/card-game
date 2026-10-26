import { createContext, useContext, type ReactNode } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { Link } from "@tanstack/react-router";
import { api } from "@my-better-t-app/backend/convex/_generated/api";

export const FriendshipContext = createContext<number | null | undefined>(null);

export function FriendshipProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const tokens = useQuery(api.social.balance, isAuthenticated ? {} : "skip");
  return (
    <FriendshipContext.Provider value={isAuthenticated ? tokens : null}>
      {children}
    </FriendshipContext.Provider>
  );
}

export function useFriendshipBalance() {
  return useContext(FriendshipContext);
}

export function FriendshipIcon() {
  return (
    <img
      className="friendship-icon"
      src="/art/ui/friendship-token.webp"
      alt=""
      aria-hidden="true"
      width={40}
      height={40}
      draggable={false}
    />
  );
}

export function FriendshipAmount({ amount }: { amount: number }) {
  return (
    <span className="friendship-amount">
      <FriendshipIcon />
      <span>{amount.toLocaleString("fr-FR")}</span>
      <span className="sr-only">jetons d’entraide</span>
    </span>
  );
}

export function FriendshipBalance() {
  const tokens = useFriendshipBalance();
  if (tokens === null) return null;
  return (
    <Link
      to="/sanctuary"
      hash="summon-packs"
      className="friendship-balance-link"
      title="Jetons d’entraide reçus de tes amis"
      aria-label={`Jetons d’entraide${tokens === undefined ? " en cours de chargement" : ` : ${tokens.toLocaleString("fr-FR")}`}`}
    >
      <span
        className="friendship-balance"
        role="status"
        aria-label="Solde de jetons d’entraide"
      >
        {tokens === undefined ? (
          <>
            <FriendshipIcon />
            <span>—</span>
          </>
        ) : (
          <FriendshipAmount amount={tokens} />
        )}
      </span>
    </Link>
  );
}
