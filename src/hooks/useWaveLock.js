import { useRef, useCallback, useEffect, useState } from "react";

export function useWakeLock() {
  const wakeLockRef = useRef(null);
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(() => "wakeLock" in navigator);

  const request = useCallback(async () => {
    if (!supported) return false;
    
    try {
      if (wakeLockRef.current) return true;
      
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      setActive(true);
      
      wakeLockRef.current.addEventListener("release", () => {
        wakeLockRef.current = null;
        setActive(false);
      });
      
      return true;
    } catch (e) {
      console.warn("Wake lock request failed:", e);
      return false;
    }
  }, [supported]);

  const release = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
      setActive(false);
    }
  }, []);

  useEffect(() => {
    if (!supported) return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && active) {
        request();
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      release();
    };
  }, [supported, active, request, release]);

  return {
    request,
    release,
    active,
    supported,
  };
}
