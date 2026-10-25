import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Link, useBlocker } from "@tanstack/react-router";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import {
  CATALOG,
  DECK_SIZE,
  RARITIES,
  RARITY_LABELS,
  combatTypeLabel,
  getCombatType,
} from "@sylve/game";
import type {
  CardDefinition,
  CombatType,
  CardRarity,
  OwnedCard,
} from "@sylve/game";
import { CardUpgradeDialog } from "./card-upgrade-dialog";
import { CardArtwork } from "./card-artwork";
import { HeroProgressSummary } from "@/components/guardian/hero-progress-summary";
import type { HeroProgress } from "@/components/guardian/guardian-house";
import type { CardProgressionActions } from "./card-soulbind";
import { ArrowRightLeft, Check, Leaf, ListFilter, X } from "lucide-react";
import { CollectionIcon, GameIcon } from "@/components/game/game-icon";
import { useDeckAutosave } from "@/hooks/use-deck-autosave";
import { useHorizontalDrag } from "@/hooks/use-horizontal-drag";
import { GameHeader } from "@/components/game-header";
import { useHorizontalWheel } from "@/hooks/use-horizontal-wheel";
import {
  DECK_SLOT_UNLOCKS,
  leagueAt,
  leagueProgress,
  type LeagueProgress,
} from "@sylve/game/leagues";

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

interface DeckWorkshopProps extends CardProgressionActions {
  hero?: HeroProgress;
  league?: LeagueProgress;
  deck: WorkshopDeck | undefined;
  collection: OwnedCard[] | undefined;
  onUpgrade: (variantId: string) => Promise<unknown>;
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

export function DeckWorkshop({
  league = leagueProgress(0),
  deck,
  collection,
  onSave,
  onUpgrade,
  soulProgress,
  onSoulbind,
  onSacrifice,
  onEvolve,
  hero,
}: DeckWorkshopProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState<CombatType | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [inspected, setInspected] = useState<string | null>(null);
  const [rarityFilters, setRarityFilters] = useState<CardRarity[]>([]);
  const [message, setMessage] = useState(instructions);
  const [hovered, setHovered] = useState<number | null>(null);
  const [drag, setDrag] = useState<{
    card: CardDefinition;
    x: number;
    y: number;
    width: number;
  } | null>(null);
  const root = useRef<HTMLElement>(null);
  const currentRow = useRef<HTMLDivElement>(null);
  const collectionRow = useRef<HTMLDivElement>(null);
  const deckPan = useHorizontalDrag(true, { ignoreInteractiveElements: true });
  const collectionPan = useHorizontalDrag(true, {
    ignoreInteractiveElements: true,
  });
  useHorizontalWheel(currentRow);
  useHorizontalWheel(collectionRow);
  const suppressClick = useRef(false);
  const origin = useRef<{
    card: CardDefinition;
    x: number;
    y: number;
    width: number;
    active: boolean;
    pointerId: number;
    target: HTMLButtonElement;
  } | null>(null);

  const { status, initialize, enqueue, flush, hasPendingChanges } =
    useDeckAutosave(onSave);

  useEffect(() => {
    if (!deck || draft) return;
    setDraft(deckDraft(deck));
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

  const ready = !!deck && draft !== null && !!collection;
  const cards = draft?.cards ?? [];
  const entries = new Map(collection?.map((entry) => [entry.card.id, entry]));
  const available = (collection ?? [])
    .map((entry) => entry.card)
    .filter((card) => !cards.includes(card.id));
  const visible = available
    .filter(
      (card) =>
        (!filter || getCombatType(card) === filter) &&
        (rarityFilters.length === 0 ||
          rarityFilters.includes(card.rarity ?? "common")),
    )
    .sort(
      (a, b) =>
        RARITIES.indexOf(b.rarity ?? "common") -
        RARITIES.indexOf(a.rarity ?? "common"),
    );
  const selectedCard = picked ? entries.get(picked)?.card : undefined;

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
    enqueue({
      deckId: next.id,
      name: next.name,
      cardIds: [...next.cards],
    });
  }

  function replaceCard(cardId: string, slot: number) {
    if (!draft || slot < 0 || slot >= league.deckCapacity) return;
    const replaced = entries.get(draft.cards[slot] ?? "")?.card;
    const incoming = entries.get(cardId)?.card;
    if (!incoming || incoming.id === replaced?.id) return;
    const next = [...draft.cards];
    const existing = next.indexOf(cardId);
    if (slot >= next.length) {
      if (existing !== -1) next.splice(existing, 1);
      next.push(cardId);
    } else {
      if (existing !== -1) next[existing] = next[slot]!;
      next[slot] = cardId;
    }
    updateDraft({ ...draft, cards: next });
    setPicked(null);
    setMessage(
      !replaced
        ? `${incoming.name} rejoint ton deck.`
        : existing === -1
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
      width: event.currentTarget.getBoundingClientRect().width,
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
    // Let horizontal touch gestures scroll the row; vertical gestures still
    // move cards between the collection and the deck.
    if (
      !source.active &&
      event.pointerType === "touch" &&
      Math.abs(event.clientX - source.x) > Math.abs(event.clientY - source.y)
    ) {
      suppressClick.current = true;
      cancelDrag();
      return;
    }
    source.active = true;
    suppressClick.current = true;
    setPicked(null);
    setDrag({
      card: source.card,
      x: event.clientX,
      y: event.clientY,
      width: source.width,
    });
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
    setInspected(card.id);
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
          data-rarity={card.rarity ?? "common"}
          style={{ "--creature-color": card.color } as CSSProperties}
          disabled={!ready}
          aria-label={`${card.name}, ${combatTypeLabel(card)}, ${card.attack} attaque, ${card.health} points de vie, ${RARITY_LABELS[card.rarity ?? "common"]}, niveau ${card.level ?? 1}, ${slot === undefined ? "dans la collection" : `carte ${slot + 1} du deck`}`}
          aria-haspopup={picked ? undefined : "dialog"}
          aria-describedby="workshop-instructions"
          onPointerDown={(event) => pointerDown(event, card)}
          onClick={() => chooseCard(card, slot)}
          onDragStart={(event) => event.preventDefault()}
        >
          <CardArtwork card={card} copies={entries.get(card.id)?.copies} />
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
      aria-label="Deck et collection"
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

      <GameHeader league={ready ? league : undefined} />
      {ready && hero && (
        <HeroProgressSummary progress={hero} />
      )}

      <div className="workshop-content">
        <section
          className="workshop-current"
          aria-label="Ton deck"
          aria-busy={!ready}
        >
          <div
            {...deckPan.dragHandlers}
            className={`workshop-card-row ${deckPan.isDragging ? "is-panning" : ""}`}
            ref={currentRow}
            tabIndex={0}
            role="region"
            aria-label="Cartes du deck"
          >
            {ready
              ? Array.from({ length: DECK_SIZE }, (_, slot) => {
                  if (slot >= league.deckCapacity) {
                    const unlock = DECK_SLOT_UNLOCKS.find(
                      (entry) => entry.slot === slot + 1,
                    )!;
                    return (
                      <div
                        key={`locked-${slot}`}
                        className="workshop-card-slot"
                      >
                        <div
                          className="workshop-card-placeholder workshop-locked-slot"
                          role="img"
                          aria-label={`Emplacement ${slot + 1} verrouillé, débloqué en ${leagueAt(unlock.trophies).label} à ${unlock.trophies} trophées`}
                        >
                          <img
                            src="/art/ui/slot-chains.webp"
                            alt=""
                            width={512}
                            height={512}
                            draggable={false}
                          />
                          <span>
                            {leagueAt(unlock.trophies).label}
                            <small>{unlock.trophies} trophées</small>
                          </span>
                        </div>
                      </div>
                    );
                  }
                  const card = entries.get(cards[slot] ?? "")?.card;
                  return card ? (
                    renderCard(card, slot)
                  ) : (
                    <div
                      key={`empty-${slot}`}
                      className="workshop-card-slot"
                      data-deck-slot={slot}
                    >
                      <button
                        type="button"
                        className={`workshop-card-placeholder workshop-empty-slot ${hovered === slot ? "is-target" : ""}`}
                        aria-label={`Emplacement ${slot + 1} libre`}
                        onClick={() => {
                          if (picked) replaceCard(picked, slot);
                        }}
                      >
                        <CollectionIcon size={27} />
                        <span>Emplacement libre</span>
                      </button>
                    </div>
                  );
                })
              : Array.from({ length: DECK_SIZE }, (_, index) => (
                  <div className="workshop-card-placeholder" key={index}>
                    <Leaf size={30} />
                  </div>
                ))}
          </div>
        </section>

        <section
          className="workshop-collection"
          aria-labelledby="collection-title"
        >
          <div className="workshop-collection-heading">
            <div>
              <h2 id="collection-title">
                Ta collection{" "}
                <span>
                  {ready
                    ? `${collection!.length} / ${CATALOG.length * RARITIES.length}`
                    : "—"}
                </span>
              </h2>
            </div>
          </div>
          <div
            {...collectionPan.dragHandlers}
            className={`workshop-card-row ${collectionPan.isDragging ? "is-panning" : ""}`}
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
                  {available.length === 0
                    ? "Remporte des combats et ouvre des coffres pour agrandir ta collection."
                    : "Aucune carte ne correspond à tes filtres."}
                </p>
                {available.length ? (
                  <button
                    onClick={() => {
                      setFilter(null);
                      setRarityFilters([]);
                    }}
                  >
                    Voir toute la collection
                  </button>
                ) : (
                  <Link to="/arena" className="text-link">
                    Rejoindre l’arène
                  </Link>
                )}
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
              { type: null, label: "Toutes" },
              { type: "melee", label: "Corps à corps" },
              { type: "ranged", label: "À distance" },
              { type: "building", label: "Bâtiments" },
            ] as const
          ).map(({ type, label }) => (
            <button
              key={type ?? "all"}
              type="button"
              className={
                filter === type && (type !== null || rarityFilters.length === 0)
                  ? "is-active"
                  : ""
              }
              aria-pressed={
                filter === type && (type !== null || rarityFilters.length === 0)
              }
              disabled={!ready}
              onClick={() => {
                setFilter(filter === type ? null : type);
                if (type === null) setRarityFilters([]);
                setPicked(null);
                setMessage(instructions);
              }}
            >
              <GameIcon kind={type ?? "all"} size={25} />
              <span>{label}</span>
            </button>
          ))}
          <div
            className="workshop-rarity-filters"
            role="group"
            aria-label="Filtrer par rareté"
          >
            {RARITIES.map((rarity) => {
              const active = rarityFilters.includes(rarity);
              const label = RARITY_LABELS[rarity];
              return (
                <button
                  key={rarity}
                  type="button"
                  className={`workshop-rarity-toggle ${active ? "is-active" : ""}`}
                  data-rarity={rarity}
                  data-tooltip={label}
                  aria-label={label}
                  aria-pressed={active}
                  disabled={!ready}
                  onClick={() => {
                    setRarityFilters((current) =>
                      current.includes(rarity)
                        ? current.filter((value) => value !== rarity)
                        : [...current, rarity],
                    );
                    setPicked(null);
                    setMessage(instructions);
                  }}
                >
                  <img
                    src={`/art/ui/rarity-${rarity}.webp`}
                    alt=""
                    width={34}
                    height={44}
                    draggable={false}
                  />
                  {active && (
                    <span className="workshop-rarity-check" aria-hidden="true">
                      <Check size={10} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <p
          id="workshop-instructions"
          className={`workshop-instructions ${selectedCard ? "has-selection" : ""}`}
          role={status === "error" ? "alert" : "status"}
          aria-label="Conseils pour ton deck"
          aria-live="polite"
        >
          <ArrowRightLeft size={17} />
          <span>
            {status === "error"
              ? "Enregistrement interrompu · nouvelle tentative automatique…"
              : message}
          </span>
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
              width: drag.width,
              "--creature-color": drag.card.color,
            } as CSSProperties
          }
        >
          <div
            className="workshop-card"
            data-rarity={drag.card.rarity ?? "common"}
          >
            <CardArtwork
              card={drag.card}
              copies={entries.get(drag.card.id)?.copies}
            />
          </div>
        </div>
      )}
      <CardUpgradeDialog
        entry={inspected ? entries.get(inspected) : undefined}
        inDeck={!!inspected && cards.includes(inspected)}
        hasSpace={cards.length < league.deckCapacity}
        onClose={() => setInspected(null)}
        onUpgrade={onUpgrade}
        collection={collection}
        soulProgress={soulProgress}
        onSoulbind={onSoulbind}
        onSacrifice={onSacrifice}
        onEvolve={onEvolve}
        onAdd={() => {
          if (inspected) replaceCard(inspected, cards.length);
          setInspected(null);
        }}
        onMove={() => {
          setPicked(inspected);
          setInspected(null);
          setMessage(
            "Choisis une carte du deck à remplacer ou à échanger. Échap pour annuler.",
          );
        }}
      />
    </main>
  );
}
