import { ArrowLeft, ArrowRight, Undo2 } from "lucide-react";
import { useRef } from "react";
import {
  HERO_HP,
  RARITY_LABELS,
  combatTypeLabel,
  getCombatType,
  isMeleeBlocked,
  legalPlacements,
  FACTION_LABELS,
  GENDER_LABELS,
  type CardDefinition,
  type GameView,
  type UnitPosition,
} from "@sylve/game";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreatureCard } from "./creature-card";
import { CreaturePortrait } from "./creature-portrait";
import { StatBadge } from "./stat-badge";
import { CardAbilities } from "./card-abilities";
import { UnitEffectIcons } from "./ability-icons";

export type DuelInspection =
  | { type: "hero"; playerIndex: number }
  | ({
      type: "card";
      card: CardDefinition;
      playerIndex: number;
    } & (
      | { source: "hand" | "deck" }
      | { source: "board"; position: UnitPosition }
    ));

export function DuelDetailsDialog({
  inspection,
  view,
  canSummon,
  canWithdraw,
  onInspect,
  onClose,
  onSelectCard,
  onWithdrawCard,
}: {
  inspection: DuelInspection | null;
  view: GameView;
  canSummon: boolean;
  canWithdraw: boolean;
  onInspect: (inspection: DuelInspection) => void;
  onClose: () => void;
  onSelectCard: (cardId: string) => void;
  onWithdrawCard: (cardId: string, position: UnitPosition) => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const player = inspection ? view.players[inspection.playerIndex] : undefined;
  const own = inspection?.playerIndex === view.me;
  const inspectedCard = inspection?.type === "card" ? inspection.card : null;
  const source = inspection?.type === "card" ? inspection.source : null;
  const unit =
    inspection?.type === "card" && inspection.source === "board"
      ? player?.board.find(
          (entry) =>
            entry.cardId === inspectedCard?.id &&
            entry.row === inspection.position.row &&
            entry.depth === inspection.position.depth,
        )
      : undefined;
  const card = unit?.card ?? inspectedCard;
  const inHand = own && player?.hand.some((entry) => entry.id === card?.id);
  const hasPlacement =
    !!card && !!player && legalPlacements(card, player.board).length > 0;
  const canChooseCell = canSummon && inHand && hasPlacement;
  const blocked =
    !!unit &&
    !!player &&
    isMeleeBlocked(
      unit,
      player.board,
      player.board.map((entry) => entry.card),
    );

  return (
    <Dialog
      modal={false}
      open={inspection !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="duel-details-dialog"
        appearance="game"
        placement={own ? "left" : "right"}
        showBackdrop={false}
        initialFocus={titleRef}
      >
        {inspection && player && (
          <>
            {card ? (
              <>
                {source === "deck" && (
                  <button
                    type="button"
                    className="text-link details-back"
                    onClick={() =>
                      onInspect({
                        type: "hero",
                        playerIndex: inspection.playerIndex,
                      })
                    }
                  >
                    <ArrowLeft size={15} />
                    Retour au héros
                  </button>
                )}
                <span className="eyebrow">
                  {source === "deck"
                    ? `DECK DE ${player.name}`
                    : unit
                      ? own
                        ? "TON COMPAGNON"
                        : "CRÉATURE ADVERSE"
                      : source === "hand"
                        ? "DANS TA MAIN"
                        : "FICHE DE CRÉATURE"}
                </span>
                <DialogTitle ref={titleRef} tabIndex={-1}>
                  {card.name}
                </DialogTitle>
                <DialogDescription>{card.title}</DialogDescription>
                <span
                  className="rarity-label"
                  data-rarity={card.rarity ?? "common"}
                >
                  {RARITY_LABELS[card.rarity ?? "common"]} · Niveau{" "}
                  {card.level ?? 1}
                </span>
                <p className="details-note card-details-role">
                  {combatTypeLabel(card)} ·{" "}
                  {getCombatType(card) === "melee"
                    ? "Déploiement au milieu ou vers l’ennemi."
                    : getCombatType(card) === "building"
                      ? "Déploiement sur toute case libre. N’attaque pas."
                      : "Déploiement au milieu ou vers ton héros."}
                  {card.faction && ` · ${FACTION_LABELS[card.faction]}`}
                  {card.gender && ` · ${GENDER_LABELS[card.gender]}`}
                </p>
                <div className="card-details-layout">
                  <div
                    className="card-details-portrait"
                    style={{ backgroundColor: `${card.color}30` }}
                  >
                    <CreaturePortrait card={card} />
                  </div>
                  <div className="card-details-copy">
                    <dl className="details-stats card-details-stats">
                      <div>
                        <dt>Attaque</dt>
                        <dd>
                          <StatBadge
                            kind="attack"
                            value={card.attack}
                            combatType={getCombatType(card)}
                          />
                        </dd>
                      </div>
                      <div>
                        <dt>{unit ? "Vie actuelle" : "Vie maximale"}</dt>
                        <dd>
                          <StatBadge
                            kind="health"
                            value={unit?.hp ?? card.health}
                            wounded={!!unit && unit.hp < card.health}
                          />
                          {unit && <span>/ {card.health}</span>}
                        </dd>
                      </div>
                    </dl>
                    {unit && (
                      <p className="details-note">
                        Ligne {unit.row + 1} ·{" "}
                        {["Avant", "Milieu", "Arrière"][unit.depth]}
                      </p>
                    )}
                    <p className="details-note">
                      {getCombatType(card) === "building"
                        ? "Ce bâtiment soutient l’alliance avec ses capacités."
                        : `Inflige ${card.attack} dégâts au premier ennemi de la rangée, sinon au héros.`}
                    </p>
                    {getCombatType(card) === "melee" && (
                      <p className="details-note">
                        {blocked
                          ? "Bloquée : un allié est devant elle sur cette rangée."
                          : "Attaque bloquée si un allié est devant."}
                      </p>
                    )}
                    {source === "board" && !unit && (
                      <p className="details-note">
                        Cette créature a quitté le terrain.
                      </p>
                    )}
                  </div>
                </div>
                {unit && (
                  <UnitEffectIcons
                    unit={unit}
                    cards={player.deck}
                    blocked={blocked}
                    detailed
                  />
                )}
                <CardAbilities card={card} />
                {inHand && source !== "board" && (
                  <div className="details-actions">
                    <p className="details-note">
                      {canChooseCell
                        ? "Choisis une case pour invoquer et lancer l’assaut."
                        : !hasPlacement
                          ? "Aucune case autorisée n’est libre pour cette carte."
                          : "L’invocation est disponible pendant ton tour."}
                    </p>
                    <button
                      type="button"
                      className="sylve-button"
                      disabled={!canChooseCell}
                      onClick={() => onSelectCard(card.id)}
                    >
                      Choisir une case <ArrowRight size={16} />
                    </button>
                  </div>
                )}
                {own && unit && (
                  <div className="details-actions">
                    <p className="details-note">
                      Libère sa case avant d’invoquer. Ta main ne change pas et
                      cette carte reste disponible aux prochains tirages.
                    </p>
                    <button
                      type="button"
                      className="sylve-button secondary"
                      disabled={!canWithdraw}
                      onClick={() =>
                        onWithdrawCard(card.id, {
                          row: unit.row,
                          depth: unit.depth,
                        })
                      }
                    >
                      <Undo2 size={16} /> Retirer du terrain
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <span className="eyebrow">
                  {own ? "TON HÉROS" : "HÉROS ADVERSE"}
                </span>
                <DialogTitle ref={titleRef} tabIndex={-1}>
                  {player.name}
                </DialogTitle>
                <DialogDescription>
                  Les caractéristiques du héros et les compagnons de son deck.
                </DialogDescription>
                <div className="hero-details-summary">
                  <img
                    src={`/art/heroes/${own ? "hero-sylve" : "hero-amber"}.webp`}
                    alt={own ? "Ton héros" : "Héros adverse"}
                    width={120}
                    height={150}
                    draggable={false}
                  />
                  <dl className="details-stats hero-details-stats">
                    <div>
                      <dt>Points de vie</dt>
                      <dd>
                        {player.heroHp} / {player.heroMaxHp ?? HERO_HP}
                      </dd>
                    </div>
                    <div>
                      <dt>Sur le terrain</dt>
                      <dd>{player.board.length}</dd>
                    </div>
                    <div>
                      <dt>En main</dt>
                      <dd>{player.handCount}</dd>
                    </div>
                    <div>
                      <dt>Dans le deck</dt>
                      <dd>{player.deck.length}</dd>
                    </div>
                  </dl>
                </div>
                <div className="section-label">
                  <h3>{own ? "Ton deck" : "Deck adverse"}</h3>
                  <span>{player.deck.length} CARTES</span>
                </div>
                <div className="details-deck">
                  {player.deck.map((entry) => (
                    <CreatureCard
                      key={entry.id}
                      card={entry}
                      compact
                      inspectable
                      onClick={() =>
                        onInspect({
                          type: "card",
                          card: entry,
                          playerIndex: inspection.playerIndex,
                          source: "deck",
                        })
                      }
                    />
                  ))}
                </div>
                <p className="details-note details-deck-note">
                  Clique sur une carte pour consulter ses caractéristiques.
                  {!own && " La main adverse reste cachée."}
                </p>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
