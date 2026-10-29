import { useId, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import type { FunctionReturnType } from "convex/server";
import {
  Check,
  Crown,
  Flame,
  LoaderCircle,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import {
  GUILD_DESCRIPTION_MAX,
  GUILD_EMBLEMS,
  GUILD_MEMBER_LIMIT,
  GUILD_NAME_MAX,
  GUILD_NAME_MIN,
  guildEmblem,
} from "@sylve/game/guilds";
import { GuardianAvatar } from "@/components/guardian-avatar";
import { GameIcon } from "@/components/game/game-icon";
import { RankingPosition } from "@/components/game/ranking-position";
import { HubPanel } from "./hub-panel";
import "@/guilds.css";

type Guild = NonNullable<FunctionReturnType<typeof api.guilds.mine>>;
type GuildListing = FunctionReturnType<
  typeof api.guilds.leaderboard
>["guilds"][number];
type GuildFields = { name: string; description: string; emblemId: string };
const number = (value: number) => value.toLocaleString("fr-FR");
const searchable = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("fr-FR");

export function GuildsPanel({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const [view, setView] = useState<"all" | "mine">("all");
  const [editor, setEditor] = useState<"create" | "edit" | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const ranking = useQuery(convexQuery(api.guilds.leaderboard, {}));
  const own = useQuery({
    ...convexQuery(api.guilds.mine, {}),
    enabled: view === "mine",
  });
  const create = useMutation(api.guilds.create);
  const join = useMutation(api.guilds.join);
  const update = useMutation(api.guilds.update);
  const leave = useMutation(api.guilds.leave);
  const ownGuild = own.data;
  const ownRank = ranking.data?.guilds.find((guild) => guild.isOwn)?.rank;
  const guilds =
    ranking.data?.guilds.filter((guild) =>
      searchable(`${guild.name} ${guild.description}`).includes(
        searchable(search.trim()),
      ),
    ) ?? [];

  function switchView(next: "all" | "mine") {
    setView(next);
    setEditor(null);
    setConfirmLeave(false);
    setError(null);
    setNotice(null);
  }

  async function act(
    action: () => Promise<unknown>,
    success: string | null,
    after?: () => void,
  ) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      after?.();
    } catch (cause) {
      setError(
        cause instanceof ConvexError && typeof cause.data === "string"
          ? cause.data
          : "L’action a échoué. Réessaie dans un instant.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function startCreate() {
    switchView("mine");
    setEditor("create");
  }

  return (
    <HubPanel
      id={id}
      title="Guildes"
      description="Un emblème. Des alliés. Une légende à écrire."
      icon="guild"
      closeLabel="Fermer les guildes"
      onClose={onClose}
      className="hub-guilds"
    >
      <div className="guild-tabs" role="group" aria-label="Menus des guildes">
        <button
          type="button"
          aria-pressed={view === "all"}
          disabled={busy}
          onClick={() => switchView("all")}
        >
          <GameIcon kind="ranking" size={22} /> Toutes les guildes
        </button>
        <button
          type="button"
          aria-pressed={view === "mine"}
          disabled={busy}
          onClick={() => switchView("mine")}
        >
          <GameIcon kind="guild" size={22} /> Ma guilde
        </button>
      </div>
      {error && (
        <p className="guild-notice guild-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="guild-notice" role="status">
          {notice}
        </p>
      )}
      <div
        className="guild-scroll"
        aria-busy={view === "all" ? ranking.isPending : own.isPending}
      >
        {view === "all" ? (
          <>
            <div className="guild-intro">
              <h3>Les grandes alliances</h3>
              {!ranking.isPending &&
                !ranking.isError &&
                !ranking.data?.guildId && (
                  <button
                    type="button"
                    className="guild-button guild-button-gold"
                    disabled={busy}
                    onClick={startCreate}
                  >
                    <Plus size={15} /> Créer une guilde
                  </button>
                )}
            </div>
            <label className="guild-search">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                aria-label="Rechercher une guilde"
                placeholder="Rechercher une guilde…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="guild-ranking-caption">
              <span>{number(ranking.data?.guilds.length ?? 0)} guildes</span>
              <span>
                <Flame size={13} aria-hidden="true" /> Puissance cumulée des
                decks
              </span>
            </div>
            {ranking.isPending ? (
              <Loading />
            ) : ranking.isError ? (
              <QueryError retry={() => void ranking.refetch()} />
            ) : !guilds.length ? (
              <div className="guild-empty">
                <GameIcon kind="guild" size={82} />
                <h3>
                  {search.trim()
                    ? "Aucune guilde trouvée"
                    : "La première légende sera la tienne"}
                </h3>
                <p>
                  {search.trim()
                    ? "Essaie un autre nom ou efface la recherche."
                    : "Crée ta guilde, choisis son emblème et rassemble tes alliés."}
                </p>
                {!search.trim() && !ranking.data?.guildId && (
                  <button
                    type="button"
                    className="guild-button guild-button-gold"
                    onClick={startCreate}
                  >
                    <Plus size={16} /> Créer ma guilde
                  </button>
                )}
              </div>
            ) : (
              <ol
                className="guild-ranking"
                aria-label="Classement des guildes par puissance"
              >
                {guilds.map((guild) => (
                  <GuildRow
                    key={guild.id}
                    guild={guild}
                    hasGuild={!!ranking.data?.guildId}
                    busy={busy}
                    onOpen={() => switchView("mine")}
                    onJoin={() =>
                      void act(
                        () => join({ guildId: guild.id }),
                        `Bienvenue dans ${guild.name} !`,
                        () => {
                          setView("mine");
                          setEditor(null);
                        },
                      )
                    }
                  />
                ))}
              </ol>
            )}
            <p className="guild-footnote">
              Puissance de guilde = somme de la puissance des cartes équipées de
              chaque membre. Le classement évolue avec vos decks.
            </p>
          </>
        ) : own.isError ? (
          <QueryError retry={() => void own.refetch()} />
        ) : own.isPending ? (
          <Loading />
        ) : editor && (editor === "create" ? !ownGuild : ownGuild?.isLeader) ? (
          <GuildEditor
            key={editor === "edit" ? ownGuild?.id : "create"}
            guild={editor === "edit" ? ownGuild : null}
            busy={busy}
            onCancel={() => {
              setEditor(null);
              setError(null);
            }}
            onSave={(fields) =>
              void act(
                () =>
                  editor === "edit" && ownGuild
                    ? update({ guildId: ownGuild.id, ...fields })
                    : create(fields),
                editor === "edit"
                  ? "L’identité de ta guilde a été mise à jour."
                  : null,
                () => setEditor(null),
              )
            }
          />
        ) : ownGuild ? (
          <>
            <header className="guild-identity">
              <Emblem id={ownGuild.emblemId} size={96} />
              <div>
                <span className="guild-eyebrow">NOTRE BANNIÈRE</span>
                <h3>{ownGuild.name}</h3>
                <p>
                  {ownGuild.description ||
                    "Une alliance de gardiens prêts à écrire leur histoire."}
                </p>
              </div>
            </header>
            <dl className="guild-stats">
              <div>
                <dt>Puissance totale</dt>
                <dd>
                  <Flame size={17} aria-hidden="true" />{" "}
                  {number(ownGuild.power)}
                </dd>
              </div>
              <div>
                <dt>Membres</dt>
                <dd>
                  {ownGuild.members.length}
                  <small> / {GUILD_MEMBER_LIMIT}</small>
                </dd>
              </div>
              <div>
                <dt>Classement</dt>
                <dd>{ownRank ? `#${ownRank}` : "—"}</dd>
              </div>
            </dl>
            <div className="guild-members-heading">
              <h4>Les gardiens de la guilde</h4>
              <span>Puissance du deck</span>
            </div>
            <ul className="guild-members" aria-label="Membres de ma guilde">
              {ownGuild.members.map((member) => (
                <li
                  key={member.playerId}
                  data-self={member.isSelf || undefined}
                >
                  <span className="guild-member-avatar">
                    <GuardianAvatar heroId={member.profile.heroId} />
                  </span>
                  <div>
                    <strong>
                      {member.name}
                      {member.isSelf && <small>Toi</small>}
                    </strong>
                    <span>
                      {member.isLeader ? (
                        <>
                          <Crown size={12} aria-hidden="true" /> Chef de guilde
                        </>
                      ) : (
                        "Membre"
                      )}
                    </span>
                  </div>
                  <b>
                    <Flame size={13} aria-hidden="true" />
                    {number(member.power)}
                  </b>
                </li>
              ))}
            </ul>
            <div className="guild-management">
              {ownGuild.isLeader && (
                <button
                  type="button"
                  className="guild-button"
                  disabled={busy}
                  onClick={() => {
                    setEditor("edit");
                    setError(null);
                    setNotice(null);
                  }}
                >
                  <Pencil size={14} /> Personnaliser la guilde
                </button>
              )}
              <button
                type="button"
                className="guild-button guild-button-quiet"
                disabled={busy}
                onClick={() => setConfirmLeave(true)}
              >
                <LogOut size={14} /> Quitter la guilde
              </button>
            </div>
            {confirmLeave && (
              <div className="guild-leave-confirm" role="alert">
                <p>
                  {ownGuild.members.length === 1
                    ? "Tu es le dernier membre : quitter dissoudra la guilde."
                    : ownGuild.isLeader
                      ? "Le membre le plus ancien reprendra la direction de la guilde."
                      : "Tu pourras ensuite rejoindre ou créer une autre guilde."}
                </p>
                <div>
                  <button
                    type="button"
                    className="guild-button"
                    disabled={busy}
                    onClick={() => setConfirmLeave(false)}
                  >
                    Rester
                  </button>
                  <button
                    type="button"
                    className="guild-button guild-button-danger"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        () => leave({ guildId: ownGuild.id }),
                        "Tu as quitté la guilde.",
                        () => {
                          setConfirmLeave(false);
                          setEditor(null);
                        },
                      )
                    }
                  >
                    {busy ? "Départ…" : "Confirmer le départ"}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="guild-empty guild-empty-mine">
            <GameIcon kind="guild" size={108} />
            <span className="guild-eyebrow">L’AVENTURE SE VIT ENSEMBLE</span>
            <h3>Ta place est parmi les gardiens</h3>
            <p>
              Rejoins une alliance ou fonde la tienne. Unis vos decks, affichez
              vos couleurs et grimpez au classement.
            </p>
            <button
              type="button"
              className="guild-button guild-button-gold"
              onClick={() => setEditor("create")}
            >
              <Plus size={16} /> Créer ma guilde
            </button>
            <button
              type="button"
              className="guild-button guild-button-quiet"
              onClick={() => switchView("all")}
            >
              Explorer les guildes
            </button>
            <small>
              Création gratuite · Jusqu’à {GUILD_MEMBER_LIMIT} membres
            </small>
          </div>
        )}
      </div>
    </HubPanel>
  );
}

function GuildRow({
  guild,
  hasGuild,
  busy,
  onJoin,
  onOpen,
}: {
  guild: GuildListing;
  hasGuild: boolean;
  busy: boolean;
  onJoin: () => void;
  onOpen: () => void;
}) {
  const full = guild.memberCount >= GUILD_MEMBER_LIMIT;
  return (
    <li
      className="guild-row"
      data-own={guild.isOwn || undefined}
      data-podium={guild.rank <= 3 || undefined}
    >
      {guild.isOwn ? (
        <button
          type="button"
          className="guild-row-open"
          aria-label={`Ouvrir la guilde ${guild.name}`}
          disabled={busy}
          onClick={onOpen}
        >
          <GuildRowContent guild={guild} />
        </button>
      ) : (
        <>
          <GuildRowContent guild={guild} />
          {!hasGuild && (
            <button
              type="button"
              className="guild-button guild-row-action"
              aria-label={`Rejoindre ${guild.name}`}
              disabled={busy || full}
              onClick={onJoin}
            >
              {full ? "Complète" : "Rejoindre"}
            </button>
          )}
        </>
      )}
    </li>
  );
}

function GuildRowContent({ guild }: { guild: GuildListing }) {
  return (
    <>
      <span className="guild-position" aria-label={`Rang ${guild.rank}`}>
        <RankingPosition rank={guild.rank} />
      </span>
      <Emblem id={guild.emblemId} size={52} />
      <span className="guild-row-name">
        <strong>{guild.name}</strong>
        {guild.description && (
          <span className="guild-row-description">{guild.description}</span>
        )}
        <span className="guild-row-meta">
          <Users size={11} aria-hidden="true" /> {guild.memberCount}/
          {GUILD_MEMBER_LIMIT} membres
          {guild.isOwn && <b>Ta guilde</b>}
        </span>
      </span>
      <span className="guild-row-power">
        <Flame size={14} aria-hidden="true" />
        <strong>{number(guild.power)}</strong>
        <small>puissance</small>
      </span>
    </>
  );
}

function Emblem({ id, size }: { id: string; size: number }) {
  return (
    <img
      className="guild-emblem"
      src={guildEmblem(id).image}
      width={size}
      height={size}
      alt=""
      draggable={false}
    />
  );
}

function GuildEditor({
  guild,
  busy,
  onCancel,
  onSave,
}: {
  guild?: Guild | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (fields: GuildFields) => void;
}) {
  const [name, setName] = useState(guild?.name ?? "");
  const [description, setDescription] = useState(guild?.description ?? "");
  const [emblemId, setEmblemId] = useState(
    guild?.emblemId ?? GUILD_EMBLEMS[0].id,
  );
  const nameId = useId();
  const descriptionId = useId();
  const selected = guildEmblem(emblemId);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!busy && name.trim().length >= GUILD_NAME_MIN)
      onSave({ name, description, emblemId });
  }
  return (
    <form className="guild-editor" onSubmit={submit}>
      <div className="guild-editor-heading">
        <span className="guild-eyebrow">
          {guild ? "VOTRE IDENTITÉ" : "FONDE TA PROPRE ALLIANCE"}
        </span>
        <h3>{guild ? "Personnaliser la guilde" : "Crée ta guilde"}</h3>
        <p>Un nom qui rassemble. Un emblème qui vous ressemble.</p>
      </div>
      <fieldset disabled={busy}>
        <div className="guild-editor-preview">
          <Emblem id={emblemId} size={88} />
          <div>
            <strong>{name.trim() || "Le début d’une légende"}</strong>
            <span>{selected.name}</span>
          </div>
          <span className="guild-preview-label">Aperçu</span>
        </div>
        <label className="guild-field" htmlFor={nameId}>
          <span>
            Nom de la guilde{" "}
            <small>
              {name.length}/{GUILD_NAME_MAX}
            </small>
          </span>
          <input
            id={nameId}
            required
            minLength={GUILD_NAME_MIN}
            maxLength={GUILD_NAME_MAX}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex. Les Veilleurs de l’Aube"
            autoComplete="off"
          />
        </label>
        <label className="guild-field" htmlFor={descriptionId}>
          <span>
            Devise ou description{" "}
            <small>
              Facultatif · {description.length}/{GUILD_DESCRIPTION_MAX}
            </small>
          </span>
          <textarea
            id={descriptionId}
            maxLength={GUILD_DESCRIPTION_MAX}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ce qui vous unit, ce qui vous anime…"
            rows={2}
          />
        </label>
        <fieldset className="guild-emblem-picker">
          <legend>Choisis ton emblème</legend>
          {[true, false].map((isNew) => (
            <div key={String(isNew)} className="guild-emblem-collection">
              <h4>
                {isNew ? "Nouveaux emblèmes" : "La collection du refuge"}
                {isNew && <span>4 inédits</span>}
              </h4>
              <div className="guild-emblem-grid">
                {GUILD_EMBLEMS.filter((emblem) => emblem.isNew === isNew).map(
                  (emblem) => (
                    <button
                      key={emblem.id}
                      type="button"
                      aria-label={emblem.name}
                      aria-pressed={emblemId === emblem.id}
                      title={emblem.name}
                      onClick={() => setEmblemId(emblem.id)}
                    >
                      <Emblem id={emblem.id} size={52} />
                      {emblemId === emblem.id && (
                        <Check size={13} aria-hidden="true" />
                      )}
                    </button>
                  ),
                )}
              </div>
            </div>
          ))}
        </fieldset>
        <div className="guild-editor-footer">
          <p>
            {guild
              ? "Les changements sont visibles par tous les membres."
              : `Création gratuite · ${GUILD_MEMBER_LIMIT} membres maximum`}
          </p>
          <div>
            <button type="button" className="guild-button" onClick={onCancel}>
              Annuler
            </button>
            <button
              type="submit"
              className="guild-button guild-button-gold"
              disabled={name.trim().length < GUILD_NAME_MIN}
            >
              {busy && <LoaderCircle size={14} className="animate-spin" />}
              {busy
                ? "Enregistrement…"
                : guild
                  ? "Enregistrer"
                  : "Créer ma guilde"}
            </button>
          </div>
        </div>
      </fieldset>
    </form>
  );
}

function Loading() {
  return (
    <div className="guild-empty" role="status">
      <LoaderCircle size={24} className="animate-spin" />
      <p>Les bannières se rassemblent…</p>
    </div>
  );
}

function QueryError({ retry }: { retry: () => void }) {
  return (
    <div className="guild-empty" role="alert">
      <p>Les guildes n’ont pas pu être chargées.</p>
      <button type="button" className="guild-button" onClick={retry}>
        <RefreshCw size={14} /> Réessayer
      </button>
    </div>
  );
}
