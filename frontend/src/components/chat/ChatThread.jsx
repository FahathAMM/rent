"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Check, CheckCheck, Clock, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildThread, chatTime } from "@/lib/chat";
import { cn, getInitials } from "@/lib/utils";

/**
 * A scrolling conversation — day separators, left/right bubbles, sent/read
 * ticks on your own messages. Follows new messages while you're at the
 * bottom; if you've scrolled up to read, it offers a "New messages" jump
 * instead of yanking you down.
 *
 * mySenderType: the sender_type that is "me" ("customer" or "shop").
 * other: { name, avatarUrl } for the other side's bubbles.
 */
export function ChatThread({ messages, mySenderType, other, emptyText = "No messages yet.", className }) {
  const scrollRef = useRef(null);
  const atBottomRef = useRef(true);
  const lastCountRef = useRef(0);
  const [showJump, setShowJump] = useState(false);

  const thread = useMemo(() => buildThread(messages), [messages]);
  const lastMineId = useMemo(() => [...messages].reverse().find((m) => m.sender_type === mySenderType)?.id, [messages, mySenderType]);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    atBottomRef.current = true;
    setShowJump(false);
  }, []);

  useLayoutEffect(() => {
    const previous = lastCountRef.current;
    lastCountRef.current = messages.length;
    if (messages.length <= previous) return;

    const newest = messages[messages.length - 1];
    // First load, or I just sent something: always go to the bottom.
    if (previous === 0 || newest?.sender_type === mySenderType || atBottomRef.current) scrollToBottom(previous !== 0);
    else setShowJump(true);
  }, [messages, mySenderType, scrollToBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottomRef.current) setShowJump(false);
  };

  return (
    <div className={cn("relative min-h-0", className)}>
      <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto bg-muted/20 px-3 py-4 sm:px-5" aria-live="polite">
        {thread.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <MessageCircle className="h-6 w-6" />{emptyText}
          </div>
        ) : (
          <ol className="space-y-1">
            {thread.map((item) => item.type === "day" ? (
              <li key={item.key} className="flex justify-center py-3">
                <span className="rounded-full border bg-background px-3 py-0.5 text-[11px] font-medium text-muted-foreground">{item.label}</span>
              </li>
            ) : (
              <MessageBubble
                key={item.key}
                message={item.message}
                mine={item.message.sender_type === mySenderType}
                grouped={item.grouped}
                other={other}
                showSeen={item.message.id === lastMineId}
              />
            ))}
          </ol>
        )}
      </div>

      {showJump && (
        <Button size="sm" onClick={() => scrollToBottom(true)} className="absolute bottom-3 left-1/2 -translate-x-1/2 gap-1.5 rounded-full shadow-md">
          <ArrowDown className="h-3.5 w-3.5" />New messages
        </Button>
      )}
    </div>
  );
}

function MessageBubble({ message, mine, grouped, other, showSeen }) {
  const name = other?.name ?? "";

  return (
    <li className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start", grouped ? "pt-0.5" : "pt-3")}>
      {!mine && (
        <div className={cn("size-7 shrink-0 overflow-hidden rounded-full border bg-background", grouped && "invisible")} aria-hidden="true">
          {other?.avatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={other.avatarUrl} alt="" className="size-full object-cover" />
            : <span className="flex size-full items-center justify-center text-[10px] font-semibold text-muted-foreground">{getInitials(name)}</span>}
        </div>
      )}

      <div className={cn("flex max-w-[80%] flex-col sm:max-w-[70%]", mine ? "items-end" : "items-start")}>
        {!mine && !grouped && name && <span className="mb-0.5 ml-1 text-[11px] font-medium text-muted-foreground">{name}</span>}
        <div
          className={cn(
            "whitespace-pre-wrap break-words px-3.5 py-2 text-sm leading-relaxed shadow-sm",
            mine ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground" : "rounded-2xl rounded-bl-md border bg-background",
            message.pending && "opacity-70",
          )}
        >
          {message.body}
        </div>
        <span className="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
          {chatTime(message.created_at)}
          {mine && (message.pending
            ? <><Clock className="h-3 w-3" />Sending</>
            : message.read_at
              ? <><CheckCheck className="h-3 w-3 text-primary" />{showSeen && "Seen"}</>
              : <Check className="h-3 w-3" />)}
        </span>
      </div>
    </li>
  );
}
