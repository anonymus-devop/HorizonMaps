import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "raf/polyfill"; // smooth animations in Safari

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [navigating, setNavigating] = useState(false);

  // Initialize map
  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-74.08175, 4.60971], // Bogotá
      zoom: 10,
    });

    // Add zoom & rotation controls
    map.current.addControl(new mapboxgl.NavigationControl());

    // Geolocate control
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    });
    map.current.addControl(geolocate);

    geolocate.on("geolocate", (e) => {
      const { longitude, latitude } = e.coords;
      setUserLocation([longitude, latitude]);
    });
  }, []);

  // Suggestion logic (Colombia)
  const majorPlaces = [
    "Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena",
    "Bucaramanga", "Manizales", "Pereira", "Santa Marta", "Villavicencio",
  ];

  const handleSuggest = (text) => {
    if (!text) return setSuggestions([]);
    const matches = majorPlaces.filter((p) =>
      p.toLowerCase().includes(text.toLowerCase())
    );
    setSuggestions(matches);
  };

  const planRoute = async () => {
    if (!origin || !destination) {
      alert("Please select both origin and destination.");
      return;
    }

    const query = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`
    );
    const data = await query.json();
    const route = data.routes[0];
    const geojson = {
      type: "Feature",
      geometry: route.geometry,
    };

    if (map.current.getSource("route")) {
      map.current.getSource("route").setData(geojson);
    } else {
      map.current.addLayer({
        id: "route",
        type: "line",
        source: { type: "geojson", data: geojson },
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#3b82f6", "line-width": 5 },
      });
    }

    map.current.fitBounds([
      [origin[0], origin[1]],
      [destination[0], destination[1]],
    ], { padding: 50 });

    setRouteInfo(route.legs[0].steps);
  };

  const startNavigation = () => {
    if (!routeInfo) return alert("No route planned yet!");
    setNavigating(true);
    alert("Starting live navigation tracking...");
  };

  // Follow user live
  useEffect(() => {
    if (!navigating || !userLocation) return;
    map.current.flyTo({ center: userLocation, zoom: 15 });
  }, [userLocation, navigating]);

  const handleDestinationSelect = async (place) => {
    const resp = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(place)}.json?country=CO&access_token=${mapboxgl.accessToken}`
    );
    const data = await resp.json();
    const [lng, lat] = data.features[0].center;
    setDestination([lng, lat]);
    setSuggestions([]);
    new mapboxgl.Marker({ color: "#f59e0b" }).setLngLat([lng, lat]).addTo(map.current);
    map.current.flyTo({ center: [lng, lat], zoom: 12 });
  };

  return (
    <div className="w-screen h-screen relative overflow-hidden">
      <div ref={mapContainer} className="absolute top-0 bottom-0 w-full" />

      {/* Liquid Glass UI */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-11/12 md:w-2/3 backdrop-blur-xl bg-white/20 p-4 rounded-3xl shadow-lg">
        <h1 className="text-white text-lg font-semibold mb-2 text-center">
          HorizonMaps 🌎 — Smart Navigation
        </h1>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="Origin (use 'My Location' or city)"
            className="p-2 rounded-xl bg-white/20 text-white placeholder-white/60"
            onChange={(e) => handleSuggest(e.target.value)}
            onBlur={() => setTimeout(() => setSuggestions([]), 500)}
          />
          <input
            type="text"
            placeholder="Destination"
            className="p-2 rounded-xl bg-white/20 text-white placeholder-white/60"
            onChange={(e) => handleSuggest(e.target.value)}
          />
          {suggestions.length > 0 && (
            <div className="bg-white/10 rounded-xl text-white text-sm">
              {suggestions.map((s) => (
                <button
                  key={s}
                  className="block w-full text-left px-3 py-1 hover:bg-white/20"
                  onClick={() => handleDestinationSelect(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-between mt-2">
            <button
              onClick={() => {
                if (userLocation) {
                  setOrigin(userLocation);
                  alert("Origin set to your current location ✅");
                } else alert("Enable location first.");
              }}
              className="bg-blue-600 text-white px-3 py-2 rounded-xl"
            >
              📍 My Location
            </button>

            <button
              onClick={planRoute}
              className="bg-green-600 text-white px-3 py-2 rounded-xl"
            >
              🗺️ Plan Route
            </button>

            <button
              onClick={startNavigation}
              className="bg-amber-600 text-white px-3 py-2 rounded-xl"
            >
              ▶️ Start
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
