import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Link, useSearch } from "@tanstack/react-router";
import { Check } from "lucide-react";
import z from "zod";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage, redirectAfterAuth } from "@/lib/auth-feedback";
import { safeReturnTo } from "@/lib/game-auth";
import { AuthField, AuthHeading, AuthNotice, AuthSubmit, submitAuthForm } from "./auth/form-ui";
import { SocialLoginButtons } from "./social-login-buttons";
import { Input } from "./ui/input";
import PasswordInput from "./ui/password-input";

const passwordRules = [
  { label: "8 caractères minimum", test: (value: string) => value.length >= 8 },
  { label: "Majuscule et minuscule", test: (value: string) => /[A-Z]/.test(value) && /[a-z]/.test(value) },
  { label: "Un chiffre", test: (value: string) => /\d/.test(value) },
  { label: "Un caractère spécial", test: (value: string) => /[^A-Za-z\d]/.test(value) },
];

export default function SignUpForm() {
  const search = useSearch({ strict: false });
  const returnTo = safeReturnTo(search.returnTo);
  const [error, setError] = useState<string | null>(null);
  const [socialPending, setSocialPending] = useState(false);
  const form = useForm({
    defaultValues: { name: "", email: "", password: "" },
    validators: {
      onSubmit: z.object({
        name: z.string().trim().min(2, "Choisis un pseudo de 2 caractères minimum."),
        email: z.string().trim().pipe(z.email("Saisis une adresse email valide.")),
        password: z.string().min(8, "Utilise au moins 8 caractères.").regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/, "Ajoute une majuscule, une minuscule, un chiffre et un caractère spécial."),
      }),
    },
    onSubmit: async ({ value }) => {
      setError(null);
      const email = value.email.trim();
      try {
        const result = await authClient.signUp.email({
          name: value.name.trim(),
          email,
          password: value.password,
          callbackURL: `${window.location.origin}/sign-in?returnTo=${encodeURIComponent(returnTo)}`,
        });
        if (result.error) {
          setError(authErrorMessage(result.error, "Ton compte n’a pas pu être créé. Réessaie dans un instant."));
          return;
        }
        form.reset();
        redirectAfterAuth(`/verify-email?returnTo=${encodeURIComponent(returnTo)}&email=${encodeURIComponent(email)}&sent=1`);
      } catch {
        setError("La création du compte n’a pas abouti. Vérifie ta connexion internet et réessaie.");
      }
    },
  });

  return (
    <>
      <AuthHeading title="Deviens un gardien.">
        Crée ton compte et compose ta première alliance.
      </AuthHeading>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(submitting) => <SocialLoginButtons returnTo={returnTo} disabled={submitting} onPendingChange={setSocialPending} />}
      </form.Subscribe>
      <div className="auth-divider">ou avec ton email</div>
      {error && <AuthNotice>{error}</AuthNotice>}
      <form noValidate className="auth-form" onSubmit={(event) => { void submitAuthForm(event, () => form.handleSubmit()); }}>
        <form.Field name="name">
          {(field) => (
            <AuthField id={field.name} label="Pseudo" errors={field.state.meta.errors}>
              {(accessibility) => <Input {...accessibility} name={field.name} autoComplete="nickname" placeholder="Ton nom de gardien" required value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />}
            </AuthField>
          )}
        </form.Field>
        <form.Field name="email">
          {(field) => (
            <AuthField id={field.name} label="Adresse email" errors={field.state.meta.errors}>
              {(accessibility) => <Input {...accessibility} name={field.name} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="toi@exemple.fr" required value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />}
            </AuthField>
          )}
        </form.Field>
        <form.Field name="password">
          {(field) => (
            <AuthField id={field.name} label="Mot de passe" errors={field.state.meta.errors} descriptionId="password-rules">
              {(accessibility) => <PasswordInput {...accessibility} name={field.name} placeholder="Choisis un mot de passe" autoComplete="new-password" value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />}
            </AuthField>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.values.password}>
          {(password) => <ul className="auth-password-guide" id="password-rules" aria-label="Critères du mot de passe">{passwordRules.map((rule) => <li key={rule.label} data-met={rule.test(password)}><span aria-hidden="true">{rule.test(password) && <Check size={10} strokeWidth={3} />}</span>{rule.label}</li>)}</ul>}
        </form.Subscribe>
        <form.Subscribe>
          {(state) => <AuthSubmit pending={state.isSubmitting} disabled={!state.canSubmit || socialPending} pendingLabel="Création du compte…">Créer mon compte</AuthSubmit>}
        </form.Subscribe>
      </form>
      <p className="auth-switch">Déjà un compte ? <Link to="/sign-in" search={{ returnTo }}>Se connecter</Link></p>
    </>
  );
}
