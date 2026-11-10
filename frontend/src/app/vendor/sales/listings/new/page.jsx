"use client";

import { useRouter } from "next/navigation";
import { VehicleForm } from "@/app/vendor/vehicles/components/VehicleForm";
import { VehicleFormPage } from "@/app/vendor/vehicles/components/VehicleFormPage";

export default function NewSaleListingPage() {
  const router = useRouter();

  return (
    <VehicleFormPage title="Add Sale Listing" subtitle="List a vehicle for sale." listingType="sale">
      <VehicleForm
        listingType="sale"
        onSaved={(vehicle, { complete }) => router.push(complete ? "/vendor/sales/listings" : `/vendor/sales/listings/${vehicle.id}/edit`)}
        onCancel={() => router.push("/vendor/sales/listings")}
      />
    </VehicleFormPage>
  );
}
