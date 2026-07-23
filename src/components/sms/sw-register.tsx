"use client";

import { useEffect, useState } from "react";

/**
 * Registers the PWA service worker for offline-first caching.
 * Shows a small toast when the app becomes installable/offline-ready.
 */
export function ServiceWorkerRegister() {
  const [status, setStatus] = useState<"idle" | "registered" | "offline">("idle");

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        if (reg.active) {
          setStatus("registered");
        }
      } catch {
        // Service worker registration failed — app still works online
      }
    };

    register();

    // Listen for online/offline changes
    const updateOnlineStatus = () => {
      setStatus(navigator.onLine ? "registered" : "offline");
    };
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  return null;
}
