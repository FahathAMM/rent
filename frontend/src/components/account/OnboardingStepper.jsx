"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** A 3-step progress indicator shared by the owner/shop onboarding forms — purely visual, driven by whatever step index the page works out from its own status. */
export function OnboardingStepper({ steps, currentIndex }) {
  return (
    <div className="flex items-center">
      {steps.map((label, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  done
                    ? "bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white"
                    : active
                      ? "border-2 border-primary bg-background text-primary"
                      : "border bg-muted text-muted-foreground"
                )}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={cn("whitespace-nowrap text-xs font-medium", active ? "text-foreground" : "text-muted-foreground")}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("mx-2 h-0.5 flex-1 rounded-full", done ? "bg-gradient-to-r from-orange-500 to-violet-500" : "bg-muted")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
