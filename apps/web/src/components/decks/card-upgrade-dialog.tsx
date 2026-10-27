import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Tabs } from "@base-ui/react/tabs";
import {
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowRightLeft,
  Crown,
  LockKeyhole,
} from "lucide-react";
import {
  maxCardLevel,
  RARITY_LABELS,
  resolveCard,
  upgradeCost,
  upgradeGoldCost,
  getCombatType,
  soulbindDefinitions,
  soulbindStatus,
  type CardDefinition,
  type OwnedCard,
} from "@sylve/game";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { CardPortrait } from "@/components/game/card-portrait";
import { StatBadge } from "@/components/game/stat-badge";
import { GameIcon } from "@/components/game/game-icon";
import { showGameError } from "@/components/game/shared";
import { GoldAmount, useGoldBalance } from "@/components/gold-balance";
import { CardAbilities } from "@/components/game/card-abilities";
import {
  CardSoulbind,
  CardEvolutionResources,
  type CardProgressionActions,
} from "./card-soulbind";

type DeckActions =
  | {
      inDeck: boolean;
      hasSpace: boolean;
      onMove: () => void;
    }
  | {
      inDeck?: never;
      hasSpace?: never;
      onMove?: never;
    };

type UpgradeActions =
  | {
      readOnly: true;
      onUpgrade?: never;
    }
  | {
      readOnly?: false;
      onUpgrade: (variantId: string) => Promise<unknown>;
    };

export function CardUpgradeDialog({
  entry,
  inDeck,
  hasSpace,
  onClose,
  onUpgrade,
  onMove,
  collection,
  soulProgress,
  onSoulbind,
  onSacrifice,
  onEvolve,
  readOnly = false,
  finalFocus,
  returnToSoulbind = false,
}: {
  entry: OwnedCard | undefined;
  onClose: () => void;
  finalFocus?: ComponentProps<typeof DialogContent>["finalFocus"];
  returnToSoulbind?: boolean;
} & UpgradeActions &
  DeckActions &
  CardProgressionActions) {
  const [busy, setBusy] = useState(false);
  const [compactNavigation, setCompactNavigation] = useState(false);
  const popup = useRef<HTMLDivElement>(null);
  const panels = useRef<HTMLDivElement>(null);
  const gold = useGoldBalance();
  const card = entry?.card;
  const level = card?.level ?? 1;
  const maximum = maxCardLevel(card?.rarity, card?.baseId);
  const max = level >= maximum;
  const cost = upgradeCost(level, card?.rarity);
  const goldCost = upgradeGoldCost(level, card?.rarity);
  const enoughGold = gold != null && gold >= goldCost;
  const next =
    card && !readOnly && !max
      ? resolveCard(card.id, level + 1, card.soulbinds)
      : null;
  const actionLabel = busy
    ? "Amélioration…"
    : max
      ? "Niveau maximal atteint"
      : `Améliorer au niveau ${level + 1}`;
  const links = card ? soulbindDefinitions(card.id) : [];
  const readyLinks =
    card && soulProgress && collection && !readOnly
      ? links.filter(
          (link) =>
            soulbindStatus(card.id, link.tier, collection, soulProgress).ready,
        ).length
      : 0;
  const hasResources = !readOnly && !!(onSacrifice || onEvolve);
  const progressionLocked = !readOnly && soulProgress?.unlocked !== true;
  const progressionLockLabel = soulProgress
    ? "Bronze IV requis"
    : "Chargement…";

  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)");
    const update = () => setCompactNavigation(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  async function upgrade() {
    if (
      readOnly ||
      !onUpgrade ||
      !card ||
      busy ||
      max ||
      !entry ||
      entry.copies < cost ||
      !enoughGold
    )
      return;
    setBusy(true);
    try {
      await onUpgrade(card.id);
    } catch (error) {
      showGameError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={!!entry}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        ref={popup}
        initialFocus={popup}
        finalFocus={finalFocus}
        className="upgrade-dialog"
        appearance="game"
        data-rarity={card?.rarity ?? "common"}
      >
        {card && entry && (
          <Tabs.Root
            key={`${card.id}:${progressionLocked ? "locked" : "unlocked"}`}
            className="upgrade-showcase"
            defaultValue="overview"
            orientation={compactNavigation ? "horizontal" : "vertical"}
            onValueChange={() => {
              const main = panels.current;
              if (!main) return;
              main.scrollTop = 0;
              const body = popup.current?.querySelector<HTMLElement>(
                '[data-slot="dialog-body"]',
              );
              if (window.innerWidth <= 600 && body) body.scrollTop = 0;
            }}
          >
            <header className="sr-only">
              <DialogTitle>{card.name}</DialogTitle>
              <DialogDescription>{card.title}</DialogDescription>
            </header>
            <div className="upgrade-companion">
              <CardPortrait card={card} />
              <div className="upgrade-companion-details">
                <div className="upgrade-mobile-identity">
                  <strong>{card.name}</strong>
                  <span>
                    {RARITY_LABELS[card.rarity ?? "common"]} · Niveau {level}
                  </span>
                </div>
                {!readOnly && onMove && (inDeck || !hasSpace) && (
                  <div className="upgrade-deck-actions">
                    <button
                      type="button"
                      className="sylve-button secondary"
                      onClick={onMove}
                    >
                      <ArrowRightLeft size={18} aria-hidden="true" />
                      {inDeck ? "Déplacer dans le deck" : "Remplacer une carte"}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <aside className="upgrade-navigation">
              <Tabs.List aria-label="Sections de la carte" activateOnFocus>
                <Tabs.Tab value="overview" className="upgrade-nav-tab">
                  <GameIcon kind="archives" size={34} />
                  <span>
                    <strong>
                      {readOnly ? "Caractéristiques" : "Amélioration"}
                    </strong>
                    <small>
                      Niveau {level} / {maximum}
                    </small>
                  </span>
                </Tabs.Tab>
                <Tabs.Tab
                  value="soulbind"
                  className="upgrade-nav-tab"
                  disabled={progressionLocked}
                >
                  <GameIcon kind="soulbind" size={34} />
                  <span>
                    <strong>Liens d’âme</strong>
                    <small>
                      {progressionLocked
                        ? progressionLockLabel
                        : readyLinks > 0
                          ? `${readyLinks} disponible${readyLinks > 1 ? "s" : ""}`
                          : `${card.soulbinds?.length ?? 0} / ${links.length} actifs`}
                    </small>
                  </span>
                  {progressionLocked ? (
                    <LockKeyhole
                      className="upgrade-nav-lock"
                      size={14}
                      aria-hidden="true"
                    />
                  ) : (
                    readyLinks > 0 && (
                      <span className="upgrade-nav-ready" aria-hidden="true" />
                    )
                  )}
                </Tabs.Tab>
                {hasResources && (
                  <Tabs.Tab
                    value="resources"
                    className="upgrade-nav-tab"
                    disabled={progressionLocked}
                  >
                    <GameIcon kind="soulDust" size={34} />
                    <span>
                      <strong>Évolution et poussière</strong>
                      <small>
                        {progressionLocked
                          ? progressionLockLabel
                          : `${entry.copies} en réserve`}
                      </small>
                    </span>
                    {progressionLocked && (
                      <LockKeyhole
                        className="upgrade-nav-lock"
                        size={14}
                        aria-hidden="true"
                      />
                    )}
                  </Tabs.Tab>
                )}
              </Tabs.List>
            </aside>
            <div className="upgrade-main" ref={panels}>
              {returnToSoulbind && (
                <button
                  type="button"
                  className="upgrade-return"
                  onClick={onClose}
                >
                  <ArrowLeft size={15} aria-hidden="true" />
                  Retour aux liens d’âme
                </button>
              )}
              <Tabs.Panel
                value="overview"
                className="upgrade-panel"
                keepMounted
              >
                <header className="upgrade-view-heading">
                  <h2>{readOnly ? "Caractéristiques" : "Amélioration"}</h2>
                </header>
                {!readOnly && (
                  <section
                    className="upgrade-progression"
                    aria-label="Progression de la carte"
                    data-ready={max || entry.copies >= cost}
                  >
                    <div className="upgrade-section-heading">
                      <h3>
                        {max
                          ? "Niveau maximal atteint"
                          : "Progression du niveau"}
                      </h3>
                    </div>
                    <div className="upgrade-progress-track">
                      <progress
                        className="upgrade-progress"
                        max={max ? Math.max(1, entry.copies) : cost}
                        value={max ? Math.max(1, entry.copies) : entry.copies}
                        aria-label={
                          max
                            ? "Niveau maximal atteint"
                            : "Exemplaires pour le prochain niveau"
                        }
                      />
                      <span className="upgrade-copies">
                        <img
                          className="upgrade-copies-icon"
                          src={`/art/ui/rarity-${card.rarity ?? "common"}.webp`}
                          width={18}
                          height={24}
                          alt=""
                          aria-hidden="true"
                          draggable={false}
                        />
                        <span>
                          {max
                            ? `Niveau ${level} / ${maximum}`
                            : `${entry.copies}/${cost}`}
                        </span>
                      </span>
                      <span className="upgrade-next-level" aria-hidden="true">
                        {max ? <Crown size={23} /> : level + 1}
                      </span>
                    </div>
                    {(max || entry.copies < cost) && (
                      <p className="upgrade-progress-note">
                        {max
                          ? `${entry.copies} ${entry.copies === 1 ? "exemplaire" : "exemplaires"} en réserve`
                          : `Encore ${cost - entry.copies} ${cost - entry.copies === 1 ? "exemplaire" : "exemplaires"} à collectionner`}
                      </p>
                    )}
                  </section>
                )}

                <section
                  className="upgrade-statistics"
                  aria-label="Caractéristiques"
                >
                  <div className="upgrade-section-heading">
                    <h3>Caractéristiques</h3>
                    <span>
                      {next ? `Niv. ${level} → ${level + 1}` : `Niv. ${level}`}
                    </span>
                  </div>
                  <dl className="upgrade-stats">
                    {(
                      [
                        { kind: "attack", label: "Attaque" },
                        { kind: "health", label: "Vie maximale" },
                      ] as const
                    ).map(({ kind, label }) => (
                      <div className="upgrade-stat" key={kind}>
                        <dt>{label}</dt>
                        <dd>
                          <StatBadge
                            kind={kind}
                            value={card[kind]}
                            combatType={getCombatType(card)}
                          />
                          {next && (
                            <>
                              <ArrowRight size={16} aria-hidden="true" />
                              <strong
                                className="upgrade-stat-next"
                                aria-label={`${next[kind]} au niveau ${level + 1}`}
                              >
                                {next[kind]}
                              </strong>
                            </>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <CardAbilities card={card} next={next} />

                {!readOnly && (
                  <div className="upgrade-evolution-action">
                    <div className="upgrade-section-heading">
                      <h3>
                        {max ? "Niveau maximal" : "Prochaine amélioration"}
                      </h3>
                      {next && (
                        <span
                          className="upgrade-gains"
                          aria-label="Gains au prochain niveau"
                        >
                          <span>
                            +{next.attack - card.attack}
                            <GameIcon kind={getCombatType(card)} size={20} />
                          </span>
                          <span>
                            +{next.health - card.health}
                            <GameIcon kind="health" size={20} />
                          </span>
                        </span>
                      )}
                    </div>
                    <button
                      className="sylve-button upgrade-action"
                      disabled={
                        busy || max || entry.copies < cost || !enoughGold
                      }
                      aria-label={actionLabel}
                      onClick={() => void upgrade()}
                    >
                      <span className="upgrade-action-label">
                        {max ? <Crown size={19} /> : <ArrowUp size={17} />}
                        {actionLabel}
                      </span>
                      {!max && <GoldAmount amount={goldCost} />}
                    </button>
                  </div>
                )}
              </Tabs.Panel>
              <Tabs.Panel
                value="soulbind"
                className="upgrade-panel"
                keepMounted
              >
                <SoulbindExplorer
                  card={card}
                  readOnly={readOnly}
                  onUpgrade={onUpgrade}
                  collection={collection}
                  soulProgress={soulProgress}
                  onSoulbind={onSoulbind}
                  onSacrifice={onSacrifice}
                  onEvolve={onEvolve}
                />
              </Tabs.Panel>
              {hasResources && (
                <Tabs.Panel
                  value="resources"
                  className="upgrade-panel"
                  keepMounted
                >
                  <CardEvolutionResources
                    entry={entry}
                    collection={collection}
                    soulProgress={soulProgress}
                    onSacrifice={onSacrifice}
                    onEvolve={onEvolve}
                    presentation="page"
                  />
                </Tabs.Panel>
              )}
            </div>
          </Tabs.Root>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function SoulbindExplorer({
  card,
  readOnly,
  onUpgrade,
  collection,
  soulProgress,
  onSoulbind,
  onSacrifice,
  onEvolve,
}: {
  card: CardDefinition;
  readOnly: boolean;
  onUpgrade?: (variantId: string) => Promise<unknown>;
} & CardProgressionActions) {
  const [inspected, setInspected] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const owned = collection?.find((entry) => entry.card.id === inspected);
  const entry = inspected
    ? (owned ?? { card: resolveCard(inspected), copies: 0 })
    : undefined;

  return (
    <>
      <CardSoulbind
        card={card}
        collection={readOnly ? undefined : collection}
        soulProgress={readOnly ? undefined : soulProgress}
        onSoulbind={readOnly ? undefined : onSoulbind}
        presentation="page"
        onInspect={(variantId, element) => {
          trigger.current = element;
          setInspected(variantId);
        }}
      />
      <CardUpgradeDialog
        entry={entry}
        onClose={() => setInspected(null)}
        finalFocus={trigger}
        returnToSoulbind
        collection={collection}
        soulProgress={soulProgress}
        onSoulbind={onSoulbind}
        onSacrifice={onSacrifice}
        onEvolve={onEvolve}
        {...(!readOnly && owned && onUpgrade
          ? { onUpgrade }
          : { readOnly: true })}
      />
    </>
  );
}
