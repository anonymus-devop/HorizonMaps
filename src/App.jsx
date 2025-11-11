import React, { useState, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "./index.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const App = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(-74.08175); // Bogotá default
  const [lat, setLat] = useState(4.60971);
  const [zoom, setZoom] = useState(12);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [route, setRoute] = useState(null);
  const [navigating, setNavigating] = useState(false);

  // 🗺️ Initialize Mapbox
  useEffect(() => {
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/navigation-day-v1",
      center: [lng, lat],
      zoom: zoom,
    });

    // 🧭 Geolocate control
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
      showAccuracyCircle: false,
    });

    map.current.addControl(geolocate, "bottom-right");

    geolocate.on("geolocate", (pos) => {
      const { longitude, latitude } = pos.coords;
      setOrigin([longitude, latitude]);
      setLng(longitude);
      setLat(latitude);
    });

    map.current.on("move", () => {
      setLng(map.current.getCenter().lng);
      setLat(map.current.getCenter().lat);
      setZoom(map.current.getZoom().toFixed(2));
    });
  }, []);

  // 🧠 Fetch suggestions for destination
  const fetchSuggestions = async (query) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query
      )}.json?access_token=${mapboxgl.accessToken}&autocomplete=true&country=CO&limit=5`
    );
    const data = await res.json();
    setSuggestions(
      data.features.map((place) => ({
        name: place.place_name,
        coords: place.geometry.coordinates,
      }))
    );
  };

  // 🧭 Plan route
  const planRoute = async (destCoords) => {
    if (!origin || !destCoords) return;
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${destCoords[0]},${destCoords[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`
    );
    const data = await res.json();
    const routeData = data.routes[0];
    setRoute(routeData);

    if (map.current.getSource("route")) {
      map.current.getSource("route").setData({
        type: "Feature",
        geometry: routeData.geometry,
      });
    } else {
      map.current.addLayer({
        id: "route",
        type: "line",
        source: {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: routeData.geometry,
          },
        },
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#00bcd4",
          "line-width": 6,
          "line-opacity": 0.75,
        },
      });
    }

    map.current.fitBounds([
      [origin[0], origin[1]],
      [destCoords[0], destCoords[1]],
    ], { padding: 50 });
  };

  // 🚗 Start navigation (follows route with simulated tracking)
  const startNavigation = () => {
    if (!route) return;
    setNavigating(true);
    let i = 0;
    const interval = setInterval(() => {
      if (i >= route.legs[0].steps.length || !map.current) {
        clearInterval(interval);
        setNavigating(false);
        return;
      }
      const step = route.legs[0].steps[i];
      const [lng, lat] = step.maneuver.location;
      map.current.flyTo({ center: [lng, lat], zoom: 15, speed: 0.8 });
      i++;
    }, 2000);
  };

  return (
    <div className="relative w-screen h-screen">
      <div ref={mapContainer} className="w-full h-full rounded-2xl" />

      {/* 🔍 Search box */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-80 bg-white/30 backdrop-blur-lg rounded-2xl p-2 shadow-lg">
        <input
          type="text"
          placeholder="Destino..."
          value={destination}
          onChange={(e) => {
            setDestination(e.target.value);
            fetchSuggestions(e.target.value);
          }}
          className="w-full p-2 rounded-lg bg-transparent focus:outline-none"
        />
        {suggestions.length > 0 && (
          <ul className="bg-white/60 rounded-xl mt-1 max-h-40 overflow-y-auto">
            {suggestions.map((s, i) => (
              <li
                key={i}
                onClick={() => {
                  setDestination(s.name);
                  planRoute(s.coords);
                  setSuggestions([]);
                }}
                className="p-2 hover:bg-cyan-100 cursor-pointer"
              >
                {s.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 📍 My Location */}
      <button
        onClick={() => {
          if (origin) {
            map.current.flyTo({ center: origin, zoom: 15 });
          } else {
            navigator.geolocation.getCurrentPosition((pos) => {
              const { longitude, latitude } = pos.coords;
              setOrigin([longitude, latitude]);
              map.current.flyTo({ center: [longitude, latitude], zoom: 15 });
            });
          }
        }}
        className="absolute bottom-24 right-4 bg-cyan-500 text-white p-3 rounded-full shadow-lg hover:scale-110 transition"
      >
        📍
      </button>

      {/* ▶️ Start Navigation */}
      <button
        onClick={startNavigation}
        disabled={!route || navigating}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-lg hover:bg-blue-700 transition"
      >
        {navigating ? "Navegando..." : "Iniciar Navegación"}
      </button>
    </div>
  );
};

export default App;
