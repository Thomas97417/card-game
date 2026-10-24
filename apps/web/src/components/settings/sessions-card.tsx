import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Globe, Loader2, LogOut, Monitor, Smartphone, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "../ui/button";
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
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
} from "./settings-card";
import { settingsError } from "./settings-error";

function DeviceIcon({ userAgent }: { userAgent: string | null | undefined }) {
  if (!userAgent) return <Globe size={21} />;
  return /mobile|android|iphone/i.test(userAgent) ? (
    <Smartphone size={21} />
  ) : (
    <Monitor size={21} />
  );
}

function browserName(userAgent: string | null | undefined) {
  if (!userAgent) return "Navigateur inconnu";
  const ua = userAgent.toLowerCase();
  if (ua.includes("firefox")) return "Firefox";
  if (ua.includes("edg")) return "Edge";
  if (ua.includes("opera") || ua.includes("opr")) return "Opera";
  if (ua.includes("chrome")) return "Chrome";
  if (ua.includes("safari")) return "Safari";
  return "Navigateur inconnu";
}

export default function SessionsCard() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const {
    data: sessions,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data, error } = await authClient.listSessions();
      if (error)
        throw new Error("Impossible de charger les appareils connectés.");
      return data;
    },
  });
  const { data: currentSession } = useQuery({
    queryKey: ["current-session"],
    queryFn: async () => {
      const { data } = await authClient.getSession();
      return data;
    },
  });
  const currentSessionId = currentSession?.session?.id;
  const otherSessions = sessions?.filter(
    (session) => session.id !== currentSessionId,
  );
  const busy = revokingId !== null || revokingAll;

  async function revokeSession(sessionId: string, sessionToken: string) {
    if (busy) return;
    setRevokingId(sessionToken);
    try {
      const { error } = await authClient.revokeSession({ token: sessionToken });
      if (error) {
        toast.error(
          settingsError(
            error,
            "Cet appareil n’a pas pu être déconnecté. Réessaie.",
          ),
        );
      } else if (sessionId === currentSessionId) {
        await router.navigate({ to: "/" });
        location.reload();
      } else {
        toast.success("L’appareil a été déconnecté.");
        await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      }
    } catch {
      toast.error(
        "Cet appareil n’a pas pu être déconnecté. Vérifie ta connexion et réessaie.",
      );
    } finally {
      setRevokingId(null);
    }
  }

  async function revokeOtherSessions() {
    if (busy) return;
    setRevokingAll(true);
    try {
      const { error } = await authClient.revokeOtherSessions();
      if (error) {
        toast.error(
          settingsError(
            error,
            "Les autres appareils n’ont pas pu être déconnectés. Réessaie.",
          ),
        );
      } else {
        toast.success("Tous les autres appareils ont été déconnectés.");
        await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      }
    } catch {
      toast.error("La déconnexion a échoué. Vérifie ta connexion et réessaie.");
    } finally {
      setRevokingAll(false);
    }
  }

  return (
    <SettingsCard>
      <SettingsCardContent>
        <SettingsCardHeader
          icon={Monitor}
          title="Appareils connectés"
          description="Retrouve tes sessions ouvertes et ferme celles dont tu n’as plus besoin."
        />
        <div className="settings-sessions">
          {isLoading ? (
            <p className="settings-session-empty" role="status">
              Chargement des appareils…
            </p>
          ) : isError ? (
            <div className="settings-session-empty" role="alert">
              <p>Impossible de charger les appareils connectés.</p>
              <Button
                className="settings-secondary-button"
                onClick={() => void refetch()}
              >
                Réessayer
              </Button>
            </div>
          ) : sessions?.length ? (
            sessions.map((session) => {
              const isCurrent = session.id === currentSessionId;
              return (
                <div key={session.id} className="settings-session">
                  <span className="settings-device-icon" aria-hidden="true">
                    <DeviceIcon userAgent={session.userAgent} />
                  </span>
                  <div className="settings-session-details">
                    <div className="settings-session-name">
                      <strong>{browserName(session.userAgent)}</strong>
                      {isCurrent && (
                        <span className="settings-current-device">
                          Cet appareil
                        </span>
                      )}
                    </div>
                    <span className="settings-session-date">
                      Dernière activité :{" "}
                      {new Date(session.updatedAt).toLocaleString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {isCurrent ? (
                    <AlertDialog>
                      <AlertDialogTrigger
                        aria-label="Déconnecter cet appareil"
                        title="Déconnecter cet appareil"
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="settings-session-revoke"
                            disabled={busy}
                          />
                        }
                      >
                        {revokingId === session.token ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <X size={16} />
                        )}
                      </AlertDialogTrigger>
                      <AlertDialogContent className="settings-confirmation">
                        <AlertDialogHeader>
                          <AlertDialogMedia>
                            <LogOut size={21} />
                          </AlertDialogMedia>
                          <AlertDialogTitle>
                            Déconnecter cet appareil ?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Tu seras immédiatement déconnecté et redirigé vers
                            l’accueil.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            className="settings-destructive-button"
                            disabled={busy}
                            onClick={() =>
                              void revokeSession(session.id, session.token)
                            }
                          >
                            Se déconnecter
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="settings-session-revoke"
                      disabled={busy}
                      aria-label={`Déconnecter l’appareil ${browserName(session.userAgent)}`}
                      title="Déconnecter cet appareil"
                      onClick={() =>
                        void revokeSession(session.id, session.token)
                      }
                    >
                      {revokingId === session.token ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <X size={16} />
                      )}
                    </Button>
                  )}
                </div>
              );
            })
          ) : (
            <p className="settings-session-empty">Aucun appareil connecté.</p>
          )}
        </div>
      </SettingsCardContent>
      <SettingsCardFooter>
        <p>Ta session actuelle restera ouverte.</p>
        <Button
          className="settings-secondary-button"
          disabled={!currentSessionId || !otherSessions?.length || busy}
          onClick={() => void revokeOtherSessions()}
        >
          {revokingAll ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Déconnexion…
            </>
          ) : (
            "Déconnecter les autres appareils"
          )}
        </Button>
      </SettingsCardFooter>
    </SettingsCard>
  );
}
