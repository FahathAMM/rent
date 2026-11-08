"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LayoutGrid, List as ListIcon, MapPin, Search as SearchIcon, SlidersHorizontal, X } from "lucide-react";

/* The Buy page's filter sidebar, layout toggle and pagination. */

export const TRANSMISSION_OPTIONS = [
  { value: "", label: "Any" },
  { value: "automatic", label: "Automatic" },
  { value: "manual", label: "Manual" },
];

export const FUEL_OPTIONS = [
  { value: "", label: "Any" },
  { value: "petrol", label: "Petrol" },
  { value: "diesel", label: "Diesel" },
  { value: "hybrid", label: "Hybrid" },
  { value: "electric", label: "Electric" },
];

export const SEATS_OPTIONS = [
  { value: "", label: "Any" },
  { value: "2", label: "2+" },
  { value: "4", label: "4+" },
  { value: "7", label: "7+" },
  { value: "12", label: "12+" },
];

export function Pill({ active, children, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 text-white shadow-sm"
          : "border-input bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function FilterSection({ icon: Icon, title, children }) {
  return (
    <div className="space-y-2.5 border-b pb-5 last:border-0 last:pb-0">
      <p className="flex items-center gap-1.5 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" />{title}</p>
      {children}
    </div>
  );
}

/** Page numbers to show: always first/last, a window around the current page, "…" for gaps. */
function pageItems(current, last) {
  const pages = new Set([1, last, current - 1, current, current + 1].filter((p) => p >= 1 && p <= last));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ["…", p] : [p]));
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.last_page <= 1) return null;
  const { current_page: current, last_page: last, per_page: perPage, total } = meta;
  const from = (current - 1) * perPage + 1;
  const to = Math.min(current * perPage, total);

  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-1.5">
        <Button variant="outline" size="sm" className="bg-card" disabled={current <= 1} onClick={() => onPage(current - 1)}>Previous</Button>
        {pageItems(current, last).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1.5 text-sm text-muted-foreground">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              aria-current={p === current ? "page" : undefined}
              className={cn(
                "flex h-9 min-w-9 items-center justify-center rounded-lg border px-2.5 text-sm font-medium transition-colors",
                p === current
                  ? "border-transparent bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 text-white shadow-sm"
                  : "border-input bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {p}
            </button>
          )
        )}
        <Button variant="outline" size="sm" className="bg-card" disabled={current >= last} onClick={() => onPage(current + 1)}>Next</Button>
      </nav>
      <p className="text-xs text-muted-foreground">Showing {from}–{to} of {total} vehicles</p>
    </div>
  );
}

const PILL_LIMIT = 10;

/**
 * A pill list for long option sets: a search box, the first PILL_LIMIT
 * options, and "Show more". The selected option always stays visible even
 * when it's past the limit.
 */
export function SearchablePills({ items, selected, onSelect, allLabel, searchPlaceholder, renderLabel = (i) => i.label }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const matches = query.trim()
    ? items.filter((i) => i.label.toLowerCase().includes(query.trim().toLowerCase()))
    : items;
  const searching = !!query.trim();
  let visible = searching || expanded ? matches : matches.slice(0, PILL_LIMIT);
  const selectedItem = items.find((i) => i.value === selected);
  if (selectedItem && !visible.includes(selectedItem) && !searching) visible = [...visible, selectedItem];
  const hidden = matches.length - PILL_LIMIT;

  return (
    <div className="space-y-2">
      {items.length > PILL_LIMIT && (
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} className="h-8 bg-card pl-8 text-xs" />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {!searching && <Pill active={!selected} onClick={() => onSelect("")}>{allLabel}</Pill>}
        {visible.map((i) => (
          <Pill key={i.value} active={selected === i.value} onClick={() => onSelect(i.value)}>{renderLabel(i)}</Pill>
        ))}
        {searching && matches.length === 0 && <p className="py-1 text-xs text-muted-foreground">No matches for “{query.trim()}”</p>}
      </div>
      {!searching && hidden > 0 && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="text-xs font-medium text-primary hover:underline">
          {expanded ? "Show less" : `Show more (${hidden})`}
        </button>
      )}
    </div>
  );
}

/** District, then that district's cities. `vehicleCounts` is keyed "District|City". */
export function LocationFilter({ params, setParam, setDistrict, districts, vehicleCounts }) {
  const selectedDistrict = params.get("district") ?? "";
  // Every city of the chosen district (from the full Sri Lanka list), not just ones with listings.
  const districtCities = districts?.find((d) => d.name === selectedDistrict)?.cities ?? [];
  const countFor = (city) => vehicleCounts?.[`${selectedDistrict}|${city}`] ?? 0;
  // District totals = sum of its cities' counts (keys are "District|City").
  const districtCount = (district) => Object.entries(vehicleCounts ?? {})
    .reduce((sum, [key, n]) => (key.startsWith(`${district}|`) ? sum + n : sum), 0);
  const withCount = (label, n) => <>{label}{n > 0 && <span className="opacity-70"> ({n})</span>}</>;

  return (
    <FilterSection icon={MapPin} title="Location">
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">District</p>
          <SearchablePills
            items={(districts ?? []).map((d) => ({ value: d.name, label: d.name }))}
            selected={selectedDistrict}
            onSelect={setDistrict}
            allLabel="All districts"
            searchPlaceholder="Search districts..."
            renderLabel={(i) => withCount(i.label, districtCount(i.value))}
          />
        </div>
        {selectedDistrict && (
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">City</p>
            {/* keyed by district so the search/expanded state resets when the district changes */}
            <SearchablePills
              key={selectedDistrict}
              // cities with vehicles first, so the first 10 shown are the useful ones
              items={districtCities
                .map((c) => ({ value: c.name, label: c.name }))
                .sort((a, b) => countFor(b.label) - countFor(a.label) || a.label.localeCompare(b.label))}
              selected={params.get("city") ?? ""}
              onSelect={(v) => setParam("city", v)}
              allLabel="All cities"
              searchPlaceholder={`Search cities in ${selectedDistrict}...`}
              renderLabel={(i) => withCount(i.label, countFor(i.label))}
            />
          </div>
        )}
      </div>
    </FilterSection>
  );
}

/** Grid or list. Same height as the sort box beside it. */
export function ViewToggle({ view, setView }) {
  return (
    <div className="flex h-9 items-center gap-0.5 rounded-lg border bg-card p-0.5" role="group" aria-label="Layout">
      {[["grid", LayoutGrid, "Grid view"], ["list", ListIcon, "List view"]].map(([v, Icon, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => setView(v)}
          aria-label={label}
          aria-pressed={view === v}
          title={label}
          className={cn(
            "flex aspect-square h-full items-center justify-center rounded-md transition-colors",
            view === v ? "bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

/** Phones: a floating Filters button that opens the filters in a side panel. */
export function MobileFilters({ open, setOpen, activeCount, total, children }) {
  return (
    <>
      {!open && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:hidden">
          <Button
            onClick={() => setOpen(true)}
            className="pointer-events-auto h-12 gap-2 rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 px-6 text-sm font-semibold shadow-xl shadow-pink-500/25 hover:opacity-90"
          >
            <SlidersHorizontal className="h-4 w-4" /> Filters
            {activeCount > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-pink-600">{activeCount}</span>
            )}
          </Button>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <p className="font-semibold">Filters</p>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1.5 hover:bg-muted" aria-label="Close filters">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
            <div className="border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button className="w-full bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90" onClick={() => setOpen(false)}>
                Show {total ?? ""} results
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
