"use client";

/**
 * Polyfill / Guard for releasePointerCapture DOM exception.
 * Prevents uncaught NotFoundError when Radix UI modals / dev overlays
 * release pointer capture after elements unmount or state changes on touch devices.
 */
if (typeof window !== "undefined" && typeof Element !== "undefined") {
  const originalReleasePointerCapture = Element.prototype.releasePointerCapture;
  if (originalReleasePointerCapture) {
    Element.prototype.releasePointerCapture = function (pointerId: number) {
      try {
        if (this.hasPointerCapture && this.hasPointerCapture(pointerId)) {
          originalReleasePointerCapture.call(this, pointerId);
        }
      } catch {
        // Safe silence for stale pointer capture releases on unmounted elements
      }
    };
  }
}

export function PointerCaptureFix() {
  return null;
}
