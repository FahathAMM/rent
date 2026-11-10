"use client";

import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { HelpItemsManager } from "@/components/platform/HelpItemsManager";
import { ExternalLink, Home } from "lucide-react";

const breadcrumbItems = [
  { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
  { label: "Stay Safe" },
];

export default function PlatformStaySafePage() {
  return (
    <PageWrapper breadcrumb={breadcrumbItems}>
      <PageHeader
        title="Stay Safe"
        description="The safety advice on the public Stay safe page."
        action={
          <a href="/stay-safe" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            View page <ExternalLink className="h-3.5 w-3.5" />
          </a>
        }
      />

      <div className="space-y-10">
        <HelpItemsManager type="safety_tip" heading="Safety tips" itemName="Tip" titleLabel="Tip" sectionLabel="Section" />
        <HelpItemsManager type="warning_sign" heading="Warning signs" itemName="Warning sign" titleLabel="Warning sign" />
        <HelpItemsManager type="emergency_contact" heading="Emergency numbers" itemName="Number" titleLabel="Service" bodyLabel="Phone number" shortBody />
      </div>
    </PageWrapper>
  );
}
