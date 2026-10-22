import { redirect } from "@tanstack/react-router";

export function safeReturnTo(value: unknown): string {
  return typeof value === "string" &&
    /^\/(?:dashboard|play|decks|game\/[^/?#]+)(?:[?#].*)?$/.test(value)
    ? value
    : "/dashboard";
}
export function requireGameAuth(isAuthenticated: boolean, href: string) {
  if (!isAuthenticated)
    throw redirect({
      to: "/sign-in",
      search: { returnTo: safeReturnTo(href) },
    });
}
