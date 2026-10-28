import { createFileRoute } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  missionPeriod,
  type MissionPeriodKind,
  type MissionTrack,
  type MissionView,
} from "@sylve/game/missions";
import { showGameError } from "@/components/game/shared";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { VillageHub } from "@/components/hub/village-hub";
import type { MissionSealGain } from "@/components/hub/missions-dialog";
import hubCss from "@/hub.css?url";
import missionsCss from "@/missions.css?url";
import dailyRewardsCss from "@/daily-rewards.css?url";
import legendaryOffersCss from "@/legendary-offers.css?url";
import {
  CurrencyGainProvider,
  useCurrencyGain,
} from "@/components/currency-gain";
import { useMineBoard, useMineCollection } from "@/hooks/use-mine-collection";
import { requireGameAuth } from "@/lib/game-auth";
import { DeferredContent } from "@/components/deferred-content";
import { DialogLoading } from "@/components/dialog-loading";
import type { ChestReveal } from "@/components/play/chest-reveal-dialog";

const LegendaryPaymentFeedback = lazy(() =>
  import("@/components/hub/legendary-offers").then((module) => ({ default: module.LegendaryPaymentFeedback })),
);
const ChestRevealDialog = lazy(() =>
  import("@/components/play/chest-reveal-dialog").then((module) => ({ default: module.ChestRevealDialog })),
);

export const Route = createFileRoute("/hub")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { offerCheckout?: string } => ({
    offerCheckout:
      typeof search.offerCheckout === "string" &&
      /^[a-zA-Z0-9_-]{1,128}$/.test(search.offerCheckout)
        ? search.offerCheckout
        : undefined,
  }),
  beforeLoad: ({ context, location }) =>
    requireGameAuth(context.isAuthenticated, location.href),
  head: () => ({
    meta: [
      { title: "Le refuge des gardiens — Sylve" },
      {
        name: "description",
        content:
          "Retrouve ton refuge : prépare tes decks à l’atelier, découvre les créatures du sanctuaire et rejoins l’arène.",
      },
    ],
    links: [
      { rel: "stylesheet", href: hubCss },
      { rel: "stylesheet", href: missionsCss },
      { rel: "stylesheet", href: dailyRewardsCss },
      { rel: "stylesheet", href: legendaryOffersCss },
      { rel: "preload", as: "image", href: "/art/guardian-village-mines.webp" },
    ],
  }),
  component: HubPage,
});

function HubPage() {
  return (
    <CurrencyGainProvider>
      <HubContent />
    </CurrencyGainProvider>
  );
}

function HubContent() {
  const { offerCheckout } = Route.useSearch();
  const navigate = Route.useNavigate();
  const legendaryOffers = useQuery(api.payments.legendaryOffers, {});
  const createLegendaryCheckout = useAction(
    api.payments.createLegendaryCheckout,
  );
  const legendaryPaymentStatus = useQuery(
    api.payments.legendaryCheckoutStatus,
    offerCheckout ? { checkoutId: offerCheckout } : "skip",
  );
  const [now, setNow] = useState(Date.now);
  const [pending, setPending] = useState<string | null>(null);
  const [sealGain, setSealGain] = useState<MissionSealGain | null>(null);
  const nextSealGain = useRef(0);
  const [reward, setReward] = useState<ChestReveal | null>(null);
  const mines = useMineBoard(now);
  const { pending: pendingMines, collectResource } = useMineCollection(mines);
  const ensureMines = useMutation(api.collection.ensureMines);
  const collection = useQuery(api.collection.list, reward ? {} : "skip");
  const upgrade = useMutation(api.collection.upgrade);
  const inFlight = useRef(false);
  const [rewardRefreshKey, setRewardRefreshKey] = useState(Date.now);
  const dailyRewards = useQuery(api.dailyRewards.board, {
    refreshKey: rewardRefreshKey,
  });
  const claimDailyReward = useMutation(api.dailyRewards.claim);
  const showCurrencyGain = useCurrencyGain();
  const board = useQuery(api.missions.board, {
    refreshKey: missionPeriod("daily", now).key,
  });
  const claim = useMutation(api.missions.claim);
  const openChest = useMutation(api.missions.openChest);
  const activity = useQuery(api.games.activity);
  const ensureStarter = useMutation(api.decks.ensureStarter);
  useEffect(() => {
    void ensureStarter()
      .then(() => ensureMines())
      .catch(showGameError);
  }, [ensureStarter, ensureMines]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const refreshRewards = () => {
      if (document.visibilityState === "visible")
        setRewardRefreshKey(Date.now());
    };
    document.addEventListener("visibilitychange", refreshRewards);
    window.addEventListener("focus", refreshRewards);
    return () => {
      document.removeEventListener("visibilitychange", refreshRewards);
      window.removeEventListener("focus", refreshRewards);
    };
  }, []);
  useEffect(() => {
    if (!sealGain) return;
    const timer = window.setTimeout(
      () =>
        setSealGain((current) =>
          current?.id === sealGain.id ? null : current,
        ),
      1600,
    );
    return () => window.clearTimeout(timer);
  }, [sealGain]);

  async function claimMission(mission: MissionView) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(mission.id);
    try {
      const result = await claim({
        missionId: mission.id,
        periodKey: mission.periodKey,
        tier: mission.tier,
      });
      if (!result.alreadyClaimed) {
        if (result.currency === "seals") {
          setSealGain({
            id: ++nextSealGain.current,
            kind: mission.id.startsWith("daily-") ? "daily" : "weekly",
            periodKey: mission.periodKey,
            amount: result.amount,
          });
        } else showCurrencyGain("emeralds", result.amount);
      }
    } catch (error) {
      showGameError(error);
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  async function openMissionChest(
    kind: MissionPeriodKind,
    track: MissionTrack,
    index: number,
  ) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(`${kind}-chest-${index}`);
    try {
      setReward(await openChest({ kind, periodKey: track.key, index }));
    } catch (error) {
      showGameError(error);
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  async function collectDailyReward(day: number) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(`daily-reward-${day}`);
    try {
      const result = await claimDailyReward({ day });
      if (result.alreadyClaimed) return;
      if (result.rarity) {
        setReward({
          rarity: result.rarity,
          reveals: result.reveals,
          gold: result.gold,
        });
      } else {
        const currency = result.emeralds > 0 ? "emeralds" : "gold";
        const amount = result.emeralds || result.gold;
        showCurrencyGain(currency, amount);
      }
    } catch (error) {
      showGameError(error);
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  return (
    <>
      <VillageHub
        legendaryOffers={{
          board: legendaryOffers,
          onPurchase: async (offerId) => {
            const { url } = await createLegendaryCheckout({ offerId });
            window.location.assign(url);
          },
        }}
        activity={activity}
        dailyRewards={{
          board: dailyRewards,
          pending: pending !== null,
          onClaim: collectDailyReward,
        }}
        mines={{
          board: mines,
          pending: pendingMines,
          onCollect: collectResource,
        }}
        missions={{
          board,
          now,
          pending,
          sealGain,
          onClaim: claimMission,
          onOpenChest: openMissionChest,
        }}
      />
      {offerCheckout && (
        <Suspense fallback={
          <p role="status" className="legendary-payment-feedback">Vérification du paiement…</p>
        }>
          <LegendaryPaymentFeedback
            key={offerCheckout}
            status={legendaryPaymentStatus}
            onDismiss={() => void navigate({ search: {}, replace: true })}
          />
        </Suspense>
      )}
      <DeferredContent
        active={reward !== null}
        fallback={<DialogLoading title="Ton coffre" onClose={() => setReward(null)} />}
      >
        <ChestRevealDialog
          reward={reward}
          collection={collection}
          onUpgrade={(variantId) => upgrade({ variantId })}
          onClose={() => setReward(null)}
        />
      </DeferredContent>
    </>
  );
}
