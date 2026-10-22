import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  CATALOG,
  DECK_SIZE,
  HAND_SIZE,
  type CardDefinition,
  type GameView,
  type GameEvent,
} from "@sylve/game";
import {
  ArrowLeft,
  ArrowRight,
  CircleHelp,
  Flag,
  Hourglass,
  Leaf,
  Trophy,
  Undo2,
  X,
  RotateCcw,
  Bot,
} from "lucide-react";
import { DuelArena } from "./duel-arena";
import { CreatureCard } from "./creature-card";
import { CreaturePortrait } from "./creature-portrait";
import { GameLoading, showGameError } from "./shared";
import { useCombatPlayback } from "./use-combat-playback";

export type DuelData = GameView & { events: GameEvent[] };
interface DuelScreenProps {
  data: DuelData;
  onPlayCard: (
    cardId: string,
    row: number,
    depth: number,
    turn: number,
  ) => Promise<unknown>;
  onWithdrawCard: (cardId: string, turn: number) => Promise<unknown>;
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
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
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
    setSelectedUnit(null);
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
  const inspectedUnit = mine.board.find((unit) => unit.cardId === selectedUnit);
  async function withdrawSelected() {
    if (!canWithdraw || !selectedUnit) return;
    setPending(true);
    try {
      await onWithdrawCard(selectedUnit, data.turn);
      setSelectedUnit(null);
    } catch (error) {
      showGameError(error);
    } finally {
      setPending(false);
    }
  }
  async function place(cardId: string, row: number, depth: number) {
    if (!canSummon) return;
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
    setPending(true);
    try {
      await onEndTurn(data.turn);
    } catch (error) {
      showGameError(error);
    } finally {
      setPending(false);
    }
  }
  const cellAt = (x: number, y: number) =>
    document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-own-cell]");
  function pointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    card: CardDefinition,
  ) {
    if (!canSummon || event.button !== 0) return;
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
    const cell = cellAt(event.clientX, event.clientY);
    setHovered(cell ? `${cell.dataset.row}-${cell.dataset.depth}` : null);
  }
  function pointerUp(event: ReactPointerEvent) {
    const source = origin.current;
    if (source?.active) {
      suppressClick.current = true;
      const cell = cellAt(event.clientX, event.clientY);
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
          ? data.hasSummoned
            ? "Ton monstre est prêt. Lance l’assaut !"
            : "À toi de jouer. Invoque un compagnon."
          : practice
            ? "Le Gardien mécanique prépare sa stratégie…"
            : "Ton adversaire prépare sa stratégie…";
  return (
    <main
      className="game-room"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setSelected(null);
          setSelectedUnit(null);
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
          {practice ? "TERRAIN D’ENTRAÎNEMENT" : "LE CERCLE DE LA SYLVE"}
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
        canWithdraw={canWithdraw}
        combatEvent={combatEvent}
        onPlace={(cardId, row, depth) => void place(cardId, row, depth)}
        onSelectUnit={(cardId) => {
          setSelected(null);
          setSelectedUnit((current) => (current === cardId ? null : cardId));
        }}
      />
      {inspectedUnit && (
        <div
          className="unit-inspector"
          role="region"
          aria-label="Créature sélectionnée"
        >
          <CreaturePortrait card={inspectedUnit.card} />
          <div>
            <strong>{inspectedUnit.card.name}</strong>
            <span>
              La carte retirée rejoint la défausse et pourra être repiochée.
            </span>
          </div>
          <button
            className="sylve-button secondary small-button"
            disabled={!canWithdraw}
            onClick={() => void withdrawSelected()}
          >
            <Undo2 size={15} />
            Retirer du terrain
          </button>
          <button
            className="icon-button"
            aria-label="Fermer la sélection"
            onClick={() => setSelectedUnit(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <section className="hand-area">
        <div className="hand-heading">
          <div>
            <span className="eyebrow">TES COMPAGNONS</span>
            <span className="small muted">
              {canSummon
                ? "Glisse une carte, ou sélectionne-la puis choisis une case."
                : data.hasSummoned && myTurn
                  ? "Une invocation par tour. Tes compagnons sont prêts à attaquer."
                  : `La main est complétée à ${HAND_SIZE} au début de ton tour.`}
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
                selected={selected === card.id}
                disabled={!canSummon}
                onPointerDown={(event) => pointerDown(event, card)}
                onClick={() => {
                  if (!suppressClick.current) {
                    setSelectedUnit(null);
                    setSelected((current) =>
                      current === card.id ? null : card.id,
                    );
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
            <button
              className="sylve-button"
              disabled={!canEnd}
              onClick={() => void finish()}
            >
              {pending ? "Un instant…" : "Terminer le tour"}
              <ArrowRight size={16} />
            </button>
            <span className="small muted">
              Les monstres attaquent en fin de tour.
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
                {CATALOG.find((card) => card.id === entry.cardId)?.name ??
                  "Un monstre"}{" "}
                inflige {entry.damage} dégâts{" "}
                {entry.targetCardId
                  ? `à ${CATALOG.find((card) => card.id === entry.targetCardId)?.name ?? "un ennemi"}`
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
          Invoque un monstre par tour sur une case libre. À la fin du tour, tes
          monstres attaquent de l’avant vers l’arrière, ligne par ligne. Ils
          ciblent le premier ennemi en face, sinon son héros.
        </p>
        <p>
          Pas de déplacement ni de riposte. Les morts rejoignent la défausse,
          remélangée quand la pioche est vide. Ton deck contient {DECK_SIZE}{" "}
          cartes uniques et ta main est complétée à {HAND_SIZE} au début de ton
          tour.{" "}
          {practice
            ? "Prends tout le temps qu’il te faut pour réfléchir."
            : "Tu as 60 secondes pour agir."}
        </p>
        <p>
          Pour retirer une créature pendant ton tour, sélectionne-la sur le
          terrain puis choisis « Retirer du terrain ». Elle rejoint la défausse.
          Une invocation déjà utilisée reste consommée.
        </p>
        <p>Le premier héros à 0 PV perd le duel.</p>
        <form method="dialog">
          <button className="sylve-button">J’ai compris</button>
        </form>
      </dialog>
    </main>
  );
}
