"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export function SortIcon({ active, dir }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />;
  return dir === "desc"
    ? <ChevronDown className="h-3 w-3 shrink-0 text-primary" />
    : <ChevronUp className="h-3 w-3 shrink-0 text-primary" />;
}

export function SortableHeader({ label, column, sortField, sortOrder, onSort }) {
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {label}
      <SortIcon active={sortField === column} dir={sortOrder} />
    </button>
  );
}
