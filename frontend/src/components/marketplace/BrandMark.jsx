import { cn } from "@/lib/utils";

/**
 * A brand's logo, or its initial on a neutral tile when no logo has been
 * uploaded yet. Size it with className (e.g. "size-8").
 */
export function BrandMark({ brand, className }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white",
        className
      )}
    >
      {brand?.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logo_url} alt={brand.name} className="h-full w-full object-contain p-1.5" />
      ) : (
        <span className="text-sm font-semibold text-slate-500">{brand?.name?.[0]?.toUpperCase() ?? "?"}</span>
      )}
    </span>
  );
}
