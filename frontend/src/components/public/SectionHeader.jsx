import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Eyebrow + title + subtitle (+ optional "View all" link and extra controls) used by the public marketing sections. */
export function SectionHeader({ eyebrow, title, subtitle, href, linkLabel = "View all", center, children }) {
  return (
    <div className={cn("mb-7 flex flex-wrap items-end justify-between gap-3", center && "flex-col items-center text-center")}>
      <div className={cn(center && "mx-auto max-w-xl")}>
        {eyebrow && (
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
        )}
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="group flex items-center gap-1 text-sm font-medium text-primary">
          {linkLabel} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
      {children}
    </div>
  );
}
