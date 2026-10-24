"use client";

import { Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { publicService } from "@/services/publicService";
import { VehicleCard } from "@/components/marketplace/VehicleCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Search as SearchIcon, Loader2, CarFront, SlidersHorizontal, X,
  MapPin, Tag, Gauge, Fuel, Users, Truck, Wallet, Sparkles,
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

function FilterSidebarContent({ params, setParam, cities, categories, priceMin, priceMax, setPriceMin, setPriceMax, applyPrice, clearAll }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-bold"><SlidersHorizontal className="h-4 w-4" /> Filters</p>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={clearAll}>Clear all</Button>
      </div>

      <FilterSection icon={MapPin} title="Location">
        <div className="flex flex-wrap gap-2">
          <Pill active={!params.get("city")} onClick={() => setParam("city", "")}>All cities</Pill>
          {cities?.map((c) => (
            <Pill key={c.city} active={params.get("city") === c.city} onClick={() => setParam("city", c.city)}>
              {c.city} <span className="opacity-70">({c.vehicle_count})</span>
            </Pill>
          ))}
        </div>
      </FilterSection>

      <FilterSection icon={Tag} title="Category">
        <div className="flex flex-wrap gap-2">
          <Pill active={!params.get("category_id")} onClick={() => setParam("category_id", "")}>All</Pill>
          {categories?.map((c) => (
            <Pill key={c.id} active={params.get("category_id") === String(c.id)} onClick={() => setParam("category_id", String(c.id))}>
              {c.name}
            </Pill>
          ))}
        </div>
      </FilterSection>

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
  const [priceMin, setPriceMin] = useState(params.get("price_min") ?? "");
  const [priceMax, setPriceMax] = useState(params.get("price_max") ?? "");

  useEffect(() => {
    setPriceMin(params.get("price_min") ?? "");
    setPriceMax(params.get("price_max") ?? "");
  }, [params]);

  const filters = {
    q: params.get("q") ?? undefined,
    category_id: params.get("category_id") ?? undefined,
    city: params.get("city") ?? undefined,
    transmission: params.get("transmission") ?? undefined,
    fuel_type: params.get("fuel_type") ?? undefined,
    seats_min: params.get("seats_min") ?? undefined,
    delivery: params.get("delivery") ?? undefined,
    price_min: params.get("price_min") ?? undefined,
    price_max: params.get("price_max") ?? undefined,
    sort: params.get("sort") ?? "relevance",
    page: params.get("page") ?? 1,
  };

  const { data: cities } = useQuery({
    queryKey: ["public-locations"],
    queryFn: () => publicService.locations().then((r) => r.data.data),
  });

  const { data: categories } = useQuery({
    queryKey: ["public-categories"],
    queryFn: () => publicService.categories().then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["public-vehicles", "browse", filters],
    queryFn: () => publicService.vehicles(filters).then((r) => r.data),
  });

  const setParam = (key, value) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
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

  const activeFilterCount = ["category_id", "city", "transmission", "fuel_type", "seats_min", "delivery", "price_min", "price_max"]
    .filter((k) => params.get(k)).length;

  const filterProps = { params, setParam, cities, categories, priceMin, priceMax, setPriceMin, setPriceMax, applyPrice, clearAll };

  return (
    <div>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden border-b">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-60">
          <div className="aurora-blob aurora-blob-2" />
          <div className="aurora-blob aurora-blob-3" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:py-12">
          <div className="border-border/60 bg-background/80 mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> {data?.meta?.total ?? "Hundreds of"} vehicles ready to book
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Browse{" "}
            <span className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">Vehicles</span>
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground sm:text-base">
            Search real listings from verified owners and rental shops across Sri Lanka.
          </p>

          <form onSubmit={handleSearch} className="mt-6 flex max-w-2xl gap-2">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by make, model or city..."
                className="h-12 bg-card pl-10 shadow-sm"
              />
            </div>
            <Button type="submit" size="lg" className="h-12 shrink-0 bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90">
              Search
            </Button>
          </form>
        </div>
      </section>

      {/* ── Sidebar + results ─────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 py-8 lg:flex lg:items-start lg:gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-20 rounded-2xl border bg-card p-5 shadow-sm">
            <FilterSidebarContent {...filterProps} />
          </div>
        </aside>

        <div className="flex-1">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Searching..." : `${data?.meta?.total ?? data?.data?.length ?? 0} vehicles found`}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 lg:hidden" onClick={() => setMobileFiltersOpen(true)}>
                <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
                {activeFilterCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{activeFilterCount}</span>}
              </Button>
              <Select value={params.get("sort") ?? "relevance"} onValueChange={(v) => setParam("sort", v)}>
                <SelectTrigger className="w-44 bg-card"><SelectValue placeholder="Sort" /></SelectTrigger>
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
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse overflow-hidden rounded-2xl border bg-card">
                  <div className="aspect-[4/3] bg-muted" />
                  <div className="space-y-2 p-3">
                    <div className="h-4 w-3/4 rounded bg-muted" />
                    <div className="h-3 w-1/2 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : data?.data?.length ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {data.data.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
            </div>
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

      {/* Mobile filters overlay */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileFiltersOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 right-0 w-full max-w-sm overflow-y-auto bg-background p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-semibold">Filters</p>
              <button type="button" onClick={() => setMobileFiltersOpen(false)} className="rounded-md p-1.5 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <FilterSidebarContent {...filterProps} />
            <Button className="mt-6 w-full bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90" onClick={() => setMobileFiltersOpen(false)}>
              Show results
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
