import { useRef, useState, type CSSProperties } from "react";
import { useCemeteryDialog } from "./use-cemetery-dialog";
import {
  ArrowLeft,
  ArrowRight,
  Axe,
  BookOpen,
  Check,
  ChevronRight,
  Clover,
  Coins,
  Copy,
  Crown,
  Droplets,
  Expand,
  Feather,
  Flame,
  Gem,
  Heart,
  Hourglass,
  Leaf,
  LoaderCircle,
  Magnet,
  Play,
  Shield,
  Skull,
  Sparkles,
  Sprout,
  Sword,
  Timer,
  Trophy,
  WandSparkles,
  Wind,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  CEMETERY_WEAPONS,
  CEMETERY_PASSIVES,
  CEMETERY_UPGRADES,
  cemeteryPassive,
  upgradeCost,
  upgradeBonus,
  type CemeteryUpgrades,
  type CemeteryUpgradeId,
  type CemeteryWeaponId,
} from "@sylve/game/cemetery";
import { heroDefinition, type HeroId } from "@sylve/game/hero-metadata";
import { chestName, type ChestType } from "@sylve/game/chest-types";
import { GoldIcon } from "@/components/gold-balance";
import { EmeraldIcon } from "@/components/emerald-balance";
import { cemeteryWeaponArt, cemeteryPassiveArt, cemeteryUpgradeArt } from "./cemetery-art";

const GLYPHS: Record<string, LucideIcon> = {
  vine: Sprout,
  wand: WandSparkles,
  knife: Sword,
  axe: Axe,
  cross: Sparkles,
  book: BookOpen,
  flame: Flame,
  leaf: Leaf,
  droplet: Droplets,
  gem: Gem,
  bolt: Zap,
  star: Sparkles,
  shield: Shield,
  heart: Heart,
  sprout: Sprout,
  wind: Wind,
  hourglass: Hourglass,
  copy: Copy,
  feather: Feather,
  magnet: Magnet,
  clover: Clover,
  crown: Crown,
  coins: Coins,
  skull: Skull,
  sparkles: Sparkles,
  sword: Sword,
  timer: Timer,
  expand: Expand,
};
export function CemeteryGlyph({
  name,
  size = 22,
  art,
  label = "",
}: {
  name: string;
  size?: number;
  art?: string;
  label?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const Icon = GLYPHS[name] ?? Sparkles;
  if (art && failed !== art)
    return <img className="cemetery-art-image" src={art} alt={label}
      aria-hidden={label ? undefined : true} width={size} height={size}
      loading="eager" decoding="async" onError={() => setFailed(art)} />;
  return <Icon size={size} aria-hidden={label ? undefined : true}
    role={label ? "img" : undefined} aria-label={label || undefined} strokeWidth={1.6} />;
}
export function cemeteryTime(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}
export function cemeteryWeaponBonus(
  id: CemeteryWeaponId,
  currentLevel: number,
) {
  const delta = CEMETERY_WEAPONS.find((w) => w.id === id)!.levels[
    currentLevel - 1
  ];
  if (!delta) return "Arme au niveau maximum.";
  const value = (n: number, percent = false) =>
    `${n > 0 ? "+" : ""}${Number((n * (percent ? 100 : 1)).toFixed(2)).toLocaleString("fr-FR")}`;
  const parts: string[] = [];
  if (delta.damage) parts.push(`Dégâts ${value(delta.damage)}`);
  if (delta.amount) parts.push(`Projectiles ${value(delta.amount)}`);
  if (delta.area) parts.push(`Zone ${value(delta.area, true)} %`);
  if (delta.speed)
    parts.push(`Vitesse des projectiles ${value(delta.speed, true)} %`);
  if (delta.duration) parts.push(`Durée ${value(delta.duration)} s`);
  if (delta.cooldown) parts.push(`Recharge ${value(delta.cooldown)} s`);
  if (delta.interval) parts.push(`Intervalle ${value(delta.interval)} s`);
  if (delta.pierce) parts.push(`Ennemis traversés ${value(delta.pierce)}`);
  if (delta.chance)
    parts.push(`Préservation du butin ${value(delta.chance, true)} %`);
  return parts.join(" · ");
}
export const CEMETERY_REWARD_TIERS: readonly {
  rarity: ChestType;
  at: number;
}[] = [
  { rarity: "common", at: 0 },
  { rarity: "rare", at: 300 },
  { rarity: "bigRare", at: 600 },
  { rarity: "epic", at: 900 },
  { rarity: "legendary", at: 1200 },
];
export interface CemeteryLobbyProps {
  initialTab?: "play" | "upgrades";
  heroId: HeroId;
  gold: number;
  emeralds: number;
  upgrades: CemeteryUpgrades;
  bestSeconds: number;
  activeRun: { id: string; seconds: number; level: number } | null;
  pendingRewards: { id: string; rarity: ChestType }[];
  busy: boolean;
  initialized: boolean;
  onStart: () => void;
  onResume: () => void;
  onAbandon: () => void;
  onOpen: (id: string) => void;
  onBuy: (
    id: CemeteryUpgradeId,
    rank: number,
    currency: "gold" | "emeralds",
  ) => void;
}
export function CemeteryLobby(props: CemeteryLobbyProps) {
  const [tab, setTab] = useState<"play" | "upgrades" | "arsenal">(
      props.initialTab ?? "play",
    ),
    [arsenalTab, setArsenalTab] = useState<"weapons" | "passives">("weapons"),
    [selected, setSelected] = useState<CemeteryWeaponId>("wand"),
    [confirmAbandon, setConfirmAbandon] = useState(false);
  const hero = heroDefinition(props.heroId),
    selectedWeapon = CEMETERY_WEAPONS.find((w) => w.id === selected)!;
  const root = useRef<HTMLDivElement>(null);
  useCemeteryDialog(root, confirmAbandon);
  function changeTab(next: typeof tab) {
    setTab(next);
    root.current?.closest(".cemetery-page")?.scrollTo({ top: 0, behavior: "instant" });
  }
  return (
    <div className="cemetery-lobby" ref={root}>
      {tab === "play" ? (
        <>
          <div className="cemetery-hero-layout">
            <section className="cemetery-intro">
              <h1>
                Le Puits
                <br />
                <em>oublié</em>
              </h1>
              <span className="cemetery-record">
                <Trophy size={15} /> Record
                <strong>{cemeteryTime(props.bestSeconds)}</strong>
              </span>
              <div className="cemetery-start-actions">
                <button
                  type="button"
                  className="cemetery-primary"
                  aria-label={props.activeRun ? "Reprendre la partie" : "Lancer une partie"}
                  onClick={props.activeRun ? props.onResume : props.onStart}
                  disabled={props.busy || (!props.activeRun && !props.initialized)}
                >
                  {props.busy || (!props.activeRun && !props.initialized) ? (
                    <LoaderCircle className="animate-spin" size={20} />
                  ) : (
                    <Play size={20} fill="currentColor" />
                  )}
                  {props.activeRun ? "Reprendre" : "Jouer"}
                  <ArrowRight size={20} />
                </button>
                {props.activeRun && (
                  <p className="cemetery-save-note">
                    {cemeteryTime(props.activeRun.seconds)} · Niveau {props.activeRun.level}
                  </p>
                )}
                <nav className="cemetery-menu-actions" aria-label="Menu du cimetière">
                  <button type="button" onClick={() => changeTab("upgrades")}>
                    <Sparkles size={16} /> Améliorations
                  </button>
                  <button type="button" onClick={() => changeTab("arsenal")}>
                    <BookOpen size={16} /> Arsenal
                  </button>
                </nav>
                {props.activeRun && (
                  <button
                    type="button"
                    className="cemetery-text-button"
                    aria-label="Abandonner cette partie"
                    onClick={() => setConfirmAbandon(true)}
                    disabled={props.busy}
                  >
                    Abandonner
                  </button>
                )}
              </div>
            </section>
            <aside className="cemetery-guardian-card">
              <div className="cemetery-guardian-halo" />
              <div className="cemetery-guardian-rune" aria-hidden="true">
                ✧
              </div>
              <img
                src={hero.portrait}
                alt={hero.name}
                className="cemetery-guardian-art"
              />
              <div className="cemetery-guardian-caption">
                <h2>{hero.name}</h2>
                <div>
                  <span>
                    <Heart size={15} />{" "}
                    {Math.round(100 * 1.1 ** (props.upgrades.health ?? 0))} PV
                  </span>
                  <span>
                    <WandSparkles size={15} /> Baguette sylvestre
                  </span>
                </div>
              </div>
            </aside>
          </div>
          {props.pendingRewards.length > 0 && (
            <section className="cemetery-pending" aria-label="Coffres à ouvrir">
              <div>
                <Gem size={20} />
                <span>Coffres à ouvrir</span>
              </div>
              <div>
                {props.pendingRewards.map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => props.onOpen(r.id)}
                    disabled={props.busy}
                  >
                    <img src={`/art/chests/${r.rarity}.webp`} alt="" />
                    Ouvrir le {chestName(r.rarity).toLowerCase()}
                    <ChevronRight size={16} />
                  </button>
                ))}
              </div>
            </section>
          )}
          <section className="cemetery-rewards">
            <div className="cemetery-section-heading">
              <h2>Récompenses</h2>
              <span>Un coffre à la mort</span>
            </div>
            <div className="cemetery-chest-track">
              {CEMETERY_REWARD_TIERS.map((tier, i) => (
                <div
                  key={tier.rarity}
                  className={`cemetery-chest-tier rarity-${tier.rarity}`}
                >
                  <span className="cemetery-tier-line" aria-hidden="true" />
                  <img
                    src={`/art/chests/${tier.rarity}.webp`}
                    alt={chestName(tier.rarity)}
                  />
                  <strong>
                    {
                      ["Commun", "Rare", "Grand rare", "Épique", "Légendaire"][
                        i
                      ]
                    }
                  </strong>
                  <span>{cemeteryTime(tier.at)}</span>
                </div>
              ))}
            </div>
          </section>
          <footer className="cemetery-lobby-footer">
            <span>
              <span className="cemetery-key">ZQSD</span>
              <span className="cemetery-key">WASD</span>
              <span className="cemetery-key">↑ ↓ ← →</span>
              Déplacement
            </span>
            <span><span className="cemetery-key">Échap</span> Pause</span>
            <span className="cemetery-touch-hint">Joystick pour se déplacer</span>
          </footer>
        </>
      ) : tab === "upgrades" ? (
        <section className="cemetery-panel-content">
          <button type="button" className="cemetery-text-button cemetery-panel-back" onClick={() => changeTab("play")}>
            <ArrowLeft size={16} /> Retour au menu
          </button>
          <div className="cemetery-section-title">
            <h1>Améliorations</h1>
          </div>
          {props.activeRun && (
            <p className="cemetery-notice">
              <Shield size={17} />
              <span>Achats disponibles après la partie.</span>
              <button type="button" disabled={props.busy} onClick={props.onResume}>
                Reprendre <ArrowRight size={15} />
              </button>
            </p>
          )}
          <div className="cemetery-upgrade-grid">
            {CEMETERY_UPGRADES.map((u) => {
              const rank = props.upgrades[u.id] ?? 0,
                maxed = rank >= u.max,
                cost = maxed ? null : upgradeCost(u.id, rank),
                disabled =
                  props.busy || !!props.activeRun || !props.initialized;
              return (
                <article
                  className={`cemetery-upgrade-card ${maxed ? "is-maxed" : ""}`}
                  key={u.id}
                >
                  <div className="cemetery-upgrade-heading">
                    <span className="cemetery-item-icon">
                      <CemeteryGlyph name={u.glyph} art={cemeteryUpgradeArt(u.id)} size={36} />
                    </span>
                    <div>
                      <h2>{u.name}</h2>
                      <span>
                        Rang {rank} / {u.max}
                      </span>
                    </div>
                    {maxed && <Check size={18} />}
                  </div>
                  <p>{u.description}</p>
                  <div className="cemetery-upgrade-bonus">
                    <span aria-label={`Bonus actuel : ${upgradeBonus(u.id, rank)}`}>{upgradeBonus(u.id, rank)}</span>
                    {!maxed && (
                      <>
                        <ArrowRight size={14} />
                        <strong aria-label={`Prochain rang : ${upgradeBonus(u.id, rank + 1)}`}>{upgradeBonus(u.id, rank + 1)}</strong>
                      </>
                    )}
                  </div>
                  {cost ? (
                    <div className="cemetery-purchase-buttons">
                      <button
                        type="button"
                        aria-label={`Acheter ${u.name} en or, ${cost.gold} pièces`}
                        title={props.activeRun ? "Achats disponibles après la partie" : props.gold < cost.gold ? "Or insuffisant" : "Acheter en or"}
                        disabled={disabled || props.gold < cost.gold}
                        onClick={() => props.onBuy(u.id, rank, "gold")}
                      >
                        <GoldIcon />
                        {cost.gold.toLocaleString("fr-FR")}
                      </button>
                      <button
                        type="button"
                        aria-label={`Acheter ${u.name} en émeraudes, ${cost.emeralds} ${cost.emeralds === 1 ? "émeraude" : "émeraudes"}`}
                        title={props.activeRun ? "Achats disponibles après la partie" : props.emeralds < cost.emeralds ? "Émeraudes insuffisantes" : "Acheter en émeraudes"}
                        disabled={disabled || props.emeralds < cost.emeralds}
                        onClick={() => props.onBuy(u.id, rank, "emeralds")}
                      >
                        <EmeraldIcon />
                        {cost.emeralds}
                      </button>
                    </div>
                  ) : (
                    <div className="cemetery-maxed-label">
                      <Check size={15} /> Maximum
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="cemetery-panel-content cemetery-arsenal-panel">
          <button type="button" className="cemetery-text-button cemetery-panel-back" onClick={() => changeTab("play")}>
            <ArrowLeft size={16} /> Retour au menu
          </button>
          <div className="cemetery-arsenal-header">
            <div className="cemetery-section-title">
              <h1>Arsenal</h1>
              <p>6 armes · 6 objets maximum</p>
            </div>
            <div className="cemetery-arsenal-switch">
              <button
                type="button"
                onClick={() => setArsenalTab("weapons")}
                aria-pressed={arsenalTab === "weapons"}
              >
                Armes <span>12</span>
              </button>
              <button
                type="button"
                onClick={() => setArsenalTab("passives")}
                aria-pressed={arsenalTab === "passives"}
              >
                Objets <span>16</span>
              </button>
            </div>
          </div>
          {arsenalTab === "weapons" ? (
            <div className="cemetery-arsenal-layout">
              <div className="cemetery-weapon-list">
                {CEMETERY_WEAPONS.map((w) => (
                  <button
                    type="button"
                    key={w.id}
                    aria-label={w.name}
                    title={w.name}
                    aria-pressed={selected === w.id}
                    aria-controls="cemetery-weapon-details"
                    onClick={() => setSelected(w.id)}
                    style={
                      {
                        "--item-color": `#${w.color.toString(16).padStart(6, "0")}`,
                      } as CSSProperties
                    }
                  >
                    <span className="cemetery-item-icon">
                      <CemeteryGlyph name={w.glyph} art={cemeteryWeaponArt(w.id)} size={30} />
                    </span>
                    <span className="cemetery-weapon-name">
                      {w.name}
                    </span>
                  </button>
                ))}
              </div>
              <article className="cemetery-evolution-card" id="cemetery-weapon-details">
                <div className="cemetery-evolution-stages">
                  <section className="cemetery-weapon-stage">
                    <span className="cemetery-stage-label">Arme</span>
                    <div className="cemetery-evolution-icon">
                      <CemeteryGlyph name={selectedWeapon.glyph} art={cemeteryWeaponArt(selectedWeapon.id)} size={88} />
                    </div>
                    <h2>{selectedWeapon.name}</h2>
                    <p>{selectedWeapon.description}</p>
                  </section>
                  <section className="cemetery-weapon-stage is-evolved">
                    <span className="cemetery-stage-label">Évolution</span>
                    <div className="cemetery-evolution-icon">
                      <CemeteryGlyph name={selectedWeapon.glyph} art={cemeteryWeaponArt(selectedWeapon.id, true)} size={88} />
                    </div>
                    <h3>{selectedWeapon.evolvedName}</h3>
                    <p>{selectedWeapon.evolvedDescription}</p>
                  </section>
                </div>
                <div className="cemetery-evolution-recipe">
                  <span>Arme niv. 8</span>
                  <span>+</span>
                  <span>
                    <CemeteryGlyph
                      name={cemeteryPassive(selectedWeapon.passive).glyph}
                      art={cemeteryPassiveArt(selectedWeapon.passive)}
                      size={26}
                    />
                    {cemeteryPassive(selectedWeapon.passive).name}
                  </span>
                </div>
                <small>
                  Reliquaire de boss · À partir de 10:00
                </small>
              </article>
            </div>
          ) : (
            <div className="cemetery-passive-grid">
              {CEMETERY_PASSIVES.map((p) => (
                <article key={p.id}>
                  <span className="cemetery-item-icon">
                    <CemeteryGlyph name={p.glyph} art={cemeteryPassiveArt(p.id)} size={36} />
                  </span>
                  <div>
                    <h2>{p.name}</h2>
                    <p>{p.description}</p>
                    <small>{p.max} niveaux</small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      {confirmAbandon && (
        <div className="cemetery-modal-shade">
          <section
            className="cemetery-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cemetery-abandon-title"
          >
            <button
              type="button"
              className="cemetery-close"
              aria-label="Fermer"
              onClick={() => setConfirmAbandon(false)}
            >
              <X size={20} />
            </button>
            <Skull size={32} />
            <h2 id="cemetery-abandon-title">Abandonner la partie ?</h2>
            <p>Aucun or ni coffre ne sera gagné.</p>
            <button
              type="button"
              className="cemetery-primary"
              onClick={() => {
                setConfirmAbandon(false);
                props.onAbandon();
              }}
            >
              Abandonner la partie
            </button>
            <button
              type="button"
              className="cemetery-text-button"
              onClick={() => setConfirmAbandon(false)}
            >
              Annuler
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
