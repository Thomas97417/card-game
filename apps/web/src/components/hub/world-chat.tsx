import { useEffect, useId, useRef, useState } from "react";
import { useConvexConnectionState, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import {
  ArrowDown,
  Globe2,
  LoaderCircle,
  MessageCircle,
  Send,
  X,
} from "lucide-react";
import { api } from "@my-better-t-app/backend/convex/_generated/api";
import { WORLD_CHAT_MESSAGE_LIMIT } from "@my-better-t-app/backend/convex/lib/chat";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from "@/components/ui/message";

type ChatMessage = FunctionReturnType<typeof api.worldChat.list>[number];

export function WorldChat({
  id,
  titleId,
  open,
  onClose,
}: {
  id: string;
  titleId: string;
  open: boolean;
  onClose: () => void;
}) {
  const messages = useQuery(api.worldChat.list, open ? {} : "skip");
  const send = useMutation(api.worldChat.send);
  const { isWebSocketConnected } = useConvexConnectionState();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unseen, setUnseen] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const viewportSize = useRef({ width: 0, height: 0 });
  const input = useRef<HTMLTextAreaElement>(null);
  const following = useRef(true);
  const pending = useRef(false);
  const inputId = useId();
  const hintId = useId();

  useEffect(() => {
    if (open) {
      following.current = true;
      setUnseen(false);
      panel.current?.focus({ preventScroll: true });
    }
  }, [open]);

  useEffect(() => {
    if (!open || !messages?.length) return;
    if (following.current && viewport.current) {
      viewport.current.scrollTop = viewport.current.scrollHeight;
    } else {
      setUnseen(true);
    }
  }, [messages, open]);

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
  }, [open]);

  const canSend =
    isWebSocketConnected &&
    messages !== undefined &&
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
      await send({ body: draft.trim() });
      setDraft("");
    } catch (cause) {
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
        input.current?.focus({ preventScroll: true }),
      );
    }
  }

  if (!open) return null;

  return (
    <section
      ref={panel}
      id={id}
      className="hub-world-chat"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="hub-world-chat-heading">
        <div>
          <h2 id={titleId}>
            <Globe2 size={17} aria-hidden="true" /> Chat mondial
          </h2>
          <p>Le rendez-vous des gardiens</p>
        </div>
        <span
          className="hub-world-chat-status"
          role="status"
          data-connected={isWebSocketConnected}
        >
          <span aria-hidden="true" />
          {isWebSocketConnected ? "En direct" : "Reconnexion…"}
        </span>
        <button
          type="button"
          className="hub-world-chat-close"
          onClick={onClose}
          aria-label="Fermer le chat mondial"
        >
          <X size={17} aria-hidden="true" />
        </button>
      </div>

      <div
        ref={viewport}
        className="hub-world-chat-messages"
        role="log"
        aria-label="Messages du chat mondial"
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
            <MessageCircle size={32} strokeWidth={1.25} aria-hidden="true" />
            <strong>La conversation commence ici</strong>
            <p>Salue les gardiens et partage tes aventures dans la Sylve.</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <ChatRow
              key={message.id}
              message={message}
              showDate={
                index === 0 ||
                new Date(messages[index - 1]!.sentAt).toDateString() !==
                  new Date(message.sentAt).toDateString()
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
            placeholder="Écris aux gardiens…"
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
    </section>
  );
}

function ChatRow({
  message,
  showDate,
}: {
  message: ChatMessage;
  showDate: boolean;
}) {
  const date = new Date(message.sentAt);
  const initials = Array.from(message.senderName)
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase("fr-FR");

  return (
    <>
      {showDate && (
        <div className="hub-world-chat-date">
          {date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
        </div>
      )}
      <Message
        align={message.isOwn ? "end" : "start"}
        className="hub-world-chat-message"
      >
        <MessageAvatar className="hub-world-chat-avatar" aria-hidden="true">
          {initials}
        </MessageAvatar>
        <MessageContent className="hub-world-chat-content">
          <MessageHeader className="hub-world-chat-meta">
            <span>{message.isOwn ? "Toi" : message.senderName}</span>
            <time
              dateTime={date.toISOString()}
              title={date.toLocaleString("fr-FR")}
            >
              {date.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </MessageHeader>
          <p className="hub-world-chat-bubble">{message.body}</p>
        </MessageContent>
      </Message>
    </>
  );
}
