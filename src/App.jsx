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

  // --- Geocode text to coordinates ---
  const geocode = async (query) => {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query
    )}.json?access_token=${mapboxgl.accessToken}&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.features.length) return null;
    const [lng, lat] = data.features[0].center;
    return { lng, lat };
  };

  // --- Fetch and render route ---
  const getRoute = async (from, to) => {
    const query = `https://api.mapbox.com/directions/v5/mapbox/driving/${from.lng},${from.lat};${to.lng},${to.lat}?steps=true&geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;
    const res = await fetch(query);
    const data = await res.json();

    const routeCoords = data.routes[0].geometry.coordinates;
    const routeSteps = data.routes[0].legs[0].steps.map((s) => ({
      instruction: s.maneuver.instruction,
      location: s.maneuver.location,
    }));

    setRoute(routeCoords);
    setSteps(routeSteps);

    // Draw line
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

    map.current.fitBounds(
      [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
      { padding: 60 }
    );

    // Add a movable marker for navigation
    if (markerRef.current) markerRef.current.remove();
    markerRef.current = new mapboxgl.Marker({ color: "aqua" })
      .setLngLat([from.lng, from.lat])
      .addTo(map.current);
  };

  // --- Handle route planning ---
  const handleFindPlaces = async () => {
    const from = await geocode(originQuery);
    const to = await geocode(destQuery);
    if (!from || !to) {
      alert("Couldn't find one of the locations.");
      return;
    }
    setOrigin(from);
    setDestination(to);
    getRoute(from, to);
  };

  // --- Step-by-step navigation logic ---
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

    // Animate camera
    map.current.flyTo({
      center: [lng, lat],
      zoom: 15,
      speed: 0.7,
      curve: 1.4,
      essential: true,
    });

    // Move the navigation marker
    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
    }

    setCurrentStep(nextStep);
  };

  // --- Locate current user as origin ---
  const handleLocate = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lng: pos.coords.longitude,
          lat: pos.coords.latitude,
        };
        setOrigin(coords);
        setOriginQuery("My Location");
        new mapboxgl.Marker({ color: "#00ffcc" })
          .setLngLat([coords.lng, coords.lat])
          .setPopup(new mapboxgl.Popup().setText("You are here"))
          .addTo(map.current);
        map.current.flyTo({ center: [coords.lng, coords.lat], zoom: 14 });
      },
      () => alert("Location access denied.")
    );
  };

  // --- Reset ---
  const clearRoute = () => {
    if (map.current.getSource("route")) {
      map.current.removeLayer("route");
      map.current.removeSource("route");
    }
    setRoute([]);
    setSteps([]);
    setCurrentStep(0);
    setOrigin(null);
    setDestination(null);
    setOriginQuery("");
    setDestQuery("");
    setIsNavigating(false);
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  };

  return (
    <div className="h-screen w-screen relative overflow-hidden">
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Glass UI */}
      <div className="absolute top-4 left-4 space-y-3 p-4 rounded-3xl bg-white/15 backdrop-blur-xl shadow-2xl text-white border border-white/20 w-80">
        <h1 className="text-2xl font-semibold">🚗 HorizonMaps</h1>
        <p className="text-xs text-blue-100">
          Plan, explore, and navigate routes in real time.
        </p>

        <input
          value={originQuery}
          onChange={(e) => setOriginQuery(e.target.value)}
          placeholder="Enter origin (e.g. Bogotá)"
          className="w-full px-3 py-2 rounded-xl bg-white/20 text-white placeholder-gray-300 focus:outline-none"
        />
        <input
          value={destQuery}
          onChange={(e) => setDestQuery(e.target.value)}
          placeholder="Enter destination (e.g. Medellín)"
          className="w-full px-3 py-2 rounded-xl bg-white/20 text-white placeholder-gray-300 focus:outline-none"
        />

        <div className="flex flex-col space-y-2 mt-2">
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
                : "bg-gray-500 cursor-not-allowed"
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

        {/* Step instructions */}
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

      {/* Footer */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-2xl border border-white/20 px-6 py-3 rounded-full shadow-lg text-white text-sm">
        HorizonMaps © 2025 — Powered by Mapbox GL
      </div>
    </div>
  );
}
