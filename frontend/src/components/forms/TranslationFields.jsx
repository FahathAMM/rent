"use client";

import { Languages } from "lucide-react";
import { TextInput, TextareaInput } from "@/components/forms/FormField";
import { DEFAULT_LOCALE, LOCALES, LOCALE_LABELS, LOCALE_META } from "@/i18n/config";

/** Languages that get their own text (English lives in the normal fields). */
const TRANSLATION_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

/**
 * A record's `translations` as form state: { ta: { name: "", ... } } with
 * every field present, so inputs stay controlled.
 */
export function translationsForm(translations, fields) {
  return Object.fromEntries(
    TRANSLATION_LOCALES.map((locale) => [
      locale,
      Object.fromEntries(fields.map((f) => [f, translations?.[locale]?.[f] ?? ""])),
    ])
  );
}

/** Appends translations to a FormData as translations[ta][name] = … (for multipart forms). */
export function appendTranslations(fd, translations) {
  for (const [locale, fields] of Object.entries(translations ?? {})) {
    for (const [field, value] of Object.entries(fields ?? {})) {
      fd.append(`translations[${locale}][${field}]`, value ?? "");
    }
  }
}

/**
 * Inputs for the other-language text of a record, under the English fields.
 * `fields`: [{ key, label, multiline?, rows?, render? }]. `render(value, onChange)`
 * replaces the default input (e.g. a rich text editor). Empty = the public site
 * shows the English text.
 */
export function TranslationFields({ value, onChange, fields, errors = {}, english = {} }) {
  const set = (locale, key, v) => onChange({ ...value, [locale]: { ...(value?.[locale] ?? {}), [key]: v } });

  return TRANSLATION_LOCALES.map((locale) => (
    <fieldset key={locale} lang={locale} className="space-y-3 rounded-xl border border-dashed border-primary/30 bg-primary/[0.03] p-3">
      <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
        <span className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-xs font-bold text-white">
          {LOCALE_META[locale]?.glyph}
        </span>
        {LOCALE_META[locale]?.english} · {LOCALE_LABELS[locale]}
        <span className="font-normal text-muted-foreground">(optional)</span>
      </legend>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Languages className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Shown to visitors who pick {LOCALE_META[locale]?.english}. Leave a field empty to show the English text.
      </p>
      {fields.map(({ key, label, multiline, rows = 3, render }) => {
        const v = value?.[locale]?.[key] ?? "";
        const onField = (next) => set(locale, key, next);
        const error = errors[`translations.${locale}.${key}`]?.[0];
        if (render) {
          return (
            <div key={key} className="space-y-1">
              <p className="text-sm font-medium">{label}</p>
              {render(v, onField)}
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          );
        }
        const Input = multiline ? TextareaInput : TextInput;
        return (
          <Input
            key={key}
            label={label}
            rows={multiline ? rows : undefined}
            value={v}
            placeholder={english[key] || undefined}
            onChange={(e) => onField(e.target.value)}
            error={error}
          />
        );
      })}
    </fieldset>
  ));
}
