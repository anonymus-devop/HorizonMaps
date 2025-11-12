import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { motion, AnimatePresence } from "framer-motion";
import { Locate, MessageCircle, Search } from "lucide-react";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(-74.0818);
  const [lat, setLat] = useState(4.6097);
  const [zoom, setZoom] = useState(12);
  const [search, setSearch] = useState("");
  const [showAI, setShowAI] = useState(false);
  const [aiMessage, setAiMessage] = useState("");

  // Inicializar el mapa
  useEffect(() => {
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [lng, lat],
      zoom: zoom,
    });

    map.current.on("move", () => {
      setLng(map.current.getCenter().lng.toFixed(4));
      setLat(map.current.getCenter().lat.toFixed(4));
      setZoom(map.current.getZoom().toFixed(2));
    });
  }, []);

  // Buscar ubicación usando Mapbox Geocoding
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;

    const query = encodeURIComponent(search);
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${mapboxgl.accessToken}`
    );
    const data = await res.json();

    if (data.features && data.features.length > 0) {
      const [lon, lat] = data.features[0].center;
      map.current.flyTo({ center: [lon, lat], zoom: 14 });
      new mapboxgl.Marker({ color: "#00A3FF" })
        .setLngLat([lon, lat])
        .addTo(map.current);
    } else {
      alert("No se encontraron resultados.");
    }
  };

  // Centrar ubicación
  const handleLocate = () => {
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta geolocalización.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.current.flyTo({ center: [longitude, latitude], zoom: 15 });
        new mapboxgl.Marker({ color: "#1E90FF" })
          .setLngLat([longitude, latitude])
          .addTo(map.current);
      },
      () => alert("No se pudo obtener la ubicación actual.")
    );
  };

  // Simular IA
  const handleAIResponse = () => {
    setAiMessage(
      "👋 ¡Hola! Puedo ayudarte a buscar lugares o planificar una ruta. Escribe un sitio en la barra superior."
    );
    setShowAI(true);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-white">
      {/* MAPA */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* BARRA DE BÚSQUEDA */}
      <motion.form
        onSubmit={handleSearch}
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 100 }}
        className="absolute top-6 left-1/2 -translate-x-1/2 w-[85%] md:w-[50%] bg-white/15 backdrop-blur-2xl border border-white/20 rounded-full flex items-center px-4 py-2 shadow-lg"
      >
        <Search className="text-white/70 w-5 h-5 mr-2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar ubicación..."
          className="bg-transparent flex-1 text-white placeholder-white/60 focus:outline-none text-sm"
        />
        <button
          type="submit"
          className="text-white/80 hover:text-white transition-colors"
        >
          Buscar
        </button>
      </motion.form>

      {/* BOTÓN LOCALIZAR */}
      <motion.button
        onClick={handleLocate}
        className="absolute bottom-24 right-4 bg-white/20 backdrop-blur-lg border border-white/30 text-white rounded-full p-3 shadow-xl"
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
      >
        <Locate className="w-6 h-6" />
      </motion.button>

      {/* BURBUJA GPT */}
      <motion.button
        onClick={handleAIResponse}
        className="absolute bottom-6 right-5 bg-white/20 backdrop-blur-xl border border-white/30 text-white rounded-full p-4 shadow-2xl"
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.1 }}
      >
        <MessageCircle className="w-7 h-7" />
      </motion.button>

      {/* MINI CHAT AI */}
      <AnimatePresence>
        {showAI && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 15 }}
            className="absolute bottom-24 right-5 w-72 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl p-4 shadow-xl"
          >
            <p className="text-sm leading-snug">{aiMessage}</p>
            <button
              onClick={() => setShowAI(false)}
              className="mt-3 w-full bg-white/20 hover:bg-white/30 text-white rounded-lg py-1 text-sm"
            >
              Cerrar
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
