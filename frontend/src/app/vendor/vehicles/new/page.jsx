"use client";

import { useRouter } from "next/navigation";
import { VehicleForm } from "@/components/vendor/VehicleForm";
import { VehicleFormPage } from "@/components/vendor/VehicleFormPage";

export default function NewVehiclePage() {
  const router = useRouter();

  return (
    <VehicleFormPage title="Add Vehicle" subtitle="List a new vehicle in your fleet.">
      <VehicleForm
        // If pricing or a photo failed after the vehicle was created, land on its edit page to fix it.
        onSaved={(vehicle, { complete }) => router.push(complete ? "/vendor/vehicles" : `/vendor/vehicles/${vehicle.id}/edit`)}
        onCancel={() => router.push("/vendor/vehicles")}
      />
    </VehicleFormPage>
  );
}
