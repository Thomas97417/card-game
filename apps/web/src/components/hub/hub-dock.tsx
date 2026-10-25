import { useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronUp, Globe2 } from "lucide-react";
import { GameIcon, type GameIconKind } from "@/components/game/game-icon";
import { WorldChat } from "./world-chat";
import { HubRanking } from "./hub-ranking";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const DESTINATIONS = [
  {
    id: "friends",
    label: "Amis",
    icon: "friends",
    description: "La liste d’amis arrive bientôt au refuge.",
    detail:
      "En attendant, tu peux déjà retrouver un ami dans l’arène en créant ou en rejoignant un défi amical.",
    action: "Lancer un défi amical",
  },
  {
    id: "missions",
    label: "Missions",
    icon: "missions",
    description: "De nouvelles missions se préparent dans la Sylve.",
    detail:
      "En attendant, remporte trois victoires dans l’arène pour déverrouiller ton coffre commun.",
    action: "Rejoindre l’arène",
  },
] as const satisfies readonly {
  id: string;
  label: string;
  icon: GameIconKind;
  description: string;
  detail: string;
  action: string;
}[];

/** Social panels share the space directly above the hub's shortcuts. */
export function HubDock() {
  const [activeDestination, setActiveDestination] = useState<
    (typeof DESTINATIONS)[number]
  >(DESTINATIONS[0]);
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);
  const rankingId = useId();
  const rankingTrigger = useRef<HTMLButtonElement>(null);
  const chatId = useId();
  const chatTitleId = useId();
  const chatTrigger = useRef<HTMLButtonElement>(null);

  function closeChat() {
    setChatOpen(false);
    chatTrigger.current?.focus();
  }

  function closeRanking() {
    setRankingOpen(false);
    rankingTrigger.current?.focus();
  }

  return (
    <Dialog open={destinationOpen} onOpenChange={setDestinationOpen}>
      <div className="hub-dock" role="region" aria-label="Vie du refuge">
        {rankingOpen && <HubRanking id={rankingId} onClose={closeRanking} />}
        <WorldChat
          id={chatId}
          titleId={chatTitleId}
          open={chatOpen}
          onClose={closeChat}
        />

        <nav className="hub-dock-shortcuts" aria-label="Communauté du refuge">
          <button
            ref={rankingTrigger}
            type="button"
            className="hub-dock-shortcut"
            aria-expanded={rankingOpen}
            aria-controls={rankingOpen ? rankingId : undefined}
            onClick={() => {
              setChatOpen(false);
              setRankingOpen((open) => !open);
            }}
          >
            <GameIcon kind="ranking" size={52} />
            <span>Classement</span>
          </button>
          {DESTINATIONS.map((destination) => (
            <DialogTrigger
              key={destination.id}
              className="hub-dock-shortcut"
              onClick={() => {
                setChatOpen(false);
                setRankingOpen(false);
                setActiveDestination(destination);
              }}
            >
              <GameIcon kind={destination.icon} size={52} />
              <span>{destination.label}</span>
            </DialogTrigger>
          ))}
        </nav>

        <button
          ref={chatTrigger}
          type="button"
          className="hub-chat-toggle"
          aria-expanded={chatOpen}
          aria-controls={chatOpen ? chatId : undefined}
          onClick={() => {
            setRankingOpen(false);
            setChatOpen((open) => !open);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && chatOpen) {
              event.stopPropagation();
              closeChat();
            }
          }}
        >
          <Globe2 size={17} className="hub-chat-globe" aria-hidden="true" />
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
        <GameIcon
          kind={activeDestination.icon}
          size={88}
          className="hub-destination-art"
        />
        <span className="hub-coming-soon">Bientôt disponible</span>
        <DialogTitle>{activeDestination.label}</DialogTitle>
        <DialogDescription>{activeDestination.description}</DialogDescription>
        <p className="hub-destination-detail">{activeDestination.detail}</p>
        <Link to="/arena" className="sylve-button">
          {activeDestination.action} <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </DialogContent>
    </Dialog>
  );
}
