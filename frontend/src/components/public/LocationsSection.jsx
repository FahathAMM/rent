"use client";

import { useState } from "react";
import Link from "next/link";
import { LocationsMap } from "@/components/public/LocationsMap";
import { SectionHeader } from "@/components/public/SectionHeader";
import { cn } from "@/lib/utils";
import { MapPin, Layers, CarFront, TrendingUp, ArrowRight } from "lucide-react";

/**
 * Every Sri Lankan district (from /public/districts), each with the vehicles
 * its shops list (summed from /public/locations' per-city counts). Districts
 * nobody rents in yet are still listed — greyed, at the bottom.
 */
export function LocationsSection({
  cities,
  districts,
  eyebrow = "Island-wide",
  title = "Popular locations",
  subtitle = "Every district in Sri Lanka — pick up close to where your trip starts.",
  href: viewAllHref = "/locations",
  linkLabel = "All locations",
  listClassName = "max-h-[340px]",
}) {
  const [active, setActive] = useState(null);

  const byDistrict = new Map();
  (districts ?? []).forEach((d) => byDistrict.set(d.name, { district: d.name, vehicle_count: 0, cities: [] }));
  (cities ?? []).forEach((c) => {
    const name = c.district || c.city;
    if (!byDistrict.has(name)) byDistrict.set(name, { district: name, vehicle_count: 0, cities: [] });
    const row = byDistrict.get(name);
    row.vehicle_count += c.vehicle_count;
    row.cities.push(c.city);
  });
  const sorted = [...byDistrict.values()].sort((a, b) => b.vehicle_count - a.vehicle_count || a.district.localeCompare(b.district));

  const [top, ...rest] = sorted;
  const max = top?.vehicle_count || 1;
  const totalVehicles = sorted.reduce((sum, d) => sum + d.vehicle_count, 0);
  const activeCount = sorted.filter((d) => d.vehicle_count > 0).length;
  const href = (d) => `/browse?district=${encodeURIComponent(d.district)}`;
  const hover = (d) => ({ onMouseEnter: () => setActive(d.district), onMouseLeave: () => setActive(null), onFocus: () => setActive(d.district), onBlur: () => setActive(null) });
  // LocationsMap pins by `city` (falling back to `district`) — one pin per district's main town here.
  const mapPoints = sorted.map((d) => ({ city: d.district, district: d.district, vehicle_count: d.vehicle_count }));

  return (
    <section className="relative isolate overflow-hidden bg-muted/30 py-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-50">
        <div className="aurora-blob aurora-blob-3" />
      </div>
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} href={viewAllHref} linkLabel={linkLabel}>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {[
              { icon: MapPin, label: `${sorted.length} districts` },
              { icon: Layers, label: `${activeCount} with vehicles` },
              { icon: CarFront, label: `${totalVehicles} vehicles` },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium shadow-sm">
                <Icon className="h-3.5 w-3.5 text-primary" /> {label}
              </span>
            ))}
          </div>
        </SectionHeader>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
          {/* Ranked list */}
          <div className="flex min-h-0 flex-col gap-3">
            {top && top.vehicle_count > 0 && (
              <Link
                href={href(top)}
                {...hover(top)}
                className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-600 p-6 text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-2xl"
              >
                <div className="absolute inset-0 opacity-[0.08] [background-image:repeating-linear-gradient(135deg,#fff_0_1px,transparent_1px_14px)]" aria-hidden="true" />
                <MapPin className="absolute -bottom-6 -right-4 h-36 w-36 text-white/15 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6" aria-hidden="true" />
                <span className="relative inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-sm">
                  <TrendingUp className="h-3 w-3" /> #1 most vehicles
                </span>
                <p className="relative mt-3 text-3xl font-semibold tracking-tight">{top.district}</p>
                <p className="relative text-sm text-white/80">{top.cities.length ? top.cities.join(" · ") : "District"}</p>
                <div className="relative mt-5 flex items-end justify-between gap-3">
                  <p><span className="text-4xl font-bold">{top.vehicle_count}</span> <span className="text-sm text-white/80">vehicles ready</span></p>
                  <span className="flex items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-foreground shadow-md transition-transform group-hover:translate-x-0.5">
                    Explore <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            )}

            {rest.length > 0 && (
              <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
                <ul className={cn("thin-scrollbar overflow-y-auto", listClassName)}>
                  {rest.map((d, i) => {
                    const empty = d.vehicle_count === 0;
                    return (
                      <li key={d.district} className="border-b last:border-0">
                        <Link
                          href={href(d)}
                          {...hover(d)}
                          className={cn(
                            "group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/60",
                            active === d.district && "bg-muted/60",
                            empty && "opacity-60 hover:opacity-100"
                          )}
                        >
                          <span className="w-7 shrink-0 text-sm font-bold text-muted-foreground/60">{empty ? "—" : `#${i + 2}`}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="truncate font-medium group-hover:text-primary">{d.district}</p>
                              <p className="shrink-0 text-xs text-muted-foreground">
                                {empty ? "Coming soon" : <><span className="font-semibold text-foreground">{d.vehicle_count}</span> vehicles</>}
                              </p>
                            </div>
                            {!empty && (
                              <div className="mt-1.5 flex items-center gap-3">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                  <div className="h-full rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500" style={{ width: `${Math.max(6, (d.vehicle_count / max) * 100)}%` }} />
                                </div>
                                {d.cities.length > 0 && <span className="max-w-[45%] shrink-0 truncate text-[11px] text-muted-foreground">{d.cities.join(", ")}</span>}
                              </div>
                            )}
                          </div>
                          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Map */}
          <div className="relative min-h-[360px] overflow-hidden rounded-3xl border bg-card shadow-sm lg:min-h-[520px]">
            <LocationsMap cities={mapPoints} activeCity={active} hrefFor={(p) => `/browse?district=${encodeURIComponent(p.district)}`} className="absolute inset-0" />
            <div className="pointer-events-none absolute left-3 top-3 z-[500] flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1 text-xs font-medium shadow-sm backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-gradient-to-br from-orange-500 to-violet-500" /> Vehicles per district — tap a pin to browse
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
