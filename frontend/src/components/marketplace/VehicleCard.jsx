import Link from "next/link";
import { Users, Fuel, Gauge, ShieldCheck } from "lucide-react";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { VEHICLE_PLACEHOLDER_IMAGE } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** A single vehicle tile for the public search grid and homepage — Http\Resources\Public\VehicleResource's shape. */
export function VehicleCard({ vehicle, className }) {
  const { format } = useCurrencyFormat();
  const image = vehicle.images?.find((i) => i.is_primary)?.url ?? vehicle.images?.[0]?.url ?? VEHICLE_PLACEHOLDER_IMAGE;

  return (
    <Link
      href={`/vehicles/${vehicle.slug}`}
      className={cn(
        "group overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg",
        className
      )}
    >
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={vehicle.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        {vehicle.is_featured && (
          <span className="absolute left-2 top-2 rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 px-2.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            Featured
          </span>
        )}
      </div>
      <div className="space-y-2 p-3.5">
        <div>
          <p className="truncate text-sm font-semibold leading-tight">{vehicle.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {vehicle.shop?.name}
            {vehicle.shop?.is_verified && <ShieldCheck className="ml-1 inline h-3 w-3 text-emerald-600" />}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{vehicle.seating_capacity}</span>
          <span className="flex items-center gap-1 capitalize"><Fuel className="h-3.5 w-3.5" />{vehicle.fuel_type}</span>
          <span className="flex items-center gap-1 capitalize"><Gauge className="h-3.5 w-3.5" />{vehicle.transmission}</span>
        </div>
        <div className="flex items-baseline justify-between border-t pt-2">
          <p className="text-base font-bold">
            {format ? format(vehicle.pricing?.daily_rate) : `LKR ${vehicle.pricing?.daily_rate ?? "—"}`}
            <span className="text-xs font-normal text-muted-foreground">/day</span>
          </p>
          {vehicle.rating_count > 0 && (
            <p className="flex items-center gap-0.5 text-xs text-muted-foreground">★ {Number(vehicle.rating_avg).toFixed(1)} ({vehicle.rating_count})</p>
          )}
        </div>
      </div>
    </Link>
  );
}
