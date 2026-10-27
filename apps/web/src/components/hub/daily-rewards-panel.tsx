import { Clock3, LoaderCircle, LockKeyhole, Sparkles } from "lucide-react";
import {
  DAILY_REWARDS,
  canClaimDailyReward,
  type DailyGift,
  type DailyRewardsBoard,
} from "@sylve/game/daily-rewards";
import { chestName } from "@sylve/game/progression";
import { HubPanel } from "./hub-panel";
import { MissionCheck } from "./mission-icons";

export interface HubDailyRewardsProps {
  board?: DailyRewardsBoard;
  pending?: boolean;
  onClaim?: (day: number) => void;
}

function giftLabel(gift: DailyGift) {
  if (gift.kind === "chest") return chestName(gift.rarity);
  return `${gift.amount.toLocaleString("fr-FR")} ${gift.kind === "gold" ? "pièces d’or" : "émeraudes"}`;
}

function countdown(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")} h ${String(minutes).padStart(2, "0")} min ${String(seconds % 60).padStart(2, "0")} s`;
}

export function DailyRewardsPanel({
  id,
  onClose,
  board,
  now,
  pending,
  onClaim,
}: HubDailyRewardsProps & { id: string; onClose: () => void; now: number }) {
  const ready = board ? canClaimDailyReward(board, now) : false;
  const completed = board?.claimedDays === DAILY_REWARDS.length;

  return (
    <HubPanel
      id={id}
      title="Récompenses"
      description="Un rendez-vous, un cadeau, chaque jour."
      icon="rewards"
      closeLabel="Fermer les récompenses"
      className="hub-daily-rewards"
      onClose={onClose}
    >
      {!board ? (
        <div className="daily-rewards-loading" role="status">
          <LoaderCircle size={24} className="animate-spin" aria-hidden="true" />
          Chargement des cadeaux…
        </div>
      ) : (
        <div className="daily-rewards-content">
          <div className="daily-rewards-intro">
            <div>
              <h3>7 jours de cadeaux</h3>
              <p>Le suivant arrive 24 h après ta récupération.</p>
            </div>
            <span
              className="daily-rewards-progress"
              aria-label={`${board.claimedDays} cadeaux récupérés sur 7`}
            >
              <strong>{board.claimedDays}</strong> / 7
            </span>
          </div>

          <ol
            className="daily-rewards-grid"
            aria-label="Les 7 cadeaux du refuge"
          >
            {DAILY_REWARDS.map((gift, index) => {
              const day = index + 1;
              const claimed = day <= board.claimedDays;
              const current = day === board.claimedDays + 1;
              const available = current && ready;
              const claiming = current && pending;
              const final = day === DAILY_REWARDS.length;
              const label = giftLabel(gift);
              const status = claimed
                ? "Récupéré"
                : available
                  ? "Récupérer"
                  : current
                    ? "Bientôt"
                    : "Verrouillé";
              const image =
                gift.kind === "chest"
                  ? `/art/chests/${gift.rarity}${claimed ? "-open" : ""}.webp`
                  : gift.kind === "gold"
                    ? "/art/treasures/gold-pouch.webp"
                    : "/art/treasures/emerald-small-pouch.webp";

              return (
                <li
                  key={day}
                  className={final ? "daily-reward-final" : undefined}
                >
                  <button
                    type="button"
                    className="daily-reward"
                    data-status={
                      claimed ? "claimed" : available ? "ready" : "locked"
                    }
                    data-final={final || undefined}
                    aria-label={`Jour ${day} : ${label}, ${status.toLowerCase()}`}
                    aria-busy={claiming || undefined}
                    disabled={!available || pending || !onClaim}
                    onClick={() => onClaim?.(day)}
                  >
                    <span className="daily-reward-day">Jour {day}</span>
                    {final && (
                      <span className="daily-reward-special">
                        <Sparkles size={12} aria-hidden="true" /> Le grand
                        cadeau
                      </span>
                    )}
                    <img
                      className="daily-reward-art"
                      src={image}
                      alt=""
                      draggable={false}
                    />
                    <strong className="daily-reward-name">{label}</strong>
                    <span className="daily-reward-status">
                      {claiming ? (
                        <LoaderCircle
                          size={14}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                      ) : claimed ? (
                        <MissionCheck />
                      ) : available ? (
                        <Sparkles size={13} aria-hidden="true" />
                      ) : (
                        <LockKeyhole size={12} aria-hidden="true" />
                      )}
                      {claiming ? "Récupération…" : status}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="daily-rewards-next">
            {completed ? (
              <p role="status">
                <Sparkles size={17} aria-hidden="true" /> Les 7 cadeaux sont à
                toi. Beau parcours !
              </p>
            ) : ready ? (
              <p role="status">
                <Sparkles size={17} aria-hidden="true" /> Ton cadeau du jour{" "}
                {board.claimedDays + 1} t’attend !
              </p>
            ) : (
              <p>
                <Clock3 size={17} aria-hidden="true" /> Prochain cadeau dans{" "}
                <time>{countdown(board.nextClaimAt! - now)}</time>
              </p>
            )}
            <span>
              Tes cadeaux restent disponibles, même si tu manques un jour.
            </span>
          </div>
        </div>
      )}
    </HubPanel>
  );
}
