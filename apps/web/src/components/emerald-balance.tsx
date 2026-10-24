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

export const EmeraldContext = createContext<number | null | undefined>(null);

export function EmeraldProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  // Retain the existing wallet endpoint so players keep their currency balance.
  const emeralds = useQuery(
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
    <EmeraldContext.Provider
      value={isAuthenticated ? (ready ? emeralds : undefined) : null}
    >
      {children}
    </EmeraldContext.Provider>
  );
}

export function useEmeraldBalance() {
  return useContext(EmeraldContext);
}

export function EmeraldIcon({ className = "" }: { className?: string }) {
  return (
    <img
      className={`emerald-icon ${className}`}
      src="/art/ui/emerald.webp"
      alt=""
      aria-hidden="true"
      width={40}
      height={40}
      draggable={false}
    />
  );
}

export function EmeraldAmount({ amount }: { amount: number }) {
  return (
    <span className="emerald-amount">
      <EmeraldIcon />
      <span>{amount.toLocaleString("fr-FR")}</span>
      <span className="sr-only">émeraudes</span>
    </span>
  );
}

export function EmeraldBalance() {
  const emeralds = useEmeraldBalance();
  if (emeralds === null) return null;
  return (
    <div
      className="emerald-balance"
      role="status"
      aria-label="Solde d’émeraudes"
    >
      {emeralds === undefined ? (
        <>
          <EmeraldIcon />
          <span aria-hidden="true">—</span>
          <span className="sr-only">Chargement des émeraudes…</span>
        </>
      ) : (
        <EmeraldAmount amount={emeralds} />
      )}
    </div>
  );
}
