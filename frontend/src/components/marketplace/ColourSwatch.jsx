import { cn } from "@/lib/utils";

/** A round colour dot; a dashed outline when the colour has no hex (e.g. "Other"). */
export function ColourSwatch({ hex, className }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block shrink-0 rounded-full border",
        hex ? "border-black/15" : "border-dashed border-muted-foreground/50",
        className
      )}
      style={hex ? { backgroundColor: hex } : undefined}
    />
  );
}
