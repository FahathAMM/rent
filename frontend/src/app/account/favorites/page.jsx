"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { favoriteService } from "@/services/favoriteService";
import { VehicleCard } from "@/components/marketplace/VehicleCard";
import { Button } from "@/components/ui/button";
import { Heart, Loader2, X } from "lucide-react";
import { toast } from "sonner";

export default function FavoritesPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-favorites"],
    queryFn: () => favoriteService.getAll().then((r) => r.data),
  });

  const remove = useMutation({
    mutationFn: (vehicleId) => favoriteService.remove(vehicleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-favorites"] });
      toast.success("Removed from favorites");
    },
  });

  const favorites = data?.data ?? [];

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Favorites</h1>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !favorites.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
          <div className="rounded-full bg-muted p-4"><Heart className="h-7 w-7 text-muted-foreground" /></div>
          <p className="text-sm font-medium">No favorites yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">Tap the heart on a vehicle to save it here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((f) => f.vehicle && (
            <div key={f.id} className="relative">
              <VehicleCard vehicle={f.vehicle} />
              <Button
                size="icon"
                variant="secondary"
                className="absolute right-2 top-2 h-7 w-7 rounded-full shadow"
                onClick={() => remove.mutate(f.vehicle.id)}
                disabled={remove.isPending}
                title="Remove from favorites"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
