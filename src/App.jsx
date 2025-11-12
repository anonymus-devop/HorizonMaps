// src/App.jsx
import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Make sure VITE_MAPBOX_TOKEN exists in your .env
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "";

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
];

export default function App() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const routeLayerId = "horizon-route-line";
  const [queryDest, setQueryDest] = useState("");
  const [queryOrigin, setQueryOrigin] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [originCoords, setOriginCoords] = useState(null); // [lng, lat]
  const [destCoords, setDestCoords] = useState(null); // [lng, lat]
  const [routeData, setRouteData] = useState(null); // Mapbox directions route object
  const [steps, setSteps] = useState([]); // turn-by-turn steps
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [navigating, setNavigating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const userMarkerRef = useRef(null);
  const navWatchIdRef = useRef(null);
  const debounceRef = useRef(null);

  // --- Init map
  useEffect(() => {
    setIsMobile(/Mobi|Android/i.test(navigator.userAgent));

    if (mapRef.current) return;
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-74.0817, 4.6097], // Bogotá default
      zoom: 11,
    });

    // Add controls
    mapRef.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

    // custom "liquid glass" user cursor element CSS inserted below
    // start geolocation tracking for UX (not yet used as origin until user clicks or we auto-set)
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showAccuracyCircle: false,
    });
    mapRef.current.addControl(geolocateControl, "top-right");

    // When geolocate triggers, set origin to "My Location" and update marker
    geolocateControl.on("geolocate", (pos) => {
      const coords = [pos.coords.longitude, pos.coords.latitude];
      setOriginCoords(coords);
      setQueryOrigin("Mi ubicación");
      placeOrMoveUserMarker(coords);
    });

    return () => {
      if (mapRef.current) mapRef.current.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Helper: place or move the custom user marker
  function placeOrMoveUserMarker(coords) {
    if (!mapRef.current) return;
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat(coords);
    } else {
      const el = document.createElement("div");
      el.className = "horizon-user-marker";
      userMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat(coords).addTo(mapRef.current);
    }
  }

  // --- Debounced suggestion fetch
  const fetchSuggestionsDebounced = (value, isOrigin = false) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value, isOrigin), 300);
  };

  // --- Get suggestions from Mapbox with Colombia filter and major cities prioritized
  async function fetchSuggestions(value, isOrigin = false) {
    if (!value || value.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const token = mapboxgl.accessToken;
    const encoded = encodeURIComponent(value);
    // Bias to Colombia and limited results
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&autocomplete=true&country=CO&limit=6`;

    try {
      const res = await fetch(url);
      const json = await res.json();
      const features = (json && json.features) || [];

      // Map Mapbox features to unified suggestion objects
      const mapboxSuggestions = features.map((f) => ({
        id: f.id,
        name: f.place_name,
        center: f.center,
        source: "mapbox",
      }));

      // Add matching major cities first if they contain the query
      const cityMatches = MAJOR_COLOMBIAN_CITIES.filter((c) =>
        c.toLowerCase().includes(value.toLowerCase())
      ).map((c) => ({ id: `city-${c}`, name: `${c}, Colombia`, center: null, source: "city" }));

      // Place city matches first, then mapbox results (de-dupe by name)
      const combined = [
        ...cityMatches,
        ...mapboxSuggestions.filter((m) => !cityMatches.some((c) => c.name === m.name)),
      ].slice(0, 6);

      setSuggestions(combined);
    } catch (err) {
      console.error("Suggestions error", err);
      setSuggestions([]);
    }
  }

  // --- When user chooses a suggestion
  const selectSuggestion = async (sugg, isOrigin = false) => {
    setSuggestions([]);
    if (!sugg) return;

    if (sugg.center) {
      // Mapbox returned coordinates
      if (isOrigin) {
        setOriginCoords(sugg.center);
        setQueryOrigin(sugg.name);
        placeOrMoveUserMarker(sugg.center);
        mapRef.current.flyTo({ center: sugg.center, zoom: 13 });
      } else {
        setDestCoords(sugg.center);
        setQueryDest(sugg.name);
        mapRef.current.flyTo({ center: sugg.center, zoom: 13 });
      }
    } else {
      // It's one of our major city placeholders: geocode it
      const token = mapboxgl.accessToken;
      const encoded = encodeURIComponent(sugg.name.replace(", Colombia", ""));
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&country=CO&limit=1`
        );
        const json = await res.json();
        const f = json.features && json.features[0];
        if (!f) return;
        const center = f.center;
        if (isOrigin) {
          setOriginCoords(center);
          setQueryOrigin(sugg.name);
          placeOrMoveUserMarker(center);
        } else {
          setDestCoords(center);
          setQueryDest(sugg.name);
        }
        mapRef.current.flyTo({ center, zoom: 12 });
      } catch (err) {
        console.error("Geocode fallback error", err);
      }
    }
  };

  // --- Build a route using Mapbox Directions API
  const planRoute = async () => {
    if (!originCoords || !destCoords) {
      alert("Selecciona origen y destino válidos.");
      return;
    }
    const token = mapboxgl.accessToken;
    const from = `${originCoords[0]},${originCoords[1]}`;
    const to = `${destCoords[0]},${destCoords[1]}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from};${to}?steps=true&geometries=geojson&overview=full&access_token=${token}&language=es`;

    try {
      const res = await fetch(url);
      const json = await res.json();
      if (!json.routes || !json.routes.length) {
        alert("No se encontró ruta.");
        return;
      }
      const route = json.routes[0];
      setRouteData(route);
      // set steps for instructions
      const legs = route.legs && route.legs[0];
      setSteps((legs && legs.steps) || []);
      setCurrentStepIndex(0);

      // draw route line
      const coords = route.geometry.coordinates;
      if (mapRef.current.getSource("horizon-route")) {
        mapRef.current.getSource("horizon-route").setData({
          type: "Feature",
          geometry: { type: "LineString", coordinates: coords },
        });
      } else {
        mapRef.current.addSource("horizon-route", {
          type: "geojson",
          data: { type: "Feature", geometry: { type: "LineString", coordinates: coords } },
        });
        // route line
        mapRef.current.addLayer({
          id: routeLayerId,
          type: "line",
          source: "horizon-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": ["interpolate", ["linear"], ["get", "progress"], 0, "#60a5fa", 1, "#7c3aed"], "line-width": 6, "line-opacity": 0.9 },
        });
      }

      // Add origin/destination markers
      addOrUpdateMarker("horizon-origin-marker", originCoords, "#34d399");
      addOrUpdateMarker("horizon-dest-marker", destCoords, "#fb7185");

      // Fit bounds
      const bounds = coords.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds(coords[0], coords[0]));
      mapRef.current.fitBounds(bounds, { padding: 80 });
    } catch (err) {
      console.error("Plan route error", err);
      alert("Error al planificar la ruta.");
    }
  };

  // --- Utility: add or update a simple colored marker
  function addOrUpdateMarker(id, coords, color = "#fff") {
    if (!mapRef.current) return;
    // store marker elements on the map object under a property name
    const key = `marker_${id}`;
    if (mapRef.current[key]) {
      mapRef.current[key].setLngLat(coords);
    } else {
      const el = document.createElement("div");
      el.className = "horizon-simple-marker";
      el.style.background = color;
      mapRef.current[key] = new mapboxgl.Marker({ element: el }).setLngLat(coords).addTo(mapRef.current);
    }
  }

  // --- Start navigation: watchPosition and update current step as user moves
  const startNavigation = () => {
    if (!routeData || !steps || steps.length === 0) {
      alert("Primero planifica la ruta.");
      return;
    }
    if (!("geolocation" in navigator)) {
      alert("El dispositivo no soporta geolocalización.");
      return;
    }

    setNavigating(true);

    // follow position
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;
        const userPos = [lng, lat];
        placeOrMoveUserMarker(userPos);
        // center if mobile and navigating
        if (isMobile) {
          mapRef.current.easeTo({ center: userPos, zoom: 15, duration: 1000 });
        }

        // Determine proximity to next step's maneuver
        const current = steps[currentStepIndex];
        if (!current) return;
        const [tLng, tLat] = current.maneuver.location;
        const distance = haversineDistance([lat, lng], [tLat, tLng]); // km

        // If within ~30 meters, advance to next step
        if (distance < 0.03 && currentStepIndex < steps.length - 1) {
          setCurrentStepIndex((i) => i + 1);
        }
      },
      (err) => {
        console.error("watchPosition error", err);
        alert("No se pudo obtener la ubicación en vivo.");
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );

    navWatchIdRef.current = watchId;
  };

  // --- Stop navigation
  const stopNavigation = () => {
    if (navWatchIdRef.current != null) {
      navigator.geolocation.clearWatch(navWatchIdRef.current);
      navWatchIdRef.current = null;
    }
    setNavigating(false);
  };

  // --- small haversine distance helper (returns km)
  function haversineDistance([lat1, lon1], [lat2, lon2]) {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // --- Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
      if (navWatchIdRef.current != null) navigator.geolocation.clearWatch(navWatchIdRef.current);
      if (userMarkerRef.current) {
        try {
          userMarkerRef.current.remove();
        } catch {}
      }
      // remove route layer if present
      if (mapRef.current && mapRef.current.getLayer && mapRef.current.getLayer(routeLayerId)) {
        try {
          mapRef.current.removeLayer(routeLayerId);
          mapRef.current.removeSource("horizon-route");
        } catch {}
      }
    };
  }, []);

  // --- UI handlers
  const onDestInput = (e) => {
    setQueryDest(e.target.value);
    fetchSuggestionsDebounced(e.target.value, false);
  };
  const onOriginInput = (e) => {
    setQueryOrigin(e.target.value);
    fetchSuggestionsDebounced(e.target.value, true);
  };

  // allow quick set of origin to current location
  const setOriginToCurrent = () => {
    if (!("geolocation" in navigator)) return alert("Geolocation not supported.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos.coords.longitude, pos.coords.latitude];
        setOriginCoords(coords);
        setQueryOrigin("Mi ubicación");
        placeOrMoveUserMarker(coords);
        mapRef.current.flyTo({ center: coords, zoom: 14 });
      },
      (err) => alert("Permiso denegado o no disponible.")
    );
  };

  return (
    <div className="w-screen h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-violet-900 text-white relative">
      {/* Map container */}
      <div ref={mapContainerRef} className="absolute inset-0" />

      {/* Liquid glass UI panel */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 w-[92%] md:w-[720px] p-4 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl z-50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">🌍 HorizonMaps</h1>
            <p className="text-xs text-white/80">Plan and navigate — optimized for Colombia</p>
          </div>

          <div className="flex gap-2 items-center">
            <button
              onClick={() => {
                // refresh map tokens or info if needed
                alert("HorizonMaps — ready");
              }}
              className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
            >
              ⚙️
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-3">
          <div>
            <label className="text-xs text-white/80">Origen</label>
            <div className="relative">
              <input
                value={queryOrigin}
                onChange={onOriginInput}
                placeholder="Mi ubicación or type an origin"
                className="w-full p-3 rounded-xl bg-white/10 placeholder-white/60 focus:outline-none"
              />
              <button
                onClick={setOriginToCurrent}
                title="Use current location"
                className="absolute right-2 top-2 bg-cyan-600 p-2 rounded-lg hover:scale-105 transition"
              >
                📍
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-white/80">Destino</label>
            <div className="relative">
              <input
                value={queryDest}
                onChange={onDestInput}
                placeholder="Where to?"
                className="w-full p-3 rounded-xl bg-white/10 placeholder-white/60 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Suggestions dropdown */}
        {suggestions.length > 0 && (
          <div className="mt-3 max-h-56 overflow-auto bg-black/60 rounded-xl border border-white/10 p-1">
            {suggestions.map((s) => (
              <div
                key={s.id}
                onClick={() => {
                  // choose depending on whether dropdown used for origin or destination.
                  // If the last typed box was dest (queryDest) => treat as dest else origin
                  const recentDest = document.activeElement === document.querySelector("input[placeholder='Where to?']");
                  selectSuggestion(s, recentDest ? false : true);
                }}
                className="px-3 py-2 hover:bg-white/10 cursor-pointer rounded-md text-sm"
              >
                {s.name}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={planRoute}
            className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-xl font-medium"
          >
            🗺️ Plan Route
          </button>

          {!navigating ? (
            <button onClick={startNavigation} className="bg-green-600 hover:bg-green-700 py-2 px-4 rounded-xl font-medium">
              ▶️ Start Nav
            </button>
          ) : (
            <button onClick={stopNavigation} className="bg-red-600 hover:bg-red-700 py-2 px-4 rounded-xl font-medium">
              ⏹ Stop
            </button>
          )}
        </div>

        {/* Route summary */}
        {routeData && (
          <div className="mt-3 text-sm bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="flex justify-between">
              <div>Distance: {(routeData.distance / 1000).toFixed(1)} km</div>
              <div>ETA: {Math.round(routeData.duration / 60)} min</div>
            </div>
          </div>
        )}

        {/* Instructions list */}
        {steps && steps.length > 0 && (
          <div className="mt-3 max-h-36 overflow-auto bg-white/5 p-3 rounded-xl border border-white/6 text-sm">
            <div className="font-semibold mb-2">Directions</div>
            {steps.map((step, idx) => (
              <div
                key={idx}
                className={`py-1 ${idx === currentStepIndex ? "text-amber-300" : "text-white/80"} ${
                  idx === currentStepIndex ? "font-semibold" : ""
                }`}
              >
                {idx + 1}. {step.maneuver.instruction}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Liquid-glass user marker CSS + small styling for simple markers */}
      <style>{`
        .horizon-user-marker {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, rgba(0,255,255,0.95), rgba(0,100,255,0.8));
          box-shadow: 0 0 18px rgba(0,200,255,0.9);
          border: 2px solid rgba(255,255,255,0.6);
          animation: pulse 1.4s infinite alternate;
        }
        @keyframes pulse {
          from { transform: scale(0.9); opacity: 0.95; }
          to { transform: scale(1.3); opacity: 0.75; }
        }
        .horizon-simple-marker {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.9);
        }
      `}</style>
    </div>
  );
}
