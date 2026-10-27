"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { placeCoords, SRI_LANKA_CENTER } from "@/lib/sriLankaPlaces";
import { cn } from "@/lib/utils";

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

/**
 * Sri Lanka map with a count bubble per city that has vehicles. Plain
 * Leaflet loaded inside useEffect (it touches `window`) — same approach as
 * MapPicker. `activeCity` (hovered in the list beside it) enlarges that
 * city's bubble; clicking a bubble opens `hrefFor(point)`, or /browse for
 * the city by default. Points with a zero count render as a grey dot.
 */
export function LocationsMap({ cities, activeCity, hrefFor, className }) {
  const router = useRouter();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const routerRef = useRef(router);
  routerRef.current = router;
  const hrefForRef = useRef(hrefFor);
  hrefForRef.current = hrefFor;

  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((mod) => {
      const L = mod.default ?? mod;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: SRI_LANKA_CENTER,
        zoom: 7,
        minZoom: 6,
        maxZoom: 12,
        // Quarter-level steps so fitBounds can fill the box instead of rounding down a whole level.
        zoomSnap: 0.25,
        zoomDelta: 0.5,
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
      });
      // Drop the "Leaflet" prefix; the OpenStreetMap credit stays (required by the ODbL tile licence).
      map.attributionControl.setPrefix(false);

      // Same OSM tiles as MapPicker (CARTO's prettier basemaps need a licence for commercial sites).
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const max = Math.max(1, ...cities.map((c) => c.vehicle_count));
      const bounds = [];

      cities.forEach((c) => {
        const coords = placeCoords(c.city, c.district);
        if (!coords) return;
        bounds.push(coords);
        // Same bubble style for every place, 0 included; busier places are just bigger.
        const count = Number(c.vehicle_count) || 0;
        const empty = count === 0;
        const size = Math.round(30 + (count / max) * 18);
        const icon = L.divIcon({
          className: "",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          html: `<div class="ll-pin" style="width:${size}px;height:${size}px"><span>${count}</span></div>`,
        });
        const marker = L.marker(coords, { icon, title: c.city, riseOnHover: true, zIndexOffset: empty ? -100 : 0 }).addTo(map);
        // City names are shop-entered free text — escape before it becomes tooltip HTML.
        const detail = `${count} vehicle${count === 1 ? "" : "s"}`;
        marker.bindTooltip(`<strong>${escapeHtml(c.city)}</strong><br/>${detail}`, {
          direction: "top",
          offset: [0, -size / 2],
        });
        marker.on("click", () => routerRef.current.push(hrefForRef.current ? hrefForRef.current(c) : `/browse?city=${encodeURIComponent(c.city)}`));
        markersRef.current[c.city] = marker;
      });

      // Tight padding (just enough for the outermost bubbles) so the island fills the map.
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 9 });
      else if (bounds.length === 1) map.setView(bounds[0], 9);

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
    // Rebuild only when the set of cities changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities.map((c) => `${c.city}:${c.vehicle_count}`).join("|")]);

  useEffect(() => {
    Object.entries(markersRef.current).forEach(([city, marker]) => {
      const el = marker.getElement()?.firstElementChild;
      if (!el) return;
      const active = city === activeCity;
      el.classList.toggle("ll-pin-active", active);
      marker.setZIndexOffset(active ? 1000 : 0);
      if (active) marker.openTooltip();
      else marker.closeTooltip();
    });
  }, [activeCity]);

  // `isolate` keeps Leaflet's z-index 400+ panes from painting over the sticky site header.
  return <div ref={containerRef} className={cn("ll-map isolate", className)} aria-label="Map of rental locations in Sri Lanka" />;
}
