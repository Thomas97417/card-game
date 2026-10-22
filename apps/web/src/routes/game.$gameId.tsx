import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { CATALOG, HERO_HP, type CardDefinition } from "@sylve/game";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CircleHelp,
  Flag,
  Heart,
  Hourglass,
  Layers,
  Leaf,
  Shield,
  Swords,
  Trophy,
} from "lucide-react";
import { CreatureCard } from "@/components/game/creature-card";
import { CreaturePortrait } from "@/components/game/creature-portrait";
import { GameLoading, showGameError } from "@/components/game/shared";
import { useCombatPlayback } from "@/components/game/use-combat-playback";
import { requireGameAuth } from "@/lib/game-auth";

export const Route = createFileRoute("/game/$gameId")({
  beforeLoad: ({ context, location }) =>
    requireGameAuth(context.isAuthenticated, location.href),
  head: () => ({ meta: [{ title: "Le duel — Sylve" }] }),
  component: GamePage,
  errorComponent: () => (
    <main className="sylve-page">
      <h1>Ce duel est inaccessible.</h1>
      <p className="muted">
        Vérifie le lien et le compte avec lequel tu es connecté.
      </p>
      <Link to="/play" className="sylve-button">
        Retour au salon
      </Link>
    </main>
  ),
});
function GamePage() {
  const { gameId: rawId } = Route.useParams();
  const gameId = rawId as Id<"games">;
  const data = useQuery(api.games.get, { gameId });
  const playCard = useMutation(api.games.playCard);
  const endTurn = useMutation(api.games.endTurn);
  const surrender = useMutation(api.games.surrender);
  const { display, event: combatEvent, playing } = useCombatPlayback(data);
  const [now, setNow] = useState(Date.now());
  const [selected, setSelected] = useState<string | null>(null);
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
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    setSelected(null);
  }, [data?.turn, data?.hasSummoned]);
  if (!data || !display) return <GameLoading />;
  const mine = display.players[data.me]!;
  const enemy = display.players[1 - data.me]!;
  const myTurn = data.activePlayer === data.me;
  const seconds = Math.max(0, Math.ceil((data.turnEndsAt - now) / 1000));
  const catchingUp = playing || display.sequence !== data.sequence;
  const canSummon =
    myTurn &&
    !data.hasSummoned &&
    !pending &&
    !catchingUp &&
    seconds > 0 &&
    data.status === "active";
  const canEnd = myTurn && !pending && !catchingUp && data.status === "active";
  async function place(cardId: string, row: number, depth: number) {
    if (!canSummon) return;
    setPending(true);
    try {
      await playCard({ gameId, cardId, row, depth, expectedTurn: data!.turn });
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
      await endTurn({ gameId, expectedTurn: data!.turn });
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
          : "Ton adversaire prépare sa stratégie…";
  function hero(player: typeof mine, index: number, own: boolean) {
    const hit =
      combatEvent?.type === "attack" &&
      combatEvent.targetPlayer === index &&
      !combatEvent.targetCardId;
    return (
      <div
        className={`hero-panel ${own ? "own" : "enemy"} ${hit ? "hero-hit" : ""}`}
      >
        <div className="hero-crest">
          {own ? <Leaf size={24} /> : <Shield size={24} />}
        </div>
        <div className="hero-info">
          <span className="eyebrow">
            {own ? "TON HÉROS" : "TON ADVERSAIRE"}
          </span>
          <strong>{player.name}</strong>
          <div className="hero-life">
            <Heart size={14} fill="currentColor" />
            <span>
              {player.heroHp}
              <small> / {HERO_HP}</small>
            </span>
            <div className="hero-health-track">
              <div style={{ width: `${(player.heroHp / HERO_HP) * 100}%` }} />
            </div>
          </div>
        </div>
        <div className="hero-piles" title="Main · Pioche · Défausse">
          <span>
            <BookOpen size={13} />
            {player.handCount}
          </span>
          <span>
            <Layers size={13} />
            {player.drawCount}
          </span>
          <span>↻ {player.discardCount}</span>
        </div>
      </div>
    );
  }
  function half(player: typeof mine, playerIndex: number, own: boolean) {
    return (
      <div
        className={`board-half ${own ? "own" : "enemy"}`}
        role="group"
        aria-label={own ? "Ton camp" : "Camp adverse"}
      >
        {Array.from({ length: 12 }, (_, index) => {
          const row = Math.floor(index / 3);
          const depth = own ? 2 - (index % 3) : index % 3;
          const unit = player.board.find(
            (entry) => entry.row === row && entry.depth === depth,
          );
          const legal = own && !unit && canSummon && !!selected;
          const acting =
            combatEvent?.player === playerIndex &&
            combatEvent.cardId === unit?.cardId;
          const attacking = acting && combatEvent?.type === "attack";
          const spawning = acting && combatEvent?.type === "summon";
          const dying = acting && combatEvent?.type === "death";
          const hit =
            combatEvent?.type === "attack" &&
            combatEvent.targetPlayer === playerIndex &&
            combatEvent.targetCardId === unit?.cardId &&
            !!unit;
          return (
            <button
              key={`${row}-${depth}`}
              type="button"
              className={`board-cell ${legal ? "legal" : ""} ${hovered === `${row}-${depth}` && own ? "hovered" : ""} ${unit ? "occupied" : ""}`}
              data-own-cell={own && !unit ? "true" : undefined}
              data-row={row}
              data-depth={depth}
              aria-label={`${own ? "Ton camp" : "Camp adverse"}, ligne ${row + 1}, ${depth === 0 ? "avant" : depth === 1 ? "milieu" : "arrière"}${unit ? `, ${unit.card.name}, attaque ${unit.card.attack}, ${unit.hp} PV` : ", vide"}`}
              aria-disabled={!legal}
              onClick={() => {
                if (legal && selected) void place(selected, row, depth);
              }}
            >
              <span className="cell-rune">✧</span>
              {unit && (
                <div
                  className={`board-unit ${attacking ? "attacking" : ""} ${hit ? "taking-hit" : ""} ${spawning ? "spawning" : ""} ${dying ? "dying" : ""}`}
                >
                  <CreaturePortrait card={unit.card} />
                  <span className="unit-name">{unit.card.name}</span>
                  <div className="unit-stats">
                    <span>
                      <Swords size={12} />
                      {unit.card.attack}
                    </span>
                    <span
                      className={unit.hp < unit.card.health ? "wounded" : ""}
                    >
                      <Heart size={12} />
                      {unit.hp}
                    </span>
                  </div>
                  {hit && (
                    <span key={combatEvent.seq} className="damage-float">
                      −{combatEvent.damage}
                    </span>
                  )}
                </div>
              )}
              {legal && <span className="place-hint">Invoquer</span>}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <main
      className="game-room"
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
        <span className="eyebrow">LE CERCLE DE LA SYLVE</span>
        <div>
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
      <div className="duel-status">
        <span className={`turn-dot ${myTurn ? "active" : ""}`} />
        <span role="status">{statusText}</span>
        <span className="turn-number">TOUR {data.turn}</span>
      </div>
      <div className="arena-scroll">
        <section className="arena">
          <div className="arena-heroes">
            {hero(mine, data.me, true)}
            <span className="versus">VS</span>
            {hero(enemy, 1 - data.me, false)}
          </div>
          <div className="board-labels">
            <span>TON TERRITOIRE</span>
            <span>LA FRONTIÈRE</span>
            <span>TERRITOIRE ADVERSE</span>
          </div>
          <div className="battlefield">
            {half(mine, data.me, true)}
            <div className="board-divider">
              <span>❖</span>
            </div>
            {half(enemy, 1 - data.me, false)}
          </div>
          <div className="board-footnote">
            <span>
              ARRIÈRE <ArrowRight size={12} /> AVANT
            </span>
            <span>4 LIGNES · 24 CASES</span>
            <span>
              AVANT <ArrowRight size={12} /> ARRIÈRE
            </span>
          </div>
        </section>
      </div>
      <section className="hand-area">
        <div className="hand-heading">
          <div>
            <span className="eyebrow">TES COMPAGNONS</span>
            <span className="small muted">
              {canSummon
                ? "Glisse une carte, ou sélectionne-la puis choisis une case."
                : data.hasSummoned && myTurn
                  ? "Une invocation par tour. Tes compagnons sont prêts à attaquer."
                  : "La main est complétée à 5 au début de ton tour."}
            </span>
          </div>
          <span className="small muted">{mine.hand.length} / 5</span>
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
                  if (!suppressClick.current)
                    setSelected((current) =>
                      current === card.id ? null : card.id,
                    );
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
              <Hourglass size={16} />
              <span>
                {data.status === "finished"
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
            <Link to="/play" className="sylve-button">
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
              void surrender({ gameId })
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
          remélangée quand la pioche est vide. Ta main est complétée à 5 au
          début de ton tour. Tu as 60 secondes pour agir.
        </p>
        <p>Le premier héros à 0 PV perd le duel.</p>
        <form method="dialog">
          <button className="sylve-button">J’ai compris</button>
        </form>
      </dialog>
    </main>
  );
}
