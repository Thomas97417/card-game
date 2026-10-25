import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { MineKind } from "@sylve/game/mines";

const GAIN_DURATION_MS = 2000;
type Gain = { id: number; amount: number };
type Gains = Partial<Record<MineKind, Gain>>;
const CurrencyGainContext = createContext<{
  gains: Gains;
  showGain: (currency: MineKind, amount: number) => void;
}>({ gains: {}, showGain: () => {} });

export function CurrencyGainProvider({ children }: { children: ReactNode }) {
  const [gains, setGains] = useState<Gains>({});
  const nextId = useRef(0);
  const mounted = useRef(true);
  const timers = useRef<Partial<Record<MineKind, number>>>({});
  const showGain = useCallback((currency: MineKind, amount: number) => {
    if (!mounted.current || !Number.isSafeInteger(amount) || amount <= 0) return;
    const gain = { id: ++nextId.current, amount };
    window.clearTimeout(timers.current[currency]);
    setGains((current) => ({ ...current, [currency]: gain }));
    timers.current[currency] = window.setTimeout(() => {
      setGains((current) => {
        if (current[currency]?.id !== gain.id) return current;
        return { ...current, [currency]: undefined };
      });
      delete timers.current[currency];
    }, GAIN_DURATION_MS);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const timer of Object.values(timers.current)) window.clearTimeout(timer);
    };
  }, []);

  const value = useMemo(() => ({ gains, showGain }), [gains, showGain]);
  return (
    <CurrencyGainContext.Provider value={value}>
      {children}
    </CurrencyGainContext.Provider>
  );
}

export function useCurrencyGain() {
  return useContext(CurrencyGainContext).showGain;
}

export function CurrencyGain({
  currency,
  children,
}: {
  currency: MineKind;
  children: ReactNode;
}) {
  const gain = useContext(CurrencyGainContext).gains[currency];
  if (!gain) return null;
  return (
    <span
      key={gain.id}
      className="currency-gain"
      data-currency={currency}
      role="status"
      aria-label={currency === "gold" ? "Or récupéré" : "Émeraudes récupérées"}
      aria-atomic="true"
    >
      <span>+ {gain.amount.toLocaleString("fr-FR")}</span>
      {children}
      <span className="sr-only">
        {currency === "gold" ? "pièces d’or récupérées" : "émeraudes récupérées"}
      </span>
    </span>
  );
}
