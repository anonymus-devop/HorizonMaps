import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navigation, Clock, MapPin, ChevronUp, ChevronDown, Gauge } from "lucide-react";
import { ManeuverIcon, DistanceBadge } from "./ManeuverIcon";
import { formatDuration, formatDistance, calculateETA } from "../utils/mapbox";

export function NavigationPanel({ 
  route, 
  steps, 
  currentStepIndex, 
  position,
  onStopNavigation,
  onToggleSteps,
  showSteps = false,
}) {
  if (!steps || steps.length === 0 || currentStepIndex >= steps.length) return null;

  const currentStep = steps[currentStepIndex];
  const nextStep = steps[currentStepIndex + 1];
  
  const progress = ((currentStepIndex + 1) / steps.length) * 100;
  const remainingDistance = steps.slice(currentStepIndex).reduce((sum, s) => sum + (s.distance || 0), 0);
  const remainingDuration = steps.slice(currentStepIndex).reduce((sum, s) => sum + (s.duration || 0), 0);
  const currentSpeed = position?.speed ? (position.speed * 3.6).toFixed(0) : null;

  return (
    <motion.div
      initial={{ y: 200, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 200, opacity: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className="absolute bottom-0 left-0 right-0 z-50"
    >
      <div className="h-1 bg-white/5 mx-4 rounded-full overflow-hidden">
        <motion.div 
          className="h-full rounded-full"
          style={{ 
            background: "linear-gradient(90deg, #0ea5e9, #38bdf8, #22d3ee)",
            boxShadow: "0 0 10px rgba(56, 189, 248, 0.5)",
          }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>

      <div className="liquid-glass-card mt-2 mx-2">
        <div className="px-5 pt-4 pb-2 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-white drop-shadow-sm">
                {formatDuration(remainingDuration)}
              </span>
              <span className="text-xs text-white/60">
                {calculateETA(remainingDuration)}
              </span>
            </div>
            <div className="w-px h-10 bg-white/15" />
            <div className="flex flex-col">
              <span className="text-lg font-semibold text-white drop-shadow-sm">
                {formatDistance(remainingDistance)}
              </span>
              <span className="text-xs text-white/50">restante</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {currentSpeed && (
              <div className="liquid-glass-subtle rounded-xl px-3 py-1.5 text-center">
                <div className="flex items-center gap-1 text-cyan-400">
                  <Gauge className="w-4 h-4" />
                  <span className="text-lg font-bold">{currentSpeed}</span>
                </div>
                <span className="text-xs text-white/50">km/h</span>
              </div>
            )}
            <button
              onClick={onStopNavigation}
              className="liquid-glass-btn px-4 py-2 rounded-xl text-red-400 hover:text-red-300 text-sm font-medium"
            >
              Salir
            </button>
          </div>
        </div>

        <div className="px-5 py-3 flex items-center gap-4 relative z-10">
          <div className="liquid-glass-btn p-2 rounded-2xl">
            <ManeuverIcon 
              type={currentStep.type} 
              modifier={currentStep.modifier} 
              size="lg" 
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-semibold text-white leading-tight drop-shadow-sm">
              {currentStep.instruction}
            </p>
            <p className="text-sm text-white/50 mt-0.5">
              en {currentStep.name || "la ruta"}
            </p>
          </div>
          <DistanceBadge distance={currentStep.distance} />
        </div>

        {nextStep && (
          <div className="px-5 py-2 mx-4 mb-2 liquid-glass-subtle rounded-xl relative z-10">
            <div className="flex items-center gap-3">
              <ManeuverIcon 
                type={nextStep.type} 
                modifier={nextStep.modifier} 
                size="sm" 
              />
              <span className="text-sm text-white/70 truncate flex-1">
                Luego: {nextStep.instruction}
              </span>
              <span className="text-xs text-white/40">
                {formatDistance(nextStep.distance)}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={onToggleSteps}
          className="w-full py-2.5 flex items-center justify-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors border-t border-white/5 relative z-10"
        >
          {showSteps ? (
            <>
              <ChevronDown className="w-4 h-4" />
              Ocultar pasos
            </>
          ) : (
            <>
              <ChevronUp className="w-4 h-4" />
              Ver {steps.length} pasos
            </>
          )}
        </button>

        <AnimatePresence>
          {showSteps && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="max-h-[40vh] overflow-y-auto no-scrollbar px-3 py-2 space-y-1 relative z-10">
                {steps.map((step, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 p-3 rounded-xl transition-all relative z-10 ${
                      idx === currentStepIndex
                        ? "liquid-glass-cyan"
                        : idx < currentStepIndex
                        ? "opacity-40"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <div className={`mt-0.5 ${idx === currentStepIndex ? "text-cyan-400" : "text-white/40"}`}>
                      {idx === currentStepIndex ? (
                        <Navigation className="w-5 h-5" />
                      ) : idx < currentStepIndex ? (
                        <div className="w-5 h-5 rounded-full bg-white/20" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-white/30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium leading-snug ${
                        idx === currentStepIndex ? "text-white" : "text-white/70"
                      }`}>
                        {step.instruction}
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">
                        {step.name}
                      </p>
                    </div>
                    <span className="text-xs text-white/50 font-mono shrink-0">
                      {formatDistance(step.distance)}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function NavigationTopBar({ duration, distance, onExit }) {
  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="absolute top-0 left-0 right-0 z-50 pt-safe"
    >
      <div className="bg-gradient-to-b from-black/70 to-transparent pt-3 pb-8 px-3">
        <div className="flex items-center justify-between gap-2">
          <div className="liquid-glass-strong rounded-xl px-4 py-2 flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-bold text-white">{formatDuration(duration)}</span>
            <span className="text-xs text-white/50 hidden sm:inline">({calculateETA(duration)})</span>
          </div>
          
          <div className="liquid-glass rounded-xl px-4 py-2 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-white">{formatDistance(distance)}</span>
          </div>
          
          <button
            onClick={onExit}
            className="liquid-glass-btn px-3 py-2 rounded-xl text-white/70 hover:text-white text-sm font-medium"
          >
            Salir
          </button>
        </div>
      </div>
    </motion.div>
  );
}
