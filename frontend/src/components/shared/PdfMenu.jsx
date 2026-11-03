"use client";

import { ChevronDown, Download, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * One button with a View / Download menu for a PDF (booking voucher, rental agreement).
 * `onView` must open its tab synchronously inside the click so popup blockers allow it.
 */
export function PdfMenu({ label, icon: Icon, loading = false, onView, onDownload, title }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={loading} title={title}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
          {label}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={onView} className="gap-2"><Eye className="h-4 w-4" /> View</DropdownMenuItem>
        <DropdownMenuItem onClick={onDownload} className="gap-2"><Download className="h-4 w-4" /> Download</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
