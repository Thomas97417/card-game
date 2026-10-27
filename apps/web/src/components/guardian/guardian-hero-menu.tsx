import { useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Check, LockKeyhole } from "lucide-react";
import {
  HEROES,
  FACTION_LABELS,
  heroDefinition,
  heroStats,
  maxHeroLevel,
  type HeroId,
} from "@sylve/game";
import { leagueAt } from "@sylve/game/leagues";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmeraldAmount } from "@/components/emerald-balance";
import { GameIcon } from "@/components/game/game-icon";
import { HeroPowerList } from "@/components/game/hero-power-list";
import { showGameError } from "@/components/game/shared";
import type { HeroProgress } from "./guardian-house";

export function GuardianHeroMenu({
  progress,
  unlockedHeroIds,
  emeralds,
  peakTrophies,
  disabled,
  onUnlock,
  onSelect,
  children,
}: {
  progress: HeroProgress;
  unlockedHeroIds: readonly HeroId[];
  emeralds: number | null | undefined;
  peakTrophies: number;
  disabled?: boolean;
  onUnlock: (heroId: HeroId) => Promise<unknown>;
  onSelect: (heroId: HeroId) => Promise<unknown>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [previewId, setPreviewId] = useState(progress.heroId);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const hero = heroDefinition(previewId);
  const level = Math.min(progress.progressionLevel, maxHeroLevel(previewId));
  const stats = heroStats(level, previewId);
  const owned = previewId === "sylve" || unlockedHeroIds.includes(previewId);
  const active = progress.heroId === previewId;
  const leagueLocked = peakTrophies < hero.requiredTrophies;
  const missing = Math.max(0, hero.emeraldCost - (emeralds ?? 0));

  async function choose() {
    if (inFlight.current || active) return;
    if (!owned && (leagueLocked || emeralds == null || missing > 0)) return;
    inFlight.current = true;
    setPending(true);
    setNotice("");
    try {
      if (owned) {
        await onSelect(previewId);
        setOpen(false);
      } else {
        await onUnlock(previewId);
        setNotice(`${hero.name} est débloqué. Tu peux maintenant le choisir.`);
      }
    } catch (error) {
      showGameError(error);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (pending) return;
        if (value) {
          setPreviewId(progress.heroId);
          setNotice("");
        }
        setOpen(value);
      }}
    >
      <DialogTrigger
        className="guardian-portrait guardian-portrait-trigger"
        aria-label="Changer de héros"
        title="Changer de héros"
        disabled={disabled}
      >
        {children}
      </DialogTrigger>
      <DialogContent
        className="guardian-roster-dialog"
        appearance="game"
        initialFocus={titleRef}
      >
        <DialogTitle ref={titleRef} tabIndex={-1}>
          Choisis ton gardien
        </DialogTitle>
        <p className="guardian-roster-intro">
          Débloque de nouvelles stratégies. Tes niveaux acquis sont conservés et
          les duels en cours gardent leur héros.
        </p>
        <div className="guardian-roster-layout">
          <div
            className="guardian-roster-list"
            role="group"
            aria-label="Héros disponibles"
          >
            {HEROES.map((entry) => {
              const isOwned =
                entry.id === "sylve" || unlockedHeroIds.includes(entry.id);
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={entry.id === previewId}
                  disabled={pending}
                  onClick={() => {
                    setPreviewId(entry.id);
                    setNotice("");
                  }}
                  className="guardian-roster-entry"
                >
                  <span className="guardian-roster-thumb">
                    <img
                      src={entry.portrait}
                      alt=""
                      width={64}
                      height={76}
                      loading="lazy"
                      draggable={false}
                    />
                  </span>
                  <span className="guardian-roster-entry-copy">
                    <strong>{entry.name}</strong>
                    <small>
                      {FACTION_LABELS[entry.faction]} ·{" "}
                      {entry.id === progress.heroId
                        ? "Actif"
                        : isOwned
                          ? "Débloqué"
                          : `${entry.emeraldCost.toLocaleString("fr-FR")} émeraudes`}
                    </small>
                  </span>
                  {isOwned ? (
                    <Check size={16} aria-hidden="true" />
                  ) : (
                    <LockKeyhole size={14} aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
          <section
            className="guardian-roster-preview"
            aria-label={`Aperçu de ${hero.name}`}
            aria-busy={pending}
          >
            <div className="guardian-roster-portrait">
              <img
                src={hero.portrait}
                alt={hero.name}
                width={320}
                height={480}
                draggable={false}
              />
            </div>
            <header className="guardian-roster-identity">
              <div>
                <span className="guardian-eyebrow">
                  {FACTION_LABELS[hero.faction]}
                </span>
                <h3>{hero.name}</h3>
                <p>{hero.subtitle}</p>
                <span className="guardian-roster-health">
                  <GameIcon kind="health" size={20} />{" "}
                  {stats.health.toLocaleString("fr-FR")} PV · Niveau {level}
                </span>
              </div>
            </header>
            <HeroPowerList level={level} heroId={previewId} />
            <div className="guardian-roster-action">
              {!owned && (
                <p className="guardian-roster-requirement">
                  Achat permanent ·{" "}
                  <EmeraldAmount amount={hero.emeraldCost} />
                  {hero.requiredTrophies > 0 && (
                    <span
                      className="guardian-roster-league"
                      data-locked={leagueLocked}
                    >
                      Ligue requise : {leagueAt(hero.requiredTrophies).label}{" "}
                      · {hero.requiredTrophies.toLocaleString("fr-FR")}{" "}
                      trophées
                    </span>
                  )}
                </p>
              )}
              <button
                type="button"
                className="sylve-button"
                disabled={
                  pending ||
                  active ||
                  (!owned && (leagueLocked || emeralds == null || missing > 0))
                }
                onClick={() => void choose()}
              >
                {pending ? (
                  "En cours…"
                ) : active ? (
                  "Héros actif"
                ) : owned ? (
                  "Choisir ce héros"
                ) : (
                  <>
                    Débloquer pour <EmeraldAmount amount={hero.emeraldCost} />
                  </>
                )}
              </button>
              {!owned && !leagueLocked && emeralds != null && missing > 0 && (
                <p className="guardian-roster-missing">
                  Il te manque {missing.toLocaleString("fr-FR")}{" "}
                  {missing === 1 ? "émeraude" : "émeraudes"}.{" "}
                  <Link to="/sanctuary" hash="emerald-packs">
                    Obtenir des émeraudes
                  </Link>
                </p>
              )}
              <p role="status" className="guardian-roster-notice">
                {notice}
              </p>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
