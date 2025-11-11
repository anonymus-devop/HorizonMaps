import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);

  const [userLocation, setUserLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // 🗺️ Initialize Map
  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-74.006, 40.7128],
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    // 📍 When user clicks a point → set destination
    map.current.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      setDestination([lng, lat]);
    });
  }, []);

  // 🎯 Draw user and destination markers
  useEffect(() => {
    if (!map.current) return;

    // Clear old layers
    ["user", "dest", "route"].forEach((id) => {
      if (map.current.getLayer(id)) map.current.removeLayer(id);
      if (map.current.getSource(id)) map.current.removeSource(id);
    });

    // 🟢 User marker
    if (userLocation) {
      map.current.addSource("user", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "Point", coordinates: userLocation },
        },
      });
      map.current.addLayer({
        id: "user",
        type: "circle",
        source: "user",
        paint: {
          "circle-radius": 8,
          "circle-color": "#00FF88",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
        },
      });
    }

    // 🔵 Destination marker
    if (destination) {
      map.current.addSource("dest", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "Point", coordinates: destination },
        },
      });
      map.current.addLayer({
        id: "dest",
        type: "circle",
        source: "dest",
        paint: {
          "circle-radius": 8,
          "circle-color": "#00BFFF",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
        },
      });
    }

    // 🛣️ Draw route if available
    if (route) {
      map.current.addSource("route", {
        type: "geojson",
        data: route,
      });
      map.current.addLayer({
        id: "route",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#FFD700",
          "line-width": 5,
        },
      });
    }
  }, [userLocation, destination, route]);

  // 📍 Locate user and request permission
  const locateUser = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude, latitude } = pos.coords;
        setUserLocation([longitude, latitude]);
        map.current.flyTo({ center: [longitude, latitude], zoom: 14 });
      },
      (err) => {
        console.error("Location error:", err);
        alert("Unable to get your location.");
      },
      { enableHighAccuracy: true }
    );
  };

  // 📦 Plan a route (using Mapbox Directions API)
  const getRoute = async () => {
    if (!userLocation || !destination) {
      alert("You need both origin (your location) and destination.");
      return;
    }

    setIsLoading(true);
    const [originLng, originLat] = userLocation;
    const [destLng, destLat] = destination;

    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${originLng},${originLat};${destLng},${destLat}?geometries=geojson&access_token=${mapboxgl.accessToken}`
    );

    const data = await res.json();

    if (!data.routes || !data.routes.length) {
      alert("No route found.");
      setIsLoading(false);
      return;
    }

    const routeGeoJSON = {
      type: "Feature",
      geometry: data.routes[0].geometry,
    };

    setRoute(routeGeoJSON);
    setIsLoading(false);

    // Fit map bounds to the route
    const bounds = new mapboxgl.LngLatBounds();
    routeGeoJSON.geometry.coordinates.forEach((coord) => bounds.extend(coord));
    map.current.fitBounds(bounds, { padding: 60 });
  };

  // 🧭 Simulate navigation step-by-step
  const startNavigation = () => {
    if (!route) {
      alert("Plan a route first!");
      return;
    }

    const coords = route.geometry.coordinates;
    let index = 0;

    const move = () => {
      if (index >= coords.length) return;
      const next = coords[index];
      setUserLocation(next);
      map.current.flyTo({ center: next, zoom: 14, speed: 0.8 });
      index++;
      requestAnimationFrame(move);
    };

    move();
  };

  return (
    <div className="h-screen w-screen relative">
      <div ref={mapContainer} className="h-full w-full" />

      {/* UI Overlay */}
      <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md p-4 rounded-lg text-white w-64 space-y-3">
        <h1 className="text-xl font-bold">🌍 HorizonMaps</h1>
        <p className="text-sm text-blue-200">
          Locate, plan route, and navigate.
        </p>

        <button
          onClick={locateUser}
          className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded w-full"
        >
          📍 My Location
        </button>

        <button
          onClick={getRoute}
          className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded w-full"
        >
          🗺️ Plan Route
        </button>

        <button
          onClick={startNavigation}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded w-full"
        >
          🧭 Start Navigation
        </button>

        {isLoading && <p className="text-sm text-gray-400">Loading route...</p>}

        {userLocation && (
          <p className="text-xs text-gray-300">
            🧭 Origin: {userLocation[1].toFixed(4)}, {userLocation[0].toFixed(4)}
          </p>
        )}
        {destination && (
          <p className="text-xs text-gray-300">
            🎯 Dest: {destination[1].toFixed(4)}, {destination[0].toFixed(4)}
          </p>
        )}
      </div>
    </div>
  );
}
