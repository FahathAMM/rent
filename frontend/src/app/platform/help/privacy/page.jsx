"use client";

import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { HelpItemsManager } from "@/components/platform/HelpItemsManager";
import { ExternalLink, Home } from "lucide-react";

const breadcrumbItems = [
  { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
  { label: "Privacy Policy" },
];

export default function PlatformPrivacyPage() {
  return (
    <PageWrapper breadcrumb={breadcrumbItems}>
      <PageHeader
        title="Privacy Policy"
        description="The clauses on the public Privacy Policy page."
        action={
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            View page <ExternalLink className="h-3.5 w-3.5" />
          </a>
        }
      />

      <HelpItemsManager type="privacy" heading="Clauses" itemName="Clause" titleLabel="Heading" bodyLabel="Text" rich />
    </PageWrapper>
  );
}
