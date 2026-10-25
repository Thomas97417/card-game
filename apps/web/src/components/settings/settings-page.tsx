import { useEffect, useState } from "react";
import { Tabs } from "@base-ui/react/tabs";
import {
  ChevronRight,
  Monitor,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { GameHeader } from "@/components/game-header";
import ChangePasswordCard from "./change-password-card";
import DeleteAccountCard from "./delete-account-card";
import SessionsCard from "./sessions-card";
import UpdateEmailCard from "./update-email-card";
import UpdateNameCard from "./update-name-card";

const SECTIONS = [
  {
    id: "profile",
    label: "Profil",
    description: "Ton identité dans la Sylve",
    icon: UserRound,
  },
  {
    id: "security",
    label: "Sécurité",
    description: "Mot de passe et compte",
    icon: ShieldCheck,
  },
  {
    id: "devices",
    label: "Appareils",
    description: "Tes sessions connectées",
    icon: Monitor,
  },
] as const;

export function SettingsPage({
  user,
}: {
  user: { name: string; email: string } | null | undefined;
}) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return (
    <main className="settings-page" aria-label="Paramètres du compte">
      <img
        className="settings-background"
        src="/art/guardian-house.webp"
        alt=""
        fetchPriority="high"
        draggable={false}
      />
      <div className="settings-shade" aria-hidden="true" />
      <GameHeader />
      <div className="settings-scroll">
        <Tabs.Root
          className="settings-layout"
          defaultValue="profile"
          orientation={mobile ? "horizontal" : "vertical"}
        >
          <aside className="settings-sidebar">
            <p className="settings-building">Les archives</p>
            <h1>Paramètres</h1>
            <Tabs.List
              className="settings-nav"
              aria-label="Rubriques des paramètres"
              activateOnFocus
            >
              {SECTIONS.map(({ id, label, description, icon: Icon }) => (
                <Tabs.Tab key={id} value={id} className="settings-nav-button">
                  <Icon size={20} aria-hidden="true" />
                  <span>
                    {label}
                    <small>{description}</small>
                  </span>
                  <ChevronRight
                    size={15}
                    className="settings-nav-chevron"
                    aria-hidden="true"
                  />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </aside>
          <div className="settings-panels" aria-busy={!user}>
            {user ? (
              <>
                <Tabs.Panel
                  value="profile"
                  className="settings-panel"
                  keepMounted
                >
                  <UpdateNameCard name={user.name} />
                  <UpdateEmailCard email={user.email} />
                </Tabs.Panel>
                <Tabs.Panel
                  value="security"
                  className="settings-panel"
                  keepMounted
                >
                  <ChangePasswordCard />
                  <DeleteAccountCard />
                </Tabs.Panel>
                <Tabs.Panel
                  value="devices"
                  className="settings-panel"
                  keepMounted
                >
                  <SessionsCard />
                </Tabs.Panel>
              </>
            ) : (
              <div className="settings-loading" role="status">
                Chargement de ton profil…
              </div>
            )}
          </div>
        </Tabs.Root>
      </div>
    </main>
  );
}
