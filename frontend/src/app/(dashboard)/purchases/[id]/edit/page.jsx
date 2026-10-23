"use client";

import { useRouter, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { purchaseService } from "@/services/purchaseService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { Loader2, Home } from "lucide-react";
import { PurchaseForm } from "../../PurchaseForm";

export default function EditPurchasePage() {
  const router = useRouter();
  const { id } = useParams();

  const { data: purchase, isLoading } = useQuery({
    queryKey: ["purchase", id],
    queryFn: () => purchaseService.getOne(id).then((r) => r.data.data),
  });

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard", icon: <Home className="size-4" /> },
    { label: "Purchases", href: "/purchases" },
    { label: purchase ? `Edit — ${purchase.purchase_number}` : "Edit Purchase" },
  ];

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div>
      <PageWrapper childMaxWidth="max-w-4xl" breadcrumb={breadcrumbItems}>
        <PurchaseForm
          editing={purchase}
          onSaved={() => router.push("/purchases")}
          onCancel={() => router.push("/purchases")}
        />
      </PageWrapper>
    </div>
  );
}
