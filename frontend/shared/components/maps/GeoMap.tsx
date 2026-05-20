"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef, useState } from "react";
import type { HistoricalGeoPoint } from "@/types/analytics";
import type { GeoPoint, SuricataEvent } from "@/types/suricata";
import { getDstIP, getSrcIP } from "@/lib/suricata";
import type { CircleMarker, Map as LeafletMap } from "leaflet";

type LeafletModule = typeof import("leaflet");

type GeoMapProps = {
  events?: SuricataEvent[];
  resetKey?: number;
  points?: HistoricalGeoPoint[];
  mode?: "live" | "heatmap";
  title?: string;
  subtitle?: string;
};

export function GeoMap({ events = [], resetKey = 0, points = [], mode = "live", title = "Mapa de geolocalización", subtitle = "Source / destination" }: GeoMapProps) {
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
      mapRef.current = leaflet
        .map(mapElementRef.current, {
          attributionControl: false,
          boxZoom: false,
          doubleClickZoom: false,
          dragging: false,
          keyboard: false,
          scrollWheelZoom: false,
          touchZoom: false,
          zoomControl: false,
        })
        .setView([15, -10], 2);
      leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 2, minZoom: 2 }).addTo(mapRef.current);
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

    if (mode === "heatmap") {
      for (const point of points) addHeatMarker(leaflet, map, markersRef.current, point);
    } else {
      const seenLocationKeys = new Set<string>();
      for (const event of events) {
        addMarker(leaflet, map, markersRef.current, seenLocationKeys, event, "source", event._geo?.source);
        addMarker(leaflet, map, markersRef.current, seenLocationKeys, event, "destination", event._geo?.destination);
      }
    }
  }, [events, points, resetKey, mode, mapReady]);

  return (
    <section className="relative overflow-hidden rounded-lg border border-soc-outline/80 bg-soc-low/80 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)]" aria-label="Mapa de geolocalización">
      <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-soc-orange/45 via-soc-primary/35 to-transparent" />
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-soc-muted">{title}</h2>
        <span className="font-mono text-xs text-soc-muted">{subtitle}</span>
      </div>
      <div className="h-[320px] overflow-hidden rounded border border-soc-outline bg-soc-lowest brightness-75 contrast-110 saturate-75 md:h-[372px] [&_.leaflet-tile-pane]:opacity-60" ref={mapElementRef} />
    </section>
  );
}

function addHeatMarker(leaflet: LeafletModule, map: LeafletMap, markers: CircleMarker[], point: HistoricalGeoPoint) {
  if (typeof point.lat !== "number" || typeof point.lon !== "number") return;

  const intensity = Math.max(1, point.count);
  const radius = Math.min(30, 8 + Math.sqrt(intensity) * 5);
  const color = intensity >= 15 ? "#ef4444" : intensity >= 6 ? "#f59e0b" : "#4d8eff";
  const popupContent = `
    <div style="font-size:12px;min-width:190px;line-height:1.45">
      <div style="font-family:monospace;font-weight:800;color:#fff">${point.count} eventos</div>
      <div>${point.country ? `${point.country}${point.city ? `, ${point.city}` : ""}` : "Ubicación no disponible"}</div>
      <div style="color:#8c909f">${point.isp ? point.isp : "ISP no disponible"}</div>
    </div>`;

  const marker = leaflet.circleMarker([point.lat, point.lon], {
    radius,
    fillColor: color,
    color,
    weight: 1,
    opacity: 0.9,
    fillOpacity: 0.34,
  }).addTo(map);

  marker.bindPopup(popupContent);
  markers.push(marker);
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
  const confidence = event._threat?.confidence ?? 0;
  const popupContent = `
    <div style="font-size:12px;min-width:190px;line-height:1.45">
      <div style="font-family:monospace;font-weight:800;color:#fff">${ip}</div>
      <div style="color:#c2c6d6">${direction === "source" ? "Origen" : "Destino"}</div>
      <div>${geo.country ? `${geo.country}${geo.city ? `, ${geo.city}` : ""}` : "Ubicación no disponible"}</div>
      <div style="color:#8c909f">${geo.isp ? geo.isp : "ISP no disponible"}</div>
      ${isMalicious ? `<div style="margin-top:6px;color:#ffb4ab;font-weight:800">MALICIOSA ${confidence}%</div>` : ""}
    </div>`;

  const marker = leaflet.circleMarker([geo.lat, geo.lon], {
    radius: isMalicious ? 9 : 7,
    fillColor: isMalicious ? "#ef4444" : direction === "source" ? "#4d8eff" : "#4ade80",
    color: isMalicious ? "#ffb4ab" : "#e1e2ec",
    weight: 2,
    opacity: 1,
    fillOpacity: 0.82,
  }).addTo(map);

  marker.bindPopup(popupContent);
  markers.push(marker);
}
