import React, { useState, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "./index.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const App = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(-74.08175);
  const [lat, setLat] = useState(4.60971);
  const [zoom, setZoom] = useState(12);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [route, setRoute] = useState(null);
  const [navigating, setNavigating] = useState(false);
  const [instruction, setInstruction] = useState("");

  const isMobile = /Mobi|Android/i.test(navigator.userAgent);

  // 🗺️ Initialize map
  useEffect(() => {
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/navigation-day-v1",
      center: [lng, lat],
      zoom: zoom,
    });

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
  }, []);

  // 🔍 Suggestions for destination
  const fetchSuggestions = async (query) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query
      )}.json?country=CO&autocomplete=true&limit=5&access_token=${mapboxgl.accessToken}`
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
      `https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${destCoords[0]},${destCoords[1]}?steps=true&geometries=geojson&language=es&access_token=${mapboxgl.accessToken}`
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
        paint: { "line-color": "#007aff", "line-width": 6, "line-opacity": 0.85 },
      });
    }

    map.current.fitBounds([
      [origin[0], origin[1]],
      [destCoords[0], destCoords[1]],
    ], { padding: 50 });
  };

  // 🗣️ Speak instruction (optional)
  const speak = (text) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "es-CO";
    speechSynthesis.speak(utter);
  };

  // 🚗 Real navigation (mobile only)
  const startNavigation = () => {
    if (!route || !isMobile) {
      alert("Navegación solo disponible en móviles 📱");
      return;
    }

    setNavigating(true);
    const steps = route.legs[0].steps;
    let currentStep = 0;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { longitude, latitude } = pos.coords;
        const userPos = [longitude, latitude];

        map.current.flyTo({ center: userPos, zoom: 15, speed: 1.2 });

        // Check if user is near the next maneuver
        const step = steps[currentStep];
        const [targetLng, targetLat] = step.maneuver.location;
        const dist = Math.sqrt(
          Math.pow(targetLng - longitude, 2) + Math.pow(targetLat - latitude, 2)
        );

        if (dist < 0.0005 && currentStep < steps.length - 1) {
          currentStep++;
          const nextInstruction = steps[currentStep].maneuver.instruction;
          setInstruction(nextInstruction);
          speak(nextInstruction);
        }

        // End navigation
        if (currentStep >= steps.length - 1) {
          setInstruction("Has llegado a tu destino 🎉");
          speak("Has llegado a tu destino");
          navigator.geolocation.clearWatch(watchId);
          setNavigating(false);
        }
      },
      (err) => console.error("Error de geolocalización:", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  };

  return (
    <div className="relative w-screen h-screen">
      <div ref={mapContainer} className="w-full h-full" />

      {/* 🔍 Destination Search */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-80 bg-white/30 backdrop-blur-xl rounded-2xl p-3 shadow-lg">
        <input
          type="text"
          placeholder="¿A dónde vas?"
          value={destination}
          onChange={(e) => {
            setDestination(e.target.value);
            fetchSuggestions(e.target.value);
          }}
          className="w-full p-2 rounded-lg bg-transparent focus:outline-none"
        />
        {suggestions.length > 0 && (
          <ul className="bg-white/70 rounded-xl mt-2 max-h-40 overflow-y-auto">
            {suggestions.map((s, i) => (
              <li
                key={i}
                onClick={() => {
                  setDestination(s.name);
                  planRoute(s.coords);
                  setSuggestions([]);
                }}
                className="p-2 hover:bg-blue-100 cursor-pointer"
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
          if (origin) map.current.flyTo({ center: origin, zoom: 15 });
          else navigator.geolocation.getCurrentPosition((pos) => {
            const { longitude, latitude } = pos.coords;
            setOrigin([longitude, latitude]);
            map.current.flyTo({ center: [longitude, latitude], zoom: 15 });
          });
        }}
        className="absolute bottom-24 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:scale-110 transition"
      >
        📍
      </button>

      {/* ▶️ Start Navigation */}
      <button
        onClick={startNavigation}
        disabled={!route || navigating}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-2xl shadow-lg hover:bg-green-700 transition"
      >
        {navigating ? "Navegando..." : "Iniciar Navegación"}
      </button>

      {/* 🔊 Current Instruction */}
      {navigating && instruction && (
        <div className="absolute bottom-40 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-md px-4 py-3 rounded-xl text-center shadow-lg text-black font-medium w-72">
          {instruction}
        </div>
      )}
    </div>
  );
};

export default App;
