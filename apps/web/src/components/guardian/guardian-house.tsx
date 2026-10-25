import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  HERO_LEVELS,
  heroAbilities,
  heroMight,
  type heroProgress,
} from "@sylve/game";
import { ArrowRight, ArrowUp, Check, Heart, Sparkles } from "lucide-react";
import { GameHeader } from "@/components/game-header";
import { HeroPowerList } from "@/components/game/hero-power-list";
import { showGameError } from "@/components/game/shared";

export type HeroProgress = ReturnType<typeof heroProgress>;
const number = (value: number) => value.toLocaleString("fr-FR");

export function GuardianHouse({
  progress,
  onUpgrade,
}: {
  progress: HeroProgress | undefined;
  onUpgrade: (expectedLevel: number) => Promise<unknown>;
}) {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const next = progress?.next;
  const unlocks = next
    ? heroAbilities(next.level, 0, 1).filter(
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
            <h1 id="guardian-name">Gardien de la Sylve</h1>
            <p>Le protecteur de ton alliance.</p>
            <div className="guardian-portrait">
              <img
                src="/art/heroes/hero-sylve.webp"
                alt="Gardien de la Sylve"
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
                    <small>/ {HERO_LEVELS.length}</small>
                  </dd>
                </div>
                <div>
                  <dt>Points de vie</dt>
                  <dd>
                    <Heart size={22} aria-hidden="true" />
                    {number(progress.health)}
                  </dd>
                </div>
              </dl>
            )}
            <p className="guardian-permanent">
              <Check size={14} aria-hidden="true" />
              Les niveaux acquis sont permanents.
            </p>
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
                    Record : {number(progress.peakMight)}
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
                      <dd>+{number(heroMight(progress.level))}</dd>
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
                        <div>
                          <span>Tempête de feuilles</span>
                          <strong>
                            {progress.storm}
                            <ArrowRight size={16} aria-hidden="true" />
                            <em>{next.storm} dégâts</em>
                          </strong>
                        </div>
                        {next.level > 11 &&
                          (next.archerAttack !== progress.archerAttack ||
                            next.archerHealth !== progress.archerHealth) && (
                            <div>
                              <span>Éclaireuses</span>
                              <strong>
                                {next.archerAttack} ATQ / {next.archerHealth} PV
                              </strong>
                            </div>
                          )}
                        {next.level > 21 &&
                          next.attackBonus !== progress.attackBonus && (
                            <div>
                              <span>Élan de la Sylve</span>
                              <strong>+{next.attackBonus} ATQ</strong>
                            </div>
                          )}
                        {unlocks.map((power) => (
                          <p key={power.id} className="guardian-new-power">
                            <Sparkles size={14} aria-hidden="true" />
                            Nouveau pouvoir : {power.name}
                          </p>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="sylve-button guardian-upgrade"
                        disabled={pending || !progress.canUpgrade}
                        onClick={() => void upgrade()}
                      >
                        <ArrowUp size={17} aria-hidden="true" />
                        {pending
                          ? "Amélioration…"
                          : `Améliorer au niveau ${next.level}`}
                      </button>
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
                    <span>Niveau {progress.level}</span>
                  </header>
                  <HeroPowerList level={progress.level} />
                  <p className="guardian-powers-note">
                    En combat, utilise les pouvoirs dans l’ordre de la pile,
                    avant de poser ta créature. Ils ne terminent pas ton tour.
                  </p>
                </section>

                <details className="guardian-panel hero-level-table">
                  <summary>Les {HERO_LEVELS.length} niveaux du Gardien</summary>
                  <div className="guardian-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">Niv.</th>
                          <th scope="col">PV</th>
                          <th scope="col">Puissance → suivant</th>
                          <th scope="col">Tempête</th>
                          <th scope="col">Éclaireuses ATQ/PV</th>
                          <th scope="col">Élan ATQ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {HERO_LEVELS.map((row) => (
                          <tr
                            key={row.level}
                            aria-current={
                              row.level === progress.level ? "true" : undefined
                            }
                          >
                            <th scope="row">{row.level}</th>
                            <td>{row.health}</td>
                            <td>
                              {row.nextMight == null
                                ? "Max."
                                : number(row.nextMight)}
                            </td>
                            <td>{row.storm}</td>
                            <td>
                              {row.level >= 11
                                ? `${row.archerAttack}/${row.archerHealth}`
                                : "—"}
                            </td>
                            <td>{row.attackBonus || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
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
