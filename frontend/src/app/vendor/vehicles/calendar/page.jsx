import { ComingSoon } from "@/components/shared/ComingSoon";
import { CalendarRange } from "lucide-react";

export default function VehicleCalendarPage() {
  return (
    <ComingSoon
      title="Calendar"
      icon={CalendarRange}
      description="The all-vehicle availability calendar lands alongside the booking lifecycle in a later phase."
    />
  );
}
