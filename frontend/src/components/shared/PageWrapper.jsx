import { cn } from "@/lib/utils";
import DynamicBreadcrumb from "./DynamicBreadcrumb";

/**
 * Generic page-content shell — consistent max-width, spacing and bottom
 * padding for a page's main content, framed in a soft card so content
 * doesn't sit flush against the dashboard's bare background. Was
 * referenced (commented out) in ServerDataTable but never actually built;
 * this is that component.
 */
export function PageWrapper({ children, className, maxWidth = "max-w-7xl", childMaxWidth, breadcrumb }) {
  return (
    <div className="w-full rounded-2xl from-muted/40 to-transparent px-1 sm:px-6 sm:py-2">
            <DynamicBreadcrumb items={breadcrumb} />
      
      <div
        className={cn(
          "mx-auto w-full mt-3 rounded-xl border bg-card p-5 pb-10 shadow-sm sm:p-6",
          maxWidth,
          className
        )}
      >
        <div className={cn("mx-auto w-full space-y-5 rounded-xl shadow-sm", childMaxWidth)}>
          {children}
        </div>
      </div>
    </div>
  );
}
