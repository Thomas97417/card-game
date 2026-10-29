import { stylesheet } from "@/lib/stylesheet";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useEffect, useRef } from "react";
import { isCardVariantId } from "@sylve/game/card-ids";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { DeckWorkshop } from "@/components/decks/deck-workshop";
import { showGameError } from "@/components/game/shared";
import { requireGameAuth } from "@/lib/game-auth";
import { PLAYER_QUERY_OPTIONS } from "@/hooks/use-player-query-cache";
import { useSocialDay } from "@/components/hub/use-social-day";
import workshopCss from "@/deck-workshop.css?url";

export const Route = createFileRoute("/decks")({
  validateSearch: (search: Record<string, unknown>): { card?: string } => ({
    card:
      isCardVariantId(search.card)
        ? search.card
        : undefined,
  }),
  beforeLoad: ({ context, location }) =>
    requireGameAuth(context.isAuthenticated, location.href),
  head: () => ({
    meta: [{ title: "Deck et collection — Sylve" }],
    links: [
      stylesheet(workshopCss),
      { rel: "preload", as: "image", href: "/art/deck-workshop.webp" },
    ],
  }),
  component: DecksPage,
});

function DecksPage() {
  const { card } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: decks } = useQuery({
    ...convexQuery(api.decks.list, {}),
    ...PLAYER_QUERY_OPTIONS,
  });
  const ensureStarter = useMutation(api.decks.ensureStarter);
  const save = useMutation(api.decks.save);
  const { data: collection } = useQuery({
    ...convexQuery(api.collection.list, {}),
    ...PLAYER_QUERY_OPTIONS,
  });
  const { data: league } = useQuery({
    ...convexQuery(api.collection.league, {}),
    ...PLAYER_QUERY_OPTIONS,
  });
  const upgrade = useMutation(api.collection.upgrade);
  const { data: hero } = useQuery({
    ...convexQuery(api.collection.hero, {}),
    ...PLAYER_QUERY_OPTIONS,
  });
  const { data: soulProgress } = useQuery({
    ...convexQuery(api.collection.soulProgress, {}),
    ...PLAYER_QUERY_OPTIONS,
  });
  const soulbind = useMutation(api.collection.soulbind);
  const sacrifice = useMutation(api.collection.sacrifice);
  const evolve = useMutation(api.collection.evolve);
  const refreshDay = useSocialDay();
  const { data: cardRequestStatus } = useQuery({
    ...convexQuery(api.social.cardRequestStatus, { refreshDay }),
    ...PLAYER_QUERY_OPTIONS,
  });
  const requestCards = useMutation(api.social.requestCards);
  const starterRequested = useRef(false);
  const needsStarter = decks?.length === 0 || collection?.length === 0;

  useEffect(() => {
    if (!needsStarter || starterRequested.current) return;
    starterRequested.current = true;
    void ensureStarter().catch(showGameError);
  }, [needsStarter, ensureStarter]);

  return (
    <DeckWorkshop
      league={league}
      hero={hero}
      deck={!needsStarter && league ? decks?.[0] : undefined}
      collection={collection}
      inspectedCardId={card}
      onInspectCard={(card) =>
        void navigate({ search: { card }, replace: true })
      }
      onSave={save}
      onUpgrade={(variantId) => upgrade({ variantId })}
      soulProgress={soulProgress}
      onSoulbind={(variantId, tier) => soulbind({ variantId, tier })}
      onSacrifice={(variantId, batches) => sacrifice({ variantId, batches })}
      onEvolve={(variantId, targetId) => evolve({ variantId, targetId })}
      cardRequestStatus={cardRequestStatus}
      onRequestCards={(variantId) => requestCards({ variantId })}
    />
  );
}
