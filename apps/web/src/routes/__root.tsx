import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouteContext,
  useRouterState,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { Toaster } from "@/components/ui/sonner";
import { authClient } from "@/lib/auth-client";
import { getToken } from "@/lib/auth-server";
import type { NavigationAuth } from "@/lib/navigation-auth";

import Header from "../components/header";
import ErrorBoundary from "../components/error-boundary";
import NotFound from "../components/not-found";
import appCss from "../index.css?url";
import gameCss from "../game.css?url";
import duelIntroCss from "../duel-intro.css?url";
import cardArtworkCss from "../card-artwork.css?url";
import progressionCss from "../progression.css?url";
import leaguesCss from "../leagues.css?url";
import { ThemeProvider } from "@/components/theme-provider";
import { GoldProvider } from "@/components/gold-balance";
import { EmeraldProvider } from "@/components/emerald-balance";
import { FriendshipProvider } from "@/components/friendship-balance";
import { PlayerHeaderProvider } from "@/components/player-header";
import { GameAuthGate } from "@/components/game-auth-gate";
import { DuelTransitionProvider } from "@/components/game/duel-transition";
import playerHeaderCss from "../player-header.css?url";
import factionsCss from "../factions.css?url";
import rankCss from "../rank.css?url";
import { RankProvider } from "@/components/rank-progress";

const getAuth = createServerFn({ method: "GET" }).handler(async () => {
  return await getToken();
});

export interface RouterAppContext {
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
  navigationAuth: NavigationAuth;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Sylve — Le cercle des gardiens",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "stylesheet", href: gameCss },
      { rel: "stylesheet", href: duelIntroCss },
      { rel: "stylesheet", href: cardArtworkCss },
      { rel: "stylesheet", href: progressionCss },
      { rel: "stylesheet", href: leaguesCss },
      { rel: "stylesheet", href: playerHeaderCss },
      { rel: "stylesheet", href: factionsCss },
      { rel: "stylesheet", href: rankCss },
    ],
  }),

  component: RootDocument,
  beforeLoad: async (ctx) => {
    const auth = await ctx.context.navigationAuth.load(getAuth);
    if (auth.token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(auth.token);
    }
    return auth;
  },
  errorComponent: ErrorBoundary,
  notFoundComponent: NotFound,
});

function RootDocument() {
  const context = useRouteContext({ from: Route.id });
  const isLanding = useRouterState({
    select: (state) => state.location.pathname === "/",
  });
  const authRouteId = useRouterState({
    select: (state) =>
      state.matches.find((match) => match.routeId.startsWith("/(auth)/"))
        ?.routeId,
  });
  const isAuthPage = authRouteId !== undefined;
  const legalRouteId = useRouterState({
    select: (state) =>
      state.matches.find((match) => match.routeId.startsWith("/(legal)/"))
        ?.routeId,
  });
  const isLegalPage = legalRouteId !== undefined;
  const requiresAuth = useRouterState({
    select: (state) =>
      state.matches.some(
        (match) =>
          "requiresGameAuth" in match.context &&
          match.context.requiresGameAuth === true,
      ),
  });
  const isImmersive = useRouterState({
    select: (state) => {
      const pathname = state.location.pathname.replace(/\/$/, "");
      return (
        [
          "/hub",
          "/decks",
          "/sanctuary",
          "/arena",
          "/play",
          "/settings",
          "/guardian",
          "/practice",
        ].includes(pathname) || pathname.startsWith("/game/")
      );
    },
  });
  const showHeader = !isImmersive && !isLanding && !isAuthPage && !isLegalPage;

  return (
    <ConvexBetterAuthProvider
      client={context.convexQueryClient.convexClient}
      authClient={authClient}
      initialToken={context.token}
    >
      <html lang="fr" suppressHydrationWarning>
        <head>
          <HeadContent />
        </head>
        <body>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            disableTransitionOnChange
            storageKey="vite-ui-theme"
          >
            <GameAuthGate required={requiresAuth} navigationAuth={context.navigationAuth} queryClient={context.queryClient}>
              <GoldProvider>
                <EmeraldProvider>
                  <FriendshipProvider>
                    <PlayerHeaderProvider>
                      <RankProvider>
                        <DuelTransitionProvider>
                          <div
                            className={
                              showHeader
                                ? "grid h-svh grid-rows-[auto_minmax(0,1fr)]"
                                : "grid h-svh grid-rows-[minmax(0,1fr)]"
                            }
                          >
                            {showHeader && <Header />}
                            <div
                              key={authRouteId ?? legalRouteId}
                              className={
                                isImmersive
                                  ? "min-h-0 overflow-hidden"
                                  : isLanding
                                    ? "landing-scroll-container min-h-0 overflow-y-auto"
                                    : isAuthPage
                                      ? "auth-scroll-container min-h-0 overflow-y-auto"
                                      : isLegalPage
                                        ? "legal-scroll-container min-h-0 overflow-y-auto"
                                        : "min-h-0 overflow-y-auto"
                              }
                            >
                              <Outlet />
                            </div>
                          </div>
                        </DuelTransitionProvider>
                        <Toaster richColors />
                      </RankProvider>
                    </PlayerHeaderProvider>
                  </FriendshipProvider>
                </EmeraldProvider>
              </GoldProvider>
            </GameAuthGate>
            <Scripts />
          </ThemeProvider>
        </body>
      </html>
    </ConvexBetterAuthProvider>
  );
}
