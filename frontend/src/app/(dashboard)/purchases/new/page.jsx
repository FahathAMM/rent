"use client";

import { useRouter } from "next/navigation";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { Home } from "lucide-react";
import { PurchaseForm } from "../PurchaseForm";

export default function NewPurchasePage() {
  const router = useRouter();

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard", icon: <Home className="size-4" /> },
    { label: "Purchases", href: "/purchases" },
    { label: "New Purchase" },
  ];

  return (
    <div>
      <PageWrapper childMaxWidth="max-w-4xl" breadcrumb={breadcrumbItems}>
        <PurchaseForm
          editing={null}
          onSaved={() => router.push("/purchases")}
          onCancel={() => router.push("/purchases")}
        />
      </PageWrapper>
    </div>
  );
}
