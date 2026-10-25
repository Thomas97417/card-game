import { useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronUp } from "lucide-react";
import { GameIcon } from "@/components/game/game-icon";
import { WorldChat } from "./world-chat";
import { HubRanking } from "./hub-ranking";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MissionsPanel, type HubMissionsProps } from "./missions-dialog";
import { MissionCheck } from "./mission-icons";

export function HubDock({ missions }: { missions?: HubMissionsProps }) {
  const [activePanel, setActivePanel] = useState<
    "ranking" | "missions" | "chat" | null
  >(null);
  const [friendsOpen, setFriendsOpen] = useState(false);
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

  function closePanel() {
    setActivePanel(null);
    const trigger =
      activePanel === "chat"
        ? chatTrigger
        : activePanel === "missions"
          ? missionsTrigger
          : rankingTrigger;
    trigger.current?.focus({ preventScroll: true });
  }

  return (
    <Dialog open={friendsOpen} onOpenChange={setFriendsOpen}>
      <div className="hub-dock" role="region" aria-label="Vie du refuge">
        {rankingOpen && <HubRanking id={rankingId} onClose={closePanel} />}
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
        />

        <nav className="hub-dock-shortcuts" aria-label="Communauté du refuge">
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
          <DialogTrigger
            className="hub-dock-shortcut"
            onClick={() => setActivePanel(null)}
          >
            <GameIcon kind="friends" size={52} />
            <span>Amis</span>
          </DialogTrigger>
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
          <ChevronUp
            size={17}
            className="hub-chat-chevron"
            aria-hidden="true"
          />
        </button>
      </div>

      <DialogContent appearance="game" className="hub-destination-dialog">
        <GameIcon kind="friends" size={88} className="hub-destination-art" />
        <span className="hub-coming-soon">Bientôt disponible</span>
        <DialogTitle>Amis</DialogTitle>
        <DialogDescription>
          La liste d’amis arrive bientôt au refuge.
        </DialogDescription>
        <p className="hub-destination-detail">
          En attendant, tu peux déjà retrouver un ami dans l’arène en créant ou
          en rejoignant un défi amical.
        </p>
        <Link to="/arena" className="sylve-button">
          Lancer un défi amical <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </DialogContent>
    </Dialog>
  );
}
