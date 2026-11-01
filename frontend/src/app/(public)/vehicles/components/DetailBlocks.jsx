import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

/* ── Small building blocks ────────────────────────────────────────────── */

export function QuickSpec({ icon: Icon, label, value, shortValue }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    // phones: one compact row (icon beside value); sm+: stacked, centred
    <div className="flex items-center gap-2 rounded-xl border bg-card px-2.5 py-2 shadow-sm sm:flex-col sm:gap-1 sm:rounded-2xl sm:px-3 sm:py-3 sm:text-center">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500/15 via-pink-500/15 to-violet-500/15 text-primary sm:size-9 sm:rounded-xl"><Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" /></span>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold capitalize leading-tight sm:text-sm">
          {shortValue ? <><span className="sm:hidden">{shortValue}</span><span className="hidden sm:inline">{value}</span></> : value}
        </p>
        <p className="text-[10px] leading-tight text-muted-foreground sm:text-[11px]">{label}</p>
      </div>
    </div>
  );
}

export function Section({ icon: Icon, title, children, className }) {
  return (
    <section className={cn("rounded-3xl border bg-card p-5 shadow-sm sm:p-6", className)}>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight">
        <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500/15 via-pink-500/15 to-violet-500/15 text-primary"><Icon className="h-4 w-4" /></span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4 shrink-0" />{label}</span>
      <span className="text-right text-sm font-medium">{children}</span>
    </div>
  );
}

export function Stars({ value, className = "h-4 w-4" }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn(className, i < Math.round(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/25")} />
      ))}
    </span>
  );
}
