import Link from "next/link";
import { Fuel, Gauge, Route, ShieldCheck } from "lucide-react";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { VEHICLE_PLACEHOLDER_IMAGE } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const CONDITION_LABELS = { brand_new: "Brand new", reconditioned: "Reconditioned", used: "Used" };

/** A car on the Buy page — Http\Resources\Public\SaleVehicleResource's shape. */
export function SaleVehicleCard({ vehicle, className }) {
  const { format } = useCurrencyFormat();
  const image = vehicle.images?.find((i) => i.is_primary)?.url ?? vehicle.images?.[0]?.url ?? VEHICLE_PLACEHOLDER_IMAGE;

  return (
    <Link
      href={`/buy/${vehicle.slug}`}
      className={cn("group overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg", className)}
    >
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={vehicle.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        <div className="absolute left-1.5 top-1.5 flex flex-col items-start gap-1 sm:left-2 sm:top-2">
          {vehicle.is_featured && (
            <span className="rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 px-2 py-0.5 text-[9px] font-semibold text-white shadow-sm sm:px-2.5 sm:text-[10px]">Featured</span>
          )}
          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-white sm:px-2.5 sm:text-[10px]">{CONDITION_LABELS[vehicle.condition] ?? vehicle.condition}</span>
        </div>
      </div>
      <div className="space-y-1.5 p-2.5 sm:space-y-2 sm:p-3.5">
        <div>
          <p className="truncate text-[13px] font-semibold leading-tight sm:text-sm">{vehicle.title}</p>
          <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
            {vehicle.shop?.name}
            {vehicle.shop?.is_verified && <ShieldCheck className="ml-1 inline h-3 w-3 text-emerald-600" />}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground sm:gap-x-3 sm:text-xs">
          <span className="flex items-center gap-1"><Route className="h-3.5 w-3.5" />{Number(vehicle.mileage_km ?? 0).toLocaleString()} km</span>
          <span className="flex items-center gap-1 capitalize"><Fuel className="h-3.5 w-3.5" />{vehicle.fuel_type}</span>
          <span className="hidden items-center gap-1 capitalize sm:flex"><Gauge className="h-3.5 w-3.5" />{vehicle.year}</span>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 border-t pt-1.5 sm:pt-2">
          <p className="text-sm font-bold sm:text-base">{format(vehicle.price)}</p>
          {vehicle.is_negotiable && <span className="text-[10px] text-muted-foreground sm:text-xs">Negotiable</span>}
        </div>
      </div>
    </Link>
  );
}
