import { safeReturnTo } from "@/lib/game-auth";
import { createFileRoute, redirect } from "@tanstack/react-router";
import ResetPasswordForm from "@/components/reset-password-form";

export const Route = createFileRoute("/(auth)/reset-password")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { returnTo?: string; token?: string } => ({
    returnTo: safeReturnTo(search.returnTo),
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — Sylve" },
      {
        name: "description",
        content: "Set a new password for your Toma Stack account.",
      },
    ],
  }),
  beforeLoad: async ({ context, search }) => {
    if (context.isAuthenticated) {
      throw redirect({ href: safeReturnTo(search.returnTo) });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="sylve-auth">
      <ResetPasswordForm />
    </div>
  );
}
