import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
} from "./settings-card";
import { Label } from "../ui/label";
import { Loader2, UserRound } from "lucide-react";
import { settingsError } from "./settings-error";

export default function UpdateNameCard({ name }: { name: string }) {
  const form = useForm({
    defaultValues: { name },
    onSubmit: async ({ value }) => {
      await authClient.updateUser(
        { name: value.name },
        {
          onSuccess: () => {
            toast.success("Ton nom de gardien a été enregistré.");
          },
          onError: (error) => {
            toast.error(
              settingsError(
                error.error,
                "Ton nom n’a pas pu être enregistré. Réessaie.",
              ),
            );
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .trim()
          .min(2, "Le nom doit contenir au moins 2 caractères.")
          .max(32, "Le nom ne peut pas dépasser 32 caractères."),
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
            icon={UserRound}
            title="Nom de gardien"
            description="Le nom que les autres gardiens voient dans le jeu."
          />
          <form.Field
            name="name"
            children={(field) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor="guardianName">Ton nom</Label>
                <Input
                  id="guardianName"
                  placeholder="Ton nom de gardien"
                  autoComplete="nickname"
                  maxLength={32}
                  aria-invalid={field.state.meta.errors.length > 0}
                  required
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
            Entre 2 et 32 caractères.
          </p>
          <form.Subscribe>
            {(state) => (
              <Button
                type="submit"
                size="sm"
                disabled={!state.canSubmit || state.isSubmitting}
              >
                {state.isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
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
