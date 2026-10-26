import { CustomerProfileForm } from "@/components/account/CustomerProfileForm";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { User } from "lucide-react";

export default function AccountProfilePage() {
  return (
    <div className="space-y-4">
      <AccountPageHeader icon={User} title="Profile" description="Your details and account security" />
      <CustomerProfileForm />
    </div>
  );
}
