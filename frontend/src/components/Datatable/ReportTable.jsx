"use client";

import { useMemo, useState } from "react";
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectGroup,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

/**
 * ServerDataTable's UI (search bar, sticky header, hover rows, pagination),
 * duplicated for pages whose full dataset is already in memory — report
 * pages fetch one pre-computed JSON blob per date range rather than a
 * paginated Laravel resource, so search/sort/pagination here all run
 * locally against `data` instead of round-tripping to an endpoint.
 */
export default function ReportTable({
  data = [],
  columns,
  children,
  actions,
  defaultSortField,
  searchKeys = [],
  searchPlaceholder = "Search...",
  emptyMessage = "No records found.",
  loading = false,
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [sortField, setSortField] = useState(defaultSortField);
  const [sortOrder, setSortOrder] = useState("asc");

  const handleSort = (field) => {
    if (field === sortField) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const filtered = useMemo(() => {
    if (!search || !searchKeys.length) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      searchKeys.some((key) => String(row[key] ?? "").toLowerCase().includes(q))
    );
  }, [data, search, searchKeys]);

  const sorted = useMemo(() => {
    if (!sortField) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (av == null && bv == null) return 0;
      if (av == null) return sortOrder === "asc" ? -1 : 1;
      if (bv == null) return sortOrder === "asc" ? 1 : -1;
      if (typeof av === "number" && typeof bv === "number") {
        return sortOrder === "asc" ? av - bv : bv - av;
      }
      return sortOrder === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [filtered, sortField, sortOrder]);

  const lastPage = Math.max(1, Math.ceil(sorted.length / perPage));
  const pageSafe = Math.min(page, lastPage);
  const pageRows = sorted.slice((pageSafe - 1) * perPage, pageSafe * perPage);

  const resolvedColumns = columns({ sortField, sortOrder, handleSort, page: pageSafe, perPage });

  return (
    <div>
      <div className="space-y-3 px-3 pt-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1">
            {!!searchKeys.length && (
              <div className="relative w-full md:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder={searchPlaceholder}
                  className="h-8 pl-8 text-sm"
                />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">{children}</div>
          </div>

          <div className="flex justify-end items-center gap-2 flex-wrap">{actions}</div>
        </div>
      </div>

      <div className="rounded-none border-none overflow-hidden mt-4">
        <Table className="text-sm table-fixed w-full">
          <TableHeader className="sticky border top-0 bg-gray-50 z-10">
            <TableRow className="text-xs font-medium">
              {resolvedColumns.map((col) => (
                <TableHead
                  key={col.accessorKey}
                  className={`px-2 py-0 h-8 font-medium text-muted-foreground ${col.class || ""}`}
                  style={col.style}
                >
                  {typeof col.header === "function" ? col.header() : col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </Table>

        <div className="overflow-y-auto scrollbar-hide" style={{ maxHeight: "480px" }}>
          <Table className="text-sm table-fixed w-full">
            <TableBody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <TableRow key={i} className="h-6">
                    {resolvedColumns.map((col) => (
                      <TableCell key={col.accessorKey} className={`px-2 py-0.5 ${col.class || ""}`} style={col.style}>
                        <div className="h-3 bg-gray-200 rounded animate-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !pageRows.length ? (
                <TableRow>
                  <TableCell colSpan={resolvedColumns.length} className="p-6 text-center text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row, i) => (
                  <TableRow key={row.id ?? row.invoice_no ?? row.expense_no ?? i} className="h-7 hover:bg-gray-50 dark:hover:bg-[#101828] transition-colors">
                    {resolvedColumns.map((col) => (
                      <TableCell key={col.accessorKey} className={`px-2 py-0 text-xs font-medium ${col.class || ""}`} style={col.style}>
                        {col.cell ? col.cell(row, i) : row[col.accessorKey]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 flex-wrap px-3 pb-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Rows:</span>
          <Field className="max-w-xs w-auto">
            <Select
              value={perPage.toString()}
              onValueChange={(val) => {
                setPerPage(Number(val));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-7 w-16 text-xs">
                <SelectValue placeholder="" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  {[10, 20, 25, 50, 75].map((n) => (
                    <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="text-xs text-muted-foreground text-center flex-1">
          Page {pageSafe} of {lastPage}
        </div>

        <div className="flex items-center gap-0.5">
          <Button size="icon" variant="outline" className="h-7 w-7" disabled={pageSafe === 1} onClick={() => setPage(1)}>
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="outline" className="h-7 w-7" disabled={pageSafe === 1} onClick={() => setPage(pageSafe - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          {[...Array(lastPage)].map((_, i) => (
            <Button
              key={i}
              size="icon"
              className="h-7 w-7 text-xs"
              variant={pageSafe === i + 1 ? "default" : "outline"}
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </Button>
          ))}
          <Button size="icon" variant="outline" className="h-7 w-7" disabled={pageSafe === lastPage} onClick={() => setPage(pageSafe + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="outline" className="h-7 w-7" disabled={pageSafe === lastPage} onClick={() => setPage(lastPage)}>
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
