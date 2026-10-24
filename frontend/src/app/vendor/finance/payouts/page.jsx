import { ComingSoon } from "@/components/shared/ComingSoon";
import { Banknote } from "lucide-react";

export default function PayoutsPage() {
  return (
    <ComingSoon
      title="Payouts"
      icon={Banknote}
      description="The manual settlement/payout workflow lands in a later phase — see app-doc/marketplace/04-lifecycles.md 'Payout cycle'."
    />
  );
}
