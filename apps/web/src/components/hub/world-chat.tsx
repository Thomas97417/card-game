import { useEffect, useId, useRef, useState } from "react";
import { useConvexConnectionState, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import {
  ArrowDown,
  ArrowLeft,
  Globe,
  LoaderCircle,
  Send,
  Users,
} from "lucide-react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { WORLD_CHAT_MESSAGE_LIMIT } from "@my-better-t-app/backend/convex/lib/chat";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageGroup,
  MessageHeader,
} from "@/components/ui/message";
import { GameIcon } from "@/components/game/game-icon";
import { HubPanel } from "./hub-panel";
import { PlayerMenu, type SocialPlayer } from "./player-menu";
import { FriendConversations } from "./friends-panel";
import { useSocialDay } from "./use-social-day";

type ChatMessage = Omit<
  FunctionReturnType<typeof api.worldChat.list>[number],
  "id"
> & { id: string };

function groupMessages(messages: ChatMessage[]) {
  const groups: ChatMessage[][] = [];
  for (const message of messages) {
    const group = groups.at(-1);
    const previous = group?.at(-1);
    if (
      group &&
      previous &&
      message.continuesPrevious &&
      new Date(previous.sentAt).toDateString() ===
        new Date(message.sentAt).toDateString()
    ) {
      group.push(message);
    } else {
      groups.push([message]);
    }
  }
  return groups;
}

export function WorldChat({
  id,
  titleId,
  open,
  onClose,
  conversation,
  onConversationChange,
}: {
  id: string;
  titleId: string;
  open: boolean;
  onClose: () => void;
  conversation: SocialPlayer | null;
  onConversationChange: (player: SocialPlayer | null) => void;
}) {
  const [mode, setMode] = useState<"world" | "friends">("world");
  const refreshDay = useSocialDay();
  const friends = useQuery(
    api.social.list,
    open && mode === "friends" ? { refreshDay } : "skip",
  );
  const privateMessages = useQuery(
    api.friendChat.list,
    open && mode === "friends" && conversation
      ? { playerId: conversation.playerId }
      : "skip",
  );
  const worldMessages = useQuery(
    api.worldChat.list,
    open && mode === "world" ? {} : "skip",
  );
  const messages: ChatMessage[] | undefined =
    mode === "world" ? worldMessages : privateMessages;
  const send = useMutation(api.worldChat.send);
  const sendPrivate = useMutation(api.friendChat.send);
  const { isWebSocketConnected } = useConvexConnectionState();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draftKey =
    mode === "world" ? "world" : `friend:${conversation?.playerId ?? ""}`;
  const currentDraftKey = useRef(draftKey);
  currentDraftKey.current = draftKey;
  const draft = drafts[draftKey] ?? "";
  const setDraft = (value: string) =>
    setDrafts((current) => ({ ...current, [draftKey]: value }));
  const showInbox = mode === "friends" && !conversation;
  const friendAvailable =
    mode === "world" ||
    !!friends?.friends.some(
      (friend) => friend.playerId === conversation?.playerId,
    );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unseen, setUnseen] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const viewportSize = useRef({ width: 0, height: 0 });
  const input = useRef<HTMLTextAreaElement>(null);
  const following = useRef(true);
  const pending = useRef(false);
  const inputId = useId();
  const hintId = useId();
  const tabsId = useId();

  useEffect(() => {
    if (conversation) setMode("friends");
  }, [conversation]);
  useEffect(() => {
    if (
      mode === "friends" &&
      conversation &&
      friends &&
      !friends.friends.some(
        (friend) => friend.playerId === conversation.playerId,
      )
    )
      onConversationChange(null);
  }, [mode, conversation, friends, onConversationChange]);

  useEffect(() => {
    following.current = true;
    setUnseen(false);
    setError(null);
  }, [draftKey]);

  function openConversation(player: SocialPlayer) {
    onConversationChange(player);
    setMode("friends");
  }

  useEffect(() => {
    if (open) {
      following.current = true;
      setUnseen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !messages?.length) return;
    if (following.current && viewport.current) {
      viewport.current.scrollTop = viewport.current.scrollHeight;
    } else {
      setUnseen(true);
    }
  }, [messages, open, draftKey]);

  useEffect(() => {
    const node = viewport.current;
    if (!open || !node) return;
    viewportSize.current = {
      width: node.clientWidth,
      height: node.clientHeight,
    };
    const observer = new ResizeObserver(() => {
      viewportSize.current = {
        width: node.clientWidth,
        height: node.clientHeight,
      };
      if (following.current) node.scrollTop = node.scrollHeight;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [open, draftKey, showInbox]);

  const canSend =
    isWebSocketConnected &&
    messages !== undefined &&
    friendAvailable &&
    !showInbox &&
    !!draft.trim() &&
    draft.trim().length <= WORLD_CHAT_MESSAGE_LIMIT &&
    !sending;

  async function sendMessage() {
    if (!canSend || pending.current) return;
    pending.current = true;
    following.current = true;
    setSending(true);
    setError(null);
    try {
      if (mode === "friends" && conversation)
        await sendPrivate({
          playerId: conversation.playerId,
          body: draft.trim(),
        });
      else await send({ body: draft.trim() });
      setDraft("");
    } catch (cause) {
      if (currentDraftKey.current === draftKey)
        setError(
          cause instanceof ConvexError && typeof cause.data === "string"
            ? cause.data
            : "Ton message n’a pas pu être envoyé. Réessaie.",
        );
    } finally {
      pending.current = false;
      setSending(false);
      // Wait until React has re-enabled the textarea.
      requestAnimationFrame(() =>
        currentDraftKey.current === draftKey
          ? input.current?.focus({ preventScroll: true })
          : undefined,
      );
    }
  }

  if (!open) return null;
  const messageGroups = groupMessages(messages ?? []);

  return (
    <HubPanel
      id={id}
      titleId={titleId}
      className="hub-world-chat"
      title={mode === "world" ? "Chat mondial" : "Chat entre amis"}
      description={
        mode === "world"
          ? "Le rendez-vous des gardiens"
          : "Des conversations rien qu’à vous"
      }
      icon="chat"
      closeLabel={
        mode === "world"
          ? "Fermer le chat mondial"
          : "Fermer le chat entre amis"
      }
      onClose={onClose}
      initialFocus="panel"
    >
      <div
        className="social-chat-tabs"
        role="tablist"
        aria-label="Canaux de discussion"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const next =
            event.key === "Home"
              ? "world"
              : event.key === "End"
                ? "friends"
                : mode === "world"
                  ? "friends"
                  : "world";
          setMode(next);
          document.getElementById(`${tabsId}-${next}`)?.focus();
        }}
      >
        <button
          type="button"
          role="tab"
          id={`${tabsId}-world`}
          aria-controls={`${tabsId}-content`}
          aria-selected={mode === "world"}
          tabIndex={mode === "world" ? 0 : -1}
          onClick={() => setMode("world")}
        >
          <Globe size={15} /> Mondial
        </button>
        <button
          type="button"
          role="tab"
          id={`${tabsId}-friends`}
          aria-controls={`${tabsId}-content`}
          aria-selected={mode === "friends"}
          tabIndex={mode === "friends" ? 0 : -1}
          onClick={() => setMode("friends")}
        >
          <Users size={15} /> Amis
        </button>
      </div>
      <div
        id={`${tabsId}-content`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-${mode}`}
        className="social-chat-content"
      >
        {showInbox ? (
          <FriendConversations data={friends} onSelect={openConversation} />
        ) : (
          <>
            {mode === "friends" && conversation && (
              <div className="social-conversation-heading">
                <button
                  type="button"
                  className="social-icon-button"
                  aria-label="Toutes les conversations"
                  onClick={() => onConversationChange(null)}
                >
                  <ArrowLeft size={17} />
                </button>
                <PlayerMenu {...conversation} onMessage={openConversation} />
                <span>
                  <strong>{conversation.name}</strong>
                  <small>Conversation privée</small>
                </span>
              </div>
            )}
            <div
              ref={viewport}
              className="hub-world-chat-messages"
              role="log"
              aria-label={
                mode === "world"
                  ? "Messages du chat mondial"
                  : `Messages avec ${conversation?.name ?? "ton ami"}`
              }
              aria-live="polite"
              aria-relevant="additions"
              aria-busy={messages === undefined}
              tabIndex={0}
              onScroll={() => {
                const node = viewport.current;
                if (!node) return;
                // A resize can dispatch a scroll before ResizeObserver follows the end.
                if (
                  node.clientWidth !== viewportSize.current.width ||
                  node.clientHeight !== viewportSize.current.height
                )
                  return;
                following.current =
                  node.scrollHeight - node.scrollTop - node.clientHeight < 48;
                if (following.current) setUnseen(false);
              }}
            >
              {messages === undefined ? (
                <div className="hub-world-chat-empty" role="status">
                  <LoaderCircle
                    size={26}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  <p>Les messages arrivent…</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="hub-world-chat-empty">
                  <GameIcon kind="chat" size={64} />
                  <strong>La conversation commence ici</strong>
                  <p>
                    {mode === "world"
                      ? "Salue les gardiens et partage tes aventures dans la Sylve."
                      : `Envoie ton premier message à ${conversation?.name}.`}
                  </p>
                </div>
              ) : (
                messageGroups.map((group, index) => (
                  <ChatMessageGroup
                    key={group[0]!.id}
                    messages={group}
                    onMessage={openConversation}
                    showDate={
                      index === 0 ||
                      new Date(
                        messageGroups[index - 1]![0]!.sentAt,
                      ).toDateString() !==
                        new Date(group[0]!.sentAt).toDateString()
                    }
                  />
                ))
              )}
            </div>

            {unseen && (
              <button
                type="button"
                className="hub-world-chat-latest"
                onClick={() => {
                  if (viewport.current)
                    viewport.current.scrollTop = viewport.current.scrollHeight;
                  following.current = true;
                  setUnseen(false);
                }}
              >
                <ArrowDown size={13} aria-hidden="true" /> Nouveaux messages
              </button>
            )}

            <form
              className="hub-world-chat-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage();
              }}
            >
              {!isWebSocketConnected && (
                <p className="hub-world-chat-notice" role="status">
                  Connexion interrompue. Ton brouillon est conservé.
                </p>
              )}
              {error && (
                <p className="hub-world-chat-error" role="alert">
                  {error}
                </p>
              )}
              <label htmlFor={inputId} className="sr-only">
                Ton message
              </label>
              <div className="hub-world-chat-input-row">
                <textarea
                  ref={input}
                  id={inputId}
                  value={draft}
                  rows={2}
                  maxLength={WORLD_CHAT_MESSAGE_LIMIT}
                  disabled={sending}
                  aria-describedby={hintId}
                  placeholder={
                    mode === "world"
                      ? "Écris aux gardiens…"
                      : `Écris à ${conversation?.name}…`
                  }
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setError(null);
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  aria-label={sending ? "Envoi en cours" : "Envoyer le message"}
                >
                  {sending ? (
                    <LoaderCircle
                      size={18}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Send size={18} aria-hidden="true" />
                  )}
                </button>
              </div>
              <div className="hub-world-chat-hint" id={hintId}>
                <span>
                  Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne
                </span>
                <span>
                  {draft.length}/{WORLD_CHAT_MESSAGE_LIMIT}
                </span>
              </div>
            </form>
          </>
        )}
      </div>
    </HubPanel>
  );
}

function ChatMessageGroup({
  messages,
  showDate,
  onMessage,
}: {
  messages: ChatMessage[];
  showDate: boolean;
  onMessage: (player: SocialPlayer) => void;
}) {
  const first = messages[0]!;

  return (
    <>
      {showDate && (
        <div className="hub-world-chat-date">
          {new Date(first.sentAt).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
          })}
        </div>
      )}
      <MessageGroup
        className="hub-world-chat-group"
        role="group"
        aria-label={
          first.isOwn ? "Tes messages" : `Messages de ${first.senderName}`
        }
      >
        {messages.map((message, index) => (
          <ChatRow
            key={message.id}
            message={message}
            first={index === 0}
            last={index === messages.length - 1}
            onMessage={onMessage}
          />
        ))}
      </MessageGroup>
    </>
  );
}

function ChatRow({
  message,
  first,
  last,
  onMessage,
}: {
  message: ChatMessage;
  first: boolean;
  last: boolean;
  onMessage: (player: SocialPlayer) => void;
}) {
  const date = new Date(message.sentAt);
  const initials = Array.from(message.senderName)
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase("fr-FR");
  const time = (
    <time
      className={first ? undefined : "sr-only"}
      dateTime={date.toISOString()}
      title={date.toLocaleString("fr-FR")}
    >
      {date.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })}
    </time>
  );

  return (
    <Message
      align={message.isOwn ? "end" : "start"}
      className="hub-world-chat-message"
      data-group-end={last}
    >
      {last && message.playerId ? (
        <PlayerMenu
          playerId={message.playerId}
          name={message.senderName}
          className="hub-world-chat-avatar"
          onMessage={onMessage}
        >
          {initials}
        </PlayerMenu>
      ) : (
        <MessageAvatar className="hub-world-chat-avatar" aria-hidden="true">
          {last ? initials : null}
        </MessageAvatar>
      )}
      <MessageContent className="hub-world-chat-content">
        {first ? (
          <MessageHeader className="hub-world-chat-meta">
            <span>{message.isOwn ? "Toi" : message.senderName}</span>
            {time}
          </MessageHeader>
        ) : (
          time
        )}
        <p
          className="hub-world-chat-bubble"
          title={date.toLocaleString("fr-FR")}
        >
          {message.body}
        </p>
      </MessageContent>
    </Message>
  );
}
