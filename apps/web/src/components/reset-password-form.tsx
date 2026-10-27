import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Link, useSearch } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import z from "zod";
import { authClient } from "@/lib/auth-client";
import { authErrorCode, authErrorMessage } from "@/lib/auth-feedback";
import { safeReturnTo } from "@/lib/game-auth";
import { AuthField, AuthHeading, AuthNotice, AuthStateArt, AuthSubmit, submitAuthForm } from "./auth/form-ui";
import PasswordInput from "./ui/password-input";

export default function ResetPasswordForm() {
  const search = useSearch({ strict: false });
  const token = search.token;
  const returnTo = safeReturnTo(search.returnTo);
  const [error, setError] = useState<string | null>(null);
  const [invalidToken, setInvalidToken] = useState<string>();
  const [done, setDone] = useState(false);
  const form = useForm({
    defaultValues: { newPassword: "", confirmPassword: "" },
    validators: {
      onSubmit: z.object({
        newPassword: z.string().min(8, "Utilise au moins 8 caractères."),
        confirmPassword: z.string().min(1, "Confirme ton nouveau mot de passe."),
      }).refine((value) => value.newPassword === value.confirmPassword, { message: "Les mots de passe ne correspondent pas.", path: ["confirmPassword"] }),
    },
    onSubmit: async ({ value }) => {
      if (!token) return;
      setError(null);
      try {
        const result = await authClient.resetPassword({ newPassword: value.newPassword, token });
        if (result.error) {
          const code = authErrorCode(result.error);
          if (code === "INVALID_TOKEN" || code === "TOKEN_EXPIRED") setInvalidToken(token);
          else setError(authErrorMessage(result.error, "Ton mot de passe n’a pas pu être modifié. Réessaie dans un instant."));
          return;
        }
        form.reset();
        setDone(true);
      } catch {
        setError("La modification n’a pas abouti. Vérifie ta connexion internet et réessaie.");
      }
    },
  });

  if (!token || invalidToken === token) {
    return (
      <div className="auth-success">
        <AuthStateArt success={false} />
        <AuthHeading title="Ce lien n’est plus valide.">Le lien est incomplet ou a expiré. Demande-en un nouveau pour retrouver l’accès à ton compte.</AuthHeading>
        <Link to="/forgot-password" search={{ returnTo }} className="auth-primary-link">Demander un nouveau lien <ArrowRight size={17} aria-hidden="true" /></Link>
        <Link to="/sign-in" search={{ returnTo }} className="auth-back-link"><ArrowLeft size={15} aria-hidden="true" /> Retour à la connexion</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="auth-success">
        <AuthStateArt />
        <AuthHeading title="Ton refuge t’attend.">Ton mot de passe a bien été modifié. Connecte-toi avec ton nouveau mot de passe pour reprendre l’aventure.</AuthHeading>
        <Link to="/sign-in" search={{ returnTo }} className="auth-primary-link">Se connecter <ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
    );
  }

  return (
    <>
      <AuthHeading title="Choisis un nouveau mot de passe.">Protège ton compte, puis retrouve tes compagnons.</AuthHeading>
      {error && <AuthNotice>{error}</AuthNotice>}
      <form noValidate className="auth-form" onSubmit={(event) => { void submitAuthForm(event, () => form.handleSubmit()); }}>
        <form.Field name="newPassword">
          {(field) => (
            <AuthField id={field.name} label="Nouveau mot de passe" errors={field.state.meta.errors} descriptionId="new-password-hint">
              {(accessibility) => <PasswordInput {...accessibility} name={field.name} placeholder="Ton nouveau mot de passe" autoComplete="new-password" value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />}
            </AuthField>
          )}
        </form.Field>
        <p className="auth-password-hint" id="new-password-hint">8 caractères minimum.</p>
        <form.Field name="confirmPassword">
          {(field) => (
            <AuthField id={field.name} label="Confirmer le mot de passe" errors={field.state.meta.errors}>
              {(accessibility) => <PasswordInput {...accessibility} name={field.name} placeholder="Saisis-le une seconde fois" autoComplete="new-password" visibilityLabel="la confirmation du mot de passe" value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />}
            </AuthField>
          )}
        </form.Field>
        <form.Subscribe>
          {(state) => <AuthSubmit pending={state.isSubmitting} disabled={!state.canSubmit} pendingLabel="Modification en cours…">Enregistrer le mot de passe</AuthSubmit>}
        </form.Subscribe>
      </form>
      <Link to="/sign-in" search={{ returnTo }} className="auth-back-link"><ArrowLeft size={15} aria-hidden="true" /> Retour à la connexion</Link>
    </>
  );
}
