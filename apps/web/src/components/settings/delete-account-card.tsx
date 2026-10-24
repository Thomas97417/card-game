import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

import { Button } from "@/components/ui/button";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { settingsError } from "./settings-error";

import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
} from "./settings-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";

export default function DeleteAccountCard() {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await authClient.deleteUser({
        fetchOptions: {
          onSuccess: () => {
            navigate({ to: "/" });
            location.reload();
          },
          onError: (error) => {
            toast.error(
              settingsError(
                error.error,
                "Ton compte n’a pas pu être supprimé. Réessaie.",
              ),
            );
          },
        },
      });
    } catch {
      toast.error(
        "Ton compte n’a pas pu être supprimé. Vérifie ta connexion et réessaie.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsCard className="settings-card-danger">
      <SettingsCardContent>
        <SettingsCardHeader
          icon={TriangleAlert}
          title="Supprimer mon compte"
          description="Supprime définitivement ton compte Sylve et l’accès à ta progression."
        />
      </SettingsCardContent>
      <SettingsCardFooter>
        <p className="text-sm text-muted-foreground">
          Cette action est irréversible.
        </p>
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                size="sm"
                variant="destructive"
                className="settings-destructive-button"
                disabled={deleting}
              />
            }
          >
            Supprimer mon compte
          </AlertDialogTrigger>
          <AlertDialogContent className="settings-confirmation">
            <AlertDialogHeader>
              <AlertDialogMedia>
                <TriangleAlert className="size-5" />
              </AlertDialogMedia>
              <AlertDialogTitle>Supprimer ton compte ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est définitive. Tu perdras l’accès à ton compte et
                à ta progression.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                className="settings-destructive-button"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? "Suppression…" : "Supprimer définitivement"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SettingsCardFooter>
    </SettingsCard>
  );
}
