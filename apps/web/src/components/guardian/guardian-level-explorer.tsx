import { useRef, useState } from "react";
import { HERO_LEVELS, heroAbilities, heroMight, heroStats } from "@sylve/game";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Heart,
  LockKeyhole,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AbilityIcon } from "@/components/game/ability-icons";
import type { HeroProgress } from "./guardian-house";

const number = (value: number) => value.toLocaleString("fr-FR");
const maxLevel = HERO_LEVELS.length;

export function GuardianLevelExplorer({
  progress,
}: {
  progress: HeroProgress;
}) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState(progress.next?.level ?? progress.level);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const selected = heroStats(level);
  const requiredMight = HERO_LEVELS[level - 2]?.nextMight ?? 0;
  const healthGain = selected.health - progress.health;
  const mightGain = heroMight(level) - heroMight(progress.level);
  const status =
    level === progress.level
      ? "Ton niveau"
      : level < progress.level
        ? "Niveau acquis"
        : level === progress.level + 1
          ? "Prochain niveau"
          : "À venir";
  const shortcuts = [
    { level: progress.level, label: "Ton niveau" },
    { level: 11, label: "Éclaireurs · 11" },
    { level: 21, label: "Élan · 21" },
    { level: maxLevel, label: `Maximum · ${maxLevel}` },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (value) setLevel(progress.next?.level ?? progress.level);
        setOpen(value);
      }}
    >
      <DialogTrigger className="guardian-explore-levels">
        Explorer les niveaux
        <ArrowUpRight size={15} aria-hidden="true" />
      </DialogTrigger>
      <DialogContent
        className="guardian-level-dialog"
        appearance="game"
        initialFocus={titleRef}
      >
        <DialogTitle ref={titleRef} tabIndex={-1}>
          Parcours du Gardien
        </DialogTitle>
        <DialogDescription>
          Explore les {maxLevel} niveaux et leurs pouvoirs.
        </DialogDescription>
        <div className="guardian-level-controls">
          <div className="guardian-level-selector">
            <button
              type="button"
              aria-label="Niveau précédent"
              disabled={level === 1}
              onClick={() => setLevel((value) => value - 1)}
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <div aria-live="polite" aria-atomic="true">
              <span
                className="guardian-level-status"
                data-current={level === progress.level}
              >
                {status}
              </span>
              <h3>Niveau {level}</h3>
            </div>
            <button
              type="button"
              aria-label="Niveau suivant"
              disabled={level === maxLevel}
              onClick={() => setLevel((value) => value + 1)}
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>
          <label className="guardian-level-range">
            <span className="sr-only">Niveau à consulter</span>
            <input
              type="range"
              min={1}
              max={maxLevel}
              step={1}
              value={level}
              aria-valuetext={`Niveau ${level}, ${selected.health} points de vie`}
              onChange={(event) => setLevel(Number(event.target.value))}
            />
            <span aria-hidden="true">1</span>
            <span aria-hidden="true">{maxLevel}</span>
          </label>
          <div
            className="guardian-level-shortcuts"
            role="group"
            aria-label="Paliers du Gardien"
          >
            {shortcuts.map((shortcut, index) => (
              <button
                key={index}
                type="button"
                aria-pressed={level === shortcut.level}
                onClick={() => setLevel(shortcut.level)}
              >
                {shortcut.label}
              </button>
            ))}
          </div>
        </div>

        <div className="guardian-level-content">
          <dl className="guardian-level-metrics">
            <div>
              <dt>
                <Heart size={15} aria-hidden="true" />
                Points de vie
              </dt>
              <dd>
                {number(selected.health)}
                {healthGain !== 0 && (
                  <small>
                    {healthGain > 0 ? "+" : ""}
                    {number(healthGain)} PV
                  </small>
                )}
              </dd>
            </div>
            <div>
              <dt>Bonus de puissance</dt>
              <dd>
                +{number(heroMight(level))}
                {mightGain !== 0 && (
                  <small>
                    {mightGain > 0 ? "+" : ""}
                    {number(mightGain)}
                  </small>
                )}
              </dd>
            </div>
          </dl>
          <p className="guardian-level-comparison">
            Écarts par rapport à ton Gardien de niveau {progress.level}.
          </p>
          <div className="guardian-level-requirement">
            <span>
              {level === 1
                ? "Niveau de départ"
                : "Puissance requise pour ce niveau"}
            </span>
            {level > 1 && <strong>{number(requiredMight)}</strong>}
            <small>
              {level <= progress.level
                ? "Niveau déjà acquis"
                : requiredMight <= progress.peakMight
                  ? "Seuil atteint avec ton record de puissance"
                  : `Encore ${number(requiredMight - progress.peakMight)} par rapport à ton record`}
            </small>
          </div>
          <h4 className="guardian-level-powers-title">Pouvoirs à ce niveau</h4>
          <ul
            className="guardian-level-powers"
            aria-label={`Pouvoirs au niveau ${level}`}
          >
            {heroAbilities(level, 0, 1).map((power) => {
              const locked = level < power.unlockLevel;
              const detail =
                power.id === "storm"
                  ? `${power.value} dégâts à toutes les unités ennemies`
                  : power.id === "call_to_arms"
                    ? `2 éclaireuses · ${selected.archerAttack} ATQ / ${selected.archerHealth} PV`
                    : power.id === "heavenly_power"
                      ? `+${power.value} ATQ aux alliés pour un tour`
                      : `${power.value} dégâts au héros, puis +${power.value} par carte`;
              return (
                <li key={power.id} data-locked={locked}>
                  <AbilityIcon
                    kind={
                      power.id === "call_to_arms"
                        ? "reinforcement"
                        : power.id === "heavenly_power"
                          ? "temporary"
                          : "power"
                    }
                  />
                  <div>
                    <strong>{power.name}</strong>
                    <p>
                      {locked ? (
                        <>
                          <LockKeyhole size={11} aria-hidden="true" />À
                          débloquer au niveau {power.unlockLevel}
                        </>
                      ) : (
                        detail
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
