import { ComingSoon } from "@/components/shared/ComingSoon";
import { CalendarCheck } from "lucide-react";

export default function VendorBookingsPage() {
  return (
    <ComingSoon
      title="Bookings"
      icon={CalendarCheck}
      description="Booking requests, accept/reject decisions and the payment lifecycle land in a later phase — see app-doc/marketplace/04-lifecycles.md."
    />
  );
}
