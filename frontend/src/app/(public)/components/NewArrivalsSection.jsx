"use client";

import { useRef } from "react";
import { SectionHeader } from "@/components/public/SectionHeader";
import { VehicleCard } from "@/app/(public)/rent/components/VehicleCard";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

/** The newest vehicles, in a sideways rail. */
export function NewArrivalsSection({ newest }) {
  const newestRailRef = useRef(null);

  return (
    <section className="border-y bg-gradient-to-b from-emerald-500/5 to-transparent py-6 sm:py-10">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeader eyebrow="Just listed" title="New arrivals" subtitle="The latest rental vehicles added by shops.">
          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={() => newestRailRef.current?.scrollBy({ left: -280, behavior: "smooth" })}
              className="flex size-9 items-center justify-center rounded-full border bg-card shadow-sm transition-colors hover:bg-muted"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => newestRailRef.current?.scrollBy({ left: 280, behavior: "smooth" })}
              className="flex size-9 items-center justify-center rounded-full border bg-card shadow-sm transition-colors hover:bg-muted"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </SectionHeader>
        <div ref={newestRailRef} className="flex snap-x snap-mandatory gap-4 overflow-x-auto no-scrollbar py-2">
          {newest.map((v) => (
            <div key={v.id} className="relative w-44 shrink-0 snap-start sm:w-64">
              <span className="absolute right-1.5 top-1.5 z-10 flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-semibold text-white shadow-sm sm:right-2 sm:top-2 sm:px-2.5 sm:text-[10px]">
                <Sparkles className="h-3 w-3" /> New
              </span>
              <VehicleCard vehicle={v} className="border-emerald-500/40 hover:border-emerald-500" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
