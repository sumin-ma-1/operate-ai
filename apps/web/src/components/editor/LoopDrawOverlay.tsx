"use client";

import { useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";

import { NODE_TYPE_LABELS } from "@/lib/node-labels";
import type { FlowRect } from "@/lib/wrap-nodes-in-loop";
import { useWorkflowStore } from "@/stores/workflowStore";

const MIN_DRAW_SIZE = 48;

export function LoopDrawOverlay() {
  const loopDrawMode = useWorkflowStore((state) => state.loopDrawMode);
  const cancelLoopDrawMode = useWorkflowStore((state) => state.cancelLoopDrawMode);
  const completeLoopDraw = useWorkflowStore((state) => state.completeLoopDraw);
  const { screenToFlowPosition } = useReactFlow();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!loopDrawMode) {
      setDrag(null);
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancelLoopDrawMode();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loopDrawMode, cancelLoopDrawMode]);

  if (!loopDrawMode) {
    return null;
  }

  const preview =
    drag &&
    (() => {
      const left = Math.min(drag.startX, drag.currentX);
      const top = Math.min(drag.startY, drag.currentY);
      const width = Math.abs(drag.currentX - drag.startX);
      const height = Math.abs(drag.currentY - drag.startY);
      return { left, top, width, height };
    })();

  const finishDraw = (clientX: number, clientY: number) => {
    if (!drag || !overlayRef.current) return;

    const overlayRect = overlayRef.current.getBoundingClientRect();
    const startClient = {
      x: overlayRect.left + drag.startX,
      y: overlayRect.top + drag.startY,
    };
    const endClient = { x: clientX, y: clientY };

    const startFlow = screenToFlowPosition(startClient);
    const endFlow = screenToFlowPosition(endClient);

    const bounds: FlowRect = {
      x: Math.min(startFlow.x, endFlow.x),
      y: Math.min(startFlow.y, endFlow.y),
      width: Math.abs(endFlow.x - startFlow.x),
      height: Math.abs(endFlow.y - startFlow.y),
    };

    if (bounds.width >= MIN_DRAW_SIZE && bounds.height >= MIN_DRAW_SIZE) {
      completeLoopDraw(bounds);
    } else {
      cancelLoopDrawMode();
    }

    setDrag(null);
  };

  return (
    <>
      <div className="pointer-events-none absolute top-4 left-1/2 z-40 -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-slate-900/90 px-4 py-1.5 text-sm text-amber-100 shadow-lg backdrop-blur-sm">
          <span className="material-icons text-[18px] leading-none text-amber-300">
            add
          </span>
          Draw a box around LLMs to create {NODE_TYPE_LABELS.loop}
        </div>
      </div>

      <div
        ref={overlayRef}
        className="absolute inset-0 z-30 cursor-crosshair"
        onPointerMove={(event) => {
          const rect = overlayRef.current?.getBoundingClientRect();
          if (!rect) return;
          setCursor({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          });
          if (drag) {
            setDrag((current) =>
              current
                ? {
                    ...current,
                    currentX: event.clientX - rect.left,
                    currentY: event.clientY - rect.top,
                  }
                : current
            );
          }
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const rect = overlayRef.current?.getBoundingClientRect();
          if (!rect) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setDrag({
            startX: event.clientX - rect.left,
            startY: event.clientY - rect.top,
            currentX: event.clientX - rect.left,
            currentY: event.clientY - rect.top,
          });
        }}
        onPointerUp={(event) => {
          if (!drag) return;
          event.currentTarget.releasePointerCapture(event.pointerId);
          finishDraw(event.clientX, event.clientY);
        }}
        onPointerLeave={(event) => {
          if (!drag || !event.currentTarget.hasPointerCapture(event.pointerId)) {
            return;
          }
          event.currentTarget.releasePointerCapture(event.pointerId);
          finishDraw(event.clientX, event.clientY);
        }}
      >
        {!drag && (
          <span
            className="pointer-events-none absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber-400/50 bg-amber-500/20 text-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.25)]"
            style={{ left: cursor.x, top: cursor.y }}
          >
            <span className="material-icons text-[18px] leading-none">add</span>
          </span>
        )}

        {preview && preview.width > 0 && preview.height > 0 && (
          <div
            className="pointer-events-none absolute rounded-lg border-2 border-dashed border-amber-400/80 bg-amber-400/10 shadow-[inset_0_0_24px_rgba(251,191,36,0.08)]"
            style={{
              left: preview.left,
              top: preview.top,
              width: preview.width,
              height: preview.height,
            }}
          />
        )}
      </div>
    </>
  );
}
