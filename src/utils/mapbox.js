/**
 * Mapbox API Client - Centralizado con manejo de errores y caching
 */

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";
const BASE_URL = "https://api.mapbox.com";

class MapboxAPIError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "MapboxAPIError";
    this.status = status;
    this.code = code;
  }
}

async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === "AbortError") {
      throw new MapboxAPIError("Request timeout", 408, "TIMEOUT");
    }
    throw error;
  }
}

export async function searchPlaces(query, options = {}) {
  if (!query || query.length < 2) return [];
  if (!MAPBOX_TOKEN) {
    const cities = {
      "Bogotá": [-74.08175, 4.60971],
      "Medellín": [-75.5636, 6.2442],
      "Cali": [-76.5225, 3.4516],
      "Cartagena": [-75.5515, 10.391],
      "Barranquilla": [-74.7964, 10.9639],
      "Bucaramanga": [-73.1198, 7.1254],
      "Pereira": [-75.6906, 4.8083],
      "Manizales": [-75.5182, 5.0703],
      "Cúcuta": [-72.5078, 7.8939],
      "Ibagué": [-75.2322, 4.4389],
    };
    
    const matches = Object.entries(cities)
      .filter(([name]) => name.toLowerCase().includes(query.toLowerCase()))
      .map(([name, coords]) => ({
        id: `fallback-${name}`,
        place_name: `${name}, Colombia`,
        center: coords,
        text: name,
        context: [{ text: "Colombia" }],
        fallback: true,
      }));
    
    return matches;
  }

  const { country = "CO", limit = 6, language = "es", proximity } = options;
  let url = `${BASE_URL}/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
    `access_token=${MAPBOX_TOKEN}&autocomplete=true&country=${country}&limit=${limit}&language=${language}`;
  
  if (proximity) {
    url += `&proximity=${proximity[0]},${proximity[1]}`;
  }

  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new MapboxAPIError(`Geocoding failed: ${response.status}`, response.status, "GEOCODING_ERROR");
  }

  const data = await response.json();
  return data.features || [];
}

export async function getDirections(from, to, options = {}) {
  if (!MAPBOX_TOKEN) {
    throw new MapboxAPIError("Mapbox token required", 401, "NO_TOKEN");
  }

  const { 
    profile = "mapbox/driving", 
    steps = true, 
    geometries = "geojson", 
    overview = "full",
    language = "es",
    alternatives = false,
    annotations = ["duration", "distance"]
  } = options;

  const fromStr = `${from[0]},${from[1]}`;
  const toStr = `${to[0]},${to[1]}`;
  
  let url = `${BASE_URL}/directions/v5/${profile}/${fromStr};${toStr}?` +
    `steps=${steps}&geometries=${geometries}&overview=${overview}` +
    `&access_token=${MAPBOX_TOKEN}&language=${language}`;
  
  if (alternatives) url += `&alternatives=true`;
  if (annotations?.length) url += `&annotations=${annotations.join(",")}`;

  const response = await fetchWithTimeout(url, {}, 15000);
  if (!response.ok) {
    throw new MapboxAPIError(`Directions failed: ${response.status}`, response.status, "DIRECTIONS_ERROR");
  }

  const data = await response.json();
  
  if (!data.routes || data.routes.length === 0) {
    throw new MapboxAPIError("No route found", 404, "NO_ROUTE");
  }

  const route = data.routes[0];
  
  const processedRoute = {
    geometry: route.geometry,
    distance: route.distance,
    duration: route.duration,
    weight: route.weight,
    weightName: route.weight_name,
    legs: route.legs.map(leg => ({
      distance: leg.distance,
      duration: leg.duration,
      summary: leg.summary,
      steps: leg.steps.map((step, idx) => ({
        index: idx,
        instruction: step.maneuver.instruction,
        type: step.maneuver.type,
        modifier: step.maneuver.modifier,
        distance: step.distance,
        duration: step.duration,
        geometry: step.geometry,
        mode: step.mode,
        name: step.name,
        ref: step.ref,
        destinations: step.destinations,
        exits: step.exits,
        voiceInstructions: step.voiceInstructions || [],
        bannerInstructions: step.bannerInstructions || [],
        intersections: step.intersections || [],
        maneuver: {
          location: step.maneuver.location,
          bearing_before: step.maneuver.bearing_before,
          bearing_after: step.maneuver.bearing_after,
          type: step.maneuver.type,
          modifier: step.maneuver.modifier,
        }
      }))
    })),
    bounds: route.geometry.coordinates.reduce((bounds, coord) => {
      if (!bounds) return { sw: [...coord], ne: [...coord] };
      return {
        sw: [Math.min(bounds.sw[0], coord[0]), Math.min(bounds.sw[1], coord[1])],
        ne: [Math.max(bounds.ne[0], coord[0]), Math.max(bounds.ne[1], coord[1])],
      };
    }, null),
  };

  return processedRoute;
}

export function formatDuration(seconds) {
  if (!seconds || seconds < 0) return "-- min";
  
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${mins}min`;
  }
  return `${mins} min`;
}

export function formatDistance(meters) {
  if (!meters || meters < 0) return "--";
  
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

export function calculateETA(durationSeconds) {
  const arrival = new Date(Date.now() + durationSeconds * 1000);
  return arrival.toLocaleTimeString("es-CO", { 
    hour: "2-digit", 
    minute: "2-digit",
    hour12: true 
  });
}

export function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getManeuverIcon(type, modifier) {
  const icons = {
    turn: {
      left: "turn-left",
      right: "turn-right",
      slight_left: "turn-slight-left",
      slight_right: "turn-slight-right",
      sharp_left: "turn-sharp-left",
      sharp_right: "turn-sharp-right",
      uturn: "uturn",
    },
    straight: "straight",
    depart: "depart",
    arrive: "arrive",
    merge: "merge",
    fork: {
      left: "fork-left",
      right: "fork-right",
    },
    roundabout: "roundabout",
    "roundabout turn": "roundabout",
    exit: {
      left: "exit-left",
      right: "exit-right",
    },
    ramp: {
      left: "ramp-left",
      right: "ramp-right",
    },
    continue: "continue",
    end_of_road: {
      left: "end-of-road-left",
      right: "end-of-road-right",
    },
  };

  const typeIcons = icons[type] || "continue";
  if (typeof typeIcons === "string") return typeIcons;
  return typeIcons[modifier] || "continue";
}

export function simplifyInstruction(instruction) {
  if (!instruction) return "Continuar";
  
  let simplified = instruction
    .replace(/^Head /, "Dirígete hacia ")
    .replace(/^Turn /, "Gira ")
    .replace(/^Continue /, "Continúa ")
    .replace(/^Merge /, "Incorpórate ")
    .replace(/^Take /, "Toma ")
    .replace(/^Exit /, "Sal ")
    .replace(/^Keep /, "Mantente ")
    .replace(/^U-turn /, "Da vuelta en U ");
  
  return simplified;
}

export { MAPBOX_TOKEN, MapboxAPIError };
