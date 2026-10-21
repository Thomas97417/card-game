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
        content: "Create a new Toma Stack account.",
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
      <SignUpForm />
    </div>
  );
}
