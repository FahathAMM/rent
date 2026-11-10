"use client";

import { useLayoutEffect, useRef } from "react";
import { Loader2, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The message box under a chat: grows with the text (to ~6 lines), Enter
 * sends and Shift+Enter adds a line, optional one-tap quick replies while
 * the box is empty, and a countdown near the length limit.
 */
export function ChatComposer({
  value, onChange, onSend, pending = false, placeholder, label = "Message",
  quickReplies = [], maxLength = 5000, id = "chat-message",
}) {
  const inputRef = useRef(null);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const send = () => {
    if (value.trim() && !pending) onSend(value.trim());
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const pick = (text) => {
    onChange(text);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(text.length, text.length);
    });
  };

  const charsLeft = maxLength - value.length;

  return (
    <div className="border-t bg-card p-3 sm:p-4">
      {!value && quickReplies.length > 0 && (
        <div className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1">
          {quickReplies.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => pick(q)}
              className="shrink-0 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label htmlFor={id} className="sr-only">{label}</label>
        <textarea
          id={id}
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={maxLength}
          rows={1}
          placeholder={placeholder}
          className="max-h-40 min-h-[42px] flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm leading-relaxed placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/30"
        />
        <Button type="submit" size="icon" className="h-[42px] w-[42px] shrink-0 rounded-xl" disabled={!value.trim() || pending} aria-label="Send">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
        </Button>
      </form>

      <div className="mt-1.5 flex justify-between gap-3 text-[11px] text-muted-foreground">
        <span className="hidden sm:inline">Enter to send · Shift + Enter for a new line</span>
        {charsLeft < 500 && <span className={cn("ml-auto", charsLeft < 100 && "text-destructive")}>{charsLeft} characters left</span>}
      </div>
    </div>
  );
}
