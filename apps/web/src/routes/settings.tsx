import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCurrentUser } from "@/hooks/use-current-user";

import { SettingsPage } from "@/components/settings/settings-page";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Les archives · Paramètres — Sylve" },
      {
        name: "description",
        content:
          "Gère ton profil, la sécurité de ton compte et tes appareils depuis les Archives.",
      },
    ],
    links: [{ rel: "preload", as: "image", href: "/art/guardian-house.webp" }],
  }),
  beforeLoad: async ({ context }) => {
    if (!context.isAuthenticated) {
      throw redirect({ to: "/sign-in" });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  const user = useCurrentUser();

  return <SettingsPage user={user} />;
}
