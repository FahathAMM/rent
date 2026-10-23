"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Horizontal step indicator. `current` and `maxReached` are step indexes;
 * a step is clickable once the user has reached it at least once. Each step
 * entry may include an optional `icon` (Lucide component) shown in the
 * circle instead of the step number.
 */
export function Stepper({ steps, current, maxReached = current, onStepClick, className }) {
  return (
    <div className={cn("flex items-center", className)}>
      {steps.map((step, i) => {
        const isDone = i < current;
        const isCurrent = i === current;
        const isClickable = i <= maxReached && onStepClick;
        const Icon = step.icon;

        return (
          <div key={step.key} className={cn("flex items-center", i < steps.length - 1 && "flex-1")}>
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick(i)}
              className={cn(
                "flex items-center gap-2 shrink-0",
                isClickable ? "cursor-pointer" : "cursor-default"
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center h-9 w-9 rounded-full border-2 text-xs font-semibold shrink-0 transition-colors",
                  isDone && "bg-primary border-primary text-primary-foreground",
                  isCurrent && "border-primary text-primary bg-primary/10",
                  !isDone && !isCurrent && "border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : Icon ? <Icon className="h-4 w-4" /> : i + 1}
              </span>
              <span className={cn("text-sm hidden md:inline", isCurrent ? "font-semibold text-foreground" : "text-muted-foreground")}>
                {step.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className={cn("flex-1 h-0.5 mx-2 rounded-full", isDone ? "bg-primary" : "bg-muted-foreground/20")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
