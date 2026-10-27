import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { ArrowRight, Check, Copy, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DeckCompletionNotice,
  PlayLobby,
  type LobbyChest,
} from "@/components/play/play-lobby";
import { ChestUnlockDialog } from "@/components/play/chest-unlock-dialog";
import { useEmeraldBalance } from "@/components/emerald-balance";
import {
  ChestRevealDialog,
  type ChestReveal,
} from "@/components/play/chest-reveal-dialog";
import { showGameError } from "@/components/game/shared";
import { requireGameAuth } from "@/lib/game-auth";
import { useDuelTransition } from "@/components/game/duel-transition";
import { shouldShowDuelIntro } from "@/components/game/duel-intro";

export const Route = createFileRoute("/arena")({
  validateSearch: (search: Record<string, unknown>): { invite?: string } => ({
    invite:
      typeof search.invite === "string"
        ? search.invite.slice(0, 16).toUpperCase()
        : undefined,
  }),
  beforeLoad: ({ context, location }) =>
    requireGameAuth(context.isAuthenticated, location.href),
  head: () => ({
    meta: [{ title: "L’arène des gardiens — Sylve" }],
    links: [
      { rel: "preload", as: "image", href: "/art/play-lobby.webp" },
      { rel: "prefetch", as: "image", href: "/art/heroes/hero-amber.webp" },
      { rel: "prefetch", as: "image", href: "/art/duel-arena-overhead.webp" },
    ],
  }),
  component: ArenaPage,
});

function ArenaPage() {
  const emeralds = useEmeraldBalance();
  const navigate = useNavigate();
  const transition = useDuelTransition();
  const { invite } = Route.useSearch();
  const decks = useQuery(api.decks.list);
  const activity = useQuery(api.games.activity);
  const user = useQuery(api.auth.getCurrentUser);
  const openingGameId = activity?.status === "active" ? activity.gameId : null;
  // The presentation already covers the arena while the live duel loads.
  const openingGame = useQuery(
    api.games.get,
    openingGameId ? { gameId: openingGameId } : "skip",
  );
  const treasures = useQuery(api.chests.list);
  const league = useQuery(api.collection.league);
  const ensureStarter = useMutation(api.decks.ensureStarter);
  const createSolo = useMutation(api.games.createSolo);
  const createPrivate = useMutation(api.games.createPrivate);
  const joinPrivate = useMutation(api.games.joinPrivate);
  const cancelPrivate = useMutation(api.games.cancelPrivate);
  const enqueue = useMutation(api.matchmaking.enqueue);
  const cancelQueue = useMutation(api.matchmaking.cancel);
  const heartbeat = useMutation(api.matchmaking.heartbeat);
  const openChest = useMutation(api.chests.open);
  const openVictory = useMutation(api.chests.openVictory);
  const [code, setCode] = useState(invite ?? "");
  const [busy, setBusy] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [privateOpen, setPrivateOpen] = useState(!!invite);
  const [reward, setReward] = useState<ChestReveal | null>(null);
  const collection = useQuery(api.collection.list, reward ? {} : "skip");
  const upgrade = useMutation(api.collection.upgrade);
  const [selectedChest, setSelectedChest] = useState<LobbyChest | null>(null);
  const actionLock = useRef(false);
  const opening = useRef<string | null>(null);
  const cancelSearch = useCallback(() => cancelQueue(), [cancelQueue]);
  const [now, setNow] = useState(0);
  useEffect(() => {
    let mounted = true;
    void ensureStarter()
      .then(() => {
        if (mounted) setInitialized(true);
      })
      .catch(showGameError);
    return () => {
      mounted = false;
    };
  }, [ensureStarter]);
  useEffect(() => {
    if (invite) {
      setCode(invite);
      setPrivateOpen(true);
    }
  }, [invite]);
  useEffect(() => {
    if (activity?.status === "waiting") setPrivateOpen(true);
  }, [activity?.status]);
  useEffect(() => {
    if (!openingGameId || !openingGame || opening.current === openingGameId)
      return;
    opening.current = openingGameId;
    if (transition) {
      if (
        !transition.active &&
        shouldShowDuelIntro(openingGameId, openingGame)
      ) {
        transition.start({
          mode: openingGame.mode ?? "private",
          player: { name: user?.name ?? "Toi" },
        });
      }
      transition.match(openingGameId, openingGame);
    }
    setPrivateOpen(false);
    void navigate({
      to: "/game/$gameId",
      params: { gameId: openingGameId },
    }).catch((error) => {
      transition?.cancel();
      showGameError(error);
    });
  }, [openingGameId, openingGame, navigate, transition, user?.name]);
  useEffect(() => {
    if (activity?.queued && transition && !transition.active) {
      transition.start({
        mode: "public",
        player: { name: user?.name ?? "Toi" },
      });
    }
    transition?.setCancellation(activity?.queued ? cancelSearch : undefined);
  }, [activity?.queued, transition, user?.name, cancelSearch]);
  useEffect(() => {
    if (!activity?.queued) return;
    const ping = () => {
      void heartbeat().catch(showGameError);
    };
    ping();
    const interval = window.setInterval(ping, 15_000);
    return () => window.clearInterval(interval);
  }, [activity?.queued, heartbeat]);
  useEffect(() => {
    if (!treasures) return;
    const serverTime = treasures.serverNow;
    const started = Date.now();
    const tick = () => setNow(serverTime + Date.now() - started);
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [treasures?.serverNow]);
  const deck = decks?.[0];
  const locked = busy || !!activity?.gameId || !!activity?.queued;
  const ready = initialized && !!deck && !!activity && !!treasures && !!league;
  const deckComplete =
    !!deck && !!league && deck.cardIds.length === league.deckCapacity;
  async function action(fn: () => Promise<unknown>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      showGameError(error);
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  function beginCombat(
    mode: "solo" | "public" | "private",
    fn: () => Promise<unknown>,
  ) {
    if (actionLock.current) return;
    setPrivateOpen(false);
    transition?.start({ mode, player: { name: user?.name ?? "Toi" } });
    void action(async () => {
      try {
        await fn();
      } catch (error) {
        transition?.cancel();
        throw error;
      }
    });
  }
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/arena?invite=${activity?.inviteCode}`,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showGameError(new Error("Copie le code affiché pour inviter ton ami."));
    }
  }
  const open = (chest: LobbyChest) => {
    if (chest.unlockAt > now) {
      setSelectedChest(chest);
      return;
    }
    void action(async () => {
      setReward(await openChest({ chestId: chest._id as Id<"chests"> }));
    });
  };
  return (
    <PlayLobby
      league={league}
      deckSize={deck?.cardIds.length ?? 0}
      chests={treasures?.chests ?? []}
      purchasedChestSlots={treasures?.purchasedSlots}
      victoryChest={treasures?.victoryChest}
      now={now}
      ready={ready}
      busy={busy}
      locked={locked}
      queued={activity?.queued ?? false}
      onSolo={() => {
        if (deck && deckComplete)
          beginCombat("solo", () => createSolo({ deckId: deck._id }));
      }}
      onPublic={() => {
        if (deck && deckComplete)
          beginCombat("public", () => enqueue({ deckId: deck._id }));
      }}
      onPrivate={() => setPrivateOpen(true)}
      onCancelQueue={() => {
        void action(() => cancelQueue());
      }}
      onOpenChest={open}
      onOpenVictoryChest={() => {
        if (treasures)
          void action(async () => {
            setReward(
              await openVictory({ cycle: treasures.victoryChest.cycle }),
            );
          });
      }}
    >
      <Dialog open={privateOpen} onOpenChange={setPrivateOpen}>
        <DialogContent className="friendly-dialog">
          <span className="play-eyebrow">ENTRE GARDIENS</span>
          <DialogTitle>Un défi entre amis.</DialogTitle>
          <DialogDescription>
            Partage une invitation ou saisis le code de ton ami. Ces duels sont
            amicaux et ne rapportent ni coffre ni trophées.
          </DialogDescription>
          {ready && league && !deckComplete && (
            <DeckCompletionNotice
              deckSize={deck?.cardIds.length ?? 0}
              capacity={league.deckCapacity}
            />
          )}
          {activity?.status === "waiting" && activity.gameId ? (
            <div className="invitation-box">
              <span className="field-label">Ton code · Valable 10 minutes</span>
              <div className="invitation-code">
                {activity.inviteCode}
                <button
                  className="icon-button"
                  onClick={() => void copyInvite()}
                  aria-label="Copier le lien d’invitation"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
              <p>En attente de ton adversaire…</p>
              <button
                className="sylve-button secondary"
                disabled={busy}
                onClick={() =>
                  void action(() => cancelPrivate({ gameId: activity.gameId! }))
                }
              >
                Annuler l’invitation
              </button>
            </div>
          ) : (
            <div className="friendly-actions">
              <button
                className="sylve-button"
                disabled={locked || !deckComplete}
                onClick={() => {
                  if (deck && deckComplete)
                    void action(() => createPrivate({ deckId: deck._id }));
                }}
              >
                <Plus size={17} />
                Créer une invitation
              </button>
              <form
                className="join-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (deck && deckComplete)
                    beginCombat("private", () =>
                      joinPrivate({ code, deckId: deck._id }),
                    );
                }}
              >
                <label className="sr-only" htmlFor="invite-code">
                  Code d’invitation
                </label>
                <input
                  id="invite-code"
                  placeholder="Code de ton ami"
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.toUpperCase())
                  }
                  maxLength={8}
                  autoComplete="off"
                />
                <button
                  className="sylve-button secondary"
                  disabled={locked || code.trim().length !== 8 || !deckComplete}
                  type="submit"
                >
                  Rejoindre
                  <ArrowRight size={16} />
                </button>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ChestRevealDialog
        reward={reward}
        collection={collection}
        onUpgrade={(variantId) => upgrade({ variantId })}
        onClose={() => setReward(null)}
      />
      <ChestUnlockDialog
        chest={selectedChest}
        now={now}
        emeralds={emeralds}
        busy={busy}
        onClose={() => setSelectedChest(null)}
        onOpen={(maxEmeralds) => {
          if (selectedChest)
            void action(async () => {
              setReward(
                await openChest({
                  chestId: selectedChest._id as Id<"chests">,
                  maxEmeralds,
                }),
              );
              setSelectedChest(null);
            });
        }}
      />
    </PlayLobby>
  );
}
