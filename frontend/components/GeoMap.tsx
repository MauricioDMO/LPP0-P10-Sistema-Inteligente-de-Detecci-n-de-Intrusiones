"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef, useState } from "react";
import type { GeoPoint, SuricataEvent } from "@/types/suricata";
import { getDstIP, getSrcIP } from "@/lib/suricata";
import type { CircleMarker, Map as LeafletMap } from "leaflet";

type LeafletModule = typeof import("leaflet");

type GeoMapProps = {
  events: SuricataEvent[];
  resetKey: number;
};

export function GeoMap({ events, resetKey }: GeoMapProps) {
  const [mapReady, setMapReady] = useState(false);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const markersRef = useRef<CircleMarker[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!mapElementRef.current || mapRef.current) return;

      const leaflet = await import("leaflet");
      if (cancelled || !mapElementRef.current) return;

      leafletRef.current = leaflet;
      mapRef.current = leaflet.map(mapElementRef.current, { zoomControl: true, attributionControl: false }).setView([15, -10], 2);
      leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(mapRef.current);
      setMapReady(true);
    }

    initMap();

    return () => {
      cancelled = true;
      setMapReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!mapReady || !map || !leaflet) return;

    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [];

    const seenLocationKeys = new Set<string>();
    for (const event of events) {
      addMarker(leaflet, map, markersRef.current, seenLocationKeys, event, "source", event._geo?.source);
      addMarker(leaflet, map, markersRef.current, seenLocationKeys, event, "destination", event._geo?.destination);
    }
  }, [events, resetKey, mapReady]);

  return (
    <section className="map-row" aria-label="Mapa de geolocalización">
      <div className="map-box">
        <h3>Mapa de geolocalización</h3>
        <div className="map" ref={mapElementRef} />
      </div>
    </section>
  );
}

function addMarker(
  leaflet: LeafletModule,
  map: LeafletMap,
  markers: CircleMarker[],
  seenLocationKeys: Set<string>,
  event: SuricataEvent,
  direction: "source" | "destination",
  geo?: GeoPoint,
) {
  if (typeof geo?.lat !== "number" || typeof geo.lon !== "number") return;

  const locationKey = `${geo.lat.toFixed(1)},${geo.lon.toFixed(1)}`;
  if (seenLocationKeys.has(locationKey)) return;
  seenLocationKeys.add(locationKey);

  const ip = direction === "source" ? getSrcIP(event) : getDstIP(event);
  const isMalicious = event._threat?.is_malicious;
  const popupContent = `
    <div style="font-family:system-ui;font-size:13px;min-width:180px">
      <b>${ip}</b><br>
      ${geo.country ? `${geo.country}${geo.city ? `, ${geo.city}` : ""}` : ""}<br>
      ${geo.isp ? geo.isp : ""}
      ${isMalicious ? '<br><span style="color:#ff4444;font-weight:700">MALICIOSA</span>' : ""}
    </div>`;

  const marker = leaflet.circleMarker([geo.lat, geo.lon], {
    radius: 7,
    fillColor: isMalicious ? "#ff4444" : "#4dd4ac",
    color: "#fff",
    weight: 2,
    opacity: 1,
    fillOpacity: 0.8,
  }).addTo(map);

  marker.bindPopup(popupContent);
  markers.push(marker);
}
