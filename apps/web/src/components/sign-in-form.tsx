import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Link, useSearch } from "@tanstack/react-router";
import z from "zod";
import { authClient } from "@/lib/auth-client";
import { authErrorCode, authErrorMessage, redirectAfterAuth } from "@/lib/auth-feedback";
import { safeReturnTo } from "@/lib/game-auth";
import { AuthField, AuthHeading, AuthNotice, AuthSubmit, submitAuthForm } from "./auth/form-ui";
import { SocialLoginButtons } from "./social-login-buttons";
import { Input } from "./ui/input";
import PasswordInput from "./ui/password-input";

export default function SignInForm() {
  const search = useSearch({ strict: false });
  const returnTo = safeReturnTo(search.returnTo);
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [socialPending, setSocialPending] = useState(false);
  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: {
      onSubmit: z.object({
        email: z.string().trim().pipe(z.email("Saisis une adresse email valide.")),
        password: z.string().min(1, "Saisis ton mot de passe."),
      }),
    },
    onSubmit: async ({ value }) => {
      setError(null);
      setNeedsVerification(false);
      try {
        const result = await authClient.signIn.email({ email: value.email.trim(), password: value.password });
        if (result.error) {
          setError(authErrorMessage(result.error, "La connexion est indisponible pour le moment. Réessaie dans un instant."));
          setNeedsVerification(authErrorCode(result.error) === "EMAIL_NOT_VERIFIED");
          return;
        }
        redirectAfterAuth(returnTo);
      } catch {
        setError("La connexion n’a pas abouti. Vérifie ta connexion internet et réessaie.");
      }
    },
  });

  return (
    <>
      <AuthHeading title="Ton aventure continue.">
        Connecte-toi pour retrouver ton refuge et tes compagnons.
      </AuthHeading>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(submitting) => <SocialLoginButtons returnTo={returnTo} disabled={submitting} onPendingChange={setSocialPending} />}
      </form.Subscribe>
      <div className="auth-divider">ou avec ton email</div>
      {error && <AuthNotice>{error}{needsVerification && <><br /><Link to="/verify-email" search={{ returnTo, email: form.state.values.email.trim() }}>Recevoir un lien de vérification</Link></>}</AuthNotice>}
      <form noValidate className="auth-form" onSubmit={(event) => { void submitAuthForm(event, () => form.handleSubmit()); }}>
        <form.Field name="email">
          {(field) => (
            <AuthField id={field.name} label="Adresse email" errors={field.state.meta.errors}>
              {(accessibility) => <Input {...accessibility} name={field.name} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="toi@exemple.fr" required value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />}
            </AuthField>
          )}
        </form.Field>
        <form.Field name="password">
          {(field) => (
            <AuthField id={field.name} label="Mot de passe" errors={field.state.meta.errors} action={<Link to="/forgot-password" search={{ returnTo }}>Mot de passe oublié ?</Link>}>
              {(accessibility) => <PasswordInput {...accessibility} name={field.name} placeholder="Ton mot de passe" autoComplete="current-password" value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />}
            </AuthField>
          )}
        </form.Field>
        <form.Subscribe>
          {(state) => <AuthSubmit pending={state.isSubmitting} disabled={!state.canSubmit || socialPending} pendingLabel="Connexion en cours…">Se connecter</AuthSubmit>}
        </form.Subscribe>
      </form>
      <p className="auth-switch">
        Pas encore de compte ? <Link to="/sign-up" search={{ returnTo }}>Créer un compte</Link>
        {!needsVerification && <Link to="/verify-email" search={{ returnTo }} className="auth-help-link">Email de vérification non reçu ?</Link>}
      </p>
    </>
  );
}
