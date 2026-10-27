"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { vehicleService } from "@/services/vehicleService";
import { VehicleForm } from "@/components/vendor/VehicleForm";
import { VehicleFormPage } from "@/components/vendor/VehicleFormPage";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function EditVehiclePage() {
  const { id } = useParams();
  const router = useRouter();

  const { data: vehicle, isLoading, isError } = useQuery({
    queryKey: ["vendor-vehicle", id],
    queryFn: () => vehicleService.getOne(id).then((r) => r.data.data),
    retry: false,
  });

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (isError || !vehicle) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <p className="text-lg font-semibold">Vehicle not found</p>
        <p className="text-sm text-muted-foreground">It may have been deleted, or it belongs to another shop.</p>
        <Button asChild variant="outline"><Link href="/vendor/vehicles">Back to vehicles</Link></Button>
      </div>
    );
  }

  return (
    <VehicleFormPage title={`Edit ${vehicle.title}`} subtitle={`${vehicle.make ?? ""} ${vehicle.model ?? ""} · ${vehicle.year ?? ""}`.trim()} vehicle={vehicle}>
      {/* key: remount with fresh form state if a different vehicle loads into the same page */}
      <VehicleForm key={vehicle.id} vehicle={vehicle} onSaved={() => router.push("/vendor/vehicles")} onCancel={() => router.push("/vendor/vehicles")} />
    </VehicleFormPage>
  );
}
