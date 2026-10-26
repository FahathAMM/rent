"use client";

import { useQuery } from "@tanstack/react-query";
import { getIcon } from "@/lib/iconMap";
import { publicService } from "@/services/publicService";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Tag, Home } from "lucide-react";

export default function VendorVehicleCategoriesPage() {
  const { data: categories, isLoading } = useQuery({
    queryKey: ["public-categories"],
    queryFn: () => publicService.categories().then((r) => r.data.data),
  });

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Categories" },
  ];

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems}>
      <p className="mb-4 text-sm text-muted-foreground">
        The marketplace&apos;s vehicle categories — platform-managed. Pick the closest match when listing a vehicle.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !categories?.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
          <div className="rounded-full bg-muted p-4"><Tag className="h-7 w-7 text-muted-foreground" /></div>
          <p className="text-sm font-medium">No categories available yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => {
            const Icon = getIcon(c.icon);
            return (
            <Card key={c.id}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium">{c.name}</p>
                  {c.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{c.description}</p>}
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </HomePageWrapper>
  );
}
