"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { publicService } from "@/services/publicService";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Search as SearchIcon, ShieldCheck, Star, Loader2, Building2, MapPin } from "lucide-react";

export default function ShopsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <ShopsPageContent />
    </Suspense>
  );
}

function ShopCard({ shop }) {
  return (
    <Link
      href={`/shops/${shop.slug}`}
      className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative flex h-28 items-center justify-center bg-gradient-to-br from-orange-500/15 via-pink-500/15 to-violet-500/15">
        {shop.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.logo} alt={shop.name} className="h-14 w-14 rounded-full border-2 border-background object-cover shadow-sm" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-background bg-card shadow-sm">
            <Building2 className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="space-y-1.5 p-4">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-semibold">{shop.name}</p>
          {shop.is_verified && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
        </div>
        {shop.tagline && <p className="truncate text-xs text-muted-foreground">{shop.tagline}</p>}
        <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
          {shop.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{shop.city}</span>}
          {Number(shop.rating_avg) > 0 && (
            <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{Number(shop.rating_avg).toFixed(1)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function ShopsPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  const filters = { q: params.get("q") ?? undefined, city: params.get("city") ?? undefined };

  const { data: cities } = useQuery({
    queryKey: ["public-locations"],
    queryFn: () => publicService.locations().then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["public-shops", filters],
    queryFn: () => publicService.shops(filters).then((r) => r.data),
  });

  const setParam = (key, value) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/shops?${next.toString()}`);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setParam("q", q);
  };

  return (
    <div>
      <section className="border-b bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Rental Companies</h1>
          <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
            Verified rental shops and individual owners across Sri Lanka.
          </p>

          <form onSubmit={handleSearch} className="mx-auto mt-6 flex max-w-lg gap-2">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by company name..." className="h-11 bg-card pl-10 shadow-sm" />
            </div>
            <Select value={params.get("city") ?? "all"} onValueChange={(v) => setParam("city", v === "all" ? "" : v)}>
              <SelectTrigger className="w-40 bg-card"><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {cities?.map((c) => <SelectItem key={c.city} value={c.city}>{c.city}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="submit" size="lg" className="shrink-0 bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90">
              Search
            </Button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : data?.data?.length ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.data.map((shop) => <ShopCard key={shop.id} shop={shop} />)}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed py-16 text-center text-sm text-muted-foreground">
            No rental companies match your search.
          </p>
        )}
      </div>
    </div>
  );
}
