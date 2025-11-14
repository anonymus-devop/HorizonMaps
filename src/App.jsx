import React, { useEffect, useState, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css"; // <---- EL FIX MÁS IMPORTANTE
import { motion, AnimatePresence } from "framer-motion";
import { LocateFixed, MessageCircle } from "lucide-react";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "YOUR_MAPBOX_ACCESS_TOKEN";

export default function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [query, setQuery] = useState("");
  const [showGPT, setShowGPT] = useState(false);
  const [aiResponse, setAIResponse] = useState("");

  // Inicializar Mapa
  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/standard", // Estilo más moderno
      center: [-74.0818, 4.611], // Bogotá
      zoom: 12,
      pitch: 45,
      bearing: -17,
    });

    map.current.addControl(new mapboxgl.NavigationControl());
  }, []);

  // Ubicación Actual
  const handleLocate = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;

        map.current.flyTo({
          center: [longitude, latitude],
          zoom: 15,
          speed: 0.9,
          curve: 1.4,
        });

        new mapboxgl.Marker({ color: "#00BFFF" })
          .setLngLat([longitude, latitude])
          .addTo(map.current);
      },
      () => alert("No se pudo obtener ubicación")
    );
  };

  // Búsqueda con AI (Mapbox geocoder)
  const handleAISearch = async () => {
    if (!query.trim()) return;

    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query
      )}.json?access_token=${mapboxgl.accessToken}`;

      const res = await fetch(url);
      const data = await res.json();

      if (!data.features?.length) {
        alert("No se encontró la ubicación");
        return;
      }

      const [lng, lat] = data.features[0].center;

      map.current.flyTo({
        center: [lng, lat],
        zoom: 14,
        speed: 0.9,
        curve: 1.2,
      });

      new mapboxgl.Marker({ color: "#00BFFF" })
        .setLngLat([lng, lat])
        .addTo(map.current);

      setAIResponse(data.features[0].place_name);
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      {/* Mapa */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Botón central de ubicación */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={handleLocate}
        className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-xl text-white p-4 rounded-full border border-white/10 shadow-xl"
      >
        <LocateFixed className="w-6 h-6" />
      </motion.button>

      {/* Burbuja ChatGPT */}
      <AnimatePresence>
        {showGPT && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 160, damping: 14 }}
            className="absolute bottom-32 right-6 w-80 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl p-4 text-black shadow-2xl"
          >
            <h2 className="text-lg font-semibold mb-2">Asistente AI</h2>

            {/* Barra de búsqueda */}
            <input
              className="w-full p-3 text-sm rounded-xl bg-white/10 border border-white/20 placeholder-gray-300 text-black focus:outline-none"
              placeholder="Buscar ubicación..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <button
              onClick={handleAISearch}
              className="w-full mt-3 bg-blue-600 hover:bg-blue-700 rounded-xl p-3 text-sm font-medium transition-all"
            >
              Buscar con AI
            </button>

            {aiResponse && (
              <div className="mt-3 bg-white/10 p-2 rounded-lg text-xs">
                <p className="text-gray-300">{aiResponse}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón flotante del ChatGPT */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowGPT((x) => !x)}
        className="absolute bottom-6 right-6 bg-gradient-to-br from-green-400 via-teal-400 to-blue-500 p-4 rounded-full shadow-xl hover:shadow-2xl"
      >
        <MessageCircle className="w-6 h-6 text-black" />
      </motion.button>
    </div>
  );
}
