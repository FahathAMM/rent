import { useTranslations } from "next-intl";

/**
 * Translates a backend enum value (fuel type, transmission, sale condition…)
 * from the `enums` messages. Unknown values come back unchanged, so a new
 * backend value still shows something sensible before it's translated.
 *
 *   const enumLabel = useEnumLabel();
 *   enumLabel("fuel", vehicle.fuel_type) // "Petrol" / "பெட்ரோல்"
 */
export function useEnumLabel() {
  const t = useTranslations("enums");
  return (group, value) => {
    if (value == null || value === "") return value;
    const key = `${group}.${value}`;
    return t.has(key) ? t(key) : value;
  };
}
