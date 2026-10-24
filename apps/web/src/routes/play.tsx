import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/play")({
  validateSearch: (search: Record<string, unknown>): { invite?: string } => ({
    invite:
      typeof search.invite === "string"
        ? search.invite.slice(0, 16).toUpperCase()
        : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/arena", search, replace: true });
  },
});
