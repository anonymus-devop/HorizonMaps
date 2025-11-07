import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

// ✅ Load Mapbox token from environment
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_API_KEY;

export default function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(-73.935242);
  const [lat, setLat] = useState(40.73061);
  const [zoom, setZoom] = useState(11);
  const [aiResponse, setAiResponse] = useState("");

  // Initialize Mapbox only once
  useEffect(() => {
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [lng, lat],
      zoom: zoom,
    });

    new mapboxgl.Marker().setLngLat([lng, lat]).addTo(map.current);
  }, []);

  // 🔮 Ask AI for an inclusive description of a route
  async function handleAiAnalysis() {
    setAiResponse("Thinking inclusively... 💭");

    try {
      const prompt = "Suggest an inclusive walking route in this area.";
      const res = await fetch(
        "https://horizonmaps-ai.jerixortixdev.workers.dev/chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        }
      );

      const data = await res.json();
      setAiResponse(data.message || "No AI response");
    } catch (err) {
      setAiResponse("⚠️ Error connecting to AI service.");
      console.error(err);
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gradient-to-br from-blue-500 to-violet-700 text-white font-sans">
      {/* Map */}
      <div ref={mapContainer} className="flex-1 rounded-2xl m-2 shadow-lg" />

      {/* AI Button */}
      <button
        onClick={handleAiAnalysis}
        className="m-4 p-3 text-lg rounded-2xl bg-white/20 backdrop-blur-md hover:bg-white/30"
      >
        🌈 Get Inclusive Route Analysis
      </button>

      {/* AI Response */}
      <div className="m-4 p-3 bg-white/10 rounded-2xl backdrop-blur-md min-h-[100px]">
        {aiResponse}
      </div>
    </div>
  );
}
