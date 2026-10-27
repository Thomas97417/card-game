import { AuthLayout, authPageLinks } from "@/components/auth/auth-layout";
import { safeReturnTo } from "@/lib/game-auth";
import { createFileRoute, redirect } from "@tanstack/react-router";
import SignInForm from "@/components/sign-in-form";

export const Route = createFileRoute("/(auth)/sign-in")({
  validateSearch: (search: Record<string, unknown>): { returnTo?: string } => ({
    returnTo: safeReturnTo(search.returnTo),
  }),
  head: () => ({
    meta: [
      { title: "Connexion — Sylve" },
      {
        name: "description",
        content: "Connecte-toi à Sylve pour retrouver ton refuge, tes compagnons et tes decks.",
      },
    ],
    links: authPageLinks("sign-in"),
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
    <AuthLayout scene="sign-in">
      <SignInForm />
    </AuthLayout>
  );
}
