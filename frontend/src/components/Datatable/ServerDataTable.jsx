"use client";
import { React, useEffect, useState, Fragment } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Search,
  PlusCircle,
  Inbox,
  SearchX,
} from "lucide-react";
 
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import {
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
import Link from "next/link";
import { Label } from "../ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field } from "../ui/field";

// Debounce hook
function useDebounce(value, delay = 500) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// Standard truncated page range — first, last, current ±1, "..." for gaps —
// instead of a button per page (unusable once there are more than a few pages).
function buildPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total]);
  for (let i = current - 1; i <= current + 1; i++) {
    if (i > 1 && i < total) pages.add(i);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];
  let prev = null;
  for (const p of sorted) {
    if (prev !== null && p - prev > 1) result.push("...");
    result.push(p);
    prev = p;
  }
  return result;
}

export default function ServerDataTable({
  endpoint,
  columns,
  children,
  addPage,
  defualtSortField,
  defaultSortOrder = "asc",
  isSheet,
  breadcrumb,
  model,
  openSheet,
  actions,
  api: apiInstance = api,
  filters,
  ...props
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [perPage, setPerPage] = useState(
    Number(searchParams.get("perPage")) || 20,
  );
  const [sortField, setSortField] = useState(
    searchParams.get("sort") || defualtSortField,
  );
  const [sortOrder, setSortOrder] = useState(searchParams.get("dir") || defaultSortOrder);

  const [data, setData] = useState([]);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(0);

  const debouncedSearch = useDebounce(search, 500);
  const filtersKey = JSON.stringify(filters ?? {});
  const hasActiveFilters = Object.values(filters ?? {}).some(
    (v) => v !== undefined && v !== null && v !== ""
  );

  // Extra filters (company, event type, date range, ...) reset pagination
  // just like a search or sort change does.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  const sizes = [
    { label: "Select a size", value: null },
    { label: "Small", value: "sm" },
    { label: "Medium", value: "md" },
    { label: "Large", value: "lg" },
    { label: "Extra Large", value: "xl" },
  ];

  // Update URL whenever state changes
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      search: debouncedSearch,
      page,
      perPage,
      sort: sortField,
      dir: sortOrder,
    });
    router.replace(`${window.location.pathname}?${params.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, page, perPage, sortField, sortOrder]);

  const handleSort = (field) => {
    if (field === sortField) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiInstance.get(endpoint, {
        params: {
          search: debouncedSearch,
          page,
          perPage,
          sort_field: sortField,
          sort_direction: sortOrder,
          ...filters,
        },
      });
      const result = res.data.record;
      setData(result.data);
      setLastPage(result.last_page);
      setTotal(result.total ?? 0);
      setFrom(result.from ?? 0);
      setTo(result.to ?? 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, page, perPage, sortField, sortOrder, filtersKey]);

  // Resolve columns
  const resolvedColumns = columns({
    sortField,
    sortOrder,
    handleSort,
    page,
    perPage,
  });
  // A per-column floor so narrow screens scroll the table horizontally
  // instead of crushing every column unreadable. Used as a plain pixel
  // width (not just min-width) on the body's wrapper div below — giving
  // that div a definite width, rather than sizing it to its own content,
  // avoids a circular layout dependency with the table's w-full inside it.
  const tableMinWidth = `${resolvedColumns.length * 110}px`;

  return (
    <div>
      {/* <div className="pt-4"> */}
        {/* ====================== */}
        <div className="space-y-3 px-3 pt-3">
          {/* Header */}

          {/* Search & Filters */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {/* Left Section (Search + Filters) */}
            <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1">
              {/* Search */}
              <div className="relative w-full md:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search..."
                  className="h-8 pl-8 text-sm"
                />
              </div>

              {/* Filters from Parent */}
              <div className="flex flex-wrap items-center gap-2">
                {children}
              </div>
            </div>

            <div className="flex justify-end items-center gap-2 flex-wrap">
              {actions}

              {isSheet && (
                <Button
                  variant="default"
                  className="gap-1.5 h-8 flex items-center text-xs px-2.5"
                  onClick={(e) => {
                    // openSheet(true)
                    openSheet?.("test pass");
                  }}
                >
                  <PlusCircle className="w-4 h-4 stroke-[2]" />
                  <span>{`New ${model || ""}`}</span>
                </Button>
              )}

              {addPage && (
                <Link href={addPage}>
                  <Button
                    variant="default"
                    className="gap-1.5 h-8 flex items-center text-xs px-2.5"
                  >
                    <PlusCircle className="w-4 h-4 stroke-[2]" />
                    <span>{`New ${model || ""}`}</span>
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
        {/* ====================== */}

        {/* Table */}

        <div className="rounded-none border-none overflow-x-auto mt-4">
          {/* Table header — a plain <table>, not the shared Table component:
          that component wraps itself in its own overflow-x-auto div, which
          would give the header its own independent horizontal scrollbar
          instead of scrolling in sync with the body below. */}
          <table className="w-full caption-bottom text-sm table-fixed" style={{ minWidth: tableMinWidth }}>
            <TableHeader className="sticky border top-0 bg-gray-50 z-10">
              <TableRow className="text-xs font-medium">
                {resolvedColumns.map((col) => (
                  <TableHead
                    key={col.accessorKey}
                    className={`px-2 py-0 h-8 font-medium text-muted-foreground ${col.class || ""}`}
                    style={col.style}
                  >
                    {typeof col.header === "function"
                      ? col.header()
                      : col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
          </table>

          {/* Scrollable body */}

          <div
            className="min-w-full overflow-y-auto overflow-x-hidden scrollbar-hide"
            style={{ maxHeight: "480px", width: tableMinWidth }}
          >
            <table className="w-full caption-bottom text-sm table-fixed" style={{ minWidth: tableMinWidth }}>
              <TableBody>
                {loading
                  ? [...Array(10)].map((_, i) => (
                      <TableRow key={i} className="h-6">
                        {resolvedColumns.map((col) => (
                          <TableCell
                            key={col.accessorKey}
                            className={`px-2 py-0.5 ${col.class || ""}`}
                            style={col.style}
                          >
                            <div
                              className="h-3 bg-gray-200 rounded animate-pulse"
                              style={col.style}
                            ></div>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : data.length === 0
                  ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={resolvedColumns.length} className="p-0">
                          <div className="flex flex-col items-center justify-center gap-3 py-14 text-muted-foreground">
                            {debouncedSearch ? (
                              <>
                                <SearchX className="h-11 w-11 opacity-40" />
                                <p className="text-sm font-medium">No results for &ldquo;{debouncedSearch}&rdquo;</p>
                                <p className="text-xs opacity-70">Try a different search term{hasActiveFilters ? " or adjust your filters." : "."}</p>
                              </>
                            ) : hasActiveFilters ? (
                              <>
                                <SearchX className="h-11 w-11 opacity-40" />
                                <p className="text-sm font-medium">No matching records</p>
                                <p className="text-xs opacity-70">Try adjusting or clearing your filters.</p>
                              </>
                            ) : (
                              <>
                                <Inbox className="h-11 w-11 opacity-40" />
                                <p className="text-sm font-medium">No records found</p>
                                <p className="text-xs opacity-70">Nothing to show here yet.</p>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  : data.map((row, i) => (
                      <TableRow
                        key={i}
                        className="h-7 hover:bg-gray-50  dark:hover:bg-[#101828] transition-colors "
                      >
                        {resolvedColumns.map((col) => (
                          <TableCell
                            key={col.accessorKey}
                            className={`px-2 py-0 text-xs font-medium ${col.class || ""}`}
                            style={col.style}
                          >
                            {col.cell ? col.cell(row, i) : row[col.accessorKey]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
              </TableBody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-2 mt-2 px-3 pb-0 pt-2 border-t sm:flex-row sm:items-center sm:justify-between">
          {/* Rows per page + total */}
          <div className="flex flex-wrap items-center gap-3">
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
                        <SelectItem key={n} value={n.toString()}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <span className="text-xs text-muted-foreground">
              {total > 0 ? `Showing ${from}–${to} of ${total}` : "No results"}
            </span>
          </div>

          {/* Page info */}
          <div className="text-xs text-muted-foreground text-center sm:flex-1">
            Page {page} of {lastPage}
          </div>

          {/* Pagination buttons */}
          <div className="flex flex-wrap items-center justify-center gap-0.5 pb-2 sm:pb-0">
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={page === 1}
              onClick={() => setPage(1)}
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {buildPageRange(page, lastPage).map((p, i) =>
              p === "..." ? (
                <span
                  key={`ellipsis-${i}`}
                  className="flex h-7 w-7 items-center justify-center text-xs text-muted-foreground select-none"
                >
                  …
                </span>
              ) : (
                <Button
                  key={p}
                  size="icon"
                  className="h-7 w-7 text-xs"
                  variant={page === p ? "default" : "outline"}
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              )
            )}
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={page === lastPage}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={page === lastPage}
              onClick={() => setPage(lastPage)}
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      {/* </div> */}
    </div>
  );
}
