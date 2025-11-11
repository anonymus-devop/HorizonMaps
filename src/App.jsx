import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(-74.08175); // Default: Bogotá
  const [lat, setLat] = useState(4.60971);
  const [zoom, setZoom] = useState(12);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);

  // Initialize Map
  useEffect(() => {
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [lng, lat],
      zoom: zoom,
    });

    // Add controls
    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Click handler to set destination
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

  // Plan route when both points exist
  useEffect(() => {
    if (!origin || !destination || !map.current) return;

    const query = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`;

    fetch(query)
      .then((res) => res.json())
      .then((data) => {
        const route = data.routes[0].geometry.coordinates;
        if (map.current.getSource("route")) {
          map.current.getSource("route").setData({
            type: "Feature",
            geometry: { type: "LineString", coordinates: route },
          });
        } else {
          map.current.addSource("route", {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: { type: "LineString", coordinates: route },
            },
          });
          map.current.addLayer({
            id: "route",
            type: "line",
            source: "route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#1DB954", "line-width": 5 },
          });
        }
      });
  }, [origin, destination]);

  // My Location button
  const handleLocate = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLng(longitude);
        setLat(latitude);
        map.current.flyTo({ center: [longitude, latitude], zoom: 14 });
        new mapboxgl.Marker({ color: "blue" })
          .setLngLat([longitude, latitude])
          .setPopup(new mapboxgl.Popup().setText("My Location"))
          .addTo(map.current);
        setOrigin({ lng: longitude, lat: latitude });
      },
      (err) => {
        alert("Location permission denied or unavailable.");
        console.error(err);
      }
    );
  };

  return (
    <div className="h-screen w-screen relative">
      <div ref={mapContainer} className="absolute top-0 bottom-0 w-full h-full" />
      <button
        onClick={handleLocate}
        className="absolute top-4 left-4 bg-blue-600 text-white px-4 py-2 rounded shadow-md hover:bg-blue-700"
      >
        📍 My Location
      </button>
    </div>
  );
}
