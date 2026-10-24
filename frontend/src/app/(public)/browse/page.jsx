"use client";

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { publicService } from "@/services/publicService";
import { VehicleCard } from "@/components/marketplace/VehicleCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Search as SearchIcon, Loader2, CarFront } from "lucide-react";

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

  const filters = {
    q: params.get("q") ?? undefined,
    category_id: params.get("category_id") ?? undefined,
    city: params.get("city") ?? undefined,
    transmission: params.get("transmission") ?? undefined,
    fuel_type: params.get("fuel_type") ?? undefined,
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

  const handleSearch = (e) => {
    e.preventDefault();
    setParam("q", q);
  };

  return (
    <div>
      {/* ── Heading + search + filters bar ───────────────────────────── */}
      <div className="border-b bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <h1 className="text-2xl font-semibold tracking-tight">Browse Vehicles</h1>
          <p className="mt-1 text-sm text-muted-foreground">Search real listings from verified owners and rental shops across Sri Lanka.</p>

          <form onSubmit={handleSearch} className="mt-5 flex gap-2">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by make, model or city..."
                className="h-11 pl-10 shadow-sm"
              />
            </div>
            <Button type="submit" size="lg" className="shrink-0 bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90">
              Search
            </Button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            <Select value={params.get("city") ?? "all"} onValueChange={(v) => setParam("city", v === "all" ? "" : v)}>
              <SelectTrigger className="w-40 bg-card"><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {cities?.map((c) => <SelectItem key={c.city} value={c.city}>{c.city} ({c.vehicle_count})</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={params.get("category_id") ?? "all"} onValueChange={(v) => setParam("category_id", v === "all" ? "" : v)}>
              <SelectTrigger className="w-40 bg-card"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={params.get("transmission") ?? "all"} onValueChange={(v) => setParam("transmission", v === "all" ? "" : v)}>
              <SelectTrigger className="w-36 bg-card"><SelectValue placeholder="Transmission" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any transmission</SelectItem>
                <SelectItem value="automatic">Automatic</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>

            <Select value={params.get("fuel_type") ?? "all"} onValueChange={(v) => setParam("fuel_type", v === "all" ? "" : v)}>
              <SelectTrigger className="w-36 bg-card"><SelectValue placeholder="Fuel type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any fuel</SelectItem>
                <SelectItem value="petrol">Petrol</SelectItem>
                <SelectItem value="diesel">Diesel</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
                <SelectItem value="electric">Electric</SelectItem>
              </SelectContent>
            </Select>

            <Select value={params.get("sort") ?? "relevance"} onValueChange={(v) => setParam("sort", v)}>
              <SelectTrigger className="w-40 bg-card ml-auto"><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Most relevant</SelectItem>
                <SelectItem value="price_asc">Price: Low to High</SelectItem>
                <SelectItem value="price_desc">Price: High to Low</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
          <>
            <p className="mb-4 text-sm text-muted-foreground">{data.meta?.total ?? data.data.length} vehicles found</p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.data.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-20 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <CarFront className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium">No vehicles match your search</p>
            <p className="text-sm text-muted-foreground">Try a different city, category or clearing a filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
