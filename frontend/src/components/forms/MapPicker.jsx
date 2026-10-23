"use client";

import { useEffect, useRef, useState } from "react";
import { FormField } from "@/components/forms/FormField";

const DEFAULT_CENTER = [25.2048, 55.2708]; // Dubai — a sane default when no coordinates are set yet

/**
 * Click-to-pick coordinates on an OpenStreetMap tile map (via plain Leaflet,
 * not react-leaflet, so there's no React-version peer-dependency to track).
 * Leaflet touches `window` on init, so it's loaded dynamically inside
 * useEffect rather than imported at module scope — safe under Next's SSR
 * pass for this "use client" component.
 */
export function MapPicker({ label = "Pick on Map", latitude, longitude, onChange, height = 240 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((mod) => {
      const L = mod.default ?? mod;
      if (cancelled || !containerRef.current || mapRef.current) return;

      // Default marker icon URLs break under bundlers unless pointed at the
      // package's own shipped images explicitly.
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const startLat = Number(latitude) || DEFAULT_CENTER[0];
      const startLng = Number(longitude) || DEFAULT_CENTER[1];

      const map = L.map(containerRef.current).setView([startLat, startLng], latitude && longitude ? 14 : 10);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng();
        onChangeRef.current(lat, lng);
      });
      map.on("click", (e) => {
        marker.setLatLng(e.latlng);
        onChangeRef.current(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      markerRef.current = marker;
      setReady(true);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the marker in sync if coordinates change from outside (e.g. typed
  // directly into the latitude/longitude number inputs).
  useEffect(() => {
    if (!ready || !markerRef.current || !latitude || !longitude) return;
    const lat = Number(latitude);
    const lng = Number(longitude);
    const current = markerRef.current.getLatLng();
    if (Math.abs(current.lat - lat) > 1e-9 || Math.abs(current.lng - lng) > 1e-9) {
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current?.panTo([lat, lng]);
    }
  }, [ready, latitude, longitude]);

  return (
    <FormField label={label} className="col-span-full">
      <div
        ref={containerRef}
        style={{ height }}
        className="w-full rounded-md border overflow-hidden"
      />
      <p className="mt-1 text-[11px] text-muted-foreground">Click the map or drag the marker to set the branch&apos;s coordinates.</p>
    </FormField>
  );
}
