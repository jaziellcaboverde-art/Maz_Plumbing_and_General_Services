"use client";

import dynamic from "next/dynamic";
import { Locate, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import type { AddressParts } from "@/lib/location/address-parts";
import type { Coordinates } from "@/lib/location/coordinates";
import { createClient } from "@/lib/supabase/browser";
import styles from "./location-picker.module.css";

const MapView = dynamic(() => import("./map-view").then((module) => module.MapView), {
  ssr: false,
  loading: () => <div className={styles.mapLoading} role="status">Loading map…</div>,
});

type SearchResult = Coordinates & { label: string; city: string; province: string; postcode: string; parts?: AddressParts };
type Props = {
  initialPoint?: Coordinates;
  target?: "address" | "provider";
  recordId?: string;
  onSaved?: (point: Coordinates, address?: string) => void;
  /** Called when a chosen search result, a moved pin or the device location gives street, barangay and city. */
  onAddress?: (parts: AddressParts) => void;
};

const DEFAULT_POINT = { latitude: 12.8797, longitude: 121.774 };

/**
 * Signed in people send their token. Visitors without an account send none: address search and pin lookup
 * accept them (with a small allowance, see lib/location/guest-limit.ts) so a provider can pick a base
 * location while applying. Saving a location to a record still needs sign in, and the save route checks it.
 */
async function getAuthorizationHeader(): Promise<{ authorization?: string }> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {};
}

export function LocationPicker({ initialPoint, target, recordId, onSaved, onAddress }: Props) {
  const [point, setPoint] = useState(initialPoint ?? DEFAULT_POINT);
  const [query, setQuery] = useState("");
  const [selectedAddress, setSelectedAddress] = useState("");
  const [locationSource, setLocationSource] = useState<"unset" | "initial" | "query" | "search" | "map" | "current">(initialPoint ? "initial" : "unset");
  const [landmark, setLandmark] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [message, setMessage] = useState("Search an address or move the pin to the correct place.");
  const [status, setStatus] = useState<"info" | "loading" | "error" | "success">("info");
  const [saving, setSaving] = useState(false);
  const [locationAccuracyMeters, setLocationAccuracyMeters] = useState<number | null>(null);
  const [zoomToPoint, setZoomToPoint] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const reverseRequest = useRef<AbortController | null>(null);
  const mapApiKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    request.current?.abort();
    reverseRequest.current?.abort();
  }, []);

  function search(value: string) {
    setQuery(value);
    setSelectedAddress("");
    setLocationSource("query");
    setResults([]);
    reverseRequest.current?.abort();
    if (timer.current) clearTimeout(timer.current);
    request.current?.abort();
    if (value.trim().length < 3) {
      setStatus("info");
      setMessage("Enter at least 3 characters to search.");
      return;
    }
    timer.current = setTimeout(async () => {
      const controller = new AbortController();
      request.current = controller;
      setStatus("loading");
      setMessage("Searching Philippine addresses…");
      try {
        const authorization = await getAuthorizationHeader();
        const response = await fetch("/api/location/geocode", {
          method: "POST",
          headers: { "content-type": "application/json", ...authorization },
          body: JSON.stringify({ text: value.trim() }),
          signal: controller.signal,
        });
        const payload = await response.json() as { results?: SearchResult[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Address search failed.");
        setResults(payload.results ?? []);
        setStatus("info");
        setMessage(payload.results?.length ? "Choose the closest address, then adjust the pin if needed." : "No Philippine address found. Try another search or move the pin.");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Address search failed. Enter a landmark instead.");
      }
    }, 350);
  }

  function lookupPinAddress(next: Coordinates, source: "map" | "current", accuracyMeters?: number) {
    if (timer.current) clearTimeout(timer.current);
    request.current?.abort();
    reverseRequest.current?.abort();
    const controller = new AbortController();
    reverseRequest.current = controller;
    setSelectedAddress("");
    setPoint(next);
    setLocationSource(source);
    setLocationAccuracyMeters(source === "current" && Number.isFinite(accuracyMeters) ? accuracyMeters! : null);
    setQuery("");
    setResults([]);
    setStatus("loading");
    setMessage("Looking up the address at the pin…");

    void getAuthorizationHeader().then((authorization) => fetch("/api/location/reverse", {
      method: "POST",
      headers: { "content-type": "application/json", ...authorization },
      body: JSON.stringify(next),
      signal: controller.signal,
    })).then(async (response) => {
      const payload = await response.json() as { label?: string; parts?: AddressParts; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not look up the address at this pin.");
      if (controller.signal.aborted) return;
      setQuery(payload.label ?? "");
      setSelectedAddress(payload.label ?? "");
      if (payload.parts) onAddress?.(payload.parts);
      setStatus("info");
      setMessage(source === "current"
        ? "This is the closest mapped address for your device location. The address fields above were filled in. Check the pin and the fields before saving."
        : "Address updated from the pin and the address fields above were filled in. You can edit them or add a landmark.");
    }).catch((error: unknown) => {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Address lookup failed. You can still enter a landmark.");
    });
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setStatus("error");
      setMessage("This browser cannot get your location. Move the pin or search an address.");
      return;
    }
    setStatus("loading");
    setLocationAccuracyMeters(null);
    setMessage("Getting your current location…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setZoomToPoint(true);
        lookupPinAddress({ latitude: coords.latitude, longitude: coords.longitude }, "current", coords.accuracy);
      },
      (error) => {
        setStatus("error");
        setMessage(error.code === error.PERMISSION_DENIED
          ? "Location permission was denied. Allow access or move the pin manually."
          : error.code === error.POSITION_UNAVAILABLE
            ? "No location signal is available. Search an address or move the pin manually."
            : "Location request timed out. Try again or move the pin manually.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }

  async function save() {
    if ((!target || !recordId) && !onSaved) {
      setStatus("error");
      setMessage("Not saved. Sign in as a test customer with an address or a test provider with a provider profile.");
      return;
    }
    setSaving(true);
    setStatus("loading");
    setMessage(locationSource === "query" ? "Finding the address and saving its location…" : "Checking and saving this location…");
    try {
      if (locationSource === "unset") throw new Error("Choose an address, move the pin, or use your current location before saving.");
      let pointToSave = point;
      let addressToSave = selectedAddress.trim();
      if (locationSource === "query") {
        const addressQuery = query.trim();
        if (addressQuery.length < 3) throw new Error("Enter an address, choose a suggestion, or move the pin before saving.");
        const authorization = await getAuthorizationHeader();
        const searchResponse = await fetch("/api/location/geocode", {
          method: "POST",
          headers: { "content-type": "application/json", ...authorization },
          body: JSON.stringify({ text: addressQuery }),
        });
        const searchPayload = await searchResponse.json() as { results?: SearchResult[]; error?: string };
        if (!searchResponse.ok) throw new Error(searchPayload.error ?? "Address search failed. Choose a suggestion or move the pin.");
        const match = searchPayload.results?.[0];
        if (!match) throw new Error("No matching Philippine address found. Choose a suggestion or move the pin manually.");
        pointToSave = { latitude: match.latitude, longitude: match.longitude };
        addressToSave = match.label;
        if (match.parts) onAddress?.(match.parts);
        setPoint(pointToSave);
        setQuery(match.label);
        setSelectedAddress(match.label);
        setResults([]);
        setLocationSource("search");
      }
      if (!addressToSave) throw new Error("Wait for the address lookup or choose an address suggestion before saving.");
      if ((!target || !recordId) && onSaved) {
        onSaved(pointToSave, addressToSave);
        setStatus("success");
        setMessage("Base location selected.");
        return;
      }
      const authorization = await getAuthorizationHeader();
      const response = await fetch("/api/location/save", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...authorization,
        },
        body: JSON.stringify({ target, recordId, landmark, ...pointToSave }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Location could not be saved.");
      onSaved?.(pointToSave, addressToSave);
      setStatus("success");
      setMessage("Location saved.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Location could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.picker} aria-labelledby="location-heading">
      <h2 id="location-heading">Choose a location</h2>
      <label className={styles.label} htmlFor="location-search">Search an address</label>
      <div className={styles.searchInput}>
        <Search className={styles.fieldIcon} aria-hidden="true" />
        <input id="location-search" className={`${styles.search} ${styles.searchWithIcon}`} value={query} onChange={(event) => search(event.target.value)} autoComplete="street-address" />
      </div>
      {results.length > 0 && (
        <ul className={styles.results} aria-label="Address suggestions">
          {results.map((result, index) => (
            <li key={`${result.longitude}:${result.latitude}:${index}`}>
              <button type="button" className={styles.result} onClick={() => {
                setPoint({ latitude: result.latitude, longitude: result.longitude });
                setQuery(result.label);
                setSelectedAddress(result.label);
                setLocationSource("search");
                setResults([]);
                if (result.parts) onAddress?.(result.parts);
                setStatus("info");
                setMessage("The address fields above were filled in. Check them, then adjust the pin to the exact entrance or landmark.");
              }}>{result.label}</button>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.actions}>
        <Button variant="secondary" type="button" onClick={locateMe}>
          <Locate className={styles.fieldIcon} aria-hidden="true" />
          Use my current location
        </Button>
      </div>
      <label className={styles.label} htmlFor="location-landmark">Landmark (optional)</label>
      <input id="location-landmark" className={styles.search} value={landmark} maxLength={300} onChange={(event) => setLandmark(event.target.value)} placeholder="Nearby building, gate, or landmark" />
      {mapApiKey ? (
        <MapView point={point} zoomToPoint={zoomToPoint} onChange={(next) => lookupPinAddress(next, "map")} onMapError={() => {
          setStatus("error");
          setMessage("Map tiles did not load. Search an address or check your connection.");
        }} apiKey={mapApiKey} />
      ) : (
        <div className={styles.mapLoading} role="status">Add NEXT_PUBLIC_GEOAPIFY_API_KEY to .env.local to load the map. Address search and saving need GEOAPIFY_API_KEY.</div>
      )}
      <p className={styles.coordinates}>Selected point: {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)} (latitude, longitude)</p>
      {locationAccuracyMeters !== null && (
        <p className={styles.coordinates}>
          Device location accuracy: about ±{Math.round(locationAccuracyMeters)} m. The address is an approximate map match; check the pin before saving.
        </p>
      )}
      <StatusMessage status={status === "loading" ? "info" : status}>{message}</StatusMessage>
      <Button
        variant="primary"
        type="button"
        loading={saving}
        onClick={save}
        disabled={saving || ((!target || !recordId) && !onSaved)}
        disabledReason={(!target || !recordId) && !onSaved ? "Choose an address or move the pin first." : undefined}
      >
        {target && recordId ? "Save location" : "Use this location"}
      </Button>
      <p className={styles.attribution}>Map data © OpenStreetMap contributors. Powered by Geoapify.</p>
    </section>
  );
}
