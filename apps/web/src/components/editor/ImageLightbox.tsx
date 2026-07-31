"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  copyImageToClipboard,
  downloadImage,
  toImageDataUrl,
} from "@/lib/result-images";

type ImageLightboxProps = {
  raw: string;
  onClose: () => void;
};

export function ImageLightbox({ raw, onClose }: ImageLightboxProps) {
  const [mounted, setMounted] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "err">("idle");
  const src = toImageDataUrl(raw);

  useEffect(() => {
    setMounted(true);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  if (!mounted) return null;

  const actionBtn =
    "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white/90 shadow-lg backdrop-blur-md transition hover:border-white/35 hover:bg-black/55 hover:text-white";

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      <button
        type="button"
        aria-label="Close preview"
        className="absolute inset-0 bg-black/65"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[min(82vh,900px)] max-w-[min(92vw,960px)]">
        <div className="absolute right-2 top-2 z-20 flex items-center gap-1.5">
          <button
            type="button"
            className={actionBtn}
            title={copyState === "ok" ? "Copied" : "Copy image"}
            aria-label="Copy image"
            onClick={async (event) => {
              event.stopPropagation();
              try {
                await copyImageToClipboard(raw);
                setCopyState("ok");
                window.setTimeout(() => setCopyState("idle"), 1500);
              } catch {
                setCopyState("err");
                window.setTimeout(() => setCopyState("idle"), 1500);
              }
            }}
          >
            <span className="material-icons text-[18px] leading-none">
              {copyState === "ok"
                ? "check"
                : copyState === "err"
                  ? "error_outline"
                  : "content_copy"}
            </span>
          </button>
          <button
            type="button"
            className={actionBtn}
            title="Download"
            aria-label="Download image"
            onClick={(event) => {
              event.stopPropagation();
              downloadImage(raw);
            }}
          >
            <span className="material-icons text-[18px] leading-none">
              download
            </span>
          </button>
          <button
            type="button"
            className={actionBtn}
            title="Close"
            aria-label="Close"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
          >
            <span className="material-icons text-[18px] leading-none">close</span>
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Generated preview"
          className="max-h-[min(82vh,900px)] max-w-[min(92vw,960px)] rounded-xl border border-white/10 object-contain shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          draggable={false}
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    </div>,
    document.body
  );
}
