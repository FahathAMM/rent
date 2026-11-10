import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Calendar and datetime values use Sri Lanka time regardless of the device timezone.
export const APP_TIMEZONE = "Asia/Colombo";
export const APP_TIMEZONE_OFFSET = "+05:30";

function dateTimePartsInAppTimezone(value = new Date()) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIMEZONE,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(value)).filter(({ type }) => type !== "literal").map(({ type, value: part }) => [type, part]),
  );
}

/** Format an instant as YYYY-MM-DDTHH:mm for datetime-local inputs in Sri Lanka time. */
export function toAppDateTimeInput(value) {
  if (!value) return "";
  const p = dateTimePartsInAppTimezone(value);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Interpret a datetime-local value in Sri Lanka time and include its explicit offset for the API. */
export function fromAppDateTimeInput(value) {
  return value ? `${value}:00${APP_TIMEZONE_OFFSET}` : null;
}

/** Today's calendar date in Sri Lanka, for date-only inputs. */
export function appDateKey(value = new Date()) {
  const p = dateTimePartsInAppTimezone(value);
  return `${p.year}-${p.month}-${p.day}`;
}

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
