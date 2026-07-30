"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type ToastAction = {
  label: string;
  onClick: () => void;
  danger?: boolean;
};

interface ToastProps {
  message: string;
  variant?: "success" | "error";
  placement?: "top" | "center";
  /** Auto-dismiss delay. `0` keeps the toast until closed (e.g. confirm actions). */
  durationMs?: number;
  actions?: ToastAction[];
  onClose: () => void;
}

export function Toast({
  message,
  variant = "success",
  placement = "top",
  durationMs = 2200,
  actions,
  onClose,
}: ToastProps) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const sticky = Boolean(actions?.length) || durationMs === 0;
  const hasActions = Boolean(actions?.length);

  useEffect(() => {
    setMounted(true);
    const show = window.setTimeout(() => setVisible(true), 10);
    if (sticky) {
      return () => window.clearTimeout(show);
    }
    const hide = window.setTimeout(() => setVisible(false), durationMs);
    const remove = window.setTimeout(onClose, durationMs + 250);

    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
      window.clearTimeout(remove);
    };
  }, [durationMs, onClose, sticky]);

  if (!mounted) return null;

  const icon = variant === "error" ? "error_outline" : "check_circle";
  const iconTone =
    variant === "error"
      ? "bg-red-500/15 text-red-300"
      : "bg-emerald-500/15 text-emerald-300";

  const positionClass =
    placement === "center"
      ? "fixed inset-0 z-[100] flex items-center justify-center p-4"
      : "fixed left-1/2 top-[4.75rem] z-[100] w-full max-w-md -translate-x-1/2 px-4";

  const motionClass =
    placement === "center"
      ? visible
        ? "scale-100 opacity-100"
        : "scale-95 opacity-0"
      : visible
        ? "translate-y-0 opacity-100"
        : "-translate-y-2 opacity-0";

  return createPortal(
    <div
      className={`transition duration-200 ${
        sticky ? "pointer-events-auto" : "pointer-events-none"
      } ${positionClass} ${motionClass}`}
      role="status"
      aria-live="polite"
    >
      {placement === "center" && sticky ? (
        <button
          type="button"
          aria-label="Dismiss"
          className="absolute inset-0 bg-black/40"
          onClick={onClose}
        />
      ) : null}
      <div
        className={`relative w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950/95 px-4 py-3.5 text-sm text-foreground shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md ${
          hasActions ? "" : "pointer-events-none"
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconTone}`}
          >
            <span className="material-icons text-[18px] leading-none">
              {icon}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-relaxed text-foreground/90">
              {message}
            </p>
            {hasActions ? (
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                {actions!.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                      action.danger
                        ? "bg-red-500/90 text-white hover:bg-red-500"
                        : "border border-white/10 bg-white/5 text-foreground/85 hover:bg-white/10"
                    }`}
                    onClick={action.onClick}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
