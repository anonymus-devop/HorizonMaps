import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Navigation, Compass, ArrowUp } from "lucide-react";
import { ManeuverIcon } from "./ManeuverIcon";

export function LiveView({ 
  stream, 
  steps, 
  currentStepIndex, 
  onClose,
  heading = null,
}) {
  const videoRef = useRef(null);
  const currentStep = steps?.[currentStepIndex];
  const nextStep = steps?.[currentStepIndex + 1];

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[60] bg-black"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-cyan-400/60" />
          </div>
        </div>
      </div>

      <div className="absolute top-0 left-0 right-0 p-4 pt-safe">
        <div className="flex items-center justify-between">
          <div className="liquid-glass-strong rounded-xl px-4 py-2 flex items-center gap-2.5">
            <Compass 
              className="w-5 h-5 text-cyan-400 transition-transform duration-500"
              style={{ transform: heading !== null ? `rotate(${heading}deg)` : 'none' }}
            />
            <span className="text-sm font-bold text-white">
              {heading !== null ? `${Math.round(heading)}°` : "--"}
            </span>
          </div>

          <button
            onClick={onClose}
            className="liquid-glass-btn p-3 rounded-full text-white/80 hover:text-white pointer-events-auto"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="absolute top-24 left-0 right-0 flex justify-center px-4 pointer-events-auto">
        <div className="liquid-glass-card max-w-sm w-full p-4">
          {currentStep ? (
            <div className="flex items-center gap-4">
              <div className="liquid-glass-btn p-2 rounded-xl">
                <ManeuverIcon 
                  type={currentStep.type} 
                  modifier={currentStep.modifier} 
                  size="lg" 
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold text-white leading-tight drop-shadow-sm">
                  {currentStep.instruction}
                </p>
                <p className="text-sm text-white/50 mt-0.5">
                  en {Math.round(currentStep.distance)} m
                </p>
              </div>
            </div>
          ) : (
            <p className="text-center text-white/50">Buscando ruta...</p>
          )}
        </div>
      </div>

      {currentStep && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-20">
          <motion.div
            animate={{ y: [0, -12, 0], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            className="flex flex-col items-center"
          >
            <ArrowUp className="w-14 h-14 text-cyan-400 drop-shadow-lg" />
            <div className="liquid-glass-strong rounded-full px-5 py-2 mt-2">
              <span className="text-base font-bold text-white">
                {Math.round(currentStep.distance)} m
              </span>
            </div>
          </motion.div>
        </div>
      )}

      {nextStep && (
        <div className="absolute bottom-24 left-0 right-0 px-4">
          <div className="liquid-glass-subtle rounded-xl p-3 flex items-center gap-3">
            <ManeuverIcon 
              type={nextStep.type} 
              modifier={nextStep.modifier} 
              size="sm" 
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/70">Luego</p>
              <p className="text-xs text-white/40 truncate">{nextStep.instruction}</p>
            </div>
            <span className="text-xs text-white/40">
              {Math.round(nextStep.distance)} m
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
