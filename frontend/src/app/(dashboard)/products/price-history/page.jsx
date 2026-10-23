"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { itemService } from "@/services/itemService";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { SelectInput } from "@/components/forms/SelectInput";
import { DatePicker } from "@/components/forms/DatePicker";
import { Button } from "@/components/ui/button";
import { Home, X } from "lucide-react";

export default function PriceHistoryPage() {
  const [itemId, setItemId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: items } = useQuery({
    queryKey: ["items-lite"],
    queryFn: () => itemService.getAll({ perPage: 200 }).then((r) => r.data.record.data),
  });

  const itemOptions = (items ?? []).map((i) => ({ value: String(i.id), label: i.name }));
  const hasFilters = itemId || from || to;

  const columns = ({ sortField, sortOrder, handleSort }) => [
    {
      accessorKey: "price_date",
      header: () => <SortableHeader label="Date" column="price_date" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => format(parseISO(row.price_date), "dd MMM yyyy"),
    },
    {
      accessorKey: "item",
      header: "Product",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.item?.name ?? "—"}</p>
          {row.item?.category && <p className="text-[10px] text-muted-foreground">{row.item.category}</p>}
        </div>
      ),
    },
    {
      accessorKey: "purchase_price",
      header: "Purchase Price",
      cell: (row) => (row.purchase_price != null ? Number(row.purchase_price).toFixed(2) : "—"),
    },
    {
      accessorKey: "selling_price",
      header: "Selling Price",
      cell: (row) => (row.selling_price != null ? Number(row.selling_price).toFixed(2) : "—"),
    },
    {
      accessorKey: "margin",
      header: "Margin",
      cell: (row) =>
        row.purchase_price != null && row.selling_price != null
          ? (Number(row.selling_price) - Number(row.purchase_price)).toFixed(2)
          : "—",
    },
  ];

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard", icon: <Home className="size-4" /> },
    { label: "Products", href: "/products" },
    { label: "Price History" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          endpoint="/item-daily-prices"
          columns={columns}
          breadcrumb={[]}
          defualtSortField="price_date"
          defaultSortOrder="desc"
          model="Price entry"
          filters={{ item_id: itemId || undefined, from: from || undefined, to: to || undefined }}
        >
          <SelectInput
            value={itemId}
            onChange={setItemId}
            options={itemOptions}
            placeholder="All products"
            triggerClassName="h-8 w-44 text-xs"
          />
          <DatePicker value={from} onChange={setFrom} placeholder="From date" className="w-36" />
          <DatePicker value={to} onChange={setTo} placeholder="To date" className="w-36" />
          {hasFilters && (
            <Button
              variant="ghost"
              className="h-8 gap-1 text-xs text-muted-foreground"
              onClick={() => {
                setItemId("");
                setFrom("");
                setTo("");
              }}
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </ServerDataTable>
      </HomePageWrapper>
    </div>
  );
}
