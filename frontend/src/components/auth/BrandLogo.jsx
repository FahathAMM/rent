import { Store } from "lucide-react";

/**
 * Renders the platform's uploaded logo (login_logo, falling back to the
 * sidebar logo) or, when none is set, a generic store-icon placeholder.
 * imgClassName and fallbackClassName are fully independent — never merged —
 * since the two elements need unrelated sizing (an <img> scales by its own
 * aspect ratio; the fallback is a fixed-size box).
 */
export function BrandLogo({ logoUrl, brandName, imgClassName, fallbackClassName, iconClassName }) {
  return logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt={brandName} className={`object-contain ${imgClassName}`} />
  ) : (
    <div className={`flex items-center justify-center ${fallbackClassName}`}>
      <Store className={iconClassName} />
    </div>
  );
}
