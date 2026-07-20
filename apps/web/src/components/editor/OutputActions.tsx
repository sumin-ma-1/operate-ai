"use client";

import { useState } from "react";

interface OutputActionsProps {
  content: string;
  filename?: string;
}

async function copyText(content: string) {
  await navigator.clipboard.writeText(content);
}

function downloadText(content: string, filename: string) {
  const safeName = filename.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_") || "output.txt";
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeName.endsWith(".txt") ? safeName : `${safeName}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export function OutputActions({
  content,
  filename = "output.txt",
}: OutputActionsProps) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const hasContent = content.trim().length > 0;

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

  const handleDownload = () => {
    if (!hasContent) return;
    downloadText(content, filename);
    setDownloaded(true);
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
      <button
        type="button"
        className={iconButtonClass}
        disabled={!hasContent}
        onClick={handleDownload}
        title={downloaded ? "Downloaded" : "Download as text file"}
        aria-label={downloaded ? "Downloaded" : "Download as text file"}
      >
        <span className="material-icons text-[16px] leading-none">
          {downloaded ? "download_done" : "arrow_downward"}
        </span>
      </button>
    </div>
  );
}
