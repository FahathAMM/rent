"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { VehicleForm } from "@/app/vendor/vehicles/components/VehicleForm";
import { VehicleFormPage } from "@/app/vendor/vehicles/components/VehicleFormPage";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function EditSaleListingPage() {
  const { id } = useParams();
  const router = useRouter();

  const { data: vehicle, isLoading, isError } = useQuery({
    queryKey: ["vendor-sale-listing", id],
    queryFn: () => vendorService.sales.listings.getOne(id).then((r) => r.data.data),
    retry: false,
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (isError || !vehicle) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <p className="text-lg font-semibold">Listing not found</p>
        <p className="text-sm text-muted-foreground">It may have been deleted, or it belongs to another shop.</p>
        <Button asChild variant="outline"><Link href="/vendor/sales/listings">Back to listings</Link></Button>
      </div>
    );
  }

  const back = () => router.push("/vendor/sales/listings");

  return (
    <VehicleFormPage title={`Edit ${vehicle.title}`} subtitle={`${vehicle.make ?? ""} ${vehicle.model ?? ""} · ${vehicle.year ?? ""}`.trim()} vehicle={vehicle} listingType="sale">
      <VehicleForm key={vehicle.id} vehicle={vehicle} listingType="sale" onSaved={back} onCancel={back} />
    </VehicleFormPage>
  );
}
