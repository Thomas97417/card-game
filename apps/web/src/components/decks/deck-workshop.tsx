import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Link, useBlocker } from "@tanstack/react-router";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import {
  CATALOG,
  DECK_SIZE,
  combatTypeLabel,
  getCombatType,
} from "@sylve/game";
import type { CardDefinition, CombatType } from "@sylve/game";
import {
  ArrowRightLeft,
  BowArrow,
  ChevronLeft,
  ChevronRight,
  Layers3,
  Leaf,
  ListFilter,
  Sword,
  X,
} from "lucide-react";
import { CreaturePortrait } from "@/components/game/creature-portrait";
import { StatBadge } from "@/components/game/stat-badge";
import { useDeckAutosave } from "@/hooks/use-deck-autosave";

export interface WorkshopDeck {
  _id: Id<"decks">;
  name: string;
  cardIds: string[];
}

interface Draft {
  id: Id<"decks">;
  name: string;
  cards: string[];
}

interface DeckWorkshopProps {
  deck: WorkshopDeck | undefined;
  onSave: (args: {
    deckId: Id<"decks">;
    name: string;
    cardIds: string[];
  }) => Promise<Id<"decks">>;
}

const deckDraft = (deck: WorkshopDeck): Draft => ({
  id: deck._id,
  name: deck.name,
  cards: [...deck.cardIds],
});
const instructions =
  "Glisse une carte de la collection sur une carte de ton deck pour la remplacer.";

function CardArtwork({ card }: { card: CardDefinition }) {
  const ranged = getCombatType(card) === "ranged";
  const Icon = ranged ? BowArrow : Sword;
  return (
    <>
      <span className="workshop-card-art">
        <span className="workshop-card-halo" />
        <CreaturePortrait card={card} />
      </span>
      <span className="card-stats">
        <StatBadge
          kind="attack"
          value={card.attack}
          combatType={getCombatType(card)}
        />
        <StatBadge kind="health" value={card.health} />
      </span>
      <span className="workshop-card-caption">
        <span className="workshop-card-name">{card.name}</span>
        <span className="workshop-card-type">
          <Icon size={11} aria-hidden="true" />
          {ranged ? "Distance" : "Corps à corps"}
        </span>
      </span>
    </>
  );
}

export function DeckWorkshop({ deck, onSave }: DeckWorkshopProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState<CombatType | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [message, setMessage] = useState(instructions);
  const [hovered, setHovered] = useState<number | null>(null);
  const [drag, setDrag] = useState<{
    card: CardDefinition;
    x: number;
    y: number;
  } | null>(null);
  const root = useRef<HTMLElement>(null);
  const currentRow = useRef<HTMLDivElement>(null);
  const collectionRow = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const origin = useRef<{
    card: CardDefinition;
    x: number;
    y: number;
    active: boolean;
    pointerId: number;
    target: HTMLButtonElement;
  } | null>(null);

  const lastValidName = useRef("");
  const { status, initialize, enqueue, flush, hasPendingChanges } =
    useDeckAutosave(onSave);

  useEffect(() => {
    if (!deck || draft) return;
    setDraft(deckDraft(deck));
    lastValidName.current = deck.name;
    initialize({
      deckId: deck._id,
      name: deck.name,
      cardIds: [...deck.cardIds],
    });
  }, [deck, draft, initialize]);

  useBlocker({
    shouldBlockFn: async () => !(await flush()),
    enableBeforeUnload: hasPendingChanges,
  });

  const ready = !!deck && draft !== null;
  const cards = draft?.cards ?? [];
  const available = CATALOG.filter((card) => !cards.includes(card.id));
  const visible = available.filter(
    (card) => !filter || getCombatType(card) === filter,
  );
  const selectedCard = CATALOG.find((card) => card.id === picked);

  function cancelDrag() {
    const source = origin.current;
    origin.current = null;
    if (source?.target.hasPointerCapture?.(source.pointerId))
      source.target.releasePointerCapture(source.pointerId);
    setDrag(null);
    setHovered(null);
  }

  function updateDraft(next: Draft) {
    setDraft(next);
    if (next.name.trim()) lastValidName.current = next.name.trim();
    enqueue({
      deckId: next.id,
      name: lastValidName.current,
      cardIds: [...next.cards],
    });
  }

  function replaceCard(cardId: string, slot: number) {
    if (!draft || slot < 0 || slot >= draft.cards.length) return;
    const replaced = CATALOG.find((card) => card.id === draft.cards[slot]);
    const incoming = CATALOG.find((card) => card.id === cardId);
    if (!incoming || incoming.id === replaced?.id) return;
    const next = [...draft.cards];
    const existing = next.indexOf(cardId);
    if (existing !== -1) next[existing] = next[slot]!;
    next[slot] = cardId;
    updateDraft({ ...draft, cards: next });
    setPicked(null);
    setMessage(
      existing === -1
        ? `${incoming.name} remplace ${replaced?.name}. Ton deck se met à jour automatiquement.`
        : `${incoming.name} et ${replaced?.name} ont échangé leur place.`,
    );
  }

  function slotAt(x: number, y: number) {
    const target = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-deck-slot]");
    return target && root.current?.contains(target)
      ? Number(target.dataset.deckSlot)
      : null;
  }

  function pointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    card: CardDefinition,
  ) {
    if (!ready || event.button !== 0 || event.isPrimary === false) return;
    suppressClick.current = false;
    origin.current = {
      card,
      x: event.clientX,
      y: event.clientY,
      active: false,
      pointerId: event.pointerId,
      target: event.currentTarget,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: ReactPointerEvent<HTMLElement>) {
    const source = origin.current;
    if (!source || source.pointerId !== event.pointerId) return;
    if (
      !source.active &&
      Math.hypot(event.clientX - source.x, event.clientY - source.y) < 7
    )
      return;
    source.active = true;
    suppressClick.current = true;
    setPicked(null);
    setDrag({ card: source.card, x: event.clientX, y: event.clientY });
    setHovered(slotAt(event.clientX, event.clientY));
    const row = currentRow.current;
    if (row) {
      const bounds = row.getBoundingClientRect();
      if (event.clientY >= bounds.top && event.clientY <= bounds.bottom) {
        if (event.clientX < bounds.left + 36) row.scrollLeft -= 18;
        else if (event.clientX > bounds.right - 36) row.scrollLeft += 18;
      }
    }
  }

  function pointerUp(event: ReactPointerEvent<HTMLElement>) {
    const source = origin.current;
    if (!source || source.pointerId !== event.pointerId) return;
    if (source.active) {
      const slot = slotAt(event.clientX, event.clientY);
      if (slot !== null) replaceCard(source.card.id, slot);
    }
    cancelDrag();
  }

  function chooseCard(card: CardDefinition, slot?: number) {
    if (picked && slot !== undefined) {
      if (picked === card.id) {
        setPicked(null);
        setMessage(instructions);
      } else replaceCard(picked, slot);
      return;
    }
    const next = picked === card.id ? null : card.id;
    setPicked(next);
    setMessage(
      next
        ? `${card.name} : choisis une carte du deck à ${slot === undefined ? "remplacer" : "échanger"}. Échap pour annuler.`
        : instructions,
    );
  }

  function scrollRow(row: HTMLDivElement | null, direction: number) {
    row?.scrollBy({
      left: direction * row.clientWidth * 0.7,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  function renderCard(card: CardDefinition, slot?: number) {
    const target =
      slot !== undefined && hovered === slot && drag?.card.id !== card.id;
    return (
      <div
        key={slot ?? card.id}
        className="workshop-card-slot"
        data-deck-slot={slot}
      >
        <button
          type="button"
          className={`workshop-card ${picked === card.id ? "is-picked" : ""} ${drag?.card.id === card.id ? "is-dragging" : ""} ${target ? "is-target" : ""}`}
          style={{ "--creature-color": card.color } as CSSProperties}
          disabled={!ready}
          aria-label={`${card.name}, ${combatTypeLabel(card)}, ${card.attack} attaque, ${card.health} points de vie, ${slot === undefined ? "dans la collection" : `carte ${slot + 1} du deck`}`}
          aria-pressed={picked === card.id}
          aria-describedby="workshop-instructions"
          onPointerDown={(event) => pointerDown(event, card)}
          onClick={() => chooseCard(card, slot)}
          onDragStart={(event) => event.preventDefault()}
        >
          <CardArtwork card={card} />
          {slot !== undefined && (
            <span className="workshop-card-number" aria-hidden="true">
              {String(slot + 1).padStart(2, "0")}
            </span>
          )}
          {target && (
            <span className="workshop-drop-label">
              <ArrowRightLeft size={14} />
              {cards.includes(drag!.card.id) ? "Échanger" : "Remplacer"}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <main
      ref={root}
      className={`deck-workshop ${drag ? "is-dragging" : ""}`}
      onPointerDownCapture={() => {
        suppressClick.current = false;
      }}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={cancelDrag}
      onLostPointerCapture={cancelDrag}
      onClickCapture={(event) => {
        if (suppressClick.current && event.detail !== 0) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          suppressClick.current = !!origin.current?.active;
          cancelDrag();
          setPicked(null);
          setMessage(instructions);
        }
      }}
    >
      <img
        className="workshop-background"
        src="/art/deck-workshop.webp"
        alt=""
        fetchPriority="high"
        draggable={false}
      />
      <div className="workshop-shade" />

      <header className="workshop-header">
        <Link
          to="/hub"
          className="workshop-back"
          aria-label="Retour au refuge"
          draggable={false}
        >
          <img
            src="/art/ui/back-arrow.webp"
            alt=""
            width={288}
            height={157}
            draggable={false}
          />
        </Link>
        <h1 className="workshop-title">L’atelier des gardiens</h1>
      </header>

      <div className="workshop-content">
        <section
          className="workshop-current"
          aria-labelledby="current-deck-title"
          aria-busy={!ready}
        >
          <div className="workshop-deck-toolbar">
            <div className="workshop-deck-identity">
              <div className="workshop-section-kicker">
                <h2 id="current-deck-title">TON DECK</h2>
                <span>
                  {cards.length}/{DECK_SIZE} cartes
                </span>
              </div>
              <label className="sr-only" htmlFor="workshop-deck-name">
                Nom du deck
              </label>
              <input
                id="workshop-deck-name"
                value={draft?.name ?? "Chargement du grimoire…"}
                maxLength={60}
                onBlur={() => {
                  if (draft)
                    updateDraft({
                      ...draft,
                      name: draft.name.trim() || lastValidName.current,
                    });
                }}
                disabled={!ready}
                onChange={(event) => {
                  if (draft)
                    updateDraft({ ...draft, name: event.target.value });
                }}
              />
            </div>
          </div>

          <div
            className="workshop-card-row"
            ref={currentRow}
            tabIndex={0}
            role="region"
            aria-label="Cartes du deck"
          >
            {ready
              ? cards.map((id, slot) => {
                  const card = CATALOG.find((entry) => entry.id === id);
                  return card ? renderCard(card, slot) : null;
                })
              : Array.from({ length: DECK_SIZE }, (_, index) => (
                  <div className="workshop-card-placeholder" key={index}>
                    <Leaf size={30} />
                  </div>
                ))}
          </div>
          <div className="workshop-deck-footnote">
            <span
              aria-live="polite"
              role={status === "error" ? "alert" : undefined}
            >
              <span
                className={`workshop-ready-dot ${status === "saving" ? "is-dirty" : status === "error" ? "is-error" : ""}`}
              />
              {!ready
                ? "Ouverture du grimoire…"
                : status === "saving"
                  ? "Enregistrement automatique…"
                  : status === "error"
                    ? "Connexion interrompue · nouvelle tentative automatique…"
                    : "Modifications enregistrées automatiquement"}
            </span>
            <div className="workshop-scroll-controls">
              <button
                aria-label="Voir les cartes précédentes du deck"
                onClick={() => scrollRow(currentRow.current, -1)}
              >
                <ChevronLeft size={17} />
              </button>
              <button
                aria-label="Voir les cartes suivantes du deck"
                onClick={() => scrollRow(currentRow.current, 1)}
              >
                <ChevronRight size={17} />
              </button>
            </div>
            <span className="workshop-unique-note">
              {DECK_SIZE} compagnons · une alliance
            </span>
          </div>
        </section>

        <section
          className="workshop-collection"
          aria-labelledby="collection-title"
        >
          <div className="workshop-collection-heading">
            <div>
              <span className="workshop-section-kicker">LE BESTIAIRE</span>
              <h2 id="collection-title">
                Ta collection{" "}
                <span>
                  {ready ? `${visible.length} / ${available.length}` : "—"}
                </span>
              </h2>
            </div>
            <div className="workshop-collection-hint">
              <ArrowRightLeft size={16} />
              <span>Une nouvelle carte, une nouvelle alliance.</span>
            </div>
            <div className="workshop-scroll-controls">
              <button
                aria-label="Voir les cartes précédentes de la collection"
                onClick={() => scrollRow(collectionRow.current, -1)}
              >
                <ChevronLeft size={17} />
              </button>
              <button
                aria-label="Voir les cartes suivantes de la collection"
                onClick={() => scrollRow(collectionRow.current, 1)}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
          <div
            className="workshop-card-row"
            ref={collectionRow}
            tabIndex={0}
            role="region"
            aria-label="Cartes de la collection"
          >
            {ready && visible.map((card) => renderCard(card))}
            {ready && visible.length === 0 && (
              <div className="workshop-empty">
                <Leaf size={26} />
                <p>
                  Aucune carte{" "}
                  {filter === "melee" ? "au corps à corps" : "à distance"} dans
                  la réserve.
                </p>
                <button onClick={() => setFilter(null)}>
                  Voir toute la collection
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      <footer className="workshop-footer">
        <div
          className="workshop-filters"
          role="group"
          aria-label="Filtrer la collection"
        >
          <span className="workshop-filter-label">
            <ListFilter size={16} />
            <span>FILTRES</span>
          </span>
          {(
            [
              { type: null, label: "Toutes", icon: Layers3 },
              { type: "melee", label: "Corps à corps", icon: Sword },
              { type: "ranged", label: "À distance", icon: BowArrow },
            ] as const
          ).map(({ type, label, icon: Icon }) => (
            <button
              key={type ?? "all"}
              type="button"
              className={filter === type ? "is-active" : ""}
              aria-pressed={filter === type}
              disabled={!ready}
              onClick={() => {
                setFilter(filter === type ? null : type);
                setPicked(null);
                setMessage(instructions);
              }}
            >
              <Icon size={19} strokeWidth={1.6} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <p
          id="workshop-instructions"
          className={`workshop-instructions ${selectedCard ? "has-selection" : ""}`}
          role="status"
          aria-live="polite"
        >
          <ArrowRightLeft size={17} />
          <span>{message}</span>
          {selectedCard && (
            <button
              aria-label="Annuler la sélection"
              onClick={() => {
                setPicked(null);
                setMessage(instructions);
              }}
            >
              <X size={15} />
            </button>
          )}
        </p>
      </footer>

      {drag && (
        <div
          className="workshop-drag-preview"
          aria-hidden="true"
          style={
            {
              left: drag.x,
              top: drag.y,
              "--creature-color": drag.card.color,
            } as CSSProperties
          }
        >
          <div className="workshop-card">
            <CardArtwork card={drag.card} />
          </div>
        </div>
      )}
    </main>
  );
}
