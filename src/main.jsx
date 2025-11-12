// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

function isSecureAndProd() {
  return (import.meta.env.PROD === true || window.location.protocol === "https:");
}

if (isSecureAndProd() && "serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("/sw.js");
    } catch (e) {
      console.warn("SW registration failed", e);
    }
  });
}

createRoot(document.getElementById("root")).render(<App />);
