// src/App.jsx
import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Search, Navigation, MapPin, Play, StopCircle, X } from "lucide-react";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "";

const DEFAULT_CENTER = [-74.08175, 4.60971]; // Bogotá

// Helper: Haversine (meters)
const toRad = (deg) => (deg * Math.PI) / 180;
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function App({ isPwa = false, deferredPrompt = null }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const originMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const watchIdRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [origin, setOrigin] = useState(null); // [lng, lat]
  const [dest, setDest] = useState(null); // [lng, lat]
  const [route, setRoute] = useState(null); // GeoJSON
  const [steps, setSteps] = useState([]);
  const [navigating, setNavigating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const suggestTimer = useRef(null);

  useEffect(() => {
    setIsMobile(/Mobi|Android/i.test(navigator.userAgent));
    if (mapRef.current) return;

    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: DEFAULT_CENTER,
      zoom: 11,
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    mapRef.current.on("load", () => {
      setReady(true);
      // attempts to get permission & initial location
      try {
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (p) => {
              const coords = [p.coords.longitude, p.coords.latitude];
              setOrigin(coords);
              placeOriginMarker(coords);
              flyTo(coords, 13);
            },
            () => {},
            { enableHighAccuracy: true, maximumAge: 60_000, timeout: 5_000 }
          );
        }
      } catch (e) {}
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // helpers
  function flyTo(coords, zm = 14) {
    try {
      mapRef.current?.flyTo({ center: coords, zoom: zm });
    } catch (e) {}
  }
  function createMarker(elColor = "#00E5FF", pulse = true) {
    const el = document.createElement("div");
    el.style.width = "18px";
    el.style.height = "18px";
    el.style.borderRadius = "50%";
    el.style.background = elColor;
    el.style.border = "2px solid rgba(255,255,255,0.9)";
    if (pulse) el.style.animation = "hmPulse 1.5s infinite alternate";
    return el;
  }
  function placeUserMarker(coords) {
    if (!mapRef.current) return;
    if (userMarkerRef.current) userMarkerRef.current.setLngLat(coords);
    else userMarkerRef.current = new mapboxgl.Marker({ element: createMarker("#00E5FF", true) }).setLngLat(coords).addTo(mapRef.current);
  }
  function placeOriginMarker(coords) {
    if (!mapRef.current) return;
    if (originMarkerRef.current) originMarkerRef.current.setLngLat(coords);
    else originMarkerRef.current = new mapboxgl.Marker({ element: createMarker("#34D399", false) }).setLngLat(coords).addTo(mapRef.current);
  }
  function placeDestMarker(coords) {
    if (!mapRef.current) return;
    if (destMarkerRef.current) destMarkerRef.current.setLngLat(coords);
    else destMarkerRef.current = new mapboxgl.Marker({ element: createMarker("#FB7185", false) }).setLngLat(coords).addTo(mapRef.current);
  }
  function removeRouteLayer() {
    try {
      if (mapRef.current.getLayer("hm-route")) mapRef.current.removeLayer("hm-route");
      if (mapRef.current.getSource("hm-route")) mapRef.current.removeSource("hm-route");
    } catch (e) {}
  }

  // --- Suggestions (Mapbox Geocoding)
  function fetchSuggestions(q) {
    if (!q || q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    if (!mapboxgl.accessToken) {
      // fallback: show main Colombian cities
      const cities = ["Bogotá", "Medellín", "Cali", "Cartagena", "Barranquilla"].filter((c) =>
        c.toLowerCase().includes(q.toLowerCase())
      );
      setSuggestions(cities.map((c) => ({ place_name: `${c}, Colombia`, fallback: true })));
      setShowSuggestions(true);
      return;
    }
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${mapboxgl.accessToken}&autocomplete=true&country=CO&limit=6`;
    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        setSuggestions(json.features || []);
        setShowSuggestions(true);
      })
      .catch((e) => {
        console.error("suggest", e);
        setSuggestions([]);
      });
  }
  function scheduleSuggest(q) {
    clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(() => fetchSuggestions(q), 280);
  }

  // suggestion click
  async function onPickSuggestion(s) {
    setShowSuggestions(false);
    if (!s) return;
    if (s.fallback) {
      // simple fallback geocoding mapping for a few cities
      const quick = { Bogotá: [-74.08175, 4.60971], Medellín: [-75.5636, 6.2442], Cali: [-76.5225, 3.4516] };
      const name = s.place_name.split(",")[0];
      const coords = quick[name] || DEFAULT_CENTER;
      setDest(coords);
      placeDestMarker(coords);
      flyTo(coords, 12);
      return;
    }
    // Mapbox feature
    const coords = s.center;
    setDest(coords);
    placeDestMarker(coords);
    flyTo(coords, 13);
  }

  // --- Set origin from device
  function setOriginFromDevice() {
    if (!("geolocation" in navigator)) return alert("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const coords = [p.coords.longitude, p.coords.latitude];
        setOrigin(coords);
        placeOriginMarker(coords);
        placeUserMarker(coords);
        flyTo(coords, 14);
      },
      (err) => {
        alert("Location permission denied or timeout");
      },
      { enableHighAccuracy: true }
    );
  }

  // --- Plan route using Mapbox Directions (returns route geometry & steps)
  async function planRoute() {
    if (!origin || !dest) return alert("Set origin and destination first");
    if (!mapboxgl.accessToken) return alert("Set VITE_MAPBOX_TOKEN in .env");
    removeRouteLayer();
    const from = `${origin[0]},${origin[1]}`;
    const to = `${dest[0]},${dest[1]}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from};${to}?steps=true&geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}&language=es`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (!json.routes || json.routes.length === 0) {
        return alert("No route found");
      }
      const r = json.routes[0];
      const geo = r.geometry;
      // draw line
      mapRef.current.addSource("hm-route", { type: "geojson", data: { type: "Feature", geometry: geo } });
      mapRef.current.addLayer({
        id: "hm-route",
        type: "line",
        source: "hm-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#60a5fa", "line-width": 6, "line-opacity": 0.95 },
      });
      setRoute(geo);
      // extract steps of first leg
      const st = (r.legs && r.legs[0] && r.legs[0].steps) || [];
      setSteps(st);
      setCurrentStep(0);
      // fit bounds
      const coords = geo.coordinates;
      const bounds = coords.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds(coords[0], coords[0]));
      mapRef.current.fitBounds(bounds, { padding: 80, duration: 800 });
    } catch (err) {
      console.error("planRoute", err);
      alert("Failed to get directions");
    }
  }

  // --- Live navigation behavior (keeps recalculating if off-route)
  function startNavigation() {
    if (!route) return alert("Plan a route before starting navigation");
    if (!("geolocation" in navigator)) return alert("Geolocation not supported");

    setNavigating(true);
    // clear previous watch
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // set watch
    const id = navigator.geolocation.watchPosition(
      async (p) => {
        const lng = p.coords.longitude;
        const lat = p.coords.latitude;
        placeUserMarker([lng, lat]);

        // center on user while navigating on mobile
        if (isMobile) {
          flyTo([lng, lat], 15);
        }

        // if we have steps, check proximity to current maneuver
        if (steps && steps.length) {
          const step = steps[currentStep];
          if (step && step.maneuver && step.maneuver.location) {
            const [tLng, tLat] = step.maneuver.location;
            const meters = haversineMeters(lat, lng, tLat, tLng);
            // if within 25m, advance to next
            if (meters < 25 && currentStep < steps.length - 1) {
              setCurrentStep((i) => i + 1);
            }
          }
        }

        // Off-route detection: compute distance to nearest point on route (approx) -> if > 40m, re-route from current pos
        if (route && route.coordinates && route.coordinates.length > 0) {
          // fast sampling: compute min distance to route vertices (approx)
          const minMeters = route.coordinates.reduce((min, c) => {
            const d = haversineMeters(lat, lng, c[1], c[0]);
            return d < min ? d : min;
          }, Infinity);
          if (minMeters > 40) {
            // Off route: re-plan from current position to original destination
            try {
              // update origin to this position
              const newOrigin = [lng, lat];
              setOrigin(newOrigin);
              placeOriginMarker(newOrigin);
              // re-request directions (dest unchanged)
              const from = `${newOrigin[0]},${newOrigin[1]}`;
              const to = `${dest[0]},${dest[1]}`;
              const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from};${to}?steps=true&geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}&language=es`;
              const res = await fetch(url);
              const j = await res.json();
              if (j.routes && j.routes[0]) {
                const newGeo = j.routes[0].geometry;
                // update route source
                if (mapRef.current.getSource("hm-route")) {
                  mapRef.current.getSource("hm-route").setData({ type: "Feature", geometry: newGeo });
                } else {
                  // fallback: add source/layer
                  mapRef.current.addSource("hm-route", { type: "geojson", data: { type: "Feature", geometry: newGeo } });
                  mapRef.current.addLayer({
                    id: "hm-route",
                    type: "line",
                    source: "hm-route",
                    paint: { "line-color": "#60a5fa", "line-width": 6 },
                  });
                }
                setRoute(newGeo);
                const newSteps = (j.routes[0].legs && j.routes[0].legs[0] && j.routes[0].legs[0].steps) || [];
                setSteps(newSteps);
                setCurrentStep(0);
              }
            } catch (err) {
              console.error("replan error", err);
            }
          }
        }
      },
      (err) => {
        console.error("nav watch error", err);
        alert("Failed to read location. Check permissions.");
        stopNavigation();
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 8000 }
    );

    watchIdRef.current = id;
  }

  function stopNavigation() {
    try {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    } catch (e) {}
    setNavigating(false);
  }

  // --- UI handlers
  function onQueryChange(e) {
    setQuery(e.target.value);
    scheduleSuggest(e.target.value);
  }
  function scheduleSuggest(q) {
    clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(() => fetchSuggestions(q), 260);
  }
  function fetchSuggestions(q) {
    if (!q || q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    if (!mapboxgl.accessToken) {
      // fallback
      const quick = ["Bogotá", "Medellín", "Cali", "Cartagena"].filter((n) => n.toLowerCase().includes(q.toLowerCase()));
      setSuggestions(quick.map((c) => ({ place_name: `${c}, Colombia`, fallback: true })));
      setShowSuggestions(true);
      return;
    }
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${mapboxgl.accessToken}&autocomplete=true&country=CO&limit=6`;
    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        setSuggestions(json.features || []);
        setShowSuggestions(true);
      })
      .catch((e) => {
        console.error("suggest", e);
      });
  }

  // choose suggestion & set dest
  async function pickSuggestion(s) {
    setShowSuggestions(false);
    if (!s) return;
    if (s.fallback) {
      const m = { Bogotá: [-74.08175, 4.60971], Medellín: [-75.5636, 6.2442], Cali: [-76.5225, 3.4516] };
      const city = s.place_name.split(",")[0];
      const coords = m[city] || DEFAULT_CENTER;
      setDest(coords);
      placeDestMarker(coords);
      flyTo(coords);
      return;
    }
    // real feature
    const coords = s.center;
    setDest(coords);
    placeDestMarker(coords);
    flyTo(coords);
  }

  // quick action: clear route & markers
  function clearAll() {
    removeRouteLayer();
    if (originMarkerRef.current) originMarkerRef.current.remove(), (originMarkerRef.current = null);
    if (destMarkerRef.current) destMarkerRef.current.remove(), (destMarkerRef.current = null);
    if (userMarkerRef.current) userMarkerRef.current.remove(), (userMarkerRef.current = null);
    setOrigin(null);
    setDest(null);
    setRoute(null);
    setSteps([]);
    setCurrentStep(0);
  }

  // small helper: flyTo
  function flyTo(coords, z = 14) {
    try {
      mapRef.current.flyTo({ center: coords, zoom: z });
    } catch (e) {}
  }

  // keyboard Enter triggers first suggestion or plan if dest set
  function onInputKeyDown(e) {
    if (e.key === "Enter") {
      if (showSuggestions && suggestions[0]) pickSuggestion(suggestions[0]);
      else if (dest && origin) planRoute();
    }
  }

  // cleanup
  useEffect(() => {
    return () => {
      clearTimeout(suggestTimer.current);
      try {
        if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      } catch (e) {}
    };
  }, []);

  // small CSS injection for pulse
  const pulseStyle = (
    <style>
      {`@keyframes hmPulse {0%{transform:scale(0.95);opacity:1}100%{transform:scale(1.2);opacity:0.75}}`}
    </style>
  );

  return (
    <div className="w-screen h-screen relative bg-gradient-to-br from-blue-900 via-indigo-900 to-violet-900 text-white">
      {pulseStyle}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Top unified glass bar */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-50 w-[92%] md:w-[900px]">
        <div className="backdrop-blur-xl bg-white/8 border border-white/20 rounded-3xl p-3 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/6">
              <Search className="w-5 h-5 text-white/90" />
            </div>

            <div className="flex-1 relative">
              <input
                value={query}
                onChange={onQueryChange}
                onKeyDown={onInputKeyDown}
                placeholder="Search destination (Colombia) or type a place..."
                className="w-full bg-transparent outline-none placeholder-white/60 text-white p-3 rounded-xl"
                aria-label="destination"
                onFocus={() => query && scheduleSuggest(query)}
              />

              {showSuggestions && suggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-2 bg-black/60 border border-white/10 rounded-xl max-h-56 overflow-auto z-60 p-1">
                  {suggestions.map((s, idx) => (
                    <div
                      key={s.id ?? `${s.place_name}-${idx}`}
                      onClick={() => pickSuggestion(s)}
                      className="px-3 py-2 hover:bg-white/10 cursor-pointer rounded-md text-sm"
                    >
                      {s.place_name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button title="My location" onClick={setOriginFromDevice} className="bg-white/6 hover:bg-white/12 p-2 rounded-md">
                <MapPin className="w-5 h-5 text-white/90" />
              </button>

              <button title="Plan route" onClick={planRoute} className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-md">
                Plan
              </button>

              {!navigating ? (
                <button title="Start nav" onClick={startNavigation} className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-md">
                  <Play className="w-4 h-4" />
                </button>
              ) : (
                <button title="Stop nav" onClick={stopNavigation} className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-md">
                  <StopCircle className="w-4 h-4" />
                </button>
              )}

              <button title="Clear" onClick={clearAll} className="bg-white/6 hover:bg-white/12 p-2 rounded-md">
                <X className="w-5 h-5 text-white/90" />
              </button>
            </div>
          </div>

          {/* route summary */}
          {route && (
            <div className="mt-3 text-sm text-white/90 flex items-center justify-between">
              <div>Distance: <strong>{(route && route.coordinates ? (route.coordinates.length && "—") : "—")}</strong></div>
              <div>ETA: <strong>—</strong></div>
            </div>
          )}
        </div>
      </div>

      {/* bottom turn-by-turn */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 w-[92%] md:w-[800px]">
        <div className="backdrop-blur-xl bg-white/6 border border-white/10 rounded-2xl p-3 shadow-xl max-h-48 overflow-auto">
          {steps && steps.length > 0 ? (
            <div>
              <div className="text-sm text-white/80 mb-2">Directions</div>
              <div className="space-y-2">
                {steps.map((s, i) => (
                  <div key={i} className={`p-2 rounded-md ${i === currentStep ? "bg-white/10 text-amber-200" : "text-white/80"}`}>
                    <div className="text-xs">{Math.round(s.distance)} m</div>
                    <div>{s.maneuver && s.maneuver.instruction}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-white/70">No route planned.</div>
          )}
        </div>
      </div>
    </div>
  );
}
