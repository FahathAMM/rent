"use client";

import { Suspense, useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { publicService } from "@/services/publicService";
import { VehicleCard } from "./components/VehicleCard";
import { VehicleListItem } from "./components/VehicleListItem";
import {
  FilterSection, FiltersHeading, FUEL_OPTIONS, LocationFilter, MobileFilters, OptionPills, Pagination,
  RangeInputs, ResultsCount, SEATS_OPTIONS, SearchablePills, TRANSMISSION_OPTIONS, ViewToggle,
} from "@/app/(public)/buy/components/FilterControls";
import { ColourSwatch } from "@/components/marketplace/ColourSwatch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Search as SearchIcon, Loader2, CarFront,
  Tag, Gauge, Fuel, Users, Truck, Wallet, Sparkles, BadgeCheck, Layers, Palette,
} from "lucide-react";

function FilterSidebarContent({ params, setParam, setDistrict, setBrand, districts, vehicleCounts, categories, brands, models, colours, priceMin, priceMax, setPriceMin, setPriceMax, applyPrice, clearAll }) {
  const t = useTranslations("browse");

  return (
    <div className="space-y-5">
      <FiltersHeading onClear={clearAll} />

      <LocationFilter params={params} setParam={setParam} setDistrict={setDistrict} districts={districts} vehicleCounts={vehicleCounts} />

      <FilterSection icon={Tag} title={t("category")}>
        <SearchablePills
          items={(categories ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
          selected={params.get("category_id") ?? ""}
          onSelect={(v) => setParam("category_id", v)}
          searchPlaceholder={t("searchCategories")}
        />
      </FilterSection>

      {brands?.length > 0 && (
        <FilterSection icon={BadgeCheck} title={t("brand")}>
          <SearchablePills
            items={brands.map((b) => ({ value: String(b.id), label: b.name }))}
            selected={params.get("brand_id") ?? ""}
            onSelect={setBrand}
            searchPlaceholder={t("searchBrands")}
          />
        </FilterSection>
      )}

      {params.get("brand_id") && models?.length > 0 && (
        <FilterSection icon={Layers} title={t("model")}>
          {/* keyed by brand so search/expanded state resets when the brand changes */}
          <SearchablePills
            key={params.get("brand_id")}
            items={models.map((m) => ({ value: String(m.id), label: m.name }))}
            selected={params.get("model_id") ?? ""}
            onSelect={(v) => setParam("model_id", v)}
            searchPlaceholder={t("searchModels")}
          />
        </FilterSection>
      )}

      {colours?.length > 0 && (
        <FilterSection icon={Palette} title={t("colour")}>
          <SearchablePills
            items={colours.map((c) => ({ value: String(c.id), label: c.name, hex: c.hex }))}
            selected={params.get("colour_id") ?? ""}
            onSelect={(v) => setParam("colour_id", v)}
            searchPlaceholder={t("searchColours")}
            renderLabel={(i) => (
              <span className="inline-flex items-center gap-1.5">
                <ColourSwatch hex={i.hex} className="size-3" />
                {i.label}
              </span>
            )}
          />
        </FilterSection>
      )}

      <FilterSection icon={Wallet} title={t("pricePerDay")}>
        <RangeInputs min={priceMin} max={priceMax} onMin={setPriceMin} onMax={setPriceMax} onApply={applyPrice} />
      </FilterSection>

      <FilterSection icon={Users} title={t("seats")}>
        <OptionPills options={SEATS_OPTIONS} value={params.get("seats_min")} onChange={(v) => setParam("seats_min", v)} />
      </FilterSection>

      <FilterSection icon={Gauge} title={t("transmission")}>
        <OptionPills options={TRANSMISSION_OPTIONS} group="transmission" value={params.get("transmission")} onChange={(v) => setParam("transmission", v)} />
      </FilterSection>

      <FilterSection icon={Fuel} title={t("fuelType")}>
        <OptionPills options={FUEL_OPTIONS} group="fuel" value={params.get("fuel_type")} onChange={(v) => setParam("fuel_type", v)} />
      </FilterSection>

      <FilterSection icon={Truck} title={t("delivery")}>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={params.get("delivery") === "1"} onCheckedChange={(v) => setParam("delivery", v ? "1" : "")} />
          {t("deliveryAvailable")}
        </label>
      </FilterSection>
    </div>
  );
}

export default function RentVehiclesPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <RentVehiclesPageContent />
    </Suspense>
  );
}

function RentVehiclesPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations("browse");
  const tr = useTranslations("rent");
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

  // Every active brand — the ones someone is renting out first, so they aren't hidden behind "Show more".
  const { data: brands } = useQuery({
    queryKey: ["public-brands"],
    queryFn: () => publicService.brands().then((r) => r.data.data),
    select: (all) => [...all].sort((a, b) => Number(b.vehicles_count > 0) - Number(a.vehicles_count > 0)),
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
    router.push(`/rent?${next.toString()}`);
  };

  // A model belongs to one brand - switching brand clears the model filter.
  const setBrand = (value) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("brand_id", value); else next.delete("brand_id");
    next.delete("model_id");
    next.delete("page");
    router.push(`/rent?${next.toString()}`);
  };

  const goToPage = (page) => {
    const next = new URLSearchParams(params.toString());
    if (page > 1) next.set("page", String(page)); else next.delete("page");
    router.push(`/rent?${next.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const setDistrict = (value) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("district", value); else next.delete("district");
    next.delete("city");
    next.delete("page");
    router.push(`/rent?${next.toString()}`);
  };

  const applyPrice = () => {
    const next = new URLSearchParams(params.toString());
    if (priceMin) next.set("price_min", priceMin); else next.delete("price_min");
    if (priceMax) next.set("price_max", priceMax); else next.delete("price_max");
    next.delete("page");
    router.push(`/rent?${next.toString()}`);
    setMobileFiltersOpen(false);
  };

  const clearAll = () => {
    setQ("");
    router.push("/rent");
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
                <Sparkles className="h-3.5 w-3.5 text-primary" /> {data?.meta?.total != null ? tr("badge", { count: data.meta.total }) : tr("badgeUnknown")}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {tr.rich("title", {
                  accent: (chunks) => <span className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">{chunks}</span>,
                })}
              </h1>
              <p className="mt-1 max-w-md text-xs text-muted-foreground sm:text-sm">
                {tr("subtitle")}
              </p>
            </div>

            <form onSubmit={handleSearch} className="flex w-full gap-2 lg:w-[420px] lg:shrink-0">
              <div className="relative flex-1">
                <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={tr("searchPlaceholder")}
                  className="h-11 bg-card pl-10 shadow-sm"
                />
              </div>
              <Button type="submit" size="lg" className="h-11 shrink-0 bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90">
                {t("search")}
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
            <ResultsCount loading={isLoading} count={data?.meta?.total ?? data?.data?.length ?? 0} />
            <div className="flex items-center gap-2">
              {/* toggle and sort share one height (h-9) at every breakpoint */}
              <ViewToggle view={view} setView={setView} />
              <Select value={params.get("sort") ?? "relevance"} onValueChange={(v) => setParam("sort", v)}>
                <SelectTrigger className="h-9 w-36 rounded-lg bg-card text-sm sm:w-44"><SelectValue placeholder={t("sort")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">{t("sortRelevance")}</SelectItem>
                  <SelectItem value="price_asc">{t("sortPriceAsc")}</SelectItem>
                  <SelectItem value="price_desc">{t("sortPriceDesc")}</SelectItem>
                  <SelectItem value="newest">{t("sortNewest")}</SelectItem>
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
              <p className="font-medium">{t("noMatchTitle")}</p>
              <p className="text-sm text-muted-foreground">{tr("emptyHint")}</p>
              <Button variant="outline" onClick={clearAll}>{t("clearFilters")}</Button>
            </div>
          )}
        </div>
      </div>

      <MobileFilters open={mobileFiltersOpen} setOpen={setMobileFiltersOpen} activeCount={activeFilterCount} total={data?.meta?.total}>
        <FilterSidebarContent {...filterProps} />
      </MobileFilters>
    </div>
  );
}
