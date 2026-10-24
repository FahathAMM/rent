import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { Home } from "lucide-react";

/**
 * A page whose nav tile and backend route exist, but whose business
 * logic is a later phase — see app-doc/marketplace/06-plan-and-risks.md
 * steps 5-11. Keeps every link in the vendor/account nav tree resolving
 * to a real page instead of a 404 while that logic is built.
 */
export function ComingSoon({ title, description, breadcrumbHome = "/vendor/dashboard", icon: Icon }) {
  const breadcrumbItems = [
    { label: "Home", href: breadcrumbHome, icon: <Home className="size-4" /> },
    { label: title },
  ];

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems}>
      <PageHeader title={title} />
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
        {Icon && (
          <div className="rounded-full bg-muted p-4">
            <Icon className="h-7 w-7 text-muted-foreground" />
          </div>
        )}
        <p className="text-sm font-medium">Coming soon</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {description ?? "This page is part of a later build phase and isn't functional yet."}
        </p>
      </div>
    </HomePageWrapper>
  );
}
