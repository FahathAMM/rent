import { ComingSoon } from "@/components/shared/ComingSoon";
import { AlertTriangle } from "lucide-react";

export default function AccountDisputesPage() {
  return (
    <ComingSoon
      title="Disputes"
      icon={AlertTriangle}
      breadcrumbHome="/account/dashboard"
      description="Being migrated to the new customer account system — check back soon."
    />
  );
}
