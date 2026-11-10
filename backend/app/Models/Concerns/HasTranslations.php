<?php

namespace App\Models\Concerns;

/**
 * Text in more than one language. The normal columns hold the default
 * (English) text; other languages live in a `translations` JSON column:
 *
 *   { "ta": { "name": "கார்", "description": "..." } }
 *
 * A model lists its translatable columns in `$translatable`. translate()
 * returns the current locale's text, falling back to the English column
 * when there's no (or a blank) translation.
 */
trait HasTranslations
{
    public function initializeHasTranslations(): void
    {
        $this->mergeCasts(['translations' => 'array']);
        $this->mergeFillable(['translations']);
    }

    /** $field in $locale (default: the app's current locale), or the English column when untranslated. */
    public function translate(string $field, ?string $locale = null): mixed
    {
        return static::pickTranslation($this->translations, $field, $locale) ?? $this->getAttribute($field);
    }

    /**
     * The same lookup for a raw query row, where `translations` is still a
     * JSON string: VehicleCategory::translateRaw($row->translations, 'name', $row->name).
     */
    public static function translateRaw(array|string|null $translations, string $field, mixed $fallback): mixed
    {
        if (is_string($translations)) {
            $translations = json_decode($translations, true);
        }

        return static::pickTranslation($translations, $field) ?? $fallback;
    }

    /**
     * Validation rules for a form's `translations` input: one optional rule
     * per non-default locale and field, e.g. translationRules(['name' => 'max:255'])
     * gives translations.ta.name => nullable|string|max:255.
     */
    public static function translationRules(array $fields): array
    {
        $rules = ['translations' => ['sometimes', 'nullable', 'array']];

        foreach (static::translationLocales() as $locale) {
            $rules["translations.$locale"] = ['nullable', 'array'];
            foreach ($fields as $field => $rule) {
                $rules["translations.$locale.$field"] = ['nullable', 'string', ...(array) $rule];
            }
        }

        return $rules;
    }

    /** Every supported locale except the default one (whose text is in the normal columns). */
    public static function translationLocales(): array
    {
        return array_values(array_diff(config('app.supported_locales', []), [config('app.fallback_locale')]));
    }

    private static function pickTranslation(?array $translations, string $field, ?string $locale = null): ?string
    {
        $locale ??= app()->getLocale();
        if ($locale === config('app.fallback_locale')) {
            return null;
        }

        $value = $translations[$locale][$field] ?? null;

        return is_string($value) && trim($value) !== '' ? $value : null;
    }
}
