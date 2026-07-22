"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ToastProps {
  message: string;
  variant?: "success" | "error";
  durationMs?: number;
  onClose: () => void;
}

export function Toast({
  message,
  variant = "success",
  durationMs = 2200,
  onClose,
}: ToastProps) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const show = window.setTimeout(() => setVisible(true), 10);
    const hide = window.setTimeout(() => setVisible(false), durationMs);
    const remove = window.setTimeout(onClose, durationMs + 250);

    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
      window.clearTimeout(remove);
    };
  }, [durationMs, onClose]);

  if (!mounted) return null;

  const tone =
    variant === "error"
      ? "border-red-400/40 bg-red-500/15 text-red-200"
      : "border-emerald-400/35 bg-emerald-500/15 text-emerald-100";

  const icon = variant === "error" ? "error" : "check_circle";

  return createPortal(
    <div
      className={`pointer-events-none fixed left-1/2 top-[4.75rem] z-[100] -translate-x-1/2 transition duration-200 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
      role="status"
      aria-live="polite"
    >
      <div
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-lg backdrop-blur-sm ${tone}`}
      >
        <span className="material-icons text-[18px] leading-none">{icon}</span>
        <span>{message}</span>
      </div>
    </div>,
    document.body
  );
}
