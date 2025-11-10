import React, { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'

export default function App() {
  const mapContainer = useRef(null)
  const map = useRef(null)

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN
    if (!token) {
      console.error('❌ Missing Mapbox token.')
      return
    }

    mapboxgl.accessToken = token

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-74.006, 40.7128], // NYC
      zoom: 10,
    })

    return () => map.current?.remove()
  }, [])

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-r from-blue-600 to-violet-700 text-white">
      <div className="absolute top-4 text-center backdrop-blur-xl bg-white/10 px-4 py-2 rounded-2xl shadow-xl">
        <h1 className="text-3xl font-bold">🌍 HorizonMaps</h1>
        <p className="text-sm text-blue-100">AI-po
