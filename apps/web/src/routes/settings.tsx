import { createFileRoute } from "@tanstack/react-router";
import { useCurrentUser } from "@/hooks/use-current-user";
import { requireGameAuth } from "@/lib/game-auth";
import settingsCss from "@/settings.css?url";

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
    links: [
      { rel: "stylesheet", href: settingsCss },
      { rel: "preload", as: "image", href: "/art/guardian-house.webp" },
    ],
  }),
  beforeLoad: ({ context, location }) =>
    requireGameAuth(context.isAuthenticated, location.href),
  component: RouteComponent,
});

function RouteComponent() {
  const user = useCurrentUser();

  return <SettingsPage user={user} />;
}
