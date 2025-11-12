// src/App.jsx
// HorizonMaps - unified app with Mapbox, suggestions, route planning, navigation tracking,
// liquid-glass UI using Tailwind classes, Colombia-biased suggestions, robust cleanup.
//
// Requirements:
// - npm install mapbox-gl lucide-react
// - .env: VITE_MAPBOX_TOKEN=pk.YOUR_TOKEN
//
// This file is intentionally long and verbose to include all helper functions, error handling,
// UI states, and comments for easy localization / extension.

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  Search,
  Navigation,
  MapPin,
  X,
  Clock,
  Loader2,
  Play,
  StopCircle,
  RefreshCw,
} from "lucide-react"; // icons used in the UI

// Mapbox token via Vite env
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "";

// --- Constants & config
const DEFAULT_CENTER = [-74.08175, 4.60971]; // Bogotá
const DEFAULT_ZOOM = 11;
const SUGGEST_DEBOUNCE_MS = 300;
const SUGGEST_LIMIT = 6;
const DIRECTIONS_PROFILE = "driving"; // can be "walking", "cycling"
const COLOMBIA_COUNTRY_CODE = "CO";
const MAJOR_COLOMBIAN_CITIES = [
  "Bogotá",
  "Medellín",
  "Cali",
  "Cartagena",
  "Barranquilla",
  "Bucaramanga",
  "Santa Marta",
  "Pereira",
  "Manizales",
  "Villavicencio",
  "Cúcuta",
  "Ibagué",
  "Sincelejo",
];

function noop() {}

// small utility: sleep (ms)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Haversine distance (meters)
function haversineMeters([lat1, lon1], [lat2, lon2]) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Safe fetch wrapper with JSON parse
async function safeFetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

// --- Main App
export default function App() {
  // map refs
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  // user marker & route marker refs
  const userMarkerRef = useRef(null);
  const originMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);

  // watch id for live navigation
  const watchIdRef = useRef(null);

  // debounce timer
  const suggestTimerRef = useRef(null);

  // state
  const [isReady, setIsReady] = useState(false); // map loaded
  const [isLoading, setIsLoading] = useState(false); // general loading
  const [query, setQuery] = useState(""); // main unified search bar
  const [suggestions, setSuggestions] = useState([]); // suggestion list
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [originCoords, setOriginCoords] = useState(null); // [lng, lat]
  const [destCoords, setDestCoords] = useState(null); // [lng, lat]
  const [routeGeoJSON, setRouteGeoJSON] = useState(null); // GeoJSON LineString
  const [routeSummary, setRouteSummary] = useState(null); // {distance, duration}
  const [stepsList, setStepsList] = useState([]); // array of steps
  const [navigating, setNavigating] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [lastSearchType, setLastSearchType] = useState("dest"); // "origin" or "dest" for ambiguous clicks

  // --- Initialize map once
  useEffect(() => {
    setIsMobile(/Mobi|Android/i.test(navigator.userAgent));
    if (mapRef.current) return;

    // Basic guard: no token -> show friendly message overlay when ready
    if (!mapboxgl.accessToken) {
      console.warn("VITE_MAPBOX_TOKEN not set. Mapbox will not load.");
    }

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v10",
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    // add nav controls (we hide top-right extra UI by default)
    mapRef.current.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");

    // geolocate control but don't show built-in UI: create but we won't add to top-right to keep UI minimal
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showAccuracyCircle: false,
    });

    // We'll call geolocate.trigger() when we want to set origin automatically
    // Hook load
    mapRef.current.on("load", () => {
      setIsReady(true);
      // auto-trigger geolocate on load to set origin if allowed
      try {
        geolocate.trigger();
      } catch (e) {
        // ignore
      }
    });

    mapRef.current.on("error", (e) => {
      console.error("Map error", e);
      setErrorMessage("Map failed to load. Check network and token.");
    });

    // Clean up on unmount
    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {}
        mapRef.current = null;
      }
    };
  }, []);

  // --- Helpers to add/update markers
  function createMarkerElement(color = "#1E90FF", withPulse = true) {
    const el = document.createElement("div");
    el.style.width = "18px";
    el.style.height = "18px";
    el.style.borderRadius = "50%";
    el.style.background = color;
    el.style.boxShadow = "0 0 12px rgba(0,0,0,0.6)";
    el.style.border = "2px solid rgba(255,255,255,0.9)";
    if (withPulse) {
      el.style.animation = "hm-pulse 1.6s infinite alternate";
    }
    return el;
  }

  // add or update user marker
  function placeOrMoveUserMarker([lng, lat]) {
    if (!mapRef.current) return;
    try {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLngLat([lng, lat]);
      } else {
        const el = createMarkerElement("#00E5FF", true);
        userMarkerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(mapRef.current);
      }
    } catch (e) {
      console.warn("placeOrMoveUserMarker error", e);
    }
  }

  // origin / dest markers
  function setSimpleMarker(refHolder, coords, color = "#34d399") {
    if (!mapRef.current) return;
    try {
      if (refHolder.current) {
        refHolder.current.setLngLat(coords);
      } else {
        const el = createMarkerElement(color, false);
        refHolder.current = new mapboxgl.Marker({ element: el }).setLngLat(coords).addTo(mapRef.current);
      }
    } catch (e) {
      console.warn("setSimpleMarker error", e);
    }
  }

  // remove marker safely
  function removeMarker(refHolder) {
    try {
      if (refHolder.current) {
        refHolder.current.remove();
        refHolder.current = null;
      }
    } catch (e) {}
  }

  // --- Suggestion logic (debounced)
  async function doSuggest(queryText) {
    if (!queryText || queryText.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    // Build Mapbox geocoding URL
    const token = mapboxgl.accessToken;
    if (!token) {
      // fallback: local major cities that match the query
      const localMatches = MAJOR_COLOMBIAN_CITIES.filter((c) =>
        c.toLowerCase().includes(queryText.toLowerCase())
      ).map((c) => ({ id: `city-${c}`, place_name: `${c}, Colombia`, center: null }));
      setSuggestions(localMatches.slice(0, SUGGEST_LIMIT));
      setShowSuggestions(true);
      return;
    }

    const encoded = encodeURIComponent(queryText);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&autocomplete=true&country=${COLOMBIA_COUNTRY_CODE}&limit=${SUGGEST_LIMIT}`;
    try {
      const json = await safeFetchJSON(url);
      const features = json.features || [];
      // Prepend major city matches if they contain query (de-dupe)
      const cityMatches = MAJOR_COLOMBIAN_CITIES.filter((c) =>
        c.toLowerCase().includes(queryText.toLowerCase())
      ).map((c) => ({ id: `city-${c}`, place_name: `${c}, Colombia`, center: null }));

      // combine
      const combined = [
        ...cityMatches,
        ...features.filter((f) => !cityMatches.some((c) => c.place_name === f.place_name)),
      ].slice(0, SUGGEST_LIMIT);

      setSuggestions(combined);
      setShowSuggestions(true);
    } catch (err) {
      console.error("Suggest fetch failed", err);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }

  function scheduleSuggest(q) {
    clearTimeout(suggestTimerRef.current);
    suggestTimerRef.current = setTimeout(() => doSuggest(q), SUGGEST_DEBOUNCE_MS);
  }

  // on query change (unified search input)
  function onQueryChange(e) {
    const v = e.target.value;
    setQuery(v);
    scheduleSuggest(v);
    setLastSearchType("dest"); // by default treat search as destination input
  }

  // choose suggestion
  async function chooseSuggestion(s) {
    setShowSuggestions(false);
    setSuggestions([]);
    if (!s) return;

    // If s.center is null, it's our major city placeholder -> geocode it
    if (!s.center) {
      // geocode
      const token = mapboxgl.accessToken;
      if (!token) {
        // fallback: find city coords from rough mapping or default to Bogotá
        const city = s.place_name.split(",")[0];
        // simple map for a few major cities (latitude/longitude)
        const quick = {
          Bogotá: [-74.08175, 4.60971],
          Medellín: [-75.5636, 6.2442],
          Cali: [-76.5225, 3.4516],
          Cartagena: [-75.4810, 10.3910],
          Barranquilla: [-74.7813, 10.9685],
        };
        const c = quick[city] || DEFAULT_CENTER;
        setDestCoords(c);
        setQuery(s.place_name);
        setSimpleMarker(destMarkerRef, c, "#fb7185");
        if (mapRef.current) mapRef.current.flyTo({ center: c, zoom: 12 });
        return;
      }
      try {
        const encoded = encodeURIComponent(s.place_name.split(",")[0]);
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&country=${COLOMBIA_COUNTRY_CODE}&limit=1`;
        const json = await safeFetchJSON(url);
        const f = json.features && json.features[0];
        if (!f) throw new Error("No geocode results");
        const center = f.center;
        setDestCoords(center);
        setQuery(s.place_name);
        setSimpleMarker(destMarkerRef, center, "#fb7185");
        if (mapRef.current) mapRef.current.flyTo({ center, zoom: 12 });
        return;
      } catch (err) {
        console.error("geocode fallback error", err);
        setErrorMessage("Failed to geocode selected city.");
        return;
      }
    }

    // If we have center coords from mapbox
    const center = s.center;
    setDestCoords(center);
    setQuery(s.place_name);
    setSimpleMarker(destMarkerRef, center, "#fb7185");
    if (mapRef.current) mapRef.current.flyTo({ center, zoom: 13 });
  }

  // --- Set origin via browser geolocation
  function setOriginToCurrent() {
    if (!("geolocation" in navigator)) {
      alert("Geolocation not supported by this device.");
      return;
    }
    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        const coords = [longitude, latitude];
        setOriginCoords(coords);
        setSimpleMarker(originMarkerRef, coords, "#34d399");
        placeOrMoveUserMarker(coords);
        try {
          mapRef.current.flyTo({ center: coords, zoom: 14 });
        } catch (e) {}
        setIsLoading(false);
      },
      (err) => {
        console.error("geolocation failed", err);
        setIsLoading(false);
        alert("Failed to get location or permission denied.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // --- Plan route between originCoords and destCoords using Mapbox Directions API
  async function planRoute() {
    setErrorMessage(null);
    if (!originCoords) {
      alert("Please set origin (My Location) first.");
      return;
    }
    if (!destCoords) {
      alert("Please choose a destination.");
      return;
    }
    const token = mapboxgl.accessToken;
    if (!token) {
      setErrorMessage("Mapbox token not set. Cannot request directions.");
      return;
    }

    setIsLoading(true);
    try {
      const from = `${originCoords[0]},${originCoords[1]}`;
      const to = `${destCoords[0]},${destCoords[1]}`;
      const url = `https://api.mapbox.com/directions/v5/mapbox/${DIRECTIONS_PROFILE}/${from};${to}?steps=true&geometries=geojson&overview=full&access_token=${token}&language=es`;
      const json = await safeFetchJSON(url);
      const route = json.routes && json.routes[0];
      if (!route) {
        throw new Error("No route found");
      }

      // route geometry and display
      const coords = route.geometry.coordinates;
      const geojson = {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: coords },
      };

      setRouteGeoJSON(geojson);
      setRouteSummary({ distance: route.distance, duration: route.duration });
      // extract steps from first leg (common)
      const legs = route.legs && route.legs[0];
      setStepsList((legs && legs.steps) || []);
      setCurrentStepIndex(0);

      // Draw on map
      if (!mapRef.current) throw new Error("Map not ready");
      // remove previous route layer/source safely
      try {
        if (mapRef.current.getLayer("horizon-route")) {
          mapRef.current.removeLayer("horizon-route");
        }
        if (mapRef.current.getSource("horizon-route")) {
          mapRef.current.removeSource("horizon-route");
        }
      } catch (e) {}

      mapRef.current.addSource("horizon-route", { type: "geojson", data: geojson });
      mapRef.current.addLayer({
        id: "horizon-route",
        type: "line",
        source: "horizon-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#60a5fa",
          "line-width": 6,
          "line-opacity": 0.95,
        },
      });

      // place origin/dest markers if not already
      setSimpleMarker(originMarkerRef, originCoords, "#34d399");
      setSimpleMarker(destMarkerRef, destCoords, "#fb7185");

      // fit bounds to route
      const bounds = coords.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds(coords[0], coords[0]));
      mapRef.current.fitBounds(bounds, { padding: 80, duration: 1000 });

      setIsLoading(false);
    } catch (err) {
      console.error("planRoute error", err);
      setErrorMessage("Failed to plan route. Try again.");
      setIsLoading(false);
    }
  }

  // --- Start navigation: watchPosition, update marker and step index
  function startNavigation() {
    if (!routeGeoJSON) {
      alert("No route planned. Please plan a route first.");
      return;
    }
    if (!("geolocation" in navigator)) {
      alert("Geolocation not supported.");
      return;
    }

    setNavigating(true);
    // clear any existing watch
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // watch position
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;
        placeOrMoveUserMarker([lng, lat]);

        // center follow on mobile
        if (isMobile) {
          try {
            mapRef.current.easeTo({ center: [lng, lat], zoom: 15, duration: 500 });
          } catch (e) {}
        }

        // update step index by checking proximity to next maneuver location
        const step = stepsList[currentStepIndex];
        if (step && step.maneuver && step.maneuver.location) {
          const [targetLng, targetLat] = step.maneuver.location;
          const meters = haversineMeters([lat, lng], [targetLat, targetLng]);
          // if within 30 meters go to next
          if (meters < 30 && currentStepIndex < stepsList.length - 1) {
            setCurrentStepIndex((i) => i + 1);
          }
        }
      },
      (err) => {
        console.error("watchPosition error", err);
        alert("Failed to track location. Check permissions.");
        stopNavigation();
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );

    watchIdRef.current = id;
  }

  // Stop navigation
  function stopNavigation() {
    if (watchIdRef.current != null) {
      try {
        navigator.geolocation.clearWatch(watchIdRef.current);
      } catch (e) {}
      watchIdRef.current = null;
    }
    setNavigating(false);
  }

  // quick helper: clear route
  function clearRoute() {
    try {
      if (mapRef.current && mapRef.current.getLayer && mapRef.current.getLayer("horizon-route")) {
        mapRef.current.removeLayer("horizon-route");
      }
      if (mapRef.current && mapRef.current.getSource && mapRef.current.getSource("horizon-route")) {
        mapRef.current.removeSource("horizon-route");
      }
    } catch (e) {}
    setRouteGeoJSON(null);
    setRouteSummary(null);
    setStepsList([]);
    setCurrentStepIndex(0);
    removeMarker(destMarkerRef);
  }

  // --- UI action: quick set origin to current location and mark it
  const quickSetOrigin = () => {
    setOriginToCurrent();
    setLastSearchType("origin");
  };

  // --- Persist a friendly fallback UI for when Mapbox fails
  // render small overlay if token missing
  const renderTokenWarning = () => {
    if (mapboxgl.accessToken) return null;
    return (
      <div className="absolute inset-0 z-60 flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto bg-white/90 text-slate-900 rounded-2xl p-6 shadow-xl max-w-lg text-center">
          <h2 className="text-lg font-semibold mb-2">Mapbox token missing</h2>
          <p className="text-sm mb-4">Set <code>VITE_MAPBOX_TOKEN</code> in your .env to enable maps.</p>
        </div>
      </div>
    );
  };

  // small accessibility: keyboard navigation for suggestions
  function onKeyDownHandler(e) {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      // move focus to suggestion list (not implemented focus wise) - skip for simplicity
    }
    if (e.key === "Enter") {
      // choose top suggestion
      if (suggestions[0]) chooseSuggestion(suggestions[0]);
    }
  }

  // cleanup on unmount: remove watchPosition etc
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        try {
          navigator.geolocation.clearWatch(watchIdRef.current);
        } catch (e) {}
      }
      clearTimeout(suggestTimerRef.current);
    };
  }, []);

  // --- UI markup
  return (
    <div className="w-screen h-screen relative bg-gradient-to-br from-blue-900 via-indigo-900 to-violet-900 text-white overflow-hidden">
      {/* Map container */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0" />

      {/* Top unified liquid glass search bar (merged actions inside) */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-40 w-[92%] md:w-[900px]">
        <div className="backdrop-blur-xl bg-white/8 border border-white/20 rounded-3xl p-3 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-white/6">
                <Search className="w-5 h-5 text-white/90" />
              </div>
            </div>

            {/* Search input */}
            <div className="flex-1 relative">
              <input
                value={query}
                onChange={onQueryChange}
                onKeyDown={onKeyDownHandler}
                onFocus={() => query && scheduleSuggest(query)}
                placeholder="Search destination or type a Colombian city..."
                className="w-full bg-transparent outline-none placeholder-white/60 text-white p-3 rounded-xl"
                aria-label="Search destination"
              />

              {/* Suggestion box */}
              {showSuggestions && suggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-2 bg-black/60 border border-white/10 rounded-xl max-h-56 overflow-auto z-50 p-1">
                  {suggestions.map((s, idx) => (
                    <div
                      key={s.id ?? `${s.place_name}-${idx}`}
                      onClick={() => {
                        chooseSuggestion(s);
                        setShowSuggestions(false);
                      }}
                      className="px-3 py-2 hover:bg-white/10 cursor-pointer rounded-md text-sm"
                    >
                      {s.place_name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Compact action buttons inside the bar */}
            <div className="flex items-center gap-2">
              <button
                title="Set origin to current location"
                onClick={quickSetOrigin}
                className="bg-white/6 hover:bg-white/12 p-2 rounded-md"
              >
                <MapPin className="w-5 h-5 text-white/90" />
              </button>

              <button
                title="Plan route"
                onClick={planRoute}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-md font-medium flex items-center gap-2"
              >
                <Clock className="w-4 h-4" />
                Plan
              </button>

              {!navigating ? (
                <button
                  title="Start navigation"
                  onClick={startNavigation}
                  className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-md font-medium flex items-center gap-2"
                >
                  <Play className="w-4 h-4" /> Start
                </button>
              ) : (
                <button
                  title="Stop navigation"
                  onClick={stopNavigation}
                  className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-md font-medium flex items-center gap-2"
                >
                  <StopCircle className="w-4 h-4" /> Stop
                </button>
              )}

              <button
                title="Clear route"
                onClick={() => {
                  clearRoute();
                }}
                className="bg-white/6 hover:bg-white/12 p-2 rounded-md"
              >
                <X className="w-5 h-5 text-white/90" />
              </button>
            </div>
          </div>

          {/* route summary shown in the top bar below if exists */}
          {routeSummary && (
            <div className="mt-3 text-sm text-white/90 flex items-center justify-between">
              <div>
                Distance: <strong>{(routeSummary.distance / 1000).toFixed(2)} km</strong>
              </div>
              <div>
                ETA: <strong>{Math.round(routeSummary.duration / 60)} min</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Small bottom panel with steps list (liquid glass) */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 w-[92%] md:w-[800px]">
        <div className="backdrop-blur-xl bg-white/6 border border-white/10 rounded-2xl p-3 shadow-xl max-h-48 overflow-auto">
          {isLoading ? (
            <div className="flex items-center gap-3">
              <Loader2 className="animate-spin" />
              Loading...
            </div>
          ) : routeGeoJSON ? (
            <div>
              <div className="text-sm text-white/80 mb-2">Turn-by-turn</div>
              <div className="space-y-2">
                {stepsList.map((st, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-md ${idx === currentStepIndex ? "bg-white/10 text-amber-200" : "text-white/80"}`}
                  >
                    <div className="text-xs">{Math.round(st.distance)} m • {st.duration ? Math.round(st.duration) : ""} s</div>
                    <div>{st.maneuver && st.maneuver.instruction}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-white/70">No route planned. Use the search bar to plan a route.</div>
          )}
        </div>
      </div>

      {/* small floating right recenter button */}
      <div className="absolute right-4 bottom-28 z-40">
        <button
          onClick={() => {
            if (originCoords) {
              mapRef.current?.flyTo({ center: originCoords, zoom: 14 });
            } else {
              // fallback re-center to default
              mapRef.current?.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
            }
          }}
          className="bg-white/8 hover:bg-white/14 p-3 rounded-full shadow-lg"
          title="Center on origin"
        >
          <RefreshCw className="w-5 h-5 text-white/90" />
        </button>
      </div>

      {/* token missing overlay */}
      {renderTokenWarning()}

      {/* small CSS for pulse animation (embedded here for convenience) */}
      <style>{`
        @keyframes hm-pulse {
          0% { transform: scale(0.95); opacity: 1; }
          100% { transform: scale(1.2); opacity: 0.75; }
        }
        /* light scrollbar for suggestion list on dark background */
        .::-webkit-scrollbar { height: 8px; width: 8px; }
        .::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 8px; }
      `}</style>

      {/* Inline minimal error banner (bottom-left) */}
      {errorMessage && (
        <div className="absolute left-4 bottom-4 bg-red-700/90 text-white px-3 py-2 rounded-md shadow-lg z-50">
          {errorMessage}
          <button className="ml-3 underline" onClick={() => setErrorMessage(null)}>Dismiss</button>
        </div>
      )}
    </div>
  );
}
