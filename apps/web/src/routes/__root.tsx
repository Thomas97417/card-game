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

import Header from "../components/header";
import ErrorBoundary from "../components/error-boundary";
import NotFound from "../components/not-found";
import appCss from "../index.css?url";
import gameCss from "../game.css?url";
import workshopCss from "../deck-workshop.css?url";
import progressionCss from "../progression.css?url";
import lobbyCss from "../play-lobby.css?url";
import leaguesCss from "../leagues.css?url";
import { ThemeProvider } from "@/components/theme-provider";
import { GoldProvider } from "@/components/gold-balance";

const getAuth = createServerFn({ method: "GET" }).handler(async () => {
  return await getToken();
});

export interface RouterAppContext {
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
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
      { rel: "stylesheet", href: workshopCss },
      { rel: "stylesheet", href: progressionCss },
      { rel: "stylesheet", href: lobbyCss },
      { rel: "stylesheet", href: leaguesCss },
    ],
  }),

  component: RootDocument,
  beforeLoad: async (ctx) => {
    const token = await getAuth();
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
    }
    return {
      isAuthenticated: !!token,
      token,
    };
  },
  errorComponent: ErrorBoundary,
  notFoundComponent: NotFound,
});

function RootDocument() {
  const context = useRouteContext({ from: Route.id });
  const isImmersive = useRouterState({
    select: (state) =>
      state.matches.some(
        (match) =>
          match.routeId === "/hub" ||
          match.routeId === "/decks" ||
          match.routeId === "/play" ||
          match.routeId === "/game/$gameId" ||
          match.routeId === "/practice",
      ),
  });
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
            <GoldProvider>
              <div
                className={
                  isImmersive
                    ? "grid h-svh grid-rows-[minmax(0,1fr)]"
                    : "grid h-svh grid-rows-[auto_minmax(0,1fr)]"
                }
              >
                {!isImmersive && <Header />}
                <div
                  className={
                    isImmersive
                      ? "min-h-0 overflow-hidden"
                      : "min-h-0 overflow-y-auto"
                  }
                >
                  <Outlet />
                </div>
              </div>
              <Toaster richColors />
            </GoldProvider>
            <Scripts />
          </ThemeProvider>
        </body>
      </html>
    </ConvexBetterAuthProvider>
  );
}
