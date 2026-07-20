"use client";

import { useEffect, useRef, useState } from "react";

interface OutputActionsProps {
  content: string;
  filename?: string;
}

type DownloadFormat = "txt" | "md" | "json";

const FORMATS: Array<{
  id: DownloadFormat;
  label: string;
  mimeType: string;
}> = [
  { id: "txt", label: "TXT", mimeType: "text/plain;charset=utf-8" },
  { id: "md", label: "MD", mimeType: "text/markdown;charset=utf-8" },
  { id: "json", label: "JSON", mimeType: "application/json;charset=utf-8" },
];

async function copyText(content: string) {
  await navigator.clipboard.writeText(content);
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_") || "output";
}

function stripExtension(filename: string): string {
  return filename.replace(/\.(txt|md|json)$/i, "");
}

function downloadContent(
  content: string,
  filename: string,
  format: DownloadFormat
) {
  const baseName = sanitizeFilename(stripExtension(filename));
  const formatMeta = FORMATS.find((item) => item.id === format) ?? FORMATS[0];
  const blob = new Blob([content], { type: formatMeta.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${baseName}.${formatMeta.id}`;
  link.click();
  URL.revokeObjectURL(url);
}

export function OutputActions({
  content,
  filename = "output.txt",
}: OutputActionsProps) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasContent = content.trim().length > 0;

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

  const handleCopy = async () => {
    if (!hasContent) return;
    try {
      await copyText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleDownload = (format: DownloadFormat) => {
    if (!hasContent) return;
    downloadContent(content, filename, format);
    setDownloaded(true);
    setMenuOpen(false);
    window.setTimeout(() => setDownloaded(false), 1500);
  };

  const iconButtonClass =
    "inline-flex h-7 w-7 items-center justify-center rounded-md bg-transparent p-0 text-muted transition hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className={iconButtonClass}
        disabled={!hasContent}
        onClick={handleCopy}
        title={copied ? "Copied" : "Copy to clipboard"}
        aria-label={copied ? "Copied" : "Copy to clipboard"}
      >
        <span className="material-icons text-[14px] leading-none">
          {copied ? "check" : "content_copy"}
        </span>
      </button>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          className={iconButtonClass}
          disabled={!hasContent}
          onClick={() => setMenuOpen((open) => !open)}
          title={downloaded ? "Downloaded" : "Download file"}
          aria-label={downloaded ? "Downloaded" : "Download file"}
        >
          <span className="material-icons text-[16px] leading-none">
            {downloaded ? "download_done" : "arrow_downward"}
          </span>
        </button>

        {menuOpen && (
          <div className="absolute right-0 z-20 mt-1 min-w-[88px] rounded-md border border-border bg-card p-1 shadow-lg">
            {FORMATS.map((format) => (
              <button
                key={format.id}
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left text-xs text-foreground transition hover:bg-background"
                onClick={() => handleDownload(format.id)}
              >
                .{format.label.toLowerCase()}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
