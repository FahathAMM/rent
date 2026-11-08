"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/public/SectionHeader";
import { BrandMark } from "@/components/marketplace/BrandMark";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

const BRAND_GRADIENTS = [
  "from-orange-500 to-pink-500",
  "from-violet-500 to-indigo-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-red-600",
  "from-amber-500 to-orange-600",
];

const BRANDS_PREVIEW = 6;

/**
 * Brands with vehicles first (most first). The preview always fills
 * BRANDS_PREVIEW tiles: if fewer brands have vehicles, it's topped up with
 * active brands that don't yet (logo'd ones first), shown as "Coming soon"
 * and not clickable. "Show all" only ever expands the brands with vehicles.
 */
export function BrandsSection({ brands }) {
  const [showAll, setShowAll] = useState(false);
  const byName = (a, b) => a.name.localeCompare(b.name);
  const withVehicles = brands.filter((b) => b.vehicles_count > 0).sort((a, b) => b.vehicles_count - a.vehicles_count || byName(a, b));
  const fillers = brands
    .filter((b) => !b.vehicles_count)
    .sort((a, b) => Number(!!b.logo_url) - Number(!!a.logo_url) || (a.sort_order ?? 0) - (b.sort_order ?? 0) || byName(a, b));
  const max = withVehicles[0]?.vehicles_count || 1;
  const total = withVehicles.reduce((sum, b) => sum + b.vehicles_count, 0);
  const visible = showAll ? withVehicles : [...withVehicles, ...fillers].slice(0, BRANDS_PREVIEW);
  const sorted = withVehicles;

  return (
    <section className="relative isolate overflow-hidden py-6 sm:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-violet-500/[0.04] to-transparent" />
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeader
          eyebrow="Choose your make"
          title="Browse by brand"
          subtitle={`${total} vehicles from ${sorted.length} ${sorted.length === 1 ? "brand" : "brands"} — pick the make you love.`}
          href="/rent"
          linkLabel="See all rentals"
        />

        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
          {visible.map((b, i) => {
            const soon = !b.vehicles_count;
            const share = soon ? 0 : Math.max(8, Math.round((b.vehicles_count / max) * 100));
            const gradient = BRAND_GRADIENTS[b.id % BRAND_GRADIENTS.length];
            // "Coming soon" tiles aren't links — browsing them would show nothing.
            const Tile = soon ? "div" : Link;
            return (
              <Tile
                key={b.id}
                {...(soon ? {} : { href: `/rent?brand_id=${b.id}` })}
                className={cn(
                  "group relative flex flex-col items-center overflow-hidden rounded-xl border bg-card p-2.5 pt-5 text-center shadow-sm ring-primary/30 transition-all duration-300 sm:rounded-2xl sm:p-5 sm:pt-6",
                  soon ? "opacity-75" : "hover:-translate-y-1 hover:border-transparent hover:shadow-xl hover:ring-2"
                )}
              >
                {/* soft glow behind the mark */}
                <span aria-hidden="true" className={cn("absolute left-1/2 top-4 size-20 -translate-x-1/2 rounded-full bg-gradient-to-br opacity-15 blur-2xl transition-opacity group-hover:opacity-30", gradient)} />

                {i === 0 && !showAll && sorted.length > 1 && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-1.5 py-0.5 text-[8px] sm:left-2 sm:top-2 sm:px-2 sm:text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
                    Most popular
                  </span>
                )}

                {b.logo_url ? (
                  <BrandMark brand={b} className="relative size-12 rounded-xl shadow-md transition-transform duration-300 group-hover:scale-110 sm:size-16 sm:rounded-2xl" />
                ) : (
                  <span className={cn("relative flex size-12 items-center justify-center rounded-xl bg-gradient-to-br text-xl font-bold sm:size-16 sm:rounded-2xl sm:text-2xl text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3", gradient)}>
                    {b.name?.[0]?.toUpperCase()}
                    <span aria-hidden="true" className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/10 to-white/20" />
                  </span>
                )}

                <span className="relative mt-2 w-full truncate text-xs font-semibold sm:mt-3.5 sm:text-base">{b.name}</span>
                {soon ? (
                  <span className="relative mt-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] sm:px-2.5 sm:text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                    Coming soon
                  </span>
                ) : (
                  <span className="relative mt-1 rounded-full bg-muted px-2 py-0.5 text-[10px] sm:px-2.5 sm:text-[11px] font-medium text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    {b.vehicles_count} {b.vehicles_count === 1 ? "vehicle" : "vehicles"}
                  </span>
                )}

                {/* share of the catalogue, relative to the biggest brand */}
                <span className="relative mt-3 h-1 w-full overflow-hidden rounded-full bg-muted sm:mt-4" title={soon ? undefined : `${Math.round((b.vehicles_count / (total || 1)) * 100)}% of listings`}>
                  <span className={cn("block h-full rounded-full bg-gradient-to-r transition-all duration-700", gradient)} style={{ width: `${share}%` }} />
                </span>

                <span className={cn("relative mt-3 hidden items-center gap-1 text-xs font-medium text-primary opacity-0 sm:flex transition-all duration-300", !soon && "group-hover:opacity-100")}>
                  View vehicles <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Tile>
            );
          })}
        </div>

        {sorted.length > BRANDS_PREVIEW && (
          <div className="mt-6 flex justify-center sm:mt-8">
            <Button variant="outline" onClick={() => setShowAll((s) => !s)} className="gap-1.5 rounded-full px-6">
              {showAll ? "Show fewer brands" : `Show all ${sorted.length} brands`}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
