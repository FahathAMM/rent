"use client";

import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";
import { FormField } from "@/components/forms/FormField";

const DEFAULT_CENTER = { lat: 25.2048, lng: 55.2708 }; // Dubai — a sane default when no coordinates are set yet

/**
 * Click-to-pick coordinates on a Google Map. Uses the legacy `Marker`
 * (not `AdvancedMarker`) deliberately — Advanced Markers require a Map ID
 * configured in Google Cloud Console on top of the API key, which is an
 * extra setup step this form shouldn't force on every user.
 */
export function GoogleMapPicker({ label = "Pick on Map", latitude, longitude, onChange, height = 240 }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const position = latitude && longitude ? { lat: Number(latitude), lng: Number(longitude) } : null;

  const handlePick = (e) => {
    if (!e.latLng) return;
    onChange(e.latLng.lat(), e.latLng.lng());
  };

  if (!apiKey) {
    return (
      <FormField label={label} className="col-span-full">
        <div
          style={{ height }}
          className="flex w-full items-center justify-center rounded-md border border-dashed bg-muted/30 px-4 text-center text-xs text-muted-foreground"
        >
          Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in the frontend .env to enable the map picker.
        </div>
      </FormField>
    );
  }

  return (
    <FormField label={label} className="col-span-full">
      <div style={{ height }} className="w-full overflow-hidden rounded-md border">
        <APIProvider apiKey={apiKey}>
          <Map
            defaultCenter={position ?? DEFAULT_CENTER}
            center={position ?? undefined}
            defaultZoom={position ? 14 : 10}
            gestureHandling="greedy"
            disableDefaultUI={false}
            onClick={handlePick}
          >
            {position && <Marker position={position} draggable onDragEnd={handlePick} />}
          </Map>
        </APIProvider>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Click the map or drag the marker to set the branch&apos;s coordinates.</p>
    </FormField>
  );
}
