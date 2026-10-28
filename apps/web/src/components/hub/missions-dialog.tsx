import { useId, useState, type KeyboardEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock3, LoaderCircle, LockKeyhole } from "lucide-react";
import type {
  MissionBoard,
  MissionPeriodKind,
  MissionTab,
  MissionTrack,
  MissionView,
} from "@sylve/game/missions";
import { chestName } from "@sylve/game/chest-types";
import { EmeraldIcon } from "@/components/emerald-balance";
import { MissionCheck, MissionSeal } from "./mission-icons";
import { HubPanel } from "./hub-panel";

export interface MissionSealGain {
  id: number;
  kind: MissionPeriodKind;
  periodKey: string;
  amount: number;
}

export interface HubMissionsProps {
  board?: MissionBoard;
  now?: number;
  pending?: string | null;
  sealGain?: MissionSealGain | null;
  onClaim?: (mission: MissionView) => void;
  onOpenChest?: (
    kind: MissionPeriodKind,
    track: MissionTrack,
    index: number,
  ) => void;
  onNavigate?: () => void;
}

const TABS = [
  { id: "daily", label: "Jour" },
  { id: "weekly", label: "Semaine" },
  { id: "epic", label: "Épique" },
] as const;

function resetTime(resetsAt: number, now: number) {
  const minutes = Math.max(0, Math.ceil((resetsAt - now) / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days} j ${hours} h`;
  return `${hours} h ${String(minutes % 60).padStart(2, "0")}`;
}

export function MissionsPanel({
  id: panelId,
  onClose,
  board,
  now,
  pending,
  sealGain,
  onClaim,
  onOpenChest,
  onNavigate,
}: HubMissionsProps & { id: string; onClose: () => void }) {
  const [tab, setTab] = useState<MissionTab>("daily");
  const id = useId();
  const track = tab === "epic" ? null : board?.[tab];
  const missions = tab === "epic" ? board?.epic : track?.missions;
  const hasRewards = (kind: MissionTab) => {
    if (!board) return false;
    return (
      kind === "epic"
        ? board.epic
        : [...board[kind].missions, ...board[kind].chests]
    ).some((item) => item.status === "ready");
  };

  function changeTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = (index + 1) % TABS.length;
        break;
      case "ArrowLeft":
        next = (index + TABS.length - 1) % TABS.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = TABS.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    setTab(TABS[next]!.id);
    document.getElementById(`${id}-${TABS[next]!.id}`)?.focus();
  }

  return (
    <HubPanel
      id={panelId}
      className="hub-missions"
      title="Missions"
      description="Chaque aventure mérite sa récompense."
      icon="missions"
      closeLabel="Fermer les missions"
      onClose={onClose}
    >
      <section
        key={tab}
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-${tab}`}
        className="missions-panel"
        tabIndex={0}
      >
        {!board ? (
          <div className="missions-loading" role="status">
            <LoaderCircle size={24} className="animate-spin" /> Chargement des
            missions…
          </div>
        ) : (
          <>
            {track && tab !== "epic" && (
              <MissionChestTrack
                kind={tab}
                track={track}
                pending={pending}
                gain={
                  sealGain?.kind === tab && sealGain.periodKey === track.key
                    ? sealGain
                    : undefined
                }
                onOpen={onOpenChest}
              />
            )}

            <div className="missions-list-heading">
              <h3>
                {tab === "daily"
                  ? "Les défis du jour"
                  : tab === "weekly"
                    ? "Les défis de la semaine"
                    : "Les grands exploits"}
              </h3>
              {track ? (
                <span title="À minuit UTC, le lundi pour les missions de la semaine">
                  <Clock3 size={12} aria-hidden="true" /> Renouvellement dans{" "}
                  {resetTime(track.resetsAt, now ?? board.serverNow)}
                </span>
              ) : (
                <span>Sans limite de temps</span>
              )}
            </div>

            <ul
              className="missions-list"
              aria-label={
                tab === "epic"
                  ? "Missions épiques"
                  : tab === "daily"
                    ? "Missions du jour"
                    : "Missions de la semaine"
              }
            >
              {missions?.map((mission) => (
                <li
                  key={mission.id}
                  className="mission-row"
                  data-status={mission.status}
                >
                  <div
                    className="mission-reward"
                    aria-label={`${mission.reward} ${tab === "epic" ? "émeraudes" : "sceaux de mission"}`}
                  >
                    {tab === "epic" ? <EmeraldIcon /> : <MissionSeal />}
                    <strong>+{mission.reward}</strong>
                  </div>
                  <div className="mission-objective">
                    <div className="mission-title">
                      <h4>{mission.title}</h4>
                      {tab === "epic" && <span>Palier {mission.tier + 1}</span>}
                    </div>
                    <p>{mission.objective}</p>
                    <div
                      className="mission-progress"
                      role="progressbar"
                      aria-label={mission.objective}
                      aria-valuemin={0}
                      aria-valuemax={mission.target}
                      aria-valuenow={mission.progress}
                    >
                      <span
                        style={{
                          width: `${(mission.progress / mission.target) * 100}%`,
                        }}
                      />
                      <strong>
                        {mission.progress.toLocaleString("fr-FR")} /{" "}
                        {mission.target.toLocaleString("fr-FR")}
                      </strong>
                    </div>
                  </div>
                  <div className="mission-action">
                    {mission.status === "claimed" ? (
                      <span className="mission-claimed">
                        <MissionCheck /> Récupérée
                      </span>
                    ) : mission.status === "ready" ? (
                      <button
                        type="button"
                        className="mission-claim"
                        disabled={!!pending || !onClaim}
                        aria-busy={pending === mission.id || undefined}
                        onClick={() => onClaim?.(mission)}
                        aria-label={`Récupérer : ${mission.title}`}
                      >
                        {pending === mission.id ? (
                          <LoaderCircle
                            size={16}
                            className="animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <MissionCheck />
                        )}{" "}
                        Récupérer
                      </button>
                    ) : (
                      <Link
                        to={mission.destination}
                        className="mission-go"
                        onClick={onNavigate}
                        aria-label={`Aller : ${mission.title}`}
                      >
                        Aller <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div
        className="missions-tabs"
        role="tablist"
        aria-label="Période des missions"
      >
        {TABS.map(({ id: kind, label }, index) => (
          <button
            type="button"
            role="tab"
            id={`${id}-${kind}`}
            key={kind}
            data-rewards={hasRewards(kind)}
            aria-selected={tab === kind}
            aria-controls={`${id}-panel`}
            tabIndex={tab === kind ? 0 : -1}
            onClick={() => setTab(kind)}
            onKeyDown={(event) => changeTab(event, index)}
          >
            <span className="missions-tab-label">{label}</span>
            {hasRewards(kind) && (
              <span className="sr-only">Récompenses à récupérer</span>
            )}
          </button>
        ))}
      </div>
    </HubPanel>
  );
}

function MissionChestTrack({
  kind,
  track,
  pending,
  gain,
  onOpen,
}: {
  kind: MissionPeriodKind;
  track: MissionTrack;
  pending?: string | null;
  gain?: MissionSealGain;
  onOpen?: HubMissionsProps["onOpenChest"];
}) {
  const maximum = track.chests.at(-1)?.threshold ?? 100;
  const openedCount = track.chests.filter(
    (chest) => chest.status === "claimed",
  ).length;
  const seals = Math.max(0, Math.min(maximum, track.seals));
  const firstThreshold = track.chests[0]?.threshold ?? 0;
  // The route connects the first and last chest centers, rather than zero seals.
  const routeProgress =
    maximum > firstThreshold
      ? Math.max(
          0,
          Math.min(
            100,
            ((seals - firstThreshold) / (maximum - firstThreshold)) * 100,
          ),
        )
      : seals >= maximum
        ? 100
        : 0;
  return (
    <div className="mission-track">
      <div className="mission-track-heading">
        <div>
          <span>Le chemin des trésors</span>
          <p>Récupère des sceaux, débloque tes coffres.</p>
        </div>
        <div className="mission-seal-balance">
          <MissionSeal />
          <strong>
            {track.seals}
            <small> / {maximum}</small>
          </strong>
          <span>Sceaux de mission</span>
          {gain && (
            <div
              key={gain.id}
              className="mission-seal-gain"
              role="status"
              aria-label={`${gain.amount} sceaux de mission récupérés`}
              aria-atomic="true"
            >
              <MissionSeal />
              <span>+{gain.amount.toLocaleString("fr-FR")}</span>
            </div>
          )}
        </div>
      </div>
      <div
        className="mission-chest-road"
        role="group"
        aria-label="Coffres de mission"
      >
        <div
          className="mission-road-line"
          role="progressbar"
          aria-label="Progression des coffres de mission"
          aria-valuemin={0}
          aria-valuemax={maximum}
          aria-valuenow={seals}
          aria-valuetext={`${track.seals} sceaux sur ${maximum}, ${openedCount} coffres ouverts sur ${track.chests.length}`}
        >
          <span style={{ width: `${routeProgress}%` }} />
        </div>
        {track.chests.map((chest) => (
          <button
            key={chest.index}
            type="button"
            className="mission-chest"
            data-chest-type={chest.rarity}
            data-status={chest.status}
            disabled={chest.status !== "ready" || !!pending || !onOpen}
            onClick={() => onOpen?.(kind, track, chest.index)}
            aria-label={`${chestName(chest.rarity)}, ${chest.threshold} sceaux, ${chest.status === "claimed" ? "récupéré" : chest.status === "ready" ? "ouvrir" : "verrouillé"}`}
            title={`${chestName(chest.rarity)} — ${chest.threshold} sceaux`}
          >
            <span className="mission-chest-art">
              <img
                src={`/art/chests/${chest.rarity}${chest.status === "claimed" ? "-open" : ""}.webp`}
                alt=""
                width={88}
                height={80}
                draggable={false}
              />
            </span>
            <span className="mission-chest-threshold">
              {pending === `${kind}-chest-${chest.index}` ? (
                <LoaderCircle
                  size={12}
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : chest.status === "claimed" ? (
                <MissionCheck />
              ) : chest.status === "active" ? (
                <LockKeyhole size={11} aria-hidden="true" />
              ) : null}
              {chest.threshold}
            </span>
            <span className="mission-chest-state">
              {pending === `${kind}-chest-${chest.index}`
                ? "Ouverture…"
                : chest.status === "claimed"
                  ? "Ouvert"
                  : chest.status === "ready"
                    ? "Ouvrir"
                    : "Verrouillé"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
