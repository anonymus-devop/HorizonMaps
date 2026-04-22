import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "horizonmaps_favorites";
const RECENT_KEY = "horizonmaps_recent";
const MAX_RECENT = 10;

export function useFavorites() {
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  });

  const [recent, setRecent] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  }, [recent]);

  const addFavorite = useCallback((place) => {
    setFavorites((prev) => {
      const exists = prev.some((p) => p.id === place.id);
      if (exists) return prev;
      return [{ ...place, savedAt: Date.now() }, ...prev];
    });
  }, []);

  const removeFavorite = useCallback((id) => {
    setFavorites((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const isFavorite = useCallback(
    (id) => favorites.some((p) => p.id === id),
    [favorites]
  );

  const addRecent = useCallback((place) => {
    setRecent((prev) => {
      const filtered = prev.filter((p) => p.id !== place.id);
      return [{ ...place, searchedAt: Date.now() }, ...filtered].slice(0, MAX_RECENT);
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecent([]);
  }, []);

  return {
    favorites,
    recent,
    addFavorite,
    removeFavorite,
    isFavorite,
    addRecent,
    clearRecent,
  };
}
