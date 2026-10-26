"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { cn } from "@/lib/utils";

const ROTATE_MS = 6000;

const MAX_SLIDES = 5;

// Stock photos (Unsplash, public/images/hero) that pad the slideshow while
// few listings have photos of their own. Compressed WebP copies of the
// original JPGs; the lightest one goes first since it's the hero's LCP.
const STOCK_SLIDES = [
  { id: "stock-saloon", image: "/images/hero/saloon-highway.webp", title: "Comfortable saloons for every trip" },
  { id: "stock-suv-desert", image: "/images/hero/suv-desert.webp", title: "SUVs for the long road" },
  { id: "stock-hatchback", image: "/images/hero/city-hatchback.webp", title: "Easy city cars" },
  { id: "stock-coupe", image: "/images/hero/coupe-sunset.webp", title: "Something special for the weekend" },
  { id: "stock-suv-mountain", image: "/images/hero/suv-mountain.webp", title: "Ready for the hill country" },
  { id: "stock-sports", image: "/images/hero/sports-front.webp", title: "Drive what you love" },
];

const primaryImage = (v) => v.images?.find((i) => i.is_primary)?.url ?? v.images?.[0]?.url;

/**
 * Full-bleed background for the home hero: crossfades through published
 * vehicles that have a photo, padded with stock photos. Renders behind the
 * hero's own content (absolute, -z-10), so the parent section must be
 * `relative isolate`. Slides are only mounted once they're next up, so the
 * first paint downloads a single image.
 */
export function HeroSlideshow({ vehicles }) {
  const { format } = useCurrencyFormat();
  const listed = (vehicles ?? [])
    .filter(primaryImage)
    .slice(0, MAX_SLIDES)
    .map((v) => ({ ...v, image: primaryImage(v) }));
  const slides = [...listed, ...STOCK_SLIDES].slice(0, MAX_SLIDES);

  const [active, setActive] = useState(0);
  const [mountedCount, setMountedCount] = useState(1);

  useEffect(() => {
    if (slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setActive((i) => (i + 1) % slides.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [slides.length]);

  // Keep the next slide mounted (i.e. downloading) well before it fades in.
  useEffect(() => {
    setMountedCount((n) => Math.min(slides.length, Math.max(n, active + 2)));
  }, [active, slides.length]);

  const current = slides[active % slides.length];
  const isListing = Boolean(current.slug);

  return (
    <>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-slate-900">
        {slides.slice(0, mountedCount).map((v, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={v.id}
            src={v.image}
            alt=""
            fetchPriority={i === 0 ? "high" : "auto"}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-all duration-[1500ms] motion-reduce:transition-none",
              i === active ? "scale-100 opacity-100" : "scale-105 opacity-0"
            )}
          />
        ))}
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
      </div>

      {/* Caption + dots — which vehicle is on screen, linking to it when it's a real listing. */}
      <div className="absolute inset-x-0 bottom-4">
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-4 px-4">
          <div key={current.id} className="min-w-0 animate-in fade-in duration-700">
            {isListing ? (
              <Link
                href={`/vehicles/${current.slug}`}
                className="group inline-flex max-w-full items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-xs text-white/85 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
              >
                <span className="truncate">
                  <span className="font-medium text-white">{current.title}</span>
                  {current.shop?.name && ` · ${current.shop.name}`}
                  {" · "}
                  {format ? format(current.pricing?.daily_rate) : `LKR ${current.pricing?.daily_rate ?? "—"}`} / day
                </span>
                <ArrowRight className="h-3 w-3 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <span className="inline-flex max-w-full truncate rounded-full bg-black/40 px-3 py-1.5 text-xs text-white/85 backdrop-blur-sm">
                {current.title}
              </span>
            )}
          </div>

          {slides.length > 1 && (
            <div className="flex shrink-0 gap-2">
              {slides.map((v, i) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setMountedCount((n) => Math.max(n, i + 1));
                    setActive(i);
                  }}
                  aria-label={`Show ${v.title}`}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    i === active ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
