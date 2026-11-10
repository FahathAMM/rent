"use client";

import { Suspense, useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { publicService } from "@/services/publicService";
import {
  CONDITION_OPTIONS, FilterSection, FiltersHeading, FUEL_OPTIONS, LocationFilter, MobileFilters, OptionPills, Pagination,
  RangeInputs, ResultsCount, SEATS_OPTIONS, SearchablePills, TRANSMISSION_OPTIONS, ViewToggle,
} from "./components/FilterControls";
import { ColourSwatch } from "@/components/marketplace/ColourSwatch";
import { SaleVehicleCard } from "./components/SaleVehicleCard";
import { SaleVehicleListItem } from "./components/SaleVehicleListItem";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { BadgeCheck, Calendar, CarFront, Fuel, Gauge, Layers, Loader2, Palette, Route, Search as SearchIcon, ShieldCheck, Sparkles, Tag, Users, Wallet } from "lucide-react";

const NUMBER_FILTERS = ["price_min", "price_max", "year_min", "year_max", "mileage_max"];
const PILL_FILTERS = ["category_id", "brand_id", "model_id", "colour_id", "district", "city", "condition", "transmission", "fuel_type", "seats_min"];

function FilterSidebarContent({ params, setParam, setDistrict, setBrand, districts, options, vehicleCounts, categories, colours, numbers, setNumber, applyNumbers, clearAll }) {
  const t = useTranslations("browse");
  const range = (minKey, maxKey) => (
    <RangeInputs
      min={numbers[minKey]} max={numbers[maxKey]}
      onMin={(v) => setNumber(minKey, v)} onMax={(v) => setNumber(maxKey, v)}
      onApply={applyNumbers}
    />
  );
  const pills = (key, list, group) => (
    <OptionPills options={list} group={group} value={params.get(key)} onChange={(v) => setParam(key, v)} />
  );

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

      <FilterSection icon={ShieldCheck} title={t("condition")}>{pills("condition", CONDITION_OPTIONS, "condition")}</FilterSection>

      {options?.brands?.length > 0 && (
        <FilterSection icon={BadgeCheck} title={t("brand")}>
          <SearchablePills
            items={options.brands.map((b) => ({ value: String(b.id), label: b.name }))}
            selected={params.get("brand_id") ?? ""}
            onSelect={setBrand}
            searchPlaceholder={t("searchBrands")}
          />
        </FilterSection>
      )}

      {params.get("brand_id") && options?.models?.length > 0 && (
        <FilterSection icon={Layers} title={t("model")}>
          {/* keyed by brand so search/expanded state resets when the brand changes */}
          <SearchablePills
            key={params.get("brand_id")}
            items={options.models.map((m) => ({ value: String(m.id), label: m.name }))}
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

      <FilterSection icon={Wallet} title={t("price")}>{range("price_min", "price_max")}</FilterSection>
      <FilterSection icon={Calendar} title={t("year")}>{range("year_min", "year_max")}</FilterSection>

      <FilterSection icon={Route} title={t("maxMileage")}>
        <Input type="number" min="0" placeholder={t("any")} value={numbers.mileage_max} onChange={(e) => setNumber("mileage_max", e.target.value)} className="h-9" />
        <Button size="sm" variant="outline" className="w-full" onClick={applyNumbers}>{t("apply")}</Button>
      </FilterSection>

      <FilterSection icon={Users} title={t("seats")}>{pills("seats_min", SEATS_OPTIONS)}</FilterSection>
      <FilterSection icon={Gauge} title={t("transmission")}>{pills("transmission", TRANSMISSION_OPTIONS, "transmission")}</FilterSection>
      <FilterSection icon={Fuel} title={t("fuelType")}>{pills("fuel_type", FUEL_OPTIONS, "fuel")}</FilterSection>
    </div>
  );
}

export default function BuyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <BuyPageContent />
    </Suspense>
  );
}

function BuyPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations("browse");
  const tb = useTranslations("buy");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  // Grid or list — a per-visitor preference, remembered in this browser only.
  const [view, setViewState] = useState("grid");
  useEffect(() => {
    try {
      if (localStorage.getItem("buy-view") === "list") setViewState("list");
    } catch {}
  }, []);
  const setView = (v) => {
    setViewState(v);
    try { localStorage.setItem("buy-view", v); } catch {}
  };

  const numbersFromUrl = () => Object.fromEntries(NUMBER_FILTERS.map((k) => [k, params.get(k) ?? ""]));
  const [numbers, setNumbers] = useState(numbersFromUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setNumbers(numbersFromUrl()), [params]);
  const setNumber = (key, value) => setNumbers((n) => ({ ...n, [key]: value }));

  const filters = {
    ...Object.fromEntries(["q", ...PILL_FILTERS, ...NUMBER_FILTERS].map((k) => [k, params.get(k) ?? undefined])),
    sort: params.get("sort") ?? "newest",
    page: params.get("page") ?? 1,
    per_page: 18,
  };

  const { data: districts } = useQuery({
    queryKey: ["public-districts"],
    queryFn: () => publicService.districts().then((r) => r.data.data),
    staleTime: 10 * 60_000,
  });

  const { data: categories } = useQuery({
    queryKey: ["public-categories"],
    queryFn: () => publicService.categories().then((r) => r.data.data),
  });

  const { data: colours } = useQuery({
    queryKey: ["public-colours"],
    queryFn: () => publicService.colours().then((r) => r.data.data),
  });

  // Brands, models and places that have cars for sale.
  const brandId = params.get("brand_id");
  const { data: options } = useQuery({
    queryKey: ["public-sale-filters", brandId],
    queryFn: () => publicService.saleFilters(brandId).then((r) => r.data.data),
    placeholderData: keepPreviousData,
  });
  const vehicleCounts = Object.fromEntries((options?.locations ?? []).map((r) => [`${r.district}|${r.city}`, r.vehicle_count]));

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-sale-vehicles", filters],
    queryFn: () => publicService.saleVehicles(filters).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const navigate = (change) => {
    const next = new URLSearchParams(params.toString());
    change(next);
    next.delete("page");
    router.push(`/buy?${next.toString()}`);
  };
  const put = (next, key, value) => (value ? next.set(key, value) : next.delete(key));

  const setParam = (key, value) => navigate((next) => put(next, key, value));
  // A model belongs to one brand, a city to one district.
  const setBrand = (value) => navigate((next) => { put(next, "brand_id", value); next.delete("model_id"); });
  const setDistrict = (value) => navigate((next) => { put(next, "district", value); next.delete("city"); });

  const applyNumbers = () => {
    navigate((next) => NUMBER_FILTERS.forEach((k) => put(next, k, numbers[k])));
    setMobileFiltersOpen(false);
  };

  const goToPage = (page) => {
    const next = new URLSearchParams(params.toString());
    if (page > 1) next.set("page", String(page)); else next.delete("page");
    router.push(`/buy?${next.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const clearAll = () => {
    setQ("");
    router.push("/buy");
    setMobileFiltersOpen(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setParam("q", q);
  };

  const activeFilterCount = [...PILL_FILTERS, ...NUMBER_FILTERS].filter((k) => params.get(k)).length;
  const filterProps = { params, setParam, setDistrict, setBrand, districts, options, vehicleCounts, categories, colours, numbers, setNumber, applyNumbers, clearAll };

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
                <Sparkles className="h-3.5 w-3.5 text-primary" /> {tb("badge", { count: data?.meta?.total ?? 0 })}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {tb.rich("title", {
                  accent: (chunks) => <span className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">{chunks}</span>,
                })}
              </h1>
              <p className="mt-1 max-w-md text-xs text-muted-foreground sm:text-sm">
                {tb("subtitle")}
              </p>
            </div>

            <form onSubmit={handleSearch} className="flex w-full gap-2 lg:w-[420px] lg:shrink-0">
              <div className="relative flex-1">
                <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tb("searchPlaceholder")} className="h-11 bg-card pl-10 shadow-sm" />
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
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-20 rounded-2xl border bg-card p-5 shadow-sm">
            <FilterSidebarContent {...filterProps} />
          </div>
        </aside>

        <div className="flex-1">
          <div className="mb-4 flex items-center justify-between gap-3">
            <ResultsCount loading={isLoading} count={data?.meta?.total ?? 0} />
            <div className="flex items-center gap-2">
              <ViewToggle view={view} setView={setView} />
              <Select value={params.get("sort") ?? "newest"} onValueChange={(v) => setParam("sort", v)}>
                <SelectTrigger className="h-9 w-36 rounded-lg bg-card text-sm sm:w-44"><SelectValue placeholder={t("sort")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t("sortNewest")}</SelectItem>
                  <SelectItem value="price_asc">{t("sortPriceAsc")}</SelectItem>
                  <SelectItem value="price_desc">{t("sortPriceDesc")}</SelectItem>
                  <SelectItem value="mileage_asc">{t("sortMileageAsc")}</SelectItem>
                  <SelectItem value="year_desc">{t("sortYearDesc")}</SelectItem>
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
          ) : isError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">{tb("loadError")}</div>
          ) : data?.data?.length ? (
            <>
              {view === "list" ? (
                <div className="space-y-3 sm:space-y-4">
                  {data.data.map((v) => <SaleVehicleListItem key={v.id} vehicle={v} />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
                  {data.data.map((v) => <SaleVehicleCard key={v.id} vehicle={v} />)}
                </div>
              )}
              <Pagination meta={data.meta} onPage={goToPage} />
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-20 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/10 via-pink-500/10 to-violet-500/10">
                <CarFront className="h-7 w-7 text-primary" />
              </div>
              <p className="font-medium">{activeFilterCount || params.get("q") ? t("noMatchTitle") : tb("emptyNoneTitle")}</p>
              <p className="text-sm text-muted-foreground">{activeFilterCount || params.get("q") ? tb("emptyHintFiltered") : tb("emptyHintNone")}</p>
              {(activeFilterCount > 0 || params.get("q")) && <Button variant="outline" onClick={clearAll}>{t("clearFilters")}</Button>}
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
