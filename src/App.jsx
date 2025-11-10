import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);

  // Load Mapbox token from environment
  useEffect(() => {
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

    if (!mapboxgl.accessToken) {
      console.error("❌ Mapbox token not found. Add VITE_MAPBOX_TOKEN to your GitHub Secrets.");
      return;
    }

    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-74.006, 40.7128], // NYC default
      zoom: 9,
    });

    // Add zoom and rotation controls
    map.current.addControl(new mapboxgl.NavigationControl());

    // Handle clicks
    map.current.on("click", (e) => {
      const coords = e.lngLat;
      new mapboxgl.Popup()
        .setLngLat(coords)
        .setHTML(
          `<div style="text-align:center;">
            📍<b>Clicked Location</b><br/>
            Lon: ${coords.lng.toFixed(4)}<br/>
            Lat: ${coords.lat.toFixed(4)}
          </div>`
        )
        .addTo(map.current);
    });

    return () => map.current?.remove();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-600 to-violet-800 text-white">
      <header className="p-6 text-center">
        <h1 className="text-4xl font-bold drop-shadow-md">🌍 HorizonMaps</h1>
        <p className="text-blue-100 mt-2">AI-powered inclusive navigation explorer</p>
      </header>

      <div
        ref={mapContainer}
        className="w-11/12 h-[70vh] rounded-2xl shadow-2xl border border-blue-300 overflow-hidden"
      />

      <footer className="text-xs text-blue-200 mt-4">
        Built with 💙 Mapbox & OpenAI · HorizonMaps © 2025
      </footer>
    </div>
  );
}

export default App;
