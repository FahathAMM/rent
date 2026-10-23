"use client";

import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, ChevronsUpDown, Inbox, SearchX } from "lucide-react";

function SortIcon({ active, dir }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />;
  return dir === "desc"
    ? <ChevronDown className="h-3 w-3 shrink-0 text-primary" />
    : <ChevronUp className="h-3 w-3 shrink-0 text-primary" />;
}

function SkeletonRow({ count }) {
  const widths = ["72%", "55%", "80%", "45%", "65%", "70%", "50%", "75%"];
  return (
    <tr className="border-b last:border-0 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <td key={i} className="px-4 py-1">
          <div className="h-3.5 rounded bg-muted" style={{ width: widths[i % widths.length] }} />
        </td>
      ))}
    </tr>
  );
}

export function DataTable({
  columns,
  data,
  loading,
  sortKey = "",
  sortDir = "asc",
  onSort,
  search = "",
}) {
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "h-11 px-4 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap",
                    col.headerClass
                  )}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => onSort?.(col.key)}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      {col.header}
                      <SortIcon active={sortKey === col.key} dir={sortDir} />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <SkeletonRow key={i} count={columns.length} />
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  {search ? (
                    <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
                      <SearchX className="h-11 w-11 opacity-40" />
                      <p className="text-sm font-medium">No results for &ldquo;{search}&rdquo;</p>
                      <p className="text-xs opacity-70">Try a different search term.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
                      <Inbox className="h-11 w-11 opacity-40" />
                      <p className="text-sm font-medium">No records yet</p>
                      <p className="text-xs opacity-70">Get started by adding your first entry.</p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr key={row.id ?? i} className="hover:bg-muted/30 transition-colors">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn("px-4 py-0 text-xs text-foreground", col.className)}
                    >
                      {col.render ? col.render(row) : (row[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
