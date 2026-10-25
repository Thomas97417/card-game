import { useRef, useState } from "react";
import { HERO_LEVELS, heroMight, type heroProgress } from "@sylve/game";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { HeroPowerList } from "../game/hero-power-list";
import { showGameError } from "../game/shared";
import { ArrowUp, Heart, Sparkles } from "lucide-react";

export type HeroProgress = ReturnType<typeof heroProgress>;
export function HeroProgressPanel({
  progress,
  onUpgrade,
  disabled,
}: {
  progress: HeroProgress;
  onUpgrade?: (level: number) => Promise<unknown>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [pending, setPending] = useState(false);
  async function upgrade() {
    if (!onUpgrade || !progress.canUpgrade || pending || disabled) return;
    setPending(true);
    try {
      await onUpgrade(progress.level);
    } catch (error) {
      showGameError(error);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <section className="workshop-hero" aria-label="Progression du héros">
        <button
          type="button"
          className="workshop-hero-identity"
          onClick={() => setOpen(true)}
          aria-label="Voir la progression et les pouvoirs du héros"
        >
          <img
            src="/art/heroes/hero-sylve.webp"
            width={54}
            height={62}
            alt=""
          />
          <span>
            <strong>Gardien de la Sylve</strong>
            <small>
              Niveau {progress.level} <Heart size={12} /> {progress.health} PV
            </small>
          </span>
        </button>
        <div className="workshop-hero-progress">
          <span>
            <Sparkles size={13} /> Puissance{" "}
            <strong>{progress.might.toLocaleString("fr-FR")}</strong>
            <small>
              {progress.nextMight == null
                ? "Niveau maximum"
                : `/ ${progress.nextMight.toLocaleString("fr-FR")}`}
            </small>
          </span>
          <progress
            max={progress.nextMight ?? 1}
            value={
              progress.nextMight == null
                ? 1
                : Math.min(progress.peakMight, progress.nextMight)
            }
            aria-label="Puissance pour le prochain niveau du héros"
          />
        </div>
        <button
          type="button"
          className="sylve-button hero-upgrade"
          disabled={disabled || pending || !progress.canUpgrade || !onUpgrade}
          onClick={() => void upgrade()}
        >
          <ArrowUp size={15} />
          {pending
            ? "Un instant…"
            : `Niveau ${progress.level < HERO_LEVELS.length ? progress.level + 1 : "max."}`}
        </button>
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="hero-progression-dialog"
          appearance="game"
          initialFocus={titleRef}
        >
          <span className="eyebrow">GARDIEN DE LA SYLVE</span>
          <DialogTitle ref={titleRef} tabIndex={-1}>
            Ton héros · niveau {progress.level}
          </DialogTitle>
          <DialogDescription>
            Renforce ton deck pour augmenter les PV et les pouvoirs de ton
            héros. Les niveaux acquis sont permanents.
          </DialogDescription>
          <dl className="details-stats hero-details-stats">
            <div>
              <dt>Points de vie</dt>
              <dd>{progress.health}</dd>
            </div>
            <div>
              <dt>Puissance du deck</dt>
              <dd>{progress.cardMight}</dd>
            </div>
            <div>
              <dt>Bonus du héros</dt>
              <dd>+{heroMight(progress.level)}</dd>
            </div>
            <div>
              <dt>Record de puissance</dt>
              <dd>{progress.peakMight}</dd>
            </div>
          </dl>
          {progress.next && (
            <p className="hero-next-level">
              Niveau {progress.next.level} : {progress.next.health} PV ·{" "}
              {progress.nextMight} puissance requise.
              {progress.canUpgrade && " Amélioration disponible."}
            </p>
          )}
          <HeroPowerList level={progress.level} />
          <p className="details-note">
            En combat, les pouvoirs forment une pile : utilise toujours le
            premier avant les suivants, avant de poser ta créature. Ils ne
            terminent pas ton tour.
          </p>
          <details className="hero-level-table">
            <summary>Les {HERO_LEVELS.length} niveaux du héros</summary>
            <table>
              <thead>
                <tr>
                  <th>Niv.</th>
                  <th>PV</th>
                  <th>Puissance → suivant</th>
                  <th>Tempête</th>
                  <th>Éclaireuses ATQ/PV</th>
                  <th>Élan ATQ</th>
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
                    <td>{row.level}</td>
                    <td>{row.health}</td>
                    <td>{row.nextMight ?? "Max."}</td>
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
          </details>
        </DialogContent>
      </Dialog>
    </>
  );
}
