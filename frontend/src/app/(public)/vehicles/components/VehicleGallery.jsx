"use client";

import { useCallback, useEffect, useState } from "react";
import { VEHICLE_PLACEHOLDER_IMAGE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, X, Expand, ImageIcon } from "lucide-react";

/* ── Gallery + fullscreen viewer ──────────────────────────────────────── */

function Lightbox({ images, index, setIndex, onClose, title }) {
  const count = images.length;
  const go = useCallback((dir) => setIndex((i) => (i + dir + count) % count), [count, setIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [go, onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label={`${title} photos`}>
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="text-sm text-white/80">{index + 1} / {count}</p>
        <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="Close"><X className="h-5 w-5" /></button>
      </div>
      <div className="relative flex flex-1 items-center justify-center px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[index].url} alt={images[index].alt_text || title} className="max-h-[78vh] max-w-full rounded-lg object-contain" />
        {count > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} className="absolute left-3 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Previous photo"><ChevronLeft className="h-6 w-6" /></button>
            <button type="button" onClick={() => go(1)} className="absolute right-3 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Next photo"><ChevronRight className="h-6 w-6" /></button>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 py-4 no-scrollbar">
          {images.map((img, i) => (
            <button key={img.url ?? i} type="button" onClick={() => setIndex(i)} className={cn("shrink-0 overflow-hidden rounded-lg border-2 transition-all", i === index ? "border-white" : "border-transparent opacity-50 hover:opacity-90")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-14 w-20 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Gallery({ images, title, badge }) {
  const list = (images ?? []).filter((i) => i.url);
  const ordered = [...list.filter((i) => i.is_primary), ...list.filter((i) => !i.is_primary)];
  const [active, setActive] = useState(0);
  const [viewer, setViewer] = useState(false);
  const count = ordered.length;
  const current = ordered[active]?.url ?? VEHICLE_PLACEHOLDER_IMAGE;
  const go = (dir) => setActive((i) => (i + dir + count) % count);

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="group relative aspect-[16/10] min-w-0 flex-1 overflow-hidden rounded-3xl border bg-muted shadow-sm sm:order-2">
        <button type="button" onClick={() => count && setViewer(true)} className="block h-full w-full" aria-label="View photos full screen" disabled={!count}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current} alt={title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
        </button>
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent" />

        {badge}

        {count > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-md opacity-0 transition-opacity hover:bg-white group-hover:opacity-100" aria-label="Previous photo"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" onClick={() => go(1)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-md opacity-0 transition-opacity hover:bg-white group-hover:opacity-100" aria-label="Next photo"><ChevronRight className="h-5 w-5" /></button>
          </>
        )}
        {count > 0 && (
          <button type="button" onClick={() => setViewer(true)} className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-black/75">
            <Expand className="h-3.5 w-3.5" /> {count > 1 ? `${active + 1} / ${count} photos` : "View photo"}
          </button>
        )}
        {count === 0 && (
          <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white"><ImageIcon className="h-3.5 w-3.5" /> No photos yet</span>
        )}
      </div>

      {count > 1 && (
        // Phones: a scrolling row under the photo. sm+: a column on the left,
        // absolutely filled so it matches the main photo's height and scrolls.
        <div className="relative sm:order-1 sm:w-24 sm:shrink-0">
          <div className="flex gap-2 overflow-x-auto no-scrollbar sm:absolute sm:inset-0 sm:flex-col sm:overflow-y-auto sm:overflow-x-hidden">
            {ordered.map((img, i) => (
              <button
                key={img.url ?? i}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show photo ${i + 1}`}
                className={cn("relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-all sm:w-full", i === active ? "border-primary shadow-md" : "border-transparent opacity-70 hover:opacity-100")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {viewer && count > 0 && <Lightbox images={ordered} index={active} setIndex={setActive} onClose={() => setViewer(false)} title={title} />}
    </div>
  );
}
