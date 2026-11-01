"use client";

import { Suspense, useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { publicService } from "@/services/publicService";
import { VehicleCard } from "./components/VehicleCard";
import { VehicleListItem } from "./components/VehicleListItem";
import { ColourSwatch } from "@/components/marketplace/ColourSwatch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Search as SearchIcon, Loader2, CarFront, SlidersHorizontal, X,
  MapPin, Tag, Gauge, Fuel, Users, Truck, Wallet, Sparkles, BadgeCheck, Layers, Palette, LayoutGrid, List as ListIcon,
} from "lucide-react";

const TRANSMISSION_OPTIONS = [
  { value: "", label: "Any" },
  { value: "automatic", label: "Automatic" },
  { value: "manual", label: "Manual" },
];

const FUEL_OPTIONS = [
  { value: "", label: "Any" },
  { value: "petrol", label: "Petrol" },
  { value: "diesel", label: "Diesel" },
  { value: "hybrid", label: "Hybrid" },
  { value: "electric", label: "Electric" },
];

const SEATS_OPTIONS = [
  { value: "", label: "Any" },
  { value: "2", label: "2+" },
  { value: "4", label: "4+" },
  { value: "7", label: "7+" },
  { value: "12", label: "12+" },
];

function Pill({ active, children, ...props }) {
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

function FilterSection({ icon: Icon, title, children }) {
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

function Pagination({ meta, onPage }) {
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
function SearchablePills({ items, selected, onSelect, allLabel, searchPlaceholder, renderLabel = (i) => i.label }) {
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

function FilterSidebarContent({ params, setParam, setDistrict, setBrand, districts, vehicleCounts, categories, brands, models, colours, priceMin, priceMax, setPriceMin, setPriceMax, applyPrice, clearAll }) {
  const selectedDistrict = params.get("district") ?? "";
  // Every city of the chosen district (from the full Sri Lanka list), not just ones with listings.
  const districtCities = districts?.find((d) => d.name === selectedDistrict)?.cities ?? [];
  const countFor = (city) => vehicleCounts?.[`${selectedDistrict}|${city}`] ?? 0;
  // District totals = sum of its cities' counts (keys are "District|City").
  const districtCount = (district) => Object.entries(vehicleCounts ?? {})
    .reduce((sum, [key, n]) => (key.startsWith(`${district}|`) ? sum + n : sum), 0);
  const withCount = (label, n) => <>{label}{n > 0 && <span className="opacity-70"> ({n})</span>}</>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-bold"><SlidersHorizontal className="h-4 w-4" /> Filters</p>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={clearAll}>Clear all</Button>
      </div>

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

      <FilterSection icon={Tag} title="Category">
        <SearchablePills
          items={(categories ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
          selected={params.get("category_id") ?? ""}
          onSelect={(v) => setParam("category_id", v)}
          allLabel="All"
          searchPlaceholder="Search categories..."
        />
      </FilterSection>

      {brands?.length > 0 && (
        <FilterSection icon={BadgeCheck} title="Brand">
          <SearchablePills
            items={brands.map((b) => ({ value: String(b.id), label: b.name }))}
            selected={params.get("brand_id") ?? ""}
            onSelect={setBrand}
            allLabel="All"
            searchPlaceholder="Search brands..."
          />
        </FilterSection>
      )}

      {params.get("brand_id") && models?.length > 0 && (
        <FilterSection icon={Layers} title="Model">
          {/* keyed by brand so search/expanded state resets when the brand changes */}
          <SearchablePills
            key={params.get("brand_id")}
            items={models.map((m) => ({ value: String(m.id), label: m.name }))}
            selected={params.get("model_id") ?? ""}
            onSelect={(v) => setParam("model_id", v)}
            allLabel="All"
            searchPlaceholder="Search models..."
          />
        </FilterSection>
      )}

      {colours?.length > 0 && (
        <FilterSection icon={Palette} title="Colour">
          <SearchablePills
            items={colours.map((c) => ({ value: String(c.id), label: c.name, hex: c.hex }))}
            selected={params.get("colour_id") ?? ""}
            onSelect={(v) => setParam("colour_id", v)}
            allLabel="All"
            searchPlaceholder="Search colours..."
            renderLabel={(i) => (
              <span className="inline-flex items-center gap-1.5">
                <ColourSwatch hex={i.hex} className="size-3" />
                {i.label}
              </span>
            )}
          />
        </FilterSection>
      )}

      <FilterSection icon={Wallet} title="Price per day">
        <div className="flex items-center gap-2">
          <Input type="number" min="0" placeholder="Min" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="h-9" />
          <span className="text-muted-foreground">–</span>
          <Input type="number" min="0" placeholder="Max" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="h-9" />
        </div>
        <Button size="sm" variant="outline" className="w-full" onClick={applyPrice}>Apply</Button>
      </FilterSection>

      <FilterSection icon={Users} title="Seats">
        <div className="flex flex-wrap gap-2">
          {SEATS_OPTIONS.map((o) => (
            <Pill key={o.value} active={(params.get("seats_min") ?? "") === o.value} onClick={() => setParam("seats_min", o.value)}>{o.label}</Pill>
          ))}
        </div>
      </FilterSection>

      <FilterSection icon={Gauge} title="Transmission">
        <div className="flex flex-wrap gap-2">
          {TRANSMISSION_OPTIONS.map((o) => (
            <Pill key={o.value} active={(params.get("transmission") ?? "") === o.value} onClick={() => setParam("transmission", o.value)}>{o.label}</Pill>
          ))}
        </div>
      </FilterSection>

      <FilterSection icon={Fuel} title="Fuel type">
        <div className="flex flex-wrap gap-2">
          {FUEL_OPTIONS.map((o) => (
            <Pill key={o.value} active={(params.get("fuel_type") ?? "") === o.value} onClick={() => setParam("fuel_type", o.value)}>{o.label}</Pill>
          ))}
        </div>
      </FilterSection>

      <FilterSection icon={Truck} title="Delivery">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={params.get("delivery") === "1"} onCheckedChange={(v) => setParam("delivery", v ? "1" : "")} />
          Delivery available
        </label>
      </FilterSection>
    </div>
  );
}

export default function BrowseVehiclesPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <BrowseVehiclesPageContent />
    </Suspense>
  );
}

function BrowseVehiclesPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  // Grid or list — a per-visitor preference, remembered in this browser only.
  const [view, setViewState] = useState("grid");
  useEffect(() => {
    try {
      if (localStorage.getItem("browse-view") === "list") setViewState("list");
    } catch {}
  }, []);
  const setView = (v) => {
    setViewState(v);
    try { localStorage.setItem("browse-view", v); } catch {}
  };
  const [priceMin, setPriceMin] = useState(params.get("price_min") ?? "");
  const [priceMax, setPriceMax] = useState(params.get("price_max") ?? "");

  useEffect(() => {
    setPriceMin(params.get("price_min") ?? "");
    setPriceMax(params.get("price_max") ?? "");
  }, [params]);

  const filters = {
    q: params.get("q") ?? undefined,
    category_id: params.get("category_id") ?? undefined,
    brand_id: params.get("brand_id") ?? undefined,
    model_id: params.get("model_id") ?? undefined,
    colour_id: params.get("colour_id") ?? undefined,
    district: params.get("district") ?? undefined,
    city: params.get("city") ?? undefined,
    transmission: params.get("transmission") ?? undefined,
    fuel_type: params.get("fuel_type") ?? undefined,
    seats_min: params.get("seats_min") ?? undefined,
    delivery: params.get("delivery") ?? undefined,
    price_min: params.get("price_min") ?? undefined,
    price_max: params.get("price_max") ?? undefined,
    sort: params.get("sort") ?? "relevance",
    page: params.get("page") ?? 1,
    per_page: 18,
  };

  // All 25 districts with their cities — the filter offers every place, not only ones with listings.
  const { data: districts } = useQuery({
    queryKey: ["public-districts"],
    queryFn: () => publicService.districts().then((r) => r.data.data),
    staleTime: 10 * 60_000,
  });

  // Live vehicle counts per city, keyed "District|City", shown beside each city.
  const { data: vehicleCounts } = useQuery({
    queryKey: ["public-locations"],
    queryFn: () => publicService.locations().then((r) => r.data.data),
    select: (rows) => Object.fromEntries(rows.map((r) => [`${r.district}|${r.city}`, r.vehicle_count])),
  });

  const { data: categories } = useQuery({
    queryKey: ["public-categories"],
    queryFn: () => publicService.categories().then((r) => r.data.data),
  });

  // Only brands someone is actually renting out — an empty filter option helps nobody.
  const { data: brands } = useQuery({
    queryKey: ["public-brands"],
    queryFn: () => publicService.brands().then((r) => r.data.data),
    select: (all) => all.filter((b) => b.vehicles_count > 0),
  });

  const brandId = params.get("brand_id");
  const { data: models } = useQuery({
    queryKey: ["public-models", brandId],
    queryFn: () => publicService.models(brandId).then((r) => r.data.data),
    enabled: !!brandId,
    select: (all) => all.filter((m) => m.vehicles_count > 0),
  });

  const { data: colours } = useQuery({
    queryKey: ["public-colours"],
    queryFn: () => publicService.colours().then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["public-vehicles", "browse", filters],
    queryFn: () => publicService.vehicles(filters).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const setParam = (key, value) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`/browse?${next.toString()}`);
  };

  // A model belongs to one brand - switching brand clears the model filter.
  const setBrand = (value) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("brand_id", value); else next.delete("brand_id");
    next.delete("model_id");
    next.delete("page");
    router.push(`/browse?${next.toString()}`);
  };

  const goToPage = (page) => {
    const next = new URLSearchParams(params.toString());
    if (page > 1) next.set("page", String(page)); else next.delete("page");
    router.push(`/browse?${next.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const setDistrict = (value) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("district", value); else next.delete("district");
    next.delete("city");
    next.delete("page");
    router.push(`/browse?${next.toString()}`);
  };

  const applyPrice = () => {
    const next = new URLSearchParams(params.toString());
    if (priceMin) next.set("price_min", priceMin); else next.delete("price_min");
    if (priceMax) next.set("price_max", priceMax); else next.delete("price_max");
    next.delete("page");
    router.push(`/browse?${next.toString()}`);
    setMobileFiltersOpen(false);
  };

  const clearAll = () => {
    setQ("");
    router.push("/browse");
    setMobileFiltersOpen(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setParam("q", q);
  };

  const activeFilterCount = ["category_id", "brand_id", "model_id", "colour_id", "district", "city", "transmission", "fuel_type", "seats_min", "delivery", "price_min", "price_max"]
    .filter((k) => params.get(k)).length;

  const filterProps = { params, setParam, setDistrict, setBrand, districts, vehicleCounts, categories, brands, models, colours, priceMin, priceMax, setPriceMin, setPriceMax, applyPrice, clearAll };

  return (
    <div>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden border-b">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-60">
          <div className="aurora-blob aurora-blob-2" />
          <div className="aurora-blob aurora-blob-3" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-6 sm:py-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
            <div>
              <div className="border-border/60 bg-background/80 mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> {data?.meta?.total ?? "Hundreds of"} vehicles ready to book
              </div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Browse{" "}
                <span className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">Vehicles</span>
              </h1>
              <p className="mt-1 max-w-md text-xs text-muted-foreground sm:text-sm">
                Search real listings from verified owners and rental shops across Sri Lanka.
              </p>
            </div>

            <form onSubmit={handleSearch} className="flex w-full gap-2 lg:w-[420px] lg:shrink-0">
              <div className="relative flex-1">
                <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by make, model or city..."
                  className="h-11 bg-card pl-10 shadow-sm"
                />
              </div>
              <Button type="submit" size="lg" className="h-11 shrink-0 bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90">
                Search
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* ── Sidebar + results ─────────────────────────────────────────── */}
      {/* pb-28 on mobile keeps the last row / pagination clear of the floating Filters button */}
      <div className="mx-auto max-w-7xl px-4 pb-28 pt-8 lg:flex lg:items-start lg:gap-8 lg:pb-8">
        {/* Desktop sidebar */}
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-20 rounded-2xl border bg-card p-5 shadow-sm">
            <FilterSidebarContent {...filterProps} />
          </div>
        </aside>

        <div className="flex-1">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Searching..." : <>{data?.meta?.total ?? data?.data?.length ?? 0} vehicles<span className="hidden sm:inline"> found</span></>}
            </p>
            <div className="flex items-center gap-2">
              {/* toggle and sort share one height (h-9) at every breakpoint */}
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
              <Select value={params.get("sort") ?? "relevance"} onValueChange={(v) => setParam("sort", v)}>
                <SelectTrigger className="h-9 w-36 rounded-lg bg-card text-sm sm:w-44"><SelectValue placeholder="Sort" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Most relevant</SelectItem>
                  <SelectItem value="price_asc">Price: Low to High</SelectItem>
                  <SelectItem value="price_desc">Price: High to Low</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className={view === "list" ? "space-y-3 sm:space-y-4" : "grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3"}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={cn("animate-pulse overflow-hidden rounded-2xl border bg-card", view === "list" && "flex")}>
                  <div className={cn("aspect-[4/3] bg-muted", view === "list" && "aspect-auto h-28 w-28 shrink-0 sm:h-44 sm:w-64 md:w-72")} />
                  <div className="space-y-2 p-3">
                    <div className="h-4 w-3/4 rounded bg-muted" />
                    <div className="h-3 w-1/2 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : data?.data?.length ? (
            <>
              {view === "list" ? (
                <div className="space-y-3 sm:space-y-4">
                  {data.data.map((v) => <VehicleListItem key={v.id} vehicle={v} />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
                  {data.data.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
                </div>
              )}
              <Pagination meta={data.meta} onPage={goToPage} />
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-20 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/10 via-pink-500/10 to-violet-500/10">
                <CarFront className="h-7 w-7 text-primary" />
              </div>
              <p className="font-medium">No vehicles match your search</p>
              <p className="text-sm text-muted-foreground">Try a different city, category or clearing a filter.</p>
              <Button variant="outline" onClick={clearAll}>Clear filters</Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: floating Filters button, fixed to the bottom of the screen */}
      {!mobileFiltersOpen && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:hidden">
          <Button
            onClick={() => setMobileFiltersOpen(true)}
            className="pointer-events-auto h-12 gap-2 rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 px-6 text-sm font-semibold shadow-xl shadow-pink-500/25 hover:opacity-90"
          >
            <SlidersHorizontal className="h-4 w-4" /> Filters
            {activeFilterCount > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-pink-600">{activeFilterCount}</span>
            )}
          </Button>
        </div>
      )}

      {/* Mobile filters overlay */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileFiltersOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <p className="font-semibold">Filters</p>
              <button type="button" onClick={() => setMobileFiltersOpen(false)} className="rounded-md p-1.5 hover:bg-muted" aria-label="Close filters">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <FilterSidebarContent {...filterProps} />
            </div>
            <div className="border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button className="w-full bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90" onClick={() => setMobileFiltersOpen(false)}>
                Show {data?.meta?.total ?? ""} results
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
