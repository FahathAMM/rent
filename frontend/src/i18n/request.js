import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "./config";
import en from "@/messages/en.json";

/** Deep-merges `override` onto `base`, so a key missing from a translation falls back to English. */
function merge(base, override) {
  const out = { ...base };
  for (const [key, value] of Object.entries(override ?? {})) {
    out[key] = value && typeof value === "object" && !Array.isArray(value) ? merge(base?.[key], value) : value;
  }
  return out;
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const requested = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;

  const messages = locale === DEFAULT_LOCALE
    ? en
    : merge(en, (await import(`../messages/${locale}.json`)).default);

  return { locale, messages, timeZone: "Asia/Colombo" };
});
