import { createContext, useContext, type ReactNode } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { Link } from "@tanstack/react-router";
import { api } from "@my-better-t-app/backend/convex/_generated/api";

// null: signed out; undefined: balance loading; number: authoritative balance.
export const GoldContext = createContext<number | null | undefined>(null);

const GOLD_SHOP_SCROLL: ScrollIntoViewOptions = {
  block: "nearest",
  inline: "start",
};

export function GoldProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const gold = useQuery(api.collection.gold, isAuthenticated ? {} : "skip");
  return (
    <GoldContext.Provider value={isAuthenticated ? gold : null}>
      {children}
    </GoldContext.Provider>
  );
}

export function useGoldBalance() {
  return useContext(GoldContext);
}

export function GoldIcon({ className = "" }: { className?: string }) {
  return (
    <img
      className={`gold-icon ${className}`}
      src="/art/ui/gold-coins.webp"
      alt=""
      aria-hidden="true"
      width={40}
      height={40}
      draggable={false}
    />
  );
}

export function GoldAmount({ amount }: { amount: number }) {
  return (
    <span className="gold-amount">
      <GoldIcon />
      <span>{amount.toLocaleString("fr-FR")}</span>
      <span className="sr-only">pièces d’or</span>
    </span>
  );
}

export function GoldBalance() {
  const gold = useGoldBalance();
  if (gold === null) return null;
  return (
    <Link
      to="/sanctuary"
      hash="gold-packs"
      hashScrollIntoView={GOLD_SHOP_SCROLL}
      className="gold-balance-link"
      aria-label={`Acheter des pièces d’or${gold === undefined ? "" : `, solde : ${gold.toLocaleString("fr-FR")} pièces d’or`}`}
      title="Acheter des pièces d’or"
      draggable={false}
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        // Recenter even when the URL already points to this section.
        document.getElementById("gold-packs")?.scrollIntoView(GOLD_SHOP_SCROLL);
      }}
    >
      <div
        className="gold-balance"
        role="status"
        aria-label="Solde de pièces d’or"
      >
        {gold === undefined ? (
          <>
            <GoldIcon />
            <span aria-hidden="true">—</span>
            <span className="sr-only">Chargement du solde…</span>
          </>
        ) : (
          <GoldAmount amount={gold} />
        )}
      </div>
    </Link>
  );
}
