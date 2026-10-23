"use client";

import { useMemo, useState } from "react";
import { notFound, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import { reportService } from "@/services/reportService";
import { vendorService } from "@/services/vendorService";
import { customerService } from "@/services/customerService";
import { expenseCategoryService } from "@/services/expenseCategoryService";
import { itemService } from "@/services/itemService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/forms/SelectInput";
import { DatePicker } from "@/components/forms/DatePicker";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Home, FileBarChart, Download, FileSpreadsheet, FileText, ListOrdered } from "lucide-react";
import { downloadBlob } from "@/lib/utils";
import { reportTypeConfig } from "../reportTypes";

export default function ReportTypePage() {
  const { type } = useParams();
  const config = reportTypeConfig(type);
  if (!config) notFound();

  const [vendorFilter, setVendorFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [groupBy, setGroupBy] = useState("day");
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [exporting, setExporting] = useState(null);
  const [itemsDialog, setItemsDialog] = useState({ open: false, items: [] });

  const { data: vendors } = useQuery({
    queryKey: ["vendors-lite"],
    queryFn: () => vendorService.getAll({ perPage: 100 }).then((r) => r.data.record.data),
    enabled: type === "purchases" || type === "outstanding_purchases",
  });

  const { data: customers } = useQuery({
    queryKey: ["customers-lite"],
    queryFn: () => customerService.getAll({ perPage: 100 }).then((r) => r.data.record.data),
    enabled: type === "sales" || type === "outstanding_sales" || type === "customer_ledger",
  });

  const { data: items } = useQuery({
    queryKey: ["items-lite"],
    queryFn: () => itemService.getAll({ perPage: 200 }).then((r) => r.data.record.data),
    enabled: type === "sales" || type === "item_sales" || type === "profit_margin",
  });

  const { data: categories } = useQuery({
    queryKey: ["expense-categories-lite"],
    queryFn: () => expenseCategoryService.getAll({ perPage: 100 }).then((r) => r.data.record.data),
    enabled: type === "expenses" || type === "expense_by_category",
  });

  const noDateRange = type === "outstanding_purchases" || type === "outstanding_sales";
  const hasGroupBy = type === "daily_sales" || type === "expense_by_category";

  const filters = useMemo(() => ({
    vendor_id: (type === "purchases" || type === "outstanding_purchases") ? vendorFilter || undefined : undefined,
    customer_id: (type === "sales" || type === "outstanding_sales" || type === "customer_ledger") ? customerFilter || undefined : undefined,
    item_id: (type === "sales" || type === "item_sales" || type === "profit_margin") ? itemFilter || undefined : undefined,
    category_id: (type === "expenses" || type === "expense_by_category") ? categoryFilter || undefined : undefined,
    group_by: hasGroupBy ? groupBy : undefined,
    date_from: !noDateRange ? dateFrom || undefined : undefined,
    date_to: !noDateRange ? dateTo || undefined : undefined,
  }), [type, vendorFilter, customerFilter, itemFilter, categoryFilter, groupBy, hasGroupBy, dateFrom, dateTo, noDateRange]);

  const { data: report, isLoading } = useQuery({
    queryKey: ["report", type, filters],
    queryFn: () => reportService.get(type, filters).then((r) => r.data.data),
  });

  const handleExport = async (format) => {
    setExporting(format);
    try {
      const res = await reportService.export(type, format, filters);
      downloadBlob(res.data, `${type}-${new Date().toISOString().slice(0, 10)}.${format}`);
    } catch {
      toast.error(`Failed to export as ${format.toUpperCase()}`);
    } finally {
      setExporting(null);
    }
  };

  const vendorOptions = [{ value: "", label: "All vendors" }, ...(vendors ?? []).map((v) => ({ value: String(v.id), label: v.name }))];
  const customerOptions = [{ value: "", label: "All customers" }, ...(customers ?? []).map((c) => ({ value: String(c.id), label: c.name }))];
  const itemOptions = [{ value: "", label: "All items" }, ...(items ?? []).map((i) => ({ value: String(i.id), label: i.name }))];
  const categoryOptions = [{ value: "", label: "All categories" }, ...(categories ?? []).map((c) => ({ value: String(c.id), label: c.name }))];
  const groupByOptions = [{ value: "day", label: "Daily" }, { value: "month", label: "Monthly" }];

  const columns = report?.columns ?? [];
  const rows = report?.rows ?? [];

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard", icon: <Home className="size-4" /> },
    { label: "Reports" },
    { label: config.label },
  ];

  return (
    <PageWrapper breadcrumb={breadcrumbItems} maxWidth="max-w-7xl">
      <PageHeader
        title={report?.title ?? config.label}
        description={config.description}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={!!exporting || rows.length === 0} onClick={() => handleExport("csv")}>
              <Download className="h-3.5 w-3.5" /> {exporting === "csv" ? "Exporting..." : "CSV"}
            </Button>
            <Button size="sm" variant="outline" disabled={!!exporting || rows.length === 0} onClick={() => handleExport("xlsx")}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> {exporting === "xlsx" ? "Exporting..." : "Excel"}
            </Button>
            <Button size="sm" variant="outline" disabled={!!exporting || rows.length === 0} onClick={() => handleExport("pdf")}>
              <FileText className="h-3.5 w-3.5" /> {exporting === "pdf" ? "Exporting..." : "PDF"}
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          {(type === "purchases" || type === "outstanding_purchases") && (
            <SelectInput value={vendorFilter} onChange={setVendorFilter} options={vendorOptions} placeholder="Vendor" triggerClassName="h-8 w-44 text-xs" />
          )}
          {(type === "sales" || type === "outstanding_sales" || type === "customer_ledger") && (
            <SelectInput value={customerFilter} onChange={setCustomerFilter} options={customerOptions} placeholder="Customer" triggerClassName="h-8 w-44 text-xs" />
          )}
          {(type === "sales" || type === "item_sales" || type === "profit_margin") && (
            <SelectInput value={itemFilter} onChange={setItemFilter} options={itemOptions} placeholder="Item" triggerClassName="h-8 w-44 text-xs" />
          )}
          {(type === "expenses" || type === "expense_by_category") && (
            <SelectInput value={categoryFilter} onChange={setCategoryFilter} options={categoryOptions} placeholder="Category" triggerClassName="h-8 w-44 text-xs" />
          )}
          {hasGroupBy && (
            <SelectInput value={groupBy} onChange={setGroupBy} options={groupByOptions} placeholder="Group By" triggerClassName="h-8 w-32 text-xs" />
          )}
          {!noDateRange && (
            <>
              <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="From" className="w-36" />
              <DatePicker value={dateTo} onChange={setDateTo} placeholder="To" className="w-36" />
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-0">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <FileBarChart className="h-8 w-8 opacity-40" />
              <p className="text-sm font-medium">No records found</p>
              <p className="text-xs opacity-70">Try adjusting the filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col} className="whitespace-nowrap text-xs">{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      {columns.map((col) => {
                        if (col === "Items") {
                          const items = (row[col] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
                          return (
                            <TableCell key={col} className="whitespace-nowrap text-xs">
                              {items.length === 0 ? (
                                "—"
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 gap-1 px-2 text-xs"
                                  onClick={() => setItemsDialog({ open: true, items })}
                                >
                                  <ListOrdered className="h-3 w-3" />
                                  {items.length} item{items.length > 1 ? "s" : ""}
                                </Button>
                              )}
                            </TableCell>
                          );
                        }
                        return (
                          <TableCell key={col} className="whitespace-nowrap text-xs">{row[col] ?? "—"}</TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={itemsDialog.open} onOpenChange={(open) => setItemsDialog((s) => ({ ...s, open }))}>
        <DialogContent className="max-w-xs gap-0 overflow-hidden rounded-2xl p-0 shadow-xl">
          <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ListOrdered className="h-4 w-4" />
            </span>
            <div className="space-y-0.5">
              <DialogTitle className="text-sm">Sale Items</DialogTitle>
              <DialogDescription className="text-xs">
                {itemsDialog.items.length} item{itemsDialog.items.length > 1 ? "s" : ""} in this sale
              </DialogDescription>
            </div>
          </DialogHeader>
          <ul className="max-h-64 overflow-y-auto px-3 py-2">
            {itemsDialog.items.map((name, idx) => (
              <li
                key={idx}
                className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted/60"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
                  {idx + 1}
                </span>
                <span className="truncate font-medium">{name}</span>
              </li>
            ))}
          </ul>
          <DialogFooter className="border-t bg-muted/30 px-5 py-3">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm" className="rounded-lg">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
