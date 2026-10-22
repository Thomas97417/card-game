import { safeReturnTo } from "@/lib/game-auth";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

function PasswordInput({
  id,
  placeholder,
  autoComplete,
  value,
  onBlur,
  onChange,
}: {
  id: string;
  placeholder: string;
  autoComplete: string;
  value: string;
  onBlur: () => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onBlur={onBlur}
        onChange={onChange}
        className="pr-9"
      />
      <button
        type="button"
        tabIndex={-1}
        className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export default function ResetPasswordForm() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as {
    token?: string;
    returnTo?: string;
  };
  const token = search?.token;
  const returnTo = safeReturnTo(search.returnTo);

  const form = useForm({
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.resetPassword({
        newPassword: value.newPassword,
        token: token!,
      });
      if (error) {
        toast.error(
          error.message || "Impossible de réinitialiser le mot de passe.",
        );
      } else {
        toast.success("Mot de passe modifié.");
        navigate({ to: "/sign-in", search: { returnTo } });
      }
    },
    validators: {
      onSubmit: z
        .object({
          newPassword: z.string().min(8, "Utilise au moins 8 caractères."),
          confirmPassword: z.string(),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: "Les mots de passe ne correspondent pas.",
          path: ["confirmPassword"],
        }),
    },
  });

  if (!token) {
    return (
      <div className="mx-auto mt-10 w-full max-w-md p-6 text-center space-y-3">
        <h1 className="text-3xl font-bold">Lien invalide</h1>
        <p className="text-sm text-muted-foreground">
          Ce lien de réinitialisation est invalide ou a expiré.
        </p>
        <Link
          to="/forgot-password"
          search={{ returnTo }}
          className="inline-block text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-md p-6">
      <h1 className="mb-2 text-center text-3xl font-bold">
        Modifier le mot de passe
      </h1>
      <p className="mb-6 text-center text-sm text-muted-foreground">
        Enter your new password below.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field name="newPassword">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nouveau mot de passe</Label>
              <PasswordInput
                id="newPassword"
                placeholder="Nouveau mot de passe"
                autoComplete="new-password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta.errors.map((error) => (
                <p key={error?.message} className="text-sm text-destructive">
                  {error?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Field name="confirmPassword">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <PasswordInput
                id="confirmPassword"
                placeholder="Confirm new password"
                autoComplete="new-password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta.errors.map((error) => (
                <p key={error?.message} className="text-sm text-destructive">
                  {error?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Subscribe>
          {(state) => (
            <Button
              type="submit"
              className="w-full"
              disabled={!state.canSubmit || state.isSubmitting}
            >
              {state.isSubmitting ? "Saving..." : "Modifier le mot de passe"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <div className="mt-4 text-center">
        <Link
          to="/sign-in"
          search={{ returnTo }}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          Retour à la connexion
        </Link>
      </div>
    </div>
  );
}
