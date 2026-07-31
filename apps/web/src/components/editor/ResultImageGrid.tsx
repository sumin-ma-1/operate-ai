"use client";

import { openImageInNewTab, toImageDataUrl } from "@/lib/result-images";

type ResultImageGridProps = {
  images: string[];
  /** Compact thumbnails for canvas nodes */
  size?: "sm" | "md";
  className?: string;
};

export function ResultImageGrid({
  images,
  size = "md",
  className = "",
}: ResultImageGridProps) {
  if (!images.length) return null;

  const maxH = size === "sm" ? "max-h-[72px]" : "max-h-40";
  const gap = size === "sm" ? "gap-1.5" : "gap-2";

  return (
    <div className={`flex flex-wrap ${gap} ${className}`}>
      {images.map((raw, index) => {
        const src = toImageDataUrl(raw);
        return (
          <button
            key={`${index}-${raw.slice(0, 24)}`}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openImageInNewTab(raw);
            }}
            className="nodrag nopan group relative overflow-hidden rounded-md border border-white/15 bg-black/30 p-0 text-left transition hover:border-white/35"
            title="Open image"
            aria-label={`Open generated image ${index + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`Generated ${index + 1}`}
              className={`block w-auto ${maxH} object-contain`}
              draggable={false}
            />
          </button>
        );
      })}
    </div>
  );
}
