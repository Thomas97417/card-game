import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import type { Id } from "@my-better-t-app/backend/convex/_generated/dataModel";
import { DuelScreen } from "@/components/game/duel-screen";
import { GameLoading } from "@/components/game/shared";
import { requireGameAuth } from "@/lib/game-auth";

export const Route = createFileRoute("/game/$gameId")({
  beforeLoad: ({ context, location }) =>
    requireGameAuth(context.isAuthenticated, location.href),
  head: () => ({ meta: [{ title: "Le duel — Sylve" }] }),
  component: GamePage,
  errorComponent: () => (
    <main className="sylve-page">
      <h1>Ce duel est inaccessible.</h1>
      <p className="muted">
        Vérifie le lien et le compte avec lequel tu es connecté.
      </p>
      <Link to="/play" className="sylve-button">
        Retour au salon
      </Link>
    </main>
  ),
});
function GamePage() {
  const { gameId: rawId } = Route.useParams();
  const gameId = rawId as Id<"games">;
  const data = useQuery(api.games.get, { gameId });
  const playCard = useMutation(api.games.playCard);
  const withdrawCard = useMutation(api.games.withdrawCard);
  const endTurn = useMutation(api.games.endTurn);
  const surrender = useMutation(api.games.surrender);
  if (!data) return <GameLoading />;
  return (
    <DuelScreen
      key={gameId}
      data={data}
      onPlayCard={(cardId, row, depth, expectedTurn) =>
        playCard({ gameId, cardId, row, depth, expectedTurn })
      }
      onWithdrawCard={(cardId, expectedTurn) =>
        withdrawCard({ gameId, cardId, expectedTurn })
      }
      onEndTurn={(expectedTurn) => endTurn({ gameId, expectedTurn })}
      onSurrender={() => surrender({ gameId })}
    />
  );
}
