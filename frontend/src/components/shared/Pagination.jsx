"use client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

const PAGE_SIZES = ["5", "10", "15", "25", "50"];

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

export function Pagination({ meta, onPageChange, perPage, onPerPageChange }) {
  if (!meta) return null;
  if (meta.last_page <= 1 && !onPerPageChange) return null;

  const { current_page, last_page, from, to, total } = meta;
  const range = last_page > 1 ? buildPageRange(current_page, last_page) : [];

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mt-4 px-1">
      {/* Showing text — LEFT */}
      <p className="text-xs text-muted-foreground">
        Showing{" "}
        <span className="font-medium text-foreground">{from}–{to}</span>{" "}
        of{" "}
        <span className="font-medium text-foreground">{total}</span>
      </p>

      {/* Controls — RIGHT */}
      <div className="flex items-center gap-2">
        {onPerPageChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Rows:</span>
            <Select value={String(perPage)} onValueChange={(v) => onPerPageChange(Number(v))}>
              <SelectTrigger className="h-7 w-[62px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {range.length > 0 && (
          <div className="flex items-center gap-0.5">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={current_page === 1}
              onClick={() => onPageChange(1)} aria-label="First page">
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={current_page === 1}
              onClick={() => onPageChange(current_page - 1)} aria-label="Previous page">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            {range.map((p, i) =>
              p === "..." ? (
                <span key={`e-${i}`}
                  className="flex h-7 w-7 items-center justify-center text-xs text-muted-foreground select-none">
                  …
                </span>
              ) : (
                <Button key={p} variant={p === current_page ? "default" : "outline"}
                  size="icon" className="h-7 w-7 text-xs"
                  onClick={() => p !== current_page && onPageChange(p)}
                  aria-current={p === current_page ? "page" : undefined}>
                  {p}
                </Button>
              )
            )}

            <Button variant="outline" size="icon" className="h-7 w-7" disabled={current_page === last_page}
              onClick={() => onPageChange(current_page + 1)} aria-label="Next page">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={current_page === last_page}
              onClick={() => onPageChange(last_page)} aria-label="Last page">
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
