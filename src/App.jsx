import React, { useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_API_KEY;

export default function App() {
  const [map, setMap] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [aiMessage, setAiMessage] = useState("");

  useEffect(() => {
    const m = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-74.006, 40.7128],
      zoom: 13,
    });
    setMap(m);
    return () => m.remove();
  }, []);

  async function getRoute(start, end) {
    const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${mapboxgl.accessToken}`;
    const res = await fetch(url);
    const data = await res.json();
    const route = data.routes[0].geometry;

    if (map.getSource("route")) {
      map.getSource("route").setData(route);
    } else {
      map.addSource("route", { type: "geojson", data: route });
      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#8e2de2", "line-width": 5 },
      });
    }

    setRouteInfo(data.routes[0]);
    analyzeRouteWithAI(data.routes[0]);
  }

  async function analyzeRouteWithAI(route) {
    setAiMessage("Analyzing route for accessibility...");
    try {
      const res = await fetch("https://YOUR_WORKER_URL.workers.dev/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `You are an accessibility advisor. Based on a walking route of ${route.distance} meters and ${route.duration} seconds, describe its inclusivity and accessibility for all people.`,
        }),
      });
      const data = await res.json();
      setAiMessage(data.message || "No AI response.");
    } catch (e) {
      setAiMessage("Error connecting to AI.");
    }
  }

  function handleRoute() {
    const start = [-74.006, 40.7128];
    const end = [-74.001, 40.722];
    getRoute(start, end);
  }

  return (
    <div className="p-6 min-h-screen">
      <h1 className="text-4xl font-bold mb-4">HorizonMaps 🌈</h1>
      <p className="mb-4 text-gray-200">
        Explore accessible and inclusive routes powered by Mapbox and ChatGPT.
      </p>

      <button
        onClick={handleRoute}
        className="px-6 py-2 bg-white text-black rounded-lg font-semibold hover:bg-gray-200"
      >
        Generate Route with AI Analysis
      </button>

      <div id="map" className="w-full h-[500px] my-6 rounded-2xl shadow-lg" />

      {aiMessage && (
        <div className="glass p-4">
          <h2 className="text-xl font-semibold mb-2">AI Accessibility Insights</h2>
          <p>{aiMessage}</p>
        </div>
      )}
    </div>
  );
}
