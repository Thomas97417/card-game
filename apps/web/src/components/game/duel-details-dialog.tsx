import { ArrowLeft, ArrowRight, Undo2 } from "lucide-react";
import {
  HERO_HP,
  combatTypeLabel,
  getCombatType,
  isMeleeBlocked,
  legalPlacements,
  type CardDefinition,
  type GameView,
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

export type DuelInspection =
  | { type: "hero"; playerIndex: number }
  | {
      type: "card";
      card: CardDefinition;
      playerIndex: number;
      source: "hand" | "board" | "deck";
    };

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
  onWithdrawCard: (cardId: string) => void;
}) {
  const player = inspection ? view.players[inspection.playerIndex] : undefined;
  const own = inspection?.playerIndex === view.me;
  const card = inspection?.type === "card" ? inspection.card : null;
  const source = inspection?.type === "card" ? inspection.source : null;
  const unit =
    source === "board"
      ? player?.board.find((entry) => entry.cardId === card?.id)
      : undefined;
  const inHand = own && player?.hand.some((entry) => entry.id === card?.id);
  const hasPlacement = !!card && !!player && legalPlacements(card, player.board).length > 0;
  const canChooseCell = canSummon && inHand && hasPlacement;
  const blocked = !!unit && !!player && isMeleeBlocked(
    unit, player.board, player.board.map((entry) => entry.card),
  );

  return (
    <Dialog
      open={inspection !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="duel-details-dialog max-w-2xl">
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
                        type: "hero", playerIndex: inspection.playerIndex,
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
                <DialogTitle>{card.name}</DialogTitle>
                <DialogDescription>{card.title}</DialogDescription>
                <p className="details-note card-details-role">
                  {combatTypeLabel(card)} · {getCombatType(card) === "melee"
                    ? "Déploiement au milieu ou vers l’ennemi."
                    : "Déploiement au milieu ou vers ton héros."}
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
                          <StatBadge kind="attack" value={card.attack} combatType={getCombatType(card)} />
                        </dd>
                      </div>
                      <div>
                        <dt>{unit ? "Points de vie" : "Points de vie max."}</dt>
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
                        Ligne {unit.row + 1} · {["Avant", "Milieu", "Arrière"][unit.depth]}
                      </p>
                    )}
                    <p className="details-note">
                      À l’assaut, inflige {card.attack} dégâts au premier ennemi
                      de sa ligne, ou au héros adverse si la voie est libre.
                    </p>
                    {getCombatType(card) === "melee" && (
                      <p className="details-note">
                        {blocked
                          ? "Bloquée : une unité au corps à corps est devant elle sur cette ligne."
                          : "Ne peut pas attaquer si une autre unité au corps à corps est devant elle sur la même ligne."}
                      </p>
                    )}
                    {source === "board" && !unit && (
                      <p className="details-note">Cette créature a quitté le terrain.</p>
                    )}
                  </div>
                </div>
                {inHand && source !== "board" && (
                  <div className="details-actions">
                    <p className="details-note">
                      {canChooseCell
                        ? "Choisis une case autorisée : l’invocation déclenche l’assaut et passe le tour à l’adversaire."
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
                      La carte retirée rejoint la défausse et pourra être repiochée.
                      Retire tes créatures avant d’invoquer : poser une carte
                      déclenche l’assaut et termine ton tour.
                    </p>
                    <button
                      type="button"
                      className="sylve-button secondary"
                      disabled={!canWithdraw}
                      onClick={() => onWithdrawCard(card.id)}
                    >
                      <Undo2 size={16} /> Retirer du terrain
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <span className="eyebrow">{own ? "TON HÉROS" : "HÉROS ADVERSE"}</span>
                <DialogTitle>{player.name}</DialogTitle>
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
                      <dd>{player.heroHp} / {HERO_HP}</dd>
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
                      <dt>Pioche</dt>
                      <dd>{player.drawCount}</dd>
                    </div>
                    <div>
                      <dt>Défausse</dt>
                      <dd>{player.discardCount}</dd>
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
                      onClick={() => onInspect({
                        type: "card",
                        card: entry,
                        playerIndex: inspection.playerIndex,
                        source: "deck",
                      })}
                    />
                  ))}
                </div>
                <p className="details-note details-deck-note">
                  Clique sur une carte pour consulter ses caractéristiques.
                  {!own && " La main adverse et l’ordre de pioche restent cachés."}
                </p>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
