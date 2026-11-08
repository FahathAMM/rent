"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { publicService } from "@/services/publicService";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BadgeDollarSign, ChevronDown, Loader2 } from "lucide-react";
import { SaleVehicleCard } from "./SaleVehicleCard";

/** The "For sale" section of a shop's public page, in the same style as its rental section. */
export function ShopSaleSection({ slug }) {
  const t = useTranslations("browse");
  const ts = useTranslations("sale");
  const [sort, setSort] = useState("newest");

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["public-shop-sale-vehicles", slug, sort],
    queryFn: ({ pageParam }) => publicService.shopSaleVehicles(slug, { page: pageParam, per_page: 9, sort }).then((r) => r.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta && last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
  });

  const vehicles = data?.pages.flatMap((p) => p.data) ?? [];
  const total = data?.pages[0]?.meta?.total;

  return (
    <section id="for-sale" className="scroll-mt-[var(--shop-tabs-offset,9rem)]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500/15 via-pink-500/15 to-violet-500/15 text-primary">
            <BadgeDollarSign className="h-4 w-4" />
          </span>
          {total != null ? ts("forSaleCount", { count: total }) : ts("forSale")}
        </h2>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-44 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">{t("sortNewest")}</SelectItem>
            <SelectItem value="price_asc">{t("sortPriceAsc")}</SelectItem>
            <SelectItem value="price_desc">{t("sortPriceDesc")}</SelectItem>
            <SelectItem value="mileage_asc">{t("sortMileageAsc")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-2xl border bg-card">
              <div className="aspect-[4/3] bg-muted" />
              <div className="space-y-2 p-3"><div className="h-4 w-3/4 rounded bg-muted" /><div className="h-3 w-1/2 rounded bg-muted" /></div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
            {vehicles.map((v) => <SaleVehicleCard key={v.id} vehicle={v} />)}
          </div>
          {hasNextPage && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="gap-1.5">
                {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
                {ts("showMoreVehicles")}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
