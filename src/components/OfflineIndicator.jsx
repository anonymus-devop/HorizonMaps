import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, AlertCircle } from "lucide-react";

export function OfflineIndicator({ isOnline }) {
  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="absolute top-20 left-1/2 -translate-x-1/2 z-[70]"
        >
          <div className="liquid-glass-cyan rounded-full px-5 py-2.5 flex items-center gap-2.5">
            <WifiOff className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-white">Sin conexión</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ErrorToast({ message, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className="absolute top-24 left-1/2 -translate-x-1/2 z-[70] max-w-[90%]"
    >
      <div className="liquid-glass-cyan rounded-2xl px-5 py-3 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
        <span className="text-sm font-medium text-white">{message}</span>
        {onClose && (
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-white/10 rounded-full transition-colors ml-2"
          >
            <XIcon className="w-4 h-4 text-white/60" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

function XIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
