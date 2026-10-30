import { redirect } from "@tanstack/react-router";

export function safeReturnTo(value: unknown): string {
  return typeof value === "string" &&
    /^\/(?:hub|world|dashboard|arena|play|decks|sanctuary|guardian|settings|game\/[^/?#]+)(?:[?#].*)?$/.test(value)
    ? value
    : "/hub";
}
export function requireGameAuth(isAuthenticated: boolean, href: string) {
  if (!isAuthenticated)
    throw redirect({
      to: "/sign-in",
      search: { returnTo: safeReturnTo(href) },
    });
  return { requiresGameAuth: true } as const;
}
