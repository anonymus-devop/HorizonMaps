import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "";

export default function App() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (mapRef.current) return;
    try {
      mapRef.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-74.08175, 4.60971],
        zoom: 11
      });
      mapRef.current.addControl(new mapboxgl.NavigationControl());
      mapRef.current.on('load', () => setReady(true));
    } catch (e) {
      console.error('map init error', e);
    }
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-screen h-screen relative bg-gradient-to-br from-blue-900 via-indigo-900 to-violet-900 text-white">
      <div ref={mapContainer} className="absolute inset-0" />
      <div className="absolute top-4 left-4 z-50">
        <div className="backdrop-blur-md bg-white/10 p-2 rounded-md">
          <div className="text-sm">HorizonMaps</div>
          <div className="text-xs text-white/70">{ready ? 'Map loaded' : 'Loading map...'}</div>
        </div>
      </div>
    </div>
  );
}
