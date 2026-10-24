"use client";

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { publicService } from "@/services/publicService";
import { useAuthStore } from "@/store/authStore";
import { VehicleCard } from "@/components/marketplace/VehicleCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/components/auth/AuthDialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Car, Search as SearchIcon, Loader2, User as UserIcon } from "lucide-react";

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const { isAuthenticated, user } = useAuthStore();
  const [authView, setAuthView] = useState(null); // "login" | "register" | null

  const filters = {
    q: params.get("q") ?? undefined,
    category_id: params.get("category_id") ?? undefined,
    transmission: params.get("transmission") ?? undefined,
    fuel_type: params.get("fuel_type") ?? undefined,
    sort: params.get("sort") ?? "relevance",
    page: params.get("page") ?? 1,
  };

  const { data: categories } = useQuery({
    queryKey: ["public-categories"],
    queryFn: () => publicService.categories().then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["public-vehicles", "search", filters],
    queryFn: () => publicService.vehicles(filters).then((r) => r.data),
  });

  const setParam = (key, value) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`/search?${next.toString()}`);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setParam("q", q);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold shrink-0">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Car className="size-3.5" />
            </div>
            RentLanka
          </Link>
          <form onSubmit={handleSearch} className="flex flex-1 gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by make, model or city..." />
            <Button type="submit"><SearchIcon className="h-4 w-4" /></Button>
          </form>
          {isAuthenticated ? (
            <Button variant="outline" asChild className="shrink-0">
              <Link href="/account"><UserIcon className="mr-2 h-4 w-4" /> {user?.name?.split(" ")[0] ?? "My Account"}</Link>
            </Button>
          ) : (
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" onClick={() => setAuthView("login")}>Sign in</Button>
              <Button onClick={() => setAuthView("register")}>Sign up</Button>
            </div>
          )}
        </div>
      </header>

      <AuthDialog
        open={!!authView}
        onOpenChange={(v) => !v && setAuthView(null)}
        initialView={authView ?? "login"}
      />

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5 flex flex-wrap gap-2">
          <Select value={params.get("category_id") ?? "all"} onValueChange={(v) => setParam("category_id", v === "all" ? "" : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={params.get("transmission") ?? "all"} onValueChange={(v) => setParam("transmission", v === "all" ? "" : v)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Transmission" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any transmission</SelectItem>
              <SelectItem value="automatic">Automatic</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>

          <Select value={params.get("fuel_type") ?? "all"} onValueChange={(v) => setParam("fuel_type", v === "all" ? "" : v)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Fuel type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any fuel</SelectItem>
              <SelectItem value="petrol">Petrol</SelectItem>
              <SelectItem value="diesel">Diesel</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
              <SelectItem value="electric">Electric</SelectItem>
            </SelectContent>
          </Select>

          <Select value={params.get("sort") ?? "relevance"} onValueChange={(v) => setParam("sort", v)}>
            <SelectTrigger className="w-40 ml-auto"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Most relevant</SelectItem>
              <SelectItem value="price_asc">Price: Low to High</SelectItem>
              <SelectItem value="price_desc">Price: High to Low</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading...</p>
        ) : data?.data?.length ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">{data.meta?.total ?? data.data.length} vehicles found</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.data.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
            </div>
          </>
        ) : (
          <p className="rounded-xl border border-dashed py-20 text-center text-sm text-muted-foreground">
            No vehicles match your search.
          </p>
        )}
      </div>
    </div>
  );
}
