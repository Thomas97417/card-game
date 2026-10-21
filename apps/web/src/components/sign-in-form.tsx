import { safeReturnTo } from "@/lib/game-auth";
import { useForm } from "@tanstack/react-form";
import { Link, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import { GitHubLoginButton, GoogleLoginButton } from "./social-login-buttons";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import PasswordInput from "./ui/password-input";

export default function SignInForm() {
  const search = useSearch({ strict: false });
  const returnTo = safeReturnTo(search.returnTo);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
        },
        {
          onSuccess: () => {
            window.location.assign(returnTo);
            toast.success("Connexion réussie");
          },
          onError: (error) => {
            if (error.error.status === 403) {
              toast.error("Vérifie ton adresse email avant de te connecter.");
            } else {
              toast.error(error.error.message || error.error.statusText);
            }
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Adresse email invalide"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  return (
    <div className="mx-auto w-full mt-10 max-w-md p-6">
      <h1 className="mb-6 text-center text-3xl font-bold">
        Heureux de te retrouver.
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <div>
          <form.Field name="email">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Email</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  placeholder="john.doe@example.com"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-red-500 text-xs">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <div>
          <form.Field name="password">
            {(field) => (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={field.name}>Mot de passe</Label>
                  <Link
                    to="/forgot-password"
                    search={{ returnTo }}
                    className="text-xs text-muted-foreground hover:underline cursor-pointer"
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>
                <PasswordInput
                  id={field.name}
                  placeholder="********"
                  autoComplete="current-password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-red-500 text-xs">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <form.Subscribe>
          {(state) => (
            <Button
              type="submit"
              className="w-full"
              disabled={!state.canSubmit || state.isSubmitting}
            >
              {state.isSubmitting ? "Un instant…" : "Se connecter"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Ou continuer avec
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <GitHubLoginButton returnTo={returnTo} />
        <GoogleLoginButton returnTo={returnTo} />
      </div>

      <div className="mt-4 text-center text-sm text-muted-foreground">
        <span>Pas encore de compte ? </span>
        <Link
          to="/sign-up"
          search={{ returnTo }}
          className="hover:underline hover:text-foreground cursor-pointer font-bold"
        >
          Créer un compte
        </Link>
        <span className="mx-2">·</span>
        <Link
          to="/verify-email"
          search={{ returnTo }}
          className="hover:underline hover:text-foreground cursor-pointer"
        >
          Vérifier mon email
        </Link>
      </div>
    </div>
  );
}
