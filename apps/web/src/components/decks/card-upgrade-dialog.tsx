import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { ArrowRight, ArrowUp, ArrowRightLeft, Crown, Plus } from "lucide-react";
import {
  maxCardLevel,
  RARITY_LABELS,
  resolveCard,
  upgradeCost,
  upgradeGoldCost,
  combatTypeLabel,
  getCombatType,
  FACTION_LABELS,
  GENDER_LABELS,
  soulbindDefinitions,
  soulbindStatus,
  type OwnedCard,
} from "@sylve/game";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreaturePortrait } from "@/components/game/creature-portrait";
import {
  CardFactionBadge,
  FactionBackdrop,
  FactionIcon,
} from "@/components/game/faction-artwork";
import { StatBadge } from "@/components/game/stat-badge";
import { GameIcon } from "@/components/game/game-icon";
import { showGameError } from "@/components/game/shared";
import { GoldAmount, useGoldBalance } from "@/components/gold-balance";
import { CardAbilities } from "@/components/game/card-abilities";
import { CardAbilityIcons } from "@/components/game/ability-icons";
import {
  CardSoulbind,
  CardEvolutionResources,
  type CardProgressionActions,
} from "./card-soulbind";

type DeckActions =
  | {
      inDeck: boolean;
      hasSpace: boolean;
      onAdd: () => void;
      onMove: () => void;
    }
  | {
      inDeck?: never;
      hasSpace?: never;
      onAdd?: never;
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
  onAdd,
  onMove,
  collection,
  soulProgress,
  onSoulbind,
  onSacrifice,
  onEvolve,
  readOnly = false,
  finalFocus,
}: {
  entry: OwnedCard | undefined;
  onClose: () => void;
  finalFocus?: ComponentProps<typeof DialogContent>["finalFocus"];
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
            key={card.id}
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
              <div className="upgrade-portrait" data-faction={card.faction}>
                <FactionBackdrop card={card} />
                <div className="upgrade-portrait-stats">
                  <StatBadge
                    kind="attack"
                    value={card.attack}
                    combatType={getCombatType(card)}
                  />
                  <StatBadge kind="health" value={card.health} />
                </div>
                <span className="upgrade-card-level">Niv. {level}</span>
                <CreaturePortrait card={card} />
                <CardFactionBadge card={card} />
                <CardAbilityIcons
                  card={card}
                  className="upgrade-portrait-abilities"
                />
                <div className="upgrade-portrait-caption">
                  <span
                    className="rarity-label"
                    data-rarity={card.rarity ?? "common"}
                  >
                    {RARITY_LABELS[card.rarity ?? "common"]}
                  </span>
                  <span className="upgrade-portrait-name" aria-hidden="true">
                    {card.name}
                  </span>
                  <span className="upgrade-card-type">
                    <GameIcon kind={getCombatType(card)} size={18} />
                    {combatTypeLabel(card)}
                    {card.faction && (
                      <>
                        <FactionIcon faction={card.faction} size={18} />
                        {FACTION_LABELS[card.faction]}
                      </>
                    )}
                    {card.gender && ` · ${GENDER_LABELS[card.gender]}`}
                  </span>
                </div>
              </div>
              <div className="upgrade-companion-details">
                <div className="upgrade-mobile-identity">
                  <strong>{card.name}</strong>
                  <span>
                    {RARITY_LABELS[card.rarity ?? "common"]} · Niveau {level}
                  </span>
                </div>
                {!readOnly && onMove && (
                  <div className="upgrade-deck-actions">
                    <button
                      type="button"
                      className="sylve-button secondary"
                      onClick={inDeck ? onMove : hasSpace ? onAdd : onMove}
                    >
                      {!inDeck && hasSpace ? (
                        <Plus size={18} aria-hidden="true" />
                      ) : (
                        <ArrowRightLeft size={18} aria-hidden="true" />
                      )}
                      {inDeck
                        ? "Déplacer dans le deck"
                        : hasSpace
                          ? "Ajouter au deck"
                          : "Remplacer une carte"}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <aside className="upgrade-navigation">
              <span className="eyebrow">EXPLORER LA CARTE</span>
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
                <Tabs.Tab value="soulbind" className="upgrade-nav-tab">
                  <GameIcon kind="soulbind" size={34} />
                  <span>
                    <strong>Liens d’âme</strong>
                    <small>
                      {readyLinks > 0
                        ? `${readyLinks} disponible${readyLinks > 1 ? "s" : ""}`
                        : `${card.soulbinds?.length ?? 0} / ${links.length} actifs`}
                    </small>
                  </span>
                  {readyLinks > 0 && (
                    <span className="upgrade-nav-ready" aria-hidden="true" />
                  )}
                </Tabs.Tab>
                {hasResources && (
                  <Tabs.Tab value="resources" className="upgrade-nav-tab">
                    <GameIcon kind="soulDust" size={34} />
                    <span>
                      <strong>Évolution et poussière</strong>
                      <small>{entry.copies} en réserve</small>
                    </span>
                  </Tabs.Tab>
                )}
              </Tabs.List>
            </aside>
            <div className="upgrade-main" ref={panels}>
              <Tabs.Panel
                value="overview"
                className="upgrade-panel"
                keepMounted
              >
                <header className="upgrade-view-heading">
                  <h2>{readOnly ? "Caractéristiques" : "Amélioration"}</h2>
                  <p>
                    {readOnly
                      ? "Les caractéristiques et capacités de ce compagnon."
                      : "Renforce ton compagnon et découvre ses prochains bonus."}
                  </p>
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
                      <span>
                        {max ? "Niveau maximal" : `Vers le niveau ${level + 1}`}
                      </span>
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
                            : `${entry.copies} / ${cost} exemplaires`}
                        </span>
                      </span>
                      <span className="upgrade-next-level" aria-hidden="true">
                        {max ? <Crown size={23} /> : level + 1}
                      </span>
                    </div>
                    <p className="upgrade-progress-note">
                      {max
                        ? `${entry.copies} ${entry.copies === 1 ? "exemplaire" : "exemplaires"} en réserve`
                        : entry.copies >= cost
                          ? "Exemplaires réunis pour le prochain niveau"
                          : `Encore ${cost - entry.copies} ${cost - entry.copies === 1 ? "exemplaire" : "exemplaires"} à collectionner`}
                    </p>
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
                <CardSoulbind
                  card={card}
                  collection={readOnly ? undefined : collection}
                  soulProgress={readOnly ? undefined : soulProgress}
                  onSoulbind={readOnly ? undefined : onSoulbind}
                  presentation="page"
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
