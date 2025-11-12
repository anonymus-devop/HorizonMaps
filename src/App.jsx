import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "./index.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

function App() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize Mapbox
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-74.0817, 4.6097], // Bogotá
      zoom: 12,
    });

    // Add navigation controls
    mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Add Geolocate control
    const geoLocate = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    });

    mapRef.current.addControl(geoLocate, "top-right");

    // Auto locate on load
    mapRef.current.on("load", () => {
      geoLocate.trigger();
    });

    return () => mapRef.current.remove();
  }, []);

  // My Location Button
  const locateMe = () => {
    if (mapRef.current && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { longitude, latitude } = position.coords;
        mapRef.current.flyTo({
          center: [longitude, latitude],
          zoom: 14,
          speed: 1.5,
        });

        new mapboxgl.Marker({ color: "#1E90FF" })
          .setLngLat([longitude, latitude])
          .addTo(mapRef.current);
      });
    }
  };

  return (
    <div className="relative w-full h-screen">
      <div ref={mapContainer} className="w-full h-full rounded-xl shadow-lg" />
      <button
        onClick={locateMe}
        className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg transition"
      >
        📍
      </button>
    </div>
  );
}

export default App;
