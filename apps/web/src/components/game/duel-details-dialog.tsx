import { ArrowLeft, ArrowRight, Undo2 } from "lucide-react";
import { useRef } from "react";
import type { CSSProperties } from "react";
import {
  HERO_HP,
  RARITY_LABELS,
  combatTypeLabel,
  getCombatType,
  isMeleeBlocked,
  legalPlacements,
  FACTION_LABELS,
  fieldBonus,
  fieldMarkName,
  unitCard,
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
import { StatBadge, statChange } from "./stat-badge";
import { CardAbilities } from "./card-abilities";
import { UnitEffectIcons } from "./ability-icons";
import { FieldMark, type FieldMarkKind } from "./field-mark";
import { HeroPowerList } from "./hero-power-list";

export type DuelInspection =
  | { type: "hero"; playerIndex: number }
  | {
      type: "field";
      kind: FieldMarkKind;
      playerIndex: number;
      position: UnitPosition;
    }
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
  const baseCard = unit && player ? unitCard(unit, player.deck) : card;
  const neutral = card?.kind === "field-building";
  const fieldMark =
    inspection?.type === "field"
      ? inspection.kind === "rune"
        ? player?.runes?.find(
            (mark) =>
              mark.row === inspection.position.row &&
              mark.depth === inspection.position.depth,
          )
        : player?.pentagrams?.find(
            (mark) =>
              mark.row === inspection.position.row &&
              mark.depth === inspection.position.depth,
          )
      : undefined;
  const inHand = own && player?.hand.some((entry) => entry.id === card?.id);
  const bonus = fieldMark ? fieldBonus(fieldMark) : undefined;
  const occupiedRune = unit && player?.runes?.find((mark) => mark.row === unit.row && mark.depth === unit.depth);
  const occupiedPentagram = unit && player?.pentagrams?.find((mark) => mark.row === unit.row && mark.depth === unit.depth);
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
        className={`duel-details-dialog ${inspection?.type === "hero" ? "hero-details-dialog" : ""}`}
        style={
          inspection?.type === "hero"
            ? ({ "--hero-deck-count": player?.deck.length ?? 4 } as CSSProperties)
            : undefined
        }
        data-power-pile={view.status === "active" && view.players[view.me]?.heroLevel !== undefined}
        appearance="game"
        placement={own ? "left" : "right"}
        showBackdrop={false}
        initialFocus={titleRef}
      >
        {inspection && player && (
          <>
            {inspection.type === "field" ? (
              <>
                <span className="eyebrow">
                  SCEAU DU TERRAIN · {inspection.kind === "rune" ? "BONUS À L’ARRIVÉE" : "BONUS À CHAQUE TOUR"}
                </span>
                <DialogTitle ref={titleRef} tabIndex={-1}>
                  {fieldMark ? fieldMarkName(inspection.kind, fieldMark) : "Sceau disparu"}
                </DialogTitle>
                <DialogDescription>
                  {bonus?.stat === "health"
                    ? "La sève des anciens protège ce lieu."
                    : "Une force oubliée attend son prochain porteur."}
                </DialogDescription>
                {fieldMark && bonus ? (
                  <>
                    <div className="field-mark-preview">
                      <FieldMark
                        kind={inspection.kind}
                        stat={bonus.stat}
                        amount={bonus.value}
                        activated={"activated" in fieldMark && fieldMark.activated === true}
                      />
                    </div>
                    <p className="details-note">
                      {inspection.kind === "rune"
                        ? "L’unité qui apparaît sur cette case gagne immédiatement, une seule fois, "
                        : "L’unité sur cette case gagne à chaque début de son tour "}
                      <strong>
                        {bonus.stat === "health"
                          ? `+${bonus.value} PV actuels et maximum`
                          : `+${bonus.value} attaque`}
                      </strong>.
                      {inspection.kind === "pentagram" && " Aucun bonus n’est accordé à la pose. Les gains se cumulent à chaque tour."}
                    </p>
                    <p className="details-note">
                      Le sceau reste lié à son porteur et disparaît à sa mort ou à son retrait.
                      {inspection.kind === "rune"
                        ? " La rune ne se réactive pas aux tours suivants."
                        : " Les bonus précédemment gagnés restent acquis tant que le porteur reste en jeu."}
                      {"activated" in fieldMark && fieldMark.activated === true && " Cette rune a déjà accordé son bonus."}
                    </p>
                  </>
                ) : (
                  <p className="details-note">Ce sceau a quitté le terrain avec son porteur.</p>
                )}
              </>
            ) : card ? (
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
                    : neutral
                      ? "BÂTIMENT NEUTRE"
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
                  {neutral
                    ? "Élément du terrain · Destructible"
                    : `${RARITY_LABELS[card.rarity ?? "common"]} · Niveau ${card.level ?? 1}`}
                </span>
                <p className="details-note card-details-role">
                  {combatTypeLabel(card)} ·{" "}
                  {neutral
                    ? "Présent dès le début du combat. N’attaque pas."
                    : getCombatType(card) === "melee"
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
                            baseValue={baseCard?.attack}
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
                            baseValue={baseCard?.health}
                            wounded={!!unit && unit.hp < card.health}
                          />
                          {unit && (
                            <span
                              className="stat-limit"
                              data-stat-change={statChange(card.health, baseCard?.health)}
                              title={`Vie maximale normale : ${baseCard?.health}`}
                            >
                              / {card.health}
                            </span>
                          )}
                        </dd>
                      </div>
                    </dl>
                    {unit && (
                      <p className="details-note">
                        Ligne {unit.row + 1} ·{" "}
                        {["Avant", "Milieu", "Arrière"][unit.depth]}
                      </p>
                    )}
                    {unit && (occupiedRune || occupiedPentagram) && (
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => onInspect({
                          type: "field",
                          kind: occupiedRune ? "rune" : "pentagram",
                          playerIndex: inspection.playerIndex,
                          position: { row: unit.row, depth: unit.depth },
                        })}
                      >
                        {fieldMarkName(occupiedRune ? "rune" : "pentagram", (occupiedRune ?? occupiedPentagram)!)}
                        {occupiedRune ? " · bonus déjà accordé" : " · bonus cumulatif au début du tour"}
                      </button>
                    )}
                    <p className="details-note">
                      {neutral
                        ? "Bloque sa case et intercepte les attaques de sa ligne. Sa destruction libère la case. Il ne fait pas partie du deck et ne peut pas être retiré."
                        : getCombatType(card) === "building"
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
                {own && unit && !neutral && (
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
                <DialogTitle ref={titleRef} tabIndex={-1}>
                  {player.name}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Caractéristiques, pouvoirs et deck de {player.name}.
                </DialogDescription>
                <div className="hero-details-summary">
                  <img
                    src={`/art/heroes/${own ? "hero-sylve" : "hero-amber"}.webp`}
                    alt={player.name}
                    width={120}
                    height={150}
                    draggable={false}
                  />
                  <dl className="details-stats hero-details-stats">
                    {player.heroLevel !== undefined && (
                      <>
                        <div>
                          <dt>Niveau</dt>
                          <dd>{player.heroLevel}</dd>
                        </div>
                        <div>
                          <dt>Puissance</dt>
                          <dd>{player.heroMight}</dd>
                        </div>
                      </>
                    )}
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
                {player.heroLevel !== undefined && (
                  <HeroPowerList
                    level={player.heroLevel}
                    uses={player.heroAbilityUses}
                    turn={view.turn}
                    inBattle
                  />
                )}
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
