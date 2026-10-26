import { ComingSoon } from "@/components/shared/ComingSoon";
import { CalendarCheck } from "lucide-react";

export default function AccountBookingDetailPage() {
  return (
    <ComingSoon
      title="Booking Details"
      icon={CalendarCheck}
      breadcrumbHome="/account/dashboard"
      description="Being migrated to the new customer account system — check back soon."
    />
  );
}
