import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MagnifyingGlassIcon, NavigationIcon } from "lucide-react";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [route, setRoute] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  // 🗺️ Initialize Mapbox
  useEffect(() => {
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/navigation-day-v1",
      center: [-74.08175, 4.60971], // Bogotá
      zoom: 12,
    });

    // 🧭 Add user location control
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    });
    map.current.addControl(geolocate);

    geolocate.on("geolocate", (pos) => {
      const coords = [pos.coords.longitude, pos.coords.latitude];
      setOrigin(coords);
      setUserLocation(coords);
      map.current.flyTo({ center: coords, zoom: 14 });
    });
  }, []);

  // 📍 Suggest logic (Colombia places)
  useEffect(() => {
    if (!destination.trim()) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${destination}.json?proximity=-74.08175,4.60971&country=co&limit=5&access_token=${mapboxgl.accessToken}`
      );
      const data = await res.json();
      setSuggestions(data.features || []);
    };

    const delay = setTimeout(fetchSuggestions, 400);
    return () => clearTimeout(delay);
  }, [destination]);

  // 📍 Route planning
  const planRoute = async (destCoords) => {
    if (!origin) {
      alert("First get your current location 📍");
      return;
    }
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${destCoords[0]},${destCoords[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`;

    const res = await fetch(url);
    const data = await res.json();
    const routeData = data.routes[0].geometry;
    setRoute(routeData);

    if (map.current.getSource("route")) {
      map.current.getSource("route").setData({
        type: "Feature",
        geometry: routeData,
      });
    } else {
      map.current.addSource("route", {
        type: "geojson",
        data: { type: "Feature", geometry: routeData },
      });
      map.current.addLayer({
        id: "route",
        type: "line",
        source: "route",
        paint: { "line-color": "#007AFF", "line-width": 5 },
      });
    }

    map.current.fitBounds([
      [origin[0], origin[1]],
      [destCoords[0], destCoords[1]],
    ], { padding: 50 });
  };

  // 🚗 Start navigation simulation
  const startNavigation = () => {
    if (!route) {
      alert("Please plan a route first 🚧");
      return;
    }
    setIsNavigating(true);
    alert("Navigation started (simulated). Follow the route on map!");
  };

  return (
    <div className="relative w-screen h-screen">
      {/* Map */}
      <div ref={mapContainer} className="absolute inset-0 z-0" />

      {/* Glass UI Overlay */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-11/12 max-w-lg backdrop-blur-xl bg-white/30 border border-white/20 shadow-xl rounded-2xl p-4 z-20">
        <div className="flex items-center space-x-2">
          <MagnifyingGlassIcon className="w-5 h-5 text-white" />
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Enter destination..."
            className="w-full bg-transparent text-white placeholder-white/70 outline-none"
          />
        </div>

        {suggestions.length > 0 && (
          <div className="mt-2 bg-white/80 rounded-xl overflow-hidden">
            {suggestions.map((s) => (
              <div
                key={s.id}
                onClick={() => {
                  setDestination(s.place_name);
                  setSuggestions([]);
                  planRoute(s.center);
                }}
                className="p-2 cursor-pointer hover:bg-white/60"
              >
                {s.place_name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center space-x-4 z-20">
        <button
          onClick={() => {
            if (userLocation) map.current.flyTo({ center: userLocation, zoom: 15 });
          }}
          className="px-4 py-2 bg-white/40 backdrop-blur-xl rounded-full text-white shadow-lg"
        >
          📍 My Location
        </button>

        <button
          onClick={startNavigation}
          className="px-4 py-2 bg-blue-600 rounded-full text-white shadow-lg flex items-center gap-2"
        >
          <NavigationIcon size={18} /> Start Navigation
        </button>
      </div>
    </div>
  );
}
