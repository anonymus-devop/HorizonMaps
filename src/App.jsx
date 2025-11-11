import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [route, setRoute] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [navigating, setNavigating] = useState(false);

  // --- Load map
  useEffect(() => {
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/navigation-day-v1",
      center: [-74.08175, 4.60971], // Bogotá
      zoom: 11,
    });

    // Add zoom & rotation controls
    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
  }, []);

  // --- Handle user geolocation
  const locateUser = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation([longitude, latitude]);
        map.current.flyTo({ center: [longitude, latitude], zoom: 14 });

        // Add marker for user
        new mapboxgl.Marker({ color: "#00BFFF" })
          .setLngLat([longitude, latitude])
          .setPopup(new mapboxgl.Popup().setText("Mi ubicación actual"))
          .addTo(map.current);
      },
      (err) => alert("Error getting location: " + err.message),
      { enableHighAccuracy: true }
    );
  };

  // --- Suggestion logic (Colombia + Mapbox Geocoding)
  const handleSuggest = async (query, setValue) => {
    setValue(query);
    if (query.length < 3) return;

    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query
      )}.json?country=CO&access_token=${mapboxgl.accessToken}`
    );
    const data = await response.json();
    const results = data.features.map((f) => ({
      name: f.place_name,
      coords: f.center,
    }));

    // Prioritize major Colombian cities
    const majorPlaces = [
      "Bogotá",
      "Medellín",
      "Cali",
      "Barranquilla",
      "Cartagena",
      "Bucaramanga",
      "Manizales",
      "Pereira",
      "Santa Marta",
    ];

    const combined = [
      ...majorPlaces
        .filter((p) => p.toLowerCase().includes(query.toLowerCase()))
        .map((p) => ({ name: p, coords: null })),
      ...results,
    ];

    setSuggestions(combined.slice(0, 6));
  };

  // --- Route planning
  const planRoute = async () => {
    if (!origin || !destination) {
      alert("Por favor selecciona origen y destino.");
      return;
    }

    let originCoords = null;
    let destCoords = null;

    // Get origin coords
    if (origin === "Mi ubicación" && userLocation) {
      originCoords = userLocation;
    } else {
      const geo = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          origin
        )}.json?access_token=${mapboxgl.accessToken}`
      );
      const data = await geo.json();
      originCoords = data.features[0]?.center;
    }

    // Get destination coords
    const geo2 = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        destination
      )}.json?access_token=${mapboxgl.accessToken}`
    );
    const data2 = await geo2.json();
    destCoords = data2.features[0]?.center;

    if (!originCoords || !destCoords) {
      alert("No se pudo encontrar una ruta válida.");
      return;
    }

    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${originCoords.join(
        ","
      )};${destCoords.join(
        ","
      )}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`
    );
    const json = await res.json();

    const routeData = json.routes[0];
    const coords = routeData.geometry.coordinates;
    const geojson = {
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
    };

    if (map.current.getSource("route")) {
      map.current.getSource("route").setData(geojson);
    } else {
      map.current.addSource("route", { type: "geojson", data: geojson });
      map.current.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#4CAF50", "line-width": 5 },
      });
    }

    // Zoom to route
    const bounds = coords.reduce(
      (b, coord) => b.extend(coord),
      new mapboxgl.LngLatBounds(coords[0], coords[0])
    );
    map.current.fitBounds(bounds, { padding: 50 });

    setRoute(routeData);
  };

  // --- Simulate navigation
  const startNavigation = () => {
    if (!route) return alert("Primero planifica una ruta.");
    setNavigating(true);
    alert("🚗 Navegación iniciada. Sigue las instrucciones en el mapa.");
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white">
      {/* Header */}
      <div className="p-4 backdrop-blur-xl bg-white/10 shadow-md flex flex-col md:flex-row gap-2 items-center justify-between">
        <h1 className="text-2xl font-bold">🌍 HorizonMaps</h1>
        <div className="flex gap-2 flex-wrap justify-center">
          <input
            className="p-2 rounded-lg bg-white/20 placeholder-gray-300"
            placeholder="Origen (o 'Mi ubicación')"
            value={origin}
            onChange={(e) => handleSuggest(e.target.value, setOrigin)}
            list="suggestions-origin"
          />
          <input
            className="p-2 rounded-lg bg-white/20 placeholder-gray-300"
            placeholder="Destino"
            value={destination}
            onChange={(e) => handleSuggest(e.target.value, setDestination)}
            list="suggestions-dest"
          />
          <button
            onClick={planRoute}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl"
          >
            📍 Planificar ruta
          </button>
          <button
            onClick={startNavigation}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl"
          >
            🚗 Iniciar navegación
          </button>
          <button
            onClick={locateUser}
            className="bg-cyan-500 hover:bg-cyan-600 text-white px-3 py-2 rounded-xl"
          >
            📡 Mi ubicación
          </button>
        </div>

        {/* Suggestions datalist */}
        <datalist id="suggestions-origin">
          {suggestions.map((s, i) => (
            <option key={i} value={s.name} />
          ))}
        </datalist>
        <datalist id="suggestions-dest">
          {suggestions.map((s, i) => (
            <option key={i} value={s.name} />
          ))}
        </datalist>
      </div>

      {/* Map container */}
      <div ref={mapContainer} className="flex-1" />
    </div>
  );
}
