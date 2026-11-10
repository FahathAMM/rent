"use client";

import { ChevronDown, Download, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALES, LOCALE_LABELS } from "@/i18n/config";

/**
 * One button with a View / Download menu for a PDF (booking voucher, rental agreement),
 * once per language: onView(lang) / onDownload(lang) with "en" or "ta".
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
      <DropdownMenuContent align="end" className="w-44">
        {LOCALES.map((lang, i) => (
          <div key={lang}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{LOCALE_LABELS[lang]}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onView(lang)} className="gap-2"><Eye className="h-4 w-4" /> View</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload(lang)} className="gap-2"><Download className="h-4 w-4" /> Download</DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
