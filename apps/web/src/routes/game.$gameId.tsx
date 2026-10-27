import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { DuelScreen, type DuelData } from "@/components/game/duel-screen";
import { DuelIntro, useDuelIntro } from "@/components/game/duel-intro";
import { useDuelTransition } from "@/components/game/duel-transition";
import { GameLoading } from "@/components/game/shared";
import { requireGameAuth } from "@/lib/game-auth";
import { showGameError } from "@/components/game/shared";
import { useEffect, useState } from "react";
import { COMBAT_TIMING } from "@/components/game/combat-timing";
import { optimisticallyPlayCard } from "@/lib/optimistic-game";

export const Route = createFileRoute("/game/$gameId")({
  beforeLoad: ({ context, location }) =>
    requireGameAuth(context.isAuthenticated, location.href),
  head: () => ({
    meta: [{ title: "Le duel — Sylve" }],
    links: [
      { rel: "preload", as: "image", href: "/art/duel-arena-overhead.webp" },
      { rel: "preload", as: "image", href: "/art/heroes/hero-sylve.webp" },
      { rel: "preload", as: "image", href: "/art/heroes/hero-amber.webp" },
    ],
  }),
  component: GamePage,
  errorComponent: GameError,
});

function GameError() {
  const transition = useDuelTransition();
  useEffect(() => transition?.cancel(), [transition?.cancel]);
  return (
    <main className="sylve-page">
      <h1>Ce duel est inaccessible.</h1>
      <p className="muted">
        Vérifie le lien et le compte avec lequel tu es connecté.
      </p>
      <Link to="/arena" className="sylve-button">
        Retour au salon
      </Link>
    </main>
  );
}
function GamePage() {
  const { gameId: rawId } = Route.useParams();
  const gameId = rawId as Id<"games">;
  const data = useQuery(api.games.get, { gameId });
  const transition = useDuelTransition();
  if (!data)
    return transition?.active ? (
      <div className="duel-entry" />
    ) : (
      <GameLoading />
    );
  return <GameMatch key={gameId} gameId={gameId} data={data} />;
}

function GameMatch({ gameId, data }: { gameId: Id<"games">; data: DuelData }) {
  const transition = useDuelTransition();
  const { showIntro, completeIntro } = useDuelIntro(
    gameId,
    data,
    transition?.active,
  );
  const presenting = showIntro || !!transition?.active;
  const playCard = useMutation(api.games.playCard).withOptimisticUpdate(
    optimisticallyPlayCard,
  );
  const playHeroAbility = useMutation(api.games.playHeroAbility);
  const endTurn = useMutation(api.games.endTurn);
  const surrender = useMutation(api.games.surrender);
  const soloTurn = useMutation(api.games.soloTurn);
  const [settledSequence, setSettledSequence] = useState(-1);
  useEffect(() => {
    if (settledSequence === data.sequence) transition?.boardReady(gameId);
  }, [settledSequence, data.sequence, gameId, transition?.boardReady]);
  useEffect(() => {
    if (
      presenting ||
      data.mode !== "solo" ||
      data.status !== "active" ||
      data.activePlayer !== 1 ||
      data.sequence !== settledSequence
    )
      return;
    const expectedTurn = data.turn;
    const expectedSequence = data.sequence;
    const timer = window.setTimeout(() => {
      void soloTurn({ gameId, expectedTurn, expectedSequence }).catch(
        showGameError,
      );
    }, COMBAT_TIMING.computerThink);
    return () => window.clearTimeout(timer);
  }, [
    data.mode,
    data.status,
    data.activePlayer,
    data.sequence,
    data.turn,
    settledSequence,
    presenting,
    soloTurn,
    gameId,
  ]);
  return (
    <div className="duel-entry">
      <div
        className="duel-entry-board"
        inert={presenting}
        aria-hidden={presenting || undefined}
      >
        <DuelScreen
          data={data}
          practice={data.mode === "solo"}
          onPlaybackSettled={setSettledSequence}
          onHeroAbility={(abilityId, expectedUses, expectedTurn) =>
            playHeroAbility({ gameId, abilityId, expectedUses, expectedTurn })
          }
          onPlayCard={(cardId, row, depth, expectedTurn) =>
            playCard({ gameId, cardId, row, depth, expectedTurn })
          }
          onEndTurn={(expectedTurn) => endTurn({ gameId, expectedTurn })}
          onSurrender={() => surrender({ gameId })}
        />
      </div>
      {showIntro && <DuelIntro data={data} onComplete={completeIntro} />}
    </div>
  );
}
