import Link from "next/link";
import { Building2 } from "lucide-react";

/**
 * Real shop logos only, duplicated once for the seamless .animate-marquee
 * loop (see TrustMarquee / globals.css). Needs at least a handful of
 * shops to look continuous rather than choppy — callers should only
 * render this once `shops.length` clears a small floor.
 */
export function ShopLogoMarquee({ shops }) {
  const items = [...shops, ...shops];
  return (
    <div className="group overflow-hidden py-2">
      <div className="animate-marquee flex w-max items-center gap-8">
        {items.map((shop, i) => (
          <Link
            key={`${shop.id}-${i}`}
            href={`/shops/${shop.slug}`}
            className="flex shrink-0 items-center gap-2.5 rounded-2xl border bg-card px-5 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            {shop.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.logo} alt={shop.name} className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <span className="whitespace-nowrap text-sm font-medium">{shop.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
