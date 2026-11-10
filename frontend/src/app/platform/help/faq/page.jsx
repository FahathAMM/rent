"use client";

import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { HelpItemsManager } from "@/components/platform/HelpItemsManager";
import { ExternalLink, Home } from "lucide-react";

const breadcrumbItems = [
  { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
  { label: "FAQ" },
];

export default function PlatformFaqPage() {
  return (
    <PageWrapper breadcrumb={breadcrumbItems}>
      <PageHeader
        title="FAQ"
        description="The questions and answers on the public FAQ page."
        action={
          <a href="/faq" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            View page <ExternalLink className="h-3.5 w-3.5" />
          </a>
        }
      />

      <HelpItemsManager type="faq" heading="Questions" itemName="Question" titleLabel="Question" bodyLabel="Answer" sectionLabel="Section" />
    </PageWrapper>
  );
}
