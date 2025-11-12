import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Search, Navigation } from "lucide-react";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function App() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [route, setRoute] = useState(null);
  const [navigating, setNavigating] = useState(false);

  // Initialize map
  useEffect(() => {
    if (mapRef.current) return;
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-74.08175, 4.60971], // Bogotá default
      zoom: 12,
    });

    // Geolocate control
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showAccuracyCircle: true,
      showUserHeading: true,
    });

    mapRef.current.addControl(geolocate);
    mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    geolocate.on("geolocate", (e) => {
      const { longitude, latitude } = e.coords;
      setOrigin([longitude, latitude]);
      mapRef.current.flyTo({ center: [longitude, latitude], zoom: 14 });
    });
  }, []);

  // Get suggestions from Mapbox API
  const handleSuggest = async (query) => {
    setDestination(query);
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query
        )}.json?access_token=${mapboxgl.accessToken}&autocomplete=true&country=CO&limit=5`
      );
      const data = await res.json();
      setSuggestions(data.features || []);
    } catch (err) {
      console.error("Geocoding error:", err);
    }
  };

  // Select suggestion and plan route
  const handleSelect = async (place) => {
    setDestination(place.place_name);
    setSuggestions([]);

    const coords = place.geometry.coordinates;
    if (!origin) return alert("Please allow location access first.");

    try {
      const res = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${coords[0]},${coords[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`
      );
      const data = await res.json();
      const routeData = data.routes[0].geometry.coordinates;

      // Draw route on map
      if (mapRef.current.getSource("route")) {
        mapRef.current.removeLayer("route");
        mapRef.current.removeSource("route");
      }
      mapRef.current.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "LineString", coordinates: routeData },
        },
      });
      mapRef.current.addLayer({
        id: "route",
        type: "line",
        source: "route",
        paint: { "line-color": "#007AFF", "line-width": 5 },
      });

      mapRef.current.flyTo({ center: coords, zoom: 13 });
      setRoute(routeData);
    } catch (err) {
      console.error("Route planning error:", err);
    }
  };

  // Simulate navigation
  const handleNavigate = () => {
    if (!route) return alert("Plan a route first!");
    setNavigating(true);

    let i = 0;
    const interval = setInterval(() => {
      if (i >= route.length) {
        clearInterval(interval);
        setNavigating(false);
        return;
      }
      mapRef.current.flyTo({ center: route[i], zoom: 15 });
      i++;
    }, 1000);
  };

  return (
    <div className="relative h-screen w-screen">
      <div ref={mapContainerRef} className="absolute inset-0" />

      {/* Glass UI */}
      <div className="absolute top-4 left-4 right-4 mx-auto max-w-md backdrop-blur-2xl bg-white/30 rounded-3xl p-4 shadow-lg border border-white/20 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Search className="text-gray-700" />
          <input
            type="text"
            placeholder="Buscar destino..."
            value={destination}
            onChange={(e) => handleSuggest(e.target.value)}
            className="flex-1 bg-transparent outline-none placeholder-gray-700 text-gray-900"
          />
        </div>

        {/* Suggestions list */}
        {suggestions.length > 0 && (
          <ul className="bg-white/60 rounded-xl overflow-hidden mt-2 max-h-48 overflow-y-auto">
            {suggestions.map((s, i) => (
              <li
                key={i}
                onClick={() => handleSelect(s)}
                className="px-3 py-2 cursor-pointer hover:bg-white/80"
              >
                {s.place_name}
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-between mt-3">
          <button
            onClick={handleNavigate}
            disabled={!route || navigating}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-2xl transition-all disabled:opacity-50"
          >
            <Navigation className="w-4 h-4" />
            {navigating ? "Navegando..." : "Iniciar navegación"}
          </button>
        </div>
      </div>
    </div>
  );
}
