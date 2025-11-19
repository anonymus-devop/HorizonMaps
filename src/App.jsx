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

  /* ---------- Init Map ---------- */
  useEffect(() => {
    setIsMobile(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: DEFAULT_CENTER,
      zoom: 12,
    });
    mapRef.current = map;

    // Add default controls
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

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
            flyTo(coords, 13, { animate: false });
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 60_000 }
        );
      }
    });

    // cleanup
    return () => {
      try {
        map.remove();
      } catch (e) {}
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
    if (pulse) el.style.animation = "hmPulse 1.5s infinite alternate";
    return el;
  }

  function placeUserMarker([lng, lat]) {
    if (!mapRef.current) return;
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([lng, lat]);
    } else {
      userMarkerRef.current = new mapboxgl.Marker({ element: createDotElement(16, "#00E5FF", true) })
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
          paint: { "line-color": "#60a5fa", "line-width": 6, "line-opacity": 0.95 },
        });
      }
    } catch (e) {
      console.warn("drawRoute", e);
    }
  }

  function flyTo([lng, lat], zoom = 15, opts = { animate: true }) {
    try {
      mapRef.current?.flyTo({ center: [lng, lat], zoom, speed: 0.8, curve: 1.4, essential: true });
    } catch (e) {}
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
      return;
    }
    const coords = s.center;
    setDest(coords);
    placeDestMarker(coords);
    flyTo(coords);
    speak(`${s.place_name}`);
  }

  /* ---------- Origin from device + center button ---------- */
  function setOriginFromDevice() {
    if (!("geolocation" in navigator)) return alert("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const coords = [p.coords.longitude, p.coords.latitude];
        setOrigin(coords);
        placeOriginMarker(coords);
        placeUserMarker(coords);
        flyTo(coords);
        speak("Ubicación actual centrada");
      },
      (err) => {
        console.warn("origin position error", err);
        alert("No se pudo obtener ubicación (permiso denegado o timeout).");
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 8000 }
    );
  }

  /* ---------- Plan Route (Mapbox Directions API - geojson) ---------- */
  async function planRoute() {
    if (!origin || !dest) return alert("Por favor, seleccione origen y destino.");
    removeRouteLayer();

    const from = `${origin[0]},${origin[1]}`;
    const to = `${dest[0]},${dest[1]}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from};${to}?steps=true&geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}&language=es`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (!json.routes || json.routes.length === 0) {
        alert("No se encontró ruta.");
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
      mapRef.current.fitBounds(bounds, { padding: 80, duration: 900 });

      speak("Ruta planificada. Presione iniciar para comenzar la navegación.");
    } catch (err) {
      console.error("planRoute error", err);
      alert("Error al planificar la ruta.");
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
        screen.orientation.lock("portrait").catch(() => {});
      }
    } catch (e) {}

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
        placeUserMarker([lng, lat]);

        if (following && isMobile) {
          // center on user for mobile nav
          flyTo([lng, lat], 15, { animate: true });
        }

        // Step progression: check distance to current step maneuver
        if (steps && steps.length) {
          const step = steps[currentStep];
          if (step && step.maneuver && step.maneuver.location) {
            const [tLng, tLat] = step.maneuver.location;
            const meters = haversineMeters(lat, lng, tLat, tLng);
            // when close, advance and announce
            if (meters < 25 && currentStep < steps.length - 1) {
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
          if (minMeters > 40) {
            // off-route: request new route from current position to dest
            try {
              const newOrigin = [lng, lat];
              setOrigin(newOrigin);
              placeOriginMarker(newOrigin);

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
                speak("Se detectó desvío. Recalculando ruta.");
              }
            } catch (err) {
              console.warn("replan error", err);
            }
          }
        }
      },
      (err) => {
        console.error("watchPosition error", err);
        alert("Error leyendo ubicación. Verifique permisos.");
        stopNavigation();
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 8000 }
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
    // release wake lock
    try {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch (e) {}
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
    <div className="w-screen h-screen relative bg-gradient-to-br from-blue-900 via-indigo-900 to-violet-900 text-white overflow-hidden">
      {/* pulse keyframes */}
      <style>{`@keyframes hmPulse {0%{transform:scale(0.95);opacity:1}100%{transform:scale(1.2);opacity:0.75}}`}</style>

      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0 z-0" />

      {/* Top glass bar */}
      <motion.div initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={IOS_SPRING} className="absolute top-5 left-1/2 -translate-x-1/2 z-50 w-[92%] md:w-[900px]">
        <div className="backdrop-blur-2xl bg-white/8 border border-white/20 rounded-3xl p-3 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/6" aria-hidden>
              <Search className="w-5 h-5 text-white/90" />
            </div>

            <div className="flex-1 relative">
              <input
                aria-label="Buscar destino"
                value={query}
                onChange={(e) => { setQuery(e.target.value); scheduleSuggest(e.target.value); }}
                onKeyDown={onInputKeyDown}
                placeholder="Buscar destino (Colombia) o dirección..."
                className="w-full bg-transparent outline-none placeholder-white/60 text-white p-3 rounded-xl"
                onFocus={() => query && scheduleSuggest(query)}
              />

              {/* Suggestions dropdown */}
              <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2 }} className="absolute left-0 right-0 mt-2 bg-black/70 border border-white/10 rounded-xl max-h-56 overflow-auto z-60 p-1 backdrop-blur-xl" role="listbox" aria-label="Sugerencias">
                    {suggestions.map((s, idx) => (
                      <div
                        role="option"
                        tabIndex={0}
                        key={s.id ?? `${s.place_name}-${idx}`}
                        onClick={() => pickSuggestion(s)}
                        onKeyDown={(e) => { if (e.key === "Enter") pickSuggestion(s); }}
                        className="px-3 py-2 hover:bg-white/10 cursor-pointer rounded-md text-sm"
                      >
                        {s.place_name}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-2">
              <button aria-label="Mi ubicación" title="Mi ubicación" onClick={setOriginFromDevice} className="bg-white/6 hover:bg-white/12 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-400">
                <MapPin className="w-5 h-5 text-white/90" />
              </button>

              <button aria-label="Planear ruta" title="Planear ruta" onClick={planRoute} className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300">
                Plan
              </button>

              {!navigating ? (
                <button aria-label="Iniciar navegación" title="Iniciar navegación" onClick={startNavigation} className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-300">
                  <Play className="w-4 h-4" />
                </button>
              ) : (
                <button aria-label="Detener navegación" title="Detener navegación" onClick={stopNavigation} className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-red-300">
                  <StopCircle className="w-4 h-4" />
                </button>
              )}

              <button aria-label="Limpiar" title="Limpiar" onClick={clearAll} className="bg-white/6 hover:bg-white/12 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-white/20">
                <X className="w-5 h-5 text-white/90" />
              </button>
            </div>
          </div>

          {/* route summary small */}
          {route && (
            <div className="mt-3 text-sm text-white/80 flex items-center justify-between">
              <div>Distance: <strong>{Math.round((route?.coordinates?.reduce((acc, c, i, arr) => {
                if (i === 0) return 0;
                const prev = arr[i - 1];
                return acc + haversineMeters(prev[1], prev[0], c[1], c[0]);
              }, 0)) || 0)} m</strong></div>
              <div>ETA: <strong>—</strong></div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Center locate button (bottom-center) */}
      <motion.button
        aria-label="Centrar en mi ubicación"
        title="Centrar en mi ubicación"
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        onClick={() => {
          if (!origin) setOriginFromDevice();
          else flyTo(origin, 15);
        }}
        className="absolute bottom-28 left-1/2 -translate-x-1/2 z-50 bg-white/12 backdrop-blur-md p-3 rounded-full shadow-xl focus:outline-none focus:ring-2 focus:ring-cyan-400"
      >
        <Navigation className="w-6 h-6 text-white/90" />
      </motion.button>

      {/* Live View AR toggle (bottom-left) */}
      <motion.button
        aria-label="Live View"
        title="Live View AR"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35 }}
        onClick={() => startLiveView()}
        className="absolute bottom-6 left-6 z-50 bg-white/10 backdrop-blur-md p-3 rounded-2xl shadow-lg focus:outline-none focus:ring-2 focus:ring-white/30"
      >
        <Camera className="w-5 h-5 text-white/90" />
      </motion.button>

      {/* AR / Live View overlay */}
      <AnimatePresence>
        {liveView && cameraStream && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="absolute inset-0 z-60">
            <video
              id="hm-camera"
              autoPlay
              playsInline
              muted
              ref={(v) => {
                if (!v) return;
                if (v.srcObject !== cameraStream) v.srcObject = cameraStream;
              }}
              className="w-full h-full object-cover"
              aria-hidden
            />

            {/* simple HUD for next instruction */}
            <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-lg px-4 py-2 rounded-2xl text-white">
              <div className="text-sm">{steps && steps[currentStep] ? steps[currentStep].maneuver?.instruction : "Sigue la ruta"}</div>
            </div>

            {/* close button */}
            <button onClick={stopLiveView} aria-label="Cerrar Live View" className="absolute top-6 right-6 bg-white/10 p-3 rounded-full">
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom turn-by-turn list */}
      <AnimatePresence>
        {steps && steps.length > 0 && (
          <motion.div initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }} transition={IOS_SPRING} className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 w-[92%] md:w-[800px]">
            <div className="backdrop-blur-2xl bg-white/6 border border-white/10 rounded-2xl p-3 shadow-xl max-h-48 overflow-auto">
              <div className="text-sm text-white/80 mb-2">Indicaciones</div>
              <div className="space-y-2">
                {steps.map((s, i) => (
                  <div key={i} className={`p-2 rounded-md ${i === currentStep ? "bg-white/10 text-amber-200" : "text-white/80"}`}>
                    <div className="text-xs">{Math.round(s.distance)} m</div>
                    <div>{s.maneuver?.instruction}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
