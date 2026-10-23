"use client";

import { cn } from "@/lib/utils";

// Color-coded so a non-technical user can tell sections apart at a glance,
// not just by reading the (often skipped) label text. Shared between the New
// Order wizard and the Order Detail page so the same category always reads
// the same color everywhere in the app.
export const SECTION_THEME = {
  basics: { box: "border-sky-200 bg-sky-50/60", icon: "bg-sky-100 text-sky-700" },
  pricing: { box: "border-emerald-200 bg-emerald-50/60", icon: "bg-emerald-100 text-emerald-700" },
  measure: { box: "border-indigo-200 bg-indigo-50/60", icon: "bg-indigo-100 text-indigo-700" },
  fabric: { box: "border-amber-200 bg-amber-50/60", icon: "bg-amber-100 text-amber-700" },
  style: { box: "border-purple-200 bg-purple-50/60", icon: "bg-purple-100 text-purple-700" },
  notes: { box: "border-orange-200 bg-orange-50/60", icon: "bg-orange-100 text-orange-700" },
  people: { box: "border-rose-200 bg-rose-50/60", icon: "bg-rose-100 text-rose-700" },
  money: { box: "border-teal-200 bg-teal-50/60", icon: "bg-teal-100 text-teal-700" },
  production: { box: "border-blue-200 bg-blue-50/60", icon: "bg-blue-100 text-blue-700" },
};

export function SectionBox({ theme, icon: Icon, title, subtitle, className, children }) {
  return (
    <div className={cn("h-full flex flex-col space-y-2.5 rounded-xl border-2 p-3", theme.box, className)}>
      <div className="flex items-center gap-2">
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", theme.icon)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground leading-tight mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
