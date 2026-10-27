import { AuthLayout, authPageLinks } from "@/components/auth/auth-layout";
import { safeReturnTo } from "@/lib/game-auth";
import { createFileRoute, redirect } from "@tanstack/react-router";
import VerifyEmailForm from "@/components/verify-email-form";

export const Route = createFileRoute("/(auth)/verify-email")({
  validateSearch: (search: Record<string, unknown>): { returnTo?: string; email?: string; sent?: boolean } => ({
    returnTo: safeReturnTo(search.returnTo),
    email: typeof search.email === "string" ? search.email.trim().slice(0, 254) : undefined,
    sent: search.sent === true || search.sent === 1 || search.sent === "1" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Vérifier mon email — Sylve" },
      {
        name: "description",
        content: "Vérifie ton adresse email pour activer ton compte Sylve et rejoindre les gardiens.",
      },
    ],
    links: authPageLinks("verify-email"),
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
    <AuthLayout scene="verify-email">
      <VerifyEmailForm />
    </AuthLayout>
  );
}
