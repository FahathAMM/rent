"use client";

import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { formatDateTime } from "@/lib/utils";
import { Eye, Home } from "lucide-react";

export default function SoldVehiclesPage() {
  const { format } = useCurrencyFormat();

  const columns = () => [
    {
      accessorKey: "reference",
      header: "Sale",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.vehicle?.title ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{row.reference}</p>
        </div>
      ),
    },
    { accessorKey: "buyer_name", header: "Buyer" },
    { accessorKey: "sale_price", header: "Sale price", cell: (row) => format(row.sale_price) },
    { accessorKey: "sold_at", header: "Sold", cell: (row) => formatDateTime(row.sold_at) },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: (row) => <ActionButton href={`/vendor/sales/sold/${row.reference}`} icon={Eye} label="View sale" className="text-sky-700 border-sky-300 hover:text-sky-800 hover:bg-sky-50 hover:border-sky-400" />,
    },
  ];

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Sales" },
    { label: "Sold" },
  ];

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems}>
      <ServerDataTable endpoint="/vendor/sales/sold" columns={columns} breadcrumb={[]} />
    </HomePageWrapper>
  );
}
