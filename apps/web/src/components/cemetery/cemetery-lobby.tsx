import { useRef, useState, type CSSProperties } from "react";
import { useCemeteryDialog } from "./use-cemetery-dialog";
import {
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
  label: string;
  at: number;
}[] = [
  { rarity: "common", label: "Dès la première run", at: 0 },
  { rarity: "rare", label: "5 minutes", at: 300 },
  { rarity: "bigRare", label: "10 minutes", at: 600 },
  { rarity: "epic", label: "15 minutes", at: 900 },
  { rarity: "legendary", label: "20 minutes", at: 1200 },
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
  return (
    <div className="cemetery-lobby" ref={root}>
      <div className="cemetery-topline">
        <span className="cemetery-eyebrow">
          <span /> SOUS LE REFUGE
        </span>
        <span className="cemetery-record">
          <Trophy size={15} /> Record{" "}
          <strong>{cemeteryTime(props.bestSeconds)}</strong>
        </span>
      </div>
      <nav className="cemetery-tabs" aria-label="Menu du cimetière">
        {(
          [
            { id: "play", label: "Jouer", Icon: Play },
            { id: "upgrades", label: "Améliorations", Icon: Sparkles },
            { id: "arsenal", label: "Armes et objets", Icon: BookOpen },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>
      {tab === "play" ? (
        <>
          <div className="cemetery-hero-layout">
            <section className="cemetery-intro">
              <div className="cemetery-overline">
                <span /> LE CIMETIÈRE DES VEILLEURS
              </div>
              <h1>
                Le Puits
                <br />
                <em>oublié.</em>
              </h1>
              <p>
                Au fond du puits, la nuit ne finit jamais.
                <br />
                Tiens face aux ombres. Reviens avec leurs trésors.
              </p>
              <div className="cemetery-run-traits">
                <span>
                  <Sword size={15} /> Attaques automatiques
                </span>
                <span>
                  <Timer size={15} /> Survie sans limite
                </span>
              </div>
              {props.activeRun ? (
                <div className="cemetery-start-actions">
                  <button
                    type="button"
                    className="cemetery-primary"
                    onClick={props.onResume}
                    disabled={props.busy}
                  >
                    {props.busy ? (
                      <LoaderCircle className="animate-spin" size={20} />
                    ) : (
                      <Play size={20} fill="currentColor" />
                    )}
                    Reprendre la partie
                    <ArrowRight size={20} />
                  </button>
                  <p className="cemetery-save-note">
                    Sauvegarde · {cemeteryTime(props.activeRun.seconds)} ·
                    Niveau {props.activeRun.level}
                  </p>
                  <button
                    type="button"
                    className="cemetery-text-button"
                    onClick={() => setConfirmAbandon(true)}
                    disabled={props.busy}
                  >
                    Abandonner cette partie
                  </button>
                </div>
              ) : (
                <div className="cemetery-start-actions">
                  <button
                    type="button"
                    className="cemetery-primary"
                    onClick={props.onStart}
                    disabled={props.busy || !props.initialized}
                  >
                    {props.busy || !props.initialized ? (
                      <LoaderCircle className="animate-spin" size={20} />
                    ) : (
                      <Play size={19} fill="currentColor" />
                    )}
                    Lancer une partie
                    <ArrowRight size={20} />
                  </button>
                  <span className="cemetery-save-note">
                    Entrée gratuite · Chaque tentative compte
                  </span>
                </div>
              )}
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
                <span>TON GARDIEN</span>
                <h2>{hero.name}</h2>
                <p>Un même départ. Tes propres choix.</p>
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
                <span>Les ombres ont laissé un trésor.</span>
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
              <span>PLUS TU TIENS, PLUS TU GAGNES</span>
              <p>Un coffre de cartes et d’or à la fin de chaque survie.</p>
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
                  <span>{tier.label}</span>
                </div>
              ))}
            </div>
          </section>
          <footer className="cemetery-lobby-footer">
            <span>
              <span className="cemetery-key">ZQSD</span>
              <span className="cemetery-key">WASD</span> ou flèches pour se
              déplacer
            </span>
            <span>Joystick sur mobile · Échap pour la pause</span>
          </footer>
        </>
      ) : tab === "upgrades" ? (
        <section className="cemetery-panel-content">
          <div className="cemetery-section-title">
            <span className="cemetery-eyebrow">
              CHAQUE RETOUR TE REND PLUS FORT
            </span>
            <h1>Prépare la prochaine nuit.</h1>
            <p>
              Des améliorations permanentes pour tous tes gardiens. Choisis ta
              monnaie pour chaque rang.
            </p>
          </div>
          {props.activeRun && (
            <p className="cemetery-notice">
              <Shield size={17} /> Termine ou abandonne la partie en cours pour
              acheter des améliorations.
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
                        {rank} / {u.max} rangs
                      </span>
                    </div>
                    {maxed && <Check size={18} />}
                  </div>
                  <p>{u.description}</p>
                  <div className="cemetery-upgrade-bonus">
                    <span>{upgradeBonus(u.id, rank)}</span>
                    {!maxed && (
                      <>
                        <ArrowRight size={14} />
                        <strong>{upgradeBonus(u.id, rank + 1)}</strong>
                      </>
                    )}
                  </div>
                  <div
                    className="cemetery-rank-dots"
                    aria-label={`${rank} rangs sur ${u.max}`}
                  >
                    {Array.from({ length: u.max }, (_, i) => (
                      <span key={i} className={i < rank ? "is-owned" : ""} />
                    ))}
                  </div>
                  {cost ? (
                    <div className="cemetery-purchase-buttons">
                      <button
                        type="button"
                        aria-label={`Acheter ${u.name} en or, ${cost.gold} pièces`}
                        disabled={disabled || props.gold < cost.gold}
                        onClick={() => props.onBuy(u.id, rank, "gold")}
                      >
                        <Coins size={16} />
                        {cost.gold.toLocaleString("fr-FR")}
                        <span>or</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Acheter ${u.name} en émeraudes, ${cost.emeralds} ${cost.emeralds === 1 ? "émeraude" : "émeraudes"}`}
                        disabled={disabled || props.emeralds < cost.emeralds}
                        onClick={() => props.onBuy(u.id, rank, "emeralds")}
                      >
                        <Gem size={15} />
                        {cost.emeralds}
                        <span>
                          {cost.emeralds === 1 ? "émeraude" : "émeraudes"}
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="cemetery-maxed-label">
                      <Check size={15} /> Maîtrise complète
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="cemetery-panel-content">
          <div className="cemetery-section-title">
            <span className="cemetery-eyebrow">COMPOSE TON ARSENAL</span>
            <h1>La lumière contre les ombres.</h1>
            <p>
              Six armes et six objets par partie. Chaque niveau te permet
              d’affiner ton build.
            </p>
          </div>
          <div className="cemetery-arsenal-switch">
            <button
              type="button"
              onClick={() => setArsenalTab("weapons")}
              aria-pressed={arsenalTab === "weapons"}
            >
              12 armes · 12 évolutions
            </button>
            <button
              type="button"
              onClick={() => setArsenalTab("passives")}
              aria-pressed={arsenalTab === "passives"}
            >
              16 objets passifs
            </button>
          </div>
          {arsenalTab === "weapons" ? (
            <div className="cemetery-arsenal-layout">
              <div className="cemetery-weapon-list">
                {CEMETERY_WEAPONS.map((w) => (
                  <button
                    type="button"
                    key={w.id}
                    aria-pressed={selected === w.id}
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
                    <span>
                      {w.name}
                      <small>8 niveaux</small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                ))}
              </div>
              <article className="cemetery-evolution-card">
                <span className="cemetery-eyebrow">
                  L’ARME ET SON ÉVOLUTION
                </span>
                <div className="cemetery-evolution-icon">
                  <CemeteryGlyph name={selectedWeapon.glyph} art={cemeteryWeaponArt(selectedWeapon.id)} size={96} />
                </div>
                <h2>{selectedWeapon.name}</h2>
                <p>{selectedWeapon.description}</p>
                <div className="cemetery-evolution-recipe">
                  <span>Niveau 8</span>
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
                <div className="cemetery-evolution-icon is-evolved">
                  <CemeteryGlyph name={selectedWeapon.glyph} art={cemeteryWeaponArt(selectedWeapon.id, true)} size={88} />
                </div>
                <div className="cemetery-evolved-name">
                  <Sparkles size={20} />
                  <h3>{selectedWeapon.evolvedName}</h3>
                </div>
                <p>{selectedWeapon.evolvedDescription}</p>
                <small>
                  Ouvre un reliquaire de boss apparu à partir de 10 minutes avec
                  cette combinaison.
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
            <h2 id="cemetery-abandon-title">Quitter cette nuit ?</h2>
            <p>
              Cette tentative sera abandonnée sans or ni coffre. Tes
              améliorations permanentes sont conservées.
            </p>
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
              Garder ma sauvegarde
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
