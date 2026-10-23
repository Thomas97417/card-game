import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { Sanctuary } from "@/components/sanctuary/sanctuary";
import { useDiamondBalance } from "@/components/diamond-balance";
import { showGameError } from "@/components/game/shared";
import { requireGameAuth } from "@/lib/game-auth";

export const Route = createFileRoute("/sanctuary")({
  beforeLoad: ({ context, location }) =>
    requireGameAuth(context.isAuthenticated, location.href),
  head: () => ({
    meta: [{ title: "Le sanctuaire — Sylve" }],
    links: [{ rel: "preload", as: "image", href: "/art/sanctuary.webp" }],
  }),
  component: SanctuaryPage,
});

function SanctuaryPage() {
  const diamonds = useDiamondBalance();
  const latest = useQuery(api.sanctuary.latest);
  const summon = useMutation(api.sanctuary.summon);
  const ensureStarter = useMutation(api.decks.ensureStarter);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    void ensureStarter()
      .then(() => {
        if (mounted) setReady(true);
      })
      .catch(showGameError);
    return () => {
      mounted = false;
    };
  }, [ensureStarter]);
  return (
    <Sanctuary
      diamonds={diamonds}
      ready={ready}
      latest={latest}
      onSummon={summon}
    />
  );
}
