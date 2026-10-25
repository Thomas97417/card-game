import { useId, useState, type KeyboardEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Crown,
  Leaf,
  LoaderCircle,
  LockKeyhole,
  Sun,
} from "lucide-react";
import type {
  MissionBoard,
  MissionPeriodKind,
  MissionTab,
  MissionTrack,
  MissionView,
} from "@sylve/game/missions";
import { chestName } from "@sylve/game/progression";
import {
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { GameIcon } from "@/components/game/game-icon";
import { EmeraldIcon } from "@/components/emerald-balance";

export interface HubMissionsProps {
  board?: MissionBoard;
  now?: number;
  pending?: string | null;
  onClaim?: (mission: MissionView) => void;
  onOpenChest?: (
    kind: MissionPeriodKind,
    track: MissionTrack,
    index: number,
  ) => void;
  onNavigate?: () => void;
}

const TABS = [
  { id: "daily", label: "Jour", icon: Sun },
  { id: "weekly", label: "Semaine", icon: CalendarDays },
  { id: "epic", label: "Épique", icon: Crown },
] as const;

/** A minted leaf distinguishes mission seals from gold, emeralds and soul dust. */
export function MissionSeal({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`mission-seal ${className}`}
      width="40"
      height="44"
      viewBox="0 0 40 44"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 2 36 11v22L20 42 4 33V11Z"
        fill="#80552d"
        stroke="#e7c781"
        strokeWidth="2"
      />
      <path d="M20 6 32 13v18l-12 7-12-7V13Z" fill="#b7904f" stroke="#f4daa2" />
      <path d="M26 13c-12 0-16 6-11 13 8 3 14-3 11-13Z" fill="#fff0bd" />
      <path
        d="m13 32 11-16M18 25l-1-7M19 23l6 1"
        stroke="#674828"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function resetTime(resetsAt: number, now: number) {
  const minutes = Math.max(0, Math.ceil((resetsAt - now) / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days} j ${hours} h`;
  return `${hours} h ${String(minutes % 60).padStart(2, "0")}`;
}

export function MissionsDialog({
  board,
  now,
  pending,
  onClaim,
  onOpenChest,
  onNavigate,
}: HubMissionsProps) {
  const [tab, setTab] = useState<MissionTab>("daily");
  const id = useId();
  const track = tab === "epic" ? null : board?.[tab];
  const missions = tab === "epic" ? board?.epic : track?.missions;
  const readyCount = (kind: MissionTab) => {
    if (!board) return 0;
    return (
      kind === "epic"
        ? board.epic
        : [...board[kind].missions, ...board[kind].chests]
    ).filter((item) => item.status === "ready").length;
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
    <DialogContent appearance="game" className="missions-dialog">
      <header className="missions-heading">
        <GameIcon kind="missions" size={64} />
        <div>
          <span className="missions-eyebrow">
            <Leaf size={12} aria-hidden="true" /> Le carnet des gardiens
          </span>
          <DialogTitle>Missions</DialogTitle>
          <DialogDescription>
            Chaque aventure mérite sa récompense.
          </DialogDescription>
        </div>
      </header>

      <section
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
            {track && tab !== "epic" ? (
              <MissionChestTrack
                kind={tab}
                track={track}
                pending={pending}
                onOpen={onOpenChest}
              />
            ) : (
              <div className="missions-epic-intro">
                <Crown size={29} aria-hidden="true" />
                <div>
                  <strong>Des exploits qui grandissent avec toi</strong>
                  <p>
                    Récupère tes émeraudes pour ouvrir le palier suivant. Ta
                    progression est conservée.
                  </p>
                </div>
                <EmeraldIcon />
              </div>
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
                        <Check size={17} aria-hidden="true" /> Récupérée
                      </span>
                    ) : mission.status === "ready" ? (
                      <button
                        type="button"
                        className="mission-claim"
                        disabled={!!pending || !onClaim}
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
                          <Check size={15} aria-hidden="true" />
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
            <p className="missions-footnote">
              <Leaf size={12} aria-hidden="true" /> Les duels solo et publics
              comptent pour tes missions. Reviens ici récupérer tes récompenses.
            </p>
          </>
        )}
      </section>

      <div
        className="missions-tabs"
        role="tablist"
        aria-label="Période des missions"
      >
        {TABS.map(({ id: kind, label, icon: Icon }, index) => (
          <button
            type="button"
            role="tab"
            id={`${id}-${kind}`}
            key={kind}
            aria-selected={tab === kind}
            aria-controls={`${id}-panel`}
            tabIndex={tab === kind ? 0 : -1}
            onClick={() => setTab(kind)}
            onKeyDown={(event) => changeTab(event, index)}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
            {readyCount(kind) > 0 && (
              <span
                className="missions-tab-count"
                aria-label={`${readyCount(kind)} récompenses à récupérer`}
              >
                {readyCount(kind)}
              </span>
            )}
          </button>
        ))}
      </div>
    </DialogContent>
  );
}

function MissionChestTrack({
  kind,
  track,
  pending,
  onOpen,
}: {
  kind: MissionPeriodKind;
  track: MissionTrack;
  pending?: string | null;
  onOpen?: HubMissionsProps["onOpenChest"];
}) {
  const maximum = track.chests.at(-1)?.threshold ?? 100;
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
        </div>
      </div>
      <div
        className="mission-chest-road"
        role="group"
        aria-label="Coffres de mission"
      >
        <div className="mission-road-line" aria-hidden="true">
          <span
            style={{
              width: `${Math.min(100, (track.seals / maximum) * 100)}%`,
            }}
          />
        </div>
        {track.chests.map((chest) => (
          <button
            key={chest.index}
            type="button"
            className="mission-chest"
            data-status={chest.status}
            disabled={chest.status !== "ready" || !!pending || !onOpen}
            onClick={() => onOpen?.(kind, track, chest.index)}
            aria-label={`${chestName(chest.rarity)}, ${chest.threshold} sceaux, ${chest.status === "claimed" ? "récupéré" : chest.status === "ready" ? "ouvrir" : "verrouillé"}`}
            title={`${chestName(chest.rarity)} — ${chest.threshold} sceaux`}
          >
            <img
              src={`/art/chests/${chest.rarity}.webp`}
              alt=""
              width={88}
              height={80}
              draggable={false}
            />
            <span className="mission-chest-threshold">
              {chest.status === "claimed" ? (
                <Check size={13} aria-hidden="true" />
              ) : chest.status === "active" ? (
                <LockKeyhole size={11} aria-hidden="true" />
              ) : null}
              {chest.threshold}
            </span>
            <span className="mission-chest-state">
              {pending === `${kind}-chest-${chest.index}`
                ? "Ouverture…"
                : chest.status === "claimed"
                  ? "Récupéré"
                  : chest.status === "ready"
                    ? "Ouvrir"
                    : "Sceaux"}
            </span>
          </button>
        ))}
      </div>
      <p className="mission-track-note">
        Les sceaux restent acquis sur ce parcours jusqu’au renouvellement.
      </p>
    </div>
  );
}
