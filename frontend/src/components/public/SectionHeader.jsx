import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Eyebrow + title + subtitle (+ optional "View all" link and extra controls) used by
 * the public marketing sections. The end of the title gets the brand gradient: the
 * last word, or `highlight` when the phrase is longer.
 */
export function SectionHeader({ eyebrow, title, highlight, subtitle, href, linkLabel = "View all", center, children }) {
  const accent = highlight ?? String(title).split(" ").pop();
  const lead = String(title).slice(0, String(title).length - accent.length);

  return (
    <div className={cn("mb-7 flex flex-wrap items-end justify-between gap-4", center && "flex-col items-center text-center")}>
      <div className={cn(center && "mx-auto max-w-xl")}>
        {eyebrow && (
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> {eyebrow}
          </span>
        )}
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {lead}
          <span className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">{accent}</span>
        </h2>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="group flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-sm font-medium shadow-sm transition-all hover:border-primary/40 hover:text-primary hover:shadow-md">
          {linkLabel} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
      {children}
    </div>
  );
}
