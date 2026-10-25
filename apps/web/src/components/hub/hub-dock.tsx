import { useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronUp, Globe2, MessageCircle } from "lucide-react";
import { GameIcon, type GameIconKind } from "@/components/game/game-icon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MissionsDialog, type HubMissionsProps } from "./missions-dialog";
import { MissionCheck } from "./mission-icons";

const DESTINATIONS = [
  {
    id: "ranking",
    label: "Classement",
    icon: "ranking",
    description: "Le classement mondial des gardiens arrive bientôt.",
    detail:
      "Retrouve ici les gardiens au sommet des ligues et mesure ton avancée dans la Sylve.",
    action: "Gagner des trophées",
  },
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
    description: "Chaque aventure mérite sa récompense.",
    detail:
      "Récupère des sceaux et des émeraudes en accomplissant tes missions.",
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

export function HubDock({ missions }: { missions?: HubMissionsProps }) {
  const [activeDestination, setActiveDestination] = useState<
    (typeof DESTINATIONS)[number]
  >(DESTINATIONS[0]);
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const chatId = useId();
  const chatTitleId = useId();
  const chatTrigger = useRef<HTMLButtonElement>(null);

  function closeChat() {
    setChatOpen(false);
    chatTrigger.current?.focus();
  }

  return (
    <Dialog open={destinationOpen} onOpenChange={setDestinationOpen}>
      <div className="hub-dock" role="region" aria-label="Vie du refuge">
        {chatOpen && (
          <section
            id={chatId}
            className="hub-world-chat"
            aria-labelledby={chatTitleId}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                closeChat();
              }
            }}
          >
            <div className="hub-world-chat-heading">
              <span id={chatTitleId}>
                <Globe2 size={16} aria-hidden="true" /> Chat mondial
              </span>
              <span className="hub-coming-soon">Bientôt disponible</span>
            </div>
            <div className="hub-world-chat-empty">
              <MessageCircle size={32} strokeWidth={1.25} aria-hidden="true" />
              <strong>Un lieu pour se retrouver</strong>
              <p>
                Tu pourras bientôt échanger ici avec tous les gardiens de la
                Sylve.
              </p>
            </div>
          </section>
        )}

        <nav className="hub-dock-shortcuts" aria-label="Communauté du refuge">
          {DESTINATIONS.map((destination) => (
            <DialogTrigger
              key={destination.id}
              className="hub-dock-shortcut"
              onClick={() => {
                setChatOpen(false);
                setActiveDestination(destination);
              }}
            >
              <GameIcon kind={destination.icon} size={52} />
              {destination.id === "missions" &&
                missions?.board?.hasClaimable && (
                  <span
                    className="hub-missions-ready"
                    role="img"
                    aria-label="Récompenses à récupérer"
                  >
                    <MissionCheck />
                  </span>
                )}
              <span>{destination.label}</span>
            </DialogTrigger>
          ))}
        </nav>

        <div className="hub-chat-frame">
          <button
            ref={chatTrigger}
            type="button"
            className="hub-chat-toggle"
            aria-expanded={chatOpen}
            aria-controls={chatOpen ? chatId : undefined}
            onClick={() => setChatOpen((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && chatOpen) {
                event.stopPropagation();
                closeChat();
              }
            }}
          >
            <Globe2 size={17} className="hub-chat-globe" aria-hidden="true" />
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

      {activeDestination.id === "missions" ? (
        <MissionsDialog
          {...missions}
          onNavigate={() => setDestinationOpen(false)}
        />
      ) : (
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
            {activeDestination.action}{" "}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </DialogContent>
      )}
    </Dialog>
  );
}
