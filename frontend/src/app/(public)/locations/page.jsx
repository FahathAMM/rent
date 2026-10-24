"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { publicService } from "@/services/publicService";
import { MapPin, Loader2, Car } from "lucide-react";

export default function LocationsPage() {
  const { data: cities, isLoading } = useQuery({
    queryKey: ["public-locations"],
    queryFn: () => publicService.locations().then((r) => r.data.data),
  });

  return (
    <div>
      <section className="border-b bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Browse by Location</h1>
          <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
            Pick a city to see every vehicle currently available for rent there.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : cities?.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((c) => (
              <Link
                key={c.city}
                href={`/browse?city=${encodeURIComponent(c.city)}`}
                className="group flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{c.city}</p>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Car className="h-3.5 w-3.5" /> {c.vehicle_count} vehicle{c.vehicle_count === 1 ? "" : "s"} available
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed py-16 text-center text-sm text-muted-foreground">
            No locations with available vehicles yet.
          </p>
        )}
      </div>
    </div>
  );
}
