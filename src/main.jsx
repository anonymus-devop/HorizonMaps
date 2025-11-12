import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

/**
 * PWA helpers:
 * - Only register SW in production builds and when running under a secure origin.
 * - Detect "installed" (standalone) mode for both browsers and Android PWAs.
 */

function isSecureContextAndProd() {
  return (
    (import.meta.env.PROD === true || window.location.protocol === "https:") &&
    typeof navigator !== "undefined"
  );
}

function isInstalledPWA() {
  // iOS
  if (window.navigator.standalone) return true;
  // modern browsers
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
  // Android Chrome: checks
  if (document.referrer && document.referrer.startsWith("android-app://")) return true;
  return false;
}

// Optional UI for install prompt; store the event to show later
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  window.__horizon_deferredPrompt = e;
});

if (isSecureContextAndProd()) {
  // register service worker only in production and secure contexts
  if ("serviceWorker" in navigator) {
    // register after load to avoid blocking initial paint
    window.addEventListener("load", async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        // console.log("SW registered", reg);
      } catch (err) {
        // console.warn("SW registration failed", err);
      }
    });
  }
}

// Render app and expose install helpers
const root = createRoot(document.getElementById("root"));
root.render(<App isPwa={isInstalledPWA()} deferredPrompt={deferredPrompt} />);
