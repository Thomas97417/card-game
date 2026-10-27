import { AuthLayout, authPageLinks } from "@/components/auth/auth-layout";
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
        content: "Choisis un nouveau mot de passe pour ton compte Sylve.",
      },
    ],
    links: authPageLinks("reset-password"),
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
    <AuthLayout scene="reset-password">
      <ResetPasswordForm />
    </AuthLayout>
  );
}
