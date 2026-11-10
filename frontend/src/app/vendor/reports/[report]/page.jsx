"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  endOfMonth,
  format as formatDay,
  startOfMonth,
  startOfYear,
  subMonths,
} from "date-fns";
import { vendorService } from "@/services/vendorService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { DateRangePicker } from "@/components/forms/DateRangePicker";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, downloadBlob, formatDate } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  FileDown,
  FileSpreadsheet,
  Hash,
  Home,
  Info,
  Loader2,
  Percent,
  Search,
  SearchX,
  Tag,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

const RIGHT_ALIGNED = ["money", "number", "percent"];
const TILE_ICONS = { money: Wallet, number: Hash, percent: Percent, text: Tag };
const TILE_TONES = [
  "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
];

const day = (date) => formatDay(date, "yyyy-MM-dd");

const PRESETS = [
  {
    label: "Today",
    range: () => ({ from: day(new Date()), to: day(new Date()) }),
  },
  {
    label: "This month",
    range: () => ({ from: day(startOfMonth(new Date())), to: day(new Date()) }),
  },
  {
    label: "Last month",
    range: () => ({
      from: day(startOfMonth(subMonths(new Date(), 1))),
      to: day(endOfMonth(subMonths(new Date(), 1))),
    }),
  },
  {
    label: "This year",
    range: () => ({ from: day(startOfYear(new Date())), to: day(new Date()) }),
  },
];

// Which reports' `reference` column opens what.
const REFERENCE_LINKS = {
  bookings: "/vendor/bookings/",
  outstanding: "/vendor/bookings/",
  cancellations: "/vendor/bookings/",
  payments: "/vendor/bookings/",
  deposits: "/vendor/bookings/",
  damage: "/vendor/bookings/",
  schedule: "/vendor/bookings/",
  sales: "/vendor/sales/sold/",
};

/** Blank values last, whichever way the column is sorted. */
function compare(a, b, numeric, direction) {
  const blank = (v) => v === null || v === undefined || v === "";
  if (blank(a) || blank(b)) return blank(a) - blank(b);
  const order = numeric
    ? Number(a) - Number(b)
    : String(a).localeCompare(String(b));
  return direction === "asc" ? order : -order;
}

function LoadingState() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Loading report">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[62px] rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-72 rounded-xl bg-muted" />
    </div>
  );
}

/** Every report has one shape from the API (see ShopReportService), so this page serves them all. */
export default function VendorReportPage() {
  const { report } = useParams();

  // Keyed so search, sort and dates start fresh when switching reports.
  return <ReportView key={report} report={report} />;
}

function ReportView({ report }) {
  const { format } = useCurrencyFormat();
  const [dateRange, setDateRange] = useState(() => PRESETS[3].range());
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(null); // { key, direction }
  const [exporting, setExporting] = useState(null);
  const params = {
    from: dateRange.from || undefined,
    to: dateRange.to || undefined,
  };

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["vendor-report", report, params],
    queryFn: () =>
      vendorService.reports.get(report, params).then((r) => r.data.data),
    placeholderData: keepPreviousData,
    retry: false,
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const found = !term
      ? (data?.rows ?? [])
      : data.rows.filter((row) =>
          Object.values(row).some((v) =>
            String(v ?? "")
              .toLowerCase()
              .includes(term),
          ),
        );
    const column = data?.columns.find((c) => c.key === sort?.key);
    if (!column) return found;

    const numeric = RIGHT_ALIGNED.includes(column.type);
    return [...found].sort((a, b) =>
      compare(a[column.key], b[column.key], numeric, sort.direction),
    );
  }, [data, search, sort]);

  // First click: biggest first for amounts, A–Z for text. Second click flips it.
  const sortBy = (column) =>
    setSort((current) => ({
      key: column.key,
      direction:
        current?.key === column.key
          ? current.direction === "asc"
            ? "desc"
            : "asc"
          : RIGHT_ALIGNED.includes(column.type)
            ? "desc"
            : "asc",
    }));

  // Money columns add up; a count or a percentage column doesn't mean anything summed.
  const hasTotals =
    rows.length > 1 && data?.columns.some((c) => c.type === "money");
  const total = (key) =>
    rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0);

  const show = (type, value) => {
    if (value === null || value === undefined || value === "")
      return <span className="text-muted-foreground">—</span>;
    if (type === "reference")
      return (
        <Link
          href={`${REFERENCE_LINKS[report]}${value}`}
          className="font-medium text-primary hover:underline"
        >
          {value}
        </Link>
      );
    if (type === "money")
      return (
        <span className={cn(Number(value) < 0 && "text-destructive")}>
          {format(value)}
        </span>
      );
    if (type === "percent") return `${value}%`;
    if (type === "date") return formatDate(value);
    if (type === "status") return <StatusBadge status={value} className="px-2 py-0 text-[10px] leading-4" />;
    return value;
  };

  const download = async (kind) => {
    setExporting(kind);
    try {
      const res = await vendorService.reports.export(report, kind, params);
      downloadBlob(res.data, `${report}.${kind}`);
    } catch {
      toast.error("Could not export this report");
    } finally {
      setExporting(null);
    }
  };

  const breadcrumbItems = [
    {
      label: "Home",
      href: "/vendor/dashboard",
      icon: <Home className="size-4" />,
    },
    { label: "Reports" },
    { label: data?.title ?? "Report" },
  ];

  return (
    <HomePageWrapper
      breadcrumb={breadcrumbItems}
      className="space-y-4 p-3 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold tracking-tight">
              {data?.title ?? "Report"}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {data?.description ?? " "}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {data?.dated !== false && (
            <>
              <div className="flex gap-1">
                {PRESETS.map((preset) => {
                  const range = preset.range();
                  const active =
                    range.from === dateRange.from && range.to === dateRange.to;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setDateRange(range)}
                      aria-pressed={active}
                      className={cn(
                        "h-8 whitespace-nowrap rounded-md border px-2.5 text-xs font-medium transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <DateRangePicker
                placeholder="Date range"
                className="w-full sm:w-60"
                value={dateRange}
                onChange={setDateRange}
              />
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-rose-300 text-rose-600 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700"
            onClick={() => download("pdf")}
            disabled={!data || !!exporting}
          >
            {exporting === "pdf" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}{" "}
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-emerald-300 text-emerald-600 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
            onClick={() => download("csv")}
            disabled={!data || !!exporting}
          >
            {exporting === "csv" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5" />
            )}{" "}
            Excel
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
          Could not load this report. You may not have access to it.
        </p>
      ) : (
        <div
          className={cn(
            "space-y-4 transition-opacity",
            isFetching && "opacity-60",
          )}
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {data.summary.map((tile, i) => {
              const Icon = TILE_ICONS[tile.type] ?? Hash;
              return (
                <div
                  key={tile.label}
                  title={tile.label}
                  className="flex items-center gap-2.5 rounded-xl border bg-card p-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-lg",
                      TILE_TONES[i % TILE_TONES.length],
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium leading-snug text-muted-foreground">
                      {tile.label}
                    </p>
                    <p className="break-words text-base font-bold leading-tight tracking-tight">
                      {show(tile.type, tile.value)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search this report..."
                  aria-label="Search this report"
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {search.trim()
                  ? `${rows.length} of ${data.rows.length}`
                  : data.rows.length}{" "}
                {data.rows.length === 1 ? "row" : "rows"}
              </p>
            </div>

            <div className="max-h-[60vh] overflow-auto thin-scrollbar">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-muted">
                  <tr>
                    {data.columns.map((c) => {
                      const sorted = sort?.key === c.key;
                      const Arrow =
                        sort?.direction === "asc" ? ArrowUp : ArrowDown;
                      return (
                        <th
                          key={c.key}
                          aria-sort={
                            sorted
                              ? sort.direction === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                          className={cn(
                            "whitespace-nowrap px-3 py-1.5 text-left",
                            RIGHT_ALIGNED.includes(c.type) && "text-right",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => sortBy(c)}
                            className={cn(
                              "inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide transition-colors hover:text-foreground",
                              sorted
                                ? "text-foreground"
                                : "text-muted-foreground",
                            )}
                          >
                            {c.label}
                            {sorted && <Arrow className="h-3 w-3" />}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={data.columns.length}
                        className="px-3 py-14 text-center"
                      >
                        <SearchX className="mx-auto h-7 w-7 text-muted-foreground/60" />
                        <p className="mt-2 text-sm font-medium">
                          {search.trim()
                            ? "No rows match your search"
                            : "Nothing to show"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {search.trim()
                            ? "Try a different word."
                            : data.dated === false
                              ? "There is nothing here right now."
                              : "Try a wider date range."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, i) => (
                      <tr
                        key={i}
                        className="border-t transition-colors even:bg-muted/30 hover:bg-primary/5"
                      >
                        {data.columns.map((c) => (
                          <td
                            key={c.key}
                            className={cn(
                              "whitespace-nowrap px-3 py-0.5 leading-5",
                              RIGHT_ALIGNED.includes(c.type) &&
                                "text-right tabular-nums",
                            )}
                          >
                            {show(
                              c.key === "reference" && REFERENCE_LINKS[report]
                                ? "reference"
                                : c.type,
                              row[c.key],
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
                {hasTotals && (
                  <tfoot className="sticky bottom-0 bg-muted font-semibold">
                    <tr className="border-t-2">
                      {data.columns.map((c, i) => (
                        <td
                          key={c.key}
                          className={cn(
                            "whitespace-nowrap px-3 py-1.5",
                            RIGHT_ALIGNED.includes(c.type) &&
                              "text-right tabular-nums",
                          )}
                        >
                          {c.type === "money"
                            ? show("money", total(c.key))
                            : i === 0
                              ? "Total"
                              : ""}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {data.note && (
            <p className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {data.note}
            </p>
          )}
        </div>
      )}
    </HomePageWrapper>
  );
}
