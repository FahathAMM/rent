"use client";

import { useEffect, useState } from "react";
import { CarFront } from "lucide-react";
import { cn } from "@/lib/utils";

const MIN_VISIBLE_MS = 500; // long enough not to flicker on a fast load
const MAX_VISIBLE_MS = 4000; // never trap the page behind it
const FADE_MS = 400;

/**
 * Full-screen preloader for the first load of any public page. It is part
 * of the server-rendered HTML, so it covers the page from the first paint,
 * then fades out once the window has loaded. It lives in the (public)
 * layout, which persists across client-side navigation, so it only ever
 * shows once per visit - route changes use (public)/loading.jsx instead.
 */
export function PublicPreloader() {
  const [phase, setPhase] = useState("visible"); // visible -> fading -> gone

  useEffect(() => {
    const start = performance.now();
    let fadeTimer;
    const hide = () => {
      const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - start));
      fadeTimer = setTimeout(() => setPhase((p) => (p === "visible" ? "fading" : p)), wait);
    };

    if (document.readyState === "complete") hide();
    else window.addEventListener("load", hide, { once: true });
    const failsafe = setTimeout(() => setPhase((p) => (p === "visible" ? "fading" : p)), MAX_VISIBLE_MS);

    return () => {
      window.removeEventListener("load", hide);
      clearTimeout(fadeTimer);
      clearTimeout(failsafe);
    };
  }, []);

  useEffect(() => {
    if (phase !== "fading") return;
    const t = setTimeout(() => setPhase("gone"), FADE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <>
      {/* Without JS the overlay could never hide - keep the page usable. */}
      <noscript>
        <style>{"#public-preloader{display:none}"}</style>
      </noscript>
      <div
        id="public-preloader"
        role="status"
        aria-live="polite"
        aria-label="Loading"
        className={cn(
          "fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity ease-out",
          phase === "fading" ? "pointer-events-none opacity-0" : "opacity-100"
        )}
        style={{ transitionDuration: `${FADE_MS}ms` }}
      >
        <div className="flex flex-col items-center gap-5">
          <div className="relative flex size-20 items-center justify-center">
            {/* Spinning gradient ring */}
            <div
              aria-hidden="true"
              className="absolute inset-0 animate-spin rounded-full motion-reduce:animate-none"
              style={{
                background: "conic-gradient(from 0deg, transparent 0deg, #f97316 90deg, #ec4899 180deg, #8b5cf6 270deg, transparent 360deg)",
                mask: "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))",
                WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))",
                animationDuration: "1.1s",
              }}
            />
            <div className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white shadow-lg">
              <CarFront className="h-7 w-7" />
            </div>
          </div>
          <div className="flex gap-1.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 motion-reduce:animate-none"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
