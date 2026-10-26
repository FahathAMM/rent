"use client";

import { useQuery } from "@tanstack/react-query";
import { platformDetailService } from "@/services/platformDetailService";
import { BrandLogo } from "@/components/auth/BrandLogo";
import { cn } from "@/lib/utils";

/**
 * A shop's cover image, or — when the shop hasn't uploaded one — the
 * platform's own branded banner (logo, name and tagline from Platform
 * Settings on the brand gradient). Same ["platform-details"] query as
 * PublicHeader, so it's already cached on every public page.
 *
 * `variant` places the brand mark clear of what each surface overlays:
 *   card    — shop directory tiles (status badges top-left, logo bottom-left)
 *   hero    — public shop page (identity card overlaps the bottom)
 *   compact — vendor settings previews
 */
export function ShopCover({ shop, variant = "card", className, imgClassName, alt = "" }) {
  // Vendor payloads carry the raw `cover_image` path plus `cover_image_url`; public ones only a URL in `cover_image`.
  const src = shop?.cover_image_url || shop?.cover_image;

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} aria-hidden={alt ? undefined : "true"} loading={variant === "card" ? "lazy" : undefined} className={cn("h-full w-full object-cover", imgClassName, className)} />;
  }

  return <BrandBanner variant={variant} className={className} />;
}

function BrandBanner({ variant, className }) {
  const { data: brand } = useQuery({
    queryKey: ["platform-details"],
    queryFn: () => platformDetailService.get().then((r) => r.data.data),
    staleTime: 60_000,
  });

  const name = brand?.name || "LankaLane";
  const tagline = brand?.tagline;
  const logo = brand?.logo || null;

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-gradient-to-br from-orange-500 via-pink-500 to-violet-600", className)} aria-hidden="true">
      {/* texture: soft light blobs + fine diagonal lines */}
      <div className="absolute -left-10 -top-16 h-48 w-48 rounded-full bg-white/20 blur-3xl" />
      <div className="absolute -bottom-20 right-1/4 h-56 w-56 rounded-full bg-violet-900/30 blur-3xl" />
      <div className="absolute inset-0 opacity-[0.07] [background-image:repeating-linear-gradient(135deg,#fff_0_1px,transparent_1px_14px)]" />

      {variant === "hero" ? (
        <div className="absolute inset-x-0 top-1/2 flex -translate-y-[85%] flex-col items-center gap-2 px-4 text-center text-white">
          <div className="flex items-center gap-3">
            <BrandLogo
              logoUrl={logo}
              brandName={name}
              imgClassName="h-12 w-auto drop-shadow-md sm:h-14"
              fallbackClassName="size-12 rounded-xl bg-white/20 backdrop-blur-sm sm:size-14"
              iconClassName="size-6"
            />
            <span className="text-2xl font-semibold tracking-tight drop-shadow-sm sm:text-4xl">{name}</span>
          </div>
          {tagline && <p className="max-w-md text-sm text-white/85 sm:text-base">{tagline}</p>}
        </div>
      ) : (
        <div className={cn(
          "absolute top-1/2 flex -translate-y-1/2 items-center gap-2 text-white",
          variant === "card" ? "right-4" : "right-5 sm:right-8"
        )}>
          <BrandLogo
            logoUrl={logo}
            brandName={name}
            imgClassName={cn("w-auto drop-shadow-md", variant === "card" ? "h-7" : "h-9 sm:h-11")}
            fallbackClassName={cn("rounded-lg bg-white/20 backdrop-blur-sm", variant === "card" ? "size-7" : "size-9 sm:size-11")}
            iconClassName="size-4"
          />
          <div className="leading-tight">
            <p className={cn("font-semibold tracking-tight drop-shadow-sm", variant === "card" ? "text-sm" : "text-base sm:text-xl")}>{name}</p>
            {tagline && variant !== "card" && <p className="hidden text-xs text-white/80 sm:block">{tagline}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
