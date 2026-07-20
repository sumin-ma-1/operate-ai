"use client";

import type { PointerEvent } from "react";

interface ResizeHandleProps {
  side: "left" | "right";
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
}

export function ResizeHandle({ side, onPointerDown }: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      onPointerDown={onPointerDown}
      className={`absolute top-0 z-20 h-full w-1.5 cursor-col-resize touch-none transition-colors hover:bg-primary/40 active:bg-primary/60 ${
        side === "right" ? "right-0" : "left-0"
      }`}
    />
  );
}
