import { ComingSoon } from "@/components/shared/ComingSoon";
import { Users } from "lucide-react";

export default function StaffPage() {
  return (
    <ComingSoon
      title="Staff"
      icon={Users}
      description="Inviting staff and managing their shop-level abilities (shop_members.abilities) lands in a later phase — see app-doc/marketplace/03-permissions-model.md 'Layer 3'."
    />
  );
}
