"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformDashboardService, platformCompanyService } from "@/services/platformService";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import {
  Building2, Users, UserCheck, ShieldAlert, Hourglass, Clock, CheckCircle2, Home,
} from "lucide-react";

const CARDS = [
  { key: "total_companies", label: "Total Companies", icon: Building2, color: "text-indigo-600 bg-indigo-50" },
  { key: "active_companies", label: "Active Companies", icon: UserCheck, color: "text-emerald-600 bg-emerald-50" },
  { key: "pending_companies", label: "Pending Activation", icon: Clock, color: "text-amber-600 bg-amber-50", href: "/platform/companies?status=initiate" },
  { key: "trial_companies", label: "Trial Companies", icon: Hourglass, color: "text-amber-600 bg-amber-50" },
  { key: "suspended_companies", label: "Suspended Companies", icon: ShieldAlert, color: "text-red-600 bg-red-50" },
  { key: "total_users", label: "Total Users", icon: Users, color: "text-sky-600 bg-sky-50" },
];

function StatCard({ label, value, Icon, color, loading, href }) {
  const content = (
    <Card className={href ? "transition-colors hover:bg-muted/40" : undefined}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-xl font-bold tracking-tight">{loading ? "—" : value}</p>
        </div>
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export default function PlatformDashboardPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["platform-dashboard"],
    queryFn: () => platformDashboardService.getSummary().then((r) => r.data.data),
  });

  const activate = useMutation({
    mutationFn: platformCompanyService.activate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-dashboard"] });
      toast.success("Company activated");
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to activate company"),
  });

  const cards = data?.cards ?? {};

  const breadcrumbItems = [
    { label: "Dashboard", icon: <Home className="size-4" /> },
  ];

  return (
    <div>
      <PageWrapper breadcrumb={breadcrumbItems}>
      <PageHeader title="Platform Dashboard" description="Global statistics across every company on the platform." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {CARDS.map((c) => (
          <StatCard
            key={c.key}
            label={c.label}
            Icon={c.icon}
            color={c.color}
            loading={isLoading}
            href={c.href}
            value={c.money ? formatCurrency(cards[c.key]) : (cards[c.key] ?? 0).toLocaleString()}
          />
        ))}
      </div>

      {(data?.pending_activations?.length > 0 || isLoading) && (
        <Card className="mt-6 border-amber-200">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Clock className="h-4 w-4 text-amber-600" /> Pending Activation</h3>
              <Link href="/platform/companies?status=initiate" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            <ul className="divide-y">
              {(data?.pending_activations ?? []).length === 0 && !isLoading && (
                <li className="py-6 text-center text-sm text-muted-foreground">No companies waiting on activation.</li>
              )}
              {(data?.pending_activations ?? []).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/platform/companies/${c.id}`} className="text-sm font-medium hover:underline">{c.name}</Link>
                    <p className="truncate text-xs text-muted-foreground">{c.email ?? "—"} · Signed up {formatDateTime(c.created_at)}</p>
                  </div>
                  <Button size="sm" onClick={() => activate.mutate(c.id)} disabled={activate.isPending} className="shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Activate
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Recent Companies</h3>
            <ul className="divide-y">
              {(data?.recent_companies ?? []).length === 0 && !isLoading && (
                <li className="py-6 text-center text-sm text-muted-foreground">No companies yet.</li>
              )}
              {(data?.recent_companies ?? []).map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2.5">
                  <Link href={`/platform/companies/${c.id}`} className="text-sm font-medium hover:underline">
                    {c.name}
                  </Link>
                  <div className="flex items-center gap-2">
                    <Badge variant={c.status === "active" ? "success" : c.status === "suspended" ? "destructive" : c.status === "initiate" ? "warning" : "secondary"} className="capitalize">
                      {c.status === "initiate" ? "Pending" : c.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(c.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Recent Signups</h3>
            <ul className="divide-y">
              {(data?.recent_signups ?? []).length === 0 && !isLoading && (
                <li className="py-6 text-center text-sm text-muted-foreground">No signups yet.</li>
              )}
              {(data?.recent_signups ?? []).map((s) => (
                <li key={s.id} className="py-2.5">
                  <p className="text-sm font-medium">{s.name} <span className="text-xs font-normal text-muted-foreground">— {s.email}</span></p>
                  <p className="text-xs text-muted-foreground">
                    <Link href={`/platform/companies/${s.company_id}`} className="hover:underline">{s.company_name}</Link>
                    {" · "}{formatDateTime(s.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Subscription Overview</h3>
            <ul className="space-y-2">
              {Object.entries(data?.subscription_overview ?? {}).length === 0 && !isLoading && (
                <li className="py-6 text-center text-sm text-muted-foreground">No subscriptions yet.</li>
              )}
              {Object.entries(data?.subscription_overview ?? {}).map(([status, count]) => (
                <li key={status} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-muted-foreground">{status}</span>
                  <span className="font-semibold">{count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      </PageWrapper>
    </div>
  );
}
