import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-74.5, 40],
      zoom: 2,
    });
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-600 to-violet-800 text-white">
      <h1 className="text-3xl font-bold">🌍 HorizonMaps</h1>
      <p className="text-sm text-blue-100 mb-4">
        AI-powered interactive world map explorer.
      </p>
      <div
        ref={mapContainer}
        className="w-[90vw] h-[70vh] rounded-2xl shadow-lg border border-blue-400"
      />
    </div>
  );
}

export default App;
