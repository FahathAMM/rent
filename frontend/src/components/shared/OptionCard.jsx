"use client";

import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A big, tappable card for a single choice out of a small set (customer mode,
 * order type, fabric source, ...). Built for touch use and non-technical
 * users: large hit area, icon + short description, obvious selected state.
 */
export function OptionCard({ icon: Icon, title, description, selected, onClick, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "relative flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors",
        "hover:border-primary/50",
        selected ? "border-primary bg-primary/5" : "border-border bg-background",
        className
      )}
    >
      {Icon && (
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
            selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className={cn("block text-sm font-semibold", selected && "text-primary")}>{title}</span>
        {description && <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>}
      </span>
      {selected && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
    </button>
  );
}
