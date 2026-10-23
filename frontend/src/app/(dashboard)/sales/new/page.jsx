"use client";

import { useRouter } from "next/navigation";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { Home } from "lucide-react";
import { SaleForm } from "../SaleForm";

export default function NewSalePage() {
  const router = useRouter();

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard", icon: <Home className="size-4" /> },
    { label: "Sales", href: "/sales" },
    { label: "New Sale" },
  ];

  return (
    <div>
      <PageWrapper childMaxWidth="max-w-4xl" breadcrumb={breadcrumbItems}>
        <SaleForm
          editing={null}
          onSaved={() => router.push("/sales")}
          onCancel={() => router.push("/sales")}
        />
      </PageWrapper>
    </div>
  );
}
