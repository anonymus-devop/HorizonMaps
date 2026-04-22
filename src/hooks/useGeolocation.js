import { useState, useEffect, useRef, useCallback } from "react";

export function useGeolocation(options = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 60000,
    watch = false,
    watchInterval = 1000,
  } = options;

  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState("prompt");
  const watchIdRef = useRef(null);

  useEffect(() => {
    if ("permissions" in navigator) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((result) => {
          setPermission(result.state);
          result.onchange = () => setPermission(result.state);
        })
        .catch(() => {});
    }
  }, []);

  const getPosition = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        const err = new Error("Geolocalización no soportada");
        setError(err);
        reject(err);
        return;
      }

      setLoading(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
            timestamp: pos.timestamp,
          };
          setPosition(coords);
          setLoading(false);
          setPermission("granted");
          resolve(coords);
        },
        (err) => {
          setLoading(false);
          let message = "Error de ubicación";
          switch (err.code) {
            case 1:
              message = "Permiso de ubicación denegado";
              setPermission("denied");
              break;
            case 2:
              message = "Ubicación no disponible";
              break;
            case 3:
              message = "Tiempo de espera agotado";
              break;
          }
          const error = new Error(message);
          setError(error);
          reject(error);
        },
        { enableHighAccuracy, timeout, maximumAge }
      );
    });
  }, [enableHighAccuracy, timeout, maximumAge]);

  const startWatching = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    if (watchIdRef.current !== null) return;

    setLoading(true);
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        };
        setPosition(coords);
        setLoading(false);
        setError(null);
      },
      (err) => {
        let message = "Error de seguimiento";
        switch (err.code) {
          case 1: message = "Permiso denegado"; break;
          case 2: message = "Señal GPS perdida"; break;
          case 3: message = "Tiempo agotado"; break;
        }
        setError(new Error(message));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
  }, []);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (watch) {
      startWatching();
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [watch, startWatching]);

  return {
    position,
    error,
    loading,
    permission,
    getPosition,
    startWatching,
    stopWatching,
  };
}
