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
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [originQuery, setOriginQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");

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

  // --- Geocode function (search places) ---
  const geocode = async (query) => {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query
    )}.json?access_token=${mapboxgl.accessToken}&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.features.length === 0) return null;
    return {
      lng: data.features[0].center[0],
      lat: data.features[0].center[1],
      place: data.features[0].place_name,
    };
  };

  // --- Find and set origin or destination ---
  const handleFindPlaces = async () => {
    const from = await geocode(originQuery);
    const to = await geocode(destQuery);
    if (!from || !to) {
      alert("Couldn't find one of the locations. Try again.");
      return;
    }

    setOrigin(from);
    setDestination(to);

    // Add markers
    new mapboxgl.Marker({ color: "green" })
      .setLngLat([from.lng, from.lat])
      .setPopup(new mapboxgl.Popup().setText("Origin"))
      .addTo(map.current);

    new mapboxgl.Marker({ color: "red" })
      .setLngLat([to.lng, to.lat])
      .setPopup(new mapboxgl.Popup().setText("Destination"))
      .addTo(map.current);

    map.current.fitBounds(
      [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
      { padding: 80 }
    );

    getRoute(from, to);
  };

  // --- Get route ---
  const getRoute = async (from, to) => {
    const query = `https://api.mapbox.com/directions/v5/mapbox/driving/${from.lng},${from.lat};${to.lng},${to.lat}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`;
    const res = await fetch(query);
    const data = await res.json();
    const routeCoords = data.routes[0].geometry.coordinates;
    setRoute(routeCoords);
    drawRoute(routeCoords);
  };

  // --- Draw route on map ---
  const drawRoute = (coords) => {
    if (map.current.getSource("route")) {
      map.current.removeLayer("route");
      map.current.removeSource("route");
    }
    map.current.addSource("route", {
      type: "geojson",
      data: {
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
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
  };

  // --- Navigate step-by-step ---
  const handleNavigate = () => {
    if (!route.length) return;
    const nextStep = currentStep + 1;
    if (nextStep >= route.length) {
      alert("✅ You’ve reached your destination!");
      return;
    }
    setCurrentStep(nextStep);
    const [lng, lat] = route[nextStep];
    map.current.flyTo({
      center: [lng, lat],
      zoom: 15,
      speed: 0.6,
      curve: 1.2,
      essential: true,
    });
  };

  // --- Locate me (as origin) ---
  const handleLocate = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const coords = { lng: longitude, lat: latitude };
        setOrigin(coords);
        map.current.flyTo({ center: [longitude, latitude], zoom: 14 });
        new mapboxgl.Marker({ color: "aqua" })
          .setLngLat([longitude, latitude])
          .setPopup(new mapboxgl.Popup().setText("You are here"))
          .addTo(map.current);
      },
      (err) => {
        alert("Location permission denied.");
        console.error(err);
      }
    );
  };

  // --- Reset everything ---
  const clearRoute = () => {
    if (map.current.getSource("route")) {
      map.current.removeLayer("route");
      map.current.removeSource("route");
    }
    setRoute([]);
    setCurrentStep(0);
    setOrigin(null);
    setDestination(null);
    setOriginQuery("");
    setDestQuery("");
  };

  return (
    <div className="h-screen w-screen relative overflow-hidden">
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Glass panel UI */}
      <div className="absolute top-4 left-4 space-y-3 p-4 rounded-3xl bg-white/15 backdrop-blur-xl shadow-2xl text-white border border-white/20 w-72">
        <h1 className="text-2xl font-semibold drop-shadow-lg">🌍 HorizonMaps</h1>
        <p className="text-xs text-blue-100">
          Plan, navigate, and explore places worldwide using Mapbox.
        </p>

        <input
          value={originQuery}
          onChange={(e) => setOriginQuery(e.target.value)}
          placeholder="Enter starting place"
          className="w-full px-3 py-2 rounded-xl bg-white/20 text-white placeholder-gray-300 focus:outline-none"
        />
        <input
          value={destQuery}
          onChange={(e) => setDestQuery(e.target.value)}
          placeholder="Enter destination"
          className="w-full px-3 py-2 rounded-xl bg-white/20 text-white placeholder-gray-300 focus:outline-none"
        />
        <div className="flex flex-col space-y-2 mt-2">
          <button
            onClick={handleFindPlaces}
            className="bg-blue-600 hover:bg-blue-700 py-2 rounded-xl transition"
          >
            🔍 Find Route
          </button>
          <button
            onClick={handleNavigate}
            disabled={!route.length}
            className={`py-2 rounded-xl transition ${
              route.length
                ? "bg-green-600 hover:bg-green-700"
                : "bg-gray-500 cursor-not-allowed"
            }`}
          >
            🧭 Navigate Step
          </button>
          <button
            onClick={handleLocate}
            className="bg-purple-600 hover:bg-purple-700 py-2 rounded-xl transition"
          >
            📍 My Location
          </button>
          <button
            onClick={clearRoute}
            className="bg-red-600 hover:bg-red-700 py-2 rounded-xl transition"
          >
            ♻️ Clear Route
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-2xl border border-white/20 px-6 py-3 rounded-full shadow-lg text-white text-sm">
        Built with 💙 using React + Mapbox GL
      </div>
    </div>
  );
}
