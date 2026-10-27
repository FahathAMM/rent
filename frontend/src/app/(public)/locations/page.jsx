"use client";

import { useQuery } from "@tanstack/react-query";
import { publicService } from "@/services/publicService";
import { LocationsSection } from "@/components/public/LocationsSection";
import { Loader2, MapPin } from "lucide-react";

/** All districts + the map — the same LocationsSection as the home page, given the whole page. */
export default function LocationsPage() {
  const { data: cities, isLoading: citiesLoading } = useQuery({
    queryKey: ["public-locations"],
    queryFn: () => publicService.locations().then((r) => r.data.data),
  });

  const { data: districts, isLoading: districtsLoading } = useQuery({
    queryKey: ["public-districts"],
    queryFn: () => publicService.districts().then((r) => r.data.data),
    staleTime: Infinity,
  });

  const isLoading = citiesLoading || districtsLoading;

  return (
    <div>
      <section className="relative isolate overflow-hidden border-b">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-70">
          <div className="aurora-blob aurora-blob-1" />
          <div className="aurora-blob aurora-blob-3" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-12 text-center sm:py-14">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            <MapPin className="h-3.5 w-3.5 text-primary" /> All 25 districts of Sri Lanka
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Browse by{" "}
            <span className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">location</span>
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
            Pick a district to see every vehicle currently available for rent there.
          </p>
        </div>
      </section>

      {isLoading ? (
        <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <LocationsSection
          cities={cities}
          districts={districts}
          eyebrow="Districts"
          title="Where you can rent"
          subtitle="Ranked by vehicles available. Districts without vehicles yet are listed at the bottom."
          href={null}
          listClassName="max-h-[560px]"
        />
      )}
    </div>
  );
}
