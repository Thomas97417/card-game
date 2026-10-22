import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  DECK_SIZE,
  MIN_DECK_SIZE,
  HAND_SIZE,
  getCombatType,
  isDeploymentDepth,
  legalPlacements,
  type CardDefinition,
  type GameView,
  type GameEvent,
  type CardRarity,
  type UnitPosition,
} from "@sylve/game";
import {
  ArrowLeft,
  ArrowRight,
  CircleHelp,
  Flag,
  Hourglass,
  Leaf,
  Trophy,
  RotateCcw,
  Bot,
} from "lucide-react";
import { DuelArena } from "./duel-arena";
import { CreatureCard } from "./creature-card";
import { CreaturePortrait } from "./creature-portrait";
import { DuelDetailsDialog, type DuelInspection } from "./duel-details-dialog";
import { GameLoading, showGameError } from "./shared";
import { CHEST_LABELS, VICTORY_CHEST_WINS } from "@sylve/game/progression";
import { useCombatPlayback } from "./use-combat-playback";

export type DuelData = GameView & {
  events: GameEvent[];
  mode?: "solo" | "public" | "private";
  reward?: {
    status: "awarded" | "lost";
    rarity?: CardRarity;
    victoryWins?: number;
  } | null;
};
interface DuelScreenProps {
  data: DuelData;
  onPlayCard: (
    cardId: string,
    row: number,
    depth: number,
    turn: number,
  ) => Promise<unknown>;
  onWithdrawCard: (
    cardId: string,
    turn: number,
    position: UnitPosition,
  ) => Promise<unknown>;
  onEndTurn: (turn: number) => Promise<unknown>;
  onSurrender: () => Promise<unknown>;
  practice?: boolean;
  onRestart?: () => void;
  onPlaybackSettled?: (sequence: number) => void;
}

export function DuelScreen({
  data,
  onPlayCard,
  onWithdrawCard,
  onEndTurn,
  onSurrender,
  practice = false,
  onRestart,
  onPlaybackSettled,
}: DuelScreenProps) {
  const { display, event: combatEvent, playing } = useCombatPlayback(data);
  const [now, setNow] = useState(Date.now());
  const [selected, setSelected] = useState<string | null>(null);
  const [inspection, setInspection] = useState<DuelInspection | null>(null);
  const [pending, setPending] = useState(false);
  const [drag, setDrag] = useState<{
    card: CardDefinition;
    x: number;
    y: number;
  } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const origin = useRef<{
    card: CardDefinition;
    x: number;
    y: number;
    active: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const surrenderDialog = useRef<HTMLDialogElement>(null);
  const rulesDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (practice) return;
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [practice]);
  useEffect(() => {
    setSelected(null);
  }, [data?.turn, data?.hasSummoned]);
  const catchingUp = playing || display?.sequence !== data.sequence;
  useEffect(() => {
    if (!catchingUp) onPlaybackSettled?.(data.sequence);
  }, [catchingUp, data.sequence, onPlaybackSettled]);
  if (!display) return <GameLoading />;
  const mine = display.players[data.me]!;
  const enemy = display.players[1 - data.me]!;
  const myTurn = data.activePlayer === data.me;
  const seconds = practice
    ? Infinity
    : Math.max(0, Math.ceil((data.turnEndsAt - now) / 1000));
  const canSummon =
    myTurn &&
    !data.hasSummoned &&
    !pending &&
    !catchingUp &&
    seconds > 0 &&
    data.status === "active";
  const canEnd = myTurn && !pending && !catchingUp && data.status === "active";
  const canWithdraw = canEnd && seconds > 0;
  const hasPlacement = mine.hand.some(
    (card) => legalPlacements(card, mine.board).length > 0,
  );
  const selectedCard = mine.hand.find((card) => card.id === selected);
  const cardName = (id: string | undefined) =>
    display.players
      .flatMap((player) => player.deck)
      .find((card) => card.id === id)?.name ?? "une créature";
  const selectedUnit =
    inspection?.type === "card" &&
    inspection.source === "board" &&
    inspection.playerIndex === data.me
      ? `${inspection.position.row}-${inspection.position.depth}`
      : null;
  function inspect(next: DuelInspection) {
    setSelected(null);
    setInspection(next);
  }
  async function withdrawCard(cardId: string, position: UnitPosition) {
    if (
      !canWithdraw ||
      !mine.board.some(
        (unit) =>
          unit.cardId === cardId &&
          unit.row === position.row &&
          unit.depth === position.depth,
      )
    )
      return;
    setPending(true);
    try {
      await onWithdrawCard(cardId, data.turn, position);
      setInspection(null);
    } catch (error) {
      showGameError(error);
    } finally {
      setPending(false);
    }
  }
  async function place(cardId: string, row: number, depth: number) {
    const card = mine.hand.find((entry) => entry.id === cardId);
    if (!canSummon || !card || !isDeploymentDepth(card, depth)) return;
    setPending(true);
    try {
      await onPlayCard(cardId, row, depth, data.turn);
      setSelected(null);
    } catch (error) {
      showGameError(error);
    } finally {
      setPending(false);
    }
  }
  async function finish() {
    if (!canEnd || seconds <= 0) return;
    setPending(true);
    try {
      await onEndTurn(data.turn);
    } catch (error) {
      showGameError(error);
    } finally {
      setPending(false);
    }
  }
  const cellAt = (x: number, y: number, card: CardDefinition) => {
    const cell = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-own-cell]");
    return cell && isDeploymentDepth(card, Number(cell.dataset.depth))
      ? cell
      : null;
  };
  function pointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    card: CardDefinition,
  ) {
    if (
      !canSummon ||
      !legalPlacements(card, mine.board).length ||
      event.button !== 0
    )
      return;
    origin.current = {
      card,
      x: event.clientX,
      y: event.clientY,
      active: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: ReactPointerEvent) {
    const source = origin.current;
    if (!source) return;
    if (Math.hypot(event.clientX - source.x, event.clientY - source.y) > 7)
      source.active = true;
    if (!source.active) return;
    setSelected(source.card.id);
    setDrag({ card: source.card, x: event.clientX, y: event.clientY });
    const cell = cellAt(event.clientX, event.clientY, source.card);
    setHovered(cell ? `${cell.dataset.row}-${cell.dataset.depth}` : null);
  }
  function pointerUp(event: ReactPointerEvent) {
    const source = origin.current;
    if (source?.active) {
      suppressClick.current = true;
      const cell = cellAt(event.clientX, event.clientY, source.card);
      if (cell)
        void place(
          source.card.id,
          Number(cell.dataset.row),
          Number(cell.dataset.depth),
        );
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }
    origin.current = null;
    setDrag(null);
    setHovered(null);
  }
  const statusText =
    data.status === "finished"
      ? "Le duel est terminé"
      : playing
        ? "Les créatures passent à l’action…"
        : myTurn
          ? "À toi de jouer. Une carte déclenche l’assaut."
          : practice
            ? "Le Gardien mécanique prépare sa stratégie…"
            : "Ton adversaire prépare sa stratégie…";
  return (
    <main
      className="game-room"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setSelected(null);
        }
      }}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={() => {
        origin.current = null;
        setDrag(null);
        setHovered(null);
      }}
    >
      <div className="game-toolbar">
        <Link to="/play" className="text-link">
          <ArrowLeft size={15} />
          Salon
        </Link>
        <span className="eyebrow">
          {data.mode === "solo"
            ? "COMBAT SOLO"
            : practice
              ? "TERRAIN D’ENTRAÎNEMENT"
              : "LE CERCLE DE LA SYLVE"}
        </span>
        <div>
          {onRestart && (
            <button
              className="icon-button"
              aria-label="Recommencer l’entraînement"
              title="Recommencer l’entraînement"
              onClick={onRestart}
            >
              <RotateCcw size={18} />
            </button>
          )}
          <button
            className="icon-button"
            aria-label="Lire les règles"
            onClick={() => rulesDialog.current?.showModal()}
          >
            <CircleHelp size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Abandonner la partie"
            disabled={data.status !== "active" || pending}
            onClick={() => surrenderDialog.current?.showModal()}
          >
            <Flag size={17} />
          </button>
        </div>
      </div>
      {practice && (
        <aside className="practice-banner">
          <Bot size={22} />
          <div>
            <strong>Entraîne-toi à ton rythme.</strong>
            <span>
              Affronte le Gardien mécanique, teste tes placements et recommence
              librement. Tu joues en premier.
            </span>
          </div>
          <span className="practice-badge">SANS CHRONOMÈTRE</span>
        </aside>
      )}
      <div className="duel-status">
        <span className={`turn-dot ${myTurn ? "active" : ""}`} />
        <span role="status">{statusText}</span>
        <span className="turn-number">TOUR {data.turn}</span>
      </div>
      <DuelArena
        mine={mine}
        enemy={enemy}
        me={data.me}
        turn={data.turn}
        selected={selected}
        selectedUnit={selectedUnit}
        hovered={hovered}
        canSummon={canSummon}
        combatEvent={combatEvent}
        onPlace={(cardId, row, depth) => void place(cardId, row, depth)}
        onInspectUnit={(unit, playerIndex) => {
          inspect({
            type: "card",
            card: unit.card,
            playerIndex,
            source: "board",
            position: { row: unit.row, depth: unit.depth },
          });
        }}
        onInspectHero={(playerIndex) => inspect({ type: "hero", playerIndex })}
      />
      <section className="hand-area">
        <div className="hand-heading">
          <div>
            <span className="eyebrow">TES COMPAGNONS</span>
            <span className="small muted">
              {canSummon && selectedCard
                ? getCombatType(selectedCard) === "melee"
                  ? "Corps à corps : colonne du milieu ou colonne vers l’ennemi."
                  : "À distance : colonne du milieu ou colonne vers ton héros."
                : canSummon
                  ? "Glisse une carte, ou ouvre sa fiche. La poser déclenche l’assaut."
                  : `Chaque carte jouée est remplacée. ${HAND_SIZE} cartes en main, sans doublon.`}
            </span>
          </div>
          <span className="small muted">
            {mine.hand.length} / {HAND_SIZE}
          </span>
        </div>
        <div className="hand-and-actions">
          <div className="player-hand">
            {mine.hand.map((card) => (
              <CreatureCard
                key={card.id}
                card={card}
                compact
                inspectable
                selected={selected === card.id}
                onPointerDown={(event) => pointerDown(event, card)}
                onClick={() => {
                  if (!suppressClick.current) {
                    inspect({
                      type: "card",
                      card,
                      playerIndex: data.me,
                      source: "hand",
                    });
                  }
                }}
              />
            ))}
            {mine.hand.length === 0 && (
              <p className="empty-hand">
                Tous tes compagnons sont sur le terrain. Les cartes des monstres
                vaincus reviendront dans ta pioche.
              </p>
            )}
          </div>
          <div className="turn-actions">
            <div className={`turn-clock ${seconds <= 10 ? "urgent" : ""}`}>
              {practice ? <Bot size={18} /> : <Hourglass size={16} />}
              <span>
                {practice
                  ? "À ton rythme"
                  : data.status === "finished"
                    ? "—"
                    : `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`}
              </span>
            </div>
            {myTurn &&
              data.status === "active" &&
              (!hasPlacement || data.hasSummoned) && (
                <button
                  className="sylve-button"
                  disabled={!canEnd || seconds <= 0}
                  onClick={() => void finish()}
                >
                  {pending ? "Un instant…" : "Attaquer sans invoquer"}
                  <ArrowRight size={16} />
                </button>
              )}
            <span className="small muted">
              {myTurn && !hasPlacement
                ? "Aucun placement possible. Retire une unité ou lance l’assaut."
                : "Les attaques sont automatiques dès qu’une carte est posée."}
            </span>
          </div>
        </div>
      </section>
      <details className="combat-history">
        <summary>Journal du duel</summary>
        <ol>
          {data.events
            .filter((entry) => entry.type === "attack")
            .slice(-8)
            .reverse()
            .map((entry) => (
              <li key={entry.seq}>
                {cardName(entry.cardId)} inflige {entry.damage} dégâts{" "}
                {entry.targetCardId
                  ? `à ${cardName(entry.targetCardId)}`
                  : "au héros adverse"}
                .
              </li>
            ))}
        </ol>
      </details>
      {data.status === "finished" && !catchingUp && (
        <div className="result-overlay">
          <section className="result-card" role="status">
            <div className="result-icon">
              {data.winner === data.me ? (
                <Trophy size={40} />
              ) : (
                <Leaf size={40} />
              )}
            </div>
            <span className="eyebrow">LE CERCLE A TRANCHÉ</span>
            <h1>
              {data.winner === data.me
                ? "La victoire est tienne."
                : "Une autre histoire t’attend."}
            </h1>
            <p>
              {data.winner === data.me
                ? "Tes compagnons ont fait honneur à la forêt."
                : "Chaque duel est une leçon. La forêt n’a pas dit son dernier mot."}
            </p>
            {data.winner === data.me && data.reward && (
              <div className="duel-reward" role="status">
                {data.reward.status === "awarded" && data.reward.rarity ? (
                  <>
                    <img
                      src={`/art/chests/${data.reward.rarity}.webp`}
                      alt=""
                      width={100}
                      height={100}
                    />
                    <span>
                      <strong>
                        Coffre {CHEST_LABELS[data.reward.rarity].toLowerCase()}{" "}
                        gagné !
                      </strong>
                      Il se déverrouille dans ton salon.
                    </span>
                  </>
                ) : (
                  <span>
                    <strong>Emplacements pleins</strong>Le coffre de combat est
                    perdu. Ouvre tes coffres pour libérer une place.
                  </span>
                )}
              </div>
            )}
            {data.winner === data.me &&
              data.reward?.victoryWins !== undefined && (
                <p className="duel-victory-progress" role="status">
                  Coffre commun : {data.reward.victoryWins}/{VICTORY_CHEST_WINS}{" "}
                  victoires
                  {data.reward.victoryWins >= VICTORY_CHEST_WINS
                    ? " · Prêt à ouvrir dans le salon !"
                    : " · Chaque victoire solo compte."}
                </p>
              )}
            {onRestart && (
              <button
                className="sylve-button practice-replay"
                onClick={onRestart}
              >
                <RotateCcw size={16} />
                Rejouer contre l’ordinateur
              </button>
            )}
            <Link
              to="/play"
              className={`sylve-button ${practice ? "secondary" : ""}`}
            >
              Retour au salon <ArrowRight size={16} />
            </Link>
          </section>
        </div>
      )}
      {drag && (
        <div className="drag-preview" style={{ left: drag.x, top: drag.y }}>
          <CreaturePortrait card={drag.card} />
          <span>{drag.card.name}</span>
        </div>
      )}
      <DuelDetailsDialog
        inspection={inspection}
        view={display}
        canSummon={canSummon}
        canWithdraw={canWithdraw}
        onInspect={setInspection}
        onClose={() => setInspection(null)}
        onSelectCard={(cardId) => {
          const card = mine.hand.find((entry) => entry.id === cardId);
          if (!canSummon || !card || !legalPlacements(card, mine.board).length)
            return;
          setSelected(cardId);
          setInspection(null);
        }}
        onWithdrawCard={(cardId, position) =>
          void withdrawCard(cardId, position)
        }
      />
      <dialog
        className="sylve-dialog"
        ref={surrenderDialog}
        aria-labelledby="surrender-title"
      >
        <h2 id="surrender-title">Quitter le cercle ?</h2>
        <p>Ton adversaire remportera ce duel.</p>
        <form method="dialog">
          <button className="sylve-button secondary">Continuer le duel</button>
          <button
            className="sylve-button"
            disabled={pending}
            onClick={() => {
              setPending(true);
              void onSurrender()
                .catch(showGameError)
                .finally(() => setPending(false));
            }}
          >
            Abandonner
          </button>
        </form>
      </dialog>
      <dialog
        className="sylve-dialog"
        ref={rulesDialog}
        aria-labelledby="rules-title"
      >
        <h2 id="rules-title">Les règles du cercle</h2>
        <p>
          Invoque un monstre sur une case libre : tes unités attaquent aussitôt,
          de l’avant vers l’arrière, ligne par ligne, puis le tour passe à
          l’adversaire. Elles ciblent le premier ennemi en face, sinon son
          héros.
        </p>
        <p>
          Ton camp compte trois colonnes et quatre lignes. La colonne du milieu
          est accessible aux deux types d’unités. Les unités au corps à corps
          peuvent aussi se placer dans la colonne vers l’ennemi ; celles à
          distance dans la colonne vers ton héros. Une unité au corps à corps
          derrière une autre unité au corps à corps sur la même ligne ne peut
          pas agir. Les unités à distance peuvent attaquer depuis l’arrière.
        </p>
        <p>
          Pas de déplacement ni de riposte. Ton deck contient de {MIN_DECK_SIZE}{" "}
          à {DECK_SIZE} cartes uniques. Chaque carte jouée est immédiatement
          remplacée pour garder {HAND_SIZE} cartes en main. Le tirage peut
          redonner la carte que tu viens de poser, même si elle est encore sur
          le terrain. Une même carte ne peut pas être présente deux fois dans ta
          main.{" "}
          {practice
            ? "Prends tout le temps qu’il te faut pour réfléchir."
            : "Tu as 60 secondes pour agir."}
        </p>
        <p>
          Pour retirer une créature pendant ton tour, sélectionne-la sur le
          terrain puis choisis « Retirer du terrain ». Seule cette créature
          quitte sa case ; ta main ne change pas. Fais tes retraits avant de
          jouer ta carte. Si aucun placement n’est possible, « Attaquer sans
          invoquer » permet de continuer le combat.
        </p>
        <p>Le premier héros à 0 PV perd le duel.</p>
        <form method="dialog">
          <button className="sylve-button">J’ai compris</button>
        </form>
      </dialog>
    </main>
  );
}
