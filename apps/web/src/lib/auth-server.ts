import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";
import { env } from "@my-better-t-app/env/web";

export const { handler, fetchAuthQuery, fetchAuthMutation, fetchAuthAction } =
  convexBetterAuthReactStart({
    convexUrl: env.VITE_CONVEX_URL,
    convexSiteUrl: env.VITE_CONVEX_SITE_URL,
  });

// Forward the session cookie without the incoming localhost Host header.
// Keeping that header when calling the remote token endpoint breaks SSR auth.
export async function getToken(): Promise<string | undefined> {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const cookie = getRequestHeader("cookie") ?? "";
  if (!/(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/.test(cookie))
    return undefined;
  const response = await fetch(
    `${env.VITE_CONVEX_SITE_URL}/api/auth/convex/token`,
    {
      headers: { cookie },
      cache: "no-store",
    },
  );
  if (response.status === 401) return undefined;
  if (!response.ok)
    throw new Error("Le service de connexion est temporairement indisponible.");
  const data = (await response.json()) as { token?: string };
  return data.token;
}
