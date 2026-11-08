import { LOCALE_COOKIE, isLocale } from "./config";

/**
 * The language to ask the API for (sent as X-Locale), or null for the
 * backend's default (English). The vendor and platform panels never send
 * it: their screens are English, and their edit forms must load and save
 * the English text, not a translation.
 */
export function requestLocale() {
  if (typeof window === "undefined") return null;
  const path = window.location.pathname;
  if (path.startsWith("/platform") || path.startsWith("/vendor")) return null;

  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`));
  const locale = match?.[1];
  return isLocale(locale) ? locale : null;
}

/** Axios request interceptor that adds X-Locale (see requestLocale). */
export function withLocaleHeader(config) {
  const locale = requestLocale();
  if (locale) config.headers["X-Locale"] = locale;
  return config;
}
