import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
} from "./settings-card";

import PasswordInput from "../ui/password-input";
import { KeyRound } from "lucide-react";
import { settingsError } from "./settings-error";

export default function ChangePasswordCard() {
  const form = useForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
        revokeOtherSessions: true,
      });
      if (error) {
        toast.error(
          settingsError(
            error,
            "Le mot de passe n’a pas pu être modifié. Réessaie.",
          ),
        );
      } else {
        toast.success("Ton mot de passe a été modifié.");
        form.reset();
      }
    },
    validators: {
      onSubmit: z
        .object({
          currentPassword: z.string().min(1, "Saisis ton mot de passe actuel."),
          newPassword: z
            .string()
            .min(
              8,
              "Le nouveau mot de passe doit contenir au moins 8 caractères.",
            ),
          confirmPassword: z.string(),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: "Les mots de passe ne correspondent pas.",
          path: ["confirmPassword"],
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
            icon={KeyRound}
            title="Mot de passe"
            description="Choisis un nouveau mot de passe pour protéger ton compte."
          />
          <div className="settings-password-fields">
            <form.Field
              name="currentPassword"
              children={(field) => (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="currentPassword">Mot de passe actuel</Label>
                  <PasswordInput
                    id="currentPassword"
                    placeholder="Ton mot de passe actuel"
                    autoComplete="current-password"
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
            <form.Field
              name="newPassword"
              children={(field) => (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                  <PasswordInput
                    id="newPassword"
                    placeholder="Au moins 8 caractères"
                    autoComplete="new-password"
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
            <form.Field
              name="confirmPassword"
              children={(field) => (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="confirmPassword">
                    Confirmer le nouveau mot de passe
                  </Label>
                  <PasswordInput
                    id="confirmPassword"
                    placeholder="Saisis à nouveau le mot de passe"
                    autoComplete="new-password"
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
          </div>
        </SettingsCardContent>
        <SettingsCardFooter>
          <p className="text-sm text-muted-foreground">
            8 caractères minimum. Les autres appareils seront déconnectés.
          </p>
          <form.Subscribe>
            {(state) => (
              <Button
                type="submit"
                size="sm"
                disabled={!state.canSubmit || state.isSubmitting}
              >
                {state.isSubmitting ? "Enregistrement…" : "Enregistrer"}
              </Button>
            )}
          </form.Subscribe>
        </SettingsCardFooter>
      </SettingsCard>
    </form>
  );
}
