import { ComingSoon } from "@/components/shared/ComingSoon";
import { Star } from "lucide-react";

export default function AccountReviewsPage() {
  return (
    <ComingSoon
      title="My Reviews"
      icon={Star}
      breadcrumbHome="/account/dashboard"
      description="Being migrated to the new customer account system — check back soon."
    />
  );
}
