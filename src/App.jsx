import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Navigation, Play, StopCircle, X, Camera, Layers, Loader2 } from "lucide-react";

import { 
  searchPlaces, 
  getDirections, 
  formatDuration, 
  formatDistance, 
  calculateETA,
  haversineMeters,
  MAPBOX_TOKEN 
} from "./utils/mapbox";

import { useGeolocation } from "./hooks/useGeolocation";
import { useSpeech } from "./hooks/useSpeech";
import { useWakeLock } from "./hooks/useWakeLock";
import { useFavorites } from "./hooks/useFavorites";

import { SearchBar } from "./components/SearchBar";
import { NavigationPanel, NavigationTopBar } from "./components/NavigationPanel";
import { RoutePreview } from "./components/RoutePreview";
import { LiveView } from "./components/LiveView";
import { OfflineIndicator, ErrorToast } from "./components/OfflineIndicator";
import { ManeuverIcon } from "./components/ManeuverIcon";

const DEFAULT_CENTER = [-74.08175, 4.60971];
const IOS_SPRING = { type: "spring", stiffness: 140, damping: 18 };
const ROUTE_SOURCE_ID = "hm-route-source";
const ROUTE_LAYER_ID = "hm-route-layer";

export default function App() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const originMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const watchIdRef = useRef(null);
  const abortControllerRef = useRef(null);
  const suggestTimerRef = useRef(null);
  const errorTimerRef = useRef(null);

  const { 
    position: gpsPosition, 
    error: gpsError, 
    getPosition,
    startWatching,
    stopWatching,
  } = useGeolocation({ watch: false });
  
  const { speak, cancel: cancelSpeech } = useSpeech({ lang: "es-CO" });
  const { request: requestWakeLock, release: releaseWakeLock } = useWakeLock();
  const { 
    favorites, 
    recent, 
    addFavorite, 
    removeFavorite, 
    isFavorite, 
    addRecent,
  } = useFavorites();

  const [ready, setReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  
  const [origin, setOrigin] = useState(null);
  const [dest, setDest] = useState(null);
  const [route, setRoute] = useState(null);
  const [steps, setSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  
  const [navigating, setNavigating] = useState(false);
  const [showRoutePreview, setShowRoutePreview] = useState(false);
  const [showStepsList, setShowStepsList] = useState(false);
  
  const [liveView, setLiveView] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  
  const [following, setFollowing] = useState(true);
  const [mapCollapsed, setMapCollapsed] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const remainingDistance = useMemo(() => {
    if (!steps.length) return 0;
    return steps.slice(currentStep).reduce((sum, s) => sum + (s.distance || 0), 0);
  }, [steps, currentStep]);
  
  const remainingDuration = useMemo(() => {
    if (!steps.length) return 0;
    return steps.slice(currentStep).reduce((sum, s) => sum + (s.duration || 0), 0);
  }, [steps, currentStep]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    setIsMobile(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: DEFAULT_CENTER,
      zoom: 12,
      pitch: 45,
      bearing: 0,
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

    map.on("load", () => {
      setReady(true);
      getPosition().catch(() => {
        setOrigin(DEFAULT_CENTER);
        placeOriginMarker(DEFAULT_CENTER);
        placeUserMarker(DEFAULT_CENTER);
        flyTo(DEFAULT_CENTER, 12, false);
      });
    });

    return () => {
      try { map.remove(); } catch (e) {}
      mapRef.current = null;
    };
  }, [getPosition]);

  useEffect(() => {
    if (gpsPosition) {
      const coords = [gpsPosition.longitude, gpsPosition.latitude];
      setOrigin(coords);
      placeOriginMarker(coords);
      placeUserMarker(coords);
      if (!navigating) flyTo(coords, 14, false);
    }
  }, [gpsPosition, navigating]);

  useEffect(() => {
    if (gpsError && !origin) {
      showError(gpsError.message);
      setOrigin(DEFAULT_CENTER);
      placeOriginMarker(DEFAULT_CENTER);
    }
  }, [gpsError, origin]);

  const createDotElement = useCallback((size = 18, color = "#00E5FF", pulse = false) => {
    const el = document.createElement("div");
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.borderRadius = "50%";
    el.style.background = color;
    el.style.border = "2px solid rgba(255,255,255,0.95)";
    el.style.boxShadow = `0 0 10px ${color}`;
    if (pulse) el.className = "pulse-ring";
    return el;
  }, []);

  const placeUserMarker = useCallback((coords) => {
    if (!mapRef.current) return;
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat(coords);
    } else {
      userMarkerRef.current = new mapboxgl.Marker({ 
        element: createDotElement(20, "#00E5FF", true) 
      }).setLngLat(coords).addTo(mapRef.current);
    }
  }, [createDotElement]);

  const placeOriginMarker = useCallback((coords) => {
    if (!mapRef.current) return;
    if (originMarkerRef.current) {
      originMarkerRef.current.setLngLat(coords);
    } else {
      originMarkerRef.current = new mapboxgl.Marker({ 
        element: createDotElement(16, "#34D399", false) 
      }).setLngLat(coords).addTo(mapRef.current);
    }
  }, [createDotElement]);

  const placeDestMarker = useCallback((coords) => {
    if (!mapRef.current) return;
    if (destMarkerRef.current) {
      destMarkerRef.current.setLngLat(coords);
    } else {
      destMarkerRef.current = new mapboxgl.Marker({ 
        element: createDotElement(16, "#FB7185", false) 
      }).setLngLat(coords).addTo(mapRef.current);
    }
  }, [createDotElement]);

  const removeRouteLayer = useCallback(() => {
    try {
      if (!mapRef.current) return;
      ["-glow", ""].forEach(suffix => {
        const id = ROUTE_LAYER_ID + suffix;
        if (mapRef.current.getLayer(id)) mapRef.current.removeLayer(id);
      });
      if (mapRef.current.getSource(ROUTE_SOURCE_ID)) {
        mapRef.current.removeSource(ROUTE_SOURCE_ID);
      }
    } catch (e) {}
  }, []);

  const drawRoute = useCallback((geometry) => {
    try {
      if (!mapRef.current) return;
      if (mapRef.current.getSource(ROUTE_SOURCE_ID)) {
        mapRef.current.getSource(ROUTE_SOURCE_ID).setData({ type: "Feature", geometry });
      } else {
        mapRef.current.addSource(ROUTE_SOURCE_ID, { type: "geojson", data: { type: "Feature", geometry } });
        mapRef.current.addLayer({
          id: ROUTE_LAYER_ID + "-glow",
          type: "line",
          source: ROUTE_SOURCE_ID,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#0ea5e9",
            "line-width": 14,
            "line-opacity": 0.3,
            "line-blur": 8,
          },
        });
        mapRef.current.addLayer({
          id: ROUTE_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#38bdf8",
            "line-width": 5,
            "line-opacity": 0.95,
          },
        });
      }
    } catch (e) {}
  }, []);

  const flyTo = useCallback((coords, zoom = 15, animate = true) => {
    try {
      mapRef.current?.flyTo({ 
        center: coords, zoom, 
        speed: animate ? 1.2 : 0,
        curve: 1.42, essential: true, 
        pitch: navigating ? 60 : 45,
      });
    } catch (e) {}
  }, [navigating]);

  const fetchSuggestions = useCallback(async (q) => {
    if (!q || q.length < 2) { setSuggestions([]); return; }
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    setSuggestLoading(true);
    try {
      const results = await searchPlaces(q, { 
        proximity: origin || DEFAULT_CENTER, country: "CO", limit: 6,
      });
      setSuggestions(results);
    } catch (e) {
      setSuggestions([]);
    } finally {
      setSuggestLoading(false);
    }
  }, [origin]);

  const scheduleSuggest = useCallback((q) => {
    clearTimeout(suggestTimerRef.current);
    suggestTimerRef.current = setTimeout(() => fetchSuggestions(q), 300);
  }, [fetchSuggestions]);

  const handleSelectPlace = useCallback((place) => {
    setQuery(place.place_name || place.text || "");
    setSuggestions([]);
    const coords = place.center || place.geometry?.coordinates;
    if (!coords) return;
    setDest(coords);
    placeDestMarker(coords);
    flyTo(coords, 16);
    speak(`${place.place_name || place.text} seleccionado`);
    addRecent(place);
  }, [flyTo, speak, placeDestMarker, addRecent]);

  const planRoute = useCallback(async () => {
    if (!origin || !dest) { showError("Selecciona origen y destino"); return; }
    if (!isOnline) { showError("Necesitas conexión a internet"); return; }
    
    removeRouteLayer();
    setLoading(true);
    setShowRoutePreview(false);

    try {
      const routeData = await getDirections(origin, dest, { annotations: ["duration", "distance"] });
      
      setRoute(routeData);
      setSteps(routeData.legs[0]?.steps || []);
      setCurrentStep(0);
      drawRoute(routeData.geometry);
      
      if (routeData.bounds && mapRef.current) {
        mapRef.current.fitBounds([routeData.bounds.sw, routeData.bounds.ne], { padding: 100, duration: 1000 });
      }
      
      setShowRoutePreview(true);
      speak(`Ruta calculada. ${formatDuration(routeData.duration)}. ${formatDistance(routeData.distance)}.`);
    } catch (err) {
      showError(err.message || "Error al calcular la ruta");
    } finally {
      setLoading(false);
    }
  }, [origin, dest, isOnline, removeRouteLayer, drawRoute, speak]);

  const startNavigation = useCallback(async () => {
    if (!route) { showError("Calcula una ruta primero"); return; }
    
    setShowRoutePreview(false);
    setNavigating(true);
    setShowStepsList(false);
    await requestWakeLock();
    
    try { if (screen.orientation?.lock) screen.orientation.lock("portrait").catch(() => {}); } catch (e) {}
    
    speak("Iniciando navegación. Sigue las indicaciones.");
    startWatching();
    
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;
        const heading = pos.coords.heading;
        
        placeUserMarker([lng, lat]);
        
        if (following && isMobile) {
          mapRef.current?.easeTo({
            center: [lng, lat], bearing: heading || 0, pitch: 60,
            duration: 1000, easing: (t) => t,
          });
        }
        
        if (steps.length > 0 && currentStep < steps.length) {
          const step = steps[currentStep];
          if (step?.maneuver?.location) {
            const [tLng, tLat] = step.maneuver.location;
            const meters = haversineMeters(lat, lng, tLat, tLng);
            
            if (meters < 40 && currentStep < steps.length - 1) {
              const nextIdx = currentStep + 1;
              const nextStep = steps[nextIdx];
              if (nextStep?.instruction) speak(nextStep.instruction, true);
              setCurrentStep(nextIdx);
            }
          }
        }
        
        if (route?.geometry?.coordinates?.length > 0) {
          const minMeters = route.geometry.coordinates.reduce((min, c) => {
            const d = haversineMeters(lat, lng, c[1], c[0]);
            return d < min ? d : min;
          }, Infinity);
          
          if (minMeters > 80) handleReplan([lng, lat]);
        }
      },
      (err) => {
        showError("Error de GPS. Revisa tu señal.");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
  }, [route, steps, currentStep, following, isMobile, placeUserMarker, speak, requestWakeLock, startWatching]);

  const replanTimeoutRef = useRef(null);
  const handleReplan = useCallback((newOrigin) => {
    if (replanTimeoutRef.current) return;
    speak("Recalculando ruta...", true);
    setOrigin(newOrigin);
    placeOriginMarker(newOrigin);
    
    replanTimeoutRef.current = setTimeout(async () => {
      try {
        const routeData = await getDirections(newOrigin, dest, { annotations: ["duration", "distance"] });
        setRoute(routeData);
        setSteps(routeData.legs[0]?.steps || []);
        setCurrentStep(0);
        drawRoute(routeData.geometry);
        speak("Ruta recalculada", true);
      } catch (err) {
        console.warn("Replan failed:", err);
      } finally {
        replanTimeoutRef.current = null;
      }
    }, 2000);
  }, [dest, drawRoute, speak, placeOriginMarker]);

  const stopNavigation = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    stopWatching();
    releaseWakeLock();
    cancelSpeech();
    try { if (screen.orientation?.unlock) screen.orientation.unlock(); } catch (e) {}
    setNavigating(false);
    setShowStepsList(false);
    setFollowing(true);
    speak("Navegación finalizada");
  }, [stopWatching, releaseWakeLock, cancelSpeech, speak]);

  const startLiveView = useCallback(async () => {
    if (liveView) { stopLiveView(); return; }
    if (!("mediaDevices" in navigator)) { showError("Cámara no soportada"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } }, audio: false,
      });
      setCameraStream(stream);
      setLiveView(true);
      speak("Vista en vivo activada");
    } catch (e) {
      showError("No se pudo acceder a la cámara");
    }
  }, [liveView, speak]);

  const stopLiveView = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
    setLiveView(false);
    speak("Vista en vivo desactivada");
  }, [cameraStream, speak]);

  const clearAll = useCallback(() => {
    removeRouteLayer();
    originMarkerRef.current?.remove();
    destMarkerRef.current?.remove();
    userMarkerRef.current?.remove();
    originMarkerRef.current = null;
    destMarkerRef.current = null;
    userMarkerRef.current = null;
    setOrigin(null);
    setDest(null);
    setRoute(null);
    setSteps([]);
    setCurrentStep(0);
    setShowRoutePreview(false);
    setQuery("");
    stopNavigation();
  }, [removeRouteLayer, stopNavigation]);

  const showError = useCallback((msg) => {
    setErrorMsg(msg);
    clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorMsg(null), 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
      if (replanTimeoutRef.current) clearTimeout(replanTimeoutRef.current);
      if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      cancelSpeech();
      releaseWakeLock();
    };
  }, [cameraStream, cancelSpeech, releaseWakeLock]);

  return (
    <div className="w-screen h-screen relative bg-slate-900 text-white overflow-hidden font-sans">
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="liquid-glass-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              0 0 0 18 -7
            " result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop"/>
          </filter>
        </defs>
      </svg>

      <div ref={mapContainer} className="absolute inset-0 z-0" />

      <OfflineIndicator isOnline={isOnline} />

      <AnimatePresence>
        {errorMsg && <ErrorToast message={errorMsg} onClose={() => setErrorMsg(null)} />}
      </AnimatePresence>

      {navigating && (
        <NavigationTopBar
          duration={remainingDuration}
          distance={remainingDistance}
          onExit={stopNavigation}
        />
      )}

      <AnimatePresence>
        {(!navigating || !mapCollapsed) && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={IOS_SPRING}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[94%] md:w-[500px]"
          >
            <SearchBar
              value={query}
              onChange={setQuery}
              onSubmit={(q) => { if (q.length >= 2) fetchSuggestions(q); }}
              onSelect={handleSelectPlace}
              suggestions={suggestions}
              recent={recent}
              favorites={favorites}
              loading={suggestLoading}
              onClear={() => { setQuery(""); setSuggestions([]); }}
              onAddFavorite={addFavorite}
              onRemoveFavorite={removeFavorite}
              isFavorite={isFavorite}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-32 right-5 z-40 flex flex-col gap-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => { if (!origin) getPosition(); else flyTo([origin[0], origin[1]], 16); }}
          className="liquid-glass-btn p-3.5 rounded-full text-cyan-400 hover:text-cyan-300"
          aria-label="Centrar en mi ubicación"
        >
          <Navigation className="w-6 h-6" />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={startLiveView}
          className={`liquid-glass-btn p-3.5 rounded-full transition-colors ${
            liveView ? "text-purple-400 bg-purple-500/10" : "text-white/70 hover:text-white"
          }`}
          aria-label="Vista en vivo"
        >
          <Camera className="w-6 h-6" />
        </motion.button>

        {navigating && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setMapCollapsed(!mapCollapsed)}
            className="liquid-glass-btn p-3.5 rounded-full text-white/70 hover:text-white"
            aria-label={mapCollapsed ? "Expandir UI" : "Colapsar UI"}
          >
            <Layers className="w-6 h-6" />
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {showRoutePreview && route && (
          <RoutePreview
            route={route}
            onStartNavigation={startNavigation}
            onCancel={() => setShowRoutePreview(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {navigating && (
          <NavigationPanel
            route={route}
            steps={steps}
            currentStepIndex={currentStep}
            position={gpsPosition}
            onStopNavigation={stopNavigation}
            onToggleSteps={() => setShowStepsList(!showStepsList)}
            showSteps={showStepsList}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {liveView && (
          <LiveView
            stream={cameraStream}
            steps={steps}
            currentStepIndex={currentStep}
            onClose={stopLiveView}
            heading={gpsPosition?.heading}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[80] bg-black/30 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="liquid-glass-card p-6 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              <p className="text-sm text-white/80">Calculando ruta...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
