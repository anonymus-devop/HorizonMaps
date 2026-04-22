import React from "react";

export function ManeuverIcon({ type, modifier, size = "md" }) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-20 h-20",
  };

  const iconSize = sizeClasses[size] || sizeClasses.md;

  const getRotation = () => {
    if (type === "straight" || type === "continue") return 0;
    if (type === "depart") return 0;
    if (type === "arrive") return 0;
    
    if (modifier === "left" || modifier === "slight_left") return -90;
    if (modifier === "right" || modifier === "slight_right") return 90;
    if (modifier === "sharp_left") return -135;
    if (modifier === "sharp_right") return 135;
    if (modifier === "uturn") return 180;
    
    return 0;
  };

  const rotation = getRotation();
  const isUturn = type === "uturn" || (type === "roundabout" && modifier === "uturn");
  const isRoundabout = type === "roundabout" || type === "rotary";

  return (
    <div className={`${iconSize} maneuver-icon relative`}>
      {isRoundabout ? (
        <svg viewBox="0 0 24 24" fill="none" className="w-3/4 h-3/4 text-white">
          <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M12 2L12 6M18 6L16 8M6 6L8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M16 12L20 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" markerEnd="url(#arrowhead)" />
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="white" />
            </marker>
          </defs>
        </svg>
      ) : isUturn ? (
        <svg viewBox="0 0 24 24" fill="none" className="w-3/4 h-3/4 text-white">
          <path d="M8 16V8C8 5 10 3 12 3C14 3 16 5 16 8V12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M13 16L16 12L19 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg 
          viewBox="0 0 24 24" 
          fill="none" 
          className="w-3/4 h-3/4 text-white transition-transform duration-300"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <path 
            d="M12 4L12 18M12 4L6 10M12 4L18 10" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
          <path 
            d="M8 18L12 22L16 18" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}

export function DistanceBadge({ distance, unit = "m" }) {
  const formatted = distance >= 1000 
    ? `${(distance / 1000).toFixed(1)} km` 
    : `${Math.round(distance)} m`;

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-full px-3 py-1 text-sm font-bold text-white border border-white/20">
      {formatted}
    </div>
  );
}

export function LaneIndicator({ lanes, activeLane }) {
  if (!lanes || lanes.length === 0) return null;

  return (
    <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md rounded-lg p-2">
      {lanes.map((lane, idx) => (
        <div
          key={idx}
          className={`w-8 h-10 rounded flex items-center justify-center text-xs font-bold ${
            idx === activeLane
              ? "bg-cyan-500 text-white"
              : "bg-white/10 text-white/50"
          }`}
        >
          {lane.indications?.[0]?.charAt(0).toUpperCase() || "↑"}
        </div>
      ))}
    </div>
  );
}
