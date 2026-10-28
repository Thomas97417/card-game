import {
  DAILY_REWARDS,
  canClaimDailyReward,
  type DailyGift,
  type DailyRewardsBoard,
} from "@sylve/game/daily-rewards";
import { chestName } from "@sylve/game/chest-types";
import { GameIcon } from "@/components/game/game-icon";
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
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
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
      icon="rewards"
      closeLabel="Fermer les récompenses"
      className="hub-daily-rewards"
      onClose={onClose}
    >
      {!board ? (
        <div className="daily-rewards-loading" role="status">
          <span className="daily-rewards-spinner" aria-hidden="true" />
          <span className="sr-only">Chargement des récompenses…</span>
        </div>
      ) : (
        <div className="daily-rewards-content">
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
                    <img
                      className="daily-reward-art"
                      src={image}
                      alt=""
                      draggable={false}
                    />
                    {gift.kind !== "chest" && (
                      <strong className="daily-reward-name">
                        {gift.amount.toLocaleString("fr-FR")}
                      </strong>
                    )}
                    <span className="daily-reward-status">
                      {claiming ? (
                        <span
                          className="daily-rewards-spinner"
                          aria-hidden="true"
                        />
                      ) : claimed ? (
                        <MissionCheck />
                      ) : available ? (
                        "Récupérer"
                      ) : (
                        <GameIcon kind="rewardLock" size={22} />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {!ready && board.nextClaimAt !== null && (
            <div className="daily-rewards-next" aria-label="Prochain cadeau">
              <GameIcon kind="rewardClock" size={24} />
              <time
                aria-label={`Prochain cadeau dans ${countdown(board.nextClaimAt - now)}`}
              >
                {countdown(board.nextClaimAt - now)}
              </time>
            </div>
          )}
          <span className="sr-only" role="status">
            {completed
              ? "7 récompenses récupérées"
              : ready
                ? `Cadeau du jour ${board.claimedDays + 1} disponible`
                : ""}
          </span>
        </div>
      )}
    </HubPanel>
  );
}
