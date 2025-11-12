import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Search, Navigation } from "lucide-react";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(-74.08175);
  const [lat, setLat] = useState(4.60971);
  const [zoom, setZoom] = useState(12);

  // Initialize map
  useEffect(() => {
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/navigation-night-v1",
      center: [lng, lat],
      zoom,
    });

    // Add user geolocation
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
    });
    map.current.addControl(geolocate);

    map.current.addControl(new mapboxgl.NavigationControl());
  }, []);

  return (
    <div className="w-screen h-screen relative">
      <div ref={mapContainer} className="w-full h-full backdrop-blur-md" />

      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/60 backdrop-blur-xl rounded-2xl shadow-lg px-4 py-2 flex items-center space-x-2">
        <Search className="w-5 h-5 text-white/80" />
        <input
          type="text"
          placeholder="Search location..."
          className="bg-transparent outline-none text-white placeholder-white/50 w-48"
        />
      </div>

      <button
        className="absolute bottom-6 right-6 bg-blue-600 hover:bg-blue-700 rounded-full p-3 shadow-xl backdrop-blur-md"
        onClick={() => map.current?.flyTo({ center: [lng, lat], zoom: 14 })}
      >
        <Navigation className="text-white w-6 h-6" />
      </button>
    </div>
  );
}
