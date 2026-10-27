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
import { useRouterState } from "@tanstack/react-router";
import {
  DuelIntro,
  rememberDuelIntro,
  type DuelIntroData,
  type IntroPlayer,
} from "./duel-intro";

type StartDuel = {
  mode: NonNullable<DuelIntroData["mode"]>;
  player: IntroPlayer;
};
type Transition = StartDuel & {
  id: number;
  gameId?: string;
  data?: DuelIntroData;
  boardReady: boolean;
  onCancel?: () => Promise<unknown>;
};
type DuelTransition = {
  active: boolean;
  start: (duel: StartDuel) => void;
  match: (gameId: string, data: DuelIntroData) => void;
  boardReady: (gameId: string) => void;
  setCancellation: (onCancel?: () => Promise<unknown>) => void;
  cancel: () => void;
};

const DuelTransitionContext = createContext<DuelTransition | null>(null);

export function useDuelTransition() {
  return useContext(DuelTransitionContext);
}

/** Lives above the routes so navigation never interrupts the presentation. */
export function DuelTransitionProvider({ children }: { children: ReactNode }) {
  const [duel, setDuel] = useState<Transition | null>(null);
  const [assetsReady, setAssetsReady] = useState(false);
  const serial = useRef(0);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const start = useCallback((next: StartDuel) => {
    setAssetsReady(false);
    setDuel({ ...next, id: ++serial.current, boardReady: false });
  }, []);
  const cancel = useCallback(() => setDuel(null), []);
  const match = useCallback((gameId: string, data: DuelIntroData) => {
    setDuel((current) =>
      current
        ? {
            ...current,
            gameId,
            data,
            mode: data.mode ?? current.mode,
            onCancel: undefined,
          }
        : null,
    );
  }, []);
  const boardReady = useCallback((gameId: string) => {
    setDuel((current) =>
      current?.gameId === gameId && !current.boardReady
        ? { ...current, boardReady: true }
        : current,
    );
  }, []);
  const setCancellation = useCallback((onCancel?: () => Promise<unknown>) => {
    setDuel((current) =>
      current && !current.gameId && current.onCancel !== onCancel
        ? { ...current, onCancel }
        : current,
    );
  }, []);
  const gameId = duel?.gameId;
  const complete = useCallback(() => {
    if (gameId) rememberDuelIntro(gameId);
    setDuel(null);
  }, [gameId]);
  const cancelSearch = useCallback(async () => {
    await duel?.onCancel?.();
    // A match may have been found while the cancellation was in flight.
    setDuel((current) => (current?.gameId ? current : null));
  }, [duel?.onCancel]);

  useEffect(() => {
    if (!duel?.id) return;
    let mounted = true;
    const images = [
      "/art/duel-arena-overhead.webp",
      "/art/heroes/hero-sylve.webp",
      "/art/heroes/hero-amber.webp",
    ].map((src) => {
      const image = new Image();
      const promise = new Promise<void>((resolve) => {
        image.onload = image.onerror = () => resolve();
        image.src = src;
        if (image.complete) resolve();
      });
      return { image, promise };
    });
    void Promise.all(images.map(({ promise }) => promise)).then(() => {
      if (mounted) setAssetsReady(true);
    });
    return () => {
      mounted = false;
      images.forEach(({ image }) => {
        image.onload = image.onerror = null;
      });
    };
  }, [duel?.id]);
  useEffect(() => {
    if (
      pathname !== "/arena" &&
      pathname !== "/play" &&
      !pathname.startsWith("/game/")
    )
      cancel();
  }, [pathname, cancel]);

  const active = !!duel;
  const context = useMemo(
    () => ({ active, start, match, boardReady, setCancellation, cancel }),
    [active, start, match, boardReady, setCancellation, cancel],
  );
  const ready = !!duel?.boardReady && assetsReady;
  const message = ready
    ? "Que le duel commence"
    : duel?.data
      ? "Chargement du plateau…"
      : duel?.mode === "public"
        ? "Recherche d’un adversaire…"
        : "Préparation du duel…";

  return (
    <DuelTransitionContext.Provider value={context}>
      <div
        className="duel-transition-content"
        inert={active}
        aria-hidden={active || undefined}
      >
        {children}
      </div>
      {duel && (
        <div className="duel-transition">
          <DuelIntro
            key={duel.id}
            data={duel.data}
            player={duel.player}
            mode={duel.mode}
            ready={ready}
            message={message}
            onCancel={duel.onCancel ? cancelSearch : undefined}
            onComplete={complete}
          />
        </div>
      )}
    </DuelTransitionContext.Provider>
  );
}
