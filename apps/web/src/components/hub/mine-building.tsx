import { useEffect, useId, useState } from "react";
import {
  MINE_KINDS,
  MINE_STORAGE_HOURS,
  mineView,
  type MineBoard,
  type MineKind,
} from "@sylve/game/mines";
import { GoldIcon } from "@/components/gold-balance";
import { EmeraldIcon } from "@/components/emerald-balance";
import { useMineClock } from "@/hooks/use-mine-clock";
import { GameIcon } from "@/components/game/game-icon";

export interface HubMinesProps {
  board?: MineBoard;
  pending: readonly MineKind[];
  onCollect: (kind: MineKind) => void;
}

export const MINE_LABELS: Record<MineKind, string> = {
  gold: "Mine d’or",
  emeralds: "Mine d’émeraudes",
};

export function MineBuildings({ board, pending, onCollect }: HubMinesProps) {
  const [, tick] = useState(0);
  const mineNow = useMineClock(board);
  useEffect(() => {
    const timer = window.setInterval(() => tick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const now = mineNow();

  return MINE_KINDS.map((kind) => (
    <MineBuilding
      key={kind}
      kind={kind}
      board={board}
      now={now}
      pending={pending}
      onCollect={onCollect}
    />
  ));
}

function MineBuilding({
  kind,
  board,
  now,
  pending,
  onCollect,
}: HubMinesProps & { kind: MineKind; now: number }) {
  const descriptionId = useId();
  const state = board?.mines?.[kind];
  const view = state ? mineView(kind, state, now) : null;
  const name = MINE_LABELS[kind];
  const unit = kind === "gold" ? "pièces d’or" : "émeraudes";
  const collectUnit =
    view?.available === 1
      ? kind === "gold"
        ? "pièce d’or"
        : "émeraude"
      : unit;
  const ready = !!view && view.available > 0;
  const collecting = pending.includes(kind);
  const minutes = view ? Math.max(1, Math.ceil(view.nextInMs / 60_000)) : 0;
  const Icon = kind === "gold" ? GoldIcon : EmeraldIcon;

  return (
    <section
      id={`mine-${kind}`}
      className={`hub-mine hub-mine-${kind}`}
      aria-label={name}
      tabIndex={-1}
    >
      {ready && (
        <button
          type="button"
          className="hub-mine-collect"
          data-full={view.full || undefined}
          aria-label={`Récupérer ${view.available.toLocaleString("fr-FR")} ${collectUnit}`}
          aria-describedby={descriptionId}
          aria-busy={collecting}
          disabled={collecting}
          onClick={() => onCollect(kind)}
        >
          <span className="hub-mine-collect-content" aria-hidden="true">
            <span className="hub-mine-collect-art">
              <Icon />
            </span>
            <span className="hub-mine-collect-amount">
              {view.available.toLocaleString("fr-FR")}
            </span>
          </span>
        </button>
      )}
      <div
        className="hub-mine-label"
        title={view ? [
          `Mine niv. ${state!.level ?? state!.heroLevel ?? 1} · Rang ${board!.rank} · ${view.perHour.toLocaleString("fr-FR")} ${unit} / h`,
          `Réserve : ${view.available.toLocaleString("fr-FR")} / ${view.capacity.toLocaleString("fr-FR")} · ${MINE_STORAGE_HOURS} h de stockage`,
          view.full ? "Production en pause" : !ready ? `Prochaine ${kind === "gold" ? "pièce" : "émeraude"} dans ${minutes} min` : "",
        ].filter(Boolean).join("\n") : undefined}
      >
        <GameIcon kind={kind === "gold" ? "goldMine" : "emeraldMine"} size={32} className="hub-mine-icon" />
        <div className="hub-mine-content">
          <h2 className="hub-mine-title">{name}</h2>
          <div id={descriptionId} className="hub-mine-details">
            {view ? (
              <>
                <p aria-hidden="true">
                  <strong>{view.perHour.toLocaleString("fr-FR")} / h</strong>
                  <span>{view.available.toLocaleString("fr-FR")} / {view.capacity.toLocaleString("fr-FR")}</span>
                </p>
                <div
                  className="hub-mine-storage"
                  role="progressbar"
                  aria-label={`Réserve de la ${name.toLocaleLowerCase("fr-FR")}`}
                  aria-valuemin={0}
                  aria-valuemax={Math.max(view.capacity, view.available)}
                  aria-valuenow={view.available}
                >
                  <span style={{ width: "100%", transform: `scaleX(${view.progress})` }} />
                </div>
                <span className="sr-only">
                  Mine niv. {state!.level ?? state!.heroLevel ?? 1}, liée à ton rang {board!.rank}. {view.perHour} {unit} par heure.
                  {MINE_STORAGE_HOURS} h de réserve.
                  {view.full && <span>Production en pause</span>}
                  {!ready && <>Prochaine {kind === "gold" ? "pièce" : "émeraude"} dans {minutes} min.</>}
                </span>
              </>
            ) : (
              <p className="hub-mine-next">Préparation…</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
