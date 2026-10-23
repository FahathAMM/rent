import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount, settings = null) {
  const num = amount ?? 0;

  // No settings means no company context (platform admin, or pre-signup
  // public pages like the pricing dialog) — default to AED, this platform's
  // own operating currency, matching useCompanyCurrencyFormat's default
  // rather than an unrelated USD fallback.
  if (!settings || !Object.keys(settings).length) {
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
      minimumFractionDigits: 2,
    }).format(num);
  }

  const symbol   = settings.currency_symbol    ?? "$";
  const position = settings.currency_position  ?? "left";
  const decimals = Math.max(0, parseInt(settings.decimal_places    ?? "2", 10));
  const decSep   = settings.decimal_separator  ?? ".";
  const thouSep  = settings.thousand_separator ?? ",";

  const abs      = Math.abs(num);
  const fixed    = abs.toFixed(decimals);
  const [intPart, decPart = ""] = fixed.split(".");
  const intFmt   = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thouSep);
  const numStr   = decimals > 0 ? `${intFmt}${decSep}${decPart}` : intFmt;
  const sign     = num < 0 ? "-" : "";

  return position === "right" ? `${sign}${numStr}${symbol}` : `${sign}${symbol}${numStr}`;
}

export function formatDate(date, options = {}) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  }).format(new Date(date));
}

export function formatDateTime(date) {
  return formatDate(date, { hour: "2-digit", minute: "2-digit" });
}

/**
 * A Date as YYYY-MM-DD in the browser's local timezone — for <input type="date">
 * defaults. Deliberately not `date.toISOString().slice(0, 10)`, which converts to
 * UTC first and rolls back to "yesterday" for any timezone ahead of UTC (e.g. Asia/Dubai).
 */
export function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Saves an axios blob response to disk under `filename` via a throwaway <a download>. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function localISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayLocalISO() {
  return localISODate(new Date());
}

export function getInitials(name) {
  return name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "?";
}
