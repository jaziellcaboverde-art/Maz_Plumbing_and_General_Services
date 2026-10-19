"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { Coordinates } from "@/lib/location/coordinates";
import styles from "./location-picker.module.css";

function CenterMap({ point, zoomToPoint }: { point: Coordinates; zoomToPoint: boolean }) {
  const map = useMap();
  useEffect(() => {
    map.setView([point.latitude, point.longitude], zoomToPoint ? 16 : map.getZoom());
  }, [map, point.latitude, point.longitude, zoomToPoint]);
  return null;
}

function MapClick({ onChange }: { onChange: (point: Coordinates) => void }) {
  useMapEvents({ click: ({ latlng }) => onChange({ latitude: latlng.lat, longitude: latlng.lng }) });
  return null;
}

function DraggablePin({ point, onChange }: { point: Coordinates; onChange: (point: Coordinates) => void }) {
  const icon = useMemo(() => L.icon({
    iconUrl: "/map-marker.png",
    iconRetinaUrl: "/map-marker-2x.png",
    shadowUrl: "/map-marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  }), []);
  return (
    <Marker
      position={[point.latitude, point.longitude]}
      icon={icon}
      draggable
      eventHandlers={{ dragend: (event) => {
        const next = event.target.getLatLng();
        onChange({ latitude: next.lat, longitude: next.lng });
      } }}
    />
  );
}

export function MapView({ point, zoomToPoint, onChange, onMapError, apiKey }: {
  point: Coordinates;
  zoomToPoint: boolean;
  onChange: (point: Coordinates) => void;
  onMapError: () => void;
  apiKey: string;
}) {
  return (
    <div className={styles.map} aria-label="Map of the Philippines">
      <MapContainer center={[point.latitude, point.longitude]} zoom={6} scrollWheelZoom className={styles.mapCanvas}>
        <TileLayer
          attribution={'<a href="https://www.geoapify.com/">Powered by Geoapify</a> | <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>'}
          url={`https://maps.geoapify.com/v1/tile/osm-carto/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(apiKey)}`}
          eventHandlers={{ tileerror: onMapError }}
        />
        <CenterMap point={point} zoomToPoint={zoomToPoint} />
        <MapClick onChange={onChange} />
        <DraggablePin point={point} onChange={onChange} />
      </MapContainer>
    </div>
  );
}
