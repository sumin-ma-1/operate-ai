/** Build a browser-usable data URL from raw base64 (or pass through if already data:). */
export function toImageDataUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("data:")) {
    return trimmed;
  }
  return `data:image/png;base64,${trimmed}`;
}

export function openImageInNewTab(raw: string): void {
  const url = toImageDataUrl(raw);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    const link = document.createElement("a");
    link.href = url;
    link.download = "generated-image.png";
    link.rel = "noopener";
    link.click();
  }
}
