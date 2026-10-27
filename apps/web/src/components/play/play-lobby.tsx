import { useId, useRef, type ReactNode } from "react";
import { GameHeader } from "@/components/game-header";
import { GameIcon } from "@/components/game/game-icon";
import { EmeraldAmount } from "@/components/emerald-balance";
import { useHorizontalDrag } from "@/hooks/use-horizontal-drag";
import { useHorizontalWheel } from "@/hooks/use-horizontal-wheel";
import { Link } from "@tanstack/react-router";
import {
  Bot,
  Swords,
  UsersRound,
  Hourglass,
  Sparkles,
  X,
  LoaderCircle,
  ArrowRight,
} from "lucide-react";
import {
  leagueProgress,
  leagueAt,
  TROPHIES_PER_WIN,
  TROPHIES_PER_LOSS,
  type LeagueProgress,
} from "@sylve/game/leagues";
import {
  CHEST_LABELS,
  chestRushCost,
  type ChestType,
  CHEST_SLOT_KEYS,
  CHEST_SLOT_UNLOCKS,
  TOTAL_CHEST_SLOTS,
  unlockedChestSlots,
  VICTORY_CHEST_WINS,
  type VictoryChestProgress,
} from "@sylve/game/progression";

export interface LobbyChest {
  _id: string;
  slot: number;
  rarity: ChestType;
  unlockAt: number;
  awardedAt?: number;
  instantCost?: number;
  leagueTrophies?: number;
}
export function remainingTime(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}`
    : `${minutes}:${rest}`;
}

export function DeckCompletionNotice({
  deckSize,
  capacity,
  id,
}: {
  deckSize: number;
  capacity: number;
  id?: string;
}) {
  const missing = Math.max(0, capacity - deckSize);
  return (
    <div className="play-deck-notice" id={id} role="status">
      <GameIcon kind="all" size={32} />
      <div>
        <strong>Complète ton deck</strong>
        <p>
          Il manque {missing} carte{missing > 1 ? "s" : ""} ({deckSize}/
          {capacity}). Remplis tous tes emplacements débloqués pour entrer dans
          l’arène.
        </p>
        <Link to="/decks">
          Compléter mon deck <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

export function PlayLobby({
  deckSize,
  league = leagueProgress(0),
  chests,
  purchasedChestSlots = [],
  victoryChest = { wins: 0, requiredWins: VICTORY_CHEST_WINS, cycle: 0 },
  now,
  ready,
  busy,
  locked,
  queued,
  onSolo,
  onPublic,
  onPrivate,
  onCancelQueue,
  onOpenChest,
  onOpenVictoryChest,
  children,
}: {
  deckSize: number;
  league?: LeagueProgress;
  chests: LobbyChest[];
  purchasedChestSlots?: readonly number[];
  victoryChest?: VictoryChestProgress;
  now: number;
  ready: boolean;
  busy: boolean;
  locked: boolean;
  queued: boolean;
  onSolo: () => void;
  onPublic: () => void;
  onPrivate: () => void;
  onCancelQueue: () => void;
  onOpenChest: (chest: LobbyChest) => void;
  onOpenVictoryChest: () => void;
  children?: ReactNode;
}) {
  const unlockedSlots = unlockedChestSlots(
    league.peakTrophies,
    purchasedChestSlots,
  );
  const full = chests.length >= unlockedSlots.length;
  const victoryReady = victoryChest.wins >= victoryChest.requiredWins;
  const deckComplete = deckSize === league.deckCapacity;
  const deckIncomplete = ready && !deckComplete;
  const missingCards = Math.max(0, league.deckCapacity - deckSize);
  const deckNoticeId = useId();
  const chestRow = useRef<HTMLDivElement>(null);
  const { isDragging, dragHandlers } = useHorizontalDrag(true);
  useHorizontalWheel(chestRow);
  return (
    <main className="play-lobby" aria-busy={!ready}>
      <img
        className="play-background"
        src="/art/play-lobby.webp"
        alt=""
        fetchPriority="high"
        draggable={false}
      />
      <div className="play-shade" />
      <GameHeader league={ready ? league : undefined} />
      <div className="play-main">
        <Link
          className="play-hero"
          to="/decks"
          aria-label={
            deckIncomplete
              ? "Compléter mon deck"
              : "Mon deck, voir et améliorer mes cartes"
          }
          aria-describedby={deckIncomplete ? deckNoticeId : undefined}
        >
          <span className="play-hero-aura" />
          <img
            src="/art/heroes/hero-sylve.webp"
            alt="Ton héros de la Sylve"
            width={512}
            height={768}
            draggable={false}
          />
          <span
            className={`play-hero-plaque${deckIncomplete ? " is-incomplete" : ""}`}
          >
            <strong>
              Mon deck{" "}
              <span>
                {ready ? deckSize : "—"}/{league.deckCapacity}
              </span>
            </strong>
            {deckIncomplete ? (
              <>
                <small
                  className="play-deck-warning"
                  id={deckNoticeId}
                  role="status"
                >
                  Ajoute {missingCards} carte{missingCards > 1 ? "s" : ""} pour
                  combattre.
                </small>
                <span className="play-hero-plaque-action">
                  Compléter mon deck <ArrowRight size={14} aria-hidden="true" />
                </span>
              </>
            ) : (
              <small>Renforcer mes compagnons</small>
            )}
          </span>
        </Link>
        <section className="play-battles" aria-label="Choisir un combat">
          <button
            type="button"
            className="play-battle-button play-solo"
            disabled={!ready || locked || !deckComplete}
            aria-describedby={ready && !deckComplete ? deckNoticeId : undefined}
            onClick={onSolo}
          >
            <Bot />
            <span>
              <strong>Combat solo</strong>
              <small>
                À ta ligue · +{TROPHIES_PER_WIN} / −{TROPHIES_PER_LOSS} trophées
              </small>
            </span>
            <Swords className="play-button-mark" />
          </button>
          {queued ? (
            <div className="play-searching" role="status">
              <LoaderCircle className="animate-spin" />
              <span>Recherche d’un adversaire…</span>
              <button
                aria-label="Annuler la recherche"
                disabled={busy}
                onClick={onCancelQueue}
              >
                <X size={20} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="play-battle-button play-public"
              disabled={!ready || locked || !deckComplete}
              aria-describedby={
                ready && !deckComplete ? deckNoticeId : undefined
              }
              onClick={onPublic}
            >
              <Swords />
              <span>
                <strong>Duel public</strong>
                <small>
                  Affronter un gardien · +{TROPHIES_PER_WIN} / −
                  {TROPHIES_PER_LOSS} trophées
                </small>
              </span>
              <span className="play-button-mark">→</span>
            </button>
          )}
          <button
            type="button"
            className="play-friendly"
            disabled={!ready || busy || queued || !deckComplete}
            aria-describedby={ready && !deckComplete ? deckNoticeId : undefined}
            onClick={onPrivate}
          >
            <UsersRound size={17} />
            Défi amical<span>Inviter ou rejoindre un ami</span>
          </button>
          {full && (
            <p className="play-reward-note is-full" role="status">
              <Hourglass size={15} />
              Emplacements pleins : le prochain coffre de combat sera perdu. Les
              victoires rapportent des trophées et comptent pour le coffre
              commun.
            </p>
          )}
        </section>
      </div>
      <section className="play-treasures" aria-label="Tes coffres">
        <div className="play-treasures-heading">
          <h2>Trésors de victoire</h2>
          <span>
            {chests.length > unlockedSlots.length
              ? `${chests.length - unlockedSlots.length} à récupérer ensuite`
              : "← Faire défiler les coffres →"}
          </span>
        </div>
        <div
          ref={chestRow}
          className={`play-chest-row ${isDragging ? "is-dragging" : ""}`}
          role="region"
          aria-label="Emplacements de coffre, défilement horizontal"
          tabIndex={0}
          {...dragHandlers}
        >
          <button
            type="button"
            className={`play-chest play-victory-chest ${victoryReady ? "is-ready" : ""}`}
            data-rarity="common"
            disabled={!ready || busy || !victoryReady}
            onClick={onOpenVictoryChest}
            aria-label={`Coffre commun de victoires, ${victoryReady ? "ouvrir" : `${victoryChest.wins} sur ${victoryChest.requiredWins} victoires`}`}
          >
            <span className="play-chest-rarity">Commun · Victoires</span>
            <img
              src="/art/chests/common.webp"
              alt=""
              width={512}
              height={512}
              draggable={false}
            />
            <span
              className="play-victory-progress"
              role="progressbar"
              aria-label="Victoires pour le coffre commun"
              aria-valuenow={victoryChest.wins}
              aria-valuemin={0}
              aria-valuemax={victoryChest.requiredWins}
            >
              {Array.from({ length: victoryChest.requiredWins }, (_, index) => (
                <span
                  key={index}
                  className={index < victoryChest.wins ? "is-earned" : ""}
                />
              ))}
            </span>
            <span className="play-chest-action">
              {victoryReady ? (
                <>
                  <Sparkles size={14} />
                  Ouvrir
                </>
              ) : (
                <>
                  <Swords size={13} />
                  {victoryChest.wins}/{victoryChest.requiredWins} victoires
                </>
              )}
            </span>
          </button>
          {Array.from({ length: TOTAL_CHEST_SLOTS }, (_, slot) => {
            const unlocked = unlockedSlots.includes(slot);
            if (!unlocked) {
              const key = CHEST_SLOT_KEYS.find((key) => key.slot === slot);
              const milestone = CHEST_SLOT_UNLOCKS.find(
                (unlock) => unlock.slot === slot,
              );
              const leagueLabel = milestone
                ? leagueAt(milestone.trophies).label
                : "";
              const lockContent = (
                <>
                  <span className="play-chest-number">
                    {String(slot + 2).padStart(2, "0")}
                  </span>
                  <img
                    className="play-slot-chain"
                    src={
                      key
                        ? "/art/ui/premium-slot-chains.webp"
                        : "/art/ui/slot-chains.webp"
                    }
                    alt=""
                    width={512}
                    height={512}
                    draggable={false}
                  />
                  <span className="play-chest-lock-caption">
                    {key ? "Clé du sanctuaire" : "À débloquer en ligue"}
                  </span>
                  <span className="play-chest-action">
                    {key ? <EmeraldAmount amount={key.price} /> : leagueLabel}
                  </span>
                </>
              );
              return key ? (
                <Link
                  key={slot}
                  to="/sanctuary"
                  hash="chest-keys"
                  className="play-chest play-chest-locked play-chest-purchasable"
                  aria-label={`Emplacement ${slot + 2} verrouillé, acheter ${key.name} au sanctuaire pour ${key.price} émeraudes`}
                  draggable={false}
                >
                  {lockContent}
                </Link>
              ) : (
                <div
                  key={slot}
                  className="play-chest play-chest-locked"
                  role="img"
                  aria-label={`Emplacement ${slot + 2} verrouillé par une chaîne, atteindre ${leagueLabel}, ${milestone?.trophies} trophées`}
                >
                  {lockContent}
                </div>
              );
            }
            const chest = chests.find((chest) => chest.slot === slot);
            const remaining = chest ? chest.unlockAt - now : 0;
            return chest ? (
              <button
                type="button"
                key={slot}
                className={`play-chest ${remaining <= 0 ? "is-ready" : ""}`}
                data-rarity={chest.rarity === "bigRare" ? "rare" : chest.rarity}
                disabled={!ready || busy}
                onClick={() => onOpenChest(chest)}
                aria-label={`${chest.rarity === "bigRare" ? "Grand coffre rare" : `Coffre ${CHEST_LABELS[chest.rarity]}`}, ${remaining <= 0 ? "ouvrir" : `prêt dans ${remainingTime(remaining)}, ouvrir maintenant pour ${chestRushCost(chest, now)} émeraudes`}`}
              >
                <span className="play-chest-rarity">
                  {CHEST_LABELS[chest.rarity]}
                </span>
                <img
                  src={`/art/chests/${chest.rarity}.webp`}
                  alt=""
                  width={512}
                  height={512}
                  draggable={false}
                />
                <span className="play-chest-action">
                  {remaining <= 0 ? (
                    <>
                      <Sparkles size={15} />
                      Ouvrir
                    </>
                  ) : (
                    <>
                      <Hourglass size={13} />
                      <time>{remainingTime(remaining)}</time>
                    </>
                  )}
                </span>
                {remaining > 0 && (
                  <span className="play-chest-rush">
                    Ouvrir <EmeraldAmount amount={chestRushCost(chest, now)} />
                  </span>
                )}
              </button>
            ) : (
              <div
                key={slot}
                className="play-chest play-chest-empty"
                aria-label={`Emplacement ${slot + 2} libre`}
              >
                <span className="play-chest-number">0{slot + 2}</span>
                <Swords size={30} />
                <span>
                  Une victoire,
                  <br />
                  un nouveau trésor.
                </span>
              </div>
            );
          })}
        </div>
      </section>
      {children}
    </main>
  );
}
