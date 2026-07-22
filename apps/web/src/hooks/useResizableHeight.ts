"use client";

import {
  useCallback,
  useEffect,
  useState,
  type MutableRefObject,
  type PointerEvent,
  type RefObject,
} from "react";

interface UseResizableHeightOptions {
  defaultHeight: number;
  minHeight: number;
  maxHeight?: number;
  containerRef?: RefObject<HTMLElement | null>;
  topReserve?: number;
  storageKey?: string;
  userResizedRef?: MutableRefObject<boolean>;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function useResizableHeight({
  defaultHeight,
  minHeight,
  maxHeight: staticMaxHeight = 720,
  containerRef,
  topReserve = 40,
  storageKey,
  userResizedRef,
}: UseResizableHeightOptions) {
  const [height, setHeightState] = useState(defaultHeight);
  const [measuredMaxHeight, setMeasuredMaxHeight] = useState(staticMaxHeight);

  const maxHeight = containerRef ? measuredMaxHeight : staticMaxHeight;

  const setHeight = useCallback(
    (next: number | ((current: number) => number)) => {
      setHeightState((current) => {
        const resolved = typeof next === "function" ? next(current) : next;
        return clamp(resolved, minHeight, maxHeight);
      });
    },
    [maxHeight, minHeight]
  );

  useEffect(() => {
    if (!containerRef) return;

    const element = containerRef.current;
    if (!element) return;

    const updateMax = () => {
      const nextMax = Math.max(minHeight, element.clientHeight - topReserve);
      setMeasuredMaxHeight(nextMax);
      setHeightState((current) => clamp(current, minHeight, nextMax));
    };

    updateMax();

    const observer = new ResizeObserver(updateMax);
    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef, minHeight, topReserve]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    if (userResizedRef?.current) return;

    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;
    const parsed = Number(saved);
    if (!Number.isNaN(parsed)) {
      setHeightState(clamp(parsed, minHeight, maxHeight));
    }
  }, [storageKey, minHeight, maxHeight, userResizedRef]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    if (!userResizedRef?.current) return;
    window.localStorage.setItem(storageKey, String(height));
  }, [storageKey, height, userResizedRef]);

  useEffect(() => {
    setHeightState((current) => clamp(current, minHeight, maxHeight));
  }, [maxHeight, minHeight]);

  const onResizeStart = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startY = event.clientY;
      const startHeight = height;
      const liveMax =
        containerRef?.current != null
          ? Math.max(minHeight, containerRef.current.clientHeight - topReserve)
          : maxHeight;

      const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
        const delta = startY - moveEvent.clientY;
        setHeightState(clamp(startHeight + delta, minHeight, liveMax));
      };

      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        if (userResizedRef) {
          userResizedRef.current = true;
        }
      };

      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [containerRef, height, maxHeight, minHeight, topReserve, userResizedRef]
  );

  return { height, setHeight, onResizeStart, maxHeight };
}
