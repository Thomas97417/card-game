import { AuthLayout, authPageLinks } from "@/components/auth/auth-layout";
import { safeReturnTo } from "@/lib/game-auth";
import { createFileRoute, redirect } from "@tanstack/react-router";
import ForgotPasswordForm from "@/components/forgot-password-form";

export const Route = createFileRoute("/(auth)/forgot-password")({
  validateSearch: (search: Record<string, unknown>): { returnTo?: string } => ({
    returnTo: safeReturnTo(search.returnTo),
  }),
  head: () => ({
    meta: [
      { title: "Mot de passe oublié — Sylve" },
      {
        name: "description",
        content: "Retrouve l’accès à ton compte Sylve grâce à un lien de réinitialisation envoyé par email.",
      },
    ],
    links: authPageLinks("forgot-password"),
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
    <AuthLayout scene="forgot-password">
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
