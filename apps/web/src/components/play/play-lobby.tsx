import type { ReactNode } from "react";
import { GoldBalance } from "@/components/gold-balance";
import { Link } from "@tanstack/react-router";
import {
  Bot,
  Swords,
  UsersRound,
  Hourglass,
  Sparkles,
  X,
  LoaderCircle,
} from "lucide-react";
import { type CardRarity } from "@sylve/game";
import {
  leagueProgress,
  TROPHIES_PER_WIN,
  TROPHIES_PER_LOSS,
  type LeagueProgress,
} from "@sylve/game/leagues";
import { LeaguePanel } from "@/components/leagues/league-progress";
import {
  CHEST_LABELS,
  CHEST_SLOTS,
  LOCKED_CHEST_SLOTS,
  VICTORY_CHEST_WINS,
  type VictoryChestProgress,
} from "@sylve/game/progression";

export interface LobbyChest {
  _id: string;
  slot: number;
  rarity: CardRarity;
  unlockAt: number;
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

export function PlayLobby({
  deckSize,
  league = leagueProgress(0),
  chests,
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
  const full = chests.length >= CHEST_SLOTS;
  const victoryReady = victoryChest.wins >= victoryChest.requiredWins;
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
      <header className="play-header">
        <Link to="/hub" className="workshop-back" aria-label="Retour au refuge">
          <img
            src="/art/ui/back-arrow.webp"
            alt=""
            width={288}
            height={157}
            draggable={false}
          />
        </Link>
        <h1>L’arène des gardiens</h1>
        <GoldBalance />
      </header>
      <div className="play-main">
        <Link
          className="play-hero"
          to="/decks"
          aria-label="Mon deck, voir et améliorer mes cartes"
        >
          <span className="play-hero-aura" />
          <img
            src="/art/heroes/hero-sylve.webp"
            alt="Ton héros de la Sylve"
            width={512}
            height={768}
            draggable={false}
          />
          <span className="play-hero-plaque">
            <strong>
              Mon deck{" "}
              <span>
                {ready ? deckSize : "—"}/{league.deckCapacity}
              </span>
            </strong>
            <small>Renforcer mes compagnons</small>
          </span>
        </Link>
        <section className="play-battles" aria-label="Choisir un combat">
          {ready && <LeaguePanel progress={league} />}
          <button
            type="button"
            className="play-battle-button play-solo"
            disabled={!ready || locked}
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
              disabled={!ready || locked}
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
            disabled={!ready || busy || queued}
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
            {CHEST_SLOTS + 1} ouverts · {LOCKED_CHEST_SLOTS} verrouillés
            {chests.length > CHEST_SLOTS
              ? ` · ${chests.length - CHEST_SLOTS} à récupérer ensuite`
              : ""}
          </span>
        </div>
        <div className="play-chest-row">
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
          {Array.from({ length: CHEST_SLOTS }, (_, slot) => {
            const chest = chests.find((chest) => chest.slot === slot);
            const remaining = chest ? chest.unlockAt - now : 0;
            return chest ? (
              <button
                type="button"
                key={slot}
                className={`play-chest ${remaining <= 0 ? "is-ready" : ""}`}
                data-rarity={chest.rarity}
                disabled={!ready || busy || remaining > 0}
                onClick={() => onOpenChest(chest)}
                aria-label={`Coffre ${CHEST_LABELS[chest.rarity]}, ${remaining <= 0 ? "ouvrir" : `prêt dans ${remainingTime(remaining)}`}`}
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
          {Array.from({ length: LOCKED_CHEST_SLOTS }, (_, index) => (
            <div
              className="play-chest play-chest-locked"
              key={`locked-${index}`}
              role="img"
              aria-label={`Emplacement ${CHEST_SLOTS + index + 2} verrouillé par une chaîne`}
            >
              <span className="play-chest-number">
                0{CHEST_SLOTS + index + 2}
              </span>
              <img
                className="play-slot-chain"
                src="/art/ui/slot-chains.webp"
                alt=""
                width={512}
                height={512}
                draggable={false}
              />
              <span className="play-chest-action">Verrouillé</span>
            </div>
          ))}
        </div>
      </section>
      {children}
    </main>
  );
}
