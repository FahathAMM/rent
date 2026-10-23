"use client";

import { cn } from "@/lib/utils";

// Stacks to 1 column on phones and steps up to the requested count as the
// screen grows, instead of cramming e.g. 4 equal columns into a 375px
// screen — every existing caller passes a bare column count (2, 3, 4...)
// with no breakpoint awareness, so that has to live here.
const GRID_COLS = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5",
  6: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
};

export function Fieldset({ legend, grid = 2, className, children }) {
  // `grid` is normally a bare count (looked up above); pass a string
  // instead (e.g. "grid-cols-2 lg:grid-cols-3") when a specific fieldset
  // needs different breakpoint behavior than the shared default.
  const gridClass = typeof grid === "string" ? grid : GRID_COLS[grid] ?? GRID_COLS[2];

  return (
    <fieldset className={cn("space-y-1 rounded-lg border pb-4 px-4 my-3", className)}>
      {legend && (
        <legend className="px-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {legend}
        </legend>
      )}
      {grid ? (
        <div className={cn("grid gap-3", gridClass)}>{children}</div>
      ) : (
        children
      )}
    </fieldset>
  );
}
