import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  MapPin,
  Play,
  StopCircle,
  X,
  Navigation,
  Video,
  Camera,
} from "lucide-react";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "";

/**
 * HorizonMaps - Complete App.jsx
 * Features:
 *  - Mapbox map (dark)
 *  - Suggestion/autocomplete (Mapbox geocoding)
 *  - Plan route (Mapbox directions -> geojson)
 *  - Start/stop navigation with real-time tracking (watchPosition)
 *  - Step-by-step directions, step progression, voice guidance (SpeechSynthesis)
 *  - Off-route detection and auto re-route
 *  - Live View AR overlay (camera feed + instruction HUD)
 *  - PWA helpers: wake lock, orientation lock, high-accuracy geolocation
 *  - Accessibility: aria labels, keyboard focus, announcements
 *
 * Note: For full Android Auto support you will need a native Android app (Kotlin)
 * that connects via intents / Car App API. This PWA is "Capacitor-ready" and
 * contains hooks (comments) for native plugin integration.
 */

/* ---------- Helpers ---------- */
const DEFAULT_CENTER = [-74.08175, 4.60971]; // Bogotá
const IOS_SPRING = { type: "spring", stiffness: 140, damping: 18 };

const toRad = (deg) => (deg * Math.PI) / 180;
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* Safe speak wrapper for TalkBack/VoiceOver and voice guidance */
function speak(text, lang = "es-CO") {
  try {
    if (!("speechSynthesis" in window)) return;
    const ut = new SpeechSynthesisUtterance(text);
    ut.lang = lang;
    ut.rate = 1.0;
    ut.pitch = 1.0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(ut);
  } catch (e) {
    console.warn("Speech error", e);
  }
}

/* ---------- Main Component ---------- */
export default function App() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const originMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const routeSourceId = "hm-route-source";
  const routeLayerId = "hm-route-layer";
  const watchIdRef = useRef(null);
  const suggestTimer = useRef(null);
  const wakeLockRef = useRef(null);

  /* State */
  const [ready, setReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [origin, setOrigin] = useState(null); // [lng, lat]
  const [dest, setDest] = useState(null); // [lng, lat]
  const [route, setRoute] = useState(null); // geojson geometry
  const [steps, setSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);

  const [navigating, setNavigating] = useState(false);
  const [liveView, setLiveView] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);

  const [trackingId, setTrackingId] = useState(null);
  const [following, setFollowing] = useState(true); // if true center on user while nav

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  /* ---------- Init Map ---------- */
  useEffect(() => {
    setIsMobile(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: DEFAULT_CENTER,
      zoom: 12,
      pitch: 45, // Add pitch for 3D feel
      bearing: 0,
    });
    mapRef.current = map;

    // Add default controls
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

    map.on("load", () => {
      setReady(true);
      // Try to get current location once
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (p) => {
            const coords = [p.coords.longitude, p.coords.latitude];
            setOrigin(coords);
            placeOriginMarker(coords);
            placeUserMarker(coords);
            flyTo(coords, 14, { animate: false });
          },
          (err) => {
            console.warn("Geolocation error, using default location (Bogotá):", err);
            // Fallback to Bogotá if GPS fails
            setOrigin(DEFAULT_CENTER);
            placeOriginMarker(DEFAULT_CENTER);
            placeUserMarker(DEFAULT_CENTER);
            flyTo(DEFAULT_CENTER, 12, { animate: false });
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60_000 }
        );
      }
    });

    // cleanup
    return () => {
      try {
        map.remove();
      } catch (e) { }
      mapRef.current = null;
    };
  }, []);

  /* ---------- Markers & map helpers ---------- */
  function createDotElement(size = 18, color = "#00E5FF", pulse = false) {
    const el = document.createElement("div");
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.borderRadius = "50%";
    el.style.background = color;
    el.style.border = "2px solid rgba(255,255,255,0.95)";
    el.style.boxShadow = `0 0 10px ${color}`;
    if (pulse) el.style.animation = "hmPulse 1.5s infinite alternate";
    return el;
  }

  function placeUserMarker([lng, lat]) {
    if (!mapRef.current) return;
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([lng, lat]);
    } else {
      userMarkerRef.current = new mapboxgl.Marker({ element: createDotElement(20, "#00E5FF", true) })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);
    }
  }

  function placeOriginMarker([lng, lat]) {
    if (!mapRef.current) return;
    if (originMarkerRef.current) {
      originMarkerRef.current.setLngLat([lng, lat]);
    } else {
      originMarkerRef.current = new mapboxgl.Marker({ element: createDotElement(16, "#34D399", false) })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);
    }
  }

  function placeDestMarker([lng, lat]) {
    if (!mapRef.current) return;
    if (destMarkerRef.current) {
      destMarkerRef.current.setLngLat([lng, lat]);
    } else {
      destMarkerRef.current = new mapboxgl.Marker({ element: createDotElement(16, "#FB7185", false) })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);
    }
  }

  function removeRouteLayer() {
    try {
      if (!mapRef.current) return;
      if (mapRef.current.getLayer(routeLayerId)) mapRef.current.removeLayer(routeLayerId);
      if (mapRef.current.getSource(routeSourceId)) mapRef.current.removeSource(routeSourceId);
    } catch (e) {
      console.warn("removeRouteLayer", e);
    }
  }

  function drawRoute(geojson) {
    try {
      if (!mapRef.current) return;
      if (mapRef.current.getSource(routeSourceId)) {
        mapRef.current.getSource(routeSourceId).setData({ type: "Feature", geometry: geojson });
      } else {
        mapRef.current.addSource(routeSourceId, { type: "geojson", data: { type: "Feature", geometry: geojson } });
        mapRef.current.addLayer({
          id: routeLayerId,
          type: "line",
          source: routeSourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#38bdf8", // Sky blue
            "line-width": 6,
            "line-opacity": 0.9,
            "line-blur": 1
          },
        });
        // Add a glow effect layer
        mapRef.current.addLayer({
          id: routeLayerId + "-glow",
          type: "line",
          source: routeSourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#0ea5e9",
            "line-width": 12,
            "line-opacity": 0.4,
            "line-blur": 4
          },
          beforeId: routeLayerId
        });
      }
    } catch (e) {
      console.warn("drawRoute", e);
    }
  }

  function flyTo([lng, lat], zoom = 15, opts = { animate: true }) {
    try {
      mapRef.current?.flyTo({ center: [lng, lat], zoom, speed: 1.2, curve: 1.42, essential: true, pitch: 50 });
    } catch (e) { }
  }

  /* ---------- Suggestions (Mapbox geocoding) ---------- */
  function fetchSuggestions(q) {
    if (!q || q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    if (!mapboxgl.accessToken) {
      // fallback list for Colombia major cities
      const fallback = ["Bogotá", "Medellín", "Cali", "Cartagena", "Barranquilla"].filter((c) =>
        c.toLowerCase().includes(q.toLowerCase())
      );
      setSuggestions(fallback.map((c) => ({ place_name: `${c}, Colombia`, fallback: true })));
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
        console.warn("suggest error", e);
        setSuggestions([]);
        setShowSuggestions(false);
      });
  }

  function scheduleSuggest(q) {
    clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(() => fetchSuggestions(q), 280);
  }

  async function pickSuggestion(s) {
    setShowSuggestions(false);
    if (!s) return;
    if (s.fallback) {
      // fallback coords for cities
      const mapCities = {
        Bogotá: [-74.08175, 4.60971],
        Medellín: [-75.5636, 6.2442],
        Cali: [-76.5225, 3.4516],
      };
      const city = s.place_name.split(",")[0];
      const coords = mapCities[city] || DEFAULT_CENTER;
      setDest(coords);
      placeDestMarker(coords);
      flyTo(coords);
      speak(`${city} seleccionado`);
      setQuery(city);
      return;
    }
    const coords = s.center;
    setDest(coords);
    placeDestMarker(coords);
    flyTo(coords);
    speak(`${s.place_name}`);
    setQuery(s.place_name);
  }

  /* ---------- Origin from device + center button ---------- */
  function setOriginFromDevice() {
    if (!("geolocation" in navigator)) return showError("Geolocalización no soportada");
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLoading(false);
        const coords = [p.coords.longitude, p.coords.latitude];
        setOrigin(coords);
        placeOriginMarker(coords);
        placeUserMarker(coords);
        flyTo(coords);
        speak("Ubicación actual centrada");
      },
      (err) => {
        setLoading(false);
        console.warn("origin position error", err);
        showError("No se pudo obtener ubicación.");
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 8000 }
    );
  }

  function showError(msg) {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4000);
  }

  /* ---------- Plan Route (Mapbox Directions API - geojson) ---------- */
  async function planRoute() {
    if (!origin || !dest) return showError("Seleccione origen y destino.");
    removeRouteLayer();
    setLoading(true);

    const from = `${origin[0]},${origin[1]}`;
    const to = `${dest[0]},${dest[1]}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from};${to}?steps=true&geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}&language=es`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      setLoading(false);
      if (!json.routes || json.routes.length === 0) {
        showError("No se encontró ruta.");
        return;
      }
      const r = json.routes[0];
      setRoute(r.geometry);
      drawRoute(r.geometry);

      // steps: take first leg
      const newSteps = (r.legs && r.legs[0] && r.legs[0].steps) || [];
      setSteps(newSteps);
      setCurrentStep(0);

      // Fit bounds nicely
      const coords = r.geometry.coordinates;
      const bounds = coords.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds(coords[0], coords[0]));
      mapRef.current.fitBounds(bounds, { padding: 100, duration: 1000 });

      speak("Ruta planificada. Iniciar navegación.");
    } catch (err) {
      setLoading(false);
      console.error("planRoute error", err);
      showError("Error al planificar la ruta.");
    }
  }

  /* ---------- Navigation: start / stop and live tracking ---------- */
  async function startNavigation() {
    if (!route) return alert("Planifique la ruta antes de iniciar la navegación.");
    if (!("geolocation" in navigator)) return alert("Geolocation not supported");

    // Request wake lock for PWA navigation
    try {
      if ("wakeLock" in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch (e) {
      console.warn("Wake lock failed", e);
    }

    // Optionally lock screen orientation (best-effort)
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock("portrait").catch(() => { });
      }
    } catch (e) { }

    setNavigating(true);
    // Clear previous watch
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Start watchPosition for live updates
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;
        const heading = pos.coords.heading; // Get heading if available

        placeUserMarker([lng, lat]);

        if (following && isMobile) {
          // center on user for mobile nav with smooth transition
          // Use easeTo for smoother continuous updates than flyTo
          mapRef.current?.easeTo({
            center: [lng, lat],
            bearing: heading || 0, // Rotate map with heading
            pitch: 60, // Tilt for 3D nav view
            duration: 1000,
            easing: (t) => t, // Linear easing for continuous updates
          });
        }

        // Step progression: check distance to current step maneuver
        if (steps && steps.length) {
          const step = steps[currentStep];
          if (step && step.maneuver && step.maneuver.location) {
            const [tLng, tLat] = step.maneuver.location;
            const meters = haversineMeters(lat, lng, tLat, tLng);
            // when close, advance and announce
            if (meters < 30 && currentStep < steps.length - 1) { // Increased threshold slightly
              setCurrentStep((i) => {
                const nextIndex = i + 1;
                const nextStep = steps[nextIndex];
                if (nextStep?.maneuver?.instruction) speak(nextStep.maneuver.instruction);
                return nextIndex;
              });
            }
          }
        }

        // Off-route detection (approx distance to route vertices)
        if (route && route.coordinates && route.coordinates.length > 0) {
          // compute nearest vertex distance (fast approximate)
          const minMeters = route.coordinates.reduce((min, c) => {
            const d = haversineMeters(lat, lng, c[1], c[0]);
            return d < min ? d : min;
          }, Infinity);
          if (minMeters > 50) { // Increased tolerance
            // off-route: request new route from current position to dest
            try {
              const newOrigin = [lng, lat];
              setOrigin(newOrigin);
              placeOriginMarker(newOrigin);
              speak("Recalculando ruta...");

              // Re-plan route
              const from = `${newOrigin[0]},${newOrigin[1]}`;
              const to = `${dest[0]},${dest[1]}`;
              const rUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${from};${to}?steps=true&geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}&language=es`;
              const rRes = await fetch(rUrl);
              const rJ = await rRes.json();
              if (rJ.routes && rJ.routes[0]) {
                const newGeo = rJ.routes[0].geometry;
                setRoute(newGeo);
                drawRoute(newGeo);
                const newSteps = (rJ.routes[0].legs && rJ.routes[0].legs[0] && rJ.routes[0].legs[0].steps) || [];
                setSteps(newSteps);
                setCurrentStep(0);
              }
            } catch (err) {
              console.warn("replan error", err);
            }
          }
        }
      },
      (err) => {
        console.error("watchPosition error", err);
        showError("Error leyendo ubicación.");
        stopNavigation();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 } // stricter settings for nav
    );

    watchIdRef.current = id;
  }

  function stopNavigation() {
    try {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    } catch (e) { }
    // release wake lock
    try {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch (e) { }
    setNavigating(false);
    speak("Navegación detenida");
  }

  /* ---------- Live View AR overlay (camera feed + HUD instruction) ---------- */
  async function startLiveView() {
    if (liveView) {
      stopLiveView();
      return;
    }
    if (!("mediaDevices" in navigator && navigator.mediaDevices.getUserMedia)) {
      return alert("Cámara no soportada en este navegador.");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
        audio: false,
      });
      setCameraStream(stream);
      setLiveView(true);
      // autoplay is handled by <video> element below
      speak("Vista en vivo activada");
    } catch (e) {
      console.error("camera error", e);
      alert("No se pudo activar la cámara (permiso denegado).");
    }
  }

  function stopLiveView() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    setLiveView(false);
    speak("Vista en vivo desactivada");
  }

  /* ---------- Clear all ---------- */
  function clearAll() {
    removeRouteLayer();
    originMarkerRef.current?.remove();
    destMarkerRef.current?.remove();
    userMarkerRef.current?.remove();
    setOrigin(null);
    setDest(null);
    setRoute(null);
    setSteps([]);
    setCurrentStep(0);
    stopNavigation();
  }

  /* ---------- Keyboard & auxiliary handlers ---------- */
  function onInputKeyDown(e) {
    if (e.key === "Enter") {
      if (showSuggestions && suggestions[0]) pickSuggestion(suggestions[0]);
      else if (dest && origin) planRoute();
    }
  }

  useEffect(() => {
    // cleanup on unmount
    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  /* ---------- Render ---------- */
  return (
    <div className="w-screen h-screen relative bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white overflow-hidden font-sans selection:bg-cyan-500/30">
      {/* pulse keyframes */}
      <style>{`
        @keyframes hmPulse {0%{transform:scale(0.95);opacity:1;box-shadow:0 0 0 0 rgba(0,229,255,0.7)}70%{transform:scale(1);opacity:1;box-shadow:0 0 0 10px rgba(0,229,255,0)}100%{transform:scale(0.95);opacity:1;box-shadow:0 0 0 0 rgba(0,229,255,0)}}
        .glass-panel { background: rgba(255, 255, 255, 0.08); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.12); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.36); }
        .glass-input { background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.1); }
        .glass-btn { background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.1); transition: all 0.2s ease; }
        .glass-btn:hover { background: rgba(255, 255, 255, 0.2); transform: translateY(-1px); }
        .glass-btn:active { transform: translateY(0); }
      `}</style>

      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0 z-0" />

      {/* Top glass bar */}
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...IOS_SPRING, delay: 0.2 }}
        className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[94%] md:w-[600px]"
      >
        <div className="glass-panel rounded-3xl p-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/5 text-cyan-400">
              <Search className="w-5 h-5" />
            </div>

            <div className="flex-1 relative">
              <input
                aria-label="Buscar destino"
                value={query}
                onChange={(e) => { setQuery(e.target.value); scheduleSuggest(e.target.value); }}
                onKeyDown={onInputKeyDown}
                placeholder="¿A dónde vamos?"
                className="w-full bg-transparent outline-none placeholder-white/40 text-white text-lg font-medium p-2"
                onFocus={() => query && scheduleSuggest(query)}
              />

              {/* Suggestions dropdown */}
              <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full left-0 right-0 mt-3 glass-panel rounded-2xl overflow-hidden z-60 py-2"
                    role="listbox"
                    aria-label="Sugerencias"
                  >
                    {suggestions.map((s, idx) => (
                      <div
                        role="option"
                        tabIndex={0}
                        key={s.id ?? `${s.place_name}-${idx}`}
                        onClick={() => pickSuggestion(s)}
                        onKeyDown={(e) => { if (e.key === "Enter") pickSuggestion(s); }}
                        className="px-4 py-3 hover:bg-white/10 cursor-pointer text-sm border-b border-white/5 last:border-0 flex items-center gap-3 transition-colors"
                      >
                        <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="truncate">{s.place_name}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-2">
              <button aria-label="Mi ubicación" onClick={setOriginFromDevice} className="glass-btn p-2.5 rounded-xl text-white/90">
                <MapPin className="w-5 h-5" />
              </button>

              {/* Action Buttons Group */}
              <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
                <button
                  aria-label="Planear ruta"
                  onClick={planRoute}
                  className="p-2 rounded-lg hover:bg-white/10 text-blue-400 transition-colors"
                >
                  <Navigation className="w-5 h-5" />
                </button>

                {!navigating ? (
                  <button
                    aria-label="Iniciar navegación"
                    onClick={startNavigation}
                    className="p-2 rounded-lg hover:bg-white/10 text-emerald-400 transition-colors"
                  >
                    <Play className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    aria-label="Detener navegación"
                    onClick={stopNavigation}
                    className="p-2 rounded-lg hover:bg-white/10 text-rose-400 transition-colors"
                  >
                    <StopCircle className="w-5 h-5" />
                  </button>
                )}
              </div>

              <button aria-label="Limpiar" onClick={clearAll} className="glass-btn p-2.5 rounded-xl text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* route summary small */}
          <AnimatePresence>
            {route && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-sm px-1">
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="text-cyan-400 font-bold text-lg">
                      {Math.round((route?.coordinates?.reduce((acc, c, i, arr) => {
                        if (i === 0) return 0;
                        const prev = arr[i - 1];
                        return acc + haversineMeters(prev[1], prev[0], c[1], c[0]);
                      }, 0)) / 1000 || 0).toFixed(1)}
                    </span>
                    <span className="text-xs uppercase tracking-wider font-medium">km</span>
                  </div>
                  <div className="text-white/60 text-xs">Tiempo estimado: -- min</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Center locate button (bottom-right) */}
      <motion.button
        aria-label="Centrar en mi ubicación"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          if (!origin) setOriginFromDevice();
          else flyTo(origin, 16);
        }}
        className="absolute bottom-32 right-5 z-40 glass-panel p-3.5 rounded-full text-cyan-400"
      >
        <Navigation className="w-6 h-6" />
      </motion.button>

      {/* Live View AR toggle (bottom-left) */}
      <motion.button
        aria-label="Live View"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => startLiveView()}
        className="absolute bottom-8 left-5 z-40 glass-panel p-3.5 rounded-2xl flex items-center gap-2"
      >
        <Camera className="w-5 h-5 text-purple-400" />
        <span className="text-sm font-medium hidden md:block">Live View</span>
      </motion.button>

      {/* AR / Live View overlay */}
      <AnimatePresence>
        {liveView && cameraStream && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-black"
          >
            <video
              id="hm-camera"
              autoPlay
              playsInline
              muted
              ref={(v) => {
                if (!v) return;
                if (v.srcObject !== cameraStream) v.srcObject = cameraStream;
              }}
              className="w-full h-full object-cover opacity-80"
            />

            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60 pointer-events-none" />

            {/* HUD */}
            <div className="absolute top-8 left-0 right-0 flex justify-center pointer-events-auto">
              <div className="glass-panel px-6 py-3 rounded-full flex items-center gap-3">
                <Navigation className="w-5 h-5 text-cyan-400 animate-pulse" />
                <span className="font-medium text-lg">
                  {steps && steps[currentStep] ? steps[currentStep].maneuver?.instruction : "Buscando ruta..."}
                </span>
              </div>
            </div>

            <button
              onClick={stopLiveView}
              className="absolute top-8 right-8 glass-btn p-3 rounded-full text-white/80 hover:text-white pointer-events-auto"
            >
              <X className="w-6 h-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom turn-by-turn list */}
      <AnimatePresence>
        {steps && steps.length > 0 && (
          <motion.div
            initial={{ y: 200, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 200, opacity: 0 }}
            transition={IOS_SPRING}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-[94%] md:w-[700px]"
          >
            <div className="glass-panel rounded-3xl p-4 max-h-[30vh] overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-bold uppercase tracking-widest text-white/50">Próximos pasos</span>
                <span className="text-xs text-cyan-400 font-medium">{steps.length} pasos</span>
              </div>
              <div className="space-y-2">
                {steps.map((s, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl flex items-start gap-3 transition-all ${i === currentStep
                      ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 shadow-lg shadow-cyan-900/20"
                      : "hover:bg-white/5 border border-transparent"
                      }`}
                  >
                    <div className={`mt-0.5 ${i === currentStep ? "text-cyan-400" : "text-white/40"}`}>
                      {i === currentStep ? <Navigation className="w-5 h-5" /> : <div className="w-5 h-5 rounded-full border-2 border-current opacity-50" />}
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm font-medium leading-snug ${i === currentStep ? "text-white" : "text-white/70"}`}>
                        {s.maneuver?.instruction}
                      </div>
                      <div className="text-xs text-white/40 mt-1 font-mono">
                        {Math.round(s.distance)} m
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Toast */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 z-[70] bg-red-500/90 backdrop-blur-md text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium"
          >
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Indicator */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[80] bg-black/20 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
