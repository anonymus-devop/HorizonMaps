import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(-74.08175);
  const [lat, setLat] = useState(4.60971);
  const [zoom, setZoom] = useState(12);
  const [originQuery, setOriginQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState([]);
  const [steps, setSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const markerRef = useRef(null);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [userPosition, setUserPosition] = useState(null);

  // --- Initialize map ---
  useEffect(() => {
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [lng, lat],
      zoom,
    });
    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
  }, []);

  // --- Predefined major Colombian locations ---
  const majorColombianPlaces = [
    { name: "Bogotá", coords: [-74.08175, 4.60971] },
    { name: "Medellín", coords: [-75.56359, 6.25184] },
    { name: "Cali", coords: [-76.5307, 3.43722] },
    { name: "Cartagena", coords: [-75.51444, 10.39972] },
    { name: "Barranquilla", coords: [-74.79639, 10.96389] },
    { name: "Santa Marta", coords: [-74.195, 11.2408] },
    { name: "Bucaramanga", coords: [-73.1198, 7.12539] },
    { name: "Pereira", coords: [-75.6961, 4.81333] },
    { name: "Manizales", coords: [-75.5183, 5.0703] },
  ];

  // --- Suggest logic: prioritize Colombian places ---
  const fetchSuggestions = async (query) => {
    if (!query.trim()) {
      setDestSuggestions([]);
      return;
    }

    // Filter predefined Colombian cities first
    const localMatches = majorColombianPlaces.filter((place) =>
      place.name.toLowerCase().includes(query.toLowerCase())
    );

    let suggestions = localMatches.map((p) => ({
      id: p.name,
      place_name: p.name + ", Colombia",
      center: p.coords,
      type: "local",
    }));

    // Fallback: Mapbox suggestions near user location
    let proximity = "";
    if (userPosition)
      proximity = `&proximity=${userPosition.lng},${userPosition.lat}`;

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query
    )}.json?access_token=${mapboxgl.accessToken}&autocomplete=true&limit=5&country=CO${proximity}`;
    const res = await fetch(url);
    const data = await res.json();

    const mapboxSuggestions = data.features.map((f) => ({
      id: f.id,
      place_name: f.place_name,
      center: f.center,
      type: "mapbox",
    }));

    // Merge Colombian + Mapbox suggestions
    suggestions = [...suggestions, ...mapboxSuggestions];
    setDestSuggestions(suggestions);
  };

  // --- Geocode text to coordinates ---
  const geocode = async (query) => {
    const local = majorColombianPlaces.find(
      (p) => p.name.toLowerCase() === query.toLowerCase()
    );
    if (local) return { lng: local.coords[0], lat: local.coords[1] };

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query
    )}.json?access_token=${mapboxgl.accessToken}&limit=1&country=CO`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.features.length) return null;
    const [lng, lat] = data.features[0].center;
    return { lng, lat };
  };

  // --- Get and draw route ---
  const getRoute = async (from, to) => {
    const query = `https://api.mapbox.com/directions/v5/mapbox/driving/${from.lng},${from.lat};${to.lng},${to.lat}?steps=true&geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;
    const res = await fetch(query);
    const data = await res.json();

    if (!data.routes || !data.routes.length) {
      alert("⚠️ No route found. Try another location.");
      return;
    }

    const routeCoords = data.routes[0].geometry.coordinates;
    const routeSteps = data.routes[0].legs[0].steps.map((s) => ({
      instruction: s.maneuver.instruction,
      location: s.maneuver.location,
    }));

    setRoute(routeCoords);
    setSteps(routeSteps);
    setCurrentStep(0);

    if (map.current.getSource("route")) {
      map.current.removeLayer("route");
      map.current.removeSource("route");
    }

    map.current.addSource("route", {
      type: "geojson",
      data: {
        type: "Feature",
        geometry: { type: "LineString", coordinates: routeCoords },
      },
    });

    map.current.addLayer({
      id: "route",
      type: "line",
      source: "route",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#00ffff",
        "line-width": 5,
        "line-opacity": 0.8,
      },
    });

    // --- Add the liquid glass cursor ---
    const el = document.createElement("div");
    el.className =
      "liquid-marker w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-300 to-blue-400 opacity-90 shadow-lg border border-white/30 animate-pulse";
    const marker = new mapboxgl.Marker({ element: el }).setLngLat([from.lng, from.lat]).addTo(map.current);
    markerRef.current = marker;

    map.current.fitBounds(
      [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
      { padding: 60 }
    );
  };

  // --- Plan route ---
  const handleFindPlaces = async () => {
    const from = originQuery === "My Location" && userPosition ? userPosition : await geocode(originQuery);
    const to = await geocode(destQuery);
    if (!from || !to) {
      alert("❌ Couldn't find one of the locations.");
      return;
    }
    setOrigin(from);
    setDestination(to);
    await getRoute(from, to);
  };

  // --- Navigate logic ---
  const handleNavigate = () => {
    if (!steps.length) return alert("No route loaded.");
    if (currentStep >= steps.length - 1) {
      alert("✅ Destination reached!");
      setIsNavigating(false);
      return;
    }

    setIsNavigating(true);
    const nextStep = currentStep + 1;
    const [lng, lat] = steps[nextStep].location;

    map.current.flyTo({ center: [lng, lat], zoom: 15, speed: 0.8, curve: 1.3 });
    markerRef.current.setLngLat([lng, lat]);
    setCurrentStep(nextStep);
  };

  // --- Locate current position ---
  const handleLocate = () => {
    if (!navigator.geolocation) return alert("Geolocation not supported.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lng: pos.coords.longitude,
          lat: pos.coords.latitude,
        };
        setUserPosition(coords);
        setOrigin(coords);
        setOriginQuery("My Location");

        new mapboxgl.Marker({ color: "#00ffcc" })
          .setLngLat([coords.lng, coords.lat])
          .setPopup(new mapboxgl.Popup().setText("📍 You are here"))
          .addTo(map.current);

        map.current.flyTo({ center: [coords.lng, coords.lat], zoom: 14 });
      },
      () => alert("Permission denied.")
    );
  };

  // --- Reset ---
  const clearRoute = () => {
    if (map.current.getSource("route")) {
      map.current.removeLayer("route");
      map.current.removeSource("route");
    }
    setSteps([]);
    setRoute([]);
    setCurrentStep(0);
    setIsNavigating(false);
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  };

  return (
    <div className="h-screen w-screen relative overflow-hidden">
      <div ref={mapContainer} className="absolute inset-0" />

      <div className="absolute top-4 left-4 p-4 w-80 rounded-3xl bg-white/15 backdrop-blur-2xl text-white border border-white/20 shadow-2xl space-y-3">
        <h1 className="text-2xl font-bold">🌍 HorizonMaps</h1>
        <p className="text-xs text-blue-100">
          Plan routes, navigate, and explore Colombia.
        </p>

        <input
          value={originQuery}
          onChange={(e) => setOriginQuery(e.target.value)}
          placeholder="Origin (e.g. Bogotá)"
          className="w-full px-3 py-2 rounded-xl bg-white/20 text-white placeholder-gray-300 focus:outline-none"
        />

        <div className="relative">
          <input
            value={destQuery}
            onChange={(e) => {
              setDestQuery(e.target.value);
              fetchSuggestions(e.target.value);
            }}
            placeholder="Destination (e.g. Medellín)"
            className="w-full px-3 py-2 rounded-xl bg-white/20 text-white placeholder-gray-300 focus:outline-none"
          />
          {destSuggestions.length > 0 && (
            <ul className="absolute z-10 bg-black/70 backdrop-blur-xl w-full mt-1 rounded-xl max-h-40 overflow-auto border border-white/10">
              {destSuggestions.map((place) => (
                <li
                  key={place.id}
                  onClick={() => {
                    setDestQuery(place.place_name);
                    setDestSuggestions([]);
                  }}
                  className="px-3 py-2 hover:bg-white/20 cursor-pointer text-sm"
                >
                  {place.place_name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col space-y-2">
          <button
            onClick={handleFindPlaces}
            className="bg-blue-600 hover:bg-blue-700 py-2 rounded-xl transition"
          >
            🗺️ Plan Route
          </button>

          <button
            onClick={handleNavigate}
            disabled={!steps.length}
            className={`py-2 rounded-xl transition ${
              steps.length
                ? "bg-green-600 hover:bg-green-700"
                : "bg-gray-600 cursor-not-allowed"
            }`}
          >
            {isNavigating ? "➡️ Next Step" : "🧭 Start Navigation"}
          </button>

          <button
            onClick={handleLocate}
            className="bg-purple-600 hover:bg-purple-700 py-2 rounded-xl transition"
          >
            📍 Use My Location
          </button>

          <button
            onClick={clearRoute}
            className="bg-red-600 hover:bg-red-700 py-2 rounded-xl transition"
          >
            ♻️ Clear
          </button>
        </div>

        {steps.length > 0 && (
          <div className="mt-3 text-xs bg-white/10 rounded-xl p-2 max-h-28 overflow-auto border border-white/20">
            <p className="font-semibold mb-1 text-blue-200">
              Directions ({currentStep + 1}/{steps.length})
            </p>
            {steps.map((s, i) => (
              <p
                key={i}
                className={`${
                  i === currentStep ? "text-yellow-300" : "text-gray-300"
                }`}
              >
                • {s.instruction}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-2xl border border-white/20 px-6 py-3 rounded-full shadow-lg text-white text-sm">
        HorizonMaps © 2025 — Smart Colombian Navigation
      </div>
    </div>
  );
}
