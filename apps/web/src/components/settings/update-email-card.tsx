import { Input } from "@/components/ui/input";

import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
} from "./settings-card";
import { Label } from "../ui/label";
import { useForm } from "@tanstack/react-form";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import z from "zod";
import { Button } from "../ui/button";
import { Loader2, Mail } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { settingsError } from "./settings-error";

export default function UpdateEmailCard({ email }: { email: string }) {
  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data } = await authClient.listAccounts();
      return data;
    },
  });
  const isSocialOnly =
    accounts !== undefined &&
    accounts !== null &&
    !accounts.some((account) => account.providerId === "credential");

  const form = useForm({
    defaultValues: { newEmail: email },
    onSubmit: async ({ value }) => {
      await authClient.changeEmail(
        { newEmail: value.newEmail },
        {
          onSuccess: () => {
            toast.success("Ton adresse e-mail a été enregistrée.");
          },
          onError: (error) => {
            toast.error(
              settingsError(
                error.error,
                "Ton adresse e-mail n’a pas pu être enregistrée. Réessaie.",
              ),
            );
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        newEmail: z.string().email("Saisis une adresse e-mail valide."),
      }),
    },
  });
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <SettingsCard>
        <SettingsCardContent>
          <SettingsCardHeader
            icon={Mail}
            title="Adresse e-mail"
            description="L’adresse utilisée pour te connecter et retrouver ton compte."
          />
          <form.Field
            name="newEmail"
            children={(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor="newEmail">Ton adresse e-mail</Label>
                <Input
                  id="newEmail"
                  type="email"
                  autoComplete="email"
                  aria-invalid={field.state.meta.errors.length > 0}
                  required
                  disabled={isSocialOnly}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.map((error) => (
                  <p
                    key={error?.message}
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          />
        </SettingsCardContent>
        <SettingsCardFooter>
          <p className="text-sm text-muted-foreground">
            {isSocialOnly
              ? "Cette adresse est gérée par ton fournisseur de connexion."
              : "Utilise une adresse à laquelle tu as accès."}
          </p>
          <form.Subscribe>
            {(state) => (
              <Button
                type="submit"
                size="sm"
                disabled={
                  isSocialOnly || !state.canSubmit || state.isSubmitting
                }
              >
                {state.isSubmitting ? (
                  <>
                    <Loader2
                      className="animate-spin size-4"
                      aria-hidden="true"
                    />
                    Enregistrement…
                  </>
                ) : (
                  "Enregistrer"
                )}
              </Button>
            )}
          </form.Subscribe>
        </SettingsCardFooter>
      </SettingsCard>
    </form>
  );
}
