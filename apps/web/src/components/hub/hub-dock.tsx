import { useId, useRef, useState } from "react";
import { ChevronUp } from "lucide-react";
import { GameIcon } from "@/components/game/game-icon";
import { WorldChat } from "./world-chat";
import { HubRanking } from "./hub-ranking";
import { FriendsPanel } from "./friends-panel";
import type { SocialPlayer } from "./player-menu";
import { MissionsPanel, type HubMissionsProps } from "./missions-dialog";
import { MissionCheck } from "./mission-icons";
import {
  DailyRewardsPanel,
  type HubDailyRewardsProps,
} from "./daily-rewards-panel";
import { canClaimDailyReward } from "@sylve/game/daily-rewards";
import { useDailyRewardClock } from "@/hooks/use-daily-reward-clock";

export function HubDock({
  missions,
  dailyRewards,
}: {
  missions?: HubMissionsProps;
  dailyRewards?: HubDailyRewardsProps;
}) {
  const [activePanel, setActivePanel] = useState<
    "ranking" | "missions" | "rewards" | "chat" | "friends" | null
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
  const rewardNow = useDailyRewardClock(dailyRewards?.board);
  const rewardReady =
    dailyRewards?.board && canClaimDailyReward(dailyRewards.board, rewardNow);

  function closePanel() {
    setActivePanel(null);
    const trigger =
      activePanel === "chat"
        ? chatTrigger
        : activePanel === "friends"
          ? friendsTrigger
          : activePanel === "missions"
            ? missionsTrigger
            : activePanel === "rewards"
              ? rewardsTrigger
              : rankingTrigger;
    trigger.current?.focus({ preventScroll: true });
  }

  function openConversation(player: SocialPlayer) {
    // A fresh selection also reopens this friend after switching to the world tab.
    setConversation({ playerId: player.playerId, name: player.name });
    setActivePanel("chat");
  }

  return (
    <div className="hub-dock" role="region" aria-label="Vie du refuge">
      {friendsOpen && (
        <FriendsPanel
          id={friendsId}
          onClose={closePanel}
          onMessage={openConversation}
        />
      )}
      {rankingOpen && <HubRanking id={rankingId} onClose={closePanel} />}
      {rewardsOpen && (
        <DailyRewardsPanel
          {...dailyRewards}
          id={rewardsId}
          now={rewardNow}
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
      <WorldChat
        id={chatId}
        titleId={chatTitleId}
        open={chatOpen}
        onClose={closePanel}
        conversation={conversation}
        onConversationChange={setConversation}
      />

      <nav className="hub-dock-shortcuts" aria-label="Communauté du refuge">
        <button
          ref={rewardsTrigger}
          type="button"
          className="hub-dock-shortcut"
          aria-expanded={rewardsOpen}
          aria-controls={rewardsOpen ? rewardsId : undefined}
          onClick={() => setActivePanel(rewardsOpen ? null : "rewards")}
        >
          <GameIcon kind="rewards" size={52} />
          {rewardReady && (
            <span
              className="hub-missions-ready"
              role="img"
              aria-label="Cadeau quotidien à récupérer"
            >
              <MissionCheck />
            </span>
          )}
          <span>Récompenses</span>
        </button>
        <button
          ref={rankingTrigger}
          type="button"
          className="hub-dock-shortcut"
          aria-expanded={rankingOpen}
          aria-controls={rankingOpen ? rankingId : undefined}
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
        <span className="hub-chat-preview">Le rendez-vous des gardiens</span>
        <ChevronUp size={17} className="hub-chat-chevron" aria-hidden="true" />
      </button>
    </div>
  );
}
