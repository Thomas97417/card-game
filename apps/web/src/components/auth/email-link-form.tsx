import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Link, useSearch } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import z from "zod";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-feedback";
import { safeReturnTo } from "@/lib/game-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthField, AuthHeading, AuthNotice, AuthStateArt, AuthSubmit, submitAuthForm } from "./form-ui";

export function EmailLinkForm({ kind }: { kind: "verification" | "password-reset" }) {
  const search = useSearch({ strict: false });
  const returnTo = safeReturnTo(search.returnTo);
  const verification = kind === "verification";
  const initialEmail = verification && typeof search.email === "string" ? search.email.trim().slice(0, 254) : "";
  const initiallySent = verification && search.sent === true && initialEmail !== "";
  const [sentEmail, setSentEmail] = useState(initiallySent ? initialEmail : "");
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(initiallySent ? 60 : 0);
  const coolingDown = cooldown > 0;

  useEffect(() => {
    if (!coolingDown) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [coolingDown]);

  async function sendLink(email: string) {
    setError(null);
    try {
      const result = verification
        ? await authClient.sendVerificationEmail({ email, callbackURL: `${window.location.origin}/sign-in?returnTo=${encodeURIComponent(returnTo)}` })
        : await authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/reset-password?returnTo=${encodeURIComponent(returnTo)}` });
      if (result.error) {
        setError(authErrorMessage(result.error, "Le lien n’a pas pu être envoyé. Réessaie dans un instant."));
        return;
      }
      setSentEmail(email);
      setCooldown(60);
    } catch {
      setError("L’envoi n’a pas abouti. Vérifie ta connexion internet et réessaie.");
    }
  }

  const form = useForm({
    defaultValues: { email: initialEmail },
    validators: { onSubmit: z.object({ email: z.string().trim().pipe(z.email("Saisis une adresse email valide.")) }) },
    onSubmit: async ({ value }) => { await sendLink(value.email.trim()); },
  });

  async function resend() {
    if (resending || coolingDown) return;
    setResending(true);
    try { await sendLink(sentEmail); } finally { setResending(false); }
  }

  if (sentEmail) {
    return (
      <div className="auth-success">
        <AuthStateArt />
        <AuthHeading title="Consulte ta boîte mail.">
          Si un compte correspond à <span className="auth-success-email">{sentEmail}</span>,
          tu recevras un lien pour {verification ? "activer ton compte" : "choisir un nouveau mot de passe"}. Pense à vérifier tes indésirables.
        </AuthHeading>
        {error && <AuthNotice>{error}</AuthNotice>}
        <div className="auth-state-actions">
          <Link to="/sign-in" search={{ returnTo }} className="auth-primary-link">Aller à la connexion <ArrowRight size={17} aria-hidden="true" /></Link>
          <Button type="button" variant="outline" className="auth-secondary-button" disabled={resending || coolingDown} onClick={() => void resend()} aria-busy={resending}>
            {resending ? <><LoaderCircle className="auth-spinner" size={17} aria-hidden="true" /> Envoi en cours…</> : coolingDown ? `Renvoyer le lien dans ${cooldown} s` : "Renvoyer le lien"}
          </Button>
          <button type="button" className="auth-edit-email" onClick={() => { setSentEmail(""); setError(null); setCooldown(0); }}>Utiliser une autre adresse</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <AuthHeading title={verification ? "Vérifie ton adresse email." : "Retrouve ton refuge."}>
        {verification ? "Reçois un lien pour activer ton compte et rejoindre le cercle des gardiens." : "Entre ton adresse email pour recevoir un lien et choisir un nouveau mot de passe."}
      </AuthHeading>
      {error && <AuthNotice>{error}</AuthNotice>}
      <form noValidate className="auth-form" onSubmit={(event) => { void submitAuthForm(event, () => form.handleSubmit()); }}>
        <form.Field name="email">
          {(field) => (
            <AuthField id={field.name} label="Adresse email" errors={field.state.meta.errors}>
              {(accessibility) => <Input {...accessibility} name={field.name} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="toi@exemple.fr" required value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />}
            </AuthField>
          )}
        </form.Field>
        <form.Subscribe>
          {(state) => <AuthSubmit pending={state.isSubmitting} disabled={!state.canSubmit} pendingLabel="Envoi du lien…">{verification ? "Envoyer le lien de vérification" : "Envoyer le lien de réinitialisation"}</AuthSubmit>}
        </form.Subscribe>
      </form>
      <Link to="/sign-in" search={{ returnTo }} className="auth-back-link"><ArrowLeft size={15} aria-hidden="true" /> Retour à la connexion</Link>
    </>
  );
}
