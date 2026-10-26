import { ComingSoon } from "@/components/shared/ComingSoon";
import { Heart } from "lucide-react";

export default function AccountFavoritesPage() {
  return (
    <ComingSoon
      title="Favorites"
      icon={Heart}
      breadcrumbHome="/account/dashboard"
      description="Being migrated to the new customer account system — check back soon."
    />
  );
}
