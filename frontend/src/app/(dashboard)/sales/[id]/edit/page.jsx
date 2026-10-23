"use client";

import { useRouter, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { saleService } from "@/services/saleService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { Loader2, Home } from "lucide-react";
import { SaleForm } from "../../SaleForm";

export default function EditSalePage() {
  const router = useRouter();
  const { id } = useParams();

  const { data: sale, isLoading } = useQuery({
    queryKey: ["sale", id],
    queryFn: () => saleService.getOne(id).then((r) => r.data.data),
  });

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard", icon: <Home className="size-4" /> },
    { label: "Sales", href: "/sales" },
    { label: sale ? `Edit — ${sale.sale_number}` : "Edit Sale" },
  ];

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div>
      <PageWrapper childMaxWidth="max-w-4xl" breadcrumb={breadcrumbItems}>
        <SaleForm
          editing={sale}
          onSaved={() => router.push("/sales")}
          onCancel={() => router.push("/sales")}
        />
      </PageWrapper>
    </div>
  );
}
