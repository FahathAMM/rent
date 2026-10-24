import { ComingSoon } from "@/components/shared/ComingSoon";
import { MapPin } from "lucide-react";

export default function LocationsSettingsPage() {
  return (
    <ComingSoon
      title="Locations"
      icon={MapPin}
      description="Managing branches and vehicle pickup points lands in a later phase. The backend model (locations) already exists but has no controller yet."
    />
  );
}
