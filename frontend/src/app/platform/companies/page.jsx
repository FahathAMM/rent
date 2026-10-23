"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformCompanyService } from "@/services/platformService";
import { useTableParams } from "@/hooks/useTableParams";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Pagination } from "@/components/shared/Pagination";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, MoreVertical, Eye, Ban, CheckCircle2, Activity, Home, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

const STATUS_VARIANT = { active: "success", suspended: "destructive", inactive: "secondary", initiate: "warning" };
const STATUS_LABEL = { initiate: "Pending" };
const CAN_ACTIVATE = ["suspended", "initiate"];

export default function PlatformCompaniesPage() {
  const { search, page, perPage, sortKey, sortDir, setSearch, setPage, setPerPage, toggleSort } = useTableParams({ defaultPerPage: 15 });
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [subscriptionStatus, setSubscriptionStatus] = useState("");
  const [confirmTarget, setConfirmTarget] = useState(null); // { company, action }
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["platform-companies", { search, page, perPage, sortKey, sortDir, status, subscriptionStatus }],
    queryFn: () =>
      platformCompanyService
        .getAll({
          search, page, per_page: perPage,
          sort: sortKey || undefined, dir: sortDir,
          status: status || undefined,
          subscription_status: subscriptionStatus || undefined,
        })
        .then((r) => r.data.record),
    placeholderData: (prev) => prev,
  });

  const suspend = useMutation({
    mutationFn: platformCompanyService.suspend,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-companies"] });
      toast.success("Company suspended");
      setConfirmTarget(null);
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to suspend company"),
  });

  const activate = useMutation({
    mutationFn: platformCompanyService.activate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-companies"] });
      toast.success("Company activated");
      setConfirmTarget(null);
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to activate company"),
  });

  const columns = [
    {
      key: "name", header: "Company", sortable: true,
      render: (row) => (
        <div>
          <Link href={`/platform/companies/${row.id}`} className="font-medium hover:underline">{row.name}</Link>
          {row.email && <p className="text-[11px] text-muted-foreground">{row.email}</p>}
        </div>
      ),
    },
    { key: "status", header: "Status", sortable: true, render: (row) => <Badge variant={STATUS_VARIANT[row.status] ?? "outline"} className="capitalize">{STATUS_LABEL[row.status] ?? row.status}</Badge> },
    { key: "users_count", header: "Users", render: (row) => row.users_count ?? 0 },
    { key: "customers_count", header: "Customers", render: (row) => row.customers_count ?? 0 },
    { key: "invoices_count", header: "Invoices", render: (row) => row.invoices_count ?? 0 },
    {
      key: "subscription", header: "Subscription",
      render: (row) => row.latest_subscription
        ? <div><p className="font-medium capitalize">{row.latest_subscription.plan?.name ?? "—"}</p><p className="text-[11px] capitalize text-muted-foreground">{row.latest_subscription.status}</p></div>
        : <span className="text-muted-foreground">—</span>,
    },
    { key: "created_at", header: "Created", sortable: true, render: (row) => formatDate(row.created_at) },
    {
      key: "actions", header: "Actions",
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild><Link href={`/platform/companies/${row.id}`}><Eye className="h-4 w-4" /> View / Manage</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href={`/platform/activity?company_id=${row.id}`}><Activity className="h-4 w-4" /> View Activity</Link></DropdownMenuItem>
            {CAN_ACTIVATE.includes(row.status) ? (
              <DropdownMenuItem onClick={() => setConfirmTarget({ company: row, action: "activate" })}>
                <CheckCircle2 className="h-4 w-4" /> Activate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => setConfirmTarget({ company: row, action: "suspend" })} className="text-destructive focus:text-destructive">
                <Ban className="h-4 w-4" /> Suspend
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Companies" },
  ];

  return (
    <div>
      <PageWrapper breadcrumb={breadcrumbItems}>
        <PageHeader
          title="Companies"
          description="Every company on the platform, across every tenant."
          action={<Button asChild><Link href="/platform/companies/new"><Plus className="h-4 w-4" /> New Company</Link></Button>}
        />

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search companies..." className="h-8 pl-8 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={status || "all"} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-8 w-full text-sm sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="initiate">Pending</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <Select value={subscriptionStatus || "all"} onValueChange={(v) => { setSubscriptionStatus(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="h-8 w-full text-sm sm:w-48"><SelectValue placeholder="Subscription" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subscriptions</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="past_due">Past due</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} search={search} />
        <Pagination meta={data} onPageChange={setPage} perPage={perPage} onPerPageChange={setPerPage} />
      </PageWrapper>

      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={() => setConfirmTarget(null)}
        title={confirmTarget?.action === "suspend" ? "Suspend Company" : "Activate Company"}
        description={
          confirmTarget?.action === "suspend"
            ? `Suspend "${confirmTarget?.company.name}"? Its users will lose access until reactivated.`
            : confirmTarget?.company.status === "initiate"
              ? `Activate "${confirmTarget?.company.name}"? Its users will be able to sign in immediately.`
              : `Activate "${confirmTarget?.company.name}"? Its users will regain access immediately.`
        }
        confirmText={confirmTarget?.action === "suspend" ? "Suspend" : "Activate"}
        variant={confirmTarget?.action === "suspend" ? "destructive" : "default"}
        loading={suspend.isPending || activate.isPending}
        onConfirm={() =>
          confirmTarget?.action === "suspend"
            ? suspend.mutate(confirmTarget.company.id)
            : activate.mutate(confirmTarget.company.id)
        }
      />
    </div>
  );
}
