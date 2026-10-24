import Link from "next/link";
import { Car, Users, Fuel, Gauge, ShieldCheck } from "lucide-react";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";

/** A single vehicle tile for the public search grid and homepage — Http\Resources\Public\VehicleResource's shape. */
export function VehicleCard({ vehicle }) {
  const { format } = useCurrencyFormat();
  const image = vehicle.images?.find((i) => i.is_primary)?.url ?? vehicle.images?.[0]?.url ?? null;

  return (
    <Link
      href={`/vehicles/${vehicle.slug}`}
      className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
    >
      <div className="relative flex aspect-[4/3] items-center justify-center bg-muted">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={vehicle.title} className="h-full w-full object-cover" />
        ) : (
          <Car className="h-10 w-10 text-muted-foreground/40" />
        )}
        {vehicle.is_featured && (
          <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            Featured
          </span>
        )}
      </div>
      <div className="space-y-2 p-3">
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
        <div className="flex items-baseline justify-between pt-1">
          <p className="text-base font-bold">
            {format ? format(vehicle.pricing?.daily_rate) : `LKR ${vehicle.pricing?.daily_rate ?? "—"}`}
            <span className="text-xs font-normal text-muted-foreground">/day</span>
          </p>
          {vehicle.rating_count > 0 && (
            <p className="text-xs text-muted-foreground">★ {Number(vehicle.rating_avg).toFixed(1)} ({vehicle.rating_count})</p>
          )}
        </div>
      </div>
    </Link>
  );
}
