import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// The API sends UTC timestamps; everyone sees them in Sri Lanka time
// regardless of their device's timezone (backend config/app.php display_timezone).
export const APP_TIMEZONE = "Asia/Colombo";

export function formatDate(date, options = {}) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: APP_TIMEZONE,
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

/** Shows a blob (PDF/image) in a new tab instead of saving it. Pass a tab opened synchronously in the click handler so popup blockers allow it. */
export function openBlob(blob, tab = window.open("", "_blank")) {
  const url = URL.createObjectURL(blob);
  if (tab) tab.location.href = url;
  else window.location.href = url;
  // Revoke later — the new tab needs the URL while it loads.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * The `?next=` path to return to after login/register — only a path on
 * this site ("/vehicles/x"), never "//evil.com" or "https://..." (an open
 * redirect), else `fallback`.
 */
export function safeNextPath(fallback) {
  if (typeof window === "undefined") return fallback;
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

export function getInitials(name) {
  return name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "?";
}
