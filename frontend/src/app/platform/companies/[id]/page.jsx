"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformCompanyService, platformImpersonationService } from "@/services/platformService";
import { usePlatformAuthStore } from "@/store/platformAuthStore";
import { useAuthStore } from "@/store/authStore";
import { startImpersonationBridge } from "@/lib/impersonation";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatDate, formatDateTime, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft, Ban, CheckCircle2, LogIn, Loader2, Building2, Mail, Phone,
  Globe, MapPin, Hash, Users, ScrollText, Home,
} from "lucide-react";

const STATUS_VARIANT = { active: "success", suspended: "destructive", inactive: "secondary", initiate: "warning" };
const STATUS_LABEL = { initiate: "Pending" };
const CAN_ACTIVATE = ["suspended", "initiate"];

const STAT_ITEMS = [
  { key: "users", label: "Users", icon: Users, color: "text-sky-600 bg-sky-50" },
];

const INFO_COLORS = {
  Email: "text-sky-600 bg-sky-50",
  Phone: "text-emerald-600 bg-emerald-50",
  Website: "text-indigo-600 bg-indigo-50",
  TRN: "text-amber-600 bg-amber-50",
  Address: "text-violet-600 bg-violet-50",
  Created: "text-fuchsia-600 bg-fuchsia-50",
};

export default function PlatformCompanyDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const platformToken = usePlatformAuthStore((s) => s.token);
  const admin = usePlatformAuthStore((s) => s.admin);
  const [confirmAction, setConfirmAction] = useState(null); // 'suspend' | 'activate'
  const [impersonateTarget, setImpersonateTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["platform-company", id],
    queryFn: () => platformCompanyService.getOne(id).then((r) => r.data.data),
  });

  const suspend = useMutation({
    mutationFn: () => platformCompanyService.suspend(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["platform-company", id] }); toast.success("Company suspended"); setConfirmAction(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to suspend"),
  });

  const activate = useMutation({
    mutationFn: () => platformCompanyService.activate(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["platform-company", id] }); toast.success("Company activated"); setConfirmAction(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to activate"),
  });

  const impersonate = useMutation({
    mutationFn: (userId) => platformImpersonationService.start(userId),
    onSuccess: (res) => {
      const { token, session_id, user, company } = res.data.data;

      startImpersonationBridge({
        platformToken,
        sessionId: session_id,
        adminName: admin?.name,
        companyName: company?.name,
        userName: user?.name,
      });

      useAuthStore.getState().setAuth(user, token);
      window.location.href = "/dashboard";
    },
    onError: (err) => {
      toast.error(err.response?.data?.message ?? "Failed to start impersonation");
      setImpersonateTarget(null);
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const company = data?.company;
  const users = data?.users ?? [];
  const recentAuditLogs = data?.recent_audit_logs ?? [];

  if (!company) {
    return <div className="py-24 text-center text-muted-foreground">Company not found.</div>;
  }

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Companies", href: "/platform/companies" },
    { label: company.name },
  ];

  return (
    <div>
      <PageWrapper breadcrumb={breadcrumbItems}>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => router.push("/platform/companies")}>
        <ArrowLeft className="h-4 w-4" /> Back to Companies
      </Button>

      <PageHeader
        title={company.name}
        description={company.legal_name}
        action={
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[company.status] ?? "outline"} className="capitalize">{STATUS_LABEL[company.status] ?? company.status}</Badge>
            {CAN_ACTIVATE.includes(company.status) ? (
              <Button size="sm" onClick={() => setConfirmAction("activate")}><CheckCircle2 className="h-4 w-4" /> Activate</Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={() => setConfirmAction("suspend")}><Ban className="h-4 w-4" /> Suspend</Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Company Information</h3>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <InfoRow icon={Mail} label="Email" value={company.email} />
              <InfoRow icon={Phone} label="Phone" value={company.phone} />
              <InfoRow icon={Globe} label="Website" value={company.website} />
              <InfoRow icon={Hash} label="TRN" value={company.trn} />
              <InfoRow icon={MapPin} label="Address" value={[company.address_line_1, company.city, company.emirate, company.country].filter(Boolean).join(", ")} />
              <InfoRow icon={Building2} label="Created" value={formatDate(company.created_at)} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Subscription</h3>
            {company.subscription ? (
              <dl className="space-y-2 text-sm">
                <Row label="Plan" value={company.subscription.plan ?? "—"} />
                <Row label="Status" value={<Badge variant="secondary" className="capitalize">{company.subscription.status}</Badge>} />
                <Row label="Start" value={formatDate(company.subscription.starts_at)} />
                {company.subscription.trial_ends_at && <Row label="Trial ends" value={formatDate(company.subscription.trial_ends_at)} />}
                {company.subscription.ends_at && <Row label="Ends" value={formatDate(company.subscription.ends_at)} />}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">No subscription on record.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_ITEMS.map((s) => (
          <Card key={s.key}>
            <CardContent className="flex flex-col items-center gap-1.5 p-4 text-center">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <p className="text-lg font-bold">{company.stats?.[s.key] ?? 0}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Users ({users.length})</h3>
            <ul className="divide-y">
              {users.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No users yet.</li>}
              {users.map((u) => (
                <li key={u.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">{getInitials(u.name)}</div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{u.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{u.email} {u.roles?.length ? `· ${u.roles.join(", ")}` : ""}</p>
                    </div>
                  </div>
                  <Button
                    size="sm" variant="outline"
                    disabled={!u.is_active}
                    onClick={() => setImpersonateTarget(u)}
                  >
                    <LogIn className="h-3.5 w-3.5" /> Login as
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold"><ScrollText className="h-4 w-4" /> Recent Audit Logs</h3>
              <Link href={`/platform/audit-logs?company_id=${company.id}`} className="text-xs text-primary hover:underline">View all</Link>
            </div>
            <ul className="divide-y">
              {recentAuditLogs.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No audit logs yet.</li>}
              {recentAuditLogs.map((log) => (
                <li key={log.id} className="py-2.5 text-sm">
                  <p>
                    <span className="font-medium">{log.user?.name ?? log.system_admin?.name ?? "System"}</span>{" "}
                    <span className="capitalize text-muted-foreground">{log.action}d</span>{" "}
                    <span className="text-muted-foreground">{log.form}{log.record ? ` — ${log.record}` : ""}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">{formatDateTime(log.created_at)}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      </PageWrapper>

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={() => setConfirmAction(null)}
        title={confirmAction === "suspend" ? "Suspend Company" : "Activate Company"}
        description={confirmAction === "suspend" ? `Suspend "${company.name}"? Its users will lose access until reactivated.` : `Activate "${company.name}"?`}
        confirmText={confirmAction === "suspend" ? "Suspend" : "Activate"}
        variant={confirmAction === "suspend" ? "destructive" : "default"}
        loading={suspend.isPending || activate.isPending}
        onConfirm={() => (confirmAction === "suspend" ? suspend.mutate() : activate.mutate())}
      />

      <ConfirmDialog
        open={!!impersonateTarget}
        onOpenChange={() => setImpersonateTarget(null)}
        title="Login as Company User"
        description={`You'll enter the company application as "${impersonateTarget?.name}" without needing their password. A banner will let you exit back to the Platform at any time.`}
        confirmText="Start Impersonation"
        variant="default"
        loading={impersonate.isPending}
        onConfirm={() => impersonate.mutate(impersonateTarget.id)}
      />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${INFO_COLORS[label] ?? "text-muted-foreground bg-muted"}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="font-medium">{value || "—"}</p>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
