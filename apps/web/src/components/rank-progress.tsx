import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRouterState } from "@tanstack/react-router";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { FRIEND_HELP_EXPERIENCE, FRIENDS_UNLOCK_RANK, rankBenefits, rankSoulbindUnlocks } from "@sylve/game/ranks";
import { useGameAuth } from "@/hooks/use-game-auth";
import { EmeraldAmount } from "./emerald-balance";
import { GameIcon, type GameIconKind } from "./game/game-icon";
import { showGameError } from "./game/shared";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";

type RankProgress = FunctionReturnType<typeof api.collection.rank>;
const RankContext = createContext<RankProgress | null | undefined>(null);

export function RankProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useGameAuth();
  const progress = useQuery(api.collection.rank, isAuthenticated ? {} : "skip");
  const ensure = useMutation(api.collection.ensureRank);
  const ownerId = isAuthenticated ? progress?.ownerId : undefined;
  useEffect(() => {
    let active = true;
    if (ownerId) void ensure({ expectedOwnerId: ownerId }).catch((error) => {
      if (active) showGameError(error);
    });
    return () => { active = false; };
  }, [ownerId, ensure]);
  return (
    <RankContext.Provider value={isAuthenticated ? progress : null}>
      {children}
      {isAuthenticated && progress && <RankNotification key={progress.ownerId} progress={progress} />}
    </RankContext.Provider>
  );
}

function RankNotification({ progress }: { progress: RankProgress }) {
  const acknowledge = useMutation(api.collection.acknowledgeRank);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [seenThrough, setSeenThrough] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = progress.pending;
  const inBattle = pathname.replace(/\/$/, "") === "/practice" || pathname.startsWith("/game/");

  async function dismiss() {
    if (!pending || busy) return;
    const throughRank = pending.toRank;
    setBusy(true);
    setError(null);
    try {
      await acknowledge({ throughRank, expectedOwnerId: progress.ownerId });
      setSeenThrough(throughRank);
    } catch {
      setError("Impossible de fermer le panneau. Réessaie ; tes émeraudes sont déjà créditées.");
    } finally {
      setBusy(false);
    }
  }

  return pending && pending.toRank > seenThrough && !inBattle ? (
    <RankUpDialog {...pending} busy={busy} error={error} onClose={() => void dismiss()} />
  ) : null;
}

function RankMedallion({ rank }: { rank: number }) {
  return (
    <div className="rank-medallion" aria-label={`Rang ${rank}`}>
      <GameIcon kind="guardian" size={120} />
      <span>{rank.toLocaleString("fr-FR")}</span>
    </div>
  );
}

function Benefit({ icon, label, value, before }: {
  icon: GameIconKind;
  label: string;
  value: number;
  before?: number;
}) {
  const changed = before !== undefined && before !== value;
  return (
    <div className="rank-benefit" data-improved={changed || undefined}>
      <GameIcon kind={icon} size={44} />
      <div>
        <span>{label}</span>
        <strong>
          {changed && <><del>{before}</del><ArrowRight size={15} aria-hidden="true" /></>}
          {value === 0 ? `Au rang ${FRIENDS_UNLOCK_RANK}` : value.toLocaleString("fr-FR")}
        </strong>
      </div>
    </div>
  );
}

function RankBenefits({ rank, fromRank }: { rank: number; fromRank?: number }) {
  const current = rankBenefits(rank);
  const before = fromRank === undefined ? undefined : rankBenefits(fromRank);
  return (
    <div className="rank-benefits">
      <Benefit icon="goldMine" label="Mine d’or · niveau" value={current.mineLevel} before={before?.mineLevel} />
      <Benefit icon="emeraldMine" label="Mine d’émeraudes · niveau" value={current.mineLevel} before={before?.mineLevel} />
      <Benefit icon="friends" label="Places d’amis" value={current.friends} before={before?.friends} />
    </div>
  );
}

export function RankUpDialog({ fromRank, toRank, emeralds, onClose, busy = false, error }: {
  fromRank: number;
  toRank: number;
  emeralds: number;
  onClose: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const soulbinds = rankSoulbindUnlocks(fromRank, toRank);
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent appearance="game" className="rank-dialog rank-up-dialog" showCloseButton={false} initialFocus={titleRef}>
        <div className="rank-celebration" aria-hidden="true"><span /><span /><span /><span /><span /></div>
        <p className="rank-eyebrow">La Sylve grandit avec toi</p>
        <DialogTitle ref={titleRef} tabIndex={-1}>Rang supérieur !</DialogTitle>
        <DialogDescription>
          {toRank - fromRank > 1
            ? `Du rang ${fromRank} au rang ${toRank} : ${toRank - fromRank} rangs franchis !`
            : `Tu as atteint le rang ${toRank}.`}
        </DialogDescription>
        <RankMedallion rank={toRank} />
        <div className="rank-emerald-reward">
          <span>Ta récompense</span>
          <strong><span aria-hidden="true">+</span><EmeraldAmount amount={emeralds} /></strong>
          <small>Émeraudes ajoutées à ton solde</small>
        </div>
        <RankBenefits rank={toRank} fromRank={fromRank} />
        {soulbinds > 0 && (
          <div className="rank-soulbind-unlock">
            <GameIcon kind="soulbind" size={38} />
            <p><strong>{soulbinds} lien{soulbinds > 1 ? "s" : ""} d’âme : rang requis atteint</strong>
              <span>Bronze IV, les compagnons et la poussière restent requis pour les activer.</span></p>
          </div>
        )}
        {error && <p className="rank-error" role="alert">{error}</p>}
        <button className="rank-primary-action" type="button" disabled={busy} onClick={onClose}>
          {busy ? <><LoaderCircle size={18} className="animate-spin" />Un instant…</> : "Continuer"}
        </button>
      </DialogContent>
    </Dialog>
  );
}

export function RankBadge() {
  const progress = useContext(RankContext);
  const [openOwner, setOpenOwner] = useState<string | null>(null);
  if (!progress) return null;
  const percent = progress.required === 0 ? 100 : Math.min(100, progress.earned / progress.required * 100);
  return (
    <>
      <button type="button" className="player-rank-badge" onClick={() => setOpenOwner(progress.ownerId)}
        aria-label={`Rang ${progress.rank}, ${progress.required ? `${progress.earned} sur ${progress.required} XP` : "rang maximum"}. Voir la progression`}
        title={`Rang ${progress.rank} · ${progress.required ? `${progress.earned} / ${progress.required} XP` : "MAX"}`}>
        <span>Rang</span><strong>{progress.rank}</strong>
        <span className="player-rank-track" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
      </button>
      <Dialog open={openOwner === progress.ownerId} onOpenChange={(open) => setOpenOwner(open ? progress.ownerId : null)}>
        <DialogContent appearance="game" className="rank-dialog rank-overview-dialog">
          <p className="rank-eyebrow">Progression du compte</p>
          <DialogTitle>Ton rang</DialogTitle>
          <DialogDescription>Améliore tes cartes et aide tes amis pour gagner de l’expérience.</DialogDescription>
          <RankMedallion rank={progress.rank} />
          <div className="rank-xp">
            <span>{progress.required ? `Vers le rang ${progress.rank + 1}` : "Rang maximum"}</span>
            <strong>{progress.required ? `${progress.earned.toLocaleString("fr-FR")} / ${progress.required.toLocaleString("fr-FR")} XP` : "MAX"}</strong>
            <progress aria-label="Expérience de rang" value={progress.required ? progress.earned : 1} max={progress.required || 1} />
          </div>
          <RankBenefits rank={progress.rank} />
          {progress.required > 0 && <p className="rank-next-reward">Au prochain rang : <EmeraldAmount amount={rankBenefits(progress.rank + 1).emeralds} /></p>}
          {progress.nextFriends && <p className="rank-hint">{progress.nextFriends.friends} places d’amis au rang {progress.nextFriends.rank}.</p>}
          <p className="rank-hint">Chaque aide quotidienne envoyée rapporte {FRIEND_HELP_EXPERIENCE} XP. Les liens d’âme utilisent aussi ton rang, dès Bronze IV.</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
