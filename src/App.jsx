import React, { useEffect, useState, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, LocateFixed, MessageCircle } from "lucide-react";

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
  const [coords, setCoords] = useState(null);

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

  // Botón para centrar ubicación
  const handleLocate = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      map.current.flyTo({ center: [longitude, latitude], zoom: 15 });
      new mapboxgl.Marker({ color: "#00BFFF" })
        .setLngLat([longitude, latitude])
        .addTo(map.current);
    });
  };

  // Buscar con "AI"
  const handleAISearch = async () => {
    if (!query.trim()) return;

    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query
        )}.json?access_token=${mapboxgl.accessToken}`
      );
      const data = await res.json();
      if (!data.features || data.features.length === 0)
        throw new Error("No se encontraron coordenadas válidas.");

      const [lng, lat] = data.features[0].center;
      setCoords({ lng, lat });
      setAIResponse(data.features[0].place_name);

      map.current.flyTo({ center: [lng, lat], zoom: 14 });
      new mapboxgl.Marker({ color: "#00BFFF" })
        .setLngLat([lng, lat])
        .addTo(map.current);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0a0a0a]">
      {/* Mapa */}
      <div ref={mapContainer} className="h-full w-full rounded-3xl" />

      {/* Botón central de ubicación */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={handleLocate}
        className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-2xl text-white p-4 rounded-full shadow-lg border border-white/10 hover:bg-white/30 transition-all"
      >
        <LocateFixed className="w-6 h-6" />
      </motion.button>

      {/* Burbuja ChatGPT */}
      <AnimatePresence>
        {showGPT && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute bottom-32 right-6 w-80 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl p-4 text-white shadow-xl"
          >
            <h2 className="text-lg font-semibold mb-2">Asistente AI</h2>
            <input
              className="w-full p-2 rounded-lg bg-white/10 border border-white/20 mb-3 text-white placeholder-gray-300 focus:outline-none"
              placeholder="Buscar ubicación..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              onClick={handleAISearch}
              className="w-full bg-blue-600 hover:bg-blue-700 rounded-lg p-2 font-medium"
            >
              Buscar con AI
            </button>

            {aiResponse && (
              <div className="mt-3 bg-white/10 p-2 rounded-lg text-sm">
                <p className="text-gray-300">{aiResponse}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón flotante ChatGPT */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowGPT(!showGPT)}
        className="absolute bottom-6 right-6 bg-gradient-to-br from-green-400 via-teal-400 to-blue-500 p-4 rounded-full shadow-lg hover:shadow-2xl transition-all"
      >
        <MessageCircle className="w-6 h-6 text-white" />
      </motion.button>
    </div>
  );
}
