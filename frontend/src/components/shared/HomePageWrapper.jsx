import { cn } from "@/lib/utils";
import DynamicBreadcrumb from "./DynamicBreadcrumb";

/**
 * Generic page-content shell — consistent max-width, spacing and bottom
 * padding for a page's main content, framed in a soft card so content
 * doesn't sit flush against the dashboard's bare background.
 */
export function HomePageWrapper({
  children,
  className,
  maxWidth = "max-w-7xl",
  breadcrumb,
}) {
  return (
    <div className={cn("w-full rounded-2xl from-muted/40 to-transparent px-1 sm:px-6", breadcrumb ? "sm:py-2" : "sm:py-0")}>
      {breadcrumb && <DynamicBreadcrumb items={breadcrumb} />}
      <div
        className={cn(
          "mx-auto w-full mt-3 space-y-5 rounded-xl border bg-card px-0 pb-10 shadow-sm",
          maxWidth,
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
