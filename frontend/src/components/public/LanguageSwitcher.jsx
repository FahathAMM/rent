"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Check, Languages, Loader2 } from "lucide-react";
import { LOCALES, LOCALE_COOKIE, LOCALE_LABELS, LOCALE_META } from "@/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Stores the choice for a year and re-renders the current page in the new
 * language. `selected` moves at once (so the switch animates on click) while
 * the page refreshes in the background.
 */
function useChangeLocale() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const locale = useLocale();
  const [pendingLocale, setPendingLocale] = useState(null);
  const [pending, startTransition] = useTransition();

  const selected = pending && pendingLocale ? pendingLocale : locale;

  const change = (next) => {
    if (next === selected) return;
    setPendingLocale(next);
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    // API data (categories, FAQ, hero slides…) is cached per language-less key — refetch it in the new language.
    queryClient.invalidateQueries();
    startTransition(() => router.refresh());
  };

  return { change, pending, selected };
}

/** Header: a pill-shaped EN | த switch with a gradient thumb that slides to the chosen language. */
export function LanguageSwitcher({ className }) {
  const t = useTranslations("language");
  const { change, pending, selected } = useChangeLocale();
  const index = Math.max(0, LOCALES.indexOf(selected));

  return (
    <div
      role="radiogroup"
      aria-label={t("change")}
      title={t("change")}
      className={cn(
        "relative grid h-10 shrink-0 items-center rounded-full border bg-card p-1 shadow-sm",
        className
      )}
      style={{ gridTemplateColumns: `repeat(${LOCALES.length}, minmax(0, 1fr))` }}
    >
      {/* sliding thumb */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-1 left-1 rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 shadow-md shadow-pink-500/25 transition-transform duration-300 ease-out",
          pending && "animate-pulse"
        )}
        style={{
          width: `calc((100% - 0.5rem) / ${LOCALES.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {LOCALES.map((code) => {
        const active = code === selected;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={LOCALE_LABELS[code]}
            lang={code}
            onClick={() => change(code)}
            className={cn(
              "relative z-10 flex h-full min-w-[2.5rem] items-center justify-center rounded-full px-2.5 text-xs font-semibold transition-colors duration-300",
              active ? "text-white" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active && pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : LOCALE_META[code].short}
          </button>
        );
      })}
    </div>
  );
}

/** Mobile menu: one card per language — sample letter, native name, English name, and a check on the chosen one. */
export function LanguageToggle({ className }) {
  const t = useTranslations("language");
  const { change, pending, selected } = useChangeLocale();

  return (
    <div className={className}>
      <p className="flex items-center gap-1.5 px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <Languages className="h-3.5 w-3.5" /> {t("label")}
      </p>
      <div role="radiogroup" aria-label={t("label")} className="grid grid-cols-2 gap-2">
        {LOCALES.map((code) => {
          const active = code === selected;
          const meta = LOCALE_META[code];
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={active}
              lang={code}
              onClick={() => change(code)}
              className={cn(
                "group relative flex items-center gap-2.5 overflow-hidden rounded-2xl border p-2.5 text-left transition-all duration-300",
                active
                  ? "border-transparent bg-gradient-to-br from-orange-500/10 via-pink-500/10 to-violet-500/10 shadow-sm ring-2 ring-pink-500/40"
                  : "bg-card hover:border-primary/30 hover:shadow-sm"
              )}
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold transition-all duration-300",
                  active
                    ? "bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white shadow-md shadow-pink-500/25"
                    : "bg-muted text-muted-foreground group-hover:text-foreground"
                )}
              >
                {meta.glyph}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm font-semibold", active && "text-primary")}>{LOCALE_LABELS[code]}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{meta.english}</span>
              </span>
              <span
                className={cn(
                  "absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white transition-all duration-300",
                  active ? "scale-100 opacity-100" : "scale-50 opacity-0"
                )}
                aria-hidden="true"
              >
                {active && pending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
