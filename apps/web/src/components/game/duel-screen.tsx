import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  DECK_SIZE,
  MIN_DECK_SIZE,
  HAND_SIZE,
  FIELD_BUILDINGS,
  isDeploymentDepth,
  legalPlacements,
  type CardDefinition,
  type GameView,
  type GameEvent,
  type HeroAbilityId,
} from "@sylve/game";
import {
  ArrowRight,
  CircleHelp,
  Flag,
  Hourglass,
  History,
  Bot,
  RotateCcw,
} from "lucide-react";
import { DuelArena } from "./duel-arena";
import { CreatureCard } from "./creature-card";
import { AbilityIcon, eventIconKind } from "./ability-icons";
import { AbilityLegend } from "./ability-legend";
import { DuelDetailsDialog, type DuelInspection } from "./duel-details-dialog";
import { GameLoading, showGameError } from "./shared";
import type { ChestType } from "@sylve/game/progression";
import { useCombatPlayback } from "./use-combat-playback";
import { useBattleAudio } from "./use-battle-audio";
import { BattleAudioControls } from "./battle-audio-controls";
import { BattleDragPreview } from "./battle-drag-preview";
import { DuelResult } from "./duel-result";
import { HeroAbilityStack } from "./hero-ability-stack";
import type { TrophyChange } from "@sylve/game/leagues";

export type DuelData = GameView & {
  events: GameEvent[];
  mode?: "solo" | "public" | "private";
  trophyChange?: TrophyChange | null;
  reward?: {
    status: "awarded" | "lost";
    rarity?: ChestType;
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
  onEndTurn: (turn: number) => Promise<unknown>;
  onHeroAbility?: (
    abilityId: HeroAbilityId,
    expectedUses: number,
    turn: number,
  ) => Promise<unknown>;
  onSurrender: () => Promise<unknown>;
  practice?: boolean;
  onRestart?: () => void;
  onPlaybackSettled?: (sequence: number) => void;
}

export function DuelScreen({
  data,
  onPlayCard,
  onEndTurn,
  onHeroAbility,
  onSurrender,
  practice = false,
  onRestart,
  onPlaybackSettled,
}: DuelScreenProps) {
  const { display, event: combatEvent, events: combatEvents, playing } = useCombatPlayback(data);
  const room = useRef<HTMLElement>(null);
  const battleAudio = useBattleAudio(room, combatEvents, data.me,
    data.status === "finished" && !playing && display?.sequence === data.sequence ? data.winner === data.me : null);
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
  const surrendering = useRef(false);
  useEffect(() => {
    if (data.status !== "finished") return;
    for (const ref of [surrenderDialog, rulesDialog, historyDialog]) {
      if (ref.current?.open) ref.current.close();
    }
    setInspection(null);
  }, [data.status]);
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
  const hasPlacement = mine.hand.some(
    (card) => legalPlacements(card, mine.board).length > 0,
  );
  const cardName = (id: string | undefined) =>
    id === "hero"
      ? "Héros"
      : (display.players
          .flatMap((player) => player.deck)
          .find((card) => card.id === id)?.name ??
        display.players
          .flatMap((player) => player.board)
          .find((unit) => unit.cardId === id)?.card.name ??
        Object.values(FIELD_BUILDINGS).find((card) => card.id === id)?.name ??
        data.events.find((e) => e.cardId === id && e.unit?.definition)?.unit
          ?.definition?.name ??
        "une créature");
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
  async function castHeroAbility(id: HeroAbilityId, uses: number) {
    if (!canSummon || !onHeroAbility) return;
    setPending(true);
    setSelected(null);
    try {
      await onHeroAbility(id, uses, data.turn);
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
      ref={room}
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
          <BattleAudioControls {...battleAudio} />
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
        combatEvents={combatEvents}
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
        onInspectField={(kind, playerIndex, row, depth) =>
          inspect({
            type: "field",
            kind,
            playerIndex,
            position: { row, depth },
          })
        }
      />
      <section className="hand-area" aria-label="Ta main">
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
      {data.status === "active" && (
        <HeroAbilityStack
          player={mine}
          turn={display.turn}
          canUse={canSummon && !!onHeroAbility}
          onUse={(id, uses) => void castHeroAbility(id, uses)}
          onInspect={() => inspect({ type: "hero", playerIndex: data.me })}
        />
      )}
      <dialog
        className="sylve-dialog game-dialog combat-history"
        ref={historyDialog}
        aria-labelledby="history-title"
      >
        <h2 id="history-title">Journal du duel</h2>
        <ol>
          {data.events
            .filter(
              (entry) =>
                entry.type === "attack" ||
                entry.type === "ability" ||
                entry.type === "hero_ability",
            )
            .slice(-12)
            .reverse()
            .map((entry) => (
              <li key={entry.seq}>
                {eventIconKind(entry) && (
                  <AbilityIcon kind={eventIconKind(entry)!} />
                )}
                <span>
                  {entry.type === "hero_ability" ? (
                    `${display.players[entry.player]!.name} utilise ${entry.ability}.`
                  ) : entry.type === "ability" ? (
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
        <DuelResult data={data} practice={practice} onRestart={onRestart} />
      )}
      {drag && (
        <BattleDragPreview {...drag} room={room} hovered={hovered} />
      )}
      <DuelDetailsDialog
        inspection={inspection}
        view={display}
        canSummon={canSummon}
        onInspect={setInspection}
        onClose={() => setInspection(null)}
        onSelectCard={(cardId) => {
          const card = mine.hand.find((entry) => entry.id === cardId);
          if (!canSummon || !card || !legalPlacements(card, mine.board).length)
            return;
          setSelected(cardId);
          setInspection(null);
        }}
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
            type="button"
            className="sylve-button"
            disabled={pending}
            onClick={() => {
              if (surrendering.current) return;
              surrendering.current = true;
              // Native dialogs live above the result's portal. Close explicitly.
              surrenderDialog.current?.close();
              setPending(true);
              void onSurrender()
                .catch(showGameError)
                .finally(() => {
                  surrendering.current = false;
                  setPending(false);
                });
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
          Chaque partie tire un terrain différent pour chaque camp : de 0 à 3
          bâtiments neutres, de 0 à 2 runes et de 0 à 2 pentagrammes. Chaque
          sceau donne de la vie (+3 PV) ou de la puissance (+2 attaque). Les
          quantités restent proches, mais les positions et les petits avantages
          varient. Chaque camp garde plusieurs cases libres pour invoquer. Les
          bâtiments bloquent leur case et doivent être détruits ; ils ne peuvent
          pas être retirés. Une rune donne son bonus immédiatement à l’arrivée
          de l’unité, une seule fois. Un pentagramme ne donne rien à la pose :
          il ajoute son bonus à chaque début de tour du propriétaire de l’unité,
          en cumulant les gains. Les bonus de vie augmentent les PV actuels et
          maximum. Les deux sceaux disparaissent quand leur porteur meurt.
          Sélectionne un bâtiment ou un sceau pour voir ses effets.
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
          Les créatures restent sur le plateau jusqu’à leur mort. Si aucun
          placement n’est possible, « Attaquer sans invoquer » permet de
          continuer le combat.
        </p>
        <p>
          Le niveau du héros dépend de la puissance de son deck et améliore ses
          PV et ses pouvoirs. Les cartes de pouvoir se trouvent en bas à droite
          : utilise toujours la première avant les suivantes, avant de poser ta
          créature. Tempête est prête dès ton deuxième tour ; les renforts à ton
          troisième tour (niveau 11) et Élan à ton septième (niveau 21). Un
          pouvoir ne termine pas le tour et ne consomme pas de carte en main. À
          partir de ton onzième tour, Dernier souffle ajoute des dégâts directs
          croissants, après utilisation des trois pouvoirs (niveau 21).
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
