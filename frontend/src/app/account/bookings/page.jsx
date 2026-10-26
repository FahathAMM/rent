import { ComingSoon } from "@/components/shared/ComingSoon";
import { CalendarCheck } from "lucide-react";

export default function AccountBookingsPage() {
  return (
    <ComingSoon
      title="My Bookings"
      icon={CalendarCheck}
      breadcrumbHome="/account/dashboard"
      description="Being migrated to the new customer account system — check back soon."
    />
  );
}
