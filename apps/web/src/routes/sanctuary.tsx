import { stylesheet } from "@/lib/stylesheet";
import { createFileRoute } from "@tanstack/react-router";
import sanctuaryCss from "@/sanctuary.css?url";
import bestiaryCss from "@/bestiary.css?url";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { Sanctuary } from "@/components/sanctuary/sanctuary";
import { CurrencyGainProvider } from "@/components/currency-gain";
import { useEmeraldBalance } from "@/components/emerald-balance";
import { useFriendshipBalance } from "@/components/friendship-balance";
import { showGameError } from "@/components/game/shared";
import { requireGameAuth } from "@/lib/game-auth";
import { EmeraldPaymentFeedback } from "@/components/sanctuary/emerald-packs";

export const Route = createFileRoute("/sanctuary")({
  validateSearch: (search: Record<string, unknown>): { checkout?: string } => ({
    checkout:
      typeof search.checkout === "string" &&
      /^[a-zA-Z0-9_-]{1,128}$/.test(search.checkout)
        ? search.checkout
        : undefined,
  }),
  beforeLoad: ({ context, location }) =>
    requireGameAuth(context.isAuthenticated, location.href),
  head: () => ({
    meta: [{ title: "Le sanctuaire — Sylve" }],
    links: [
      stylesheet(sanctuaryCss),
      stylesheet(bestiaryCss),
      { rel: "preload", as: "image", href: "/art/sanctuary.webp" },
    ],
  }),
  component: SanctuaryPage,
});

function SanctuaryPage() {
  return (
    <CurrencyGainProvider>
      <SanctuaryContent />
    </CurrencyGainProvider>
  );
}

function SanctuaryContent() {
  const { checkout } = Route.useSearch();
  const navigate = Route.useNavigate();
  const emeraldOffers = useQuery(api.payments.offers);
  const createCheckout = useAction(api.payments.createCheckout);
  const paymentStatus = useQuery(
    api.payments.checkoutStatus,
    checkout ? { checkoutId: checkout } : "skip",
  );
  const emeralds = useEmeraldBalance();
  const friendshipTokens = useFriendshipBalance();
  const latest = useQuery(api.sanctuary.latest);
  const unfinished = useQuery(api.sanctuary.unfinished);
  const saveRevealProgress = useMutation(api.sanctuary.saveRevealProgress);
  const closeCircle = useMutation(api.sanctuary.closeCircle);
  const summon = useMutation(api.sanctuary.summon);
  const buyGold = useMutation(api.sanctuary.buyGold);
  const chestSlots = useQuery(api.chests.list);
  const unlockChestSlot = useMutation(api.sanctuary.unlockChestSlot);
  const collection = useQuery(api.collection.list);
  const league = useQuery(api.collection.league);
  const upgrade = useMutation(api.collection.upgrade);
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
      emeralds={emeralds}
      friendshipTokens={friendshipTokens}
      ready={ready && !!chestSlots && !!league}
      peakTrophies={league?.peakTrophies}
      latest={latest}
      unfinished={unfinished}
      collection={collection}
      onSummon={summon}
      onCloseCircle={(repeatToken) => closeCircle({ repeatToken })}
      onSaveRevealProgress={saveRevealProgress}
      purchasedChestSlots={chestSlots?.purchasedSlots}
      onUnlockChestSlot={(slot) => unlockChestSlot({ slot })}
      onUpgrade={(variantId) => upgrade({ variantId })}
      emeraldOffers={emeraldOffers}
      onBuyGold={buyGold}
      onBuyEmeralds={async (packId) => {
        const { url } = await createCheckout({ packId });
        window.location.assign(url);
      }}
      paymentFeedback={
        checkout ? (
          <EmeraldPaymentFeedback
            key={checkout}
            status={paymentStatus}
            onDismiss={() => void navigate({ search: {}, replace: true })}
          />
        ) : null
      }
    />
  );
}
