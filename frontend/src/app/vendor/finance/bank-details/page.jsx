import { ComingSoon } from "@/components/shared/ComingSoon";
import { Landmark } from "lucide-react";

export default function BankDetailsPage() {
  return (
    <ComingSoon
      title="Bank Details"
      icon={Landmark}
      description="Payout destination management lands alongside the payout workflow in a later phase. Only the shop's owner role will be able to view or change this."
    />
  );
}
