import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Search, MapPin, Play, StopCircle, X, Navigation } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "";

const DEFAULT_CENTER = [-74.08175, 4.60971]; // Bogotá

export default function App() {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const [origin, setOrigin] = useState(null);
  const [isTracking, setIsTracking] = useState(false);

  // --- initialize map ---
  useEffect(() => {
    if (mapRef.current) return;

    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: DEFAULT_CENTER,
      zoom: 12,
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    // get user position
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos.coords.longitude, pos.coords.latitude];
        setOrigin(coords);
        addUserMarker(coords);
        flyTo(coords);
      },
      () => console.warn("No location access"),
      { enableHighAccuracy: true }
    );
  }, []);

  // --- helpers ---
  function flyTo(coords) {
    mapRef.current?.flyTo({
      center: coords,
      zoom: 15,
      speed: 0.8,
      curve: 1.3,
      essential: true,
    });
  }

  function addUserMarker(coords) {
    if (!mapRef.current) return;
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat(coords);
      return;
    }

    const el = document.createElement("div");
    el.style.width = "20px";
    el.style.height = "20px";
    el.style.borderRadius = "50%";
    el.style.background = "#00E5FF";
    el.style.border = "2px solid white";
    el.style.boxShadow = "0 0 20px rgba(0,229,255,0.8)";
    el.style.animation = "pulse 2s infinite alternate";

    userMarkerRef.current = new mapboxgl.Marker(el)
      .setLngLat(coords)
      .addTo(mapRef.current);
  }

  // --- re-center to user ---
  function centerToUser() {
    if (!origin) {
      alert("Ubicación no disponible aún.");
      return;
    }
    flyTo(origin);
  }

  // --- live tracking toggle ---
  function toggleTracking() {
    if (isTracking) {
      setIsTracking(false);
      navigator.geolocation.clearWatch(isTracking);
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = [pos.coords.longitude, pos.coords.latitude];
        setOrigin(coords);
        addUserMarker(coords);
        flyTo(coords);
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );
    setIsTracking(id);
  }

  // --- animation style ---
  const iosMotion = {
    type: "spring",
    stiffness: 150,
    damping: 18,
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden text-white">
      <style>
        {`@keyframes pulse {
          0% { transform: scale(0.95); opacity: 1; }
          100% { transform: scale(1.2); opacity: 0.7; }
        }`}
      </style>

      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* UI overlay */}
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={iosMotion}
        className="absolute top-5 left-1/2 -translate-x-1/2 z-50 w-[90%] md:w-[800px]"
      >
        <div className="backdrop-blur-2xl bg-white/10 border border-white/20 rounded-3xl p-3 shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-white/80" />
            <input
              type="text"
              placeholder="Buscar destino..."
              className="bg-transparent flex-1 text-white outline-none placeholder-white/60"
            />
          </div>
          <button
            onClick={toggleTracking}
            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 flex items-center gap-1"
          >
            {isTracking ? (
              <>
                <StopCircle className="w-4 h-4" /> Stop
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Go
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* --- Center Locate Button (new) --- */}
      <motion.button
        onClick={centerToUser}
        title="Centrar en mi ubicación"
        initial={{ opacity: 0, scale: 0.8, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 bg-blue-500/90 hover:bg-blue-600 text-white p-4 rounded-full shadow-2xl shadow-black/30 backdrop-blur-xl"
      >
        <Navigation className="w-6 h-6" />
      </motion.button>
    </div>
  );
}
