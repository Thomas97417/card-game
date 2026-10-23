import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { showGameError } from "@/components/game/shared";

export const DiamondContext = createContext<number | null | undefined>(null);

export function DiamondProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const diamonds = useQuery(
    api.collection.diamonds,
    isAuthenticated ? {} : "skip",
  );
  const ensureWallet = useMutation(api.sanctuary.ensureWallet);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    setReady(false);
    if (isAuthenticated) {
      void ensureWallet()
        .then(() => {
          if (mounted) setReady(true);
        })
        .catch(showGameError);
    }
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, ensureWallet]);
  return (
    <DiamondContext.Provider
      value={isAuthenticated ? (ready ? diamonds : undefined) : null}
    >
      {children}
    </DiamondContext.Provider>
  );
}

export function useDiamondBalance() {
  return useContext(DiamondContext);
}

export function DiamondIcon({ className = "" }: { className?: string }) {
  return (
    <img
      className={`diamond-icon ${className}`}
      src="/art/ui/diamonds.webp"
      alt=""
      aria-hidden="true"
      width={40}
      height={40}
      draggable={false}
    />
  );
}

export function DiamondAmount({ amount }: { amount: number }) {
  return (
    <span className="diamond-amount">
      <DiamondIcon />
      <span>{amount.toLocaleString("fr-FR")}</span>
      <span className="sr-only">diamants</span>
    </span>
  );
}

export function DiamondBalance() {
  const diamonds = useDiamondBalance();
  if (diamonds === null) return null;
  return (
    <div
      className="diamond-balance"
      role="status"
      aria-label="Solde de diamants"
    >
      {diamonds === undefined ? (
        <>
          <DiamondIcon />
          <span aria-hidden="true">—</span>
          <span className="sr-only">Chargement des diamants…</span>
        </>
      ) : (
        <DiamondAmount amount={diamonds} />
      )}
    </div>
  );
}
