"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { BadgeDollarSign, CarFront, Loader2, MapPin } from "lucide-react";
import { BuyLocations } from "./components/BuyLocations";
import { RentLocations } from "./components/RentLocations";

const VIEWS = [
  { id: "rent", label: "Rent", icon: CarFront, intro: "Pick a district to see every vehicle currently available for rent there." },
  { id: "buy", label: "Buy", icon: BadgeDollarSign, intro: "Pick a district to see every vehicle currently for sale there." },
];

/** All districts + the map, for renting or buying. ?type=buy opens the Buy side, so a view can be shared. */
export default function LocationsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <LocationsPageContent />
    </Suspense>
  );
}

function LocationsPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const view = VIEWS.find((v) => v.id === params.get("type")) ?? VIEWS[0];

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
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">{view.intro}</p>

          <div className="mt-5 inline-flex gap-1 rounded-full border bg-card p-1 shadow-sm" role="group" aria-label="Rent or buy">
            {VIEWS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => router.replace(id === "rent" ? "/locations" : `/locations?type=${id}`, { scroll: false })}
                aria-pressed={view.id === id}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition-colors",
                  view.id === id ? "bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {view.id === "buy" ? <BuyLocations /> : <RentLocations />}
    </div>
  );
}
