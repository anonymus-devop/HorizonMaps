import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, LocateFixed } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = "YOUR_MAPBOX_ACCESS_TOKEN";

export default function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(-74.0818);
  const [lat, setLat] = useState(4.611);
  const [zoom, setZoom] = useState(12);
  const [showGPT, setShowGPT] = useState(false);
  const [query, setQuery] = useState("");
  const [aiResponse, setAIResponse] = useState("");

  // Inicializa el mapa
  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [lng, lat],
      zoom,
    });

    map.current.addControl(new mapboxgl.NavigationControl());
  }, []);

  // Botón de localización
  const handleLocate = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      map.current.flyTo({ center: [longitude, latitude], zoom: 15 });
      new mapboxgl.Marker({ color: "#00BFFF" })
        .setLngLat([longitude, latitude])
        .addTo(map.current);
    });
  };

  // Buscar ubicación con AI (Mapbox Geocoding)
  const handleAISearch = async () => {
    if (!query.trim()) return;
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query
        )}.json?access_token=${mapboxgl.accessToken}`
      );
      const data = await res.json();
      if (!data.features?.length) throw new Error("No se encontraron coordenadas válidas.");

      const [lng, lat] = data.features[0].center;
      setLng(lng);
      setLat(lat);
      setAiResponse(data.features[0].place_name);
      map.current.flyTo({ center: [lng, lat], zoom: 14 });
      new mapboxgl.Marker({ color: "#00BFFF" }).setLngLat([lng, lat]).addTo(map.current);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-white">
      {/* 🌍 MAPA */}
      <div ref={mapContainer} className="h-full w-full" />

      {/* 📍 Botón central de localización */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={handleLocate}
        className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 bg-white/20 backdrop-blur-2xl text-white p-4 rounded-full shadow-lg border border-white/10 hover:bg-white/30 transition-all"
      >
        <LocateFixed className="w-6 h-6" />
      </motion.button>

      {/* 💬 Burbuja GPT flotante */}
      <AnimatePresence>
        {showGPT && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: "spring", stiffness: 160, damping: 18 }}
            className="absolute bottom-28 right-5 left-5 sm:left-auto sm:w-80 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-4 text-white shadow-xl z-30"
          >
            <motion.h2
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg font-semibold mb-3 text-center"
            >
              Asistente AI
            </motion.h2>

            <motion.input
              layout
              className="w-full p-3 rounded-xl bg-white/10 border border-white/20 mb-3 text-white placeholder-gray-400 focus:outline-none text-center"
              placeholder="Buscar ubicación..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleAISearch}
              className="w-full bg-blue-500/80 hover:bg-blue-500 rounded-xl py-2 font-semibold shadow-md transition-all"
            >
              Buscar con AI
            </motion.button>

            {aiResponse && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 bg-white/10 p-3 rounded-xl text-sm text-gray-200"
              >
                <p>{aiResponse}</p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🤖 Botón flotante GPT */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 8 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowGPT(!showGPT)}
        className="absolute bottom-6 right-6 z-40 bg-gradient-to-br from-green-400 via-teal-400 to-blue-500 p-4 rounded-full shadow-lg hover:shadow-2xl transition-all"
      >
        <MessageCircle className="w-6 h-6 text-white" />
      </motion.button>
    </div>
  );
}
