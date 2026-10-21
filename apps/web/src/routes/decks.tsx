import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { CATALOG, DEFAULT_DECK, DECK_SIZE } from "@sylve/game";
import { ArrowLeft, Check, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CreatureCard } from "@/components/game/creature-card";
import { CreaturePortrait } from "@/components/game/creature-portrait";
import {
  GameLoading,
  PageTitle,
  showGameError,
} from "@/components/game/shared";
import { requireGameAuth } from "@/lib/game-auth";

export const Route = createFileRoute("/decks")({
  beforeLoad: ({ context, location }) =>
    requireGameAuth(context.isAuthenticated, location.href),
  head: () => ({ meta: [{ title: "Mes decks — Sylve" }] }),
  component: DecksPage,
});
function DecksPage() {
  const decks = useQuery(api.decks.list);
  const ensureStarter = useMutation(api.decks.ensureStarter);
  const save = useMutation(api.decks.save);
  const remove = useMutation(api.decks.remove);
  const [editingId, setEditingId] = useState<Id<"decks"> | undefined>();
  const [name, setName] = useState("Mon nouveau deck");
  const [cards, setCards] = useState<string[]>([...DEFAULT_DECK]);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    void ensureStarter().catch(showGameError);
  }, [ensureStarter]);
  const count = cards.length;
  async function submit() {
    setBusy(true);
    try {
      const id = await save({ deckId: editingId, name, cardIds: cards });
      setEditingId(id);
      toast.success("Ton deck est prêt pour le duel.");
    } catch (error) {
      showGameError(error);
    } finally {
      setBusy(false);
    }
  }
  if (!decks) return <GameLoading />;
  return (
    <main className="sylve-page">
      <Link to="/play" className="text-link back-link">
        <ArrowLeft size={15} />
        Retour au salon
      </Link>
      <PageTitle
        eyebrow="Le grimoire"
        title="De belles alliances."
        description="Dix compagnons, un destin commun. Compose le deck qui te ressemble."
      />
      <div className="deck-builder-layout">
        <section>
          <div className="section-label">
            <span>LE BESTIAIRE</span>
            <span>12 CRÉATURES · TOUTES DISPONIBLES</span>
          </div>
          <div className="catalog-grid">
            {CATALOG.map((card) => (
              <CreatureCard
                key={card.id}
                card={card}
                selected={cards.includes(card.id)}
                disabled={
                  busy || (!cards.includes(card.id) && count >= DECK_SIZE)
                }
                onClick={() =>
                  setCards((previous) =>
                    previous.includes(card.id)
                      ? previous.filter((id) => id !== card.id)
                      : [...previous, card.id],
                  )
                }
              />
            ))}
          </div>
        </section>
        <aside className="builder-sidebar">
          <div className="sylve-panel">
            <div className="section-label">
              <span>MES DECKS</span>
              <button
                className="icon-button"
                aria-label="Créer un nouveau deck"
                disabled={busy}
                onClick={() => {
                  setEditingId(undefined);
                  setName("Mon nouveau deck");
                  setCards([]);
                  setConfirmDelete(false);
                }}
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="saved-decks">
              {decks.map((deck) => (
                <button
                  key={deck._id}
                  disabled={busy}
                  className={editingId === deck._id ? "active" : ""}
                  onClick={() => {
                    setEditingId(deck._id);
                    setName(deck.name);
                    setCards([...deck.cardIds]);
                    setConfirmDelete(false);
                  }}
                >
                  <span>{deck.name}</span>
                  <span>
                    {editingId === deck._id ? <Check size={15} /> : "10"}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="sylve-panel deck-editor">
            <div className="section-label">
              <span>{editingId ? "MODIFIER LE DECK" : "NOUVEAU DECK"}</span>
              <span className={count === DECK_SIZE ? "count-ready" : ""}>
                {count}/{DECK_SIZE}
              </span>
            </div>
            <label className="field-label" htmlFor="deck-name">
              Nom du deck
            </label>
            <input
              id="deck-name"
              maxLength={60}
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
            <p className="small muted">
              Sélectionne 10 cartes différentes dans le bestiaire.
            </p>
            <div className="selected-cards">
              {cards.map((id) => {
                const card = CATALOG.find((entry) => entry.id === id)!;
                return (
                  <button
                    disabled={busy}
                    key={id}
                    onClick={() =>
                      setCards((previous) =>
                        previous.filter((entry) => entry !== id),
                      )
                    }
                    aria-label={`Retirer ${card.name}`}
                  >
                    <CreaturePortrait card={card} />
                    <span>{card.name}</span>
                    <span>
                      {card.attack} / {card.health}
                    </span>
                    <span aria-hidden="true">×</span>
                  </button>
                );
              })}
            </div>
            <button
              className="sylve-button"
              onClick={() => void submit()}
              disabled={count !== DECK_SIZE || !name.trim() || busy}
            >
              <Save size={16} />
              {busy ? "Enregistrement…" : "Enregistrer le deck"}
            </button>
            {editingId && (
              <button
                className="text-link danger"
                disabled={busy}
                onClick={async () => {
                  if (!confirmDelete) {
                    setConfirmDelete(true);
                    return;
                  }
                  setBusy(true);
                  try {
                    await remove({ deckId: editingId });
                    setEditingId(undefined);
                    setCards([]);
                    setName("Mon nouveau deck");
                    setConfirmDelete(false);
                    toast.success("Deck supprimé.");
                  } catch (error) {
                    showGameError(error);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Trash2 size={14} />
                {confirmDelete
                  ? "Confirmer la suppression"
                  : "Supprimer ce deck"}
              </button>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
