import { LoaderCircle } from "lucide-react";
import type { cemeterySummary } from "@sylve/game/cemetery";
import { heroDefinition, type HeroId } from "@sylve/game/hero-metadata";
import { chestName } from "@sylve/game/chest-types";
import { cemeteryTime } from "./cemetery-lobby";
import { cemeteryPassiveArt, cemeteryPickupArt } from "./cemetery-art";

interface CemeteryResultsProps {
  heroId: HeroId;
  summary: ReturnType<typeof cemeterySummary>;
  busy: boolean;
  settled: boolean;
  rewardOpened: boolean;
  saveError: boolean;
  onOpen: () => void;
  onImprove: () => void;
  onReplay: () => void;
  onMenu: () => void;
  onRetrySave: () => void;
}

export function CemeteryResults({
  heroId, summary, busy, settled, rewardOpened, saveError,
  onOpen, onImprove, onReplay, onMenu, onRetrySave,
}: CemeteryResultsProps) {
  const hero = heroDefinition(heroId);
  const chest = `/art/chests/${summary.rarity}${rewardOpened ? "-open" : ""}.webp`;
  return (
    <section
      className="cemetery-modal cemetery-results"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cemetery-result-title"
    >
      <header className="cemetery-result-heading">
        <h2 id="cemetery-result-title">Partie terminée</h2>
        <div className="cemetery-result-duration" aria-label="Temps de survie">
          <img src="/art/ui/rewards-clock.webp" alt="" draggable={false} />
          <strong>{cemeteryTime(summary.seconds)}</strong>
        </div>
      </header>
      <div className="cemetery-result-body">
        <div className="cemetery-result-overview">
          <div className="cemetery-result-guardian">
            <img src={hero.portrait} alt="" draggable={false} />
            <span>{hero.name}</span>
          </div>
          <div className="cemetery-result-stats">
            <span>
              <img src={cemeteryPassiveArt("skull")} alt="" draggable={false} />
              <strong>{summary.kills.toLocaleString("fr-FR")}</strong>ennemis
            </span>
            <span>
              <img src={cemeteryPickupArt("xp", 10)} alt="" draggable={false} />
              <strong>{summary.level}</strong>niveau
            </span>
            <span>
              <img src="/art/cemetery/boss-v1.webp" alt="" draggable={false} />
              <strong>{summary.bosses}</strong>boss
            </span>
          </div>
        </div>
        <div className="cemetery-result-reward">
          <img className="cemetery-result-chest" src={chest} alt={chestName(summary.rarity)} draggable={false} />
          <h3>{chestName(summary.rarity)}</h3>
          <span className="cemetery-result-gold">
            <img src={cemeteryPickupArt("gold")} alt="" draggable={false} />
            + {summary.gold.toLocaleString("fr-FR")} or ramassé
          </span>
          <button
            type="button"
            className="cemetery-primary"
            disabled={busy || !settled || rewardOpened}
            onClick={onOpen}
          >
            {!settled ? <LoaderCircle className="animate-spin" size={18} /> : <img src={chest} alt="" draggable={false} />}
            {!settled ? "Validation…" : rewardOpened ? "Coffre ouvert" : "Ouvrir le coffre"}
          </button>
        </div>
      </div>
      <div className="cemetery-result-actions">
        <button type="button" disabled={!settled || busy} onClick={onImprove}>
          <img src="/art/ui/card-level-up.webp" alt="" draggable={false} />
          Améliorer
        </button>
        <button type="button" disabled={!settled || busy} onClick={onReplay}>
          <img src="/art/ui/arena-swords.webp" alt="" draggable={false} />
          Rejouer
        </button>
      </div>
      <button type="button" className="cemetery-text-button cemetery-result-menu" onClick={onMenu}>
        <img src="/art/ui/back-arrow.webp" alt="" draggable={false} />
        Retour au menu
      </button>
      {!settled && saveError && (
        <button type="button" className="cemetery-text-button" onClick={onRetrySave}>
          Réessayer la sauvegarde
        </button>
      )}
    </section>
  );
}
