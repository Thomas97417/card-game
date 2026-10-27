import { AuthLayout, authPageLinks } from "@/components/auth/auth-layout";
import { safeReturnTo } from "@/lib/game-auth";
import { createFileRoute, redirect } from "@tanstack/react-router";
import SignUpForm from "@/components/sign-up-form";

export const Route = createFileRoute("/(auth)/sign-up")({
  validateSearch: (search: Record<string, unknown>): { returnTo?: string } => ({
    returnTo: safeReturnTo(search.returnTo),
  }),
  head: () => ({
    meta: [
      { title: "Créer un compte — Sylve" },
      {
        name: "description",
        content: "Crée ton compte Sylve, rassemble tes compagnons et commence ton aventure.",
      },
    ],
    links: authPageLinks("sign-up"),
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
    <AuthLayout scene="sign-up">
      <SignUpForm />
    </AuthLayout>
  );
}
