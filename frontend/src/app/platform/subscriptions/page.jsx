"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import platformApi from "@/lib/platformAxios";
import { platformCompanyService } from "@/services/platformService";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Home } from "lucide-react";
import { formatDate } from "@/lib/utils";

const STATUS_VARIANT = { trial: "warning", active: "success", past_due: "warning", cancelled: "secondary", expired: "destructive" };
const STATUSES = ["trial", "active", "past_due", "cancelled", "expired"];

export default function PlatformSubscriptionsPage() {
  const [companyId, setCompanyId] = useState("");
  const [status, setStatus] = useState("");

  const { data: companies } = useQuery({
    queryKey: ["platform-companies-lite"],
    queryFn: () => platformCompanyService.getAll({ per_page: 100 }).then((r) => r.data.record.data),
  });

  const columns = ({ sortField, sortOrder, handleSort }) => [
    {
      accessorKey: "company",
      header: "Company",
      cell: (row) =>
        row.company ? (
          <Link href={`/platform/companies/${row.company.id}`} className="font-medium hover:underline">{row.company.name}</Link>
        ) : (
          "—"
        ),
    },
    {
      accessorKey: "plan",
      header: "Plan",
      cell: (row) => row.plan?.name ?? "—",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: (row) => <Badge variant={STATUS_VARIANT[row.status] ?? "outline"} className="capitalize">{row.status.replace("_", " ")}</Badge>,
    },
    {
      accessorKey: "starts_at",
      header: () => (
        <SortableHeader label="Start Date" column="starts_at" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
      ),
      cell: (row) => <span className="whitespace-nowrap">{formatDate(row.starts_at)}</span>,
    },
    {
      accessorKey: "trial_ends_at",
      header: "Trial Ends",
      cell: (row) => row.trial_ends_at ? <span className="whitespace-nowrap">{formatDate(row.trial_ends_at)}</span> : "—",
    },
    {
      accessorKey: "ends_at",
      header: "Ends",
      cell: (row) => row.ends_at ? <span className="whitespace-nowrap">{formatDate(row.ends_at)}</span> : "—",
    },
  ];

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Subscriptions" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          api={platformApi}
          endpoint="/platform/subscriptions"
          columns={columns}
          breadcrumb={[]}
          defualtSortField="created_at"
          defaultSortOrder="desc"
          filters={{
            company_id: companyId || undefined,
            status: status || undefined,
          }}
        >
          <Select value={companyId || "all"} onValueChange={(v) => setCompanyId(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-full text-sm sm:w-52"><SelectValue placeholder="Company" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All companies</SelectItem>
              {(companies ?? []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-full text-sm sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </ServerDataTable>
      </HomePageWrapper>
    </div>
  );
}
