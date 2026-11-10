/**
 * Languages the site can be shown in. The choice lives in a cookie (not the
 * URL), so every existing route keeps working unchanged; the switcher just
 * sets the cookie and refreshes.
 */
export const LOCALES = ["en", "ta"];
export const DEFAULT_LOCALE = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Names shown in the language switcher, each in its own language. */
export const LOCALE_LABELS = {
  en: "English",
  ta: "தமிழ்",
};

/** Extra details for the language switcher: a short code, a sample letter, and the English name. */
export const LOCALE_META = {
  en: { short: "EN", glyph: "A", english: "English" },
  ta: { short: "த", glyph: "அ", english: "Tamil" },
};

export const isLocale = (value) => LOCALES.includes(value);

/**
 * The locale to pass to toLocaleDateString() and friends. English keeps the
 * browser's own format (as before); other languages use their Sri Lankan variant.
 */
export const dateLocale = (locale) => (locale === DEFAULT_LOCALE ? undefined : `${locale}-LK`);
