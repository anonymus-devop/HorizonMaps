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
  const [userMarker, setUserMarker] = useState(null);
  const [navigating, setNavigating] = useState(false);
  const geolocateControl = useRef(null);

  // --- Initialize map
  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/navigation-day-v1",
      center: [-74.08175, 4.60971], // Bogotá by default
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    // GeolocateControl (with automatic start)
    geolocateControl.current = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showAccuracyCircle: false,
    });

    map.current.addControl(geolocateControl.current, "top-right");

    map.current.on("load", () => {
      geolocateControl.current.trigger();
    });

    // When user location updates
    geolocateControl.current.on("geolocate", (pos) => {
      const coords = [pos.coords.longitude, pos.coords.latitude];
      setUserLocation(coords);
      setOrigin("Mi ubicación");

      // Custom animated marker
      if (userMarker) {
        userMarker.setLngLat(coords);
      } else {
        const markerEl = document.createElement("div");
        markerEl.className = "user-marker";
        userMarkerRef(markerEl); // attach CSS below
        const newMarker = new mapboxgl.Marker(markerEl)
          .setLngLat(coords)
          .addTo(map.current);
        setUserMarker(newMarker);
      }

      // Center map on user
      map.current.flyTo({ center: coords, zoom: 15, essential: true });
    });
  }, []);

  // --- Suggestion logic
  const handleSuggest = async (query, setValue) => {
    setValue(query);
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query
        )}.json?country=CO&autocomplete=true&access_token=${mapboxgl.accessToken}`
      );
      const data = await res.json();

      const nearUser =
        userLocation &&
        (await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/poi.json?proximity=${userLocation.join(
            ","
          )}&country=CO&limit=5&access_token=${mapboxgl.accessToken}`
        ).then((r) => r.json()));

      const mapboxResults = data.features.map((f) => ({
        name: f.place_name,
        coords: f.center,
      }));

      const nearbyResults = nearUser
        ? nearUser.features.map((f) => ({
            name: f.text,
            coords: f.center,
          }))
        : [];

      // Add major Colombian cities manually (weighted)
      const majorCities = [
        "Bogotá",
        "Medellín",
        "Cali",
        "Barranquilla",
        "Cartagena",
        "Bucaramanga",
        "Manizales",
        "Pereira",
        "Santa Marta",
        "Cúcuta",
        "Villavicencio",
      ]
        .filter((p) => p.toLowerCase().includes(query.toLowerCase()))
        .map((p) => ({ name: p, coords: null }));

      const combined = [
        ...majorCities,
        ...mapboxResults,
        ...nearbyResults,
      ].slice(0, 8);

      setSuggestions(combined);
    } catch (err) {
      console.error("Error getting suggestions:", err);
    }
  };

  // --- Route planner
  const planRoute = async () => {
    if (!origin || !destination) {
      alert("Por favor selecciona origen y destino.");
      return;
    }

    let originCoords;
    let destCoords;

    // Use user location if available
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
        paint: { "line-color": "#00ffae", "line-width": 5 },
      });
    }

    map.current.fitBounds(
      coords.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(coords[0], coords[0])
      ),
      { padding: 50 }
    );

    setRoute(routeData);
  };

  // --- Start navigation
  const startNavigation = () => {
    if (!route) return alert("Primero planifica una ruta.");
    setNavigating(true);
    alert("🚗 Navegación iniciada — sigue la ruta en tiempo real.");
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
            list="origin-suggestions"
          />
          <input
            className="p-2 rounded-lg bg-white/20 placeholder-gray-300"
            placeholder="Destino"
            value={destination}
            onChange={(e) => handleSuggest(e.target.value, setDestination)}
            list="dest-suggestions"
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
        </div>
      </div>

      <datalist id="origin-suggestions">
        {suggestions.map((s, i) => (
          <option key={i} value={s.name} />
        ))}
      </datalist>
      <datalist id="dest-suggestions">
        {suggestions.map((s, i) => (
          <option key={i} value={s.name} />
        ))}
      </datalist>

      {/* Map */}
      <div ref={mapContainer} className="flex-1" />

      {/* Liquid-glass animated user cursor */}
      <style>{`
        .user-marker {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, #00f5ff, #0077ff);
          box-shadow: 0 0 12px rgba(0, 255, 255, 0.8);
          border: 2px solid rgba(255,255,255,0.8);
          animation: pulse 1.6s infinite alternate;
        }
        @keyframes pulse {
          0% { transform: scale(0.9); opacity: 0.9; }
          100% { transform: scale(1.3); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
