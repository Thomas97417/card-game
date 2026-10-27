import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  heroDefinition,
  maxHeroLevel,
  type HeroId,
  heroAbilities,
  heroMight,
  type heroProgress,
} from "@sylve/game";
import { ArrowRight, Sparkles } from "lucide-react";
import { GameHeader } from "@/components/game-header";
import { GameIcon } from "@/components/game/game-icon";
import { LevelUpgradeButton } from "@/components/game/level-upgrade-button";
import { HeroPowerList } from "@/components/game/hero-power-list";
import { showGameError } from "@/components/game/shared";
import { GuardianHeroMenu } from "./guardian-hero-menu";
import { GuardianLevelExplorer } from "./guardian-level-explorer";

export type HeroProgress = ReturnType<typeof heroProgress>;
const number = (value: number) => value.toLocaleString("fr-FR");

export function GuardianHouse({
  progress,
  onUpgrade,
  onUnlock,
  onSelect,
  emeralds,
  peakTrophies = 0,
  unlockedHeroIds = ["sylve"],
}: {
  progress: HeroProgress | undefined;
  onUpgrade: (expectedLevel: number) => Promise<unknown>;
  onUnlock?: (heroId: HeroId) => Promise<unknown>;
  onSelect?: (heroId: HeroId) => Promise<unknown>;
  emeralds?: number | null;
  peakTrophies?: number;
  unlockedHeroIds?: readonly HeroId[];
}) {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const next = progress?.next;
  const hero = heroDefinition(progress?.heroId);
  const currentPowers = progress
    ? heroAbilities(progress.level, 0, 1, progress.heroId)
    : [];
  const nextPowers = next
    ? heroAbilities(next.level, 0, 1, progress?.heroId)
    : [];
  const unlocks = next
    ? heroAbilities(next.level, 0, 1, progress?.heroId).filter(
        (power) => power.unlockLevel === next.level,
      )
    : [];
  const missingMight =
    progress?.nextMight == null
      ? 0
      : Math.max(0, progress.nextMight - progress.peakMight);

  async function upgrade() {
    if (!progress?.canUpgrade || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try {
      await onUpgrade(progress.level);
    } catch (error) {
      showGameError(error);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <main className="guardian-house" aria-label="Maison des gardiens">
      <img
        className="guardian-background"
        src="/art/guardian-house.webp"
        alt=""
        fetchPriority="high"
        draggable={false}
      />
      <div className="guardian-shade" />
      <GameHeader />
      <div className="guardian-scroll">
        <div className="guardian-layout" aria-busy={!progress}>
          <section
            className="guardian-identity"
            aria-labelledby="guardian-name"
          >
            <span className="guardian-eyebrow">Maison des gardiens</span>
            <h1 id="guardian-name">{hero.name}</h1>
            <p>{hero.subtitle}</p>
            {progress && onUnlock && onSelect && (
              <GuardianHeroMenu
                progress={progress}
                unlockedHeroIds={unlockedHeroIds}
                emeralds={emeralds}
                peakTrophies={peakTrophies}
                disabled={pending}
                onUnlock={onUnlock}
                onSelect={onSelect}
              />
            )}
            <div className="guardian-portrait">
              <img
                src={hero.portrait}
                alt={hero.name}
                width={320}
                height={400}
                draggable={false}
              />
              {progress && (
                <span className="guardian-level">Niveau {progress.level}</span>
              )}
            </div>
            {progress && (
              <dl className="guardian-vitals">
                <div>
                  <dt>Niveau</dt>
                  <dd>
                    {progress.level}
                    <small>/ {maxHeroLevel(progress.heroId)}</small>
                  </dd>
                </div>
                <div>
                  <dt>Points de vie</dt>
                  <dd>
                    <GameIcon kind="health" size={28} />
                    {number(progress.health)}
                  </dd>
                </div>
              </dl>
            )}
            {progress && (
              <GuardianLevelExplorer
                key={progress.heroId}
                progress={progress}
              />
            )}
          </section>

          <div className="guardian-panels">
            {progress ? (
              <>
                <section
                  className="guardian-panel guardian-progression"
                  aria-labelledby="guardian-progression-title"
                >
                  <header className="guardian-panel-heading">
                    <h2 id="guardian-progression-title">
                      {!next
                        ? "Niveau maximum atteint"
                        : progress.canUpgrade
                          ? "Amélioration disponible"
                          : `Vers le niveau ${next.level}`}
                    </h2>
                  </header>
                  <div className="guardian-might">
                    <span>Puissance actuelle</span>
                    <strong>
                      {number(progress.might)}
                      {progress.nextMight != null && (
                        <small> / {number(progress.nextMight)}</small>
                      )}
                    </strong>
                  </div>
                  <progress
                    max={progress.nextMight ?? 1}
                    value={
                      progress.nextMight == null
                        ? 1
                        : Math.min(progress.peakMight, progress.nextMight)
                    }
                    aria-label="Record de puissance pour le prochain niveau du Gardien"
                  />
                  <p className="guardian-power-record">
                    {progress.canUpgrade &&
                    progress.nextMight != null &&
                    progress.might < progress.nextMight
                      ? `Ce niveau reste disponible grâce à ton record de ${number(progress.peakMight)} de puissance.`
                      : `Record : ${number(progress.peakMight)}`}
                    {missingMight > 0 &&
                      ` · Encore ${number(missingMight)} de puissance pour le prochain niveau.`}
                  </p>
                  <dl className="guardian-might-breakdown">
                    <div>
                      <dt>Puissance du deck</dt>
                      <dd>{number(progress.cardMight)}</dd>
                    </div>
                    <div>
                      <dt>Bonus du Gardien</dt>
                      <dd>
                        +{number(heroMight(progress.level, progress.heroId))}
                      </dd>
                    </div>
                  </dl>
                  {next && (
                    <>
                      <div
                        className="guardian-next-level"
                        aria-label={`Aperçu du niveau ${next.level}`}
                      >
                        <span className="guardian-eyebrow">
                          Au niveau {next.level}
                        </span>
                        <div>
                          <span>Points de vie</span>
                          <strong>
                            {number(progress.health)}
                            <ArrowRight size={16} aria-hidden="true" />
                            <em>{number(next.health)} PV</em>
                            <small>
                              +{number(next.health - progress.health)}
                            </small>
                          </strong>
                        </div>
                        {nextPowers.slice(0, 3).map((power, index) =>
                          power.unlockLevel <= progress.level &&
                          power.description !==
                            currentPowers[index]?.description ? (
                            <div key={power.id}>
                              <span>{power.name}</span>
                              <strong>{power.valueLabel}</strong>
                            </div>
                          ) : null,
                        )}
                        {unlocks.map((power) => (
                          <p key={power.id} className="guardian-new-power">
                            <Sparkles size={14} aria-hidden="true" />
                            Nouveau pouvoir : {power.name}
                          </p>
                        ))}
                      </div>
                      <LevelUpgradeButton
                        className="guardian-upgrade"
                        label={pending ? "Amélioration…" : "Améliorer le héros"}
                        aria-label={
                          pending
                            ? "Amélioration…"
                            : `Améliorer au niveau ${next.level}`
                        }
                        disabled={pending || !progress.canUpgrade}
                        onClick={() => void upgrade()}
                      >
                        <span className="guardian-upgrade-level">
                          Niveau {next.level}
                        </span>
                      </LevelUpgradeButton>
                    </>
                  )}
                  <Link to="/decks" className="guardian-workshop-link">
                    Renforcer mon deck à l’Atelier
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </section>

                <section
                  className="guardian-panel guardian-powers"
                  aria-labelledby="guardian-powers-title"
                >
                  <header className="guardian-panel-heading">
                    <h2 id="guardian-powers-title">Pouvoirs du Gardien</h2>
                  </header>
                  <HeroPowerList
                    level={progress.level}
                    heroId={progress.heroId}
                  />
                </section>
              </>
            ) : (
              <div className="guardian-panel guardian-loading" role="status">
                Chargement de ton Gardien…
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
