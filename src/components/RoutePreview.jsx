import React from "react";
import { motion } from "framer-motion";
import { Navigation, Clock, Play, X, Route, ArrowRight } from "lucide-react";
import { formatDuration, formatDistance } from "../utils/mapbox";

export function RoutePreview({ route, onStartNavigation, onCancel }) {
  if (!route) return null;

  const { distance, duration, legs } = route;
  const mainLeg = legs?.[0];

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className="absolute bottom-0 left-0 right-0 z-50"
    >
      <div className="liquid-glass-card mx-2 mb-2">
        <div className="flex items-center justify-between px-5 pt-4 pb-2 relative z-10">
          <div className="flex items-center gap-2">
            <Route className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-bold text-white drop-shadow-sm">Ruta calculada</h3>
          </div>
          <button
            onClick={onCancel}
            className="liquid-glass-btn p-2 rounded-full text-white/60 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-3 px-5 mb-4 relative z-10">
          <div className="flex-1 liquid-glass-subtle rounded-xl p-3 text-center">
            <Clock className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-white drop-shadow-sm">{formatDuration(duration)}</p>
            <p className="text-xs text-white/50">tiempo estimado</p>
          </div>
          <ArrowRight className="w-5 h-5 text-white/30" />
          <div className="flex-1 liquid-glass-subtle rounded-xl p-3 text-center">
            <Navigation className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-white drop-shadow-sm">{formatDistance(distance)}</p>
            <p className="text-xs text-white/50">distancia total</p>
          </div>
        </div>

        {mainLeg && (
          <div className="space-y-1.5 mb-4 mx-4 max-h-[25vh] overflow-y-auto no-scrollbar relative z-10">
            {mainLeg.steps.slice(0, 5).map((step, idx) => (
              <div key={idx} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
                <div className="w-7 h-7 rounded-full liquid-glass-subtle flex items-center justify-center text-xs font-bold text-white/60 shrink-0">
                  {idx + 1}
                </div>
                <p className="text-sm text-white/80 flex-1 truncate">{step.instruction}</p>
                <span className="text-xs text-white/40 font-mono shrink-0">
                  {formatDistance(step.distance)}
                </span>
              </div>
            ))}
            {mainLeg.steps.length > 5 && (
              <p className="text-xs text-white/40 text-center py-1">
                +{mainLeg.steps.length - 5} pasos más...
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3 px-5 pb-5 relative z-10">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl liquid-glass-btn text-white/70 font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={onStartNavigation}
            className="flex-[2] py-3 rounded-xl liquid-glass-cyan text-white font-bold flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5 fill-white" />
            Iniciar navegación
          </button>
        </div>
      </div>
    </motion.div>
  );
}
