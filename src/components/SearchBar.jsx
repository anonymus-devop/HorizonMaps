import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, Clock, Star, X, Loader2, Navigation } from "lucide-react";

export function SearchBar({
  value,
  onChange,
  onSubmit,
  onSelect,
  suggestions = [],
  recent = [],
  favorites = [],
  loading = false,
  onClear,
  onAddFavorite,
  onRemoveFavorite,
  isFavorite,
  placeholder = "¿A dónde vamos?",
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [showRecent, setShowRecent] = useState(true);
  const inputRef = useRef(null);

  const hasSuggestions = suggestions.length > 0 && value.length >= 2;
  const showDropdown = isFocused && (hasSuggestions || (showRecent && recent.length > 0) || favorites.length > 0);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (hasSuggestions) {
        onSelect(suggestions[0]);
      } else {
        onSubmit?.(value);
      }
    }
  };

  const handleSelect = (item) => {
    onSelect(item);
    setIsFocused(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative w-full">
      <div className="liquid-glass-strong rounded-2xl flex items-center gap-2 px-3 py-2.5">
        <div className="p-1.5 rounded-lg bg-white/5 text-cyan-400 shrink-0">
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Search className="w-5 h-5" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowRecent(e.target.value.length === 0);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-white text-base font-medium placeholder-white/40 min-w-0"
          aria-label="Buscar destino"
        />

        {value && (
          <button
            onClick={() => {
              onChange("");
              setShowRecent(true);
              inputRef.current?.focus();
            }}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={() => onSubmit?.(value)}
          className="liquid-glass-btn p-2 rounded-xl text-cyan-400 hover:text-cyan-300 shrink-0"
        >
          <Navigation className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-2 liquid-glass-card z-[60] max-h-[60vh] overflow-y-auto no-scrollbar"
          >
            {hasSuggestions && (
              <div className="py-2">
                <div className="px-4 py-1.5 text-xs font-bold text-white/40 uppercase tracking-wider">
                  Sugerencias
                </div>
                {suggestions.map((s, idx) => (
                  <button
                    key={s.id || `sugg-${idx}`}
                    onClick={() => handleSelect(s)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/10 transition-colors text-left"
                  >
                    <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{s.place_name || s.text}</p>
                      {s.context && (
                        <p className="text-xs text-white/50 truncate">
                          {s.context.map(c => c.text).join(", ")}
                        </p>
                      )}
                    </div>
                    {isFavorite?.(s.id) && (
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {!hasSuggestions && favorites.length > 0 && (
              <div className="py-2 border-t border-white/10">
                <div className="px-4 py-1.5 text-xs font-bold text-white/40 uppercase tracking-wider">
                  Favoritos
                </div>
                {favorites.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleSelect(f)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/10 transition-colors text-left"
                  >
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{f.place_name || f.text}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFavorite?.(f.id);
                      }}
                      className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </button>
                ))}
              </div>
            )}

            {!hasSuggestions && showRecent && recent.length > 0 && (
              <div className="py-2 border-t border-white/10">
                <div className="px-4 py-1.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-white/40 uppercase tracking-wider">
                    Recientes
                  </span>
                  <button
                    onClick={() => {}}
                    className="text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    Borrar
                  </button>
                </div>
                {recent.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleSelect(r)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/10 transition-colors text-left"
                  >
                    <Clock className="w-4 h-4 text-white/40 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{r.place_name || r.text}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddFavorite?.(r);
                      }}
                      className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-yellow-400"
                    >
                      <Star className="w-3 h-3" />
                    </button>
                  </button>
                ))}
              </div>
            )}

            {!hasSuggestions && favorites.length === 0 && recent.length === 0 && value.length === 0 && (
              <div className="px-4 py-6 text-center">
                <MapPin className="w-8 h-8 text-white/20 mx-auto mb-2" />
                <p className="text-sm text-white/40">Escribe un destino para buscar</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
