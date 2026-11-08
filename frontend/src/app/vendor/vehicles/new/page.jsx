"use client";

import { useRouter } from "next/navigation";
import { VehicleForm } from "../components/VehicleForm";
import { VehicleFormPage } from "../components/VehicleFormPage";

export default function NewVehiclePage() {
  const router = useRouter();

  return (
    <VehicleFormPage title="Add Vehicle" subtitle="List a new vehicle for rent.">
      <VehicleForm
        // If pricing or a photo failed after the vehicle was created, land on its edit page to fix it.
        onSaved={(vehicle, { complete }) => router.push(complete ? "/vendor/vehicles" : `/vendor/vehicles/${vehicle.id}/edit`)}
        onCancel={() => router.push("/vendor/vehicles")}
      />
    </VehicleFormPage>
  );
}
