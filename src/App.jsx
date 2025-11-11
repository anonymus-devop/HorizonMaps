import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(-74.08175); // Bogotá
  const [lat, setLat] = useState(4.60971);
  const [zoom, setZoom] = useState(12);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);

  // --- Initialize Map ---
  useEffect(() => {
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [lng, lat],
      zoom,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Set points with map clicks
    map.current.on("click", (e) => {
      const coords = e.lngLat;
      if (!origin) {
        setOrigin(coords);
        new mapboxgl.Marker({ color: "green" })
          .setLngLat(coords)
          .setPopup(new mapboxgl.Popup().setText("Origin"))
          .addTo(map.current);
      } else if (!destination) {
        setDestination(coords);
        new mapboxgl.Marker({ color: "red" })
          .setLngLat(coords)
          .setPopup(new mapboxgl.Popup().setText("Destination"))
          .addTo(map.current);
      }
    });
  }, [lng, lat, zoom, origin]);

  // --- Fetch and draw route ---
  useEffect(() => {
    if (!origin || !destination || !map.current) return;

    const query = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`;

    fetch(query)
      .then((res) => res.json())
      .then((data) => {
        const routeCoords = data.routes[0].geometry.coordinates;
        setRoute(routeCoords);

        if (map.current.getSource("route")) {
          map.current.getSource("route").setData({
            type: "Feature",
            geometry: { type: "LineString", coordinates: routeCoords },
          });
        } else {
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
            paint: { "line-color": "#00FFFF", "line-width": 5, "line-opacity": 0.8 },
          });
        }

        map.current.fitBounds([origin, destination], { padding: 100 });
      });
  }, [origin, destination]);

  // --- Navigate simulation ---
  const handleNavigate = () => {
    if (!route || currentStep >= route.length - 1) return;
    const next = route[currentStep + 1];
    map.current.flyTo({ center: next, zoom: 15, speed: 0.6 });
    setCurrentStep(currentStep + 1);
  };

  // --- My Location (Geolocation) ---
  const handleLocate = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLng(longitude);
        setLat(latitude);
        map.current.flyTo({ center: [longitude, latitude], zoom: 14 });
        new mapboxgl.Marker({ color: "aqua" })
          .setLngLat([longitude, latitude])
          .setPopup(new mapboxgl.Popup().setText("You are here"))
          .addTo(map.current);
        setOrigin({ lng: longitude, lat: latitude });
      },
      (err) => {
        alert("Location permission denied.");
        console.error(err);
      }
    );
  };

  // --- Reset route ---
  const clearRoute = () => {
    if (map.current.getSource("route")) {
      map.current.removeLayer("route");
      map.current.removeSource("route");
    }
    setOrigin(null);
    setDestination(null);
    setRoute(null);
    setCurrentStep(0);
  };

  return (
    <div className="h-screen w-screen relative overflow-hidden">
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Glassy UI Overlay */}
      <div className="absolute top-4 left-4 space-y-3 p-4 rounded-3xl bg-white/15 backdrop-blur-xl shadow-2xl text-white border border-white/20 w-64">
        <h1 className="text-2xl font-semibold drop-shadow-lg">🌍 HorizonMaps</h1>
        <p className="text-xs text-blue-100">
          Smart navigation and trip planner powered by Mapbox and geolocation.
        </p>
        <div className="flex flex-col space-y-2 mt-2">
          <button
            onClick={handleLocate}
            className="bg-blue-600 hover:bg-blue-700 py-2 rounded-xl transition"
          >
            📍 My Location
          </button>
          <button
            onClick={handleNavigate}
            className="bg-green-600 hover:bg-green-700 py-2 rounded-xl transition disabled:bg-gray-500"
            disabled={!route}
          >
            🧭 Navigate Step
          </button>
          <button
            onClick={clearRoute}
            className="bg-red-600 hover:bg-red-700 py-2 rounded-xl transition"
          >
            ♻️ Clear Route
          </button>
        </div>
      </div>

      {/* Footer glass */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-2xl border border-white/20 px-6 py-3 rounded-full shadow-lg text-white text-sm">
        Built with 💙 using React + Vite + Mapbox GL
      </div>
    </div>
  );
}
