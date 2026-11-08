"use client";

import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { HelpItemsManager } from "@/components/platform/HelpItemsManager";
import { ExternalLink, Home } from "lucide-react";

const breadcrumbItems = [
  { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
  { label: "Terms & Conditions" },
];

export default function PlatformTermsPage() {
  return (
    <PageWrapper breadcrumb={breadcrumbItems}>
      <PageHeader
        title="Terms & Conditions"
        description="The website's terms on the public Terms & Conditions page. Each shop's rental terms are separate, and shops manage those themselves."
        action={
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            View page <ExternalLink className="h-3.5 w-3.5" />
          </a>
        }
      />

      <HelpItemsManager type="terms" heading="Clauses" itemName="Clause" titleLabel="Heading" bodyLabel="Text" rich />
    </PageWrapper>
  );
}
