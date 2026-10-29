import {
  lazy,
  Suspense,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react";
import { ChevronUp } from "lucide-react";
import { GameIcon } from "@/components/game/game-icon";
import { DeferredContent } from "@/components/deferred-content";
import { DialogLoading } from "@/components/dialog-loading";
import { HubPanel } from "./hub-panel";
import type { SocialPlayer } from "./player-menu";
import { MissionsPanel, type HubMissionsProps } from "./missions-dialog";
import { MissionCheck } from "./mission-icons";
import {
  DailyRewardsPanel,
  type HubDailyRewardsProps,
} from "./daily-rewards-panel";
import { canClaimDailyReward } from "@sylve/game/daily-rewards";
import { useDailyRewardClock } from "@/hooks/use-daily-reward-clock";
import type { HubLegendaryOffersProps } from "./legendary-offers";

const loadChat = () => import("./world-chat").then((module) => ({ default: module.WorldChat }));
const loadRanking = () => import("./hub-ranking").then((module) => ({ default: module.HubRanking }));
const loadFriends = () => import("./friends-panel").then((module) => ({ default: module.FriendsPanel }));
const loadOffers = () => import("./legendary-offers").then((module) => ({ default: module.LegendaryOffersDialog }));
const WorldChat = lazy(loadChat);
const HubRanking = lazy(loadRanking);
const FriendsPanel = lazy(loadFriends);
const LegendaryOffersDialog = lazy(loadOffers);

// Hover/focus expresses intent; closed panels are never prefetched on a timer.
const preloadChat = () => { void loadChat().catch(() => {}); };
const preloadRanking = () => { void loadRanking().catch(() => {}); };
const preloadFriends = () => { void loadFriends().catch(() => {}); };
const preloadOffers = () => { void loadOffers().catch(() => {}); };

export function HubDock({
  missions,
  dailyRewards,
  legendaryOffers,
  children,
}: {
  missions?: HubMissionsProps;
  dailyRewards?: HubDailyRewardsProps;
  legendaryOffers?: HubLegendaryOffersProps;
  children?: ReactNode;
}) {
  const [activePanel, setActivePanel] = useState<
    "ranking" | "missions" | "rewards" | "offers" | "chat" | "friends" | null
  >(null);
  const [conversation, setConversation] = useState<SocialPlayer | null>(null);
  const friendsOpen = activePanel === "friends";
  const friendsId = useId();
  const friendsTrigger = useRef<HTMLButtonElement>(null);
  const chatOpen = activePanel === "chat";
  const rankingOpen = activePanel === "ranking";
  const missionsOpen = activePanel === "missions";
  const rankingId = useId();
  const rankingTrigger = useRef<HTMLButtonElement>(null);
  const missionsId = useId();
  const missionsTrigger = useRef<HTMLButtonElement>(null);
  const chatId = useId();
  const chatTitleId = useId();
  const chatTrigger = useRef<HTMLButtonElement>(null);
  const rewardsOpen = activePanel === "rewards";
  const rewardsId = useId();
  const rewardsTrigger = useRef<HTMLButtonElement>(null);
  const offersTrigger = useRef<HTMLButtonElement>(null);
  const offersOpen =
    activePanel === "offers" && !!legendaryOffers?.board?.eligible;

  function closePanel() {
    setActivePanel(null);
    const trigger =
      activePanel === "chat"
        ? chatTrigger
        : activePanel === "friends"
          ? friendsTrigger
          : activePanel === "missions"
            ? missionsTrigger
            : activePanel === "offers"
              ? offersTrigger
              : activePanel === "rewards"
                ? rewardsTrigger
                : rankingTrigger;
    trigger.current?.focus({ preventScroll: true });
  }

  function openConversation(player: SocialPlayer) {
    // A fresh selection also reopens this friend after switching to the world tab.
    setConversation({ ...player });
    setActivePanel("chat");
  }

  return (
    <>
      <RewardsTrigger
        triggerRef={rewardsTrigger}
        board={dailyRewards?.board}
        open={rewardsOpen}
        panelId={rewardsId}
        onClick={() => setActivePanel(rewardsOpen ? null : "rewards")}
      />
      {legendaryOffers?.board?.eligible && (
        <>
          <button
            ref={offersTrigger}
            type="button"
            className="hub-offers-trigger"
            aria-label="Offres légendaires"
            aria-haspopup="dialog"
            aria-expanded={offersOpen}
            onPointerEnter={preloadOffers}
            onFocus={preloadOffers}
            onClick={() => setActivePanel(offersOpen ? null : "offers")}
          >
            <span className="hub-offers-aura" aria-hidden="true" />
            <img
              src="/art/chests/legendary.webp"
              width={100}
              height={100}
              alt=""
              draggable={false}
            />
            <span className="hub-offers-new">NEW</span>
          </button>
          <DeferredContent
            active={offersOpen}
            fallback={<DialogLoading title="Offres légendaires" onClose={closePanel} />}
          >
            <LegendaryOffersDialog
              {...legendaryOffers}
              open={offersOpen}
              onClose={closePanel}
            />
          </DeferredContent>
        </>
      )}
      <div className="hub-footer">
        {children}
        <div className="hub-dock" role="region" aria-label="Vie du refuge">
          {friendsOpen && (
            <Suspense fallback={
              <PanelLoading
                id={friendsId}
                title="Amis"
                icon="friends"
                closeLabel="Fermer les amis"
                className="hub-friends"
                onClose={closePanel}
              />
            }>
              <FriendsPanel
                id={friendsId}
                onClose={closePanel}
                onMessage={openConversation}
              />
            </Suspense>
          )}
          {rankingOpen && (
            <Suspense fallback={
              <PanelLoading
                id={rankingId}
                title="Classement mondial"
                icon="ranking"
                closeLabel="Fermer le classement"
                className="hub-ranking"
                onClose={closePanel}
              />
            }>
              <HubRanking id={rankingId} onClose={closePanel} />
            </Suspense>
          )}
          {rewardsOpen && (
            <RewardsPanel
              {...dailyRewards}
              id={rewardsId}
              onClose={closePanel}
            />
          )}
          {missionsOpen && (
            <MissionsPanel
              {...missions}
              id={missionsId}
              onClose={closePanel}
              onNavigate={() => setActivePanel(null)}
            />
          )}
          <DeferredContent
            active={chatOpen}
            fallback={
              <PanelLoading
                id={chatId}
                titleId={chatTitleId}
                title="Chat mondial"
                icon="chat"
                closeLabel="Fermer le chat"
                className="hub-world-chat"
                onClose={closePanel}
              />
            }
          >
            <WorldChat
              id={chatId}
              titleId={chatTitleId}
              open={chatOpen}
              onClose={closePanel}
              conversation={conversation}
              onConversationChange={setConversation}
            />
          </DeferredContent>

          <nav className="hub-dock-shortcuts" aria-label="Communauté du refuge">
            <button
              ref={rankingTrigger}
              type="button"
              className="hub-dock-shortcut"
              aria-expanded={rankingOpen}
              aria-controls={rankingOpen ? rankingId : undefined}
              onPointerEnter={preloadRanking}
              onFocus={preloadRanking}
              onClick={() => {
                setActivePanel(rankingOpen ? null : "ranking");
              }}
            >
              <GameIcon kind="ranking" size={52} />
              <span>Classement</span>
            </button>
            <button
              ref={friendsTrigger}
              type="button"
              className="hub-dock-shortcut"
              aria-expanded={friendsOpen}
              aria-controls={friendsOpen ? friendsId : undefined}
              onPointerEnter={preloadFriends}
              onFocus={preloadFriends}
              onClick={() => setActivePanel(friendsOpen ? null : "friends")}
            >
              <GameIcon kind="friends" size={52} />
              <span>Amis</span>
            </button>
            <button
              ref={missionsTrigger}
              type="button"
              className="hub-dock-shortcut"
              aria-expanded={missionsOpen}
              aria-controls={missionsOpen ? missionsId : undefined}
              onClick={() => setActivePanel(missionsOpen ? null : "missions")}
            >
              <GameIcon kind="missions" size={52} />
              {missions?.board?.hasClaimable && (
                <span
                  className="hub-missions-ready"
                  role="img"
                  aria-label="Récompenses à récupérer"
                >
                  <MissionCheck />
                </span>
              )}
              <span>Missions</span>
            </button>
          </nav>

          <button
            ref={chatTrigger}
            type="button"
            className="hub-chat-toggle"
            aria-expanded={chatOpen}
            aria-controls={chatOpen ? chatId : undefined}
            onPointerEnter={preloadChat}
            onFocus={preloadChat}
            onClick={() => {
              setActivePanel(chatOpen ? null : "chat");
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && chatOpen) {
                event.stopPropagation();
                closePanel();
              }
            }}
          >
            <GameIcon kind="chat" size={28} className="hub-chat-icon" />
            <span className="hub-chat-label">Chat mondial</span>
            <span className="hub-chat-preview">
              Le rendez-vous des gardiens
            </span>
            <ChevronUp
              size={17}
              className="hub-chat-chevron"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </>
  );
}

function PanelLoading(props: Omit<ComponentProps<typeof HubPanel>, "children">) {
  return (
    <HubPanel {...props}>
      <p role="status" className="hub-ranking-loading">Chargement…</p>
    </HubPanel>
  );
}

// Clock updates stay inside the gift controls, independently of other panels.
function RewardsTrigger({ triggerRef, board, open, panelId, onClick }: {
  triggerRef: RefObject<HTMLButtonElement | null>;
  board: HubDailyRewardsProps["board"];
  open: boolean;
  panelId: string;
  onClick: () => void;
}) {
  const now = useDailyRewardClock(board);
  const ready = board && canClaimDailyReward(board, now);
  return (
    <button
      ref={triggerRef}
      type="button"
      className="hub-rewards-trigger"
      aria-label="Récompenses"
      title="Récompenses"
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      data-ready={ready || undefined}
      onClick={onClick}
    >
      <span className="hub-rewards-art">
        <GameIcon kind="rewards" size={80} />
        {ready && (
          <span className="hub-rewards-ready" role="img" aria-label="Cadeau quotidien à récupérer">
            <MissionCheck />
          </span>
        )}
      </span>
    </button>
  );
}

function RewardsPanel(props: HubDailyRewardsProps & { id: string; onClose: () => void }) {
  const now = useDailyRewardClock(props.board);
  return <DailyRewardsPanel {...props} now={now} />;
}
