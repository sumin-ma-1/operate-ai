"use client";

import { useCallback, useEffect, useState, type PointerEvent } from "react";

interface UseResizableWidthOptions {
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  /** Which side of the panel the drag handle sits on */
  handleSide: "left" | "right";
  storageKey?: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function useResizableWidth({
  defaultWidth,
  minWidth,
  maxWidth,
  handleSide,
  storageKey,
}: UseResizableWidthOptions) {
  const [width, setWidth] = useState(defaultWidth);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;
    const parsed = Number(saved);
    if (!Number.isNaN(parsed)) {
      setWidth(clamp(parsed, minWidth, maxWidth));
    }
  }, [storageKey, minWidth, maxWidth]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, String(width));
  }, [storageKey, width]);

  const onResizeStart = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = width;

      const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
        const delta = moveEvent.clientX - startX;
        const nextWidth =
          handleSide === "right" ? startWidth + delta : startWidth - delta;
        setWidth(clamp(nextWidth, minWidth, maxWidth));
      };

      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [handleSide, maxWidth, minWidth, width]
  );

  return { width, onResizeStart };
}
