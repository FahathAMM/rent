"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowRight, Banknote, CalendarRange, Car, Home, Lock, ShieldAlert, Store } from "lucide-react";
import { platformService } from "@/services/platformService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { cn } from "@/lib/utils";

// Per group key from PlatformReportService::GROUPS.
const GROUP_STYLES = {
  money: { icon: Banknote, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  shops: { icon: Store, tone: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  marketplace: { icon: Car, tone: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  trust: { icon: ShieldAlert, tone: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  system: { icon: Activity, tone: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
};

/** The catalogue of platform reports. The API only lists the ones this admin may open. */
export default function PlatformReportsPage() {
  const { data: groups, isLoading, isError } = useQuery({
    queryKey: ["platform-report-catalogue"],
    queryFn: () => platformService.businessReports.catalogue().then((r) => r.data.data),
    staleTime: 5 * 60_000,
  });

  const breadcrumb = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Reports" },
  ];

  return (
    <PageWrapper breadcrumb={breadcrumb}>
      <PageHeader title="Reports" description="Pick a report to open it. Each one can be searched, sorted and exported to PDF or Excel." />

      {isLoading ? (
        <div className="grid animate-pulse gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading reports">
          {Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted" />)}
        </div>
      ) : isError ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">Could not load the list of reports.</p>
      ) : (
        <div className="space-y-7">
          {groups.map((group) => {
            const style = GROUP_STYLES[group.key] ?? GROUP_STYLES.system;
            const Icon = style.icon;
            return (
              <section key={group.key}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <span className={cn("flex size-7 items-center justify-center rounded-lg", style.tone)}><Icon className="h-4 w-4" /></span>
                  {group.label}
                  <span className="text-xs font-normal text-muted-foreground">{group.reports.length}</span>
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {group.reports.map((report) => (
                    <Link
                      key={report.slug}
                      href={`/platform/reports/${report.slug}`}
                      className="group flex items-start justify-between gap-3 rounded-xl border bg-card p-3.5 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold group-hover:text-primary">{report.title}</p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{report.description}</p>
                        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><CalendarRange className="h-3 w-3" />{report.dated ? "Pick a date range" : "Today's position"}</span>
                          {report.owner_only && <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" />Platform Owner only</span>}
                        </p>
                      </div>
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </PageWrapper>
  );
}
