import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  DECK_SIZE,
  MIN_DECK_SIZE,
  HAND_SIZE,
  isDeploymentDepth,
  legalPlacements,
  type CardDefinition,
  type GameView,
  type GameEvent,
  type CardRarity,
  type UnitPosition,
} from "@sylve/game";
import {
  ArrowRight,
  CircleHelp,
  Flag,
  Hourglass,
  History,
  Layers,
  Leaf,
  RotateCcw,
  Bot,
} from "lucide-react";
import { DuelArena } from "./duel-arena";
import { CreatureCard } from "./creature-card";
import { CreaturePortrait } from "./creature-portrait";
import { AbilityIcon, eventIconKind } from "./ability-icons";
import { AbilityLegend } from "./ability-legend";
import { DuelDetailsDialog, type DuelInspection } from "./duel-details-dialog";
import { GameLoading, showGameError } from "./shared";
import { CHEST_LABELS, VICTORY_CHEST_WINS } from "@sylve/game/progression";
import { useCombatPlayback } from "./use-combat-playback";
import { LeagueResult, TrophyIcon } from "@/components/leagues/league-progress";
import type { TrophyChange } from "@sylve/game/leagues";

export type DuelData = GameView & {
  events: GameEvent[];
  mode?: "solo" | "public" | "private";
  trophyChange?: TrophyChange | null;
  reward?: {
    status: "awarded" | "lost";
    rarity?: CardRarity;
    victoryWins?: number;
    trophies?: number;
    trophiesTotal?: number;
    previousTrophies?: number;
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
  const historyDialog = useRef<HTMLDialogElement>(null);
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
  const cardName = (id: string | undefined) =>
    display.players
      .flatMap((player) => player.deck)
      .find((card) => card.id === id)?.name ??
    display.players
      .flatMap((player) => player.board)
      .find((unit) => unit.cardId === id)?.card.name ??
    data.events.find((e) => e.cardId === id && e.unit?.definition)?.unit
      ?.definition?.name ??
    "une créature";
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
    catchingUp || (data.status === "active" && data.hasSummoned)
      ? "L’assaut"
      : data.status === "finished"
        ? "Duel terminé"
        : myTurn
          ? "À toi de jouer"
          : practice
            ? "Le Gardien réfléchit…"
            : "Tour adverse";
  return (
    <main
      className="game-room"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setSelected(null);
          origin.current = null;
          setDrag(null);
          setHovered(null);
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
        <div className="duel-status">
          <span
            className={`turn-dot ${myTurn && !catchingUp && !data.hasSummoned ? "active" : ""}`}
          />
          <span role="status">{statusText}</span>
          <span className="turn-number">Tour {display.turn}</span>
          <span
            className={`turn-clock ${seconds <= 10 ? "urgent" : ""}`}
            aria-label={practice ? "Sans chronomètre" : "Temps restant"}
            title={practice ? "Sans chronomètre" : "Temps restant"}
          >
            {practice ? <Bot size={14} /> : <Hourglass size={13} />}
            {practice
              ? "∞"
              : data.status === "finished"
                ? "—"
                : `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`}
          </span>
        </div>
        <div className="game-tools">
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
            title="Lire les règles"
            onClick={() => rulesDialog.current?.showModal()}
          >
            <CircleHelp size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Journal du duel"
            title="Journal du duel"
            onClick={() => historyDialog.current?.showModal()}
          >
            <History size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Abandonner la partie"
            title="Abandonner la partie"
            disabled={data.status !== "active" || pending}
            onClick={() => surrenderDialog.current?.showModal()}
          >
            <Flag size={17} />
          </button>
        </div>
      </div>
      <DuelArena
        mine={mine}
        enemy={enemy}
        me={data.me}
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
      <section className="hand-area" aria-label="Ta main">
        <button
          type="button"
          className="hand-deck"
          aria-label="Voir mon deck"
          title="Voir mon deck"
          aria-haspopup="dialog"
          onClick={() => inspect({ type: "hero", playerIndex: data.me })}
        >
          <Layers size={22} strokeWidth={1.3} />
          <span>{mine.deck.length}</span>
        </button>
        <div className="player-hand" data-inactive={!canSummon}>
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
            <p className="empty-hand">Aucune carte en main.</p>
          )}
        </div>
        <div className="turn-actions">
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
        </div>
      </section>
      <dialog
        className="sylve-dialog game-dialog combat-history"
        ref={historyDialog}
        aria-labelledby="history-title"
      >
        <h2 id="history-title">Journal du duel</h2>
        <ol>
          {data.events
            .filter(
              (entry) => entry.type === "attack" || entry.type === "ability",
            )
            .slice(-12)
            .reverse()
            .map((entry) => (
              <li key={entry.seq}>
                {eventIconKind(entry) && (
                  <AbilityIcon kind={eventIconKind(entry)!} />
                )}
                <span>
                  {entry.type === "ability" ? (
                    `${cardName(entry.cardId)} · ${entry.ability}${entry.amount ? ` (${entry.amount > 0 ? "+" : ""}${entry.amount})` : ""}`
                  ) : (
                    <>
                      {cardName(entry.cardId)} inflige {entry.damage} dégâts{" "}
                      {entry.targetCardId
                        ? `à ${cardName(entry.targetCardId)}`
                        : "au héros adverse"}
                      .
                    </>
                  )}
                </span>
              </li>
            ))}
        </ol>
        {!data.events.some(
          (entry) => entry.type === "attack" || entry.type === "ability",
        ) && <p>Le combat n’a pas encore commencé.</p>}
        <form method="dialog">
          <button className="sylve-button secondary">Fermer</button>
        </form>
      </dialog>
      {data.status === "finished" && !catchingUp && (
        <div className="result-overlay">
          <section className="result-card game-dialog" role="status">
            <div className="result-icon">
              {data.winner === data.me ? <TrophyIcon /> : <Leaf size={40} />}
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
            {(data.trophyChange ??
              (data.winner === data.me ? data.reward : null)) && (
              <LeagueResult reward={data.trophyChange ?? data.reward!} />
            )}
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
            <div className="result-actions">
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
            </div>
          </section>
        </div>
      )}
      {drag && (
        <div
          className="drag-preview"
          style={{ left: drag.x, top: drag.y }}
          aria-hidden="true"
        >
          <CreaturePortrait card={drag.card} />
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
        className="sylve-dialog game-dialog"
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
        className="sylve-dialog game-dialog"
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
          est accessible aux unités de mêlée et à distance. Les unités au corps
          à corps peuvent aussi se placer dans la colonne vers l’ennemi ; celles
          à distance dans la colonne vers ton héros. Une unité au corps à corps
          derrière un allié sur la même ligne ne peut pas agir. Les unités à
          distance peuvent attaquer depuis l’arrière.
        </p>
        <p>
          Les bâtiments occupent une case de n’importe quelle colonne et
          n’attaquent pas. Les capacités actives sur la fiche de chaque carte
          peuvent soigner, renforcer, protéger ou invoquer des renforts.
        </p>
        <p>
          Pas de déplacement. Ton deck contient de {MIN_DECK_SIZE} à {DECK_SIZE}{" "}
          cartes uniques. Chaque carte jouée est immédiatement remplacée pour
          garder {HAND_SIZE} cartes en main. Le tirage peut redonner la carte
          que tu viens de poser, même si elle est encore sur le terrain. Une
          même carte ne peut pas être présente deux fois dans ta main.{" "}
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
        <AbilityLegend />
        <form method="dialog">
          <button className="sylve-button">J’ai compris</button>
        </form>
      </dialog>
    </main>
  );
}
