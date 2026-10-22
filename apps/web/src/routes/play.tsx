import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import {
  ArrowRight,
  Check,
  Copy,
  Globe2,
  Link2,
  LoaderCircle,
  Plus,
  Swords,
  X,
} from "lucide-react";
import { CATALOG } from "@sylve/game";
import { CreaturePortrait } from "@/components/game/creature-portrait";
import {
  GameLoading,
  PageTitle,
  showGameError,
} from "@/components/game/shared";
import { requireGameAuth } from "@/lib/game-auth";

export const Route = createFileRoute("/play")({
  validateSearch: (search: Record<string, unknown>): { invite?: string } => ({
    invite:
      typeof search.invite === "string"
        ? search.invite.slice(0, 16).toUpperCase()
        : undefined,
  }),
  beforeLoad: ({ context, location }) =>
    requireGameAuth(context.isAuthenticated, location.href),
  head: () => ({ meta: [{ title: "Jouer — Sylve" }] }),
  component: PlayPage,
});

function PlayPage() {
  const navigate = useNavigate();
  const { invite } = Route.useSearch();
  const decks = useQuery(api.decks.list);
  const activity = useQuery(api.games.activity);
  const ensureStarter = useMutation(api.decks.ensureStarter);
  const createPrivate = useMutation(api.games.createPrivate);
  const joinPrivate = useMutation(api.games.joinPrivate);
  const cancelPrivate = useMutation(api.games.cancelPrivate);
  const enqueue = useMutation(api.matchmaking.enqueue);
  const cancelQueue = useMutation(api.matchmaking.cancel);
  const heartbeat = useMutation(api.matchmaking.heartbeat);
  const [deckId, setDeckId] = useState<Id<"decks"> | "">("");
  const [code, setCode] = useState(invite ?? "");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    void ensureStarter().catch(showGameError);
  }, [ensureStarter]);
  useEffect(() => {
    if (invite) setCode(invite);
  }, [invite]);
  useEffect(() => {
    if (activity?.status === "active" && activity.gameId)
      void navigate({
        to: "/game/$gameId",
        params: { gameId: activity.gameId },
      });
  }, [activity, navigate]);
  useEffect(() => {
    if (!activity?.queued) return;
    const ping = () => {
      void heartbeat().catch(showGameError);
    };
    ping();
    const interval = window.setInterval(ping, 15_000);
    return () => window.clearInterval(interval);
  }, [activity?.queued, heartbeat]);
  const selectedDeck = decks?.find((deck) => deck._id === deckId) ?? decks?.[0];
  const locked = busy || !!activity?.gameId || !!activity?.queued;
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      showGameError(error);
    } finally {
      setBusy(false);
    }
  }
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/play?invite=${activity?.inviteCode}`,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showGameError(new Error("Copie le code affiché pour inviter ton ami."));
    }
  }
  if (!decks || !activity) return <GameLoading />;
  return (
    <main className="sylve-page lobby-page">
      <PageTitle
        eyebrow="Le cercle des gardiens"
        title="Une nouvelle rencontre."
        description="Choisis tes compagnons. Trouve ton adversaire. Écris ta légende."
      />
      <div className="lobby-layout">
        <section className="deck-selection sylve-panel">
          <div className="section-label">
            <span>01 / TON DECK</span>
            <Link to="/decks">
              Mes decks <ArrowRight size={14} />
            </Link>
          </div>
          <div className="deck-stack">
            <div />
            <div />
            <div className="deck-stack-front">
              <CreaturePortrait card={CATALOG[3]!} />
              <span className="deck-seal">
                <Swords size={24} />
              </span>
            </div>
          </div>
          <label className="field-label" htmlFor="chosen-deck">
            Tes compagnons de voyage
          </label>
          <select
            id="chosen-deck"
            value={selectedDeck?._id ?? ""}
            disabled={locked}
            onChange={(event) => setDeckId(event.target.value as Id<"decks">)}
          >
            {decks.map((deck) => (
              <option key={deck._id} value={deck._id}>
                {deck.name}
              </option>
            ))}
          </select>
          <p className="muted small">
            10 cartes uniques · Toutes les cartes sont disponibles
          </p>
          <div className="deck-miniatures">
            {selectedDeck?.cardIds.slice(0, 6).map((id) => (
              <CreaturePortrait
                key={id}
                card={CATALOG.find((card) => card.id === id)!}
              />
            ))}
            <span>+4</span>
          </div>
          <Link to="/decks" className="text-link">
            Personnaliser mon deck <ArrowRight size={14} />
          </Link>
        </section>
        <section className="match-options">
          <div className="section-label">02 / TON ADVERSAIRE</div>
          <div className="match-option sylve-panel">
            <div className="option-icon">
              <Globe2 />
            </div>
            <div>
              <span className="eyebrow">À LA RENCONTRE DU MONDE</span>
              <h2>Un duel, une rencontre.</h2>
              <p className="muted">
                Affronte un autre gardien disponible. Un même terrain, les mêmes
                chances.
              </p>
            </div>
            {activity.queued ? (
              <div className="searching">
                <LoaderCircle className="animate-spin" size={18} />
                <span>À la recherche d’un adversaire…</span>
                <button
                  className="icon-button"
                  onClick={() => void action(() => cancelQueue())}
                  aria-label="Annuler la recherche"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                className="sylve-button"
                disabled={locked || !selectedDeck}
                onClick={() =>
                  selectedDeck &&
                  void action(() => enqueue({ deckId: selectedDeck._id }))
                }
              >
                Trouver un adversaire <ArrowRight size={17} />
              </button>
            )}
          </div>
          <div className="match-option sylve-panel private-option">
            <div className="option-icon">
              <Link2 />
            </div>
            <div>
              <span className="eyebrow">ENTRE AMIS</span>
              <h2>Les rivalités font les belles histoires.</h2>
              <p className="muted">
                Invite un ami à te rejoindre, ou entre son code de duel.
              </p>
            </div>
            {activity.status === "waiting" && activity.gameId ? (
              <div className="invitation-box">
                <span className="field-label">
                  Ton code · Valable 10 minutes
                </span>
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
                <span className="small muted">
                  En attente de ton adversaire…
                </span>
                <button
                  className="text-link"
                  onClick={() =>
                    void action(() =>
                      cancelPrivate({ gameId: activity.gameId! }),
                    )
                  }
                >
                  Annuler l’invitation
                </button>
              </div>
            ) : (
              <>
                <button
                  className="sylve-button secondary"
                  disabled={locked || !selectedDeck}
                  onClick={() =>
                    selectedDeck &&
                    void action(() =>
                      createPrivate({ deckId: selectedDeck._id }),
                    )
                  }
                >
                  <Plus size={17} />
                  Créer une invitation
                </button>
                <form
                  className="join-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (selectedDeck)
                      void action(async () => {
                        const gameId = await joinPrivate({
                          code,
                          deckId: selectedDeck._id,
                        });
                        await navigate({
                          to: "/game/$gameId",
                          params: { gameId },
                        });
                      });
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
                    disabled={
                      locked || code.trim().length !== 8 || !selectedDeck
                    }
                    type="submit"
                  >
                    Rejoindre <ArrowRight size={16} />
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      </div>
      <div className="lobby-note">
        <Swords size={16} />
        <p>
          Une carte par tour. Quatre lignes à défendre. Mille façons de
          surprendre.
        </p>
        <span>60 SECONDES / TOUR</span>
      </div>
    </main>
  );
}
